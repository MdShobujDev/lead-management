import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { JobStatus } from '../common/enums';
import type { DrizzleDB } from '../database/database.provider';
import { DRIZZLE } from '../database/database.provider';
import { imports, leads } from '../database/schema';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @Get('stats')
  @ApiOperation({
    summary: 'High-level counts for leads and import jobs',
  })
  @ApiResponse({ status: 200 })
  async stats() {
    const [leadCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads);

    const [importStats] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${imports.status} = ${JobStatus.COMPLETED})::int`,
        processing: sql<number>`count(*) filter (where ${imports.status} = ${JobStatus.PROCESSING})::int`,
        failed: sql<number>`count(*) filter (where ${imports.status} = ${JobStatus.FAILED})::int`,
      })
      .from(imports);

    return {
      leads: { total: leadCount?.count ?? 0 },
      imports: {
        total: importStats?.total ?? 0,
        completed: importStats?.completed ?? 0,
        processing: importStats?.processing ?? 0,
        failed: importStats?.failed ?? 0,
      },
    };
  }
}
