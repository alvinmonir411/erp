import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { numericColumnTransformer } from '../../../common/database/numeric.transformer';
import { Company } from '../../companies/entities/company.entity';
import { ProductUnit } from './product-unit.enum';

@Entity({ name: 'products' })
@Index(['companyId', 'sku'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  companyId: number;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 80 })
  sku: string;

  @Column({
    type: 'enum',
    enum: ProductUnit,
    default: ProductUnit.PCS,
  })
  unit: ProductUnit;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericColumnTransformer,
  })
  buyPrice: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericColumnTransformer,
  })
  salePrice: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  currentStock: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @VersionColumn()
  version: number;

  @ManyToOne(() => Company, (company) => company.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'companyId' })
  company: Company;
}
