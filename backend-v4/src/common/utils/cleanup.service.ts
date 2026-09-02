import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanupOldFiles, ensureDir } from './file-storage';

/**
 * Ensures storage directories exist and cleans up old temporary files
 * according to FILE_RETENTION_HOURS.
 */
@Injectable()
export class CleanupService implements OnModuleInit {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const uploadDir =
      this.configService.get<string>('app.uploadDir') || './storage/uploads';
    const outputDir =
      this.configService.get<string>('app.outputDir') || './storage/outputs';
    const retentionHours =
      this.configService.get<number>('app.fileRetentionHours') || 24;

    await ensureDir(uploadDir);
    await ensureDir(outputDir);

    const deletedUploads = await cleanupOldFiles(uploadDir, retentionHours);
    const deletedOutputs = await cleanupOldFiles(outputDir, retentionHours);

    if (deletedUploads + deletedOutputs > 0) {
      this.logger.log(
        `Cleaned up ${deletedUploads} upload(s) and ${deletedOutputs} output(s) older than ${retentionHours}h`,
      );
    }
  }
}
