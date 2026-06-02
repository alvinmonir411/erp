import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateManualDueDto } from './dto/create-manual-due.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('manual-due')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  addManualDue(@Body() dto: CreateManualDueDto, @CurrentUser() user: any) {
    return this.salesService.addManualDue(dto, user);
  }
}
