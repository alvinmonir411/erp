const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_9ByhcsjYMR7H@ep-square-paper-an5uie01-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected to DB');
  try {
    const { rows: orders } = await client.query(`
      SELECT o.id, o."orderDate", o."companyId", c.name as "companyName", o.status, o."grandTotal"
      FROM orders o
      LEFT JOIN companies c ON o."companyId" = c.id
      WHERE o."orderDate" = '2026-06-16'
    `);
    console.log('Orders on 2026-06-16:', orders);

    for (const order of orders) {
      const { rows: items } = await client.query(`
        SELECT oi.id, oi."productId", p.name as "productName", oi.quantity, oi."freeQuantity"
        FROM order_items oi
        LEFT JOIN products p ON oi."productId" = p.id
        WHERE oi."orderId" = $1
      `, [order.id]);
      console.log(`Items for order #${order.id} (${order.companyName}):`, items);
    }

    const { rows: batches } = await client.query(`
      SELECT b.id, b."batchNo", b."dispatchDate", b.status
      FROM dispatch_batches b
      WHERE b."dispatchDate" = '2026-06-16'
    `);
    console.log('Batches on 2026-06-16:', batches);

    for (const batch of batches) {
      const { rows: batchOrders } = await client.query(`
        SELECT bo.id, bo."orderId"
        FROM dispatch_batch_orders bo
        WHERE bo."batchId" = $1
      `, [batch.id]);
      console.log(`Orders in batch ${batch.batchNo}:`, batchOrders);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
