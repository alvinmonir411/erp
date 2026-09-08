import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Product } from '../../products/entities/product.entity';
import { numericColumnTransformer } from '../../../common/database/numeric.transformer';

import { CompanyPayment } from './company-payment.entity';

export enum PurchaseStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  purchaseDate: Date;

  @Column({ length: 50, unique: true })
  invoiceNo: string;

  @Column()
  companyId: number;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ length: 200, nullable: true })
  supplierName?: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  totalAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  paidAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  dueAmount: number;

  @Column({
    type: 'enum',
    enum: PurchaseStatus,
    default: PurchaseStatus.DRAFT,
  })
  status: PurchaseStatus;

  @Column({ nullable: true })
  paymentId?: number | null;

  @ManyToOne(() => CompanyPayment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paymentId' })
  payment?: CompanyPayment | null;

  @Column({ length: 150, nullable: true })
  warehouseName?: string | null;

  @Column({ length: 100, nullable: true })
  vehicleNo?: string | null;

  @Column({ length: 150, nullable: true })
  driverName?: string | null;

  @Column({ length: 100, nullable: true })
  supplierInvoiceNo?: string | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @OneToMany(() => PurchaseItem, (item) => item.purchase, { cascade: true })
  items: PurchaseItem[];

  @OneToMany(() => CompanyPayment, (payment) => payment.purchase)
  payments: CompanyPayment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('purchase_items')
export class PurchaseItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  purchaseId: number;

  @ManyToOne(() => Purchase, (purchase) => purchase.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchaseId' })
  purchase: Purchase;

  @Column()
  productId: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericColumnTransformer,
  })
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericColumnTransformer,
  })
  unitCost: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericColumnTransformer,
  })
  lineTotal: number;
}
