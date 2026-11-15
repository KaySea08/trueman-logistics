import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import {
  ChangeStaffStatusDto,
  CreateStaffDto,
  StaffListDto,
} from "./staff.dto";
import { StaffService } from "./staff.service";

@Controller("admin/staff")
@UseGuards(SessionGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @Header("Cache-Control", "no-store, private")
  list(@Req() req: Request, @Query() query: StaffListDto) {
    const auth = (req as Request & { auth?: { permissions: string[] } }).auth;
    if (!auth?.permissions.includes("staff:manage"))
      throw new ForbiddenException("You do not have permission to view staff.");
    return this.staff.list(query);
  }

  @Post()
  @Header("Cache-Control", "no-store, private")
  create(@Req() req: Request, @Body() input: CreateStaffDto) {
    const auth = (
      req as Request & {
        auth?: { user: { id: string; roles: string[] }; permissions: string[] };
      }
    ).auth;
    if (
      !auth?.permissions.includes("staff:manage") ||
      !auth.user.roles.includes("SUPER_ADMINISTRATOR")
    )
      throw new ForbiddenException(
        "Only a super administrator can create staff accounts.",
      );
    return this.staff.create(auth.user.id, input);
  }

  @Patch(":id/status")
  @Header("Cache-Control", "no-store, private")
  changeStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: ChangeStaffStatusDto,
  ) {
    const auth = (
      req as Request & {
        auth?: { user: { id: string; roles: string[] }; permissions: string[] };
      }
    ).auth;
    if (
      !auth?.permissions.includes("staff:manage") ||
      !auth.user.roles.includes("SUPER_ADMINISTRATOR")
    )
      throw new ForbiddenException(
        "Only a super administrator can change staff account status.",
      );
    return this.staff.changeStatus(auth.user.id, id, input.action);
  }
}
