import { Controller, Get, Post, Body, Param, UseGuards, Patch, ParseIntPipe } from '@nestjs/common';
import { DuesService } from './dues.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('dues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DuesController {
  constructor(private readonly duesService: DuesService) { }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.duesService.findAll(user);
  }

  @Get('stats')
  @Roles(Role.SR, Role.MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  getStats(@CurrentUser() user: any) {
    return this.duesService.getStats(user);
  }

  @Get('pending-collections')
  findPendingCollections(@CurrentUser() user: any) {
    return this.duesService.findPendingCollections(user);
  }

  @Get('collections')
  @Roles(Role.SR, Role.MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  getCollections(@CurrentUser() user: any) {
    return this.duesService.findCollections(user);
  }

  @Get('order/:orderId/collections')
  @Roles(Role.SR, Role.MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  getOrderCollections(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.duesService.findCollectionsByOrderId(orderId);
  }

  @Post('collect')
  @Roles(Role.SR, Role.MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  collect(@Body() data: any, @CurrentUser() user: any) {
    return this.duesService.collectDue(data, user);
  }

  @Post('upsert')
  @Roles(Role.SR, Role.MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  upsert(@Body() data: { orderId: number; amount: number; note?: string }) {
    return this.duesService.upsertByOrderId(data.orderId, data.amount, data.note);
  }

  @Patch('approve/:id')
  @Roles(Role.SUPER_ADMIN)
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.duesService.approveCollection(+id, user);
  }

  @Patch('reject/:id')
  @Roles(Role.SUPER_ADMIN)
  reject(@Param('id') id: string, @Body() data: { reason: string }, @CurrentUser() user: any) {
    return this.duesService.rejectCollection(+id, data, user);
  }

  @Get('sr-summary')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getSRSummary() {
    return this.duesService.getSRDueSummary();
  }

  @Get('shop/:shopId')
  @Roles(Role.SR, Role.MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  getShopDues(@Param('shopId', ParseIntPipe) shopId: number, @CurrentUser() user: any) {
    return this.duesService.findShopDues(shopId, user);
  }
}
