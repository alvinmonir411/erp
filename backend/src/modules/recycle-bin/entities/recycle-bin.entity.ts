import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum RecycleBinStatus {
  DELETED = 'DELETED',
  RESTORED = 'RESTORED',
}

export enum RecycleBinEntityType {
  ORDER = 'ORDER',
  DISPATCH_BATCH = 'DISPATCH_BATCH',
  DUE = 'DUE',
}

@Entity('recycle_bin')
@Index(['entityType', 'entityId'])
@Index(['status', 'createdAt'])
export class RecycleBinItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  entityType: RecycleBinEntityType | string;

  @Column({ type: 'int' })
  entityId: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  entityNumber: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  shopName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  routeName: string;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  dueAmount: number;

  @Column({ type: 'int', default: 0 })
  itemCount: number;

  @Column({ type: 'jsonb' })
  snapshot: any;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deletedById: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  deletedByName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deletedByRole: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: RecycleBinStatus.DELETED,
  })
  status: RecycleBinStatus | string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  restoredAt: Date;

  @Column({ type: 'varchar', length: 150, nullable: true })
  restoredByName: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
