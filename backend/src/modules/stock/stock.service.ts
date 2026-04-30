import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { getBDDayRange } from '../../common/utils/date.utils';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { StockMovement } from './entities/stock-movement.entity';
import { StockMovementType } from './stock.constants';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { Product } from '../products/entities/product.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/orders.constants';
import { DispatchBatch, DispatchBatchStatus } from '../delivery-ops/entities/dispatch-batch.entity';

@Injectable()
export class StockService implements OnModuleInit {
  constructor(
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(DispatchBatch)
    private readonly batchRepository: Repository<DispatchBatch>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.logger.log('Ensuring database schema: products.currentStock and enum values');
    try {
      // 1. Ensure currentStock column
      await this.dataSource.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS "currentStock" DECIMAL(12,2) DEFAULT 0');
      
      // 2. Ensure enum values for stock movements
      // Postgres doesn't support IF NOT EXISTS for ADD VALUE directly in older versions, 
      // but we can check if it exists first.
      const enumValues = ['OPENING', 'STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'RETURN_IN', 'DAMAGE', 'SALE'];
      for (const val of enumValues) {
        try {
          // This query checks if the value exists in the enum type and adds it if not.
          // Note: This assumes the enum type is named 'stock_movements_type_enum' (standard TypeORM naming)
          await this.dataSource.query(`
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'stock_movements_type_enum' AND e.enumlabel = '${val}') THEN
                ALTER TYPE stock_movements_type_enum ADD VALUE '${val}';
              END IF;
            END
            $$;
          `);
        } catch (innerError) {
          // If the type name is different or something else fails, we just log it
          this.logger.warn(`Could not ensure enum value ${val}: ${innerError.message}`);
        }
      }

      this.logger.log('Database schema: products.currentStock and enums ensured.');
    } catch (e) {
      this.logger.warn('Error during onModuleInit schema check: ' + e.message);
    }
  }

  private readonly logger = new Logger(StockService.name);

  async create(dto: CreateStockMovementDto, username: string = 'Admin', manager?: any) {
    if (manager) {
      return this.executeMovement(dto, username, manager);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await this.executeMovement(dto, username, queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async executeMovement(dto: CreateStockMovementDto, username: string, manager: any) {
    const productRepo = manager.getRepository(Product);
    const movementRepo = manager.getRepository(StockMovement);

    // 1. Lock product for update
    const product = await productRepo.findOne({
      where: { id: dto.productId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    const qty = Number(dto.quantity);

    // 2. Prevent negative stock if it's an outgoing movement
    if (qty < 0) {
      if (Number(product.currentStock) + qty < 0) {
        throw new BadRequestException(`Insufficient stock for product ${product.name}. Current: ${product.currentStock}, Requested: ${Math.abs(qty)}`);
      }
    }

    // 3. Create StockMovement audit record
    const movement = movementRepo.create({
      ...dto,
      user: username,
    });
    await movementRepo.save(movement);

    // 4. Update Product currentStock
    product.currentStock = Number(product.currentStock) + qty;
    await productRepo.save(product);

    return movement;
  }

  async getProductStock(productId: number): Promise<number> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      select: ['currentStock']
    });
    return Number(product?.currentStock || 0);
  }

  async getHistory(query: { 
    companyId?: number; 
    productId?: number; 
    type?: StockMovementType;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const qb = this.movementRepository.createQueryBuilder('m')
      .leftJoinAndSelect('m.product', 'product')
      .leftJoinAndSelect('m.company', 'company')
      .orderBy('m.createdAt', 'DESC');

    if (query.companyId) qb.andWhere('m.companyId = :companyId', { companyId: query.companyId });
    if (query.productId) qb.andWhere('m.productId = :productId', { productId: query.productId });
    if (query.type) qb.andWhere('m.type = :type', { type: query.type });
    
    if (query.startDate && query.endDate) {
      qb.andWhere('m.createdAt BETWEEN :start AND :end', { 
        start: new Date(query.startDate), 
        end: new Date(query.endDate) 
      });
    }

    if (query.search) {
      qb.andWhere('(product.name ILIKE :s OR product.sku ILIKE :s)', { s: `%${query.search}%` });
    }

    return qb.getMany();
  }

  async getSummary(companyId?: number, search?: string) {
    const qb = this.productRepository.createQueryBuilder('p')
      .leftJoinAndSelect('p.company', 'company');
      
    if (companyId) {
      qb.andWhere('p.companyId = :companyId', { companyId });
    }
    
    if (search) {
      qb.andWhere('(p.name ILIKE :s OR p.sku ILIKE :s)', { s: `%${search}%` });
    }
    
    const products = await qb.getMany();

    // Check for negative stocks and provide a "fix" flag if requested
    // (In this system, reading from p.currentStock is now standard)

    // Check for negative stocks and provide a "fix" flag if requested
    // (In this system, recalculating is already the way it works, 
    // so we just ensure the map is accurate)

    const { startUtc: todayStartUTC, endUtc: todayEndUTC } = getBDDayRange();
    
    this.logger.debug(`Stock Summary Filter [BD Today]: Start=${todayStartUTC.toISOString()}, End=${todayEndUTC.toISOString()}`);
    
    // Helper for safe numeric conversion
    const safeNum = (val: any) => {
      const n = Number(val);
      return isFinite(n) ? n : 0;
    };

    // Calculate Today's Settled Metrics from Dispatch Batches (Same source as Delivery Reporting)
    const todaySettledBatches = await this.batchRepository.find({
      where: {
        status: DispatchBatchStatus.SETTLED,
        settledAt: Between(todayStartUTC, todayEndUTC),
        ...(companyId ? { companyId } : {})
      },
      relations: ['items']
    });

    const todaySoldQty = todaySettledBatches.reduce((total, batch) => {
      return total + batch.items.reduce((itemTotal, item) => itemTotal + safeNum(item.totalDeliveredQty), 0);
    }, 0);

    const todayReturnQty = todaySettledBatches.reduce((total, batch) => {
      return total + batch.items.reduce((itemTotal, item) => itemTotal + safeNum(item.totalReturnedQty), 0);
    }, 0);

    const todayDeliveryAmount = todaySettledBatches.reduce((total, batch) => total + safeNum(batch.finalSoldValue), 0);

    this.logger.log(`Stock Summary Matched: SettledBatches=${todaySettledBatches.length}, SoldQty=${todaySoldQty}, ReturnQty=${todayReturnQty}, Amount=${todayDeliveryAmount}`);

    // Calculate All-Time Settled Metrics from Dispatch Batches
    const allSettledBatches = await this.batchRepository.find({
      where: {
        status: DispatchBatchStatus.SETTLED,
        ...(companyId ? { companyId } : {})
      },
      relations: ['items']
    });

    const totalSoldQtyAllTime = allSettledBatches.reduce((total, batch) => {
      return total + batch.items.reduce((itemTotal, item) => itemTotal + safeNum(item.totalDeliveredQty), 0);
    }, 0);

    const totalReturnQtyAllTime = allSettledBatches.reduce((total, batch) => {
      return total + batch.items.reduce((itemTotal, item) => itemTotal + safeNum(item.totalReturnedQty), 0);
    }, 0);

    const totalDeliveryAmountAllTime = allSettledBatches.reduce((total, batch) => total + safeNum(batch.finalSoldValue), 0);

    const summary = {
      totalProducts: products.length,
      totalStockQty: products.reduce((sum, p) => sum + Number(p.currentStock || 0), 0),
      totalStockValue: products.reduce((sum, p) => sum + (Number(p.currentStock || 0) * p.buyPrice), 0),
      lowStockCount: products.filter(p => Number(p.currentStock || 0) > 0 && Number(p.currentStock || 0) <= 10).length,
      outOfStockCount: products.filter(p => Number(p.currentStock || 0) <= 0).length,
      todaySoldQty,
      todayReturnQty,
      todayDeliveryAmount,
      totalSoldQtyAllTime,
      totalReturnQtyAllTime,
      totalDeliveryAmountAllTime,
    };

    const currentStockList = products.map(p => ({
      ...p,
      stockValue: Number(p.currentStock || 0) * p.buyPrice,
    }));

    return { summary, currentStockList };
  }

  async backfillStock() {
    this.logger.log('Starting stock backfill...');
    
    // Ensure column exists in case synchronize:false
    try {
      await this.dataSource.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS "currentStock" DECIMAL(12,2) DEFAULT 0');
      this.logger.log('Schema update: "currentStock" column ensured.');
    } catch (e) {
      this.logger.warn('Could not run ALTER TABLE (might already exist or permission issue): ' + e.message);
    }

    const products = await this.productRepository.find();
    let updatedCount = 0;

    for (const product of products) {
      const result = await this.movementRepository
        .createQueryBuilder('m')
        .select('SUM(m.quantity)', 'sum')
        .where('m.productId = :productId', { productId: product.id })
        .getRawOne();
      
      const actualStock = Number(result?.sum || 0);
      product.currentStock = actualStock;
      await this.productRepository.save(product);
      updatedCount++;
    }

    this.logger.log(`Backfill completed. Updated ${updatedCount} products.`);
    return { updatedCount };
  }
}
