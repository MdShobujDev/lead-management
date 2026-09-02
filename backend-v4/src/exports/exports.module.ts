import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [LeadsModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
