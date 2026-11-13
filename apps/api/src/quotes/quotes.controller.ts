import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { CreateQuoteDto, CreateRateRuleDto } from './quotes.dto';
import { QuotesService } from './quotes.service';
@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}
  @UseGuards(SessionGuard) @Post('quotes') create(@Req() req: Request, @Body() dto: CreateQuoteDto) { return this.quotes.create((req as any).auth.user.id, dto); }
  @UseGuards(SessionGuard) @Get('quotes/me') mine(@Req() req: Request) { return this.quotes.listMine((req as any).auth.user.id); }
  @UseGuards(SessionGuard) @Post('quotes/:id/accept') accept(@Req() req: Request, @Param('id') id: string) { return this.quotes.accept((req as any).auth.user.id, id); }
  private assertRatePermission(req: Request) { const permissions: string[] = (req as any).auth?.permissions ?? []; if (!permissions.includes('rates:manage')) throw new ForbiddenException('You do not have permission to manage shipping rates.'); }
  @UseGuards(SessionGuard) @Post('admin/rates') createRate(@Req() req: Request, @Body() dto: CreateRateRuleDto) { this.assertRatePermission(req); return this.quotes.createRateRule((req as any).auth.user.id, dto); }
  @UseGuards(SessionGuard) @Get('admin/rates') rates(@Req() req: Request) { this.assertRatePermission(req); return this.quotes.listRateRules(); }
}
