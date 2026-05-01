import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { Route } from '../../routes/entities/route.entity';
import { ColumnNumericTransformer } from '../../orders/orders.constants';

export enum DueStatus {
  DUE = 'DUE',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

@Entity('dues')
@Unique(['orderId'])
export class Due {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  shopId: number;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column({ nullable: true })
  routeId: number;

  @ManyToOne(() => Route)
  @JoinColumn({ name: 'routeId' })
  route: Route;

  @Column()
  srId: string;

  @Column()
  srName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  dueAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  paidAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  remainingDue: number;

  @Column({ type: 'enum', enum: DueStatus, default: DueStatus.DUE })
  status: DueStatus;
  
  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
