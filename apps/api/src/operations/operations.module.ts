import { Module } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { AuditService } from '../common/audit.service';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  controllers: [OperationsController],
  providers: [OperationsService, SessionGuard, AuditService],
})
export class OperationsModule {}
