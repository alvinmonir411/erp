import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DispatchBatch } from './dispatch-batch.entity';
import { Order } from '../../orders/entities/order.entity';
import { ColumnNumericTransformer } from '../../orders/orders.constants';
import { DeliveryReturn } from './delivery-return.entity';
import { CashCollection } from './cash-collection.entity';

@Entity('dispatch_batch_orders')
export class DispatchBatchOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  batchId: number;

  @ManyToOne(() => DispatchBatch, (batch) => batch.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: DispatchBatch;

  @Column()
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  estimatedAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  finalSoldAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  collectedAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  dueAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  shortageOrExcess: number;

  @Column({ type: 'boolean', default: false })
  isSettled: boolean;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  deliveryStatus: 'PENDING' | 'DRAFT' | 'COMPLETED';

  @Column({ type: 'text', nullable: true })
  deliveryNote?: string;

  @Column({ type: 'timestamp', nullable: true })
  deliveryCompletedAt?: Date;

  @OneToMany(() => DeliveryReturn, (deliveryReturn) => deliveryReturn.batchOrder)
  returns: DeliveryReturn[];

  @OneToMany(() => CashCollection, (collection) => collection.batchOrder)
  collections: CashCollection[];
}
