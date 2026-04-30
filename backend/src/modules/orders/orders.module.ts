import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderItem } from './entities/order.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    StockModule
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
