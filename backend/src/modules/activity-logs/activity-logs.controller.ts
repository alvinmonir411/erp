import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogsService, ActivityLogFilterQueryDto } from './activity-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('activity-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  async getActivityLogs(@Query() query: ActivityLogFilterQueryDto) {
    return this.activityLogsService.getActivityLogs(query);
  }
}
