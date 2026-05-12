import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SchemaSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaSyncService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    this.logger.log('--- DEFENSIVE SCHEMA SYNC START ---');
    
    // 1. Sync products table
    try {
      this.logger.log('Ensuring products table columns exist...');
      await this.dataSource.query(`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "currentStock" DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
      `);
    } catch (e) {
      if (!e.message.includes('does not exist')) {
        this.logger.error('Failed to sync products columns:', e.message);
      }
    }

    // 2. Sync users table
    try {
      this.logger.log('Ensuring users table columns exist...');
      await this.dataSource.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR(255);
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'ACTIVE';
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "allowedRouteIds" TEXT;
      `);

      // Handle unique constraint and initial username values
      try {
        await this.dataSource.query('UPDATE "users" SET "username" = "email" WHERE "username" IS NULL');
        await this.dataSource.query('ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username")').catch(() => {});
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
      this.logger.log('Ensuring delivery_people table exists and is up to date...');
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
        ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "assignedDeliveryManId" UUID;
        ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
        ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "shortageOrExcess" DECIMAL(12,2) DEFAULT 0;
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
        this.logger.error('Failed to sync dispatch_batches columns:', e.message);
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
        this.logger.error('Failed to sync cash_collections columns:', e.message);
      }
    }

    this.logger.log('--- DEFENSIVE SCHEMA SYNC COMPLETED ---');
  }
}
