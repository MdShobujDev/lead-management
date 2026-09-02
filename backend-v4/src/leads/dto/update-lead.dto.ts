import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateLeadDto {
  @ApiProperty({
    description: 'Full or partial data object to merge into lead.data',
    type: 'object',
    additionalProperties: true,
    example: { Company: 'Acme Inc', Phone: '+1 555 0100' },
  })
  @IsObject()
  data!: Record<string, string | null>;
}
