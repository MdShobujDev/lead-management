import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { ImportsController } from './imports.controller';
import { ImportsRepository } from './imports.repository';
import { ImportsService } from './imports.service';
import { ImportProcessor } from './processors/import.processor';

@Module({
  imports: [LeadsModule],
  controllers: [ImportsController],
  providers: [ImportsService, ImportsRepository, ImportProcessor],
  exports: [ImportsService, ImportsRepository],
})
export class ImportsModule {}
