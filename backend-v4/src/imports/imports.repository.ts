import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { JobStatus } from '../common/enums';
import type { DrizzleDB } from '../database/database.provider';
import { DRIZZLE } from '../database/database.provider';
import { ImportRecord, imports, NewImport } from '../database/schema';

@Injectable()
export class ImportsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(data: NewImport): Promise<ImportRecord> {
    const [row] = await this.db.insert(imports).values(data).returning();
    return row;
  }

  async findById(id: string): Promise<ImportRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(imports)
      .where(eq(imports.id, id))
      .limit(1);
    return row;
  }

  async findAll(limit = 50): Promise<ImportRecord[]> {
    return this.db
      .select()
      .from(imports)
      .orderBy(desc(imports.createdAt))
      .limit(limit);
  }

  async updateStatus(
    id: string,
    data: Partial<{
      status: JobStatus;
      totalRows: number;
      processedRows: number;
      insertedRows: number;
      duplicateRows: number;
      invalidRows: number;
      failedRows: number;
      errorMessage: string | null;
      startedAt: Date;
      completedAt: Date;
      jobId: string;
    }>,
  ): Promise<void> {
    await this.db.update(imports).set(data).where(eq(imports.id, id));
  }
}
