import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { AuditService } from '../common/audit.service';
@Module({ imports: [AuthModule], controllers: [QuotesController], providers: [QuotesService, AuditService] })
export class QuotesModule {}
