import { Controller, Post, Body, Get, Param, ParseIntPipe, Query, Patch, Delete, Header } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { SettleOrderDto } from './dto/settle-order.dto';
import { OrderStatus } from './orders.constants';

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get('stats')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  getStats(@CurrentUser() user: any) {
    return this.ordersService.getStats(user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Post()
  create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: any) {
    return this.ordersService.create(createOrderDto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR, Role.DELIVERY_MAN)
  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.ordersService.findAll(query, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR, Role.DELIVERY_MAN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.ordersService.findOne(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Patch(':id/update')
  // General update route
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Patch('shop-link/:id')
  updateShop(
    @Param('id', ParseIntPipe) id: number,
    @Body('shopId') shopId: number,
  ) {
    console.log(`Updating shop for order ${id} to ${shopId}`);
    return this.ordersService.updateShop(id, shopId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR, Role.DELIVERY_MAN)
  @Patch(':id/delivery')
  updateDelivery(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateDelivery(id, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: OrderStatus,
  ) {
    return this.ordersService.updateStatus(id, status);
  }


  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Post(':id/settle')
  settleOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SettleOrderDto,
  ) {
    return this.ordersService.settleOrder(id, dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.delete(id);
  }
}
