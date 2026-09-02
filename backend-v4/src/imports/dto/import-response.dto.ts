import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '../../common/enums';

export class ImportResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  originalFilename!: string;

  @ApiProperty({ enum: JobStatus })
  status!: JobStatus;

  @ApiProperty()
  totalRows!: number;

  @ApiProperty()
  processedRows!: number;

  @ApiProperty()
  insertedRows!: number;

  @ApiProperty()
  duplicateRows!: number;

  @ApiProperty()
  invalidRows!: number;

  @ApiPropertyOptional()
  errorMessage?: string | null;

  @ApiPropertyOptional()
  mapping?: Record<string, string> | null;

  @ApiPropertyOptional()
  duplicateStrategy?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  startedAt?: Date | null;

  @ApiPropertyOptional()
  completedAt?: Date | null;
}

export class CreateImportResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: JobStatus })
  status!: JobStatus;

  @ApiProperty()
  message!: string;
}
