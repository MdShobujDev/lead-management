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
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../common/constants';

/** Supported operators for advanced dynamic filters */
export const FILTER_OPERATORS = [
  'eq',
  'neq',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'isNull',
  'isNotNull',
  'in',
  'notIn',
  'gt',
  'gte',
  'lt',
  'lte',
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export class AdvancedFilterDto {
  @ApiPropertyOptional({
    description:
      'Field name inside lead.data or special: createdAt, updatedAt, email, phone, linkedin',
  })
  @IsString()
  field!: string;

  @ApiPropertyOptional({ enum: FILTER_OPERATORS, default: 'contains' })
  @IsIn(FILTER_OPERATORS)
  op: FilterOperator = 'contains';

  @ApiPropertyOptional({
    description:
      'Value for the operator. For in/notIn pass array or comma-separated string. Ignored for isNull/isNotNull.',
  })
  @IsOptional()
  value?: string | string[] | number | boolean | null;
}

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

export class QueryLeadsDto {
  @ApiPropertyOptional({
    description: 'Free-text search across all jsonb values',
  })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Simple field filters (backward compatible).
   * Each key is matched with ILIKE %value% (contains).
   * Pass as JSON: ?fields={"Company":"Acme"}
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Simple contains filters: {"Company":"Acme"}',
  })
  @IsOptional()
  @Transform(({ value }) => parseJson<Record<string, string>>(value))
  @IsObject()
  fields?: Record<string, string>;

  /**
   * Advanced filters with operators. Combined with AND.
   * Pass as JSON array:
   * [{"field":"Company","op":"eq","value":"Acme"},{"field":"Email","op":"isNotNull"}]
   */
  @ApiPropertyOptional({
    type: [AdvancedFilterDto],
    description:
      'Advanced filter rules (AND). JSON array string in query param.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    const parsed = parseJson<AdvancedFilterDto[]>(value);
    return Array.isArray(parsed) ? parsed : undefined;
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

  @ApiPropertyOptional({ description: 'Filter createdAt >= (ISO date)' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Filter createdAt <= (ISO date)' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({
    description:
      'Sort column: any data key or createdAt|updatedAt|email|phone|linkedin',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  /** Cursor pagination (preferred for large datasets) */
  @ApiPropertyOptional({ description: 'Keyset cursor from previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  /** Offset pagination alternative */
  @ApiPropertyOptional({
    description: 'Page number (1-based). Used if cursor is omitted.',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_LIMIT, maximum: MAX_PAGE_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit?: number = DEFAULT_PAGE_LIMIT;

  @ApiPropertyOptional({
    description:
      'When true, response includes total matching count (extra query)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeTotal?: boolean;
}
