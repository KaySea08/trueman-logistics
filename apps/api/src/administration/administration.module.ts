import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";
import { AuditService } from "../common/audit.service";
import { DepartmentController } from "./department.controller";
import { DepartmentService } from "./department.service";
import { RoleController } from "./role.controller";
import { RoleService } from "./role.service";
import { SecurityController } from "./security.controller";
import { SecurityAdministrationService } from "./security.service";
import { ConfigurationController } from "./configuration.controller";
import { ConfigurationService } from "./configuration.service";

@Module({
  imports: [AuthModule],
  controllers: [StaffController, DepartmentController, RoleController, SecurityController, ConfigurationController],
  providers: [StaffService, DepartmentService, RoleService, SecurityAdministrationService, ConfigurationService, AuditService],
})
export class AdministrationModule {}
