import { Body, Controller, ForbiddenException, Get, Header, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { ConfigurationService } from "./configuration.service";
import { UpdateSystemConfigurationDto } from "./configuration.dto";

@Controller("admin/configuration")
@UseGuards(SessionGuard)
export class ConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}
  private actor(req: Request) {
    const auth = (req as Request & { auth?: { user: { id: string }; permissions: string[] } }).auth;
    if (!auth?.permissions.includes("system:manage")) throw new ForbiddenException("You do not have permission to manage system configuration.");
    return auth.user.id;
  }
  @Get()
  @Header("Cache-Control", "no-store, private")
  read(@Req() req: Request) { this.actor(req); return this.configuration.read(); }
  @Put("session-policy")
  update(@Req() req: Request, @Body() input: UpdateSystemConfigurationDto) { return this.configuration.update(this.actor(req), input); }
}
