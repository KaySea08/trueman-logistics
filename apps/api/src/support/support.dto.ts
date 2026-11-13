import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class CreateSupportInquiryDto {
  @IsString() @MinLength(2) @MaxLength(100) fullName!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MinLength(2) @MaxLength(80) serviceName!: string;
  @IsString() @MinLength(10) @MaxLength(2000) message!: string;
}
