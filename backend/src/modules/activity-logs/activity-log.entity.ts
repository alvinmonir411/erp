import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ActivityCategory {
  DELIVERY = 'DELIVERY',
  ORDERS = 'ORDERS',
  COLLECTIONS = 'COLLECTIONS',
  STOCK = 'STOCK',
  PURCHASES = 'PURCHASES',
  AUTH = 'AUTH',
  SYSTEM = 'SYSTEM',
}

@Entity('activity_logs')
@Index(['category', 'createdAt'])
@Index(['entityType', 'entityId'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ActivityCategory,
    default: ActivityCategory.SYSTEM,
  })
  category: ActivityCategory;

  @Column({ type: 'varchar', length: 100 })
  action: string; // e.g. BATCH_SETTLED, ORDER_CREATED, DUE_APPROVED, LOGIN, STOCK_ADJUSTMENT

  @Column({ type: 'varchar', length: 50, nullable: true })
  entityType?: string; // 'BATCH', 'ORDER', 'DUE_COLLECTION', 'PRODUCT', etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  entityId?: string; // e.g. "108", "236"

  @Column({ type: 'varchar', length: 255 })
  title: string; // Short human-readable title

  @Column({ type: 'text', nullable: true })
  description?: string; // Detailed text description

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>; // Arbitrary metadata/amounts

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  userName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  userRole?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
