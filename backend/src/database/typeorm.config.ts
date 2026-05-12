import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';

const createTypeOrmOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('database.url');
  const synchronize = configService.get<boolean>('database.synchronize', false);
  const dropSchema = configService.get<boolean>('database.dropSchema', false);

  return {
    type: 'postgres',
    url: databaseUrl,
    autoLoadEntities: true,
    synchronize: false,
    dropSchema,
    migrationsRun: false,
    ssl: { rejectUnauthorized: false },
  };
};

export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) =>
    createTypeOrmOptions(configService),
};
