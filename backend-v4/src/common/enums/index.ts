export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Built-in identity-based dedupe strategies (still supported).
 * Additionally, any arbitrary CSV/DB field name can be used as the
 * duplicate strategy — field names are stored exactly as they appear
 * in the CSV header and matched case-insensitively against `leads.data`.
 */
export enum DuplicateStrategy {
  EMAIL = 'email',
  PHONE = 'phone',
  LINKEDIN = 'linkedin',
  EMAIL_OR_PHONE = 'email_or_phone',
  EMAIL_OR_LINKEDIN = 'email_or_linkedin',
  PHONE_OR_LINKEDIN = 'phone_or_linkedin',
  EMAIL_OR_PHONE_OR_LINKEDIN = 'email_or_phone_or_linkedin',
}

/** Known identity strategies that use normalized identity columns */
export const IDENTITY_DUPLICATE_STRATEGIES = new Set<string>([
  DuplicateStrategy.EMAIL,
  DuplicateStrategy.PHONE,
  DuplicateStrategy.LINKEDIN,
  DuplicateStrategy.EMAIL_OR_PHONE,
  DuplicateStrategy.EMAIL_OR_LINKEDIN,
  DuplicateStrategy.PHONE_OR_LINKEDIN,
  DuplicateStrategy.EMAIL_OR_PHONE_OR_LINKEDIN,
]);

/** Canonical identity field names we extract from dynamic CSV data */
export const IDENTITY_FIELDS = [
  'email',
  'phone',
  'linkedin',
  'linkedinUrl',
  'website',
  'company',
] as const;

export type IdentityField = (typeof IDENTITY_FIELDS)[number];
