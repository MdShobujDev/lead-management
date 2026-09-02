import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

@Module({
  imports: [LeadsModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
