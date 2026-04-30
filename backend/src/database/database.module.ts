import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './typeorm.config';
import { SchemaSyncService } from './schema-sync.service';

@Module({
  imports: [TypeOrmModule.forRootAsync(typeOrmConfig)],
  providers: [SchemaSyncService],
})
export class DatabaseModule {}
