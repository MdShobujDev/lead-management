import { Body, Controller, Post, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CreateExportDto } from './dto/create-export.dto';
import { ExportsService } from './exports.service';

@ApiTags('exports')
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Filter leads with dynamic filters and download result as CSV. No record is stored in DB.',
  })
  @ApiBody({ type: CreateExportDto })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async export(@Body() dto: CreateExportDto, @Res() res: Response) {
    const { buffer, filename, rowCount } =
      await this.exportsService.exportCsv(dto);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Row-Count', String(rowCount));
    res.send(buffer);
  }
}
