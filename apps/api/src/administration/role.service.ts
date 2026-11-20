import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoleDto, UpdateRoleDto } from "./role.dto";

const elevatedPermissionKeys = ["roles:manage", "system:manage", "staff:manage", "sessions:manage", "mfa:manage"];

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list() {
    return this.prisma.role.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: {
        id: true, name: true, description: true, isSystem: true, createdAt: true,
        rolePermissions: { select: { permission: { select: { id: true, key: true, description: true } } }, orderBy: { permission: { key: "asc" } } },
        _count: { select: { userRoles: true } },
      },
    });
  }

  async permissions() {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" }, select: { id: true, key: true, description: true } });
  }

  async create(actorUserId: string, input: CreateRoleDto) {
    const name = input.name.trim().toUpperCase();
    if (["CUSTOMER", "SUPER_ADMINISTRATOR", "ADMINISTRATOR"].includes(name)) throw new ForbiddenException("This reserved role cannot be created.");
    return this.save(actorUserId, undefined, { name, description: input.description?.trim() || null, permissions: input.permissions });
  }

  async update(actorUserId: string, id: string, input: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id }, select: { id: true, name: true, isSystem: true } });
    if (!role) throw new NotFoundException("Role not found.");
    if (role.isSystem || ["SUPER_ADMINISTRATOR", "ADMINISTRATOR", "CUSTOMER"].includes(role.name))
      throw new ForbiddenException("Built-in roles are protected from modification.");
    return this.save(actorUserId, id, { name: role.name, description: input.description?.trim() || null, permissions: input.permissions });
  }

  private async save(actorUserId: string, roleId: string | undefined, input: { name: string; description: string | null; permissions: string[] }) {
    const keys = [...new Set(input.permissions)];
    const result = await this.prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({ where: { id: actorUserId, status: "ACTIVE", mfaEnabled: true, userRoles: { some: { role: { name: "SUPER_ADMINISTRATOR" } } } }, select: { id: true } });
      if (!actor) throw new ForbiddenException("Only a super administrator can manage roles.");
      const known = await tx.permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
      if (known.length !== keys.length) throw new BadRequestException("One or more permissions are unavailable.");
      if (keys.some((key) => elevatedPermissionKeys.includes(key))) throw new ForbiddenException("Custom roles cannot grant administrative control permissions.");
      try {
        const role = roleId
          ? await tx.role.update({ where: { id: roleId }, data: { description: input.description, rolePermissions: { deleteMany: {}, create: known.map(({ id }) => ({ permissionId: id })) } }, select: { id: true, name: true } })
          : await tx.role.create({ data: { name: input.name, description: input.description, rolePermissions: { create: known.map(({ id }) => ({ permissionId: id })) } }, select: { id: true, name: true } });
        await this.audit.recordInTransaction(tx, { actorUserId, action: roleId ? "ROLE_PERMISSIONS_UPDATED" : "ROLE_CREATED", targetType: "Role", targetId: role.id, outcome: "SUCCESS", metadata: { name: role.name, permissionKeys: keys } });
        return role;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("A role with that name already exists.");
        throw error;
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return result;
  }
}
