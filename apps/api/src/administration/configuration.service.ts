import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSystemConfigurationDto } from "./configuration.dto";

const SESSION_POLICY_KEY = "session-policy";
const DEFAULT_SESSION_DAYS = 7;

@Injectable()
export class ConfigurationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async read() {
    const stored = await this.prisma.systemConfiguration.findUnique({ where: { key: SESSION_POLICY_KEY }, select: { value: true, version: true, updatedAt: true } });
    const value = stored?.value && typeof stored.value === "object" && !Array.isArray(stored.value) ? stored.value as Record<string, unknown> : {};
    const days = value.sessionDays;
    return {
      sessionDays: Number.isInteger(days) && Number(days) >= 1 && Number(days) <= 30 ? Number(days) : DEFAULT_SESSION_DAYS,
      sessionPolicyVersion: stored?.version ?? 0,
      privilegedMfaRequired: true,
      minimumPasswordLength: 12,
      updatedAt: stored?.updatedAt ?? null,
    };
  }

  async update(actorUserId: string, input: UpdateSystemConfigurationDto) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({ where: { id: actorUserId, status: "ACTIVE", mfaEnabled: true, userRoles: { some: { role: { name: "SUPER_ADMINISTRATOR" } } } }, select: { id: true } });
      if (!actor) throw new ForbiddenException("Only a super administrator can update system security policies.");
      const existing = await tx.systemConfiguration.findUnique({ where: { key: SESSION_POLICY_KEY }, select: { version: true, value: true } });
      const nextVersion = (existing?.version ?? 0) + 1;
      const value = { sessionDays: input.sessionDays } as Prisma.InputJsonObject;
      const updated = await tx.systemConfiguration.upsert({
        where: { key: SESSION_POLICY_KEY },
        create: { key: SESSION_POLICY_KEY, value, version: nextVersion, updatedByUserId: actorUserId },
        update: { value, version: nextVersion, updatedByUserId: actorUserId },
        select: { value: true, version: true, updatedAt: true },
      });
      await tx.systemConfigurationVersion.create({ data: { key: SESSION_POLICY_KEY, value, version: nextVersion, actorUserId } });
      await this.audit.recordInTransaction(tx, { actorUserId, action: "SYSTEM_CONFIGURATION_UPDATED", targetType: "SystemConfiguration", targetId: SESSION_POLICY_KEY, outcome: "SUCCESS", metadata: { beforeVersion: existing?.version ?? 0, version: nextVersion, previousSessionDays: existing?.value && typeof existing.value === "object" && !Array.isArray(existing.value) ? (existing.value as Record<string, unknown>).sessionDays : DEFAULT_SESSION_DAYS, sessionDays: input.sessionDays } });
      return { sessionDays: input.sessionDays, version: updated.version, updatedAt: updated.updatedAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
