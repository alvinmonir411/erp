import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env or .env.local
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '../../../.env') });
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in environment');
    process.exit(1);
  }

  console.log('Connecting to database for 5-decimal pricing migration...');

  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1');

  const client = new Client({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected successfully. Altering column data types to NUMERIC(14, 5)...');

    // 1. Products buyPrice & salePrice
    await client.query(`
      ALTER TABLE "products" 
        ALTER COLUMN "buyPrice" TYPE NUMERIC(14, 5),
        ALTER COLUMN "salePrice" TYPE NUMERIC(14, 5);
    `);
    console.log('✓ products.buyPrice and products.salePrice updated to NUMERIC(14, 5)');

    // 2. Order items unitPrice
    await client.query(`
      ALTER TABLE "order_items" 
        ALTER COLUMN "unitPrice" TYPE NUMERIC(14, 5);
    `);
    console.log('✓ order_items.unitPrice updated to NUMERIC(14, 5)');

    // 3. Purchase items unitCost (if table exists)
    try {
      await client.query(`
        ALTER TABLE "purchase_items" 
          ALTER COLUMN "unitCost" TYPE NUMERIC(14, 5);
      `);
      console.log('✓ purchase_items.unitCost updated to NUMERIC(14, 5)');
    } catch (e: any) {
      console.log('- purchase_items update skipped/not found:', e.message);
    }

    // 4. Delivery summary items unitPrice (if table exists)
    try {
      await client.query(`
        ALTER TABLE "delivery_summary_items" 
          ALTER COLUMN "unitPrice" TYPE NUMERIC(14, 5);
      `);
      console.log('✓ delivery_summary_items.unitPrice updated to NUMERIC(14, 5)');
    } catch (e: any) {
      console.log('- delivery_summary_items update skipped/not found:', e.message);
    }

    console.log('\n✅ 5-Decimal Unit Pricing (numeric(14, 5)) migration completed successfully!');
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
