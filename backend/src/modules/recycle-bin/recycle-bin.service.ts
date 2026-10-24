import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  RecycleBinItem,
  RecycleBinStatus,
  RecycleBinEntityType,
} from './entities/recycle-bin.entity';
import { QueryRecycleBinDto } from './dto/query-recycle-bin.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { StockMovementType } from '../stock/stock.constants';

@Injectable()
export class RecycleBinService {
  private readonly logger = new Logger(RecycleBinService.name);

  constructor(
    @InjectRepository(RecycleBinItem)
    private readonly recycleBinRepository: Repository<RecycleBinItem>,
    private readonly dataSource: DataSource,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async findAll(query: QueryRecycleBinDto) {
    const qb = this.recycleBinRepository.createQueryBuilder('item');

    if (query.entityType && query.entityType !== 'ALL') {
      qb.andWhere('item.entityType = :entityType', {
        entityType: query.entityType,
      });
    }

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('item.status = :status', { status: query.status });
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(item.title ILIKE :term OR item.entityNumber ILIKE :term OR item.shopName ILIKE :term OR item.routeName ILIKE :term OR item.deletedByName ILIKE :term)',
        { term },
      );
    }

    qb.orderBy('item.createdAt', 'DESC');
    qb.skip(query.offset || 0);
    qb.take(query.limit || 50);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      limit: query.limit || 50,
      offset: query.offset || 0,
    };
  }

  async getStats() {
    const raw = await this.recycleBinRepository
      .createQueryBuilder('item')
      .select('item.status', 'status')
      .addSelect('item.entityType', 'entityType')
      .addSelect('COUNT(item.id)', 'count')
      .addSelect('COALESCE(SUM(item.totalAmount), 0)', 'totalAmount')
      .addSelect('COALESCE(SUM(item.dueAmount), 0)', 'dueAmount')
      .groupBy('item.status')
      .addGroupBy('item.entityType')
      .getRawMany();

    let totalDeleted = 0;
    let deletedOrders = 0;
    let deletedBatches = 0;
    let totalRestored = 0;
    let recoverableValue = 0;
    let recoverableDue = 0;

    for (const r of raw) {
      const count = Number(r.count || 0);
      const amount = Number(r.totalAmount || 0);
      const due = Number(r.dueAmount || 0);

      if (r.status === RecycleBinStatus.DELETED) {
        totalDeleted += count;
        recoverableValue += amount;
        recoverableDue += due;
        if (r.entityType === RecycleBinEntityType.ORDER) {
          deletedOrders += count;
        } else if (r.entityType === RecycleBinEntityType.DISPATCH_BATCH) {
          deletedBatches += count;
        }
      } else if (r.status === RecycleBinStatus.RESTORED) {
        totalRestored += count;
      }
    }

    return {
      totalDeleted,
      deletedOrders,
      deletedBatches,
      totalRestored,
      recoverableValue,
      recoverableDue,
    };
  }

  async findOne(id: number) {
    const item = await this.recycleBinRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Recycle bin item #${id} not found`);
    }
    return item;
  }

  /**
   * Restore a deleted item (Order, Dispatch Batch, or Due)
   */
  async restore(id: number, currentUser: any) {
    const item = await this.recycleBinRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Recycle bin item #${id} not found`);
    }

    if (item.status === RecycleBinStatus.RESTORED) {
      throw new BadRequestException(
        `This item has already been restored on ${item.restoredAt}`,
      );
    }

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      if (item.entityType === RecycleBinEntityType.ORDER) {
        await this.restoreOrder(item, runner, currentUser);
      } else if (item.entityType === RecycleBinEntityType.DISPATCH_BATCH) {
        await this.restoreDispatchBatch(item, runner, currentUser);
      } else {
        throw new BadRequestException(
          `Unsupported entity type for restore: ${item.entityType}`,
        );
      }

      // Mark as restored
      item.status = RecycleBinStatus.RESTORED;
      item.restoredAt = new Date();
      item.restoredByName =
        currentUser?.name || currentUser?.username || 'Admin';
      await runner.manager.save(RecycleBinItem, item);

      await runner.commitTransaction();

      // Emit realtime updates
      try {
        this.realtimeGateway.emitPayload('recycleBinUpdated', {
          id: item.id,
          action: 'RESTORED',
        });
        if (item.entityType === RecycleBinEntityType.ORDER) {
          this.realtimeGateway.emitPayload('orderRestored', {
            id: item.entityId,
          });
        } else if (item.entityType === RecycleBinEntityType.DISPATCH_BATCH) {
          this.realtimeGateway.emitPayload('batchRestored', {
            id: item.entityId,
          });
        }
      } catch (e) {
        this.logger.warn(`Failed to emit socket event: ${e?.message}`);
      }

      return {
        success: true,
        message: `${item.title} has been successfully restored! All items, stock adjustments, and dues have been re-applied.`,
        restoredItem: item,
      };
    } catch (err: any) {
      await runner.rollbackTransaction();
      this.logger.error(
        `Failed to restore recycle bin item #${id}: ${err.message}`,
        err.stack,
      );
      throw new BadRequestException(`Restore failed: ${err.message}`);
    } finally {
      await runner.release();
    }
  }

  private async restoreOrder(
    item: RecycleBinItem,
    runner: any,
    currentUser: any,
  ) {
    const snapshot = item.snapshot;
    if (!snapshot || !snapshot.order) {
      throw new BadRequestException('Snapshot data for this order is corrupt.');
    }

    const order = snapshot.order;
    const items = snapshot.items || [];
    const dues = snapshot.dues || [];

    // Check if order ID is already in use
    const existing = await runner.manager.query(
      'SELECT id FROM orders WHERE id = $1',
      [order.id],
    );

    let targetOrderId = order.id;
    if (existing && existing.length > 0) {
      // If original ID exists, get the next value from sequence
      const nextIdRes = await runner.manager.query(
        `SELECT nextval(pg_get_serial_sequence('orders', 'id')) as "nextId"`,
      );
      targetOrderId = Number(nextIdRes[0]?.nextId);
    }

    // 1. Insert order
    await runner.manager.query(
      `
      INSERT INTO "orders" (
        "id", "orderDate", "companyId", "routeId", "deliveryPersonId", "assignedDeliveryManId",
        "shopId", "marketArea", "status", "subtotal", "discountType", "discountValue",
        "discountAmount", "tax", "grandTotal", "advancePaid", "dueAmount", "note",
        "createdBy", "createdById", "createdByRole", "actualSoldAmount", "collectedAmount",
        "settlementNote", "settledAt", "isLocked", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23,
        $24, $25, $26, $27, CURRENT_TIMESTAMP
      )
    `,
      [
        targetOrderId,
        order.orderDate,
        order.companyId || null,
        order.routeId,
        order.deliveryPersonId || null,
        order.assignedDeliveryManId || null,
        order.shopId || null,
        order.marketArea || null,
        order.status || 'CONFIRMED',
        order.subtotal || 0,
        order.discountType || 'FIXED',
        order.discountValue || 0,
        order.discountAmount || 0,
        order.tax || 0,
        order.grandTotal || 0,
        order.advancePaid || 0,
        order.dueAmount || 0,
        order.note || null,
        order.createdBy || 'System',
        order.createdById || null,
        order.createdByRole || null,
        order.actualSoldAmount || null,
        order.collectedAmount || 0,
        order.settlementNote || null,
        order.settledAt || null,
        order.isLocked || false,
        order.createdAt ? new Date(order.createdAt) : new Date(),
      ],
    );

    // 2. Insert order items & deduct stock
    for (const oi of items) {
      await runner.manager.query(
        `
        INSERT INTO "order_items" (
          "orderId", "productId", "quantity", "freeQuantity", "unitPrice",
          "discountType", "discountValue", "discountAmount", "lineTotal",
          "deliveredPaidQuantity", "deliveredFreeQuantity", "returnedPaidQuantity",
          "returnedFreeQuantity", "damagedPaidQuantity", "damagedFreeQuantity",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
        [
          targetOrderId,
          oi.productId,
          oi.quantity || 0,
          oi.freeQuantity || 0,
          oi.unitPrice || 0,
          oi.discountType || 'FIXED',
          oi.discountValue || 0,
          oi.discountAmount || 0,
          oi.lineTotal || 0,
          oi.deliveredPaidQuantity || 0,
          oi.deliveredFreeQuantity || 0,
          oi.returnedPaidQuantity || 0,
          oi.returnedFreeQuantity || 0,
          oi.damagedPaidQuantity || 0,
          oi.damagedFreeQuantity || 0,
        ],
      );

      // Deduct stock back since stock was returned when order was deleted
      const qtyToDeduct = Number(oi.quantity || 0) + Number(oi.freeQuantity || 0);
      if (qtyToDeduct > 0) {
        const updateResult = await runner.manager.query(
          `UPDATE products SET "currentStock" = "currentStock" - $1, "version" = "version" + 1 WHERE id = $2 RETURNING "currentStock"`,
          [qtyToDeduct, oi.productId],
        );
        const balanceAfter = Number(updateResult[0]?.currentStock || 0);

        await runner.manager.save(
          runner.manager.create(StockMovement, {
            productId: oi.productId,
            companyId: oi.product?.companyId || order.companyId || 0,
            type: StockMovementType.STOCK_OUT,
            quantity: qtyToDeduct,
            reference: `Restored Order #${targetOrderId}`,
            note: `Re-deducted ${qtyToDeduct} units — Order #${targetOrderId} restored from Recycle Bin`,
            user: currentUser?.name || currentUser?.username || 'Admin',
            balanceAfter,
            idempotencyKey: `RESTORE_ORDER_${targetOrderId}_${oi.productId}_${Date.now()}`,
          }),
        );
      }
    }

    // 3. Restore Dues if any
    for (const d of dues) {
      await runner.manager.query(
        `
        INSERT INTO "dues" (
          "orderId", "shopId", "routeId", "srId", "srName",
          "dueAmount", "paidAmount", "remainingDue", "status", "note", "dueDate",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
        [
          targetOrderId,
          d.shopId || order.shopId,
          d.routeId || order.routeId,
          d.srId || order.createdById || 'SYSTEM',
          d.srName || order.createdBy || 'System',
          d.dueAmount || order.dueAmount || 0,
          d.paidAmount || 0,
          d.remainingDue || order.dueAmount || 0,
          d.status || 'DUE',
          d.note || `Restored from Recycle Bin on ${new Date().toLocaleDateString()}`,
          d.dueDate ? new Date(d.dueDate) : new Date(),
        ],
      );
    }

    // 4. Record audit log
    await runner.manager.query(
      `
      INSERT INTO "activity_logs" 
        ("category", "action", "entityType", "entityId", "title", "description", "userId", "userName", "userRole", "createdAt")
      VALUES 
        ('ORDER', 'RESTORE', 'ORDER', $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `,
      [
        String(targetOrderId),
        `Order #${targetOrderId} Restored`,
        `Restored order with ${items.length} items and BDT ${order.dueAmount || 0} due balance from Recycle Bin`,
        currentUser?.id || currentUser?.sub || null,
        currentUser?.name || currentUser?.username || 'Admin',
        currentUser?.role || 'ADMIN',
      ],
    );
  }

  private async restoreDispatchBatch(
    item: RecycleBinItem,
    runner: any,
    currentUser: any,
  ) {
    const snapshot = item.snapshot;
    if (!snapshot || !snapshot.batch) {
      throw new BadRequestException('Snapshot data for this batch is corrupt.');
    }

    const batch = snapshot.batch;
    const orders = snapshot.orders || [];
    const items = snapshot.items || [];
    const dues = snapshot.dues || [];

    // Check if batch ID exists
    const existing = await runner.manager.query(
      'SELECT id FROM dispatch_batches WHERE id = $1',
      [batch.id],
    );

    let targetBatchId = batch.id;
    if (existing && existing.length > 0) {
      const nextIdRes = await runner.manager.query(
        `SELECT nextval(pg_get_serial_sequence('dispatch_batches', 'id')) as "nextId"`,
      );
      targetBatchId = Number(nextIdRes[0]?.nextId);
    }

    // 1. Insert batch
    await runner.manager.query(
      `
      INSERT INTO "dispatch_batches" (
        "id", "dispatchDate", "companyId", "routeId", "assignedDeliveryManId",
        "marketArea", "status", "note", "grossDispatchedValue", "finalSoldValue",
        "totalDueAmount", "morningReportPrintedAt", "dispatchedAt", "settledAt",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, CURRENT_TIMESTAMP
      )
    `,
      [
        targetBatchId,
        batch.dispatchDate,
        batch.companyId || null,
        batch.routeId || null,
        batch.assignedDeliveryManId || null,
        batch.marketArea || null,
        batch.status || 'DRAFT',
        batch.note || null,
        batch.grossDispatchedValue || 0,
        batch.finalSoldValue || null,
        batch.totalDueAmount || 0,
        batch.morningReportPrintedAt || null,
        batch.dispatchedAt || null,
        batch.settledAt || null,
        batch.createdAt ? new Date(batch.createdAt) : new Date(),
      ],
    );

    // 2. Insert batch items
    for (const bi of items) {
      await runner.manager.query(
        `
        INSERT INTO "dispatch_batch_items" (
          "batchId", "productId", "totalQuantity", "totalFreeQuantity", "unitPrice",
          "totalValue", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
        [
          targetBatchId,
          bi.productId,
          bi.totalQuantity || 0,
          bi.totalFreeQuantity || 0,
          bi.unitPrice || 0,
          bi.totalValue || 0,
        ],
      );
    }

    // 3. Restore all orders and their dues within this batch
    for (const o of orders) {
      const orderData = o.order || o;
      if (!orderData) continue;

      // Re-insert order
      await runner.manager.query(
        `
        INSERT INTO "orders" (
          "id", "orderDate", "companyId", "routeId", "deliveryPersonId", "assignedDeliveryManId",
          "shopId", "marketArea", "status", "subtotal", "discountType", "discountValue",
          "discountAmount", "tax", "grandTotal", "advancePaid", "dueAmount", "note",
          "createdBy", "createdById", "createdByRole", "actualSoldAmount", "collectedAmount",
          "settlementNote", "settledAt", "isLocked", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25, $26, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT (id) DO NOTHING
      `,
        [
          orderData.id,
          orderData.orderDate,
          orderData.companyId || null,
          orderData.routeId,
          orderData.deliveryPersonId || null,
          orderData.assignedDeliveryManId || null,
          orderData.shopId || null,
          orderData.marketArea || null,
          orderData.status || 'CONFIRMED',
          orderData.subtotal || 0,
          orderData.discountType || 'FIXED',
          orderData.discountValue || 0,
          orderData.discountAmount || 0,
          orderData.tax || 0,
          orderData.grandTotal || 0,
          orderData.advancePaid || 0,
          orderData.dueAmount || 0,
          orderData.note || null,
          orderData.createdBy || 'System',
          orderData.createdById || null,
          orderData.createdByRole || null,
          orderData.actualSoldAmount || null,
          orderData.collectedAmount || 0,
          orderData.settlementNote || null,
          orderData.settledAt || null,
          orderData.isLocked || false,
        ],
      );

      // Link to dispatch batch
      await runner.manager.query(
        `
        INSERT INTO "dispatch_batch_orders" (
          "batchId", "orderId", "dispatchedValue", "actualSoldValue", "dueAmount",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT DO NOTHING
      `,
        [
          targetBatchId,
          orderData.id,
          orderData.grandTotal || 0,
          orderData.actualSoldAmount || null,
          orderData.dueAmount || 0,
        ],
      );

      // Insert items
      for (const oi of orderData.items || []) {
        await runner.manager.query(
          `
          INSERT INTO "order_items" (
            "orderId", "productId", "quantity", "freeQuantity", "unitPrice",
            "discountType", "discountValue", "discountAmount", "lineTotal",
            "deliveredPaidQuantity", "deliveredFreeQuantity", "returnedPaidQuantity",
            "returnedFreeQuantity", "damagedPaidQuantity", "damagedFreeQuantity",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
          [
            orderData.id,
            oi.productId,
            oi.quantity || 0,
            oi.freeQuantity || 0,
            oi.unitPrice || 0,
            oi.discountType || 'FIXED',
            oi.discountValue || 0,
            oi.discountAmount || 0,
            oi.lineTotal || 0,
            oi.deliveredPaidQuantity || 0,
            oi.deliveredFreeQuantity || 0,
            oi.returnedPaidQuantity || 0,
            oi.returnedFreeQuantity || 0,
            oi.damagedPaidQuantity || 0,
            oi.damagedFreeQuantity || 0,
          ],
        );

        // Deduct stock
        const qtyToDeduct = Number(oi.quantity || 0) + Number(oi.freeQuantity || 0);
        if (qtyToDeduct > 0) {
          const updateResult = await runner.manager.query(
            `UPDATE products SET "currentStock" = "currentStock" - $1, "version" = "version" + 1 WHERE id = $2 RETURNING "currentStock"`,
            [qtyToDeduct, oi.productId],
          );
          const balanceAfter = Number(updateResult[0]?.currentStock || 0);

          await runner.manager.save(
            runner.manager.create(StockMovement, {
              productId: oi.productId,
              companyId: oi.product?.companyId || orderData.companyId || 0,
              type: StockMovementType.STOCK_OUT,
              quantity: qtyToDeduct,
              reference: `Restored Batch #${targetBatchId}`,
              note: `Re-deducted ${qtyToDeduct} units — Batch #${targetBatchId} restored from Recycle Bin`,
              user: currentUser?.name || currentUser?.username || 'Admin',
              balanceAfter,
              idempotencyKey: `RESTORE_BATCH_${targetBatchId}_${oi.productId}_${Date.now()}`,
            }),
          );
        }
      }
    }

    // 4. Restore dues from snapshot
    for (const d of dues) {
      await runner.manager.query(
        `
        INSERT INTO "dues" (
          "orderId", "shopId", "routeId", "srId", "srName",
          "dueAmount", "paidAmount", "remainingDue", "status", "note", "dueDate",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
        [
          d.orderId,
          d.shopId,
          d.routeId,
          d.srId || 'SYSTEM',
          d.srName || 'System',
          d.dueAmount || 0,
          d.paidAmount || 0,
          d.remainingDue || 0,
          d.status || 'DUE',
          d.note || `Restored with Batch #${targetBatchId}`,
          d.dueDate ? new Date(d.dueDate) : new Date(),
        ],
      );
    }
  }

  async purge(id: number, currentUser: any) {
    const item = await this.recycleBinRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Recycle bin item #${id} not found`);
    }

    await this.recycleBinRepository.delete(id);

    try {
      this.realtimeGateway.emitPayload('recycleBinUpdated', {
        id,
        action: 'PURGED',
      });
    } catch (e) {
      // Ignore
    }

    return {
      success: true,
      message: `${item.title} has been permanently purged from Recycle Bin.`,
    };
  }
}
