import { Client } from 'pg';

async function checkSchema() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_9ByhcsjYMR7H@ep-square-paper-an5uie01-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'currentStock';
    `);

    if (res.rows.length > 0) {
      console.log('SUCCESS: column "currentStock" exists.');
    } else {
      console.log('FAILURE: column "currentStock" does NOT exist.');
      
      console.log('Attempting manual fix...');
      await client.query('ALTER TABLE products ADD COLUMN "currentStock" DECIMAL(12,2) DEFAULT 0;');
      console.log('Manual fix applied.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkSchema();
