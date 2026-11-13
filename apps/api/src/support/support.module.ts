import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { AuditService } from '../common/audit.service';
@Module({ controllers: [SupportController], providers: [AuditService] })
export class SupportModule {}
