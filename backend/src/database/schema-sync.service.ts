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
      await this.dataSource.query('SELECT "currentStock" FROM products LIMIT 0');
    } catch (err) {
      if (err.message.includes('does not exist')) {
        this.logger.log('Table products does not exist yet, skipping column sync.');
      } else {
        this.logger.log('Synchronizing "currentStock" in products...');
        await this.dataSource.query(`
          DO $$ 
          BEGIN 
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='products') THEN
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='currentStock') THEN
                ALTER TABLE products ADD COLUMN "currentStock" DECIMAL(12,2) DEFAULT 0;
              END IF;
            END IF;
          END $$;
        `).catch(e => this.logger.error('Failed to sync products columns:', e.message));
      }
    }

    // 2. Sync users table
    try {
      await this.dataSource.query('SELECT "allowedRouteIds" FROM users LIMIT 0');
    } catch (err) {
      this.logger.log('Synchronizing users table columns...');
      await this.dataSource.query(`
        DO $$ 
        BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
              ALTER TABLE "users" ADD COLUMN "username" VARCHAR(255);
              UPDATE "users" SET "username" = "email" WHERE "username" IS NULL;
              ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username");
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status') THEN
              ALTER TABLE "users" ADD COLUMN "status" VARCHAR(50) DEFAULT 'ACTIVE';
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='allowedRouteIds') THEN
              ALTER TABLE "users" ADD COLUMN "allowedRouteIds" TEXT;
            END IF;
          END IF;
        END $$;
      `).catch(e => this.logger.error('Failed to sync users columns:', e.message));
    }

    // 3. Sync orders table
    try {
      await this.dataSource.query('SELECT "createdByRole" FROM orders LIMIT 0');
    } catch (err) {
      this.logger.log('Synchronizing orders table columns...');
      await this.dataSource.query(`
        DO $$ 
        BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='orders') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='createdBy') THEN
              ALTER TABLE "orders" ADD COLUMN "createdBy" VARCHAR(255) DEFAULT 'Admin';
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='createdById') THEN
              ALTER TABLE "orders" ADD COLUMN "createdById" VARCHAR(255);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='createdByRole') THEN
              ALTER TABLE "orders" ADD COLUMN "createdByRole" VARCHAR(50);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='actualSoldAmount') THEN
              ALTER TABLE "orders" ADD COLUMN "actualSoldAmount" DECIMAL(12,2) DEFAULT 0;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='collectedAmount') THEN
              ALTER TABLE "orders" ADD COLUMN "collectedAmount" DECIMAL(12,2) DEFAULT 0;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='dueAmount') THEN
              ALTER TABLE "orders" ADD COLUMN "dueAmount" DECIMAL(12,2) DEFAULT 0;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='settlementNote') THEN
              ALTER TABLE "orders" ADD COLUMN "settlementNote" TEXT;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='dispatchedAt') THEN
              ALTER TABLE "orders" ADD COLUMN "dispatchedAt" TIMESTAMP;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='deliveredAt') THEN
              ALTER TABLE "orders" ADD COLUMN "deliveredAt" TIMESTAMP;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='settledAt') THEN
              ALTER TABLE "orders" ADD COLUMN "settledAt" TIMESTAMP;
            END IF;
          END IF;
        END $$;
      `).catch(e => this.logger.error('Failed to sync orders columns:', e.message));
    }

    // 4. Sync delivery_return_items table
    try {
      await this.dataSource.query('SELECT "paidReturnedQuantity" FROM delivery_return_items LIMIT 0');
    } catch (err) {
      this.logger.log('Synchronizing delivery_return_items table columns...');
      await this.dataSource.query(`
        DO $$ 
        BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='delivery_return_items') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_return_items' AND column_name='paidReturnedQuantity') THEN
              ALTER TABLE "delivery_return_items" ADD COLUMN "paidReturnedQuantity" DECIMAL(12,2) DEFAULT 0;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_return_items' AND column_name='freeReturnedQuantity') THEN
              ALTER TABLE "delivery_return_items" ADD COLUMN "freeReturnedQuantity" DECIMAL(12,2) DEFAULT 0;
            END IF;
          END IF;
        END $$;
      `).catch(e => this.logger.error('Failed to sync delivery_return_items columns:', e.message));
    }

    // 5. Sync dues and due_collections table
    try {
      await this.dataSource.query('SELECT 1 FROM dues LIMIT 0');
    } catch (err) {
      this.logger.log('Table dues does not exist, creating it...');
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
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    try {
      await this.dataSource.query('SELECT "note" FROM dues LIMIT 0');
    } catch (err) {
      this.logger.log('Synchronizing dues table columns...');
      await this.dataSource.query(`
        DO $$ 
        BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='dues') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dues' AND column_name='note') THEN
              ALTER TABLE "dues" ADD COLUMN "note" TEXT;
            END IF;
          END IF;
        END $$;
      `).catch(e => this.logger.error('Failed to sync dues columns:', e.message));
    }

    try {
      await this.dataSource.query('SELECT 1 FROM due_collections LIMIT 0');
    } catch (err) {
      this.logger.log('Table due_collections does not exist, creating it...');
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
        )
      `);
    }

    this.logger.log('--- DEFENSIVE SCHEMA SYNC COMPLETED ---');
  }
}
