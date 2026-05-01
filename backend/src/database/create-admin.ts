import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { Role } from '../common/enums/role.enum';

async function bootstrap() {
  process.env.DB_SYNCHRONIZE = 'true';
  process.env.DB_DROP_SCHEMA = 'false';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const usersService = app.get(UsersService);

    const email = 'admin@gmail.com';
    const password = '13663';

    try {
      const existingUser = await usersService.findByEmail(email);
      if (existingUser) {
        Logger.log(`User ${email} already exists.`);
      }
    } catch {
      await usersService.create({
        name: 'Super Admin',
        username: 'admin',
        email: email,
        password: password,
        role: Role.SUPER_ADMIN,
      });
      Logger.log(`Created admin user: ${email} / ${password}`, 'CreateAdmin');
    }
  } catch (error) {
    Logger.error('Error creating admin:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
