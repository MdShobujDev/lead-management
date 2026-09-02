import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AdvancedFilterDto } from './query-leads.dto';

function parseJson<T>(value: unknown): T | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return value as T;
}

/**
 * Delete leads matching filters. At least one filter required (safety).
 */
export class BulkDeleteLeadsDto {
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
  @Transform(({ value }) => {
    const p = parseJson<AdvancedFilterDto[]>(value);
    return Array.isArray(p) ? p : undefined;
  })
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
}
