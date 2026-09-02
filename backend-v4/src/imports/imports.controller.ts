import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CreateImportDto } from './dto/create-import.dto';
import {
  CreateImportResponseDto,
  ImportResponseDto,
} from './dto/import-response.dto';
import { PreviewImportResponseDto } from './dto/preview-import.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('preview')
  @ApiOperation({
    summary: 'Preview CSV headers and sample rows (no job created)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'mapping'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, type: PreviewImportResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 524288000 },
    }),
  )
  preview(@UploadedFile() file: Express.Multer.File): PreviewImportResponseDto {
    return this.importsService.previewCsv(file);
  }

  @Post()
  @ApiOperation({
    summary:
      'Upload CSV and start import job. Stores all columns dynamically with the same field names as the CSV headers. ' +
      'Duplicate detection uses the normalized fields selected in mapping.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        mapping: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description:
            'Required CSV header -> normalized DB field mapping. Map any header, such as "Email Address", to email, phone, linkedin, or website.',
        },
        duplicateStrategy: {
          type: 'string',
          description:
            'Deprecated. The normalized mapping determines duplicate detection automatically.',
          example: 'linkedin',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: CreateImportResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 524288000 },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateImportDto,
  ): Promise<CreateImportResponseDto> {
    // multipart sends mapping as JSON string sometimes
    const typedDto = dto as CreateImportDto & {
      mapping?: Record<string, string> | string;
    };

    if (typeof typedDto.mapping === 'string') {
      try {
        typedDto.mapping = JSON.parse(typedDto.mapping) as Record<
          string,
          string
        >;
      } catch {
        /* ignore */
      }
    }

    return this.importsService.createImport(file, typedDto);
  }

  @Get()
  @ApiOperation({ summary: 'List recent import jobs' })
  @ApiResponse({ status: 200, type: [ImportResponseDto] })
  findAll(): Promise<ImportResponseDto[]> {
    return this.importsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get import job status' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: ImportResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ImportResponseDto> {
    return this.importsService.findOne(id);
  }
}
