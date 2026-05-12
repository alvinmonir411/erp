import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column()
  name: string;

  @Column({
    type: 'varchar',
    enum: Role,
    default: Role.SR,
  })
  role: Role;

  @Column({
    type: 'varchar',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ type: 'simple-array', nullable: true })
  allowedRouteIds: number[];

  get isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
