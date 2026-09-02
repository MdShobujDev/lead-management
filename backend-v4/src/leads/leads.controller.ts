import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BulkDeleteLeadsDto } from './dto/bulk-delete.dto';
import {
  FacetValueDto,
  FieldMetaDto,
  LeadResponseDto,
  PaginatedLeadsResponseDto,
} from './dto/lead-response.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List leads — dynamic filters, advanced operators, sort, cursor or page pagination',
  })
  @ApiOkResponse({ type: PaginatedLeadsResponseDto })
  findAll(@Query() query: QueryLeadsDto) {
    return this.leadsService.findAll(query);
  }

  @Get('fields')
  @ApiOperation({
    summary:
      'Distinct field names in stored data (table columns / filter keys)',
  })
  getFields() {
    return this.leadsService.getAvailableFields();
  }

  @Get('fields/meta')
  @ApiOperation({
    summary:
      'Field metadata: name, non-null count, sample values (for professional filter UI)',
  })
  @ApiOkResponse({ type: [FieldMetaDto] })
  getFieldMeta() {
    return this.leadsService.getFieldMetadata();
  }

  @Get('fields/facets')
  @ApiOperation({
    summary: 'Faceted values for one field (dropdown filters with counts)',
  })
  @ApiQuery({ name: 'field', required: true, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: [FacetValueDto] })
  getFacets(
    @Query('field') field: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leadsService.getFieldFacets(
      field,
      search,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('count')
  @ApiOperation({ summary: 'Count leads matching filters' })
  count(@Query() query: QueryLeadsDto) {
    return this.leadsService.count(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single lead by id' })
  @ApiOkResponse({ type: LeadResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead data (merge into data jsonb)' })
  @ApiBody({ type: UpdateLeadDto })
  @ApiOkResponse({ type: LeadResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a single lead' })
  @HttpCode(200)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.remove(id);
  }

  @Post('bulk-delete')
  @ApiOperation({
    summary: 'Delete all leads matching filters (at least one filter required)',
  })
  @HttpCode(200)
  bulkDelete(@Body() dto: BulkDeleteLeadsDto) {
    return this.leadsService.bulkDelete(dto);
  }
}
