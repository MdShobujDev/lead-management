export interface LeadFieldMapping {
  /** CSV header -> canonical key used for identity extraction (email, phone, …) */
  [csvHeader: string]: string;
}

export interface ImportLeadJobData {
  importId: string;
  filePath: string;
  mapping?: LeadFieldMapping;
  /**
   * Derived from the normalized fields selected in the import mapping.
   */
  duplicateStrategy: string;
  originalFilename: string;
}

export interface ExportLeadJobData {
  /** Filters are fully dynamic – any field path inside `data` jsonb */
  filters: Record<string, string | boolean | undefined>;
  limit: number;
  /** Output path where the CSV will be written */
  outputFilePath: string;
  /** Optional list of columns to include (defaults to all keys found) */
  columns?: string[];
}

export interface MatchLeadJobData {
  inputFilePath: string;
  outputFilePath: string;
  /** CSV column used to match against DB */
  csvMatchField: string;
  /**
   * DB field to match on: email | phone | linkedin | website
   * OR any key present in leads.data (fetched dynamically via /leads/fields)
   */
  dbMatchField: string;
  originalFilename: string;
}

export interface JobProgress {
  percentage: number;
  processedRows: number;
  totalRows: number;
  insertedRows?: number;
  duplicateRows?: number;
  invalidRows?: number;
  matchedRows?: number;
  unmatchedRows?: number;
}
