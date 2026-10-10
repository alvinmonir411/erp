import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../companies/entities/company.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Purchase, PurchaseItem } from './entities/purchase.entity';
import { CompanyPayment } from './entities/company-payment.entity';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { CloudinaryService } from './cloudinary.service';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Purchase,
      PurchaseItem,
      CompanyPayment,
      Company,
      Product,
      StockMovement,
    ]),
    StockModule,
  ],
  controllers: [PurchasesController],
  providers: [PurchasesService, CloudinaryService],
  exports: [PurchasesService, CloudinaryService],
})
export class PurchasesModule {}
