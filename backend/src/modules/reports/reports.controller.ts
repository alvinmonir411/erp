import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.SR)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('free-quantity')
  async getFreeQuantityReport(
    @CurrentUser() user: any,
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
    }, user);
  }
}
