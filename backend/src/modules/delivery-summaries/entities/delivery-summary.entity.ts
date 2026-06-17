import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Route } from '../../routes/entities/route.entity';
import { DeliverySummaryItem } from './delivery-summary-item.entity';
import { ColumnNumericTransformer } from '../../orders/orders.constants';

export enum DeliverySummaryStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
}

@Entity('delivery_summaries')
export class DeliverySummary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', nullable: true })
  deliveryDate: Date;

  @Column({ nullable: true })
  companyId: number;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ nullable: true })
  routeId: number;

  @ManyToOne(() => Route)
  @JoinColumn({ name: 'routeId' })
  route: Route;

  @Column({
    type: 'enum',
    enum: DeliverySummaryStatus,
    default: DeliverySummaryStatus.DRAFT,
  })
  status: DeliverySummaryStatus;

  @Column({ default: false })
  morningPrinted: boolean;

  @Column({ default: false })
  finalPrinted: boolean;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @OneToMany(() => DeliverySummaryItem, (item) => item.summary, {
    cascade: true,
  })
  items: DeliverySummaryItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
