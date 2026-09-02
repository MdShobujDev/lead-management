import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeadResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    description: 'Full dynamic row data (original CSV columns)',
    type: 'object',
    additionalProperties: true,
  })
  data!: Record<string, string | null>;

  @ApiPropertyOptional()
  emailNormalized?: string | null;

  @ApiPropertyOptional()
  phoneNormalized?: string | null;

  @ApiPropertyOptional()
  linkedinNormalized?: string | null;

  @ApiPropertyOptional()
  websiteNormalized?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedLeadsResponseDto {
  @ApiProperty({ type: [LeadResponseDto] })
  data!: LeadResponseDto[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Cursor for next page (keyset mode)',
  })
  nextCursor!: string | null;

  @ApiProperty()
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Current page when using page/offset mode',
  })
  page?: number;

  @ApiPropertyOptional()
  totalPages?: number;

  @ApiPropertyOptional({
    description: 'Total matching rows (when includeTotal=true or page mode)',
  })
  total?: number;
}

export class FieldMetaDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  nonNullCount!: number;

  @ApiProperty({ type: [String] })
  sampleValues!: string[];
}

export class FacetValueDto {
  @ApiProperty()
  value!: string;

  @ApiProperty()
  count!: number;
}
