import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsIn(['text', 'html'])
  @IsOptional()
  bodyType?: 'text' | 'html';
}
