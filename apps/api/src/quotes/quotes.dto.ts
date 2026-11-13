import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateNested, IsDateString } from 'class-validator';
import { RateBasis, ShipmentMode } from '@prisma/client';

export class QuotePackageDto {
  @IsString() @Length(2, 160) description!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) quantity!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(10000) weightKg!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(2000) lengthCm!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(2000) widthCm!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(2000) heightCm!: number;
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
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => QuotePackageDto) packages!: QuotePackageDto[];
  @IsOptional() @IsString() @MaxLength(1000) handlingInstructions?: string;
}
export class CreateRateRuleDto {
  @IsString() @Length(3, 100) name!: string;
  @IsEnum(ShipmentMode) mode!: ShipmentMode;
  @IsEnum(RateBasis) basis!: RateBasis;
  @IsOptional() @Matches(/^[A-Z]{2}$/) destinationCountryCode?: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) @Max(1000000) ratePerUnit!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000000) minimumCharge!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000000) handlingFee!: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) volumetricDivisor?: number;
  @IsOptional() @IsDateString() validUntil?: string;
}
