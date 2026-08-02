import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DispatchBatch } from './dispatch-batch.entity';
import { ColumnNumericTransformer } from '../../orders/orders.constants';

export enum DispatchExpenseType {
  FUEL = 'Fuel',
  FOOD = 'Food',
  MAINTENANCE = 'Maintenance',
  PARKING = 'Parking',
  LOADING = 'Loading',
  TOLL = 'Toll',
  OTHER = 'Other',
}

@Entity('dispatch_batch_expenses')
export class DispatchBatchExpense {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dispatchBatchId: number;

  @ManyToOne(() => DispatchBatch, (batch) => batch.expenses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'dispatchBatchId' })
  batch: DispatchBatch;

  @Column({
    type: 'varchar',
    length: 50,
    default: DispatchExpenseType.OTHER,
  })
  expenseType: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
