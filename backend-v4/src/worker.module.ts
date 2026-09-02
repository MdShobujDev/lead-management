import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CleanupService } from './common/utils/cleanup.service';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { ImportsModule } from './imports/imports.module';
import { LeadsModule } from './leads/leads.module';
import { PgBossModule } from './pgboss/pgboss.module';

/**
 * Worker process – runs import jobs via pg-boss.
 * Export & match are handled synchronously in the API process
 * (no persistent records needed).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    PgBossModule,
    LeadsModule,
    ImportsModule,
  ],
  providers: [CleanupService],
})
export class WorkerModule {}
