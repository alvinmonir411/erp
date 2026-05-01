import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DuesService } from './dues.service';
import { DuesController } from './dues.controller';
import { Due } from './entities/due.entity';
import { DueCollection } from './entities/due-collection.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Due, DueCollection, Order, OrderItem]),
  ],
  controllers: [DuesController],
  providers: [DuesService],
  exports: [DuesService],
})
export class DuesModule {}
