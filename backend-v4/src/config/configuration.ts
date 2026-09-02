import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
  dbPoolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  csvBatchSize: parseInt(process.env.CSV_BATCH_SIZE || '2000', 10),
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '524288000', 10),
  maxExportRows: parseInt(process.env.MAX_EXPORT_ROWS || '100000', 10),
  uploadDir: process.env.UPLOAD_DIR || './storage/uploads',
  outputDir: process.env.OUTPUT_DIR || './storage/outputs',
  fileRetentionHours: parseInt(process.env.FILE_RETENTION_HOURS || '24', 10),
}));
