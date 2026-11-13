import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditService } from '../common/audit.service';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [AuthModule],
  controllers: [OperationsController],
  providers: [OperationsService, AuditService],
})
export class OperationsModule {}
