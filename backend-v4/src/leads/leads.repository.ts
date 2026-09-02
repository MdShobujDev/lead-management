import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../database/database.provider';
import { DRIZZLE } from '../database/database.provider';
import { Lead, leads, NewLead } from '../database/schema';
import type { AdvancedFilterDto } from './dto/query-leads.dto';

export interface DynamicFilter {
  search?: string;
  fields?: Record<string, string>;
  filters?: AdvancedFilterDto[];
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasLinkedIn?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
  page?: number;
}

export interface PaginatedResult {
  data: Lead[];
  nextCursor: string | null;
  hasNextPage: boolean;
  page?: number;
  totalPages?: number;
  total?: number;
}

@Injectable()
export class LeadsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(id: string): Promise<Lead | undefined> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);
    return row;
  }

  async findPaginated(query: DynamicFilter): Promise<PaginatedResult> {
    const limit = query.limit || 50;
    const conditions = this.buildFilterConditions(query);
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const sortBy = query.sortBy || 'createdAt';
    const orderExpr = this.buildOrderExpression(sortBy, sortOrder);

    // Offset mode when page is provided and no cursor
    if (query.page && query.page >= 1 && !query.cursor) {
      const offset = (query.page - 1) * limit;
      const whereClause = conditions.length ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        this.db
          .select()
          .from(leads)
          .where(whereClause)
          .orderBy(...orderExpr)
          .limit(limit)
          .offset(offset),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(leads)
          .where(whereClause),
      ]);

      const total = countResult[0]?.count ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        data: rows,
        nextCursor: null,
        hasNextPage: query.page < totalPages,
        page: query.page,
        totalPages,
        total,
      };
    }

    // Cursor (keyset) mode
    let cursorCondition: SQL | undefined;
    if (query.cursor) {
      cursorCondition = this.buildCursorCondition(
        query.cursor,
        sortBy,
        sortOrder,
      );
    }

    const whereClause =
      conditions.length || cursorCondition
        ? and(...conditions, cursorCondition)
        : undefined;

    const rows = await this.db
      .select()
      .from(leads)
      .where(whereClause)
      .orderBy(...orderExpr)
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const data = hasNextPage ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasNextPage && data.length > 0) {
      nextCursor = this.encodeCursor(data[data.length - 1], sortBy);
    }

    return { data, nextCursor, hasNextPage };
  }

  // ─── Filter builders ───────────────────────────────────────────────

  buildFilterConditions(query: DynamicFilter): SQL[] {
    const conditions: SQL[] = [];

    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM jsonb_each_text(${leads.data}) AS kv
          WHERE kv.value ILIKE ${term}
        )`,
      );
    }

    // Simple fields map → contains
    if (query.fields) {
      for (const [field, value] of Object.entries(query.fields)) {
        if (value == null || value === '') continue;
        conditions.push(this.opToSql(field, 'contains', value));
      }
    }

    // Advanced filters
    if (query.filters?.length) {
      for (const f of query.filters) {
        if (!f?.field || !f.op) continue;
        const sqlCond = this.opToSql(f.field, f.op, f.value);
        if (sqlCond) conditions.push(sqlCond);
      }
    }

    if (query.hasEmail === true) {
      conditions.push(isNotNull(leads.emailNormalized));
    }
    if (query.hasPhone === true) {
      conditions.push(isNotNull(leads.phoneNormalized));
    }
    if (query.hasLinkedIn === true) {
      conditions.push(isNotNull(leads.linkedinNormalized));
    }

    if (query.createdFrom) {
      conditions.push(gte(leads.createdAt, new Date(query.createdFrom)));
    }
    if (query.createdTo) {
      conditions.push(lte(leads.createdAt, new Date(query.createdTo)));
    }

    return conditions;
  }

  private opToSql(field: string, op: string, value: unknown): SQL {
    // Special identity / system columns (canonical names)
    if (field === 'createdAt' || field === 'updatedAt') {
      return this.dateOpSql(field, op, value);
    }
    if (field === 'email' || field === 'emailNormalized') {
      return this.columnOpSql(leads.emailNormalized, op, value, true);
    }
    if (field === 'phone' || field === 'phoneNormalized') {
      return this.columnOpSql(leads.phoneNormalized, op, value, true);
    }
    if (field === 'linkedin' || field === 'linkedinNormalized') {
      return this.columnOpSql(leads.linkedinNormalized, op, value, true);
    }
    if (field === 'website' || field === 'websiteNormalized') {
      return this.columnOpSql(leads.websiteNormalized, op, value, true);
    }

    // Dynamic jsonb path: data->>'field' (exact key as stored from CSV header)
    const col = sql`(${leads.data}->>${field})`;
    const v = this.toFilterString(value);

    switch (op) {
      case 'eq':
        return sql`lower(${col}) = lower(${v})`;
      case 'neq':
        return sql`lower(${col}) IS DISTINCT FROM lower(${v})`;
      case 'contains':
        return sql`${col} ILIKE ${'%' + v + '%'}`;
      case 'notContains':
        return sql`(${col} IS NULL OR ${col} NOT ILIKE ${'%' + v + '%'})`;
      case 'startsWith':
        return sql`${col} ILIKE ${v + '%'}`;
      case 'endsWith':
        return sql`${col} ILIKE ${'%' + v}`;
      case 'isNull':
        return sql`(${col} IS NULL OR ${col} = '')`;
      case 'isNotNull':
        return sql`(${col} IS NOT NULL AND ${col} <> '')`;
      case 'in': {
        const list = this.toStringList(value).map((v) => v.toLowerCase());
        if (list.length === 0) return sql`true`;
        return sql`lower(${col}) = ANY(${list})`;
      }
      case 'notIn': {
        const list = this.toStringList(value).map((v) => v.toLowerCase());
        if (list.length === 0) return sql`true`;
        return sql`(${col} IS NULL OR lower(${col}) <> ALL(${list}))`;
      }
      case 'gt':
        return sql`${col} > ${v}`;
      case 'gte':
        return sql`${col} >= ${v}`;
      case 'lt':
        return sql`${col} < ${v}`;
      case 'lte':
        return sql`${col} <= ${v}`;
      default:
        return sql`${col} ILIKE ${'%' + v + '%'}`;
    }
  }

  private columnOpSql(
    column: PgColumn,
    op: string,
    value: unknown,
    lower = false,
  ): SQL {
    const v = this.toFilterString(value);
    switch (op) {
      case 'eq':
        return lower ? sql`lower(${column}) = lower(${v})` : eq(column, v);
      case 'neq':
        return sql`${column} IS DISTINCT FROM ${v}`;
      case 'contains':
        return sql`${column} ILIKE ${'%' + v + '%'}`;
      case 'notContains':
        return sql`(${column} IS NULL OR ${column} NOT ILIKE ${'%' + v + '%'})`;
      case 'startsWith':
        return sql`${column} ILIKE ${v + '%'}`;
      case 'endsWith':
        return sql`${column} ILIKE ${'%' + v}`;
      case 'isNull':
        return isNull(column);
      case 'isNotNull':
        return isNotNull(column);
      case 'in': {
        const list = this.toStringList(value);
        if (list.length === 0) return sql`true`;
        return inArray(column, list);
      }
      case 'notIn': {
        const list = this.toStringList(value);
        if (list.length === 0) return sql`true`;
        return sql`(${column} IS NULL OR ${column} NOT IN (${sql.join(
          list.map((x) => sql`${x}`),
          sql`, `,
        )}))`;
      }
      default:
        return sql`${column} ILIKE ${'%' + v + '%'}`;
    }
  }

  private dateOpSql(
    field: 'createdAt' | 'updatedAt',
    op: string,
    value: unknown,
  ): SQL {
    const col = field === 'createdAt' ? leads.createdAt : leads.updatedAt;
    if (op === 'isNull') return isNull(col);
    if (op === 'isNotNull') return isNotNull(col);
    const d = new Date(this.toFilterString(value));
    switch (op) {
      case 'eq':
        return sql`(${col})::date = ${d}::date`;
      case 'gt':
        return gt(col, d);
      case 'gte':
        return gte(col, d);
      case 'lt':
        return lt(col, d);
      case 'lte':
        return lte(col, d);
      default:
        return gte(col, d);
    }
  }

  private toStringList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.toFilterString(item).trim())
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const item = this.toFilterString(value).trim();
    return item ? [item] : [];
  }

  private toFilterString(value: unknown): string {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }
    return '';
  }

  // ─── Sort / cursor ─────────────────────────────────────────────────

  private buildOrderExpression(
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): SQL[] {
    const dir = sortOrder === 'asc' ? asc : desc;
    const tieBreaker = desc(leads.id);

    switch (sortBy) {
      case 'createdAt':
        return [dir(leads.createdAt), tieBreaker];
      case 'updatedAt':
        return [dir(leads.updatedAt), tieBreaker];
      case 'email':
        return [dir(leads.emailNormalized), tieBreaker];
      case 'phone':
        return [dir(leads.phoneNormalized), tieBreaker];
      case 'linkedin':
        return [dir(leads.linkedinNormalized), tieBreaker];
      case 'website':
        return [dir(leads.websiteNormalized), tieBreaker];
      default:
        return [
          sortOrder === 'asc'
            ? sql`${leads.data}->>${sortBy} ASC NULLS LAST`
            : sql`${leads.data}->>${sortBy} DESC NULLS LAST`,
          tieBreaker,
        ];
    }
  }

  private encodeCursor(lead: Lead, sortBy: string): string {
    let sortValue: string;
    switch (sortBy) {
      case 'createdAt':
        sortValue = lead.createdAt.toISOString();
        break;
      case 'updatedAt':
        sortValue = lead.updatedAt.toISOString();
        break;
      case 'email':
        sortValue = lead.emailNormalized || '';
        break;
      case 'phone':
        sortValue = lead.phoneNormalized || '';
        break;
      case 'linkedin':
        sortValue = lead.linkedinNormalized || '';
        break;
      case 'website':
        sortValue = lead.websiteNormalized || '';
        break;
      default:
        sortValue = this.toFilterString(lead.data?.[sortBy]);
    }
    return `${encodeURIComponent(sortValue)}|${lead.id}|${encodeURIComponent(sortBy)}`;
  }

  private buildCursorCondition(
    cursor: string,
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): SQL | undefined {
    const parts = cursor.split('|');
    if (parts.length < 2) return undefined;

    const sortValue = decodeURIComponent(parts[0]);
    const cursorId = parts[1];
    const cmp = sortOrder === 'asc' ? gt : lt;
    const cmpSql = sortOrder === 'asc' ? sql`>` : sql`<`;

    switch (sortBy) {
      case 'createdAt': {
        const d = new Date(sortValue);
        return or(
          cmp(leads.createdAt, d),
          and(eq(leads.createdAt, d), cmp(leads.id, cursorId)),
        );
      }
      case 'updatedAt': {
        const d = new Date(sortValue);
        return or(
          cmp(leads.updatedAt, d),
          and(eq(leads.updatedAt, d), cmp(leads.id, cursorId)),
        );
      }
      case 'email':
        return or(
          cmp(leads.emailNormalized, sortValue),
          and(eq(leads.emailNormalized, sortValue), cmp(leads.id, cursorId)),
        );
      case 'phone':
        return or(
          cmp(leads.phoneNormalized, sortValue),
          and(eq(leads.phoneNormalized, sortValue), cmp(leads.id, cursorId)),
        );
      case 'linkedin':
        return or(
          cmp(leads.linkedinNormalized, sortValue),
          and(eq(leads.linkedinNormalized, sortValue), cmp(leads.id, cursorId)),
        );
      case 'website':
        return or(
          cmp(leads.websiteNormalized, sortValue),
          and(eq(leads.websiteNormalized, sortValue), cmp(leads.id, cursorId)),
        );
      default:
        return sql`(
          (${leads.data}->>${sortBy}) ${cmpSql} ${sortValue}
          OR (
            (${leads.data}->>${sortBy}) = ${sortValue}
            AND ${leads.id} ${cmpSql} ${cursorId}::uuid
          )
        )`;
    }
  }

  // ─── Mutations ─────────────────────────────────────────────────────

  async bulkInsert(rows: NewLead[]): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await this.db
      .insert(leads)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: leads.id });
    return result.length;
  }

  async updateFull(
    id: string,
    patch: {
      data: Record<string, string | null>;
      emailNormalized: string | null;
      phoneNormalized: string | null;
      linkedinNormalized: string | null;
      websiteNormalized: string | null;
    },
  ): Promise<Lead | undefined> {
    const [row] = await this.db
      .update(leads)
      .set({
        data: patch.data,
        emailNormalized: patch.emailNormalized,
        phoneNormalized: patch.phoneNormalized,
        linkedinNormalized: patch.linkedinNormalized,
        websiteNormalized: patch.websiteNormalized,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id))
      .returning();
    return row;
  }

  async update(
    id: string,
    data: Record<string, string | null>,
  ): Promise<Lead | undefined> {
    const [row] = await this.db
      .update(leads)
      .set({ data, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return row;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db
      .delete(leads)
      .where(eq(leads.id, id))
      .returning({ id: leads.id });
    return result.length > 0;
  }

  async deleteByFilter(query: DynamicFilter): Promise<number> {
    const conditions = this.buildFilterConditions(query);
    if (conditions.length === 0) {
      // Safety: refuse unfiltered delete
      return 0;
    }
    const result = await this.db
      .delete(leads)
      .where(and(...conditions))
      .returning({ id: leads.id });
    return result.length;
  }

  // ─── Lookups ───────────────────────────────────────────────────────

  async findByNormalizedKeys(
    field:
      | 'emailNormalized'
      | 'phoneNormalized'
      | 'linkedinNormalized'
      | 'websiteNormalized',
    keys: string[],
  ): Promise<Lead[]> {
    if (keys.length === 0) return [];
    return this.db.select().from(leads).where(inArray(leads[field], keys));
  }

  async findByMatchField(dbField: string, keys: string[]): Promise<Lead[]> {
    if (keys.length === 0) return [];
    const normalized = keys.map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (normalized.length === 0) return [];

    switch (dbField.toLowerCase()) {
      case 'email':
      case 'emailnormalized':
        return this.findByNormalizedKeys('emailNormalized', normalized);
      case 'phone':
      case 'phonenormalized':
        return this.findByNormalizedKeys(
          'phoneNormalized',
          keys.map((k) => k.replace(/\D/g, '')).filter((k) => k.length >= 7),
        );
      case 'linkedin':
      case 'linkedinurl':
      case 'linkedinnormalized':
        return this.findByNormalizedKeys('linkedinNormalized', normalized);
      case 'website':
      case 'websitenormalized':
        return this.findByNormalizedKeys('websiteNormalized', normalized);
      default:
        // Match any dynamic key in leads.data (case-insensitive value)
        return this.findByDataFieldValues(dbField, normalized);
    }
  }

  /**
   * Find leads where data->>fieldName (case-insensitive value) is in keys.
   * Field name is matched against JSON keys as stored (exact first; also
   * supports keys that differ only by case via a fallback EXISTS scan).
   */
  async findByDataFieldValues(
    fieldName: string,
    keys: string[],
  ): Promise<Lead[]> {
    if (!fieldName || keys.length === 0) return [];
    const normalized = keys
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    if (normalized.length === 0) return [];

    // Primary: exact JSON key as provided (CSV header == DB key)
    // Fallback: any key matching case-insensitively
    return this.db
      .select()
      .from(leads)
      .where(
        sql`(
          lower(${leads.data}->>${fieldName}) = ANY(${normalized})
          OR EXISTS (
            SELECT 1 FROM jsonb_each_text(${leads.data}) AS kv
            WHERE lower(kv.key) = lower(${fieldName})
              AND lower(kv.value) = ANY(${normalized})
          )
        )`,
      );
  }

  async count(query?: DynamicFilter): Promise<number> {
    const conditions = query ? this.buildFilterConditions(query) : [];
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(conditions.length ? and(...conditions) : undefined);
    return result[0]?.count ?? 0;
  }

  async getDistinctFields(limit = 200): Promise<string[]> {
    const result = await this.db.execute<{ key: string }>(sql`
      SELECT DISTINCT key
      FROM leads, jsonb_object_keys(data) AS key
      ORDER BY key
      LIMIT ${limit}
    `);
    const rows: Array<{ key: string }> = Array.isArray(result.rows)
      ? result.rows
      : [];
    return rows.map((row) => row.key);
  }

  /**
   * Field metadata for building professional filter UI:
   * name, non-null count, sample distinct values.
   */
  async getFieldMetadata(sampleValuesLimit = 20): Promise<
    Array<{
      name: string;
      nonNullCount: number;
      sampleValues: string[];
    }>
  > {
    const fieldNames = await this.getDistinctFields();
    const out: Array<{
      name: string;
      nonNullCount: number;
      sampleValues: string[];
    }> = [];

    for (const name of fieldNames) {
      const [countRow] = await this.db
        .select({
          count: sql<number>`count(*) filter (
            where ${leads.data}->>${name} is not null
              and ${leads.data}->>${name} <> ''
          )::int`,
        })
        .from(leads);

      const samples = await this.db.execute<{ val: string }>(sql`
        SELECT DISTINCT ${leads.data}->>${name} AS val
        FROM ${leads}
        WHERE ${leads.data}->>${name} IS NOT NULL
          AND ${leads.data}->>${name} <> ''
        ORDER BY val
        LIMIT ${sampleValuesLimit}
      `);

      const sampleRows: Array<{ val: string | null }> = Array.isArray(
        samples.rows,
      )
        ? samples.rows
        : [];

      out.push({
        name,
        nonNullCount: countRow?.count ?? 0,
        sampleValues: sampleRows
          .map((row) => row.val)
          .filter((val): val is string => typeof val === 'string'),
      });
    }

    return out;
  }

  /** Distinct values for one field (faceted filter dropdown) */
  async getFieldFacets(
    field: string,
    search?: string,
    limit = 50,
  ): Promise<Array<{ value: string; count: number }>> {
    const searchClause = search
      ? sql`AND (${leads.data}->>${field}) ILIKE ${'%' + search + '%'}`
      : sql``;

    const result = await this.db.execute<{ value: string; count: number }>(sql`
      SELECT
        ${leads.data}->>${field} AS value,
        count(*)::int AS count
      FROM ${leads}
      WHERE ${leads.data}->>${field} IS NOT NULL
        AND ${leads.data}->>${field} <> ''
        ${searchClause}
      GROUP BY 1
      ORDER BY count DESC, value ASC
      LIMIT ${limit}
    `);

    const rows: Array<{
      value?: string | null;
      count?: number | string | null;
    }> = Array.isArray(result.rows) ? result.rows : [];

    return rows.map((r) => ({
      value: typeof r.value === 'string' ? r.value : '',
      count: Number(r.count ?? 0),
    }));
  }

  async findForExport(
    query: DynamicFilter,
    limit: number,
    offset = 0,
  ): Promise<Lead[]> {
    const conditions = this.buildFilterConditions(query);
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const sortBy = query.sortBy || 'createdAt';
    const orderExpr = this.buildOrderExpression(sortBy, sortOrder);

    return this.db
      .select()
      .from(leads)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(...orderExpr)
      .limit(limit)
      .offset(offset);
  }
}
