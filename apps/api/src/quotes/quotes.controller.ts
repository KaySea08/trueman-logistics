import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
  MessageEvent,
} from "@nestjs/common";
import { Observable } from "rxjs";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import {
  AssignQuoteRequestDto,
  CalculateQuoteRequestDto,
  CreateQuoteDto,
  CreateRateRuleDto,
  QuoteRequestNoteDto,
  QuoteRequestListDto,
} from "./quotes.dto";
import { QuotesService } from "./quotes.service";
import { QuoteRequestEventsService } from "./quote-request-events.service";
@Controller()
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly quoteEvents: QuoteRequestEventsService,
  ) {}
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Header("Cache-Control", "no-store, private")
  @Post("quotes")
  create(
    @Req() req: Request,
    @Body() dto: CreateQuoteDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.quotes.create(
      (req as any).auth.user.id,
      dto,
      idempotencyKey,
      req.ip ?? "unknown",
    );
  }
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-store, private")
  @Get("quotes/me")
  mine(@Req() req: Request) {
    return this.quotes.listMine((req as any).auth.user.id);
  }
  @UseGuards(SessionGuard)
  @Get("shipments/me")
  @Header("Cache-Control", "no-store, private")
  shipmentsMine(@Req() req: Request) {
    return this.quotes.listMyShipments((req as any).auth.user.id);
  }
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-store, private")
  @Get("quote-requests/me")
  myQuoteRequests(@Req() req: Request) {
    return this.quotes.listMyQuoteRequests((req as any).auth.user.id);
  }
  @UseGuards(SessionGuard) @Post("quotes/:id/accept") accept(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.quotes.accept((req as any).auth.user.id, id);
  }
  private assertRatePermission(req: Request) {
    const permissions: string[] = (req as any).auth?.permissions ?? [];
    if (!permissions.includes("rates:manage"))
      throw new ForbiddenException(
        "You do not have permission to manage shipping rates.",
      );
  }
  private assertQuotePermission(req: Request) {
    const permissions: string[] = (req as any).auth?.permissions ?? [];
    const canManageAll = permissions.includes("rates:manage");
    if (!canManageAll && !permissions.includes("quotes:manage"))
      throw new ForbiddenException(
        "You do not have permission to manage quote requests.",
      );
    return canManageAll;
  }
  @UseGuards(SessionGuard) @Post("admin/rates") createRate(
    @Req() req: Request,
    @Body() dto: CreateRateRuleDto,
  ) {
    this.assertRatePermission(req);
    return this.quotes.createRateRule((req as any).auth.user.id, dto);
  }
  @UseGuards(SessionGuard) @Get("admin/rates") rates(@Req() req: Request) {
    this.assertQuotePermission(req);
    return this.quotes.listRateRules();
  }

  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-store, private")
  @Get("admin/quote-requests")
  quoteRequests(@Req() req: Request, @Query() query: QuoteRequestListDto) {
    const canManageAll = this.assertQuotePermission(req);
    return this.quotes.listAdminQuoteRequests(
      query,
      (req as any).auth.user.id,
      canManageAll,
    );
  }
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-store, private")
  @Get("admin/quote-requests/staff")
  quoteStaff(@Req() req: Request) {
    this.assertRatePermission(req);
    return this.quotes.quoteStaffList();
  }
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-store, private")
  @Get("admin/quote-requests/health")
  quoteRequestHealth(@Req() req: Request) {
    const canManageAll = this.assertQuotePermission(req);
    return this.quotes.quoteQueueMetrics(
      (req as any).auth.user.id,
      canManageAll,
    );
  }
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-cache, no-transform")
  @Sse("admin/quote-requests/events")
  quoteRequestEvents(@Req() req: Request): Observable<MessageEvent> {
    const canManageAll = this.assertQuotePermission(req);
    return this.quoteEvents.stream(canManageAll);
  }
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-store, private")
  @Get("admin/quote-requests/:id")
  quoteRequest(@Req() req: Request, @Param("id") id: string) {
    const canManageAll = this.assertQuotePermission(req);
    return this.quotes.getAdminQuoteRequest(
      id,
      (req as any).auth.user.id,
      canManageAll,
    );
  }

  @UseGuards(SessionGuard)
  @Post("admin/quote-requests/:id/calculate")
  @Header("Cache-Control", "no-store, private")
  calculateQuoteRequest(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: CalculateQuoteRequestDto,
  ) {
    const canManageAll = this.assertQuotePermission(req);
    return this.quotes.calculateQuoteRequest(
      (req as any).auth.user.id,
      id,
      dto,
      canManageAll,
    );
  }

  @UseGuards(SessionGuard)
  @Patch("admin/quote-requests/:id/assignment")
  assignQuoteRequest(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: AssignQuoteRequestDto,
  ) {
    this.assertRatePermission(req);
    return this.quotes.assignQuoteRequest(
      (req as any).auth.user.id,
      id,
      dto.staffProfileId,
    );
  }

  @UseGuards(SessionGuard)
  @Post("admin/quote-requests/:id/notes")
  addQuoteRequestNote(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: QuoteRequestNoteDto,
  ) {
    const canManageAll = this.assertQuotePermission(req);
    return this.quotes.addQuoteRequestNote(
      (req as any).auth.user.id,
      id,
      dto.note,
      canManageAll,
    );
  }

  @UseGuards(SessionGuard)
  @Post("admin/quote-requests/:id/send")
  @Header("Cache-Control", "no-store, private")
  sendQuoteRequest(@Req() req: Request, @Param("id") id: string) {
    const canManageAll = this.assertQuotePermission(req);
    return this.quotes.queueQuoteEmail(
      (req as any).auth.user.id,
      id,
      canManageAll,
    );
  }
}
