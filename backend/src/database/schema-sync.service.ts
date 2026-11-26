import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SchemaSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaSyncService.name);

  constructor(private readonly dataSource: DataSource) {}

  onApplicationBootstrap() {
    // Run asynchronously in the background so serverless cold start is instantaneous (< 300ms)
    void this.runSyncSafely();
  }

  private async runSyncSafely() {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      this.logger.warn('DataSource not initialized yet. Skipping schema sync.');
      return;
    }

    try {
      this.logger.log('--- DEFENSIVE SCHEMA SYNC START ---');

    // 1. Sync products table
    try {
      this.logger.log('Ensuring products table columns exist...');
      await this.dataSource.query(`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "currentStock" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "defaultCartonSize" DECIMAL(10,2) DEFAULT 1;
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "freeSchemeBuyQty" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "freeSchemeFreeQty" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cartonBarcodePrefix" VARCHAR(50);
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
        ALTER TABLE "products" ALTER COLUMN "buyPrice" TYPE NUMERIC(14, 5);
        ALTER TABLE "products" ALTER COLUMN "salePrice" TYPE NUMERIC(14, 5);
        ALTER TABLE "order_items" ALTER COLUMN "unitPrice" TYPE NUMERIC(14, 5);
      `);
    } catch (e) {
      if (!e.message.includes('does not exist')) {
        this.logger.error('Failed to sync products columns:', e.message);
      }
    }

    // 1.5. Ensure companies table exists
    try {
      this.logger.log('Ensuring companies table exists...');
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "companies" (
          "id" SERIAL PRIMARY KEY,
          "name" VARCHAR(150) NOT NULL,
          "code" VARCHAR(50) UNIQUE NOT NULL,
          "address" TEXT NOT NULL,
          "phone" VARCHAR(30) NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        );
      `);
    } catch (e) {
      this.logger.error('Failed to sync companies table:', e.message);
    }

    // 2. Sync users table
    try {
      this.logger.log('Ensuring users table columns exist...');
      await this.dataSource.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE TABLE IF NOT EXISTS "users" (
          "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "email" VARCHAR(255) UNIQUE NOT NULL,
          "username" VARCHAR(255) UNIQUE,
          "passwordHash" VARCHAR(255),
          "name" VARCHAR(255) NOT NULL,
          "role" VARCHAR(50) NOT NULL DEFAULT 'SR',
          "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
          "allowedRouteIds" TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        );
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR(255);
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'ACTIVE';
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "allowedRouteIds" TEXT;
      `);

      // Handle unique constraint and initial username values
      try {
        await this.dataSource.query(
          'UPDATE "users" SET "username" = "email" WHERE "username" IS NULL',
        );
        await this.dataSource
          .query(
            'ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username")',
          )
          .catch(() => {});
      } catch (e) {
        // Ignore if constraint already exists or update fails
      }
    } catch (e) {
      if (!e.message.includes('does not exist')) {
        this.logger.error('Failed to sync users columns:', e.message);
      }
    }

    // 3. Sync routes and shops table
    try {
      this.logger.log('Ensuring routes and shops table columns exist...');
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "routes" (
          "id" SERIAL PRIMARY KEY,
          "name" VARCHAR(150) UNIQUE NOT NULL,
          "area" VARCHAR(150),
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "shops" (
          "id" SERIAL PRIMARY KEY,
          "routeId" INTEGER NOT NULL,
          "name" VARCHAR(150) NOT NULL,
          "ownerName" VARCHAR(150),
          "phone" VARCHAR(30),
          "address" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdById" UUID,
          "companyId" INTEGER,
          "version" INTEGER NOT NULL DEFAULT 1,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        );

        ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "area" VARCHAR(150);
        ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;

        ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "ownerName" VARCHAR(150);
        ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(30);
        ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "address" TEXT;
        ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
        ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "createdById" UUID;
        ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
        ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
        ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "createdByRole" VARCHAR(50);
        ALTER TABLE "shops" ALTER COLUMN "companyId" DROP NOT NULL;
      `);
    } catch (e) {
      if (!e.message.includes('does not exist')) {
        this.logger.error('Failed to sync routes/shops columns:', e.message);
      }
    }

    // 4. Sync orders table
    try {
      this.logger.log('Ensuring orders table columns exist...');
      await this.dataSource.query(`
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "actualSoldAmount" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "collectedAmount" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "dueAmount" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "settlementNote" TEXT;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT 'Admin';
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "createdById" UUID;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "createdByRole" VARCHAR(50);
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryNote" TEXT;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN DEFAULT false;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryPersonId" INTEGER;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "assignedDeliveryManId" UUID;
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "marketArea" VARCHAR(120);
        ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
        ALTER TABLE "orders" ALTER COLUMN "companyId" DROP NOT NULL;
      `);

      await this.dataSource.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orders_status_enum') THEN
             IF NOT EXISTS (
               SELECT 1
               FROM pg_enum e
               JOIN pg_type t ON t.oid = e.enumtypid
               WHERE t.typname = 'orders_status_enum' AND e.enumlabel = 'PARTIAL_DUE'
             ) THEN
               ALTER TYPE "orders_status_enum" ADD VALUE 'PARTIAL_DUE';
             END IF;

             IF NOT EXISTS (
               SELECT 1
               FROM pg_enum e
               JOIN pg_type t ON t.oid = e.enumtypid
               WHERE t.typname = 'orders_status_enum' AND e.enumlabel = 'MANUAL_DUE'
             ) THEN
               ALTER TYPE "orders_status_enum" ADD VALUE 'MANUAL_DUE';
             END IF;

             IF NOT EXISTS (
               SELECT 1
               FROM pg_enum e
               JOIN pg_type t ON t.oid = e.enumtypid
               WHERE t.typname = 'orders_status_enum' AND e.enumlabel = 'DELIVERY_COMPLETED'
             ) THEN
               ALTER TYPE "orders_status_enum" ADD VALUE 'DELIVERY_COMPLETED';
             END IF;

             IF NOT EXISTS (
               SELECT 1
               FROM pg_enum e
               JOIN pg_type t ON t.oid = e.enumtypid
               WHERE t.typname = 'orders_status_enum' AND e.enumlabel = 'RETURNED_PARTIAL'
             ) THEN
               ALTER TYPE "orders_status_enum" ADD VALUE 'RETURNED_PARTIAL';
             END IF;

             IF NOT EXISTS (
               SELECT 1
               FROM pg_enum e
               JOIN pg_type t ON t.oid = e.enumtypid
               WHERE t.typname = 'orders_status_enum' AND e.enumlabel = 'ASSIGNED'
             ) THEN
               ALTER TYPE "orders_status_enum" ADD VALUE 'ASSIGNED';
             END IF;
          END IF;
        END
        $$;
      `);
    } catch (e) {
      if (!e.message.includes('does not exist')) {
        this.logger.error('Failed to sync orders columns:', e.message);
      }
    }

    // 5. Sync order_items table
    try {
      this.logger.log('Ensuring order_items table columns exist...');
      await this.dataSource.query(`
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "deliveredPaidQuantity" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "deliveredFreeQuantity" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "returnedPaidQuantity" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "returnedFreeQuantity" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "damagedPaidQuantity" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "damagedFreeQuantity" DECIMAL(12,2) DEFAULT 0;

        ALTER TABLE "delivery_return_items" ADD COLUMN IF NOT EXISTS "returnedPaidQuantity" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "delivery_return_items" ADD COLUMN IF NOT EXISTS "returnedFreeQuantity" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "delivery_return_items" ADD COLUMN IF NOT EXISTS "damagedPaidQuantity" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "delivery_return_items" ADD COLUMN IF NOT EXISTS "damagedFreeQuantity" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "delivery_return_items" ADD COLUMN IF NOT EXISTS "deliveredPaidQuantity" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "delivery_return_items" ADD COLUMN IF NOT EXISTS "deliveredFreeQuantity" DECIMAL(12,2) DEFAULT 0;
      `);
    } catch (e) {
      if (!e.message.includes('does not exist')) {
        this.logger.error('Failed to sync order_items columns:', e.message);
      }
    }

    // 6. Sync stock_movements table
    try {
      this.logger.log('Ensuring stock_movements table exists...');
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "stock_movements" (
          "id" SERIAL PRIMARY KEY,
          "productId" INTEGER NOT NULL,
          "companyId" INTEGER NOT NULL,
          "type" VARCHAR(50) NOT NULL,
          "quantity" DECIMAL(12,2) NOT NULL,
          "note" VARCHAR(255),
          "reference" VARCHAR(255),
          "user" VARCHAR(255),
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "type" VARCHAR(50);
        ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "reference" VARCHAR(255);
        ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "user" VARCHAR(255);
        ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "balanceAfter" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(255);

        -- Add unique constraint for idempotencyKey if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_stock_movements_idempotency') THEN
            ALTER TABLE "stock_movements" ADD CONSTRAINT "UQ_stock_movements_idempotency" UNIQUE ("idempotencyKey");
          END IF;
        END
        $$;
        ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "balanceAfter" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(255);

        -- Add unique constraint for idempotencyKey if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_stock_movements_idempotency') THEN
            ALTER TABLE "stock_movements" ADD CONSTRAINT "UQ_stock_movements_idempotency" UNIQUE ("idempotencyKey");
          END IF;
        END
        $$;
      `);
    } catch (e) {
      this.logger.error('Failed to sync stock_movements table:', e.message);
    }

    // 7. Sync delivery_summaries table
    try {
      this.logger.log('Ensuring delivery_summaries table exists...');
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "delivery_summaries" (
          "id" SERIAL PRIMARY KEY,
          "deliveryDate" DATE,
          "companyId" INTEGER,
          "routeId" INTEGER,
          "status" VARCHAR(50) DEFAULT 'DRAFT',
          "morningPrinted" BOOLEAN DEFAULT false,
          "finalPrinted" BOOLEAN DEFAULT false,
          "totalAmount" DECIMAL(12,2) DEFAULT 0,
          "note" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS "delivery_summary_items" (
          "id" SERIAL PRIMARY KEY,
          "summaryId" INTEGER NOT NULL,
          "productId" INTEGER NOT NULL,
          "orderedQuantity" DECIMAL(12,2) DEFAULT 0,
          "returnedQuantity" DECIMAL(12,2) DEFAULT 0,
          "soldQuantity" DECIMAL(12,2) DEFAULT 0,
          "unitPrice" DECIMAL(12,2) DEFAULT 0,
          "lineTotal" DECIMAL(12,2) DEFAULT 0
        );
      `);
    } catch (e) {
      this.logger.error('Failed to sync delivery_summaries table:', e.message);
    }

    // 8. Sync dues table
    try {
      this.logger.log('Ensuring dues table exists and is up to date...');
      await this.dataSource.query(`
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
          "note" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE "dues" ADD COLUMN IF NOT EXISTS "note" TEXT;
      `);

      try {
        this.logger.log('Performing sanity checks on dues data...');
        // Clean up duplicate (orderId, shopId) pairs if any exist before applying constraint
        await this.dataSource.query(`
          DELETE FROM dues a USING dues b 
          WHERE a.id < b.id 
            AND a."orderId" = b."orderId" 
            AND a."shopId" = b."shopId";
        `);

        this.logger.log('Dropping old single-column orderId unique constraints/indexes...');
        await this.dataSource.query(`
          ALTER TABLE "dues" DROP CONSTRAINT IF EXISTS "unique_due_order_id";
        `);

        // Drop any other single-column unique constraints on orderId dynamically
        await this.dataSource.query(`
          DO $$
          DECLARE
              r RECORD;
          BEGIN
              FOR r IN (
                  SELECT conname 
                  FROM pg_constraint 
                  WHERE conrelid = 'dues'::regclass 
                    AND contype = 'u' 
                    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'dues'::regclass AND attname = 'orderId')]
              ) LOOP
                  EXECUTE 'ALTER TABLE dues DROP CONSTRAINT ' || quote_ident(r.conname);
              END LOOP;
          END $$;
        `);

        // Drop any single-column unique indexes on orderId
        await this.dataSource.query(`
          DROP INDEX IF EXISTS "UQ_dues_orderId";
          DROP INDEX IF EXISTS "UQ_8de71cc0cf02d8479e0a0a56ff6";
        `);

        this.logger.log('Creating composite unique index on (orderId, shopId)...');
        await this.dataSource.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_dues_orderId_shopId" ON dues("orderId", "shopId");
        `);

        this.logger.log('Backfilling missing routeId on existing dues and orders from shops...');
        await this.dataSource.query(`
          UPDATE "dues" d
          SET "routeId" = s."routeId"
          FROM "shops" s
          WHERE d."shopId" = s.id
            AND (d."routeId" IS NULL OR d."routeId" != s."routeId");

          UPDATE "orders" o
          SET "routeId" = s."routeId"
          FROM "shops" s
          WHERE o."shopId" = s.id
            AND (o."routeId" IS NULL OR o."routeId" != s."routeId");
        `);
      } catch (e) {
        this.logger.error('Failed to migrate dues constraints:', e.message);
      }
    } catch (e) {
      this.logger.error('Failed to sync dues table:', e.message);
    }

    // 9. Sync due_collections table
    try {
      this.logger.log('Ensuring due_collections table exists...');
      await this.dataSource.query(`
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
      `);
    } catch (e) {
      this.logger.error('Failed to sync due_collections table:', e.message);
    }

    // 10. Sync delivery_people table
    try {
      this.logger.log(
        'Ensuring delivery_people table exists and is up to date...',
      );
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "delivery_people" (
          "id" SERIAL PRIMARY KEY,
          "userId" VARCHAR(255),
          "name" VARCHAR(120) NOT NULL,
          "phone" VARCHAR(30) NOT NULL,
          "email" VARCHAR(120),
          "address" TEXT,
          "vehicleNo" VARCHAR(80),
          "helperName" VARCHAR(120),
          "notes" TEXT,
          "isActive" BOOLEAN DEFAULT true,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE "delivery_people" ADD COLUMN IF NOT EXISTS "userId" UUID;
        ALTER TABLE "delivery_people" ALTER COLUMN "userId" TYPE UUID USING "userId"::UUID;
      `);
    } catch (e) {
      this.logger.error('Failed to sync delivery_people table:', e.message);
    }

    // 11. Sync dispatch_batches table
    try {
      this.logger.log('Ensuring dispatch_batches table columns exist...');
      await this.dataSource.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_batches_status_enum') THEN
            CREATE TYPE "dispatch_batches_status_enum" AS ENUM ('DRAFT', 'PRINTED', 'DISPATCHED', 'RETURN_PENDING', 'PARTIALLY_SETTLED', 'SETTLED', 'CANCELLED');
          END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS "dispatch_batches" (
          "id" SERIAL PRIMARY KEY,
          "batchNo" VARCHAR(30) UNIQUE NOT NULL,
          "dispatchDate" DATE NOT NULL,
          "companyId" INTEGER,
          "routeId" INTEGER NOT NULL,
          "deliveryPersonId" INTEGER,
          "assignedDeliveryManId" UUID,
          "marketArea" VARCHAR(120),
          "status" "public"."dispatch_batches_status_enum" NOT NULL DEFAULT 'DRAFT',
          "totalOrders" INTEGER NOT NULL DEFAULT 0,
          "grossDispatchedValue" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "returnAdjustedValue" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "finalSoldValue" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "totalAdvancePaid" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "totalCollectedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "totalDueAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "oldDueCollectedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "shortageOrExcess" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "vanRent" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "salary" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "totalExpenses" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "isMorningPrinted" BOOLEAN NOT NULL DEFAULT false,
          "isFinalPrinted" BOOLEAN NOT NULL DEFAULT false,
          "morningPrintedAt" TIMESTAMP,
          "dispatchedAt" TIMESTAMP,
          "returnsRecordedAt" TIMESTAMP,
          "settledAt" TIMESTAMP,
          "note" TEXT,
          "settlementNote" TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          "version" INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS "dispatch_batch_orders" (
          "id" SERIAL PRIMARY KEY,
          "batchId" INTEGER NOT NULL,
          "orderId" INTEGER NOT NULL,
          "estimatedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "finalSoldAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "collectedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "dueAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "shortageOrExcess" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "isSettled" BOOLEAN NOT NULL DEFAULT false,
          "deliveryStatus" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
          "deliveryNote" TEXT,
          "deliveryCompletedAt" TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "dispatch_batch_items" (
          "id" SERIAL PRIMARY KEY,
          "batchId" INTEGER NOT NULL,
          "productId" INTEGER NOT NULL,
          "totalDispatchedQty" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "totalReturnedQty" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "returnedPaidQty" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "returnedFreeQty" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "totalDamagedQty" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "damagedPaidQty" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "damagedFreeQty" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "totalDeliveredQty" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "deliveredPaidQty" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "deliveredFreeQty" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "estimatedAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
          "finalSoldAmount" NUMERIC(12,2) NOT NULL DEFAULT 0
        );

        ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "assignedDeliveryManId" UUID;
        ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
        ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "shortageOrExcess" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "vanRent" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "salary" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "totalExpenses" DECIMAL(12,2) DEFAULT 0;

        CREATE TABLE IF NOT EXISTS "dispatch_batch_expenses" (
          "id" SERIAL PRIMARY KEY,
          "dispatchBatchId" INTEGER NOT NULL,
          "expenseType" VARCHAR(50) DEFAULT 'Other',
          "name" VARCHAR(150) NOT NULL,
          "amount" DECIMAL(12,2) DEFAULT 0,
          "note" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_dispatch_batch_expenses_batch" ON "dispatch_batch_expenses" ("dispatchBatchId");
        ALTER TABLE "dispatch_batch_orders" ADD COLUMN IF NOT EXISTS "deliveryStatus" VARCHAR(30) DEFAULT 'PENDING';
        ALTER TABLE "dispatch_batch_orders" ADD COLUMN IF NOT EXISTS "deliveryNote" TEXT;
        ALTER TABLE "dispatch_batch_orders" ADD COLUMN IF NOT EXISTS "deliveryCompletedAt" TIMESTAMP;
        ALTER TABLE "dispatch_batch_items" ADD COLUMN IF NOT EXISTS "totalReturnedQty" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batch_items" ADD COLUMN IF NOT EXISTS "returnedPaidQty" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batch_items" ADD COLUMN IF NOT EXISTS "returnedFreeQty" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batch_items" ADD COLUMN IF NOT EXISTS "totalDamagedQty" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batch_items" ADD COLUMN IF NOT EXISTS "damagedPaidQty" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batch_items" ADD COLUMN IF NOT EXISTS "damagedFreeQty" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batch_items" ADD COLUMN IF NOT EXISTS "totalDeliveredQty" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batch_items" ADD COLUMN IF NOT EXISTS "deliveredPaidQty" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batch_items" ADD COLUMN IF NOT EXISTS "deliveredFreeQty" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batch_items" ADD COLUMN IF NOT EXISTS "finalSoldAmount" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "dispatch_batches" ALTER COLUMN "deliveryPersonId" DROP NOT NULL;
        ALTER TABLE "orders" ALTER COLUMN "deliveryPersonId" DROP NOT NULL;

        -- Fix types if they were created as TEXT previously
        ALTER TABLE "dispatch_batches" ALTER COLUMN "assignedDeliveryManId" TYPE UUID USING "assignedDeliveryManId"::UUID;
        ALTER TABLE "orders" ALTER COLUMN "assignedDeliveryManId" TYPE UUID USING "assignedDeliveryManId"::UUID;
        ALTER TABLE "orders" ALTER COLUMN "createdById" TYPE UUID USING "createdById"::UUID;
        ALTER TABLE "shops" ALTER COLUMN "createdById" TYPE UUID USING "createdById"::UUID;
      `);
    } catch (e) {
      if (!e.message.includes('does not exist')) {
        this.logger.error(
          'Failed to sync dispatch_batches columns:',
          e.message,
        );
      }
    }

    // 12. Sync cash_collections table
    try {
      this.logger.log('Ensuring cash_collections table columns exist...');
      await this.dataSource.query(`
        ALTER TABLE "cash_collections" ADD COLUMN IF NOT EXISTS "status" VARCHAR(30) DEFAULT 'PENDING';
      `);
    } catch (e) {
      if (!e.message.includes('does not exist')) {
        this.logger.error(
          'Failed to sync cash_collections columns:',
          e.message,
        );
      }
    }

    // 13. Create Database Indexes for Performance Optimization
    try {
      this.logger.log(
        'Ensuring database indexes exist for high performance...',
      );
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" ("status");
        CREATE INDEX IF NOT EXISTS "idx_orders_company_route" ON "orders" ("companyId", "routeId");
        CREATE INDEX IF NOT EXISTS "idx_orders_created_at" ON "orders" ("createdAt");
        CREATE INDEX IF NOT EXISTS "idx_dues_sr_id" ON "dues" ("srId");
        CREATE INDEX IF NOT EXISTS "idx_dues_remaining" ON "dues" ("remainingDue");
        CREATE INDEX IF NOT EXISTS "idx_due_collections_status" ON "due_collections" ("status");
        CREATE INDEX IF NOT EXISTS "idx_stock_movements_prod_created" ON "stock_movements" ("productId", "createdAt" DESC);
      `);
    } catch (e) {
      this.logger.error('Failed to create performance indexes:', e.message);
    }

    // 15. Sync purchases, purchase_items, and company_payments tables
    try {
      this.logger.log('Ensuring purchases, purchase_items, and company_payments tables exist...');
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "purchases" (
          "id" SERIAL PRIMARY KEY,
          "purchaseDate" DATE NOT NULL DEFAULT CURRENT_DATE,
          "invoiceNo" VARCHAR(50) NOT NULL,
          "companyId" INTEGER NOT NULL,
          "supplierName" VARCHAR(200),
          "totalAmount" DECIMAL(12,2) DEFAULT 0,
          "paidAmount" DECIMAL(12,2) DEFAULT 0,
          "dueAmount" DECIMAL(12,2) DEFAULT 0,
          "status" VARCHAR(50) DEFAULT 'DRAFT',
          "note" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "purchase_items" (
          "id" SERIAL PRIMARY KEY,
          "purchaseId" INTEGER NOT NULL,
          "productId" INTEGER NOT NULL,
          "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
          "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
          "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS "company_payments" (
          "id" SERIAL PRIMARY KEY,
          "companyId" INTEGER NOT NULL,
          "purchaseId" INTEGER,
          "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
          "paymentDate" DATE NOT NULL DEFAULT CURRENT_DATE,
          "paymentMethod" VARCHAR(50) DEFAULT 'CASH',
          "transactionRef" VARCHAR(150),
          "note" TEXT,
          "createdByName" VARCHAR(100) DEFAULT 'Admin',
          "createdById" UUID,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE "company_payments" ADD COLUMN IF NOT EXISTS "productBreakdown" JSONB;
        ALTER TABLE "company_payments" ADD COLUMN IF NOT EXISTS "bankName" VARCHAR(150);
        ALTER TABLE "company_payments" ADD COLUMN IF NOT EXISTS "branchName" VARCHAR(150);
        ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "paymentId" INTEGER;
        ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "warehouseName" VARCHAR(150);
        ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "vehicleNo" VARCHAR(100);
        ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "driverName" VARCHAR(150);
        ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "supplierInvoiceNo" VARCHAR(100);
        ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "invoiceImageUrl" TEXT;
        ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "invoiceImagePublicId" VARCHAR(255);
        ALTER TABLE "company_payments" ADD COLUMN IF NOT EXISTS "invoiceImageUrl" TEXT;
        ALTER TABLE "company_payments" ADD COLUMN IF NOT EXISTS "invoiceImagePublicId" VARCHAR(255);

        CREATE INDEX IF NOT EXISTS "idx_purchases_company_date" ON "purchases" ("companyId", "purchaseDate" DESC);
        CREATE INDEX IF NOT EXISTS "idx_purchases_payment_id" ON "purchases" ("paymentId");
        CREATE INDEX IF NOT EXISTS "idx_purchase_items_purchase" ON "purchase_items" ("purchaseId");
        CREATE INDEX IF NOT EXISTS "idx_purchase_items_product" ON "purchase_items" ("productId");
        CREATE INDEX IF NOT EXISTS "idx_company_payments_company" ON "company_payments" ("companyId", "paymentDate" DESC);
      `);
    } catch (e) {
      this.logger.error('Failed to sync purchases/company_payments tables:', e.message);
    }

    // 16. Sync due business-date column
    try {
      this.logger.log('Ensuring due business-date column exists...');
      await this.dataSource.query(`
        ALTER TABLE "dues" ADD COLUMN IF NOT EXISTS "dueDate" DATE;
        UPDATE "dues" SET "dueDate" = COALESCE("dueDate", "createdAt"::date) WHERE "dueDate" IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_dues_due_date" ON "dues" ("dueDate" DESC);
      `);
    } catch (e) {
      if (!e.message.includes('does not exist')) {
        this.logger.error('Failed to sync due business-date column:', e.message);
      }
    }

    // 17. Sync activity_logs table
    try {
      this.logger.log('Ensuring activity_logs table exists...');
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "activity_logs" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "category" VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
          "action" VARCHAR(100) NOT NULL,
          "entityType" VARCHAR(50),
          "entityId" VARCHAR(100),
          "title" VARCHAR(255) NOT NULL,
          "description" TEXT,
          "details" JSONB,
          "userId" UUID,
          "userName" VARCHAR(150),
          "userRole" VARCHAR(50),
          "ipAddress" VARCHAR(64),
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS "idx_activity_logs_category_created" ON "activity_logs" ("category", "createdAt" DESC);
        CREATE INDEX IF NOT EXISTS "idx_activity_logs_entity" ON "activity_logs" ("entityType", "entityId");
        CREATE INDEX IF NOT EXISTS "idx_activity_logs_created" ON "activity_logs" ("createdAt" DESC);
      `);
    } catch (e) {
      this.logger.error('Failed to sync activity_logs table:', e.message);
    }

    // 18. Sync recycle_bin table
    try {
      this.logger.log('Ensuring recycle_bin table exists...');
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "recycle_bin" (
          "id" SERIAL PRIMARY KEY,
          "entityType" VARCHAR(50) NOT NULL,
          "entityId" INTEGER NOT NULL,
          "entityNumber" VARCHAR(100),
          "title" VARCHAR(255) NOT NULL,
          "shopName" VARCHAR(255),
          "routeName" VARCHAR(255),
          "totalAmount" NUMERIC(14, 2) DEFAULT 0,
          "dueAmount" NUMERIC(14, 2) DEFAULT 0,
          "itemCount" INTEGER DEFAULT 0,
          "snapshot" JSONB NOT NULL,
          "deletedById" VARCHAR(100),
          "deletedByName" VARCHAR(150),
          "deletedByRole" VARCHAR(50),
          "status" VARCHAR(50) DEFAULT 'DELETED',
          "restoredAt" TIMESTAMP WITH TIME ZONE,
          "restoredByName" VARCHAR(150),
          "note" TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS "idx_recycle_bin_entity" ON "recycle_bin" ("entityType", "entityId");
        CREATE INDEX IF NOT EXISTS "idx_recycle_bin_status_created" ON "recycle_bin" ("status", "createdAt" DESC);
      `);
    } catch (e) {
      this.logger.error('Failed to sync recycle_bin table:', e.message);
    }

    // 19. Sync carton_labels table and dispatch_batches oldDueCollectedAmount
    try {
      this.logger.log('Ensuring carton_labels table exists...');
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "carton_labels" (
          "id" SERIAL PRIMARY KEY,
          "cartonCode" VARCHAR(100) NOT NULL UNIQUE,
          "productId" INTEGER NOT NULL,
          "companyId" INTEGER,
          "packSize" NUMERIC(10, 2) DEFAULT 1,
          "status" VARCHAR(50) DEFAULT 'AVAILABLE',
          "currentBatchId" INTEGER,
          "printedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "scannedAt" TIMESTAMP WITH TIME ZONE,
          "notes" TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS "idx_carton_labels_code" ON "carton_labels" ("cartonCode");
        CREATE INDEX IF NOT EXISTS "idx_carton_labels_prod_status" ON "carton_labels" ("productId", "status");
        CREATE INDEX IF NOT EXISTS "idx_carton_labels_batch" ON "carton_labels" ("currentBatchId");

        ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "oldDueCollectedAmount" DECIMAL(12,2) DEFAULT 0;
      `);
    } catch (e) {
      this.logger.error('Failed to sync carton_labels table:', e.message);
    }

      this.logger.log('--- DEFENSIVE SCHEMA SYNC COMPLETED ---');
    } catch (globalErr: any) {
      this.logger.error('Unexpected error in schema sync:', globalErr?.message);
    }
  }
}
