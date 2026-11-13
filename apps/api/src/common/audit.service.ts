import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type AuditInput = {
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    return this.prisma.$transaction(
      async (tx) => this.recordInTransaction(tx, input),
      { isolationLevel: 'Serializable' },
    );
  }

  async recordInTransaction(tx: Prisma.TransactionClient, input: AuditInput) {
    const correlationId = randomUUID();
    const previous = await tx.auditEvent.findFirst({
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { eventHash: true },
    });
    const occurredAt = new Date();
    const payload = JSON.stringify({
      ...input,
      correlationId,
      previousHash: previous?.eventHash ?? null,
      occurredAt: occurredAt.toISOString(),
    });
    const eventHash = createHash('sha256').update(payload).digest('hex');
    return tx.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        outcome: input.outcome,
        correlationId,
        metadata: input.metadata as Prisma.InputJsonObject | undefined,
        previousHash: previous?.eventHash,
        eventHash,
        occurredAt,
      },
    });
  }
}
