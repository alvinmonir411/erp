import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DeliveryReturn } from './delivery-return.entity';
import { Product } from '../../products/entities/product.entity';
import { ColumnNumericTransformer } from '../../orders/orders.constants';

@Entity('delivery_return_items')
export class DeliveryReturnItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  deliveryReturnId: number;

  @ManyToOne(() => DeliveryReturn, (deliveryReturn) => deliveryReturn.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'deliveryReturnId' })
  deliveryReturn: DeliveryReturn;

  @Column()
  productId: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  dispatchedQuantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  returnedPaidQuantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  returnedFreeQuantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  damagedPaidQuantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  damagedFreeQuantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  deliveredPaidQuantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  deliveredFreeQuantity: number;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reason?: string;
}
