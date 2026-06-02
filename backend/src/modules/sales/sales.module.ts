import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Due } from '../dues/entities/due.entity';
import { DuesModule } from '../dues/dues.module';
import { Order } from '../orders/entities/order.entity';
import { Shop } from '../shops/entities/shop.entity';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Due, Shop]), DuesModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
