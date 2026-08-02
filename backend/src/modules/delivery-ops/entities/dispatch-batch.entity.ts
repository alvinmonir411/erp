import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Route } from '../../routes/entities/route.entity';
import { DeliveryPerson } from './delivery-person.entity';
import { DispatchBatchOrder } from './dispatch-batch-order.entity';
import { DispatchBatchItem } from './dispatch-batch-item.entity';
import { DispatchBatchExpense } from './dispatch-batch-expense.entity';
import { ColumnNumericTransformer } from '../../orders/orders.constants';
import { User } from '../../users/entities/user.entity';

export enum DispatchBatchStatus {
  DRAFT = 'DRAFT',
  PRINTED = 'PRINTED',
  DISPATCHED = 'DISPATCHED',
  RETURN_PENDING = 'RETURN_PENDING',
  PARTIALLY_SETTLED = 'PARTIALLY_SETTLED',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
}

@Entity('dispatch_batches')
export class DispatchBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 30, unique: true })
  batchNo: string;

  @Column({ type: 'date' })
  dispatchDate: Date;

  @Column({ nullable: true })
  companyId?: number;

  @ManyToOne(() => Company, { nullable: true })
  @JoinColumn({ name: 'companyId' })
  company?: Company;

  @Column()
  routeId: number;

  @ManyToOne(() => Route)
  @JoinColumn({ name: 'routeId' })
  route: Route;

  @Column({ nullable: true })
  deliveryPersonId: number;

  @ManyToOne(() => DeliveryPerson, { nullable: true })
  @JoinColumn({ name: 'deliveryPersonId' })
  deliveryPerson: DeliveryPerson;

  @Column({ type: 'uuid', nullable: true })
  assignedDeliveryManId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedDeliveryManId' })
  assignedDeliveryMan: User;

  @Column({ type: 'varchar', length: 120, nullable: true })
  marketArea?: string;

  @Column({
    type: 'enum',
    enum: DispatchBatchStatus,
    default: DispatchBatchStatus.DRAFT,
  })
  status: DispatchBatchStatus;

  @Column({ type: 'int', default: 0 })
  totalOrders: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  grossDispatchedValue: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  returnAdjustedValue: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  finalSoldValue: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalAdvancePaid: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalCollectedAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalDueAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  shortageOrExcess: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  vanRent: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  salary: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalExpenses: number;

  @Column({ default: false })
  isMorningPrinted: boolean;

  @Column({ default: false })
  isFinalPrinted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  morningPrintedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  dispatchedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  returnsRecordedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  settledAt?: Date;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'text', nullable: true })
  settlementNote?: string;

  @OneToMany(() => DispatchBatchOrder, (batchOrder) => batchOrder.batch, {
    cascade: true,
  })
  orders: DispatchBatchOrder[];

  @OneToMany(() => DispatchBatchItem, (item) => item.batch, { cascade: true })
  items: DispatchBatchItem[];

  @OneToMany(() => DispatchBatchExpense, (expense) => expense.batch, {
    cascade: true,
  })
  expenses: DispatchBatchExpense[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @VersionColumn()
  version: number;
}
