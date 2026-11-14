import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { QuotesController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";
import { AuditService } from "../common/audit.service";
import { QuoteOutboxWorker } from "./quote-outbox.worker";
import { QuoteRequestEventsService } from "./quote-request-events.service";
@Module({
  imports: [AuthModule],
  controllers: [QuotesController],
  providers: [
    QuotesService,
    AuditService,
    QuoteOutboxWorker,
    QuoteRequestEventsService,
  ],
})
export class QuotesModule {}
