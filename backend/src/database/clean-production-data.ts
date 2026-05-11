import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

async function cleanProductionData() {
  if (process.env.NODE_ENV === 'production' && process.env.CLEAN_CONFIRM !== 'YES') {
    console.error('ERROR: You are attempting to run a destructive script in production.');
    console.error('To proceed, you must set CLEAN_CONFIRM=YES in your environment variables.');
    process.exit(1);
  }

  console.log('Starting database cleanup script...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  const tablesToClean = [
    'due_collections',
    'dues',
    'cash_collections',
    'damage_records',
    'delivery_summary_items',
    'delivery_summaries',
    'delivery_return_items',
    'delivery_returns',
    'dispatch_batch_items',
    'dispatch_batch_orders',
    'dispatch_batches',
    'order_items',
    'orders',
    'shops',
    'stock_movements',
    'purchase_items',
    'purchases',
    'delivery_people'
  ];

  try {
    // PostgreSQL TRUNCATE with RESTART IDENTITY and CASCADE safely wipes all data 
    // and resets auto-incrementing ID sequences, while cascading to foreign keys.
    const query = `TRUNCATE TABLE ${tablesToClean.join(', ')} RESTART IDENTITY CASCADE;`;
    
    console.log('Executing TRUNCATE query on transactional tables...');
    await dataSource.query(query);

    console.log('Successfully cleaned all transactional data.');
    console.log('Preserved tables: users, products, routes, companies.');
    
  } catch (error) {
    console.error('Failed to clean database:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

cleanProductionData();
