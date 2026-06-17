import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { DeliverySummariesService } from './delivery-summaries.service';

@Controller('delivery-summaries')
export class DeliverySummariesController {
  constructor(private readonly service: DeliverySummariesService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get('reports/daily-summary')
  getDailyReport(
    @Query('date') date: string,
    @Query('companyId') companyId?: number,
    @Query('routeId') routeId?: number,
  ) {
    return this.service.getDailyReport(date, companyId, routeId);
  }

  @Post('sync')
  syncOrders(
    @Body() dto: { date: string; companyId: number; routeId: number },
  ) {
    return this.service.syncOrders(dto.date, dto.companyId, dto.routeId);
  }

  @Patch(':id/returns')
  updateReturns(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { items: { productId: number; returnedQuantity: number }[] },
  ) {
    return this.service.updateReturns(id, dto.items);
  }

  @Patch(':id/print')
  markAsPrinted(
    @Param('id', ParseIntPipe) id: number,
    @Query('mode') mode: 'morning' | 'final',
  ) {
    return this.service.markAsPrinted(id, mode);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
