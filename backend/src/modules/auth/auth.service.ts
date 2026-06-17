import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ValidateUserDto } from './dto/validate-user.dto';
import * as bcrypt from 'bcrypt';
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(validateUserDto: ValidateUserDto): Promise<any> {
    try {
      const user = await this.usersService.findByIdentifier(
        validateUserDto.identifier,
      );
      if (!user) {
        this.logger.warn(
          `Login failed: User not found for identifier: ${validateUserDto.identifier}`,
        );
        return null;
      }

      if (!user.isActive) {
        this.logger.warn(`Login failed: User ${user.username} is inactive`);
        return null;
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
        `Login failed: Invalid password for user: ${user.username}`,
      );
      return null;
    } catch (error) {
      this.logger.error('Error during user validation:', error);
      return null;
    }
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
