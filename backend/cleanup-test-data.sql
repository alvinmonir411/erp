-- ============================================================
--  SAFE TEST DATA CLEANUP SCRIPT
--  Removes: Test Companies + their products, ALL transactional
--  data (orders, dispatch, delivery, stock, dues, reports)
--  Preserves: Real companies, real products
-- ============================================================

BEGIN;

-- ── STEP 1: Identify test company IDs ────────────────────────
-- We target companies whose code starts with 'TC' or 'TESTC'
-- or whose name contains 'Test'. Adjust if needed.
DO $$
DECLARE
  test_company_ids INT[];
BEGIN
  SELECT ARRAY_AGG(id)
    INTO test_company_ids
    FROM companies
   WHERE LOWER(name) LIKE '%test%'
      OR code ILIKE 'TC%'
      OR code ILIKE 'TESTC%';

  RAISE NOTICE 'Test company IDs to be deleted: %', test_company_ids;
END $$;

-- ── STEP 2: Delete ALL transactional / operational data ───────
-- Order matters: child tables before parent tables.

-- Delivery ops (deepest children first)
DELETE FROM damage_records;
DELETE FROM delivery_returns;
DELETE FROM cash_collections;
DELETE FROM dispatch_batch_items;
DELETE FROM dispatch_batch_orders;
DELETE FROM dispatch_batches;
DELETE FROM delivery_people;

-- Orders & order items
DELETE FROM order_items;
DELETE FROM orders;

-- Stock & purchases
DELETE FROM stock_movements;
DELETE FROM purchases;

-- Dues & summaries
DELETE FROM dues;
DELETE FROM delivery_summaries;

-- Shops (customer shops)
DELETE FROM shops;

-- Reports (if stored in DB)
-- DELETE FROM reports;  -- uncomment if you have a reports table

-- ── STEP 3: Delete test company products only ─────────────────
-- Keeps products that belong to real (non-test) companies
DELETE FROM products
 WHERE "companyId" IN (
   SELECT id FROM companies
    WHERE LOWER(name) LIKE '%test%'
       OR code ILIKE 'TC%'
       OR code ILIKE 'TESTC%'
 );

-- ── STEP 4: Delete the test companies themselves ──────────────
DELETE FROM companies
 WHERE LOWER(name) LIKE '%test%'
    OR code ILIKE 'TC%'
    OR code ILIKE 'TESTC%';

-- ── STEP 5: Verify what remains ───────────────────────────────
SELECT 'Remaining companies:' AS info, id, name, code FROM companies;
SELECT 'Remaining products:' AS info, id, name, "companyId" FROM products;

COMMIT;
