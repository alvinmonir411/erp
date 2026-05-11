/**
 * cleanup-test-data.js  (CommonJS — run with: node cleanup-test-data.js)
 *
 * Deletes:
 *   • ALL transactional data: orders, dispatches, deliveries, stock, dues, shops
 *   • Products belonging to test companies only
 *   • The test companies themselves (TC*, TESTC* codes / "test" in name)
 *
 * KEEPS: Real companies + real products — untouched.
 */

'use strict';

const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_9ByhcsjYMR7H@ep-square-paper-an5uie01-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('\n✅ Connected to database\n');

  try {
    // ── Find test companies ──────────────────────────────────────
    const { rows: testCompanies } = await client.query(`
      SELECT id, name, code FROM companies
       WHERE LOWER(name) LIKE '%test%'
          OR code ILIKE 'TC%'
          OR code ILIKE 'TESTC%'
       ORDER BY id
    `);

    console.log('🔍 Test companies to delete:');
    testCompanies.forEach((c) => console.log(`   ID=${c.id}  name="${c.name}"  code="${c.code}"`));

    const testIds = testCompanies.map((c) => c.id);

    if (testIds.length === 0) {
      console.log('\n⚠️  No test companies found. Nothing to delete.');
      await client.end();
      return;
    }

    // ── BEGIN transaction ────────────────────────────────────────
    await client.query('BEGIN');

    const tables = [
      // deepest children first
      ['damage_records',            'DELETE FROM damage_records',                             []],
      ['delivery_returns',          'DELETE FROM delivery_returns',                           []],
      ['cash_collections',          'DELETE FROM cash_collections',                           []],
      ['dispatch_batch_items',      'DELETE FROM dispatch_batch_items',                       []],
      ['dispatch_batch_orders',     'DELETE FROM dispatch_batch_orders',                      []],
      ['dispatch_batches',          'DELETE FROM dispatch_batches',                           []],
      ['delivery_summaries',        'DELETE FROM delivery_summaries',                         []],
      ['delivery_people',           'DELETE FROM delivery_people',                            []],
      ['order_items',               'DELETE FROM order_items',                                []],
      ['orders',                    'DELETE FROM orders',                                     []],
      ['stock_movements',           'DELETE FROM stock_movements',                            []],
      ['purchases',                 'DELETE FROM purchases',                                  []],
      ['dues',                      'DELETE FROM dues',                                       []],
      ['shops',                     'DELETE FROM shops',                                      []],
      ['products (test only)',      'DELETE FROM products WHERE "companyId" = ANY($1::int[])', [testIds]],
      ['companies (test only)',     'DELETE FROM companies WHERE id = ANY($1::int[])',         [testIds]],
    ];

    for (const [label, sql, params] of tables) {
      try {
        const result = await client.query(sql, params);
        console.log(`  🗑️  ${label}: ${result.rowCount} rows deleted`);
      } catch (e) {
        if (e.message && e.message.includes('does not exist')) {
          console.log(`  ⏭️  ${label}: table not found, skipping`);
        } else {
          throw e;
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ COMMIT — all test data deleted!\n');

    // ── Show remaining data ──────────────────────────────────────
    const { rows: companies } = await client.query('SELECT id, name, code FROM companies ORDER BY id');
    console.log('📦 Remaining companies:');
    console.table(companies);

    const { rows: products } = await client.query(`
      SELECT p.id, p.name, c.name AS company
        FROM products p
        JOIN companies c ON c.id = p."companyId"
       ORDER BY p.id
    `);
    console.log(`📦 Remaining products: ${products.length} total`);
    if (products.length <= 30) console.table(products);
    else console.log(`   (too many to display — first 30 shown)`), console.table(products.slice(0, 30));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR — rolled back:\n', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Connection closed.');
  }
}

main();
