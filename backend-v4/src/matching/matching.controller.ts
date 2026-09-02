import {
  Body,
  Controller,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CreateMatchDto } from './dto/create-match.dto';
import { MatchingService } from './matching.service';

@ApiTags('matching')
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post()
  @ApiOperation({
    summary:
      'Upload CSV, match against DB on selected fields (any CSV column + any DB field), ' +
      'enrich empty cells from matched leads, download updated CSV. ' +
      'Original column order is preserved. DB fields are dynamic (see GET /leads/fields). No DB record is stored.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'csvMatchField', 'dbMatchField'],
      properties: {
        file: { type: 'string', format: 'binary' },
        csvMatchField: {
          type: 'string',
          example: 'Email',
          description: 'Any column name present in the uploaded CSV',
        },
        dbMatchField: {
          type: 'string',
          example: 'email',
          description:
            'email | phone | linkedin | website | or any key from leads.data (GET /leads/fields)',
        },
        columnsToFill: {
          type: 'string',
          example: '["Company","Title","Phone"]',
          description:
            'Optional JSON array or comma-separated list of CSV columns to fill when empty. If omitted, all empty cells are filled from matched DB row.',
        },
      },
    },
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'Enriched CSV file' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 524288000 },
    }),
  )
  async match(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMatchDto,
    @Res() res: Response,
  ) {
    const { buffer, filename, stats } =
      await this.matchingService.matchAndEnrich(file, dto);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Total-Rows', String(stats.totalRows));
    res.setHeader('X-Matched-Rows', String(stats.matchedRows));
    res.setHeader('X-Unmatched-Rows', String(stats.unmatchedRows));
    if (stats.filledCells != null) {
      res.setHeader('X-Filled-Cells', String(stats.filledCells));
    }
    res.send(buffer);
  }
}
