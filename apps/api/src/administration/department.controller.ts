import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { CreateDepartmentDto, DepartmentListDto } from "./department.dto";
import { DepartmentService } from "./department.service";

@Controller("admin/departments")
@UseGuards(SessionGuard)
export class DepartmentController {
  constructor(private readonly departments: DepartmentService) {}

  private authorized(req: Request) {
    const auth = (
      req as Request & {
        auth?: { user: { id: string }; permissions: string[] };
      }
    ).auth;
    if (!auth?.permissions.includes("system:manage"))
      throw new ForbiddenException(
        "You do not have permission to manage departments.",
      );
    return auth.user.id;
  }

  @Get()
  @Header("Cache-Control", "no-store, private")
  list(@Req() req: Request, @Query() query: DepartmentListDto) {
    this.authorized(req);
    return this.departments.list(query);
  }

  @Post()
  @Header("Cache-Control", "no-store, private")
  create(@Req() req: Request, @Body() input: CreateDepartmentDto) {
    return this.departments.create(this.authorized(req), input);
  }
}
