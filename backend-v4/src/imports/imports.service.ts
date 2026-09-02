import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs/promises';
import * as path from 'path';
import PgBoss from 'pg-boss';
import { v4 as uuidv4 } from 'uuid';
import { QUEUE_NAMES } from '../common/constants';
import { JobStatus } from '../common/enums';
import { ImportLeadJobData } from '../common/types/jobs';
import { normalizeRow } from '../common/utils/normalization';
import { ImportRecord } from '../database/schema';
import { PG_BOSS } from '../pgboss/pgboss.constants';
import { CreateImportDto } from './dto/create-import.dto';
import {
  CreateImportResponseDto,
  ImportResponseDto,
} from './dto/import-response.dto';
import { PreviewImportResponseDto } from './dto/preview-import.dto';
import { ImportsRepository } from './imports.repository';

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly configService: ConfigService,
    private readonly importsRepository: ImportsRepository,
  ) {}

  previewCsv(file: Express.Multer.File): PreviewImportResponseDto {
    if (!file) throw new BadRequestException('CSV file is required');
    this.assertCsv(file);

    const content = file.buffer.toString('utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
      to: 6, // header + 5 sample rows
    }) as Record<string, unknown>[];

    const sampleRows = records.map((r) => normalizeRow(r));
    const headers = sampleRows.length > 0 ? Object.keys(sampleRows[0]) : [];

    // Rough estimate from buffer size / avg line
    const lineCount = content.split(/\r?\n/).filter((l) => l.trim()).length;
    const estimatedRows = Math.max(0, lineCount - 1);

    return { headers, sampleRows, estimatedRows };
  }

  async createImport(
    file: Express.Multer.File,
    dto: CreateImportDto,
  ): Promise<CreateImportResponseDto> {
    if (!file) throw new BadRequestException('CSV file is required');
    this.assertCsv(file);
    this.validateNormalizationMapping(file, dto.mapping);
    const duplicateStrategy = [...new Set(Object.values(dto.mapping!))].join(
      '_or_',
    );

    const maxSize =
      this.configService.get<number>('app.maxUploadSize') || 524288000;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File exceeds maximum size of ${maxSize} bytes`,
      );
    }

    const uploadDir =
      this.configService.get<string>('app.uploadDir') || './storage/uploads';
    await fs.mkdir(uploadDir, { recursive: true });

    const storedFilename = `${uuidv4()}.csv`;
    const filePath = path.join(uploadDir, storedFilename);
    await fs.writeFile(filePath, file.buffer);

    const importRecord = await this.importsRepository.create({
      originalFilename: file.originalname,
      storedFilename,
      filePath,
      status: JobStatus.PENDING,
      mapping: dto.mapping ?? null,
      duplicateStrategy,
      totalRows: 0,
      processedRows: 0,
      insertedRows: 0,
      duplicateRows: 0,
      invalidRows: 0,
      failedRows: 0,
    });

    const jobData: ImportLeadJobData = {
      importId: importRecord.id,
      filePath,
      mapping: dto.mapping,
      duplicateStrategy,
      originalFilename: file.originalname,
    };

    const jobId = await this.boss.send(QUEUE_NAMES.LEAD_IMPORT, jobData);
    if (jobId) {
      await this.importsRepository.updateStatus(importRecord.id, {
        jobId: String(jobId),
      });
    }

    this.logger.log(
      `Queued import ${importRecord.id} (job ${jobId}) for ${file.originalname}`,
    );

    return {
      id: importRecord.id,
      status: JobStatus.PENDING,
      message: 'Import job queued successfully',
    };
  }

  async findOne(id: string): Promise<ImportResponseDto> {
    const record = await this.importsRepository.findById(id);
    if (!record) throw new NotFoundException(`Import ${id} not found`);
    return this.toDto(record);
  }

  async findAll(): Promise<ImportResponseDto[]> {
    const records = await this.importsRepository.findAll(50);
    return records.map((r) => this.toDto(r));
  }

  private assertCsv(file: Express.Multer.File) {
    const allowedMimes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'text/plain',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv' && !allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only CSV files are allowed');
    }
  }

  /** Validate the CSV-header -> normalized-column choices before queuing. */
  private validateNormalizationMapping(
    file: Express.Multer.File,
    mapping?: Record<string, string>,
  ): void {
    if (!mapping || Object.keys(mapping).length === 0) {
      throw new BadRequestException(
        'Select at least one CSV field to normalize before importing.',
      );
    }

    const allowedTargets = new Set(['email', 'phone', 'linkedin', 'website']);
    const selected = Object.entries(mapping).filter(
      ([header, target]) =>
        typeof header === 'string' &&
        header.trim() !== '' &&
        typeof target === 'string' &&
        target.trim() !== '',
    );
    if (selected.length === 0) {
      throw new BadRequestException(
        'Select at least one CSV field to normalize before importing.',
      );
    }

    const invalidTarget = selected.find(
      ([, target]) => !allowedTargets.has(target.trim().toLowerCase()),
    );
    if (invalidTarget) {
      throw new BadRequestException(
        `Unsupported normalized field "${invalidTarget[1]}". Choose email, phone, linkedin, or website.`,
      );
    }

    const records = parse(file.buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
      to: 1,
    }) as Record<string, unknown>[];
    const headers = records[0] ? Object.keys(normalizeRow(records[0])) : [];
    const missingHeader = selected.find(
      ([header]) =>
        !headers.some(
          (csvHeader) =>
            csvHeader.toLowerCase() === header.trim().toLowerCase(),
        ),
    );
    if (missingHeader) {
      throw new BadRequestException(
        `CSV does not contain the selected normalization field "${missingHeader[0]}". Available: ${headers.join(', ') || 'none'}`,
      );
    }

    // Persist canonical target names regardless of client-supplied casing.
    for (const [header, target] of selected) {
      mapping[header] = target.trim().toLowerCase();
    }
  }

  private toDto(record: ImportRecord): ImportResponseDto {
    return {
      id: record.id,
      originalFilename: record.originalFilename,
      status: record.status,
      totalRows: record.totalRows ?? 0,
      processedRows: record.processedRows ?? 0,
      insertedRows: record.insertedRows ?? 0,
      duplicateRows: record.duplicateRows ?? 0,
      invalidRows: record.invalidRows ?? 0,
      errorMessage: record.errorMessage,
      mapping: record.mapping,
      duplicateStrategy: record.duplicateStrategy,
      createdAt: record.createdAt,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
    };
  }
}
