import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Get('summary/company-wise-payable')
  getCompanyWisePayableSummary(@Query() query: any) {
    return this.purchasesService.getCompanyWisePayableSummary(query);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Get('summary/product-supplies')
  getProductSupplySummary(@Query('companyId') companyId?: string) {
    return this.purchasesService.getProductSupplySummary(
      companyId ? parseInt(companyId, 10) : undefined,
    );
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Get('payments')
  getPaymentHistory(@Query() query: any) {
    return this.purchasesService.getPaymentHistory(query);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Get('companies/:companyId/payable-ledger')
  getCompanyPayableLedger(@Param('companyId') companyId: string) {
    return this.purchasesService.getCompanyPayableLedger(+companyId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Post('companies/:companyId/payments')
  recordCompanyPayment(
    @Param('companyId') companyId: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    return this.purchasesService.recordCompanyPayment(+companyId, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Post(':id/payments')
  receivePurchasePayment(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    // If called via purchase invoice endpoint, automatically set purchaseId
    return this.purchasesService.recordCompanyPayment(
      dto.companyId || 0,
      { ...dto, purchaseId: +id },
      user,
    );
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @Post()
  create(@Body() createPurchaseDto: any, @CurrentUser() user: any) {
    return this.purchasesService.create(createPurchaseDto, user);
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

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete('reset-demo-data')
  resetDemoData() {
    return this.purchasesService.resetDemoData();
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete('payments/:paymentId')
  removePayment(@Param('paymentId') paymentId: string) {
    return this.purchasesService.deletePayment(+paymentId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.purchasesService.delete(+id);
  }
}
