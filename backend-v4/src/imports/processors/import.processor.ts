import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parse } from 'csv-parse';
import { createReadStream } from 'fs';
import PgBoss, { Job } from 'pg-boss';
import { DEFAULT_BATCH_SIZE, QUEUE_NAMES } from '../../common/constants';
import { JobStatus } from '../../common/enums';
import { ImportLeadJobData } from '../../common/types/jobs';
import { countFileLines, safeUnlink } from '../../common/utils/file-storage';
import {
  extractIdentityFromRow,
  normalizeRow,
} from '../../common/utils/normalization';
import { NewLead } from '../../database/schema';
import { LeadsRepository } from '../../leads/leads.repository';
import { PG_BOSS } from '../../pgboss/pgboss.constants';
import { ImportsRepository } from '../imports.repository';

@Injectable()
export class ImportProcessor implements OnModuleInit {
  private readonly logger = new Logger(ImportProcessor.name);

  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly configService: ConfigService,
    private readonly importsRepository: ImportsRepository,
    private readonly leadsRepository: LeadsRepository,
  ) {}

  async onModuleInit() {
    await this.boss.work(
      QUEUE_NAMES.LEAD_IMPORT,
      { batchSize: 1 },
      async (jobs: Job<ImportLeadJobData>[]) => {
        for (const job of jobs) {
          await this.process(job);
        }
      },
    );
    this.logger.log('Import worker registered');
  }

  private async process(job: Job<ImportLeadJobData>): Promise<void> {
    const { importId, filePath, mapping } = job.data;
    const batchSize =
      this.configService.get<number>('app.csvBatchSize') || DEFAULT_BATCH_SIZE;
    const normalizedFields = [
      ...new Set(
        Object.values(mapping || {})
          .map((field) => field.trim().toLowerCase())
          .filter(
            (field): field is 'email' | 'phone' | 'linkedin' | 'website' =>
              ['email', 'phone', 'linkedin', 'website'].includes(field),
          ),
      ),
    ];

    this.logger.log(
      `Starting import ${importId} (job ${job.id}) duplicate fields=${normalizedFields.join(', ')}`,
    );

    await this.importsRepository.updateStatus(importId, {
      status: JobStatus.PROCESSING,
      startedAt: new Date(),
      jobId: job.id,
    });

    let totalRows = 0;
    try {
      const lineCount = await countFileLines(filePath);
      totalRows = Math.max(0, lineCount - 1);
      await this.importsRepository.updateStatus(importId, { totalRows });
    } catch {
      this.logger.warn(`Could not pre-count lines for ${importId}`);
    }

    let processedRows = 0;
    let insertedRows = 0;
    let duplicateRows = 0;
    let invalidRows = 0;
    let batch: Record<string, string | null>[] = [];
    const seenInCsv = new Set<string>();

    const processBatch = async (rows: Record<string, string | null>[]) => {
      if (rows.length === 0) return;

      const candidates: NewLead[] = [];
      const identityKeys = {
        email: [] as string[],
        phone: [] as string[],
        linkedin: [] as string[],
        website: [] as string[],
      };

      for (const row of rows) {
        // Normalize only the columns explicitly selected for this import.
        const identity = extractIdentityFromRow(row, mapping, {
          allowAutomaticDetection: false,
        });
        const rowKeys = normalizedFields
          .map((field) => {
            const value = identity[`${field}Normalized`];
            return value ? `${field}:${value}` : null;
          })
          .filter((key): key is string => key !== null);

        if (rowKeys.some((key) => seenInCsv.has(key))) {
          duplicateRows++;
          continue;
        }
        rowKeys.forEach((key) => seenInCsv.add(key));

        if (identity.emailNormalized)
          identityKeys.email.push(identity.emailNormalized);
        if (identity.phoneNormalized)
          identityKeys.phone.push(identity.phoneNormalized);
        if (identity.linkedinNormalized)
          identityKeys.linkedin.push(identity.linkedinNormalized);
        if (identity.websiteNormalized)
          identityKeys.website.push(identity.websiteNormalized);

        candidates.push({
          data: row,
          emailNormalized: identity.emailNormalized,
          phoneNormalized: identity.phoneNormalized,
          linkedinNormalized: identity.linkedinNormalized,
          websiteNormalized: identity.websiteNormalized,
        });
      }

      if (candidates.length === 0) return;

      // Check duplicates only against the normalized fields selected at
      // import time. A match on any selected field makes the row a duplicate.
      const [
        existingEmails,
        existingPhones,
        existingLinkedins,
        existingWebsites,
      ] = await Promise.all([
        this.leadsRepository.findByNormalizedKeys(
          'emailNormalized',
          identityKeys.email,
        ),
        this.leadsRepository.findByNormalizedKeys(
          'phoneNormalized',
          identityKeys.phone,
        ),
        this.leadsRepository.findByNormalizedKeys(
          'linkedinNormalized',
          identityKeys.linkedin,
        ),
        this.leadsRepository.findByNormalizedKeys(
          'websiteNormalized',
          identityKeys.website,
        ),
      ]);

      const existingEmailSet = new Set(
        existingEmails.map((l) => l.emailNormalized).filter(Boolean),
      );
      const existingPhoneSet = new Set(
        existingPhones.map((l) => l.phoneNormalized).filter(Boolean),
      );
      const existingLinkedinSet = new Set(
        existingLinkedins.map((l) => l.linkedinNormalized).filter(Boolean),
      );
      const existingWebsiteSet = new Set(
        existingWebsites.map((l) => l.websiteNormalized).filter(Boolean),
      );

      const toInsert: NewLead[] = [];
      for (const c of candidates) {
        const hits = {
          email: !!c.emailNormalized && existingEmailSet.has(c.emailNormalized),
          phone: !!c.phoneNormalized && existingPhoneSet.has(c.phoneNormalized),
          linkedin:
            !!c.linkedinNormalized &&
            existingLinkedinSet.has(c.linkedinNormalized),
          website:
            !!c.websiteNormalized &&
            existingWebsiteSet.has(c.websiteNormalized),
        };
        const isDup = normalizedFields.some((field) => hits[field]);

        if (isDup) {
          duplicateRows++;
          continue;
        }
        toInsert.push(c);
      }

      if (toInsert.length > 0) {
        const inserted = await this.leadsRepository.bulkInsert(toInsert);
        insertedRows += inserted;
        // Unique DB constraints catch concurrent email/phone/LinkedIn imports.
        duplicateRows += toInsert.length - inserted;
      }
    };

    try {
      const parser = createReadStream(filePath).pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          relax_column_count: true,
          trim: true,
          bom: true,
        }),
      );

      for await (const rawRow of parser) {
        const row = normalizeRow(rawRow as Record<string, unknown>);
        // Skip completely empty rows
        if (Object.values(row).every((v) => v == null || v === '')) {
          invalidRows++;
          processedRows++;
          continue;
        }
        batch.push(row);
        processedRows++;

        if (batch.length >= batchSize) {
          await processBatch(batch);
          batch = [];
          await this.importsRepository.updateStatus(importId, {
            processedRows,
            insertedRows,
            duplicateRows,
            invalidRows,
          });
        }
      }

      if (batch.length > 0) {
        await processBatch(batch);
      }

      await this.importsRepository.updateStatus(importId, {
        status: JobStatus.COMPLETED,
        processedRows,
        insertedRows,
        duplicateRows,
        invalidRows,
        totalRows: totalRows || processedRows,
        completedAt: new Date(),
      });

      this.logger.log(
        `Import ${importId} done: inserted=${insertedRows}, dupes=${duplicateRows}, invalid=${invalidRows}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Import ${importId} failed: ${message}`);
      await this.importsRepository.updateStatus(importId, {
        status: JobStatus.FAILED,
        errorMessage: message,
        processedRows,
        insertedRows,
        duplicateRows,
        invalidRows,
        completedAt: new Date(),
      });
      throw err;
    } finally {
      await safeUnlink(filePath);
    }
  }
}
