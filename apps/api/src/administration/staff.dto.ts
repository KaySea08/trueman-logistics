import { Type } from "class-transformer";
import {
  IsEnum,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Length,
  MinLength,
  Min,
} from "class-validator";
import { UserStatus } from "@prisma/client";

export class StaffListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  active?: "true" | "false";

  @IsOptional()
  @IsIn(["name", "createdAt", "department", "lastLoginAt"])
  sortBy?: "name" | "createdAt" | "department" | "lastLoginAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDirection?: "asc" | "desc";
}

export const STAFF_CREATE_ROLES = [
  "ADMINISTRATOR",
  "OPERATIONS_MANAGER",
  "QUOTE_OFFICER",
  "SHIPMENT_OFFICER",
  "WAREHOUSE_PERSONNEL",
  "DELIVERY_PERSONNEL",
  "FINANCE_OFFICER",
  "CUSTOMER_SUPPORT",
] as const;

export class CreateStaffDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(100)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  employeeCode?: string;

  @IsOptional()
  @IsBoolean()
  generateEmployeeCode?: boolean;

  @IsString()
  @Length(2, 80)
  role!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  supervisorId?: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  supervisorId?: string | null;

}

export class AssignStaffRoleDto {
  @IsString()
  @MaxLength(100)
  roleId!: string;
}

export class ChangeStaffStatusDto {
  @IsIn(["SUSPEND", "REACTIVATE", "DEACTIVATE"])
  action!: "SUSPEND" | "REACTIVATE" | "DEACTIVATE";
}
