import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { AuthService } from "../auth/auth.service";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AssignStaffRoleDto, CreateStaffDto, StaffListDto, UpdateStaffDto } from "./staff.dto";

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async create(actorUserId: string, input: CreateStaffDto) {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    const employeeCode = input.generateEmployeeCode
      ? `EMP-${randomUUID().toUpperCase()}`
      : (input.employeeCode?.trim() ?? "");
    if (
      fullName.length < 2 ||
      employeeCode.length < 2 ||
      employeeCode.length > 50 ||
      input.role === "SUPER_ADMINISTRATOR" || input.role === "CUSTOMER"
    )
      throw new BadRequestException(
        "Provide a valid staff name, employee ID and role.",
      );
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const user = await this.prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({
        where: {
          id: actorUserId,
          status: "ACTIVE",
          mfaEnabled: true,
          userRoles: { some: { role: { name: "SUPER_ADMINISTRATOR" } } },
        },
        select: { id: true },
      });
      if (!actor)
        throw new ForbiddenException(
          "Only a super administrator can create staff accounts.",
        );
      const role = await tx.role.findUnique({
        where: { name: input.role },
        select: { id: true },
      });
      if (!role)
        throw new BadRequestException(
          "The selected staff role is unavailable.",
        );
      if (input.departmentId && !(await tx.department.findFirst({ where: { id: input.departmentId, active: true }, select: { id: true } })))
        throw new BadRequestException("Select an active department.");
      if (input.supervisorId && !(await tx.staffProfile.findFirst({ where: { id: input.supervisorId, active: true, user: { status: "ACTIVE" } }, select: { id: true } })))
        throw new BadRequestException("Select an active staff supervisor.");
      let user;
      try {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            status: "INVITED",
            mustChangePassword: true,
            phone: input.phone?.trim() || null,
            staff: {
              create: {
                fullName,
                employeeCode,
                departmentId: input.departmentId || null,
                supervisorId: input.supervisorId || null,
              },
            },
            userRoles: { create: { roleId: role.id } },
          },
          select: {
            id: true,
            email: true,
            status: true,
            staff: { select: { employeeCode: true, fullName: true } },
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          throw new ConflictException(
            "That email or employee ID is already in use.",
          );
        throw error;
      }
      await this.audit.recordInTransaction(tx, {
        actorUserId,
        action: "STAFF_ACCOUNT_CREATED",
        targetType: "User",
        targetId: user.id,
        outcome: "SUCCESS",
        metadata: { role: input.role, employeeCode },
      });
      return user;
    });
    try {
      await this.auth.sendStaffInvitation(user.id);
      return { user, invitationSent: true };
    } catch {
      return { user, invitationSent: false };
    }
  }

  async resendInvitation(actorUserId: string, staffId: string) {
    const user = await this.prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({ where: { id: actorUserId, status: "ACTIVE", mfaEnabled: true, userRoles: { some: { role: { name: "SUPER_ADMINISTRATOR" } } } }, select: { id: true } });
      if (!actor) throw new ForbiddenException("Only a super administrator can resend staff invitations.");
      const staff = await tx.staffProfile.findUnique({
        where: { id: staffId },
        select: { userId: true, user: { select: { email: true, status: true, userRoles: { select: { role: { select: { name: true } } } } } } },
      });
      if (!staff) throw new NotFoundException("Staff account not found.");
      if (staff.user.userRoles.some(({ role }) => role.name === "SUPER_ADMINISTRATOR") || staff.user.status !== "INVITED") throw new ConflictException("Only invited staff accounts can receive a renewed invitation.");
      await this.audit.recordInTransaction(tx, { actorUserId, action: "STAFF_INVITATION_RESEND_REQUESTED", targetType: "User", targetId: staff.userId, outcome: "SUCCESS" });
      return { id: staff.userId, email: staff.user.email };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    try { await this.auth.sendStaffInvitation(user.id); return { invitationSent: true }; }
    catch {
      await this.audit.record({ actorUserId, action: "STAFF_INVITATION_SEND_FAILED", targetType: "User", targetId: user.id, outcome: "FAILURE" });
      return { invitationSent: false };
    }
  }

  resetMfa(actorUserId: string, staffId: string, verificationCode: string) {
    return this.auth.adminResetStaffMfa(actorUserId, staffId, verificationCode);
  }

  async changeStatus(
    actorUserId: string,
    staffId: string,
    action: "SUSPEND" | "REACTIVATE" | "DEACTIVATE",
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const actor = await tx.user.findFirst({
          where: {
            id: actorUserId,
            status: "ACTIVE",
            mfaEnabled: true,
            userRoles: { some: { role: { name: "SUPER_ADMINISTRATOR" } } },
          },
          select: { id: true },
        });
        if (!actor)
          throw new ForbiddenException(
            "Only a super administrator can change staff account status.",
          );
        const staff = await tx.staffProfile.findUnique({
          where: { id: staffId },
          select: {
            user: {
              select: {
                id: true,
                status: true,
                emailVerifiedAt: true,
                userRoles: { select: { role: { select: { name: true } } } },
              },
            },
          },
        });
        if (!staff) throw new NotFoundException("Staff account not found.");
        if (
          staff.user.id === actorUserId ||
          staff.user.userRoles.some(
            ({ role }) => role.name === "SUPER_ADMINISTRATOR",
          )
        )
          throw new ForbiddenException(
            "Super administrator accounts cannot be changed here.",
          );
        const current = staff.user.status;
        const next =
          action === "SUSPEND"
            ? "SUSPENDED"
            : action === "DEACTIVATE"
              ? "DISABLED"
              : staff.user.emailVerifiedAt
                ? "ACTIVE"
                : "INVITED";
        const allowed =
          action === "SUSPEND"
            ? current === "ACTIVE"
            : action === "DEACTIVATE"
              ? ["INVITED", "ACTIVE", "SUSPENDED"].includes(current)
              : ["SUSPENDED", "DISABLED"].includes(current);
        if (!allowed)
          throw new ConflictException(
            "This account cannot make that status change.",
          );
        const changed = await tx.user.updateMany({
          where: { id: staff.user.id, status: current },
          data: { status: next },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            "The account changed. Refresh and retry.",
          );
        if (action === "DEACTIVATE")
          await tx.department.updateMany({ where: { headId: staffId }, data: { headId: null } });
        if (action === "DEACTIVATE" || action === "REACTIVATE")
          await tx.staffProfile.update({ where: { id: staffId }, data: { active: action === "REACTIVATE" } });
        await tx.session.updateMany({
          where: { userId: staff.user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (action !== "REACTIVATE") {
          await tx.verificationChallenge.updateMany({
            where: { subjectId: staff.user.id, consumedAt: null },
            data: { consumedAt: new Date() },
          });
        }
        await this.audit.recordInTransaction(tx, {
          actorUserId,
          action: `STAFF_${action}`,
          targetType: "User",
          targetId: staff.user.id,
          outcome: "SUCCESS",
          metadata: { before: current, after: next },
        });
        return { status: next, userId: staff.user.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (result.status === "INVITED") {
      try {
        await this.auth.sendStaffInvitation(result.userId);
        return { status: result.status, invitationSent: true };
      } catch {
        return { status: result.status, invitationSent: false };
      }
    }
    return { status: result.status };
  }

  async list(query: StaffListDto) {
    const search = query.search?.trim();
    const userWhere: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role
        ? { userRoles: { some: { role: { name: query.role } } } }
        : {}),
    };
    const where: Prisma.StaffProfileWhereInput = {
      ...(query.active ? { active: query.active === "true" } : {}),
      ...(query.status || query.role ? { user: userWhere } : {}),
      ...(query.department?.trim()
        ? {
            department: {
              name: { contains: query.department.trim(), mode: "insensitive" },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { employeeCode: { contains: search, mode: "insensitive" } },
              { user: { email: { contains: search, mode: "insensitive" } } },
              { user: { phone: { contains: search } } },
            ],
          }
        : {}),
    };
    const sortBy = query.sortBy ?? "name";
    const sortDirection = query.sortDirection ?? "asc";
    const orderBy: Prisma.StaffProfileOrderByWithRelationInput[] =
      sortBy === "createdAt"
        ? [{ user: { createdAt: sortDirection } }, { id: "asc" }]
        : sortBy === "department"
          ? [{ department: { name: sortDirection } }, { fullName: "asc" }]
          : sortBy === "lastLoginAt"
            ? [{ user: { lastLoginAt: sortDirection } }, { fullName: "asc" }]
            : [{ fullName: sortDirection }, { id: "asc" }];
    const [total, items] = await Promise.all([
      this.prisma.staffProfile.count({ where }),
      this.prisma.staffProfile.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          active: true,
          jobTitle: true,
          department: { select: { id: true, name: true, active: true } },
          supervisor: {
            select: { id: true, fullName: true, employeeCode: true },
          },
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
              lastLoginAt: true,
              mfaEnabled: true,
              userRoles: { select: { role: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(staffId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: staffId },
      select: {
        id: true, employeeCode: true, fullName: true, active: true, jobTitle: true,
        department: { select: { id: true, name: true } },
        supervisor: { select: { id: true, fullName: true, employeeCode: true } },
        reports: { select: { id: true, fullName: true, employeeCode: true } },
        assignments: {
          where: { unassignedAt: null },
          select: { id: true, assignedAt: true, reason: true, shipment: { select: { id: true, shipmentNumber: true, status: true } } },
          orderBy: { assignedAt: "desc" }, take: 50,
        },
        user: {
          select: {
            id: true, email: true, phone: true, status: true, createdAt: true,
            lastLoginAt: true, mfaEnabled: true,
            userRoles: { select: { role: { select: { id: true, name: true, description: true, rolePermissions: { select: { permission: { select: { key: true } } } } } } } },
          },
        },
      },
    });
    if (!staff) throw new NotFoundException("Staff account not found.");
    return staff;
  }

  async update(actorUserId: string, staffId: string, input: UpdateStaffDto) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({
        where: { id: actorUserId, status: "ACTIVE", mfaEnabled: true, userRoles: { some: { role: { name: "SUPER_ADMINISTRATOR" } } } },
        select: { id: true },
      });
      if (!actor) throw new ForbiddenException("Only a super administrator can edit staff profiles.");
      const staff = await tx.staffProfile.findUnique({
        where: { id: staffId },
        select: { id: true, userId: true, supervisorId: true, user: { select: { userRoles: { select: { role: { select: { name: true } } } } } } },
      });
      if (!staff) throw new NotFoundException("Staff account not found.");
      if (staff.userId === actorUserId || staff.user.userRoles.some(({ role }) => role.name === "SUPER_ADMINISTRATOR"))
        throw new ForbiddenException("Super administrator profiles cannot be changed here.");
      if (input.departmentId) {
        const department = await tx.department.findFirst({ where: { id: input.departmentId, active: true }, select: { id: true } });
        if (!department) throw new BadRequestException("Select an active department.");
      }
      if (input.supervisorId) {
        if (input.supervisorId === staffId) throw new BadRequestException("A staff member cannot supervise themselves.");
        const supervisor = await tx.staffProfile.findFirst({ where: { id: input.supervisorId, active: true, user: { status: "ACTIVE" } }, select: { id: true } });
        if (!supervisor) throw new BadRequestException("Select an active staff supervisor.");
        let ancestorId: string | null = input.supervisorId;
        const visited = new Set<string>();
        while (ancestorId) {
          if (ancestorId === staffId) throw new BadRequestException("This reporting change would create a circular hierarchy.");
          if (visited.has(ancestorId)) throw new BadRequestException("The existing reporting hierarchy contains a cycle.");
          visited.add(ancestorId);
          if (visited.size > 100) throw new BadRequestException("The reporting hierarchy exceeds the supported depth.");
          const ancestor: { supervisorId: string | null } | null = await tx.staffProfile.findUnique({ where: { id: ancestorId }, select: { supervisorId: true } });
          ancestorId = ancestor?.supervisorId ?? null;
        }
      }
      const before = await tx.staffProfile.findUniqueOrThrow({ where: { id: staffId }, select: { fullName: true, jobTitle: true, departmentId: true, supervisorId: true } });
      await tx.staffProfile.update({
        where: { id: staffId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
          ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle?.trim() || null } : {}),
          ...(input.departmentId !== undefined ? { departmentId: input.departmentId || null } : {}),
          ...(input.supervisorId !== undefined ? { supervisorId: input.supervisorId || null } : {}),
        },
      });
      if (input.phone !== undefined) await tx.user.update({ where: { id: staff.userId }, data: { phone: input.phone?.trim() || null } });
      await this.audit.recordInTransaction(tx, {
        actorUserId, action: "STAFF_PROFILE_UPDATED", targetType: "StaffProfile", targetId: staffId,
        outcome: "SUCCESS", metadata: { before, changed: Object.keys(input) },
      });
      return { id: staffId, updated: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async assignRole(actorUserId: string, staffId: string, input: AssignStaffRoleDto) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({ where: { id: actorUserId, status: "ACTIVE", mfaEnabled: true, userRoles: { some: { role: { name: "SUPER_ADMINISTRATOR" } } } }, select: { id: true } });
      if (!actor) throw new ForbiddenException("Only a super administrator can assign staff roles.");
      const target = await tx.staffProfile.findUnique({
        where: { id: staffId },
        select: { userId: true, user: { select: { userRoles: { select: { role: { select: { name: true } } } } } } },
      });
      if (!target) throw new NotFoundException("Staff account not found.");
      if (target.userId === actorUserId || target.user.userRoles.some(({ role }) => role.name === "SUPER_ADMINISTRATOR")) throw new ForbiddenException("Super administrator roles cannot be changed here.");
      const role = await tx.role.findUnique({ where: { id: input.roleId }, select: { id: true, name: true } });
      if (!role || role.name === "CUSTOMER" || role.name === "SUPER_ADMINISTRATOR") throw new BadRequestException("Select an assignable staff role.");
      await tx.userRole.upsert({ where: { userId_roleId: { userId: target.userId, roleId: role.id } }, create: { userId: target.userId, roleId: role.id }, update: {} });
      await tx.session.updateMany({ where: { userId: target.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.recordInTransaction(tx, { actorUserId, action: "STAFF_ROLE_ASSIGNED", targetType: "User", targetId: target.userId, outcome: "SUCCESS", metadata: { role: role.name } });
      return { assigned: role.name };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async removeRole(actorUserId: string, staffId: string, roleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({ where: { id: actorUserId, status: "ACTIVE", mfaEnabled: true, userRoles: { some: { role: { name: "SUPER_ADMINISTRATOR" } } } }, select: { id: true } });
      if (!actor) throw new ForbiddenException("Only a super administrator can remove staff roles.");
      const target = await tx.staffProfile.findUnique({
        where: { id: staffId },
        select: { userId: true, user: { select: { userRoles: { select: { roleId: true, role: { select: { name: true } } } } } } },
      });
      if (!target) throw new NotFoundException("Staff account not found.");
      if (target.userId === actorUserId || target.user.userRoles.some(({ role }) => role.name === "SUPER_ADMINISTRATOR")) throw new ForbiddenException("Super administrator roles cannot be changed here.");
      const assignment = target.user.userRoles.find(({ roleId: assignedRoleId }) => assignedRoleId === roleId);
      if (!assignment) throw new NotFoundException("Role assignment not found.");
      if (target.user.userRoles.length <= 1) throw new ConflictException("A staff account must retain at least one role.");
      await tx.userRole.delete({ where: { userId_roleId: { userId: target.userId, roleId } } });
      await tx.session.updateMany({ where: { userId: target.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.recordInTransaction(tx, { actorUserId, action: "STAFF_ROLE_REMOVED", targetType: "User", targetId: target.userId, outcome: "SUCCESS", metadata: { role: assignment.role.name } });
      return { removed: assignment.role.name };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
