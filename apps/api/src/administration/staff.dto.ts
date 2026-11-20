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
  @MinLength(2)
  @MaxLength(50)
  employeeCode?: string;

  @IsOptional()
  @IsBoolean()
  generateEmployeeCode?: boolean;

  @IsIn(STAFF_CREATE_ROLES)
  role!: (typeof STAFF_CREATE_ROLES)[number];
}

export class ChangeStaffStatusDto {
  @IsIn(["SUSPEND", "REACTIVATE", "DEACTIVATE"])
  action!: "SUSPEND" | "REACTIVATE" | "DEACTIVATE";
}
