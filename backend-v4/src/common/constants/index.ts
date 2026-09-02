export const QUEUE_NAMES = {
  LEAD_IMPORT: 'lead-import',
  LEAD_EXPORT: 'lead-export',
  LEAD_MATCH: 'lead-match',
} as const;

export const DEFAULT_BATCH_SIZE = 2000;
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;
export const DEFAULT_EXPORT_LIMIT = 10000;
export const MAX_EXPORT_LIMIT = 100000;
