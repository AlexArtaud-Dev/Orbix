import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VarSetVariableDto } from './create-varset.dto';

export class UpdateVarSetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VarSetVariableDto)
  @IsOptional()
  variables?: VarSetVariableDto[];
}
