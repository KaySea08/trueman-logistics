import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHmac, randomBytes, createHash } from "node:crypto";
import { Inject } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../redis/redis.module";
import {
  Prisma,
  QuoteOutboxStatus,
  QuoteOutboxType,
  QuoteRequestStatus,
  QuoteStatus,
  RateBasis,
  ShipmentMode,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import {
  CalculateQuoteRequestDto,
  CreateQuoteDto,
  CreateRateRuleDto,
  QuoteRequestListDto,
} from "./quotes.dto";

const money = (n: number) => new Prisma.Decimal(n.toFixed(2));
const tokenDigest = (raw: string) => {
  const key = process.env.AUTH_PEPPER;
  if (!key || key.length < 32)
    throw new Error("AUTH_PEPPER is not configured.");
  return createHmac("sha256", key).update(raw).digest("hex");
};
const quoteNumber = () =>
  `TRQ-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
const quoteRequestNumber = () =>
  `TRQR-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
const shipmentNumber = () =>
  `TRM-${new Date().getUTCFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

type QuoteRequestSnapshot = {
  originCountryCode: "CN";
  chinaCollectionAddress: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  destinationCountryCode: string;
  destinationCity: string;
  destinationAddressLine: string;
  handlingInstructions: string | null;
  packages: Array<{
    description: string;
    quantity: number;
    weightKg: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  }>;
};

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);
  private readonly localRateWindows = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  private localThrottleCalls = 0;
  private redisThrottleWarningAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private async throttle(
    userId: string,
    action: string,
    limit: number,
    seconds: number,
  ) {
    const key = `rl:quotes:${action}:${createHash("sha256").update(userId).digest("hex")}`;
    let count: number;
    try {
      count = Number(
        await this.redis.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",
          1,
          key,
          String(seconds),
        ),
      );
    } catch (error) {
      const now = Date.now();
      if (now >= this.redisThrottleWarningAt) {
        this.redisThrottleWarningAt = now + 60_000;
        this.logger.warn(
          `Redis rate limiter unavailable; using process-local fallback (${error instanceof Error ? error.name : "UnknownError"}).`,
        );
      }
      this.throttleLocally(key, limit, seconds, now);
      return;
    }
    if (count > limit)
      throw new HttpException(
        "Too many quotation requests. Please wait and try again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  private throttleLocally(
    key: string,
    limit: number,
    seconds: number,
    now: number,
  ) {
    this.localThrottleCalls += 1;
    if (
      this.localThrottleCalls % 256 === 0 ||
      this.localRateWindows.size > 10_000
    ) {
      for (const [entryKey, window] of this.localRateWindows) {
        if (window.expiresAt <= now) this.localRateWindows.delete(entryKey);
      }
    }
    if (this.localRateWindows.size > 10_000)
      throw new HttpException(
        "Quotation traffic is temporarily at capacity. Please retry shortly.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const current = this.localRateWindows.get(key);
    if (!current || current.expiresAt <= now) {
      this.localRateWindows.set(key, {
        count: 1,
        expiresAt: now + seconds * 1000,
      });
      return;
    }
    if (current.count >= limit)
      throw new HttpException(
        "Too many quotation requests. Please wait before trying again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    current.count += 1;
  }

  private async customerId(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer)
      throw new ForbiddenException(
        "A customer account is required to request a shipment quote.",
      );
    return customer.id;
  }

  private requestSnapshot(dto: CreateQuoteDto): QuoteRequestSnapshot {
    return {
      originCountryCode: "CN",
      chinaCollectionAddress: dto.chinaCollectionAddress.trim(),
      senderName: dto.senderName.trim(),
      senderPhone: dto.senderPhone,
      recipientName: dto.recipientName.trim(),
      recipientPhone: dto.recipientPhone,
      destinationCountryCode: dto.destinationCountryCode,
      destinationCity: dto.destinationCity.trim(),
      destinationAddressLine: dto.destinationAddressLine.trim(),
      handlingInstructions: dto.handlingInstructions?.trim() ?? null,
      packages: dto.packages.map((pkg) => ({
        description: pkg.description.trim(),
        quantity: pkg.quantity,
        weightKg: pkg.weightKg,
        lengthCm: pkg.lengthCm,
        widthCm: pkg.widthCm,
        heightCm: pkg.heightCm,
      })),
    };
  }

  private requestAcknowledgement(request: {
    id: string;
    requestNumber: string;
    status: QuoteRequestStatus;
    createdAt: Date;
  }) {
    return {
      id: request.id,
      requestNumber: request.requestNumber,
      status: request.status,
      createdAt: request.createdAt,
      message:
        "Your request is received. Our team will calculate and send your quotation.",
    };
  }

  private async existingRequest(
    customerId: string,
    idempotencyKey: string,
    snapshot: QuoteRequestSnapshot,
  ) {
    const request = await this.prisma.quoteRequest.findUnique({
      where: {
        customerId_idempotencyKey: { customerId, idempotencyKey },
      },
      select: {
        id: true,
        requestNumber: true,
        status: true,
        createdAt: true,
        requestSnapshot: true,
      },
    });
    if (!request) return null;
    if (canonicalJson(request.requestSnapshot) !== canonicalJson(snapshot))
      throw new ConflictException(
        "This idempotency key was already used for a different quotation request.",
      );
    return this.requestAcknowledgement(request);
  }

  async create(
    userId: string,
    dto: CreateQuoteDto,
    idempotencyKey?: string,
    ip = "unknown",
  ) {
    await this.throttle(userId, "create", 10, 3600);
    await this.throttle(
      createHash("sha256").update(ip).digest("hex"),
      "create-ip",
      100,
      3600,
    );
    const customerId = await this.customerId(userId);
    if (
      idempotencyKey &&
      (idempotencyKey.length > 64 || !idempotencyKey.trim())
    )
      throw new BadRequestException("Invalid idempotency key.");
    const snapshot = this.requestSnapshot(dto);
    if (idempotencyKey) {
      const existing = await this.existingRequest(
        customerId,
        idempotencyKey,
        snapshot,
      );
      if (existing) return existing;
    }

    try {
      const request = await this.prisma.$transaction(async (tx) => {
        const created = await tx.quoteRequest.create({
          data: {
            requestNumber: quoteRequestNumber(),
            customerId,
            idempotencyKey,
            mode: dto.mode,
            destinationCountryCode: dto.destinationCountryCode,
            destinationCity: dto.destinationCity.trim(),
            requestSnapshot: snapshot,
          },
          select: {
            id: true,
            requestNumber: true,
            status: true,
            createdAt: true,
          },
        });
        await tx.quoteOutboxEvent.create({
          data: {
            eventKey: `quote-request-received:${created.id}`,
            type: QuoteOutboxType.REQUEST_RECEIVED,
            aggregateId: created.id,
            payload: { requestId: created.id },
          },
        });
        await tx.quoteRequestHistory.create({
          data: {
            requestId: created.id,
            actorUserId: userId,
            action: "REQUESTED",
            metadata: {
              requestNumber: created.requestNumber,
              mode: dto.mode,
              destinationCountryCode: dto.destinationCountryCode,
            },
          },
        });
        return created;
      });
      return this.requestAcknowledgement(request);
    } catch (error) {
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.existingRequest(
          customerId,
          idempotencyKey,
          snapshot,
        );
        if (existing) return existing;
      }
      throw error;
    }
  }

  async listMyQuoteRequests(userId: string) {
    const customerId = await this.customerId(userId);
    return this.prisma.quoteRequest.findMany({
      where: {
        customerId,
        status: {
          in: [
            QuoteRequestStatus.REQUESTED,
            QuoteRequestStatus.PROCESSING,
            QuoteRequestStatus.SENDING,
          ],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        requestNumber: true,
        mode: true,
        destinationCountryCode: true,
        destinationCity: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async quoteOfficerStaffId(
    userId: string,
    canManageAll: boolean,
  ): Promise<string | null> {
    if (canManageAll) return null;
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        userId,
        active: true,
        user: { is: { status: "ACTIVE" } },
      },
      select: { id: true },
    });
    if (!staff)
      throw new ForbiddenException(
        "An active quote-officer profile is required.",
      );
    return staff.id;
  }

  async listAdminQuoteRequests(
    query: QuoteRequestListDto,
    actorUserId: string,
    canManageAll: boolean,
  ) {
    const assignedToStaffId = await this.quoteOfficerStaffId(
      actorUserId,
      canManageAll,
    );
    let cursor: { createdAt: Date; id: string } | undefined;
    const cursorOperator = query.sort === "oldest" ? "gt" : "lt";
    const direction = query.sort === "oldest" ? "asc" : "desc";
    const createdFrom = query.createdFrom
      ? new Date(query.createdFrom)
      : undefined;
    const createdTo = query.createdTo
      ? /^\d{4}-\d{2}-\d{2}$/.test(query.createdTo)
        ? new Date(`${query.createdTo}T23:59:59.999Z`)
        : new Date(query.createdTo)
      : undefined;
    if (query.cursor) {
      try {
        const [createdAt, id] = Buffer.from(query.cursor, "base64url")
          .toString("utf8")
          .split("|");
        const parsedDate = new Date(createdAt);
        if (!id || Number.isNaN(parsedDate.getTime())) throw new Error();
        cursor = { createdAt: parsedDate, id };
      } catch {
        throw new BadRequestException("Invalid quote request cursor.");
      }
    }

    const filterGroups: Prisma.QuoteRequestWhereInput[] = [];
    const search = query.search?.trim();
    if (search) {
      filterGroups.push({
        OR: [
          { requestNumber: { contains: search, mode: "insensitive" } },
          { destinationCity: { contains: search, mode: "insensitive" } },
          {
            customer: {
              displayName: { contains: search, mode: "insensitive" },
            },
          },
          {
            customer: {
              user: { email: { contains: search, mode: "insensitive" } },
            },
          },
        ],
      });
    }
    if (cursor) {
      filterGroups.push({
        OR: [
          { createdAt: { [cursorOperator]: cursor.createdAt } },
          {
            createdAt: cursor.createdAt,
            id: { [cursorOperator]: cursor.id },
          },
        ],
      });
    }

    const requests = await this.prisma.quoteRequest.findMany({
      where: {
        status: query.status ?? {
          in: [
            QuoteRequestStatus.REQUESTED,
            QuoteRequestStatus.PROCESSING,
            QuoteRequestStatus.SENDING,
          ],
        },
        ...(assignedToStaffId ? { assignedToStaffId } : {}),
        ...(query.mode ? { mode: query.mode } : {}),
        ...(query.destinationCountryCode
          ? { destinationCountryCode: query.destinationCountryCode }
          : {}),
        ...(createdFrom || createdTo
          ? {
              createdAt: {
                ...(createdFrom ? { gte: createdFrom } : {}),
                ...(createdTo ? { lte: createdTo } : {}),
              },
            }
          : {}),
        ...(filterGroups.length ? { AND: filterGroups } : {}),
      },
      orderBy: [{ createdAt: direction }, { id: direction }],
      take: query.limit + 1,
      select: {
        id: true,
        requestNumber: true,
        mode: true,
        destinationCountryCode: true,
        destinationCity: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        assignedAt: true,
        assignedTo: {
          select: { id: true, fullName: true, employeeCode: true },
        },
        customer: {
          select: {
            displayName: true,
            user: { select: { email: true, phone: true } },
          },
        },
        resultQuote: {
          select: {
            id: true,
            quoteNumber: true,
            status: true,
            currency: true,
            totalAmount: true,
            validUntil: true,
            pricingSnapshot: true,
          },
        },
      },
    });
    const hasMore = requests.length > query.limit;
    const items = requests.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString(
              "base64url",
            )
          : null,
    };
  }

  async quoteQueueMetrics(actorUserId: string, canManageAll: boolean) {
    const assignedToStaffId = await this.quoteOfficerStaffId(
      actorUserId,
      canManageAll,
    );
    const assignedRequestIds = assignedToStaffId
      ? await this.prisma.quoteRequest.findMany({
          where: { assignedToStaffId },
          select: { id: true },
        })
      : null;
    const [requestGroups, outboxGroups] = await Promise.all([
      this.prisma.quoteRequest.groupBy({
        by: ["status"],
        where: assignedToStaffId ? { assignedToStaffId } : undefined,
        _count: { _all: true },
      }),
      assignedRequestIds && !assignedRequestIds.length
        ? Promise.resolve([])
        : this.prisma.quoteOutboxEvent.groupBy({
            by: ["status"],
            where: assignedRequestIds
              ? { aggregateId: { in: assignedRequestIds.map(({ id }) => id) } }
              : undefined,
            _count: { _all: true },
          }),
    ]);
    return {
      requests: Object.fromEntries(
        requestGroups.map((group) => [group.status, group._count._all]),
      ),
      outbox: Object.fromEntries(
        outboxGroups.map((group) => [group.status, group._count._all]),
      ),
    };
  }

  async getAdminQuoteRequest(
    requestId: string,
    actorUserId: string,
    canManageAll: boolean,
  ) {
    const assignedToStaffId = await this.quoteOfficerStaffId(
      actorUserId,
      canManageAll,
    );
    const request = await this.prisma.quoteRequest.findFirst({
      where: {
        id: requestId,
        ...(assignedToStaffId ? { assignedToStaffId } : {}),
      },
      select: {
        id: true,
        requestNumber: true,
        mode: true,
        destinationCountryCode: true,
        destinationCity: true,
        status: true,
        assignedAt: true,
        assignedTo: {
          select: { id: true, fullName: true, employeeCode: true },
        },
        requestSnapshot: true,
        createdAt: true,
        history: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            action: true,
            metadata: true,
            createdAt: true,
            actor: {
              select: {
                email: true,
                staff: { select: { fullName: true, employeeCode: true } },
              },
            },
          },
        },
        customer: {
          select: {
            displayName: true,
            user: { select: { email: true, phone: true } },
          },
        },
        resultQuote: {
          select: {
            id: true,
            quoteNumber: true,
            status: true,
            currency: true,
            totalAmount: true,
            validUntil: true,
            pricingSnapshot: true,
          },
        },
      },
    });
    if (!request) throw new NotFoundException("Quote request not found.");
    return request;
  }

  async quoteStaffList() {
    return this.prisma.staffProfile.findMany({
      where: {
        active: true,
        user: {
          is: {
            status: "ACTIVE",
            userRoles: {
              some: {
                role: {
                  rolePermissions: {
                    some: {
                      permission: {
                        key: { in: ["rates:manage", "quotes:manage"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, employeeCode: true },
    });
  }

  async assignQuoteRequest(
    actorUserId: string,
    requestId: string,
    staffProfileId: string,
  ) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        id: staffProfileId,
        active: true,
        user: {
          is: {
            status: "ACTIVE",
            userRoles: {
              some: {
                role: {
                  rolePermissions: {
                    some: {
                      permission: {
                        key: { in: ["rates:manage", "quotes:manage"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true, fullName: true, employeeCode: true },
    });
    if (!staff)
      throw new BadRequestException(
        "Select an active, authorized quote officer.",
      );

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.quoteRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          requestNumber: true,
          status: true,
          assignedToStaffId: true,
        },
      });
      if (!request) throw new NotFoundException("Quote request not found.");
      if (
        request.status === QuoteRequestStatus.SENT ||
        request.status === QuoteRequestStatus.SENDING
      )
        throw new ConflictException(
          "This quote request can no longer be assigned.",
        );
      const assignedAt = new Date();
      const updated = await tx.quoteRequest.updateMany({
        where: {
          id: requestId,
          status: request.status,
          assignedToStaffId: request.assignedToStaffId,
        },
        data: { assignedToStaffId: staff.id, assignedAt },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "This quote request changed while being assigned. Refresh and retry.",
        );
      await tx.quoteRequestHistory.create({
        data: {
          requestId,
          actorUserId,
          action: "ASSIGNED",
          metadata: {
            requestNumber: request.requestNumber,
            assignedStaffId: staff.id,
            assignedStaffName: staff.fullName,
          },
        },
      });
      await this.audit.recordInTransaction(tx, {
        actorUserId,
        action: "QUOTE_REQUEST_ASSIGNED",
        targetType: "QuoteRequest",
        targetId: requestId,
        outcome: "SUCCESS",
        metadata: { requestNumber: request.requestNumber, staffId: staff.id },
      });
      return { assignedTo: staff, assignedAt };
    });
  }

  async addQuoteRequestNote(
    actorUserId: string,
    requestId: string,
    note: string,
    canManageAll: boolean,
  ) {
    const assignedToStaffId = await this.quoteOfficerStaffId(
      actorUserId,
      canManageAll,
    );
    const request = await this.prisma.quoteRequest.findFirst({
      where: {
        id: requestId,
        ...(assignedToStaffId ? { assignedToStaffId } : {}),
      },
      select: { id: true, requestNumber: true },
    });
    if (!request) throw new NotFoundException("Quote request not found.");
    const history = await this.prisma.quoteRequestHistory.create({
      data: {
        requestId,
        actorUserId,
        action: "INTERNAL_NOTE_ADDED",
        metadata: { note: note.trim() },
      },
      select: { id: true, action: true, metadata: true, createdAt: true },
    });
    await this.audit.record({
      actorUserId,
      action: "QUOTE_REQUEST_NOTE_ADDED",
      targetType: "QuoteRequest",
      targetId: requestId,
      outcome: "SUCCESS",
      metadata: { requestNumber: request.requestNumber },
    });
    return history;
  }

  async calculateQuoteRequest(
    actorUserId: string,
    requestId: string,
    calculation: CalculateQuoteRequestDto,
    canManageAll: boolean,
  ) {
    const { rateRuleId } = calculation;
    const assignedToStaffId = await this.quoteOfficerStaffId(
      actorUserId,
      canManageAll,
    );
    const prepared = await this.prisma.$transaction(
      async (tx) => {
        let request = await tx.quoteRequest.findFirst({
          where: {
            id: requestId,
            ...(assignedToStaffId ? { assignedToStaffId } : {}),
          },
          include: {
            customer: {
              select: {
                displayName: true,
                user: { select: { email: true } },
              },
            },
            resultQuote: true,
          },
        });
        if (!request) throw new NotFoundException("Quote request not found.");
        if (request.status === QuoteRequestStatus.SENT && request.resultQuote) {
          return {
            requestNumber: request.requestNumber,
            quote: request.resultQuote,
            email: request.customer.user.email,
            alreadySent: true,
          };
        }
        if (!request.customer.user.email)
          throw new BadRequestException(
            "This customer account has no email address for quotation delivery.",
          );

        if (request.status === QuoteRequestStatus.SENDING)
          throw new ConflictException(
            "This quotation is already queued for email delivery.",
          );

        const isNewRequest = request.status === QuoteRequestStatus.REQUESTED;
        const isDraftRecalculation =
          request.status === QuoteRequestStatus.PROCESSING &&
          request.resultQuote?.status === QuoteStatus.DRAFT;
        if (isNewRequest || isDraftRecalculation) {
          const now = new Date();
          const rule = await tx.rateRule.findFirst({
            where: {
              id: rateRuleId,
              mode: request.mode,
              active: true,
              validFrom: { lte: now },
              OR: [{ validUntil: null }, { validUntil: { gt: now } }],
              AND: [
                {
                  OR: [
                    { destinationCountryCode: request.destinationCountryCode },
                    { destinationCountryCode: null },
                  ],
                },
              ],
            },
          });
          if (!rule)
            throw new BadRequestException(
              "Select an active rate rule matching this request's shipping method and destination.",
            );

          if (isNewRequest) {
            const claimed = await tx.quoteRequest.updateMany({
              where: { id: requestId, status: QuoteRequestStatus.REQUESTED },
              data: { status: QuoteRequestStatus.PROCESSING },
            });
            if (claimed.count !== 1)
              throw new ConflictException(
                "This quote request is already being handled. Refresh the queue.",
              );
          }

          const snapshot =
            request.requestSnapshot as unknown as QuoteRequestSnapshot;
          const actualWeight = snapshot.packages.reduce(
            (sum, pkg) => sum + pkg.weightKg * pkg.quantity,
            0,
          );
          const volumeM3 = snapshot.packages.reduce(
            (sum, pkg) =>
              sum +
              (pkg.lengthCm * pkg.widthCm * pkg.heightCm * pkg.quantity) /
                1_000_000,
            0,
          );
          const volumetricWeight =
            (volumeM3 * 1_000_000) / Number(rule.volumetricDivisor);
          const chargeableWeight = Math.max(actualWeight, volumetricWeight);
          const billable =
            rule.basis === RateBasis.CBM
              ? volumeM3
              : rule.basis === RateBasis.ACTUAL_KG
                ? actualWeight
                : chargeableWeight;
          const rateBasedCharge = Math.max(
            Number(rule.minimumCharge),
            billable * Number(rule.ratePerUnit),
          );
          const defaultBaseCharge = Math.min(
            Number(rule.minimumCharge),
            rateBasedCharge,
          );
          const defaultVariableCharge = Math.max(
            0,
            rateBasedCharge - defaultBaseCharge,
          );
          const baseCharge = money(calculation.baseCharge ?? defaultBaseCharge);
          const weightCharge = money(
            calculation.weightCharge ??
              (rule.basis === RateBasis.CBM ? 0 : defaultVariableCharge),
          );
          const volumeCharge = money(
            calculation.volumeCharge ??
              (rule.basis === RateBasis.CBM ? defaultVariableCharge : 0),
          );
          const destinationSurcharge = money(
            calculation.destinationSurcharge ?? 0,
          );
          const handlingFee = money(
            calculation.handlingFee ?? Number(rule.handlingFee),
          );
          const insuranceFee = money(calculation.insuranceFee ?? 0);
          const customsCharges = money(calculation.customsCharges ?? 0);
          const serviceCharges = money(calculation.serviceCharges ?? 0);
          const discount = money(calculation.discount ?? 0);
          const subtotal = baseCharge
            .add(weightCharge)
            .add(volumeCharge)
            .add(destinationSurcharge)
            .add(insuranceFee)
            .add(customsCharges)
            .add(serviceCharges);
          const totalAmount = subtotal.add(handlingFee).sub(discount);
          if (totalAmount.lessThan(0))
            throw new BadRequestException(
              "The discount cannot exceed the calculated quotation total.",
            );
          const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const pricingSnapshot = {
            rateRuleId: rule.id,
            rateRuleName: rule.name,
            mode: request.mode,
            basis: rule.basis,
            ratePerUnit: Number(rule.ratePerUnit),
            minimumCharge: Number(rule.minimumCharge),
            handlingFee: Number(rule.handlingFee),
            actualWeightKg: Number(actualWeight.toFixed(3)),
            volumetricWeightKg: Number(volumetricWeight.toFixed(3)),
            chargeableWeightKg: Number(chargeableWeight.toFixed(3)),
            volumeCbm: Number(volumeM3.toFixed(4)),
            billableUnits: Number(billable.toFixed(4)),
            currency: rule.currency,
            breakdown: {
              baseCharge: baseCharge.toNumber(),
              weightCharge: weightCharge.toNumber(),
              volumeCharge: volumeCharge.toNumber(),
              destinationSurcharge: destinationSurcharge.toNumber(),
              handlingFee: handlingFee.toNumber(),
              insuranceFee: insuranceFee.toNumber(),
              customsCharges: customsCharges.toNumber(),
              serviceCharges: serviceCharges.toNumber(),
              discount: discount.toNumber(),
              subtotal: subtotal.toNumber(),
              totalAmount: totalAmount.toNumber(),
            },
          };
          const previousDraft =
            request.resultQuote?.status === QuoteStatus.DRAFT
              ? request.resultQuote
              : null;
          const quoteFields = {
            rateRuleId: rule.id,
            status: QuoteStatus.DRAFT,
            mode: request.mode,
            originCountryCode: "CN",
            destinationCountryCode: request.destinationCountryCode,
            destinationCity: request.destinationCity,
            currency: rule.currency,
            subtotal,
            handlingFee,
            totalAmount,
            chargeableWeightKg: money(chargeableWeight),
            volumeCbm: new Prisma.Decimal(volumeM3.toFixed(4)),
            validUntil,
            requestSnapshot: snapshot as unknown as Prisma.InputJsonObject,
            pricingSnapshot,
          };
          const quote = previousDraft
            ? await tx.quote.update({
                where: { id: previousDraft.id },
                data: { ...quoteFields, quoteNumber: quoteNumber() },
              })
            : await tx.quote.create({
                data: {
                  ...quoteFields,
                  quoteNumber: quoteNumber(),
                  quoteRequestId: request.id,
                  customerId: request.customerId,
                },
              });
          await this.audit.recordInTransaction(tx, {
            actorUserId,
            action: previousDraft
              ? "QUOTE_REQUEST_RECALCULATED"
              : "QUOTE_REQUEST_CALCULATED",
            targetType: "QuoteRequest",
            targetId: request.id,
            outcome: "SUCCESS",
            metadata: {
              requestNumber: request.requestNumber,
              quoteNumber: quote.quoteNumber,
              rateRuleId: rule.id,
              previousQuoteNumber: previousDraft?.quoteNumber ?? null,
              previousPricingSnapshot: previousDraft?.pricingSnapshot ?? null,
              pricingSnapshot: quote.pricingSnapshot,
            },
          });
          await tx.quoteRequestHistory.create({
            data: {
              requestId: request.id,
              actorUserId,
              action: previousDraft ? "RECALCULATED" : "CALCULATED",
              metadata: {
                quoteNumber: quote.quoteNumber,
                rateRuleId: rule.id,
                previousQuoteNumber: previousDraft?.quoteNumber ?? null,
                previousPricingSnapshot: previousDraft?.pricingSnapshot ?? null,
                pricingSnapshot: quote.pricingSnapshot,
              },
            },
          });
          request = {
            ...request,
            status: QuoteRequestStatus.PROCESSING,
            resultQuote: quote,
          };
        }

        if (
          request.status !== QuoteRequestStatus.PROCESSING ||
          !request.resultQuote
        )
          throw new ConflictException(
            "This quote request is not ready to send. Refresh the queue.",
          );

        return {
          requestNumber: request.requestNumber,
          quote: request.resultQuote,
          email: request.customer.user.email,
          alreadySent: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (prepared.alreadySent)
      return {
        message: "This quotation has already been sent to the customer.",
        requestNumber: prepared.requestNumber,
        quoteNumber: prepared.quote.quoteNumber,
        status: QuoteRequestStatus.SENT,
        quote: prepared.quote,
      };
    return {
      message: "Calculation saved as a draft for review.",
      requestNumber: prepared.requestNumber,
      quoteNumber: prepared.quote.quoteNumber,
      status: QuoteRequestStatus.PROCESSING,
      quote: prepared.quote,
    };
  }

  async queueQuoteEmail(
    actorUserId: string,
    requestId: string,
    canManageAll: boolean,
  ) {
    const assignedToStaffId = await this.quoteOfficerStaffId(
      actorUserId,
      canManageAll,
    );
    return this.prisma.$transaction(
      async (tx) => {
        const request = await tx.quoteRequest.findFirst({
          where: {
            id: requestId,
            ...(assignedToStaffId ? { assignedToStaffId } : {}),
          },
          include: {
            customer: { select: { user: { select: { email: true } } } },
            resultQuote: true,
          },
        });
        if (!request) throw new NotFoundException("Quote request not found.");
        if (request.status === QuoteRequestStatus.SENT && request.resultQuote)
          return {
            message: "This quotation has already been sent to the customer.",
            requestNumber: request.requestNumber,
            quoteNumber: request.resultQuote.quoteNumber,
            status: QuoteRequestStatus.SENT,
          };
        if (
          request.status !== QuoteRequestStatus.PROCESSING ||
          request.resultQuote?.status !== QuoteStatus.DRAFT
        )
          throw new ConflictException(
            "Calculate and review a draft quotation before sending it.",
          );
        if (!request.customer.user.email)
          throw new BadRequestException(
            "This customer account has no email address for quotation delivery.",
          );

        const claimed = await tx.quoteRequest.updateMany({
          where: { id: requestId, status: QuoteRequestStatus.PROCESSING },
          data: { status: QuoteRequestStatus.SENDING },
        });
        if (claimed.count !== 1)
          throw new ConflictException(
            "This quotation is already being queued for delivery.",
          );

        const eventKey = `quote-ready:${requestId}:${request.resultQuote.id}`;
        await tx.quoteOutboxEvent.upsert({
          where: { eventKey },
          create: {
            eventKey,
            type: QuoteOutboxType.QUOTE_READY,
            aggregateId: requestId,
            payload: {
              requestId,
              quoteId: request.resultQuote.id,
              actorUserId,
            },
          },
          update: {
            status: QuoteOutboxStatus.PENDING,
            attempts: 0,
            availableAt: new Date(),
            lockedAt: null,
            processedAt: null,
            lastError: null,
          },
        });
        await tx.quoteRequestHistory.create({
          data: {
            requestId,
            actorUserId,
            action: "SEND_QUEUED",
            metadata: {
              requestNumber: request.requestNumber,
              quoteNumber: request.resultQuote.quoteNumber,
              eventKey,
            },
          },
        });
        await this.audit.recordInTransaction(tx, {
          actorUserId,
          action: "QUOTE_SEND_QUEUED",
          targetType: "QuoteRequest",
          targetId: requestId,
          outcome: "SUCCESS",
          metadata: {
            requestNumber: request.requestNumber,
            quoteNumber: request.resultQuote.quoteNumber,
            eventKey,
          },
        });
        return {
          message: "The quotation was queued for email delivery.",
          requestNumber: request.requestNumber,
          quoteNumber: request.resultQuote.quoteNumber,
          status: QuoteRequestStatus.SENDING,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listMine(userId: string) {
    const customerId = await this.customerId(userId);
    await this.prisma.quote.updateMany({
      where: {
        customerId,
        status: QuoteStatus.QUOTED,
        validUntil: { lte: new Date() },
      },
      data: { status: QuoteStatus.EXPIRED },
    });
    return this.prisma.quote.findMany({
      where: { customerId, status: { not: QuoteStatus.DRAFT } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        mode: true,
        destinationCountryCode: true,
        destinationCity: true,
        currency: true,
        totalAmount: true,
        validUntil: true,
        createdAt: true,
        shipment: { select: { shipmentNumber: true, status: true } },
      },
    });
  }

  async listMyShipments(userId: string) {
    const customerId = await this.customerId(userId);
    return this.prisma.shipment.findMany({
      where: {
        customerId,
        status: { notIn: ["DELIVERED", "CANCELLED", "RETURNED_TO_SENDER"] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        shipmentNumber: true,
        status: true,
        mode: true,
        updatedAt: true,
        estimatedDelivery: true,
        addresses: {
          select: { kind: true, city: true, countryCode: true },
        },
        events: {
          orderBy: { occurredAt: "desc" },
          take: 5,
          select: { status: true, locationLabel: true, occurredAt: true },
        },
      },
    });
  }

  async accept(userId: string, quoteId: string) {
    await this.throttle(userId, "accept", 10, 3600);
    const customerId = await this.customerId(userId);
    const rawTracking = `TRK-${randomBytes(24).toString("base64url").toUpperCase()}`;
    let result: any;
    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          const quote = await tx.quote.findFirst({
            where: { id: quoteId, customerId },
            include: { shipment: true },
          });
          if (!quote) throw new NotFoundException("Quotation not found.");
          if (quote.status === QuoteStatus.ACCEPTED && quote.shipment)
            return {
              alreadyAccepted: true,
              shipment: quote.shipment,
              trackingReference: null,
            };
          if (quote.status !== QuoteStatus.QUOTED)
            throw new ConflictException(
              "This quotation is no longer available for acceptance.",
            );
          if (quote.validUntil <= new Date())
            throw new ConflictException(
              "This quotation has expired. Request a new quotation.",
            );
          const locked = await tx.quote.updateMany({
            where: {
              id: quote.id,
              customerId,
              status: QuoteStatus.QUOTED,
              validUntil: { gt: new Date() },
            },
            data: { status: QuoteStatus.ACCEPTED, acceptedAt: new Date() },
          });
          if (locked.count !== 1)
            throw new ConflictException(
              "The quotation was updated by another request. Refresh and try again.",
            );
          const snap = quote.requestSnapshot as any;
          const submitter = await tx.user.findUnique({
            where: { id: userId },
            select: {
              userRoles: { select: { role: { select: { name: true } } } },
            },
          });
          const roleNames = (submitter?.userRoles ?? [])
            .map((assignment) => assignment.role.name)
            .sort();
          if (!roleNames.length)
            throw new ForbiddenException(
              "Your account does not have an assigned submission role.",
            );
          const submitterRole =
            roleNames.find((role) => role !== "CUSTOMER") ?? roleNames[0];
          const creationSource =
            submitterRole === "CUSTOMER" ? "CUSTOMER" : "STAFF";
          const submittedAt = new Date();
          const shipment = await tx.shipment.create({
            data: {
              shipmentNumber: shipmentNumber(),
              customerId,
              quoteId: quote.id,
              createdByUserId: userId,
              submitterRole,
              creationSource,
              submittedAt,
              mode: quote.mode,
              currency: quote.currency,
              quotedAmount: quote.totalAmount,
              status: "ORDER_RECEIVED",
              packages: {
                create: snap.packages.map((p: any) => ({
                  description: p.description,
                  quantity: p.quantity,
                  weightKg: p.weightKg,
                  lengthCm: p.lengthCm,
                  widthCm: p.widthCm,
                  heightCm: p.heightCm,
                })),
              },
              addresses: {
                create: [
                  {
                    kind: "ORIGIN",
                    contactName: snap.senderName,
                    contactPhone: snap.senderPhone,
                    countryCode: "CN",
                    city: "China",
                    addressLine: snap.chinaCollectionAddress,
                  },
                  {
                    kind: "DESTINATION",
                    contactName: snap.recipientName,
                    contactPhone: snap.recipientPhone,
                    countryCode: snap.destinationCountryCode,
                    city: snap.destinationCity,
                    addressLine: snap.destinationAddressLine,
                  },
                ],
              },
              trackingReference: {
                create: { tokenDigest: tokenDigest(rawTracking) },
              },
              events: {
                create: {
                  previousStatus: null,
                  status: "ORDER_RECEIVED",
                  locationLabel: "China · Order received",
                  notes: "Shipment created after quotation acceptance.",
                  source: "SYSTEM",
                  actorUserId: userId,
                },
              },
            },
          });
          await this.audit.recordInTransaction(tx, {
            actorUserId: userId,
            action: "QUOTE_ACCEPTED_SHIPMENT_CREATED",
            targetType: "Shipment",
            targetId: shipment.id,
            outcome: "SUCCESS",
            metadata: {
              quoteId,
              shipmentNumber: shipment.shipmentNumber,
              submitterRole,
              creationSource,
            },
          });
          return {
            alreadyAccepted: false,
            shipment,
            trackingReference: rawTracking,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: any) {
      if (error?.code === "P2002" || error?.code === "P2034")
        throw new ConflictException(
          "This request conflicts with another update. Refresh your quotations and try again.",
        );
      throw error;
    }
    return {
      shipment: result.shipment,
      trackingReference: result.trackingReference,
      message: result.alreadyAccepted
        ? "This quotation was already accepted. The tracking reference is not reissued; use the reference saved when it was first created."
        : "Quotation accepted and shipment created. Save the tracking reference; it will not be displayed again.",
    };
  }

  async createRateRule(userId: string, dto: CreateRateRuleDto) {
    if (dto.mode === "SEA" && dto.basis !== RateBasis.CBM)
      throw new BadRequestException(
        "Sea freight rate rules must use CBM billing in this release.",
      );
    if (dto.mode !== "SEA" && dto.basis === RateBasis.CBM)
      throw new BadRequestException("CBM billing is reserved for sea freight.");
    if (dto.validUntil && new Date(dto.validUntil) <= new Date())
      throw new BadRequestException("Rate rule expiry must be in the future.");
    const rule = await this.prisma.rateRule.create({
      data: {
        name: dto.name.trim(),
        mode: dto.mode,
        basis: dto.basis,
        destinationCountryCode: dto.destinationCountryCode ?? null,
        currency: dto.currency,
        ratePerUnit: new Prisma.Decimal(dto.ratePerUnit.toFixed(4)),
        minimumCharge: money(dto.minimumCharge),
        handlingFee: money(dto.handlingFee),
        volumetricDivisor: new Prisma.Decimal(dto.volumetricDivisor ?? 6000),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
    });
    await this.audit.record({
      actorUserId: userId,
      action: "SHIPPING_RATE_RULE_CREATED",
      targetType: "RateRule",
      targetId: rule.id,
      outcome: "SUCCESS",
      metadata: {
        mode: rule.mode,
        basis: rule.basis,
        destinationCountryCode: rule.destinationCountryCode,
        currency: rule.currency,
      },
    });
    return rule;
  }
  async listRateRules() {
    return this.prisma.rateRule.findMany({
      orderBy: [
        { active: "desc" },
        { mode: "asc" },
        { destinationCountryCode: "asc" },
        { createdAt: "desc" },
      ],
    });
  }
}
