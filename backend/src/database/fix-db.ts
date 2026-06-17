import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env or .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in environment');
    return;
  }

  console.log('Connecting to database to fix enum issues...');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    console.log('Dropping stock_movements table...');
    await client.query('DROP TABLE IF EXISTS "stock_movements" CASCADE');

    console.log('Dropping stock_movements_type_enum...');
    await client.query(
      'DROP TYPE IF EXISTS "stock_movements_type_enum" CASCADE',
    );

    console.log(
      'Database cleanup successful. You can now start the server with npm run start:dev',
    );
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await client.end();
  }
}

run();
