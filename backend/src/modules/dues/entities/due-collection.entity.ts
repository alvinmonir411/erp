import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Due } from './due.entity';
import { Order } from '../../orders/entities/order.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { Route } from '../../routes/entities/route.entity';
import { ColumnNumericTransformer } from '../../orders/orders.constants';

export enum CollectionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('due_collections')
export class DueCollection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dueId: number;

  @ManyToOne(() => Due)
  @JoinColumn({ name: 'dueId' })
  due: Due;

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
  collectedAmount: number;

  @Column({ type: 'date' })
  collectionDate: Date;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'enum', enum: CollectionStatus, default: CollectionStatus.PENDING })
  status: CollectionStatus;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  rejectedReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
