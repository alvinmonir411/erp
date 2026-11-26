import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ValidateUserDto } from './dto/validate-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(validateUserDto: ValidateUserDto): Promise<any> {
    const identifier = validateUserDto.identifier?.trim();
    if (!identifier) {
      throw new UnauthorizedException({
        message: 'Please enter your email or username.',
        code: 'INVALID_IDENTIFIER',
      });
    }

    const user = await this.usersService.findByIdentifier(identifier);
    if (!user) {
      this.logger.warn(
        `Login failed: User not found for identifier: ${identifier}`,
      );
      throw new UnauthorizedException({
        message: 'No account found with that email or username.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.isActive) {
      this.logger.warn(`Login failed: User ${user.username} is inactive`);
      throw new UnauthorizedException({
        message:
          'Your account is currently deactivated. Please contact Super Admin.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    if (!user.passwordHash) {
      this.logger.warn(`Login failed: User ${user.username} has no password set`);
      throw new UnauthorizedException({
        message:
          'Password is not configured for this account. Please contact Super Admin.',
        code: 'PASSWORD_NOT_SET',
      });
    }

    const isMatch = await bcrypt.compare(
      validateUserDto.password,
      user.passwordHash,
    );
    if (isMatch) {
      const { passwordHash, ...result } = user;
      // Explicitly add isActive since it's a getter and won't be serialized automatically
      return { ...result, isActive: user.isActive };
    }

    this.logger.warn(
      `Login failed: Invalid password for user: ${user.username || user.email}`,
    );
    throw new UnauthorizedException({
      message: 'Incorrect password. Please double-check and try again.',
      code: 'INVALID_PASSWORD',
    });
  }

  async login(user: any) {
    const payload = {
      email: user.email,
      username: user.username,
      sub: user.id,
      role: user.role,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }
}
