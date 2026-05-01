
import { Client } from 'pg';

const url = 'postgresql://neondb_owner:npg_9ByhcsjYMR7H@ep-square-paper-an5uie01-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function backfill() {
  const client = new Client({ connectionString: url });
  await client.connect();
  
  console.log('--- FINANCE BACKFILL START ---');

  // 1. Fill missing routeId, shopId, srId in dues from orders
  console.log('Updating missing relations in dues...');
  await client.query(`
    UPDATE dues d
    SET 
      "routeId" = COALESCE(d."routeId", o."routeId"),
      "shopId" = COALESCE(d."shopId", o."shopId"),
      "srId" = COALESCE(d."srId", o."createdById"),
      "srName" = COALESCE(d."srName", o."createdBy")
    FROM orders o
    WHERE d."orderId" = o.id
    AND (d."routeId" IS NULL OR d."shopId" IS NULL OR d."srId" IS NULL OR d."srName" IS NULL)
  `);

  // 2. Create missing due records for settled orders with dueAmount > 0
  console.log('Creating missing due records...');
  await client.query(`
    INSERT INTO dues ("orderId", "shopId", "routeId", "srId", "srName", "dueAmount", "paidAmount", "remainingDue", "status")
    SELECT 
      o.id, o."shopId", o."routeId", o."createdById", o."createdBy", 
      o."dueAmount", 0, o."dueAmount", 'DUE'
    FROM orders o
    LEFT JOIN dues d ON o.id = d."orderId"
    WHERE o."status" = 'SETTLED' 
    AND o."dueAmount" > 0 
    AND d.id IS NULL
  `);

  // 3. Remove duplicate dues (keep newest)
  console.log('Cleaning duplicate dues...');
  await client.query(`
    DELETE FROM dues a USING dues b
    WHERE a.id < b.id AND a."orderId" = b."orderId"
  `);

  // 4. Update status consistency
  console.log('Updating status consistency...');
  await client.query(`
    UPDATE dues SET status = 'PAID' WHERE "remainingDue" <= 0 AND status != 'PAID';
    UPDATE dues SET status = 'PARTIAL' WHERE "remainingDue" > 0 AND "paidAmount" > 0 AND status != 'PARTIAL';
    UPDATE dues SET status = 'DUE' WHERE "remainingDue" > 0 AND "paidAmount" = 0 AND status != 'DUE';
  `);

  console.log('--- FINANCE BACKFILL COMPLETED ---');
  await client.end();
}

backfill().catch(console.error);
