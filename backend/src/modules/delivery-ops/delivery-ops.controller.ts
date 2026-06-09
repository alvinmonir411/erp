import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Delete,
  Query,
} from '@nestjs/common';
import { DeliveryOpsService } from './delivery-ops.service';
import { CreateDeliveryPersonDto } from './dto/create-delivery-person.dto';
import { CreateDispatchBatchDto } from './dto/create-dispatch-batch.dto';
import { QueryDispatchBatchesDto } from './dto/query-dispatch-batches.dto';
import { RecordBatchReturnsDto } from './dto/record-batch-returns.dto';
import { SettleDispatchBatchDto } from './dto/settle-dispatch-batch.dto';
import { DeliveryResultDto } from './dto/delivery-result.dto';
import { CreateShopForOrderDto } from './dto/create-shop-for-order.dto';


import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('delivery-ops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryOpsController {
  constructor(private readonly deliveryOpsService: DeliveryOpsService) { }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.DELIVERY_MAN)
  @Post('delivery-result/:orderId')
  submitDeliveryResult(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: DeliveryResultDto,
    @CurrentUser() user: any,
  ) {
    console.log(`[DeliveryOps] Submitting delivery result for order ${orderId}`, dto);
    return this.deliveryOpsService.submitDeliveryResult(orderId, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.DELIVERY_MAN)
  @Post('orders/:orderId/create-shop')
  createShopForOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: CreateShopForOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.deliveryOpsService.createShopForOrder(orderId, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.DELIVERY_MAN)
  @Get('dashboard')
  getDashboard(@Query('date') date?: string, @CurrentUser() user?: any) {
    return this.deliveryOpsService.getDashboard(date, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR, Role.DELIVERY_MAN)
  @Get('reports')
  getReports(@Query() query: QueryDispatchBatchesDto, @CurrentUser() user: any) {
    return this.deliveryOpsService.getReports(query, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get('personnel')
  getDeliveryPeople(@Query('includeInactive') includeInactive?: string) {
    return this.deliveryOpsService.getDeliveryPeople(includeInactive === 'true');
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Post('personnel')
  createDeliveryPerson(@Body() dto: CreateDeliveryPersonDto) {
    return this.deliveryOpsService.createDeliveryPerson(dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get('personnel/:id')
  getDeliveryPersonById(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryOpsService.getDeliveryPersonById(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Patch('personnel/:id')
  updateDeliveryPerson(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateDeliveryPersonDto>,
  ) {
    return this.deliveryOpsService.updateDeliveryPerson(id, dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('personnel/:id')
  deleteDeliveryPerson(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryOpsService.deleteDeliveryPerson(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get('confirmed-orders')
  getEligibleOrders(@Query() query: QueryDispatchBatchesDto, @CurrentUser() user: any) {
    return this.deliveryOpsService.getEligibleOrders(query, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR, Role.DELIVERY_MAN)
  @Get('batches')
  getDispatchBatches(@Query() query: QueryDispatchBatchesDto, @CurrentUser() user: any) {
    return this.deliveryOpsService.getDispatchBatches(query, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Post('batches')
  createDispatchBatch(@Body() dto: CreateDispatchBatchDto) {
    return this.deliveryOpsService.createDispatchBatch(dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR, Role.DELIVERY_MAN)
  @Get('batches/:id')
  getDispatchBatch(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.deliveryOpsService.getDispatchBatch(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.DELIVERY_MAN)
  @Get('batches/:id/reports/morning')
  getMorningReport(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.deliveryOpsService.getMorningReport(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.DELIVERY_MAN)
  @Get('batches/:id/reports/final')
  getFinalReport(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.deliveryOpsService.getFinalReport(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Patch('batches/:id/print-morning')
  printMorning(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryOpsService.markMorningPrinted(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Patch('batches/:id/dispatch')
  dispatchBatch(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryOpsService.dispatchBatch(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Post('batches/:id/returns')
  recordReturns(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordBatchReturnsDto,
  ) {
    return this.deliveryOpsService.recordReturns(id, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Post('batches/:id/settlement')
  settleBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SettleDispatchBatchDto,
  ) {
    return this.deliveryOpsService.settleBatch(id, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Delete('batches/:id')
  deleteDispatchBatch(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryOpsService.deleteDispatchBatch(id);
  }
}
