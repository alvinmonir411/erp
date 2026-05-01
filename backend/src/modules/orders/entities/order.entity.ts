import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Route } from '../../routes/entities/route.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { Product } from '../../products/entities/product.entity';
import { DiscountType, OrderStatus, ColumnNumericTransformer } from '../orders.constants';
import { DeliveryPerson } from '../../delivery-ops/entities/delivery-person.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  orderDate: Date;

  @Column()
  companyId: number;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column()
  routeId: number;

  @ManyToOne(() => Route)
  @JoinColumn({ name: 'routeId' })
  route: Route;

  @Column({ nullable: true })
  deliveryPersonId?: number;

  @ManyToOne(() => DeliveryPerson, { nullable: true })
  @JoinColumn({ name: 'deliveryPersonId' })
  deliveryPerson?: DeliveryPerson;

  @Column({ type: 'varchar', length: 120, nullable: true })
  marketArea?: string;

  @Column({ nullable: true })
  shopId?: number;

  @ManyToOne(() => Shop, { nullable: true })
  @JoinColumn({ name: 'shopId' })
  shop?: Shop;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  discountAmount: number;

  @Column({ type: 'enum', enum: DiscountType, default: DiscountType.FIXED })
  discountType: DiscountType;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  discountValue: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  grandTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  advancePaid: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  actualSoldAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  collectedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  dueAmount: number;

  @Column({ type: 'timestamp', nullable: true })
  dispatchedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  settledAt?: Date;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.CONFIRMED })
  status: OrderStatus;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ default: 'Admin' })
  createdBy: string;

  @Column({ nullable: true })
  createdById: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  createdByRole: string;

  @Column({ type: 'text', nullable: true })
  settlementNote?: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  productId: number;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  freeQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  discountAmount: number;

  @Column({ type: 'enum', enum: DiscountType, default: DiscountType.FIXED })
  discountType: DiscountType;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  discountValue: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  lineTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  deliveredQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  returnedQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  damagedQuantity: number;
}
