// Generated from OpenAPI 2.1.0 – Lead Manager API

export type DuplicateStrategy =
  | "email"
  | "phone"
  | "linkedin"
  | "email_or_phone"
  | "email_or_linkedin"
  | "phone_or_linkedin"
  | "email_or_phone_or_linkedin";

export type JobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "isNull"
  | "isNotNull"
  | "in"
  | "notIn"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface AdvancedFilter {
  field: string;
  op: FilterOperator;
  value?: string | string[] | number | boolean | null;
}

export interface DashboardStats {
  leads: {
    total: number;
  };
  imports: {
    total: number;
    completed: number;
    processing: number;
    failed: number;
  };
}

export interface PreviewImportResponse {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  estimatedRows: number;
}

export interface CreateImportResponse {
  id: string;
  status: JobStatus;
  message?: string;
}

export interface ImportResponse {
  id: string;
  originalFilename: string;
  status: JobStatus;
  totalRows: number;
  processedRows: number;
  insertedRows: number;
  duplicateRows: number;
  invalidRows: number;
  errorMessage?: string | null;
  mapping?: Record<string, string> | null;
  duplicateStrategy?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface LeadResponse {
  id: string;
  data: Record<string, string | null>;
  emailNormalized?: string | null;
  phoneNormalized?: string | null;
  linkedinNormalized?: string | null;
  websiteNormalized?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedLeadsResponse {
  data: LeadResponse[];
  nextCursor?: string | null;
  hasNextPage: boolean;
  page?: number;
  totalPages?: number;
  total?: number;
}

export interface FieldMeta {
  name: string;
  nonNullCount: number;
  sampleValues: string[];
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface BulkDeleteRequest {
  search?: string;
  fields?: Record<string, string>;
  filters?: AdvancedFilter[];
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasLinkedIn?: boolean;
  createdFrom?: string;
  createdTo?: string;
}

export interface CreateExportRequest {
  search?: string;
  fields?: Record<string, string>;
  filters?: AdvancedFilter[];
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasLinkedIn?: boolean;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
  columns?: string[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface LeadListParams {
  search?: string;
  fields?: string; // JSON string
  filters?: string; // JSON string
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasLinkedIn?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  cursor?: string;
  page?: number;
  limit?: number;
  includeTotal?: boolean;
}

export const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "notContains", label: "Does not contain" },
  { value: "startsWith", label: "Starts with" },
  { value: "endsWith", label: "Ends with" },
  { value: "isNull", label: "Is empty" },
  { value: "isNotNull", label: "Is not empty" },
  { value: "in", label: "In list" },
  { value: "notIn", label: "Not in list" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less or equal" },
];

export const DUPLICATE_STRATEGIES: {
  value: DuplicateStrategy;
  label: string;
}[] = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email_or_phone", label: "Email or Phone" },
  { value: "email_or_linkedin", label: "Email or LinkedIn" },
  { value: "phone_or_linkedin", label: "Phone or LinkedIn" },
  {
    value: "email_or_phone_or_linkedin",
    label: "Email, Phone or LinkedIn",
  },
];
