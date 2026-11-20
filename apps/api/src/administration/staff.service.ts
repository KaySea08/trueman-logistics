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
import { CreateStaffDto, StaffListDto, STAFF_CREATE_ROLES } from "./staff.dto";

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
      !STAFF_CREATE_ROLES.includes(input.role)
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
      let user;
      try {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            status: "INVITED",
            mustChangePassword: true,
            staff: { create: { fullName, employeeCode } },
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
    const where: Prisma.StaffProfileWhereInput = {
      ...(query.status ? { user: { status: query.status } } : {}),
      ...(query.role
        ? {
            user: {
              status: query.status,
              userRoles: { some: { role: { name: query.role } } },
            },
          }
        : {}),
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
    const [total, items] = await Promise.all([
      this.prisma.staffProfile.count({ where }),
      this.prisma.staffProfile.findMany({
        where,
        orderBy: [{ fullName: "asc" }, { id: "asc" }],
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
              mfaEnabled: true,
              userRoles: { select: { role: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
