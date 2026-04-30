import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementType } from './stock.constants';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('movements')
  create(@Body() dto: CreateStockMovementDto) {
    return this.stockService.create(dto);
  }

  @Get('history')
  getHistory(
    @Query('companyId') companyId?: string,
    @Query('productId') productId?: string,
    @Query('type') type?: StockMovementType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.stockService.getHistory({
      companyId: companyId ? Number(companyId) : undefined,
      productId: productId ? Number(productId) : undefined,
      type,
      startDate,
      endDate,
      search,
    });
  }

  @Get('summary')
  getSummary(
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
  ) {
    return this.stockService.getSummary(
      companyId ? Number(companyId) : undefined,
      search,
    );
  }

  @Post('backfill')
  backfill() {
    return this.stockService.backfillStock();
  }
}
