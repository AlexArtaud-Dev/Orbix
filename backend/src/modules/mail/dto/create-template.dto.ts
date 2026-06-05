import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsIn(['text', 'html'])
  @IsOptional()
  bodyType?: 'text' | 'html';
}
