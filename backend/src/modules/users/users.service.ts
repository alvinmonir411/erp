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
import * as bcrypt from 'bcrypt';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('--- STARTING USER SEEDING ---');
    // Wait a brief moment for SchemaSyncService to ensure columns exist
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@erp.com';
    const adminUsername = process.env.SUPER_ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'password123';

    try {
      await this.createSuperAdmin({
        email: adminEmail,
        username: adminUsername,
        password: adminPassword,
        name: 'Super Admin',
      });
      this.logger.log(`Super Admin ensured: ${adminUsername} (${adminEmail})`);
    } catch (error) {
      this.logger.error('Failed to seed Super Admin:', error);
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

  async findByIdentifier(identifier: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: [{ email: identifier }, { username: identifier }],
    });
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

  async createSuperAdmin(data: {
    email: string;
    username: string;
    password: string;
    name: string;
  }): Promise<User> {
    const existing =
      (await this.findByIdentifier(data.email)) ||
      (await this.findByIdentifier(data.username));

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    if (existing) {
      // Always reset password on boot if existing
      existing.passwordHash = passwordHash;
      existing.role = Role.SUPER_ADMIN;
      existing.status = UserStatus.ACTIVE;
      return this.userRepository.save(existing);
    }

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
