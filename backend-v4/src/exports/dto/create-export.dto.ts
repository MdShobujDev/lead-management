import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DEFAULT_EXPORT_LIMIT, MAX_EXPORT_LIMIT } from '../../common/constants';
import { AdvancedFilterDto } from '../../leads/dto/query-leads.dto';

function parseJson<T>(value: unknown): T | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed as T;
    } catch {
      return undefined;
    }
  }
  return value as T;
}

export class CreateExportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @Transform(({ value }) => parseJson<Record<string, string>>(value))
  @IsObject()
  fields?: Record<string, string>;

  @ApiPropertyOptional({ type: [AdvancedFilterDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdvancedFilterDto)
  filters?: AdvancedFilterDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasEmail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasPhone?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasLinkedIn?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({
    default: DEFAULT_EXPORT_LIMIT,
    maximum: MAX_EXPORT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_EXPORT_LIMIT)
  limit?: number = DEFAULT_EXPORT_LIMIT;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  columns?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
