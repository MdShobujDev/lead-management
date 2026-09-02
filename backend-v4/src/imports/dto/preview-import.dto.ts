import { ApiProperty } from '@nestjs/swagger';

export class PreviewImportResponseDto {
  @ApiProperty({ type: [String] })
  headers!: string[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  sampleRows!: Record<string, string | null>[];

  @ApiProperty()
  estimatedRows!: number;
}
