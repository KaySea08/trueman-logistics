import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SecurityAdministrationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async listSessions(page: number, pageSize: number, search?: string) {
    const where: Prisma.SessionWhereInput = {
      revokedAt: null, expiresAt: { gt: new Date() },
      user: { staff: { isNot: null }, ...(search?.trim() ? { OR: [
        { email: { contains: search.trim(), mode: "insensitive" } },
        { staff: { is: { fullName: { contains: search.trim(), mode: "insensitive" } } } },
        { staff: { is: { employeeCode: { contains: search.trim(), mode: "insensitive" } } } },
      ] } : {}) },
    };
    const [total, items] = await Promise.all([
      this.prisma.session.count({ where }),
      this.prisma.session.findMany({
        where, orderBy: { lastActivityAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, createdAt: true, lastActivityAt: true, expiresAt: true, userAgent: true, user: { select: { id: true, email: true, status: true, staff: { select: { fullName: true, employeeCode: true } }, userRoles: { select: { role: { select: { name: true } } } } } } },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async revokeSession(actorUserId: string, sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({ where: { id: sessionId }, select: { id: true, userId: true, revokedAt: true, user: { select: { staff: { select: { id: true } }, userRoles: { select: { role: { select: { name: true } } } } } } } });
      if (!session?.user.staff) throw new NotFoundException("Staff session not found.");
      if (session.userId === actorUserId || session.user.userRoles.some(({ role }) => role.name === "SUPER_ADMINISTRATOR"))
        throw new ForbiddenException("This session is protected from administrative revocation.");
      if (session.revokedAt) return { revoked: false };
      await tx.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      await this.audit.recordInTransaction(tx, { actorUserId, action: "ADMIN_SESSION_REVOKED", targetType: "Session", targetId: session.id, outcome: "SUCCESS" });
      return { revoked: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async revokeAllSessions(actorUserId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, staff: { select: { id: true } }, userRoles: { select: { role: { select: { name: true } } } } } });
      if (!user?.staff) throw new NotFoundException("Staff account not found.");
      if (userId === actorUserId || user.userRoles.some(({ role }) => role.name === "SUPER_ADMINISTRATOR")) throw new ForbiddenException("This account is protected from administrative session revocation.");
      const result = await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.recordInTransaction(tx, { actorUserId, action: "ADMIN_ALL_SESSIONS_REVOKED", targetType: "User", targetId: userId, outcome: "SUCCESS", metadata: { count: result.count } });
      return { revoked: result.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listAudit(page: number, pageSize: number, search?: string, outcome?: "SUCCESS" | "FAILURE" | "DENIED") {
    const term = search?.trim();
    const where: Prisma.AuditEventWhereInput = {
      ...(outcome ? { outcome } : {}),
      ...(term ? { OR: [
        { action: { contains: term, mode: "insensitive" } },
        { targetType: { contains: term, mode: "insensitive" } },
        { targetId: { contains: term, mode: "insensitive" } },
        { actor: { is: { email: { contains: term, mode: "insensitive" } } } },
        { actor: { is: { staff: { is: { fullName: { contains: term, mode: "insensitive" } } } } } },
      ] } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, action: true, targetType: true, targetId: true, outcome: true, correlationId: true, previousHash: true, eventHash: true, occurredAt: true, actor: { select: { email: true, staff: { select: { fullName: true, employeeCode: true } }, userRoles: { select: { role: { select: { name: true } } } } } } },
      }),
    ]);
    return { items, total, page, pageSize };
  }
}
