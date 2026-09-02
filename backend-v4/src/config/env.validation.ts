import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('api'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_POOL_MAX: z.coerce.number().default(10),

  CSV_BATCH_SIZE: z.coerce.number().min(100).max(10000).default(2000),
  WORKER_CONCURRENCY: z.coerce.number().min(1).max(20).default(2),

  MAX_UPLOAD_SIZE: z.coerce.number().default(524288000),
  MAX_EXPORT_ROWS: z.coerce.number().default(100000),

  UPLOAD_DIR: z.string().default('./storage/uploads'),
  OUTPUT_DIR: z.string().default('./storage/outputs'),

  FILE_RETENTION_HOURS: z.coerce.number().default(24),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const message = Object.entries(errors)
      .map(([key, msgs]) => `${key}: ${msgs?.join(', ')}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${message}`);
  }
  return result.data;
}
