import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { SessionGuard } from '../auth/session.guard';
import { AuditService } from '../common/audit.service';
@Module({ controllers: [QuotesController], providers: [QuotesService, SessionGuard, AuditService] })
export class QuotesModule {}
