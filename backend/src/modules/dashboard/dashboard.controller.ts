import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get('metrics')
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  async getMetrics(
    @Query('companyId') companyId: string | undefined,
    @Query('period') period: string | undefined,
    @Query('month') month: string | undefined,
    @Query('year') year: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getDashboardData(
      companyId ? parseInt(companyId, 10) : undefined,
      user,
      {
        period: period || 'this_month',
        month: month ? parseInt(month, 10) : undefined,
        year: year ? parseInt(year, 10) : undefined,
      },
    );
  }
}

