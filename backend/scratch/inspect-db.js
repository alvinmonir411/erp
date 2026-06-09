const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_9ByhcsjYMR7H@ep-square-paper-an5uie01-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected to DB');
  try {
    const targetOrderId = 123;
    console.log(`Checking database rows for order ID ${targetOrderId}`);
    
    // Check dispatch_batch_orders
    const { rows: batchOrders } = await client.query('SELECT * FROM dispatch_batch_orders WHERE "orderId" = $1', [targetOrderId]);
    console.log('dispatch_batch_orders:', batchOrders);

    if (batchOrders.length > 0) {
      for (const bo of batchOrders) {
        console.log(`Checking for dispatch_batch_orders ID ${bo.id}`);
        const { rows: cashCollections } = await client.query('SELECT * FROM cash_collections WHERE "batchOrderId" = $1', [bo.id]);
        console.log(`  cash_collections for batchOrderId ${bo.id}:`, cashCollections);

        const { rows: deliveryReturns } = await client.query('SELECT * FROM delivery_returns WHERE "batchOrderId" = $1', [bo.id]);
        console.log(`  delivery_returns for batchOrderId ${bo.id}:`, deliveryReturns);
      }
    }

    // Check damage_records
    const { rows: damages } = await client.query('SELECT * FROM damage_records WHERE "orderId" = $1', [targetOrderId]);
    console.log('damage_records:', damages);

    // Check dues
    const { rows: dues } = await client.query('SELECT * FROM dues WHERE "orderId" = $1', [targetOrderId]);
    console.log('dues:', dues);

    // Check due_collections
    const { rows: dueCollections } = await client.query('SELECT * FROM due_collections WHERE "orderId" = $1', [targetOrderId]);
    console.log('due_collections:', dueCollections);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
