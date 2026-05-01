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

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('delivery-ops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryOpsController {
  constructor(private readonly deliveryOpsService: DeliveryOpsService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Get('dashboard')
  getDashboard(@Query('date') date?: string) {
    return this.deliveryOpsService.getDashboard(date);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get('reports')
  getReports(@Query() query: QueryDispatchBatchesDto) {
    return this.deliveryOpsService.getReports(query);
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
  getEligibleOrders(@Query() query: QueryDispatchBatchesDto) {
    return this.deliveryOpsService.getEligibleOrders(query);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get('batches')
  getDispatchBatches(@Query() query: QueryDispatchBatchesDto) {
    return this.deliveryOpsService.getDispatchBatches(query);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Post('batches')
  createDispatchBatch(@Body() dto: CreateDispatchBatchDto) {
    return this.deliveryOpsService.createDispatchBatch(dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get('batches/:id')
  getDispatchBatch(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryOpsService.getDispatchBatch(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Get('batches/:id/reports/morning')
  getMorningReport(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryOpsService.getMorningReport(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Get('batches/:id/reports/final')
  getFinalReport(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryOpsService.getFinalReport(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Patch('batches/:id/print-morning')
  printMorning(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryOpsService.markMorningPrinted(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Patch('batches/:id/dispatch')
  dispatchBatch(@Param('id', ParseIntPipe) id: number) {
    return this.deliveryOpsService.dispatchBatch(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Post('batches/:id/returns')
  recordReturns(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordBatchReturnsDto,
  ) {
    return this.deliveryOpsService.recordReturns(id, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Post('batches/:id/settlement')
  settleBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SettleDispatchBatchDto,
  ) {
    return this.deliveryOpsService.settleBatch(id, dto);
  }
}
