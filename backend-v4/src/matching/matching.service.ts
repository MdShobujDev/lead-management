import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  getRowField,
  normalizeEmail,
  normalizeGeneric,
  normalizeLinkedIn,
  normalizePhone,
  normalizeRow,
  normalizeWebsite,
} from '../common/utils/normalization';
import { LeadsRepository } from '../leads/leads.repository';
import { CreateMatchDto } from './dto/create-match.dto';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly leadsRepository: LeadsRepository,
  ) {}

  /**
   * Upload a CSV, match rows against DB on the selected field (any CSV column
   * + any DB field — identity columns or dynamic data keys), fill empty
   * cells from the matched DB lead (optionally limited to columnsToFill),
   * preserve original column order, and return the enriched CSV for download.
   * No permanent record is stored.
   */
  async matchAndEnrich(
    file: Express.Multer.File,
    dto: CreateMatchDto,
  ): Promise<{
    buffer: Buffer;
    filename: string;
    stats: Record<string, number>;
  }> {
    if (!file) throw new BadRequestException('CSV file is required');
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      throw new BadRequestException('Only CSV files are allowed');
    }

    const csvMatchField = (dto.csvMatchField || '').trim();
    const dbMatchField = (dto.dbMatchField || '').trim();
    if (!csvMatchField || !dbMatchField) {
      throw new BadRequestException(
        'csvMatchField and dbMatchField are required',
      );
    }

    // Optional restrict which empty columns get filled
    const fillSet =
      dto.columnsToFill && dto.columnsToFill.length > 0
        ? new Set(dto.columnsToFill.map((c) => c.trim()).filter(Boolean))
        : null;

    const uploadDir =
      this.configService.get<string>('app.uploadDir') || './storage/uploads';
    const outputDir =
      this.configService.get<string>('app.outputDir') || './storage/outputs';
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    const inputPath = path.join(uploadDir, `${uuidv4()}.csv`);
    const outputPath = path.join(outputDir, `matched-${uuidv4()}.csv`);
    await fs.writeFile(inputPath, file.buffer);

    let totalRows = 0;
    let matchedRows = 0;
    let unmatchedRows = 0;
    let filledCells = 0;
    let headers: string[] = [];
    const batchSize = 1000;
    let batch: Record<string, string | null>[] = [];
    const outputRows: Record<string, string>[] = [];

    const normalizeKey = (raw: string): string => {
      switch (dbMatchField.toLowerCase()) {
        case 'email':
        case 'emailnormalized':
          return normalizeEmail(raw) || raw.trim().toLowerCase();
        case 'phone':
        case 'phonenormalized':
          return normalizePhone(raw) || raw.replace(/\D/g, '');
        case 'linkedin':
        case 'linkedinurl':
        case 'linkedinnormalized':
          return normalizeLinkedIn(raw) || raw.trim().toLowerCase();
        case 'website':
        case 'websitenormalized':
          return normalizeWebsite(raw) || raw.trim().toLowerCase();
        default:
          return normalizeGeneric(raw) || raw.trim().toLowerCase();
      }
    };

    const processBatch = async (rows: Record<string, string | null>[]) => {
      if (rows.length === 0) return;

      const keys = rows
        .map((r) => {
          const v = getRowField(r, csvMatchField);
          return v ? normalizeKey(v) : null;
        })
        .filter((k): k is string => !!k);

      const dbLeads = await this.leadsRepository.findByMatchField(
        dbMatchField,
        keys,
      );

      // Build lookup map keyed by normalized match value
      const lookup = new Map<string, Record<string, string | null>>();
      for (const lead of dbLeads) {
        const data = lead.data || {};
        let key: string | null = null;
        switch (dbMatchField.toLowerCase()) {
          case 'email':
          case 'emailnormalized':
            // Use the persisted normalized value. The source CSV header may
            // be an arbitrary alias (for example, "Email Address").
            key = lead.emailNormalized;
            break;
          case 'phone':
          case 'phonenormalized':
            key = lead.phoneNormalized;
            break;
          case 'linkedin':
          case 'linkedinurl':
          case 'linkedinnormalized':
            key = lead.linkedinNormalized;
            break;
          case 'website':
          case 'websitenormalized':
            key = lead.websiteNormalized;
            break;
          default: {
            const raw = getRowField(data, dbMatchField);
            key = normalizeGeneric(raw);
            break;
          }
        }
        if (key) lookup.set(key, data);
      }

      for (const row of rows) {
        totalRows++;
        const matchVal = getRowField(row, csvMatchField);
        const key = matchVal ? normalizeKey(matchVal) : null;
        const dbData = key ? lookup.get(key) : undefined;

        if (dbData) {
          matchedRows++;
          // Enrich empty fields from DB while preserving original structure.
          // CSV headers are kept as-is; DB values are looked up by same key
          // (exact then case-insensitive).
          for (const col of headers) {
            if (fillSet && !fillSet.has(col)) continue;

            const current = row[col];
            if (current == null || current === '') {
              let dbVal = dbData[col];
              if (dbVal == null) {
                const lower = col.toLowerCase();
                for (const [k, v] of Object.entries(dbData)) {
                  if (k.toLowerCase() === lower) {
                    dbVal = v;
                    break;
                  }
                }
              }
              if (dbVal != null && dbVal !== '') {
                row[col] = dbVal;
                filledCells++;
              }
            }
          }
        } else {
          unmatchedRows++;
        }

        // Convert nulls to empty strings for CSV output
        const out: Record<string, string> = {};
        for (const col of headers) {
          out[col] = row[col] == null ? '' : String(row[col]);
        }
        outputRows.push(out);
      }
    };

    try {
      const parser = createReadStream(inputPath).pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          relax_column_count: true,
          trim: true,
          bom: true,
        }),
      );

      for await (const raw of parser) {
        const row = normalizeRow(raw as Record<string, unknown>);
        if (headers.length === 0) {
          headers = Object.keys(row);
          // Accept exact or case-insensitive presence of match field
          const hasField =
            headers.includes(csvMatchField) ||
            headers.some(
              (h) => h.toLowerCase() === csvMatchField.toLowerCase(),
            );
          if (!hasField) {
            throw new BadRequestException(
              `CSV does not contain match field "${csvMatchField}". Available: ${headers.join(', ')}`,
            );
          }
        }
        batch.push(row);
        if (batch.length >= batchSize) {
          await processBatch(batch);
          batch = [];
        }
      }
      if (batch.length > 0) await processBatch(batch);

      // Write enriched CSV preserving original column order
      const csv = await new Promise<string>((resolve, reject) => {
        stringify(
          outputRows,
          { header: true, columns: headers },
          (err, output) => {
            if (err) reject(err);
            else resolve(output);
          },
        );
      });

      await fs.writeFile(outputPath, csv, 'utf-8');

      const buffer = Buffer.from(csv, 'utf-8');
      const filename = `matched-${path.basename(file.originalname, '.csv')}-${Date.now()}.csv`;

      this.logger.log(
        `Match complete: total=${totalRows}, matched=${matchedRows}, unmatched=${unmatchedRows}, filledCells=${filledCells}`,
      );

      return {
        buffer,
        filename,
        stats: { totalRows, matchedRows, unmatchedRows, filledCells },
      };
    } finally {
      // Cleanup temp files
      await fs.unlink(inputPath).catch(() => undefined);
      await fs.unlink(outputPath).catch(() => undefined);
    }
  }
}
