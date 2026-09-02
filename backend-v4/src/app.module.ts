import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CleanupService } from './common/utils/cleanup.service';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { ExportsModule } from './exports/exports.module';
import { HealthModule } from './health/health.module';
import { ImportsModule } from './imports/imports.module';
import { LeadsModule } from './leads/leads.module';
import { MatchingModule } from './matching/matching.module';
import { PgBossModule } from './pgboss/pgboss.module';

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
    ExportsModule,
    MatchingModule,
    HealthModule,
    DashboardModule,
  ],
  providers: [CleanupService],
})
export class AppModule {}
