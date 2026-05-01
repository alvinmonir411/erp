import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Due } from '../dues/entities/due.entity';
import { DueCollection } from '../dues/entities/due-collection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, StockMovement, Due, DueCollection]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
