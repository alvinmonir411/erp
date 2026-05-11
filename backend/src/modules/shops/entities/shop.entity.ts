import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Route } from '../../routes/entities/route.entity';
@Entity({ name: 'shops' })
@Index(['routeId', 'name'])
export class Shop {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  routeId: number;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  ownerName: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Index()
  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Route, (route) => route.shops, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'routeId' })
  route: Route;
  @Column()
  companyId: number;

  @VersionColumn()
  version: number;
}
