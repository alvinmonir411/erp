import { DataSource } from 'typeorm';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function resetDatabase() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Starting database reset...');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query('TRUNCATE TABLE delivery_summary_items RESTART IDENTITY CASCADE');
    await queryRunner.query('TRUNCATE TABLE delivery_summaries RESTART IDENTITY CASCADE');
    await queryRunner.query('TRUNCATE TABLE sale_items RESTART IDENTITY CASCADE');
    await queryRunner.query('TRUNCATE TABLE sale_payments RESTART IDENTITY CASCADE');
    await queryRunner.query('TRUNCATE TABLE sales RESTART IDENTITY CASCADE');
    await queryRunner.query('TRUNCATE TABLE purchase_items RESTART IDENTITY CASCADE');
    await queryRunner.query('TRUNCATE TABLE purchase_payments RESTART IDENTITY CASCADE');
    await queryRunner.query('TRUNCATE TABLE purchases RESTART IDENTITY CASCADE');
    await queryRunner.query('TRUNCATE TABLE stock_movements RESTART IDENTITY CASCADE');

    await queryRunner.commitTransaction();
    console.log('Database reset successful! Kept: Routes, Shops, Companies, Products, and Users.');
  } catch (err) {
    console.error('Error during reset:', err);
    await queryRunner.rollbackTransaction();
  } finally {
    await queryRunner.release();
    await app.close();
  }
}

resetDatabase();
