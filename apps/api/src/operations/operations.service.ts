import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import {
  Prisma,
  ShipmentCreationSource,
  ShipmentReviewStatus,
  ShipmentStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";
import Redis from "ioredis";
import { REDIS } from "../redis/redis.module";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit.service";
import {
  AssignShipmentDto,
  ReviewShipmentDto,
  ShipmentEventDto,
  ShipmentListQueryDto,
} from "./operations.dto";

const TERMINAL_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CANCELLED,
  ShipmentStatus.RETURNED_TO_SENDER,
];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ORDER_RECEIVED: ["ORDER_CONFIRMED", "CANCELLED", "HELD_FOR_INSPECTION"],
  ORDER_CONFIRMED: ["AWAITING_PICKUP", "CANCELLED", "HELD_FOR_INSPECTION"],
  AWAITING_PICKUP: ["PICKED_UP", "CANCELLED", "HELD_FOR_INSPECTION"],
  PICKED_UP: ["ORIGIN_FACILITY", "EXPORT_PROCESSING", "HELD_FOR_INSPECTION"],
  ORIGIN_FACILITY: [
    "EXPORT_PROCESSING",
    "DEPARTED_ORIGIN",
    "HELD_FOR_INSPECTION",
  ],
  EXPORT_PROCESSING: ["DEPARTED_ORIGIN", "HELD_FOR_INSPECTION"],
  DEPARTED_ORIGIN: ["IN_TRANSIT", "ARRIVED_DESTINATION", "HELD_FOR_INSPECTION"],
  IN_TRANSIT: [
    "ARRIVED_DESTINATION",
    "HELD_FOR_INSPECTION",
    "RETURNED_TO_SENDER",
  ],
  ARRIVED_DESTINATION: [
    "CUSTOMS_PROCESSING",
    "CUSTOMS_CLEARED",
    "DESTINATION_FACILITY",
    "HELD_FOR_INSPECTION",
  ],
  CUSTOMS_PROCESSING: [
    "CUSTOMS_CLEARED",
    "HELD_FOR_INSPECTION",
    "RETURNED_TO_SENDER",
  ],
  CUSTOMS_CLEARED: ["DESTINATION_FACILITY", "OUT_FOR_DELIVERY"],
  DESTINATION_FACILITY: ["OUT_FOR_DELIVERY", "RETURNED_TO_SENDER"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED", "HELD_FOR_INSPECTION"],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "RETURNED_TO_SENDER"],
  HELD_FOR_INSPECTION: [
    "EXPORT_PROCESSING",
    "CUSTOMS_PROCESSING",
    "CUSTOMS_CLEARED",
    "DESTINATION_FACILITY",
    "RETURNED_TO_SENDER",
  ],
};

