import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Company } from '../../companies/entities/company.entity';
import { StockMovementType } from '../stock.constants';


@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  productId: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Index()
  @Column()
  companyId: number;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ type: 'enum', enum: StockMovementType })
  type: StockMovementType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number; // Positive for in, negative for out/damage

  @Column({ type: 'varchar', nullable: true })
  note: string;

  @Column({ type: 'varchar', nullable: true })
  reference: string; // Order ID, Invoice number, etc.

  @Column({ type: 'varchar', nullable: true })
  user: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  balanceAfter: number;

  @Column({ type: 'varchar', unique: true, nullable: true })
  idempotencyKey: string;

  @CreateDateColumn()
  createdAt: Date;
}
