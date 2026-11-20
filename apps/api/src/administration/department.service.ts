import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDepartmentDto, DepartmentListDto, UpdateDepartmentDto } from "./department.dto";

@Injectable()
export class DepartmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: DepartmentListDto) {
    const [total, items] = await Promise.all([
      this.prisma.department.count(),
      this.prisma.department.findMany({
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          description: true,
          active: true,
          createdAt: true,
          head: { select: { id: true, fullName: true, employeeCode: true } },
          _count: { select: { members: true } },
        },
      }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async create(actorUserId: string, input: CreateDepartmentDto) {
    const name = input.name.trim();
    if (name.length < 2)
      throw new BadRequestException("Department name is required.");
    return this.prisma.$transaction(async (tx) => {
      let department;
      try {
        department = await tx.department.create({
          data: { name, description: input.description?.trim() || null },
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
            createdAt: true,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          throw new ConflictException(
            "A department with this name already exists.",
          );
        throw error;
      }
      await this.audit.recordInTransaction(tx, {
        actorUserId,
        action: "DEPARTMENT_CREATED",
        targetType: "Department",
        targetId: department.id,
        outcome: "SUCCESS",
        metadata: { name: department.name },
      });
      return department;
    });
  }

  async update(actorUserId: string, id: string, input: UpdateDepartmentDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.department.findUnique({ where: { id }, select: { id: true, name: true, description: true, active: true, headId: true } });
        if (!before) throw new BadRequestException("Department not found.");
        if (input.headId) {
          const head = await tx.staffProfile.findFirst({ where: { id: input.headId, departmentId: id, active: true, user: { status: "ACTIVE" } }, select: { id: true } });
          if (!head) throw new BadRequestException("Select an active staff member as department head.");
        }
        if (input.active === false && await tx.staffProfile.count({ where: { departmentId: id, active: true } }))
          throw new ConflictException("Move or deactivate active department members before deactivating this department.");
        const updated = await tx.department.update({
          where: { id },
          data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
            ...(input.headId !== undefined ? { headId: input.headId || null } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            ...(input.active === false ? { headId: null } : {}),
          },
          select: { id: true, name: true, description: true, active: true, headId: true },
        });
        await this.audit.recordInTransaction(tx, { actorUserId, action: "DEPARTMENT_UPDATED", targetType: "Department", targetId: id, outcome: "SUCCESS", metadata: { before, after: updated } });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("A department with this name already exists.");
      throw error;
    }
  }
}
