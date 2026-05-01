import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryOpsController } from './delivery-ops.controller';
import { DeliveryOpsService } from './delivery-ops.service';
import { DeliveryPerson } from './entities/delivery-person.entity';
import { DispatchBatch } from './entities/dispatch-batch.entity';
import { DispatchBatchOrder } from './entities/dispatch-batch-order.entity';
import { DispatchBatchItem } from './entities/dispatch-batch-item.entity';
import { DeliveryReturn } from './entities/delivery-return.entity';
import { DeliveryReturnItem } from './entities/delivery-return-item.entity';
import { CashCollection } from './entities/cash-collection.entity';
import { DamageRecord } from './entities/damage-record.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { StockModule } from '../stock/stock.module';
import { DuesModule } from '../dues/dues.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryPerson,
      DispatchBatch,
      DispatchBatchOrder,
      DispatchBatchItem,
      DeliveryReturn,
      DeliveryReturnItem,
      CashCollection,
      DamageRecord,
      Order,
      OrderItem,
      Product,
      StockMovement,
    ]),
    StockModule,
    DuesModule
  ],
  controllers: [DeliveryOpsController],
  providers: [DeliveryOpsService],
  exports: [DeliveryOpsService],
})
export class DeliveryOpsModule {}
