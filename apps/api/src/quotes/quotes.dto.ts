import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  IsDateString,
} from "class-validator";
import { QuoteRequestStatus, RateBasis, ShipmentMode } from "@prisma/client";

export class QuotePackageDto {
  @IsString() @Length(2, 160) description!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) quantity!: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(10000)
  weightKg!: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(2000)
  lengthCm!: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(2000)
  widthCm!: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(2000)
  heightCm!: number;
}
export class CreateQuoteDto {
  @IsEnum(ShipmentMode) mode!: ShipmentMode;
  @Matches(/^[A-Z]{2}$/) destinationCountryCode!: string;
  @IsString() @Length(2, 100) destinationCity!: string;
  @IsString() @Length(5, 240) destinationAddressLine!: string;
  @IsString() @Length(2, 100) recipientName!: string;
  @Matches(/^\+[1-9]\d{7,14}$/) recipientPhone!: string;
  @IsString() @Length(2, 100) senderName!: string;
  @Matches(/^\+[1-9]\d{7,14}$/) senderPhone!: string;
  @IsString() @Length(5, 240) chinaCollectionAddress!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => QuotePackageDto)
  packages!: QuotePackageDto[];
  @IsOptional() @IsString() @MaxLength(1000) handlingInstructions?: string;
}

export class QuoteRequestListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  cursor?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @IsOptional()
  @IsEnum(QuoteRequestStatus)
  status?: QuoteRequestStatus;

  @IsOptional()
  @IsEnum(ShipmentMode)
  mode?: ShipmentMode;

  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  destinationCountryCode?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsIn(["newest", "oldest"])
  sort: "newest" | "oldest" = "newest";
}

export class CalculateQuoteRequestDto {
  @IsString()
  @Length(1, 128)
  rateRuleId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  baseCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  weightCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  volumeCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  destinationSurcharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  handlingFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  insuranceFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  customsCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  serviceCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  discount?: number;
}

export class AssignQuoteRequestDto {
  @IsString()
  @Length(1, 128)
  staffProfileId!: string;
}

export class QuoteRequestNoteDto {
  @IsString()
  @Length(3, 2000)
  note!: string;
}

export class CreateRateRuleDto {
  @IsString() @Length(3, 100) name!: string;
  @IsEnum(ShipmentMode) mode!: ShipmentMode;
  @IsEnum(RateBasis) basis!: RateBasis;
  @IsOptional() @Matches(/^[A-Z]{2}$/) destinationCountryCode?: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Max(1000000)
  ratePerUnit!: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  minimumCharge!: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  handlingFee!: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  volumetricDivisor?: number;
  @IsOptional() @IsDateString() validUntil?: string;
}