@Injectable()
export class OperationsService {
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
    const actorDigest = createHash("sha256").update(userId).digest("hex");
    const key = `rl:operations:${action}:${actorDigest}`;
    const count = Number(
      await this.redis.eval(
        "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n;",
        1,
        key,
        String(seconds),
      ),
    );
    if (count > limit) {
      throw new HttpException(
        "Too many operations requests. Please wait and try again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async summary() {
    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const [
      total,
      pendingReview,
      active,
      inTransit,
      deliveredLast30Days,
      delayed,
      submittedToday,
    ] = await Promise.all([
      this.prisma.shipment.count(),
      this.prisma.shipment.count({
        where: { reviewStatus: ShipmentReviewStatus.PENDING_REVIEW },
      }),
      this.prisma.shipment.count({
        where: { status: { notIn: TERMINAL_STATUSES } },
      }),
      this.prisma.shipment.count({
        where: {
          status: {
            in: [
              ShipmentStatus.DEPARTED_ORIGIN,
              ShipmentStatus.IN_TRANSIT,
              ShipmentStatus.ARRIVED_DESTINATION,
              ShipmentStatus.CUSTOMS_PROCESSING,
              ShipmentStatus.CUSTOMS_CLEARED,
            ],
          },
        },
      }),
      this.prisma.shipment.count({
        where: {
          status: ShipmentStatus.DELIVERED,
          deliveredAt: { gte: new Date(now.getTime() - 30 * 86400000) },
        },
      }),
      this.prisma.shipment.count({
        where: {
          estimatedDelivery: { lt: now },
          status: { notIn: TERMINAL_STATUSES },
        },
      }),
      this.prisma.shipment.count({ where: { submittedAt: { gte: today } } }),
    ]);

    return {
      generatedAt: now.toISOString(),
      total,
      pendingReview,
      active,
      inTransit,
      deliveredLast30Days,
      delayed,
      submittedToday,
    };
  }

  async listShipments(query: ShipmentListQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const search = query.search?.trim();
    const where: Prisma.ShipmentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.reviewStatus
        ? { reviewStatus: query.reviewStatus as ShipmentReviewStatus }
        : {}),
      ...(query.creationSource
        ? { creationSource: query.creationSource as ShipmentCreationSource }
        : {}),
      ...(search
        ? {
            OR: [
              { shipmentNumber: { contains: search, mode: "insensitive" } },
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
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: {
            select: {
              displayName: true,
              user: { select: { email: true, phone: true } },
            },
          },
          createdBy: {
            select: {
              email: true,
              phone: true,
              staff: { select: { fullName: true, employeeCode: true } },
            },
          },
          reviewedBy: {
            select: { email: true, staff: { select: { fullName: true } } },
          },
          quote: {
            select: { destinationCountryCode: true, destinationCity: true },
          },
          assignments: {
            where: { unassignedAt: null },
            include: {
              staff: {
                select: { id: true, fullName: true, employeeCode: true },
              },
            },
            orderBy: { assignedAt: "desc" },
          },
          events: { orderBy: { occurredAt: "desc" }, take: 3 },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async getShipment(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            displayName: true,
            user: { select: { email: true, phone: true } },
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            phone: true,
            staff: { select: { fullName: true, employeeCode: true } },
          },
        },
        reviewedBy: {
          select: {
            id: true,
            email: true,
            staff: { select: { fullName: true } },
          },
        },
        packages: true,
        addresses: true,
        quote: {
          select: {
            quoteNumber: true,
            currency: true,
            totalAmount: true,
            validUntil: true,
            destinationCountryCode: true,
            destinationCity: true,
          },
        },
        assignments: {
          include: {
            staff: { select: { id: true, fullName: true, employeeCode: true } },
          },
          orderBy: { assignedAt: "desc" },
        },
        events: { orderBy: { occurredAt: "desc" } },
      },
    });
    if (!shipment) throw new NotFoundException("Shipment not found.");
    return shipment;
  }

  async staffList() {
    return this.prisma.staffProfile.findMany({
      where: {
        active: true,
        user: {
          status: "ACTIVE",
          userRoles: {
            some: {
              role: {
                name: {
                  in: [
                    "OPERATIONS_MANAGER",
                    "SHIPMENT_OFFICER",
                    "WAREHOUSE_PERSONNEL",
                    "DELIVERY_PERSONNEL",
                  ],
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

  async activity() {
    const staffAccounts = await this.prisma.staffProfile.findMany({
      select: { userId: true },
    });
    const staffUserIds = staffAccounts.map((staff) => staff.userId);
    if (!staffUserIds.length) return [];

    const events = await this.prisma.auditEvent.findMany({
      where: { actorUserId: { in: staffUserIds }, targetType: "Shipment" },
      orderBy: { occurredAt: "desc" },
      take: 30,
      include: {
        actor: {
          select: {
            email: true,
            staff: { select: { fullName: true, employeeCode: true } },
          },
        },
      },
    });
    const shipmentIds = [
      ...new Set(
        events
          .map((event) => event.targetId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const shipments = await this.prisma.shipment.findMany({
      where: { id: { in: shipmentIds } },
      select: { id: true, shipmentNumber: true },
    });
    const byId = new Map(shipments.map((shipment) => [shipment.id, shipment]));

    return events.map((event) => ({
      id: event.id,
      action: event.action,
      occurredAt: event.occurredAt,
      shipment: event.targetId ? (byId.get(event.targetId) ?? null) : null,
      actor: event.actor,
    }));
  }

  async reviewShipment(
    shipmentId: string,
    actorUserId: string,
    dto: ReviewShipmentDto,
  ) {
    await this.throttle(actorUserId, "review", 30, 300);
    if (dto.action !== "APPROVE" && !dto.reviewNote?.trim()) {
      throw new BadRequestException(
        "A review note is required when rejecting or requesting corrections.",
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
      });
      if (!shipment) throw new NotFoundException("Shipment not found.");
      if (
        shipment.reviewStatus !== ShipmentReviewStatus.PENDING_REVIEW &&
        shipment.reviewStatus !== ShipmentReviewStatus.NEEDS_CORRECTION
      ) {
        throw new ConflictException(
          "This shipment has already received a final review decision.",
        );
      }

      const nextReviewStatus =
        dto.action === "APPROVE"
          ? ShipmentReviewStatus.APPROVED
          : dto.action === "REJECT"
            ? ShipmentReviewStatus.REJECTED
            : ShipmentReviewStatus.NEEDS_CORRECTION;
      const now = new Date();
      const changed = await tx.shipment.updateMany({
        where: {
          id: shipment.id,
          reviewStatus: shipment.reviewStatus,
          status: shipment.status,
        },
        data: {
          reviewStatus: nextReviewStatus,
          reviewedByUserId: actorUserId,
          reviewedAt: now,
          reviewNote: dto.reviewNote?.trim() ?? null,
          ...(dto.action === "APPROVE" &&
          shipment.status === ShipmentStatus.ORDER_RECEIVED
            ? { status: ShipmentStatus.ORDER_CONFIRMED, confirmedAt: now }
            : {}),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          "The shipment changed during review. Reload it and try again.",
        );
      const updated = await tx.shipment.findUniqueOrThrow({
        where: { id: shipment.id },
      });

      if (
        dto.action === "APPROVE" &&
        shipment.status === ShipmentStatus.ORDER_RECEIVED
      ) {
        await tx.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            previousStatus: shipment.status,
            status: ShipmentStatus.ORDER_CONFIRMED,
            locationLabel: "China · Order confirmed",
            notes: "Shipment review approved by operations.",
            source: "STAFF",
            actorUserId,
            occurredAt: now,
          },
        });
      }
      await this.audit.recordInTransaction(tx, {
        actorUserId,
        action: `SHIPMENT_REVIEW_${dto.action}`,
        targetType: "Shipment",
        targetId: shipmentId,
        outcome: "SUCCESS",
        metadata: {
          reviewStatus: updated.reviewStatus,
          reviewNoteProvided: Boolean(dto.reviewNote?.trim()),
        },
      });
      return updated;
    });

    return result;
  }

  async assignShipment(
    shipmentId: string,
    actorUserId: string,
    dto: AssignShipmentDto,
  ) {
    await this.throttle(actorUserId, "assign", 30, 300);
    const result = await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
      });
      if (!shipment) throw new NotFoundException("Shipment not found.");
      if (shipment.reviewStatus !== ShipmentReviewStatus.APPROVED) {
        throw new ConflictException("Only approved shipments can be assigned.");
      }
      const staff = await tx.staffProfile.findFirst({
        where: {
          id: dto.staffId,
          active: true,
          user: {
            status: "ACTIVE",
            userRoles: {
              some: {
                role: {
                  name: {
                    in: [
                      "OPERATIONS_MANAGER",
                      "SHIPMENT_OFFICER",
                      "WAREHOUSE_PERSONNEL",
                      "DELIVERY_PERSONNEL",
                    ],
                  },
                },
              },
            },
          },
        },
      });
      if (!staff) throw new NotFoundException("Active staff member not found.");
      await tx.deliveryAssignment.updateMany({
        where: { shipmentId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
      const assignment = await tx.deliveryAssignment.create({
        data: { shipmentId, staffId: staff.id },
      });
      await this.audit.recordInTransaction(tx, {
        actorUserId,
        action: "SHIPMENT_STAFF_ASSIGNED",
        targetType: "Shipment",
        targetId: shipmentId,
        outcome: "SUCCESS",
        metadata: { staffId: dto.staffId, assignmentId: assignment.id },
      });
      return assignment;
    });

    return result;
  }

  async appendEvent(
    shipmentId: string,
    actorUserId: string,
    dto: ShipmentEventDto,
  ) {
    await this.throttle(actorUserId, "tracking-event", 60, 300);
    const result = await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
      });
      if (!shipment) throw new NotFoundException("Shipment not found.");
      if (shipment.reviewStatus !== ShipmentReviewStatus.APPROVED) {
        throw new ConflictException(
          "Shipment must be approved before operational tracking updates are recorded.",
        );
      }
      if (TERMINAL_STATUSES.includes(shipment.status)) {
        throw new ConflictException(
          "A terminal shipment cannot receive further status updates.",
        );
      }
      const allowed = ALLOWED_TRANSITIONS[shipment.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new ConflictException(
          `The transition from ${shipment.status} to ${dto.status} is not permitted.`,
        );
      }

      const now = new Date();
      const event = await tx.shipmentEvent.create({
        data: {
          shipmentId,
          previousStatus: shipment.status,
          status: dto.status,
          locationLabel: dto.locationLabel?.trim() ?? null,
          notes: dto.notes?.trim() ?? null,
          source: "STAFF",
          actorUserId,
          occurredAt: now,
        },
      });
      const changed = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: shipment.status,
          reviewStatus: ShipmentReviewStatus.APPROVED,
        },
        data: {
          status: dto.status,
          ...(dto.status === ShipmentStatus.DELIVERED
            ? { deliveredAt: now }
            : {}),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          "The shipment changed during this update. Reload it and try again.",
        );
      await this.audit.recordInTransaction(tx, {
        actorUserId,
        action: "SHIPMENT_TRACKING_EVENT_APPENDED",
        targetType: "Shipment",
        targetId: shipmentId,
        outcome: "SUCCESS",
        metadata: {
          eventId: event.id,
          status: event.status,
          locationLabel: event.locationLabel,
        },
      });
      return event;
    });

    return result;
  }
}
