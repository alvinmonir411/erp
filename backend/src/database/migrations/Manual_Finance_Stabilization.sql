
-- ERP Finance Module Stabilization Migration
-- Use this script in your production database (e.g., Neon SQL Editor)

-- 1. Ensure Finance Tables Exist
CREATE TABLE IF NOT EXISTS "dues" (
    "id" SERIAL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "shopId" INTEGER NOT NULL,
    "routeId" INTEGER,
    "srId" VARCHAR(255) NOT NULL,
    "srName" VARCHAR(255) NOT NULL,
    "dueAmount" DECIMAL(12,2) DEFAULT 0,
    "paidAmount" DECIMAL(12,2) DEFAULT 0,
    "remainingDue" DECIMAL(12,2) DEFAULT 0,
    "status" VARCHAR(50) DEFAULT 'DUE',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "due_collections" (
    "id" SERIAL PRIMARY KEY,
    "dueId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "shopId" INTEGER NOT NULL,
    "routeId" INTEGER,
    "srId" VARCHAR(255) NOT NULL,
    "srName" VARCHAR(255) NOT NULL,
    "collectedAmount" DECIMAL(12,2) DEFAULT 0,
    "collectionDate" DATE NOT NULL,
    "note" TEXT,
    "status" VARCHAR(50) DEFAULT 'PENDING',
    "approvedBy" VARCHAR(255),
    "approvedAt" TIMESTAMP,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add Missing Columns to Existing Tables
DO $$ 
BEGIN 
    -- Users: Allowed Routes for Managers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='allowedRouteIds') THEN
        ALTER TABLE "users" ADD COLUMN "allowedRouteIds" TEXT;
    END IF;

    -- Delivery Return Items: Paid vs Free splits
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_return_items' AND column_name='paidReturnedQuantity') THEN
        ALTER TABLE "delivery_return_items" ADD COLUMN "paidReturnedQuantity" DECIMAL(12,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_return_items' AND column_name='freeReturnedQuantity') THEN
        ALTER TABLE "delivery_return_items" ADD COLUMN "freeReturnedQuantity" DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- 3. Cleanup Duplicates and Add Unique Constraint
-- Delete all but the newest duplicate due record per order
DELETE FROM dues a USING dues b
WHERE a.id < b.id AND a."orderId" = b."orderId";

-- Add the unique constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_due_order_id') THEN
        ALTER TABLE "dues" ADD CONSTRAINT "unique_due_order_id" UNIQUE ("orderId");
    END IF;
END $$;

-- 4. Backfill missing relation IDs in dues
UPDATE dues d
SET 
    "routeId" = COALESCE(d."routeId", o."routeId"),
    "shopId" = COALESCE(d."shopId", o."shopId"),
    "srId" = COALESCE(d."srId", o."createdById"),
    "srName" = COALESCE(d."srName", o."createdBy")
FROM orders o
WHERE d."orderId" = o.id
AND (d."routeId" IS NULL OR d."shopId" IS NULL OR d."srId" IS NULL);

-- 5. Final Status Consistency Check
UPDATE dues SET status = 'PAID' WHERE "remainingDue" <= 0 AND status != 'PAID';
UPDATE dues SET status = 'PARTIAL' WHERE "remainingDue" > 0 AND "paidAmount" > 0 AND status != 'PARTIAL';
UPDATE dues SET status = 'DUE' WHERE "remainingDue" > 0 AND "paidAmount" = 0 AND status != 'DUE';
