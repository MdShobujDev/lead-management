import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '../database/database.provider';
import { DRIZZLE } from '../database/database.provider';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Full health check (app + memory)' })
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  @ApiOperation({
    summary: 'Readiness probe — checks PostgreSQL (and pg-boss schema)',
  })
  async readiness() {
    const checks: HealthIndicatorResult = {};

    try {
      await this.db.execute(sql`SELECT 1`);
      checks.database = { status: 'up' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'connection failed';
      checks.database = {
        status: 'down',
        message,
      };
    }

    const allUp = Object.values(checks).every((check) => {
      if (typeof check !== 'object' || check === null) {
        return false;
      }

      return 'status' in check && check.status === 'up';
    });

    return {
      status: allUp ? 'ok' : 'error',
      info: checks,
      timestamp: new Date().toISOString(),
    };
  }
}
