import { IsArray, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

export class CreateRoleDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  permissions!: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  permissions!: string[];
}
