import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DeliverySummary } from './delivery-summary.entity';
import { Product } from '../../products/entities/product.entity';
import { ColumnNumericTransformer } from '../../orders/orders.constants';

@Entity('delivery_summary_items')
export class DeliverySummaryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  summaryId: number;

  @ManyToOne(() => DeliverySummary, (summary) => summary.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'summaryId' })
  summary: DeliverySummary;

  @Column({ nullable: true })
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
  orderedQuantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  returnedQuantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  soldQuantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  unitPrice: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  lineTotal: number;
}
