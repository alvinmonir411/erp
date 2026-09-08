import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { Purchase } from './purchase.entity';
import { numericColumnTransformer } from '../../../common/database/numeric.transformer';

export enum PaymentMethod {
  CASH = 'CASH',
  BANK = 'BANK',
  BKASH = 'BKASH',
  NAGAD = 'NAGAD',
  CHEQUE = 'CHEQUE',
  OTHER = 'OTHER',
}

@Entity('company_payments')
export class CompanyPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  companyId: number;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ nullable: true })
  purchaseId: number;

  @ManyToOne(() => Purchase, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchaseId' })
  purchase: Purchase;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericColumnTransformer,
  })
  amount: number;

  @Column({ type: 'date' })
  paymentDate: Date;

  @Column({
    type: 'varchar',
    length: 50,
    default: PaymentMethod.CASH,
  })
  paymentMethod: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  transactionRef: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'varchar', length: 100, nullable: true, default: 'Admin' })
  createdByName: string;

  @Column({ type: 'uuid', nullable: true })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
