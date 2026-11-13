import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ShipmentStatus } from '@prisma/client';

export class ShipmentEventDto {
  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  locationLabel?: string;

  @IsOptional()
  @IsString()
  @Length(2, 1000)
  notes?: string;
}

export class ReviewShipmentDto {
  @IsIn(['APPROVE', 'REJECT', 'REQUEST_CORRECTION'])
  action!: 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION';

  @IsOptional()
  @IsString()
  @Length(2, 1000)
  reviewNote?: string;
}

export class AssignShipmentDto {
  @IsString()
  @Length(1, 128)
  staffId!: string;
}

export class ShipmentListQueryDto {
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
  @Length(1, 100)
  search?: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsIn(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION'])
  reviewStatus?: string;

  @IsOptional()
  @IsIn(['CUSTOMER', 'STAFF', 'SYSTEM'])
  creationSource?: string;
}
