import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockMovement } from './entities/stock-movement.entity';
import { Product } from '../products/entities/product.entity';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { Order, OrderItem } from '../orders/entities/order.entity';
import {
  DispatchBatch,
  DispatchBatchStatus,
} from '../delivery-ops/entities/dispatch-batch.entity';
import { DispatchBatchItem } from '../delivery-ops/entities/dispatch-batch-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockMovement,
      Product,
      Order,
      OrderItem,
      DispatchBatch,
      DispatchBatchItem,
    ]),
  ],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
