import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const dataSource = app.get(DataSource);
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    Logger.log('Starting selective database reset...', 'DatabaseReset');

    // Tables to clear (Transactions)
    const tablesToTruncate = [
      'delivery_summary_items',
      'delivery_summaries',
      'sale_items',
      'sale_payments',
      'sales',
      'purchase_items',
      'purchase_payments',
      'purchases',
      'stock_movements',
    ];

    for (const table of tablesToTruncate) {
      await queryRunner.query(
        `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`,
      );
      Logger.log(`Truncated table: ${table}`, 'DatabaseReset');
    }

    await queryRunner.commitTransaction();
    Logger.warn(
      'Database reset completed. Cleared transactions but kept Master Data (Routes, Shops, Companies, Products) and Users.',
      'DatabaseReset',
    );
  } catch (err) {
    Logger.error('Error during reset:', err, 'DatabaseReset');
    await queryRunner.rollbackTransaction();
  } finally {
    await queryRunner.release();
    await app.close();
  }
}

void bootstrap();
