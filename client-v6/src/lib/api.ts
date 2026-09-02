import type {
  AdvancedFilter,
  BulkDeleteRequest,
  CreateExportRequest,
  CreateImportResponse,
  DashboardStats,
  FacetValue,
  FieldMeta,
  ImportResponse,
  LeadListParams,
  LeadResponse,
  PaginatedLeadsResponse,
  PreviewImportResponse,
} from "@/types/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      const raw = body.message ?? body.error ?? message;
      message = Array.isArray(raw) ? raw.join(", ") : String(raw);
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  // For CSV / binary
  return res as unknown as T;
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (typeof value === "boolean") {
      search.set(key, String(value));
    } else {
      search.set(key, String(value));
    }
  });
  const q = search.toString();
  return q ? `?${q}` : "";
}

// ─── Health ───────────────────────────────────────────────────────────────────
export async function getLiveness() {
  const res = await fetch(`${API_BASE}/health/liveness`);
  return handleResponse(res);
}

export async function getReadiness() {
  const res = await fetch(`${API_BASE}/health/readiness`);
  return handleResponse(res);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/dashboard/stats`);
  return handleResponse(res);
}

// ─── Imports ──────────────────────────────────────────────────────────────────
export async function previewImport(
  file: File,
): Promise<PreviewImportResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/imports/preview`, {
    method: "POST",
    body: form,
  });
  return handleResponse(res);
}

export async function createImport(
  file: File,
  mapping?: Record<string, string>,
  duplicateStrategy?: string,
): Promise<CreateImportResponse> {
  const form = new FormData();
  form.append("file", file);
  if (mapping) form.append("mapping", JSON.stringify(mapping));
  if (duplicateStrategy) form.append("duplicateStrategy", duplicateStrategy);
  const res = await fetch(`${API_BASE}/imports`, {
    method: "POST",
    body: form,
  });
  return handleResponse(res);
}

export async function listImports(): Promise<ImportResponse[]> {
  const res = await fetch(`${API_BASE}/imports`);
  return handleResponse(res);
}

export async function getImport(id: string): Promise<ImportResponse> {
  const res = await fetch(`${API_BASE}/imports/${id}`);
  return handleResponse(res);
}

// ─── Leads ────────────────────────────────────────────────────────────────────
export async function listLeads(
  params: LeadListParams = {},
): Promise<PaginatedLeadsResponse> {
  const q = buildQuery(params as Record<string, unknown>);
  const res = await fetch(`${API_BASE}/leads${q}`);
  return handleResponse(res);
}

export async function getLeadFields(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/leads/fields`);
  return handleResponse(res);
}

export async function getLeadFieldMeta(): Promise<FieldMeta[]> {
  const res = await fetch(`${API_BASE}/leads/fields/meta`);
  return handleResponse(res);
}

export async function getLeadFieldFacets(
  field: string,
  search?: string,
  limit = 50,
): Promise<FacetValue[]> {
  const q = buildQuery({ field, search, limit });
  const res = await fetch(`${API_BASE}/leads/fields/facets${q}`);
  return handleResponse(res);
}

export async function countLeads(
  params: Omit<LeadListParams, "sortBy" | "sortOrder" | "cursor" | "page" | "limit" | "includeTotal"> = {},
): Promise<number> {
  const q = buildQuery(params as Record<string, unknown>);
  const res = await fetch(`${API_BASE}/leads/count${q}`);
  return handleResponse(res);
}

export async function getLead(id: string): Promise<LeadResponse> {
  const res = await fetch(`${API_BASE}/leads/${id}`);
  return handleResponse(res);
}

export async function updateLead(
  id: string,
  data: Record<string, unknown>,
): Promise<LeadResponse> {
  const res = await fetch(`${API_BASE}/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  return handleResponse(res);
}

export async function deleteLead(
  id: string,
): Promise<{ deleted: boolean; id: string }> {
  const res = await fetch(`${API_BASE}/leads/${id}`, { method: "DELETE" });
  return handleResponse(res);
}

export async function bulkDeleteLeads(
  body: BulkDeleteRequest,
): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/leads/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export async function createExport(
  body: CreateExportRequest,
): Promise<{ blob: Blob; rowCount: number }> {
  const res = await fetch(`${API_BASE}/exports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = await res.json();
      const raw = j.message ?? j.error ?? message;
      message = Array.isArray(raw) ? raw.join(", ") : String(raw);
    } catch {
      /* */
    }
    throw new ApiError(res.status, message);
  }
  const rowCount = Number(res.headers.get("X-Row-Count") || 0);
  const blob = await res.blob();
  return { blob, rowCount };
}

// ─── Matching ─────────────────────────────────────────────────────────────────
export async function matchAndEnrich(
  file: File,
  csvMatchField: string,
  dbMatchField: string,
  columnsToFill?: string[],
): Promise<{
  blob: Blob;
  total: number;
  matched: number;
  unmatched: number;
  filledCells?: number;
}> {
  const form = new FormData();
  form.append("file", file);
  form.append("csvMatchField", csvMatchField);
  form.append("dbMatchField", dbMatchField);
  if (columnsToFill && columnsToFill.length > 0) {
    form.append("columnsToFill", JSON.stringify(columnsToFill));
  }
  const res = await fetch("/api/matching", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = await res.json();
      const raw = j.message ?? j.error ?? message;
      message = Array.isArray(raw) ? raw.join(", ") : String(raw);
    } catch {
      /* */
    }
    throw new ApiError(res.status, message);
  }
  const filled = res.headers.get("X-Filled-Cells");
  return {
    blob: await res.blob(),
    total: Number(res.headers.get("X-Total-Rows") || 0),
    matched: Number(res.headers.get("X-Matched-Rows") || 0),
    unmatched: Number(res.headers.get("X-Unmatched-Rows") || 0),
    filledCells: filled != null ? Number(filled) : undefined,
  };
}

export { ApiError };
