import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import { types } from 'pg';

// Override pg driver parsing for OID 1114 (timestamp without time zone) to parse as UTC.
// This prevents timezone-offset shifts on local development machines running in non-UTC.
types.setTypeParser(1114, (stringValue) => {
  return new Date(stringValue.replace(' ', 'T') + 'Z');
});

const createTypeOrmOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('database.url');
  const synchronize = configService.get<boolean>('database.synchronize', false);
  const dropSchema = configService.get<boolean>('database.dropSchema', false);

  const isLocal =
    !databaseUrl ||
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1');

  return {
    type: 'postgres',
    url:
      databaseUrl ||
      process.env.DATABASE_URL ||
      'postgresql://neondb_owner:npg_9ByhcsjYMR7H@ep-square-paper-an5uie01-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
    autoLoadEntities: true,
    synchronize: false,
    dropSchema,
    migrationsRun: false,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    extra: {
      max: process.env.VERCEL ? 2 : 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 2000,
    },
  };
};

export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) =>
    createTypeOrmOptions(configService),
};
