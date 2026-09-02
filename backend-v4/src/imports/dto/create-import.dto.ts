import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateImportDto {
  @ApiProperty({
    description:
      'Required mapping of one or more CSV headers to normalized database fields: email, phone, linkedin, or website. ' +
      'Any CSV header can be selected; for example, "Email Address" can map to "email". ' +
      'CSV headers themselves are still stored as-is in leads.data.',
    example: {
      Email: 'email',
      'Phone Number': 'phone',
      LinkedIn: 'linkedin',
    },
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);

        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed)
        ) {
          return parsed as Record<string, string>;
        }

        return undefined;
      } catch {
        return undefined;
      }
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, string>;
    }

    return undefined;
  })
  @IsObject()
  mapping?: Record<string, string>;

  @ApiProperty({
    description:
      'Deprecated. Duplicate checking is determined automatically by the normalized fields selected in mapping.',
    example: 'linkedin',
  })
  @IsOptional()
  @IsString()
  duplicateStrategy?: string;
}
