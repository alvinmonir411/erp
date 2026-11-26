import {
  Injectable,
  ConflictException,
  NotFoundException,
  OnApplicationBootstrap,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  onApplicationBootstrap() {
    // Run asynchronously in the background so serverless cold start is instantaneous
    void this.seedInitialUsersSafely();
  }

  private async seedInitialUsersSafely() {
    try {
      const superAdminCount = await this.userRepository.count({
        where: { role: Role.SUPER_ADMIN },
      });

      if (superAdminCount === 0) {
        const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@erp.com';
        const adminUsername = process.env.SUPER_ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'password123';

        await this.createSuperAdmin({
          email: adminEmail,
          username: adminUsername,
          password: adminPassword,
          name: 'Super Admin',
        });
        this.logger.log(`Super Admin seeded: ${adminUsername} (${adminEmail})`);
      } else {
        this.logger.log(
          `Found ${superAdminCount} Super Admin account(s); preserving existing credentials.`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to verify/seed Super Admin:', error);
    }

    try {
      const deliveryMen = await this.userRepository.find({
        where: { role: Role.DELIVERY_MAN },
      });
      if (deliveryMen.length === 0) {
        this.logger.log('No delivery men found. Seeding a default delivery man user...');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password123', salt);
        const defaultDeliveryMan = this.userRepository.create({
          email: 'delivery1@erp.com',
          username: 'delivery1',
          name: 'Delivery Man 1',
          passwordHash,
          role: Role.DELIVERY_MAN,
          status: UserStatus.ACTIVE,
        });
        await this.userRepository.save(defaultDeliveryMan);
        this.logger.log('Default delivery man seeded: delivery1 / password123');
      } else {
        this.logger.log(`Found ${deliveryMen.length} delivery men in database.`);
      }
    } catch (err) {
      this.logger.error('Failed to seed delivery man:', err);
    }
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingEmail = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingUsername = await this.userRepository.findOne({
      where: { username: createUserDto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    const { status, isActive, password, ...rest } = createUserDto;

    const user = this.userRepository.create({
      ...rest,
      passwordHash,
      status:
        status ||
        (isActive === false ? UserStatus.INACTIVE : UserStatus.ACTIVE),
    });

    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find({
      select: [
        'id',
        'email',
        'username',
        'name',
        'role',
        'status',
        'createdAt',
        'updatedAt',
      ],
      order: { createdAt: 'DESC' },
    });

    // Manually add isActive since it's a getter and won't be serialized in plain objects
    return users.map((user) => ({
      ...user,
      isActive: user.isActive,
    })) as any;
  }

  async findByRole(role: Role): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { role },
      select: ['id', 'email', 'username', 'name', 'role', 'status'],
      order: { name: 'ASC' },
    });
    return users.map((user) => ({
      ...user,
      isActive: user.isActive,
    })) as any;
  }

  async findActiveDeliveryMen(): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { role: Role.DELIVERY_MAN, status: UserStatus.ACTIVE },
      select: ['id', 'email', 'username', 'name', 'role', 'status'],
      order: { name: 'ASC' },
    });

    return users.map((user) => ({
      ...user,
      isActive: user.isActive,
    })) as any;
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async findByIdentifier(rawIdentifier: string): Promise<User | null> {
    const identifier = rawIdentifier?.trim();
    if (!identifier) {
      return null;
    }

    // 1. Prefer exact email match, then exact username match
    const exactEmail = await this.userRepository.findOne({
      where: { email: identifier },
    });
    if (exactEmail) return exactEmail;

    const exactUsername = await this.userRepository.findOne({
      where: { username: identifier },
    });
    if (exactUsername) return exactUsername;

    // 2. Fallback to case-insensitive lookup (prefer active accounts first)
    const ciEmail = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:identifier)', { identifier })
      .orderBy("CASE WHEN user.status = 'ACTIVE' THEN 0 ELSE 1 END", 'ASC')
      .getOne();
    if (ciEmail) return ciEmail;

    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.username) = LOWER(:identifier)', { identifier })
      .orderBy("CASE WHEN user.status = 'ACTIVE' THEN 0 ELSE 1 END", 'ASC')
      .getOne();
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existing) {
        throw new ConflictException('Email already exists');
      }
      user.email = updateUserDto.email;
    }

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existing = await this.userRepository.findOne({
        where: { username: updateUserDto.username },
      });
      if (existing) {
        throw new ConflictException('Username already exists');
      }
      user.username = updateUserDto.username;
    }

    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(updateUserDto.password, salt);
    }

    if (updateUserDto.name) user.name = updateUserDto.name;
    if (updateUserDto.role) user.role = updateUserDto.role;

    if (updateUserDto.status) {
      user.status = updateUserDto.status;
    } else if (updateUserDto.isActive !== undefined) {
      user.status = updateUserDto.isActive
        ? UserStatus.ACTIVE
        : UserStatus.INACTIVE;
    }

    return this.userRepository.save(user);
  }

  async createSuperAdmin(
    data: {
      email: string;
      username: string;
      password: string;
      name: string;
    },
    resetIfExists = false,
  ): Promise<User> {
    const existing =
      (await this.findByIdentifier(data.email)) ||
      (await this.findByIdentifier(data.username));

    if (existing) {
      if (resetIfExists || !existing.passwordHash) {
        const salt = await bcrypt.genSalt(10);
        existing.passwordHash = await bcrypt.hash(data.password, salt);
        existing.role = Role.SUPER_ADMIN;
        existing.status = UserStatus.ACTIVE;
        return this.userRepository.save(existing);
      }
      return existing;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = this.userRepository.create({
      email: data.email,
      username: data.username,
      name: data.name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    });

    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    console.log(`[UsersService] Deleting user with ID: ${id}`);
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    console.log(`[UsersService] User deleted successfully`);
  }
}
