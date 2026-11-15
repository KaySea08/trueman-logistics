import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

export type AuditInput = {
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: "SUCCESS" | "FAILURE" | "DENIED";
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    return this.prisma.$transaction(
      async (tx) => this.recordInTransaction(tx, input),
      { isolationLevel: "Serializable" },
    );
  }

  async recordInTransaction(tx: Prisma.TransactionClient, input: AuditInput) {
    await tx.$queryRaw`SELECT 1::integer AS locked FROM pg_advisory_xact_lock(1835353200, 1635083379)`;
    const tips = await tx.$queryRaw<Array<{ eventHash: string }>>`
      SELECT event."eventHash"
      FROM "AuditEvent" AS event
      WHERE NOT EXISTS (
        SELECT 1 FROM "AuditEvent" AS child
        WHERE child."previousHash" = event."eventHash"
      )
      LIMIT 2
    `;
    if (tips.length > 1)
      throw new Error("Audit history has multiple chain tips.");
    const correlationId = randomUUID();
    const previousHash = tips[0]?.eventHash ?? null;
    const occurredAt = new Date();
    const payload = JSON.stringify({
      ...input,
      correlationId,
      previousHash,
      occurredAt: occurredAt.toISOString(),
    });
    const eventHash = createHash("sha256").update(payload).digest("hex");
    return tx.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        outcome: input.outcome,
        correlationId,
        metadata: input.metadata as Prisma.InputJsonObject | undefined,
        previousHash,
        eventHash,
        occurredAt,
      },
    });
  }
}
