import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from "class-validator";

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(5) @MaxLength(100) password!: string;
  @IsString() @MinLength(2) @MaxLength(100) fullName!: string;
  @IsOptional() @Matches(/^\+[1-9]\d{7,14}$/) phone?: string;
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(100) password!: string;
}
export class VerifyCodeDto {
  @IsEmail() email!: string;
  @Matches(/^\d{6}$/) code!: string;
}
export class ResetPasswordDto extends VerifyCodeDto {
  @IsString() @MinLength(12) @MaxLength(100) newPassword!: string;
}
export class MfaVerifyDto {
  @Matches(/^\d{6}$/) code!: string;
}
export class EmailDto {
  @IsEmail() email!: string;
}
export class MfaLoginDto {
  @IsString() @MinLength(20) @MaxLength(100) challenge!: string;
  @Matches(/^(\d{6}|[A-Fa-f0-9]{10})$/) code!: string;
}
export class UpdateProfileDto {
  @IsString() @MinLength(2) @MaxLength(100) displayName!: string;
}
