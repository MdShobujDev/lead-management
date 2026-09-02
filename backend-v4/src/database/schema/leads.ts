import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Fully dynamic lead storage.
 * - `data` holds the entire CSV row as key/value (any number of fields).
 * - Normalized identity columns enable fast unique/dedupe checks.
 * Empty CSV cells are stored as null or "".
 */
export const leads = pgTable(
  'leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Full row payload – keys are original CSV headers (trimmed) */
    data: jsonb('data')
      .$type<Record<string, string | null>>()
      .notNull()
      .default({}),
    /** Extracted & normalized identity fields for deduplication */
    emailNormalized: varchar('email_normalized', { length: 320 }),
    phoneNormalized: varchar('phone_normalized', { length: 50 }),
    linkedinNormalized: varchar('linkedin_normalized', { length: 500 }),
    websiteNormalized: varchar('website_normalized', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('leads_created_at_idx').on(table.createdAt),
    index('leads_email_normalized_idx').on(table.emailNormalized),
    index('leads_phone_normalized_idx').on(table.phoneNormalized),
    index('leads_linkedin_normalized_idx').on(table.linkedinNormalized),
    // GIN index for dynamic jsonb filtering
    index('leads_data_gin_idx').using('gin', table.data),
    // Partial unique indexes – only enforce uniqueness when value is present
    uniqueIndex('leads_email_normalized_unique')
      .on(table.emailNormalized)
      .where(sql`${table.emailNormalized} IS NOT NULL`),
    uniqueIndex('leads_phone_normalized_unique')
      .on(table.phoneNormalized)
      .where(sql`${table.phoneNormalized} IS NOT NULL`),
    uniqueIndex('leads_linkedin_normalized_unique')
      .on(table.linkedinNormalized)
      .where(sql`${table.linkedinNormalized} IS NOT NULL`),
  ],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
