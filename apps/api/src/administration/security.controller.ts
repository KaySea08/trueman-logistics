import { Controller, Delete, ForbiddenException, Get, Header, Param, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { SecurityAdministrationService } from "./security.service";

class SecurityPageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(["SUCCESS", "FAILURE", "DENIED"]) outcome?: "SUCCESS" | "FAILURE" | "DENIED";
}

@Controller("admin/security")
@UseGuards(SessionGuard)
export class SecurityController {
  constructor(private readonly security: SecurityAdministrationService) {}
  private actor(req: Request, permission: string) {
    const auth = (req as Request & { auth?: { user: { id: string }; permissions: string[] } }).auth;
    if (!auth?.permissions.includes(permission)) throw new ForbiddenException("You do not have permission to access this security resource.");
    return auth.user.id;
  }
  @Get("sessions")
  @Header("Cache-Control", "no-store, private")
  sessions(@Req() req: Request, @Query() query: SecurityPageQuery) {
    this.actor(req, "sessions:manage");
    return this.security.listSessions(query.page, query.pageSize, query.search);
  }
  @Delete("sessions/:id")
  revokeSession(@Req() req: Request, @Param("id") id: string) {
    return this.security.revokeSession(this.actor(req, "sessions:manage"), id);
  }
  @Delete("users/:userId/sessions")
  revokeAllSessions(@Req() req: Request, @Param("userId") userId: string) {
    return this.security.revokeAllSessions(this.actor(req, "sessions:manage"), userId);
  }
  @Get("audit")
  @Header("Cache-Control", "no-store, private")
  audit(@Req() req: Request, @Query() query: SecurityPageQuery) {
    this.actor(req, "audit:read");
    return this.security.listAudit(query.page, query.pageSize, query.search, query.outcome);
  }
}
