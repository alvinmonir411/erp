import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Post()
  create(@Body() createPurchaseDto: any) {
    return this.purchasesService.create(createPurchaseDto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Get()
  findAll(@Query() query: any) {
    return this.purchasesService.findAll(query);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(+id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePurchaseDto: any) {
    return this.purchasesService.update(+id, updatePurchaseDto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Post(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.purchasesService.confirmPurchase(+id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.purchasesService.delete(+id);
  }
}
