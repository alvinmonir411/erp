import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DispatchBatch } from './dispatch-batch.entity';
import { Order } from '../../orders/entities/order.entity';
import { Product } from '../../products/entities/product.entity';
import { ColumnNumericTransformer } from '../../orders/orders.constants';
import { Company } from '../../companies/entities/company.entity';
import { Route } from '../../routes/entities/route.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { User } from '../../users/entities/user.entity';

@Entity('damage_records')
export class DamageRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  batchId?: number;

  @ManyToOne(() => DispatchBatch, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'batchId' })
  batch?: DispatchBatch;

  @Column({ nullable: true })
  orderId?: number;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column()
  productId: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  quantity: number;

  @Column({ nullable: true })
  companyId?: number;

  @ManyToOne(() => Company, { nullable: true })
  @JoinColumn({ name: 'companyId' })
  company?: Company;

  @Column({ nullable: true })
  routeId?: number;

  @ManyToOne(() => Route, { nullable: true })
  @JoinColumn({ name: 'routeId' })
  route?: Route;

  @Column({ nullable: true })
  shopId?: number;

  @ManyToOne(() => Shop, { nullable: true })
  @JoinColumn({ name: 'shopId' })
  shop?: Shop;

  @Column({ nullable: true, type: 'uuid' })
  assignedDeliveryManId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedDeliveryManId' })
  assignedDeliveryMan?: User;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;
}
