import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { MfaVerifyDto } from "../auth/auth.dto";
import {
  AssignStaffRoleDto,
  ChangeStaffStatusDto,
  CreateStaffDto,
  StaffListDto,
  UpdateStaffDto,
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

  @Get(":id")
  @Header("Cache-Control", "no-store, private")
  get(@Req() req: Request, @Param("id") id: string) {
    const auth = (req as Request & { auth?: { permissions: string[] } }).auth;
    if (!auth?.permissions.includes("staff:manage")) throw new ForbiddenException("You do not have permission to view staff.");
    return this.staff.get(id);
  }

  @Patch(":id")
  @Header("Cache-Control", "no-store, private")
  update(@Req() req: Request, @Param("id") id: string, @Body() input: UpdateStaffDto) {
    const auth = (req as Request & { auth?: { user: { id: string; roles: string[] }; permissions: string[] } }).auth;
    if (!auth?.permissions.includes("staff:manage") || !auth.user.roles.includes("SUPER_ADMINISTRATOR"))
      throw new ForbiddenException("Only a super administrator can edit staff profiles.");
    return this.staff.update(auth.user.id, id, input);
  }

  @Post(":id/roles")
  assignRole(@Req() req: Request, @Param("id") id: string, @Body() input: AssignStaffRoleDto) {
    const auth = (req as Request & { auth?: { user: { id: string; roles: string[] }; permissions: string[] } }).auth;
    if (!auth?.permissions.includes("staff:manage") || !auth.user.roles.includes("SUPER_ADMINISTRATOR")) throw new ForbiddenException("Only a super administrator can assign staff roles.");
    return this.staff.assignRole(auth.user.id, id, input);
  }

  @Post(":id/invitation")
  @Header("Cache-Control", "no-store, private")
  resendInvitation(@Req() req: Request, @Param("id") id: string) {
    const auth = (req as Request & { auth?: { user: { id: string; roles: string[] }; permissions: string[] } }).auth;
    if (!auth?.permissions.includes("staff:manage") || !auth.user.roles.includes("SUPER_ADMINISTRATOR")) throw new ForbiddenException("Only a super administrator can resend staff invitations.");
    return this.staff.resendInvitation(auth.user.id, id);
  }

  @Post(":id/mfa-reset")
  @Header("Cache-Control", "no-store, private")
  resetMfa(@Req() req: Request, @Param("id") id: string, @Body() input: MfaVerifyDto) {
    const auth = (req as Request & { auth?: { user: { id: string; roles: string[] }; permissions: string[] } }).auth;
    if (!auth?.permissions.includes("mfa:manage") || !auth.user.roles.includes("SUPER_ADMINISTRATOR")) throw new ForbiddenException("Only a super administrator can reset staff MFA.");
    return this.staff.resetMfa(auth.user.id, id, input.code);
  }

  @Delete(":id/roles/:roleId")
  removeRole(@Req() req: Request, @Param("id") id: string, @Param("roleId") roleId: string) {
    const auth = (req as Request & { auth?: { user: { id: string; roles: string[] }; permissions: string[] } }).auth;
    if (!auth?.permissions.includes("staff:manage") || !auth.user.roles.includes("SUPER_ADMINISTRATOR")) throw new ForbiddenException("Only a super administrator can remove staff roles.");
    return this.staff.removeRole(auth.user.id, id, roleId);
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
