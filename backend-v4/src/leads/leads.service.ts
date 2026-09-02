import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { extractIdentityFromRow } from '../common/utils/normalization';
import { Lead } from '../database/schema';
import { BulkDeleteLeadsDto } from './dto/bulk-delete.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsRepository } from './leads.repository';

@Injectable()
export class LeadsService {
  constructor(private readonly leadsRepository: LeadsRepository) {}

  async findAll(query: QueryLeadsDto) {
    const result = await this.leadsRepository.findPaginated({
      search: query.search,
      fields: query.fields,
      filters: query.filters,
      hasEmail: query.hasEmail,
      hasPhone: query.hasPhone,
      hasLinkedIn: query.hasLinkedIn,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      limit: query.limit,
      cursor: query.cursor,
      page: query.page,
    });

    let total = result.total;
    if (query.includeTotal && total == null) {
      total = await this.leadsRepository.count({
        search: query.search,
        fields: query.fields,
        filters: query.filters,
        hasEmail: query.hasEmail,
        hasPhone: query.hasPhone,
        hasLinkedIn: query.hasLinkedIn,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
      });
    }

    return {
      data: result.data.map((l) => this.toDto(l)),
      nextCursor: result.nextCursor,
      hasNextPage: result.hasNextPage,
      page: result.page,
      totalPages: result.totalPages,
      total,
    };
  }

  async findOne(id: string) {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return this.toDto(lead);
  }

  async count(query?: QueryLeadsDto) {
    return this.leadsRepository.count({
      search: query?.search,
      fields: query?.fields,
      filters: query?.filters,
      hasEmail: query?.hasEmail,
      hasPhone: query?.hasPhone,
      hasLinkedIn: query?.hasLinkedIn,
      createdFrom: query?.createdFrom,
      createdTo: query?.createdTo,
    });
  }

  async getAvailableFields() {
    return this.leadsRepository.getDistinctFields();
  }

  async getFieldMetadata() {
    return this.leadsRepository.getFieldMetadata();
  }

  async getFieldFacets(field: string, search?: string, limit?: number) {
    if (!field?.trim()) {
      throw new BadRequestException('field is required');
    }
    return this.leadsRepository.getFieldFacets(field, search, limit ?? 50);
  }

  async update(id: string, dto: UpdateLeadDto) {
    const existing = await this.leadsRepository.findById(id);
    if (!existing) throw new NotFoundException(`Lead ${id} not found`);

    const merged: Record<string, string | null> = {
      ...(existing.data || {}),
      ...dto.data,
    };
    const identity = extractIdentityFromRow(merged);

    const row = await this.leadsRepository.updateFull(id, {
      data: merged,
      emailNormalized: identity.emailNormalized,
      phoneNormalized: identity.phoneNormalized,
      linkedinNormalized: identity.linkedinNormalized,
      websiteNormalized: identity.websiteNormalized,
    });

    if (!row) throw new NotFoundException(`Lead ${id} not found`);
    return this.toDto(row);
  }

  async remove(id: string) {
    const ok = await this.leadsRepository.deleteById(id);
    if (!ok) throw new NotFoundException(`Lead ${id} not found`);
    return { deleted: true, id };
  }

  async bulkDelete(dto: BulkDeleteLeadsDto) {
    const filter = {
      search: dto.search,
      fields: dto.fields,
      filters: dto.filters,
      hasEmail: dto.hasEmail,
      hasPhone: dto.hasPhone,
      hasLinkedIn: dto.hasLinkedIn,
      createdFrom: dto.createdFrom,
      createdTo: dto.createdTo,
    };

    const hasAny =
      !!dto.search ||
      (dto.fields && Object.keys(dto.fields).length > 0) ||
      (dto.filters && dto.filters.length > 0) ||
      dto.hasEmail === true ||
      dto.hasPhone === true ||
      dto.hasLinkedIn === true ||
      !!dto.createdFrom ||
      !!dto.createdTo;

    if (!hasAny) {
      throw new BadRequestException(
        'Refusing unfiltered bulk delete. Provide at least one filter.',
      );
    }

    const deleted = await this.leadsRepository.deleteByFilter(filter);
    return { deleted };
  }

  private toDto(lead: Lead) {
    return {
      id: lead.id,
      data: lead.data ?? {},
      emailNormalized: lead.emailNormalized,
      phoneNormalized: lead.phoneNormalized,
      linkedinNormalized: lead.linkedinNormalized,
      websiteNormalized: lead.websiteNormalized,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }
}
