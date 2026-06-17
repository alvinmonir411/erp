import { Client } from 'pg';

const url =
  'postgresql://neondb_owner:npg_9ByhcsjYMR7H@ep-square-paper-an5uie01-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function verify() {
  const client = new Client({ connectionString: url });
  await client.connect();

  console.log('--- DATABASE VERIFICATION START ---');

  // 1. Check for dues with null routeId/shopId/srId
  const nulls = await client.query(`
    SELECT count(*) FROM dues 
    WHERE "routeId" IS NULL OR "shopId" IS NULL OR "srId" IS NULL
  `);
  console.log(`Dues with NULL fields: ${nulls.rows[0].count}`);

  // 2. Check for orders with dueAmount > 0 but no Due record
  const missingDues = await client.query(`
    SELECT count(*) FROM orders o
    LEFT JOIN dues d ON o.id = d."orderId"
    WHERE o."dueAmount" > 0 AND d.id IS NULL AND o.status = 'SETTLED'
  `);
  console.log(
    `Settled orders with dueAmount > 0 but NO Due record: ${missingDues.rows[0].count}`,
  );

  // 3. Check for duplicate dues
  const duplicates = await client.query(`
    SELECT "orderId", count(*) FROM dues
    GROUP BY "orderId" HAVING count(*) > 1
  `);
  console.log(`Duplicate due records (by orderId): ${duplicates.rows.length}`);

  // 4. Check for invalid collection amounts
  const invalidCollections = await client.query(`
    SELECT count(*) FROM due_collections WHERE "collectedAmount" <= 0
  `);
  console.log(
    `Collections with zero/negative amount: ${invalidCollections.rows[0].count}`,
  );

  // 5. Check if remainingDue matches math
  // (Note: This is complex if there are pending collections, but we check if remainingDue < 0)
  const negativeRemaining = await client.query(`
    SELECT count(*) FROM dues WHERE "remainingDue" < 0
  `);
  console.log(
    `Dues with negative remaining amount: ${negativeRemaining.rows[0].count}`,
  );

  console.log('--- DATABASE VERIFICATION COMPLETED ---');
  await client.end();
}

verify().catch(console.error);
