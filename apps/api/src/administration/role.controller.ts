import { Body, Controller, ForbiddenException, Get, Header, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { CreateRoleDto, UpdateRoleDto } from "./role.dto";
import { RoleService } from "./role.service";

@Controller("admin/roles")
@UseGuards(SessionGuard)
export class RoleController {
  constructor(private readonly roles: RoleService) {}

  private actor(req: Request) {
    const auth = (req as Request & { auth?: { user: { id: string; roles: string[] }; permissions: string[] } }).auth;
    if (!auth?.permissions.includes("roles:manage")) throw new ForbiddenException("You do not have permission to manage roles.");
    if (!auth.user.roles.includes("SUPER_ADMINISTRATOR")) throw new ForbiddenException("Only a super administrator can manage roles.");
    return auth.user.id;
  }

  @Get()
  @Header("Cache-Control", "no-store, private")
  list(@Req() req: Request) { this.actor(req); return this.roles.list(); }

  @Get("permissions")
  @Header("Cache-Control", "no-store, private")
  permissions(@Req() req: Request) { this.actor(req); return this.roles.permissions(); }

  @Post()
  create(@Req() req: Request, @Body() input: CreateRoleDto) { return this.roles.create(this.actor(req), input); }

  @Patch(":id")
  update(@Req() req: Request, @Param("id") id: string, @Body() input: UpdateRoleDto) { return this.roles.update(this.actor(req), id, input); }
}
