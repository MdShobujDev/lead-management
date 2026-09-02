import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMatchDto {
  @ApiProperty({
    description:
      'Column name in the uploaded CSV used to match against the database. ' +
      'Must match a header in the CSV (exact or case-insensitive).',
    example: 'Email',
  })
  @IsString()
  @IsNotEmpty()
  csvMatchField!: string;

  @ApiProperty({
    description:
      'DB field to match on. Built-in: email | phone | linkedin | website. ' +
      'Or any dynamic key from leads.data (fetch available fields via GET /leads/fields). ' +
      'A built-in DB field can be matched from a differently named CSV column, such as "LinkedIn Address" -> "linkedin".',
    example: 'email',
  })
  @IsString()
  @IsNotEmpty()
  dbMatchField!: string;

  @ApiPropertyOptional({
    description:
      'If provided, only these CSV columns that are empty will be filled from DB. ' +
      'If omitted, every empty CSV cell is filled when the matching DB row has a value for the same key (exact or case-insensitive).',
    type: [String],
    example: ['Company', 'Title', 'Phone'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map(String);
        }
        // comma-separated
        return value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      } catch {
        return value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    if (Array.isArray(value)) return value.map(String);
    return undefined;
  })
  @IsArray()
  @IsString({ each: true })
  columnsToFill?: string[];
}
