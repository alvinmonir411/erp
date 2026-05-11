import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DispatchBatch } from './dispatch-batch.entity';
import { DispatchBatchOrder } from './dispatch-batch-order.entity';
import { ColumnNumericTransformer } from '../../orders/orders.constants';

@Entity('cash_collections')
export class CashCollection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  batchId: number;

  @ManyToOne(() => DispatchBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: DispatchBatch;

  @Column()
  batchOrderId: number;

  @ManyToOne(() => DispatchBatchOrder, (batchOrder) => batchOrder.collections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'batchOrderId' })
  batchOrder: DispatchBatchOrder;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({ type: 'varchar', length: 40, default: 'CASH' })
  paymentMode: string;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: 'PENDING' | 'VERIFIED';

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;
}
