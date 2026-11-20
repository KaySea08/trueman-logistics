import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from "class-validator";

export class DepartmentListDto {
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
}

export class CreateDepartmentDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(100) headId?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
