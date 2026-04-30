import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SchemaSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaSyncService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    this.logger.log('--- DEFENSIVE SCHEMA SYNC START ---');
    try {
      // Attempt to select the column to see if it exists
      try {
        await this.dataSource.query('SELECT "currentStock" FROM products LIMIT 0');
        this.logger.log('Column "currentStock" already exists. No action needed.');
      } catch (err) {
        this.logger.log('Column "currentStock" is missing or inaccessible. Attempting to add it...');
        // We use a DO block to be extra safe against race conditions
        await this.dataSource.query(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='currentStock') THEN
              ALTER TABLE products ADD COLUMN "currentStock" DECIMAL(12,2) DEFAULT 0;
            END IF;
          END $$;
        `);
        this.logger.log('Successfully synchronized "currentStock" column.');
      }

      this.logger.log('--- DEFENSIVE SCHEMA SYNC COMPLETED ---');
    } catch (error) {
      this.logger.error('!!! DEFENSIVE SCHEMA SYNC FAILED !!!');
      this.logger.error(error.message);
    }
  }
}
