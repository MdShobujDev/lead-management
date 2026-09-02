import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';
import { QUEUE_NAMES } from '../common/constants';
import { PG_BOSS } from './pgboss.constants';

@Global()
@Module({
  providers: [
    {
      provide: PG_BOSS,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const connectionString = config.get<string>('app.databaseUrl');
        if (!connectionString) {
          throw new Error('DATABASE_URL is required for pg-boss');
        }

        const boss = new PgBoss({
          connectionString,
          schema: 'pgboss',
          archiveCompletedAfterSeconds: 60 * 60,
          deleteAfterSeconds: 60 * 60 * 24,
        });

        boss.on('error', (err: Error) => {
          console.error('[pg-boss] error:', err.message);
        });

        await boss.start();

        for (const name of Object.values(QUEUE_NAMES)) {
          await boss.createQueue(name);
        }

        return boss;
      },
    },
  ],
  exports: [PG_BOSS],
})
export class PgBossModule {
  static async stop(boss: PgBoss) {
    try {
      await boss.stop({ graceful: true, timeout: 10000 });
    } catch (e) {
      console.warn('[pg-boss] stop warning:', (e as Error).message);
    }
  }
}
