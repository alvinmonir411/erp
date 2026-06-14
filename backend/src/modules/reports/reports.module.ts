import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { DamageRecord } from '../delivery-ops/entities/damage-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, DamageRecord])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
