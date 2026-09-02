import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { stringify } from 'csv-stringify/sync';
import { MAX_EXPORT_LIMIT } from '../common/constants';
import { LeadsRepository } from '../leads/leads.repository';
import { CreateExportDto } from './dto/create-export.dto';

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly leadsRepository: LeadsRepository,
  ) {}

  async exportCsv(dto: CreateExportDto): Promise<{
    buffer: Buffer;
    filename: string;
    rowCount: number;
  }> {
    const maxRows =
      this.configService.get<number>('app.maxExportRows') || MAX_EXPORT_LIMIT;
    const limit = Math.min(dto.limit || 10000, maxRows);

    const filter = {
      search: dto.search,
      fields: dto.fields,
      filters: dto.filters,
      hasEmail: dto.hasEmail,
      hasPhone: dto.hasPhone,
      hasLinkedIn: dto.hasLinkedIn,
      createdFrom: dto.createdFrom,
      createdTo: dto.createdTo,
      sortBy: dto.sortBy,
      sortOrder: dto.sortOrder,
    };

    const pageSize = 2000;
    const allRows: Record<string, string | null>[] = [];
    let offset = 0;
    const columnSet = new Set<string>(dto.columns || []);

    while (allRows.length < limit) {
      const batch = await this.leadsRepository.findForExport(
        filter,
        Math.min(pageSize, limit - allRows.length),
        offset,
      );
      if (batch.length === 0) break;

      for (const lead of batch) {
        const data = lead.data || {};
        allRows.push(data);
        if (!dto.columns) {
          for (const k of Object.keys(data)) columnSet.add(k);
        }
      }
      offset += batch.length;
      if (batch.length < pageSize) break;
    }

    const columns = Array.from(columnSet);
    const records = allRows.map((row) => {
      const out: Record<string, string> = {};
      for (const col of columns) {
        const v = row[col];
        out[col] = v == null ? '' : String(v);
      }
      return out;
    });

    const csv = stringify(records, { header: true, columns });
    const filename = `leads-export-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.csv`;

    this.logger.log(`Exported ${records.length} rows -> ${filename}`);

    return {
      buffer: Buffer.from(csv, 'utf-8'),
      filename,
      rowCount: records.length,
    };
  }
}
