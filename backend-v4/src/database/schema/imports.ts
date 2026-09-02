import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { JobStatus } from '../../common/enums';

/**
 * Lightweight import job tracking (progress / status only).
 * Actual lead rows live in the `leads` table.
 */
export const imports = pgTable('imports', {
  id: uuid('id').defaultRandom().primaryKey(),
  originalFilename: varchar('original_filename', { length: 500 }).notNull(),
  storedFilename: varchar('stored_filename', { length: 500 }).notNull(),
  filePath: text('file_path').notNull(),
  totalRows: integer('total_rows').default(0),
  processedRows: integer('processed_rows').default(0),
  insertedRows: integer('inserted_rows').default(0),
  duplicateRows: integer('duplicate_rows').default(0),
  invalidRows: integer('invalid_rows').default(0),
  failedRows: integer('failed_rows').default(0),
  status: varchar('status', { length: 50 })
    .$type<JobStatus>()
    .default(JobStatus.PENDING)
    .notNull(),
  errorMessage: text('error_message'),
  /** Optional mapping of CSV header -> canonical identity field */
  mapping: jsonb('mapping').$type<Record<string, string>>(),
  /**
   * Duplicate strategy: built-in identity strategy (email, phone, …)
   * OR any dynamic CSV/DB field name (same header stored in leads.data).
   */
  duplicateStrategy: varchar('duplicate_strategy', { length: 100 }),
  jobId: varchar('job_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export type ImportRecord = typeof imports.$inferSelect;
export type NewImport = typeof imports.$inferInsert;
