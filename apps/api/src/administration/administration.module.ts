import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";
import { AuditService } from "../common/audit.service";
import { DepartmentController } from "./department.controller";
import { DepartmentService } from "./department.service";

@Module({
  imports: [AuthModule],
  controllers: [StaffController, DepartmentController],
  providers: [StaffService, DepartmentService, AuditService],
})
export class AdministrationModule {}
