import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('business-overview')
  async getBusinessOverview(
    @Query('datePreset') datePreset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('routeId') routeId?: string,
    @Query('deliveryManId') deliveryManId?: string,
    @Query('companyId') companyId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.analyticsService.getBusinessOverview({
      datePreset,
      startDate,
      endDate,
      routeId: routeId ? Number(routeId) : undefined,
      deliveryManId,
      companyId: companyId ? Number(companyId) : undefined,
      productId: productId ? Number(productId) : undefined,
    });
  }
}
