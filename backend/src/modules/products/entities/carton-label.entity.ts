import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';
import { numericColumnTransformer } from '../../../common/database/numeric.transformer';

export enum CartonStatus {
  AVAILABLE = 'AVAILABLE',
  LOADED = 'LOADED',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED',
}

@Entity('carton_labels')
@Index(['cartonCode'], { unique: true })
@Index(['productId', 'status'])
@Index(['currentBatchId'])
export class CartonLabel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  cartonCode: string;

  @Column()
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ nullable: true })
  companyId: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 1,
    transformer: numericColumnTransformer,
  })
  packSize: number;

  @Column({
    type: 'enum',
    enum: CartonStatus,
    default: CartonStatus.AVAILABLE,
  })
  status: CartonStatus;

  @Column({ type: 'int', nullable: true })
  currentBatchId: number | null;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  printedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  scannedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
