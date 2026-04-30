import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('free-quantity')
  async getFreeQuantityReport(
    @Query('dateMode') dateMode?: string,
    @Query('date') date?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('companyId') companyId?: string,
    @Query('routeId') routeId?: string,
    @Query('shopId') shopId?: string,
    @Query('deliveryManId') deliveryManId?: string,
    @Query('productId') productId?: string,
    @Query('orderStatus') orderStatus?: string,
  ) {
    return this.reportsService.getFreeQuantityReport({
      dateMode: dateMode || 'Today',
      date,
      fromDate,
      toDate,
      companyId: companyId ? Number(companyId) : undefined,
      routeId: routeId ? Number(routeId) : undefined,
      shopId: shopId ? Number(shopId) : undefined,
      deliveryManId: deliveryManId ? Number(deliveryManId) : undefined,
      productId: productId ? Number(productId) : undefined,
      orderStatus,
    });
  }
}
