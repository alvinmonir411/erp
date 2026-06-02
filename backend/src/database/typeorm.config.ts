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
