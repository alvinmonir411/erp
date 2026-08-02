import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Product } from '../products/entities/product.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { DispatchBatch } from '../delivery-ops/entities/dispatch-batch.entity';
import { DispatchBatchExpense } from '../delivery-ops/entities/dispatch-batch-expense.entity';
import { DamageRecord } from '../delivery-ops/entities/damage-record.entity';
import { Due } from '../dues/entities/due.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Order,
      OrderItem,
      DispatchBatch,
      DispatchBatchExpense,
      DamageRecord,
      Due,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
