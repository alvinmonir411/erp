import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementType } from './stock.constants';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
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
