import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderItem } from './entities/order.entity';
import { Due } from '../dues/entities/due.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { StockModule } from '../stock/stock.module';
import { DuesModule } from '../dues/dues.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Due]),
    StockModule,
    DuesModule
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
