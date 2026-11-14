import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import {
  Prisma,
  QuoteOutboxStatus,
  QuoteOutboxType,
  QuoteRequestStatus,
  QuoteStatus,
} from "@prisma/client";
import Redis from "ioredis";
import { AuditService } from "../common/audit.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS } from "../redis/redis.module";

const ADMIN_QUOTE_CHANNEL = "trueman:admin:quote-requests";
const CUSTOMER_QUOTE_CHANNEL = "trueman:customer:quote-requests";

type OutboxPayload = {
  requestId?: string;
  quoteId?: string;
  actorUserId?: string;
};

@Injectable()
export class QuoteOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QuoteOutboxWorker.name);
  private active = false;
  private timer: NodeJS.Timeout | null = null;
  private wakePoll: (() => void) | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  onModuleInit() {
    if (process.env.QUOTE_WORKER_ENABLED !== "true") return;
    this.active = true;
    this.runPromise = this.run();
  }

  async onModuleDestroy() {
    this.active = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.wakePoll?.();
      this.wakePoll = null;
    }
    await this.runPromise;
  }

  private async run() {
    const pollMs = Math.max(
      100,
      Number(process.env.QUOTE_OUTBOX_POLL_MS ?? 500),
    );
    while (this.active) {
      let processed = 0;
      try {
        processed = await this.processBatch();
      } catch (error) {
        this.logger.error(
          `Outbox poll failed: ${error instanceof Error ? error.name : "UnknownError"}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      if (!this.active) break;
      await this.waitForNextPoll(processed ? 20 : pollMs);
    }
  }

  private waitForNextPoll(milliseconds: number) {
    return new Promise<void>((resolve) => {
      this.wakePoll = resolve;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.wakePoll = null;
        resolve();
      }, milliseconds);
    });
  }

  private async processBatch() {
    const now = new Date();
    const leaseExpiredBefore = new Date(
      now.getTime() - Number(process.env.QUOTE_OUTBOX_LEASE_MS ?? 60_000),
    );
    const batchSize = Math.min(
      32,
      Math.max(1, Number(process.env.QUOTE_OUTBOX_CONCURRENCY ?? 8)),
    );
    const events = await this.prisma.quoteOutboxEvent.findMany({
      where: {
        OR: [
          { status: QuoteOutboxStatus.PENDING, availableAt: { lte: now } },
          {
            status: QuoteOutboxStatus.PROCESSING,
            OR: [{ lockedAt: null }, { lockedAt: { lte: leaseExpiredBefore } }],
          },
        ],
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      take: batchSize,
    });
    if (!events.length) return 0;
    await Promise.all(events.map((event) => this.processEvent(event)));
    return events.length;
  }

  private async processEvent(event: {
    id: string;
    eventKey: string;
    type: QuoteOutboxType;
    aggregateId: string;
    payload: Prisma.JsonValue;
    status: QuoteOutboxStatus;
    attempts: number;
  }) {
    const now = new Date();
    const leaseExpiredBefore = new Date(
      now.getTime() - Number(process.env.QUOTE_OUTBOX_LEASE_MS ?? 60_000),
    );
    const claimWhere: Prisma.QuoteOutboxEventWhereInput =
      event.status === QuoteOutboxStatus.PENDING
        ? {
            id: event.id,
            status: QuoteOutboxStatus.PENDING,
            availableAt: { lte: now },
          }
        : {
            id: event.id,
            status: QuoteOutboxStatus.PROCESSING,
            OR: [{ lockedAt: null }, { lockedAt: { lte: leaseExpiredBefore } }],
          };
    const claim = await this.prisma.quoteOutboxEvent.updateMany({
      where: claimWhere,
      data: {
        status: QuoteOutboxStatus.PROCESSING,
        lockedAt: now,
        attempts: { increment: 1 },
      },
    });
    if (claim.count !== 1) return;

    try {
      const payload = event.payload as OutboxPayload;
      if (event.type === QuoteOutboxType.REQUEST_RECEIVED) {
        await this.processRequestReceived(event, payload);
      } else if (event.type === QuoteOutboxType.QUOTE_READY) {
        await this.processQuoteReady(event, payload);
      } else {
        throw new Error("UnsupportedOutboxEvent");
      }
      await this.prisma.quoteOutboxEvent.updateMany({
        where: {
          id: event.id,
          status: QuoteOutboxStatus.PROCESSING,
        },
        data: {
          status: QuoteOutboxStatus.COMPLETED,
          processedAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      });
    } catch (error) {
      await this.retryOrDeadLetter(event, error);
    }
  }

  private async processRequestReceived(
    event: { eventKey: string; aggregateId: string },
    payload: OutboxPayload,
  ) {
    const requestId = payload.requestId ?? event.aggregateId;
    const request = await this.prisma.quoteRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        requestNumber: true,
        mode: true,
        destinationCity: true,
        destinationCountryCode: true,
        customer: { select: { user: { select: { email: true } } } },
      },
    });
    if (!request) throw new Error("QuoteRequestNotFound");

    await this.publishBestEffort(ADMIN_QUOTE_CHANNEL, {
      type: "quote-request-created",
      requestId: request.id,
      requestNumber: request.requestNumber,
    });

    const email = request.customer.user.email;
    if (email) {
      await this.mail.sendQuoteRequestReceived(
        email,
        request.requestNumber,
        `${request.destinationCity}, ${request.destinationCountryCode}`,
        request.mode,
        event.eventKey,
      );
    }
  }

  private async processQuoteReady(
    event: { eventKey: string },
    payload: OutboxPayload,
  ) {
    if (!payload.requestId || !payload.quoteId || !payload.actorUserId)
      throw new Error("InvalidQuoteReadyPayload");
    const requestId = payload.requestId;
    const actorUserId = payload.actorUserId;
    const quote = await this.prisma.quote.findUnique({
      where: { id: payload.quoteId },
      include: {
        quoteRequest: {
          include: { customer: { include: { user: true } } },
        },
      },
    });
    if (!quote?.quoteRequest) throw new Error("QuoteRequestNotFound");
    if (
      quote.status === QuoteStatus.QUOTED &&
      quote.quoteRequest.status === QuoteRequestStatus.SENT
    )
      return;
    const email = quote.quoteRequest.customer.user.email;
    if (!email) throw new Error("CustomerEmailMissing");
    const requestNumber = quote.quoteRequest.requestNumber;

    await this.mail.sendQuotationReady(
      email,
      quote.quoteNumber,
      `${quote.destinationCity}, ${quote.destinationCountryCode}`,
      `${quote.currency} ${quote.totalAmount.toString()}`,
      quote.validUntil,
      event.eventKey,
    );

    await this.prisma.$transaction(async (tx) => {
      const requestUpdate = await tx.quoteRequest.updateMany({
        where: {
          id: requestId,
          status: QuoteRequestStatus.SENDING,
        },
        data: { status: QuoteRequestStatus.SENT },
      });
      const quoteUpdate = await tx.quote.updateMany({
        where: { id: payload.quoteId, status: QuoteStatus.DRAFT },
        data: { status: QuoteStatus.QUOTED },
      });
      if (requestUpdate.count !== 1 || quoteUpdate.count !== 1) {
        const currentRequest = await tx.quoteRequest.findUnique({
          where: { id: payload.requestId },
          select: { status: true },
        });
        const currentQuote = await tx.quote.findUnique({
          where: { id: payload.quoteId },
          select: { status: true },
        });
        if (
          currentRequest?.status !== QuoteRequestStatus.SENT ||
          currentQuote?.status !== QuoteStatus.QUOTED
        )
          throw new Error("QuoteReadyStateConflict");
      } else {
        await tx.quoteRequestHistory.create({
          data: {
            requestId,
            actorUserId,
            action: "SENT_TO_CUSTOMER",
            metadata: {
              requestNumber,
              quoteNumber: quote.quoteNumber,
              outboxEventKey: event.eventKey,
            },
          },
        });
        await this.audit.recordInTransaction(tx, {
          actorUserId,
          action: "QUOTE_SENT_TO_CUSTOMER",
          targetType: "QuoteRequest",
          targetId: requestId,
          outcome: "SUCCESS",
          metadata: {
            requestNumber,
            quoteNumber: quote.quoteNumber,
          },
        });
      }
    });

    await this.publishBestEffort(CUSTOMER_QUOTE_CHANNEL, {
      type: "quote-ready",
      requestId: payload.requestId,
      customerId: quote.customerId,
    });
  }

  private async publishBestEffort(
    channel: string,
    payload: Record<string, unknown>,
  ) {
    try {
      await this.redis.publish(channel, JSON.stringify(payload));
    } catch {
      this.logger.warn(`Redis notification publish failed for ${channel}`);
    }
  }

  private async retryOrDeadLetter(
    event: {
      id: string;
      type: QuoteOutboxType;
      payload: Prisma.JsonValue;
      attempts: number;
    },
    error: unknown,
  ) {
    const attempts = event.attempts + 1;
    const maxAttempts = Math.max(
      1,
      Number(process.env.QUOTE_OUTBOX_MAX_ATTEMPTS ?? 8),
    );
    const deadLetter = attempts >= maxAttempts;
    const baseDelay = 1_000 * 2 ** Math.min(attempts, 10);
    const delayMs = Math.min(
      15 * 60_000,
      Math.round(baseDelay * (0.5 + Math.random())),
    );
    const payload = event.payload as OutboxPayload;
    await this.prisma.$transaction(async (tx) => {
      await tx.quoteOutboxEvent.updateMany({
        where: {
          id: event.id,
          status: QuoteOutboxStatus.PROCESSING,
        },
        data: {
          status: deadLetter
            ? QuoteOutboxStatus.DEAD_LETTER
            : QuoteOutboxStatus.PENDING,
          availableAt: new Date(Date.now() + delayMs),
          lockedAt: null,
          lastError:
            error instanceof Error ? error.name.slice(0, 1000) : "UnknownError",
        },
      });
      if (
        deadLetter &&
        event.type === QuoteOutboxType.QUOTE_READY &&
        payload.requestId
      ) {
        await tx.quoteRequest.updateMany({
          where: {
            id: payload.requestId,
            status: QuoteRequestStatus.SENDING,
          },
          data: { status: QuoteRequestStatus.PROCESSING },
        });
        await tx.quoteRequestHistory.create({
          data: {
            requestId: payload.requestId,
            actorUserId: payload.actorUserId,
            action: "DELIVERY_DEAD_LETTERED",
            metadata: {
              attempts,
              outboxEventId: event.id,
              errorName: error instanceof Error ? error.name : "UnknownError",
            },
          },
        });
      }
    });
    const errorName = error instanceof Error ? error.name : "UnknownError";
    if (deadLetter) {
      this.logger.error(
        `Outbox event ${event.id} moved to dead letter: ${errorName}`,
      );
    } else {
      this.logger.warn(
        `Outbox event ${event.id} attempt ${attempts} failed: ${errorName}`,
      );
    }
  }
}
