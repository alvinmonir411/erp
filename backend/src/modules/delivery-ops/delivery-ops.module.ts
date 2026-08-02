import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryOpsController } from './delivery-ops.controller';
import { DeliveryOpsService } from './delivery-ops.service';
import { DeliveryPerson } from './entities/delivery-person.entity';
import { DispatchBatch } from './entities/dispatch-batch.entity';
import { DispatchBatchOrder } from './entities/dispatch-batch-order.entity';
import { DispatchBatchItem } from './entities/dispatch-batch-item.entity';
import { DispatchBatchExpense } from './entities/dispatch-batch-expense.entity';
import { DeliveryReturn } from './entities/delivery-return.entity';
import { DeliveryReturnItem } from './entities/delivery-return-item.entity';
import { CashCollection } from './entities/cash-collection.entity';
import { DamageRecord } from './entities/damage-record.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { User } from '../users/entities/user.entity';
import { StockModule } from '../stock/stock.module';
import { DuesModule } from '../dues/dues.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryPerson,
      DispatchBatch,
      DispatchBatchOrder,
      DispatchBatchItem,
      DispatchBatchExpense,
      DeliveryReturn,
      DeliveryReturnItem,
      CashCollection,
      DamageRecord,
      Order,
      OrderItem,
      Product,
      StockMovement,
      User,
    ]),
    StockModule,
    DuesModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [DeliveryOpsController],
  providers: [DeliveryOpsService],
  exports: [DeliveryOpsService],
})
export class DeliveryOpsModule {}
