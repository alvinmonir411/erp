import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ActivityCategory } from './activity-log.entity';

export interface ActivityEvent {
  id: string;
  category: ActivityCategory | string;
  action: string;
  title: string;
  description?: string;
  timestamp: string; // ISO String
  userName?: string;
  userRole?: string;
  amount?: number | null;
  status?: string;
  entityType?: string;
  entityId?: string;
  route?: string | null;
  shop?: string | null;
  company?: string | null;
  details?: Record<string, any>;
}

export class ActivityLogFilterQueryDto {
  period?: 'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'all';
  category?: 'ALL' | ActivityCategory | string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityStats {
  totalEvents: number;
  deliveryEvents: number;
  orderEvents: number;
  collectionEvents: number;
  stockEvents: number;
  totalFinancialValue: number;
  todayCount: number;
}

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Helper to write an explicit audit log into the activity_logs table
   */
  async logActivity(data: {
    category: ActivityCategory;
    action: string;
    entityType?: string;
    entityId?: string;
    title: string;
    description?: string;
    details?: Record<string, any>;
    userId?: string;
    userName?: string;
    userRole?: string;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await this.dataSource.query(
        `
        INSERT INTO "activity_logs" 
          ("category", "action", "entityType", "entityId", "title", "description", "details", "userId", "userName", "userRole", "ipAddress", "createdAt")
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      `,
        [
          data.category,
          data.action,
          data.entityType || null,
          data.entityId || null,
          data.title,
          data.description || null,
          data.details ? JSON.stringify(data.details) : null,
          data.userId || null,
          data.userName || 'System',
          data.userRole || 'SYSTEM',
          data.ipAddress || null,
        ],
      );
    } catch (err: any) {
      this.logger.error(`Failed to record activity log: ${err?.message}`);
    }
  }

  /**
   * Get synthesized and explicit activity logs
   */
  async getActivityLogs(query: ActivityLogFilterQueryDto): Promise<{
    items: ActivityEvent[];
    total: number;
    stats: ActivityStats;
    period: string;
  }> {
    const period = query.period || 'today';
    const category = query.category || 'ALL';
    const search = query.search ? query.search.trim().toLowerCase() : '';
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);
    const offset = Math.max(Number(query.offset) || 0, 0);

    // Compute Date Range in Bangladesh Timezone (Asia/Dhaka = UTC+6)
    const { startUtc, endUtc } = this.calculateDateRangeUtc(
      period,
      query.startDate,
      query.endDate,
    );

    // Fetch unified operational events
    const allEvents = await this.fetchUnifiedEvents(startUtc, endUtc);

    // Filter by Category
    let filtered = allEvents;
    if (category !== 'ALL') {
      filtered = filtered.filter((ev) => ev.category === category);
    }

    // Filter by Search Text
    if (search) {
      filtered = filtered.filter((ev) => {
        const textToSearch = `${ev.title} ${ev.description || ''} ${ev.userName || ''} ${ev.userRole || ''} ${ev.route || ''} ${ev.shop || ''} ${ev.company || ''} ${ev.entityId || ''} ${ev.action}`.toLowerCase();
        return textToSearch.includes(search);
      });
    }

    // Sort by timestamp DESC
    filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Compute Stats for current filtered subset or overall
    const stats: ActivityStats = {
      totalEvents: allEvents.length,
      deliveryEvents: allEvents.filter(
        (e) => e.category === ActivityCategory.DELIVERY,
      ).length,
      orderEvents: allEvents.filter(
        (e) => e.category === ActivityCategory.ORDERS,
      ).length,
      collectionEvents: allEvents.filter(
        (e) => e.category === ActivityCategory.COLLECTIONS,
      ).length,
      stockEvents: allEvents.filter(
        (e) => e.category === ActivityCategory.STOCK,
      ).length,
      totalFinancialValue: allEvents.reduce(
        (sum, e) => sum + (Number(e.amount) || 0),
        0,
      ),
      todayCount: allEvents.length,
    };

    const paginatedItems = filtered.slice(offset, offset + limit);

    return {
      items: paginatedItems,
      total: filtered.length,
      stats,
      period,
    };
  }

  /**
   * Fetches events from all operational tables & explicit logs
   */
  private async fetchUnifiedEvents(
    startUtc?: Date,
    endUtc?: Date,
  ): Promise<ActivityEvent[]> {
    const events: ActivityEvent[] = [];

    // Helper for SQL date condition
    const dateCondition = (colName: string, paramIndexStart: number) => {
      if (startUtc && endUtc) {
        return `(${colName} >= $${paramIndexStart} AND ${colName} <= $${paramIndexStart + 1})`;
      }
      return '1=1';
    };

    const params: any[] = [];
    if (startUtc && endUtc) {
      params.push(startUtc.toISOString(), endUtc.toISOString());
    }

    try {
      // 1. DISPATCH BATCHES (Created, Dispatched, Returns Recorded, Settled)
      const batchesQuery = `
        SELECT 
          b.id, b."batchNo", b."dispatchDate", b."dispatchedAt", b."returnsRecordedAt", b."settledAt", b."createdAt", b."updatedAt",
          b.status, b."grossDispatchedValue", b."returnAdjustedValue", b."finalSoldValue", b."totalCollectedAmount", b."totalDueAmount",
          b."shortageOrExcess", b."vanRent", b."salary", b."totalExpenses", b."settlementNote", b.note,
          r.name as "routeName",
          c.name as "companyName",
          u.name as "deliveryManName",
          u.role as "deliveryManRole",
          u.email as "deliveryManEmail"
        FROM dispatch_batches b
        LEFT JOIN routes r ON b."routeId" = r.id
        LEFT JOIN companies c ON b."companyId" = c.id
        LEFT JOIN users u ON b."assignedDeliveryManId" = u.id
        WHERE 
          ${
            startUtc && endUtc
              ? `(
                  (b."createdAt" >= $1 AND b."createdAt" <= $2) OR
                  (b."dispatchedAt" >= $1 AND b."dispatchedAt" <= $2) OR
                  (b."settledAt" >= $1 AND b."settledAt" <= $2) OR
                  (b."returnsRecordedAt" >= $1 AND b."returnsRecordedAt" <= $2)
                )`
              : '1=1'
          }
        ORDER BY b.id DESC
        LIMIT 300
      `;

      const batches = await this.dataSource.query(
        batchesQuery,
        params.length > 0 ? params : [],
      );

      for (const b of batches) {
        const routeLabel = b.routeName || 'All Routes';
        const driverLabel = b.deliveryManName || 'Delivery Driver';

        // Batch Settled Event
        if (b.settledAt && this.isWithin(b.settledAt, startUtc, endUtc)) {
          events.push({
            id: `batch-settled-${b.id}`,
            category: ActivityCategory.DELIVERY,
            action: 'BATCH_SETTLED',
            title: `Batch ${b.batchNo} Settled & Closed`,
            description: `Batch for ${routeLabel} settled with final sold ৳${Number(b.finalSoldValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Collected: ৳${Number(b.totalCollectedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`,
            timestamp: this.toIsoString(b.settledAt),
            userName: driverLabel,
            userRole: b.deliveryManRole || 'DELIVERY_MAN',
            amount: Number(b.finalSoldValue || b.totalCollectedAmount || 0),
            status: 'SETTLED',
            entityType: 'BATCH',
            entityId: b.batchNo,
            route: b.routeName,
            company: b.companyName,
            details: {
              batchId: b.id,
              batchNo: b.batchNo,
              route: b.routeName,
              deliveryMan: driverLabel,
              grossDispatchedValue: Number(b.grossDispatchedValue || 0),
              returnAdjustedValue: Number(b.returnAdjustedValue || 0),
              finalSoldValue: Number(b.finalSoldValue || 0),
              totalCollectedAmount: Number(b.totalCollectedAmount || 0),
              totalDueAmount: Number(b.totalDueAmount || 0),
              shortageOrExcess: Number(b.shortageOrExcess || 0),
              expenses: {
                vanRent: Number(b.vanRent || 0),
                salary: Number(b.salary || 0),
                total: Number(b.totalExpenses || 0),
              },
              settlementNote: b.settlementNote,
            },
          });
        }

        // Batch Returns Recorded Event
        if (
          b.returnsRecordedAt &&
          (!b.settledAt ||
            new Date(b.returnsRecordedAt).getTime() !==
              new Date(b.settledAt).getTime()) &&
          this.isWithin(b.returnsRecordedAt, startUtc, endUtc)
        ) {
          events.push({
            id: `batch-returns-${b.id}`,
            category: ActivityCategory.DELIVERY,
            action: 'RETURNS_RECORDED',
            title: `Returns Recorded for Batch ${b.batchNo}`,
            description: `Return products worth ৳${Number(b.returnAdjustedValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} recorded for route ${routeLabel}`,
            timestamp: this.toIsoString(b.returnsRecordedAt),
            userName: driverLabel,
            userRole: b.deliveryManRole || 'DELIVERY_MAN',
            amount: Number(b.returnAdjustedValue || 0),
            status: 'RETURNS_RECORDED',
            entityType: 'BATCH',
            entityId: b.batchNo,
            route: b.routeName,
            company: b.companyName,
            details: {
              batchId: b.id,
              batchNo: b.batchNo,
              returnAdjustedValue: Number(b.returnAdjustedValue || 0),
              deliveryMan: driverLabel,
            },
          });
        }

        // Batch Dispatched Event
        if (b.dispatchedAt && this.isWithin(b.dispatchedAt, startUtc, endUtc)) {
          events.push({
            id: `batch-dispatched-${b.id}`,
            category: ActivityCategory.DELIVERY,
            action: 'BATCH_DISPATCHED',
            title: `Batch ${b.batchNo} Dispatched`,
            description: `Loaded goods worth ৳${Number(b.grossDispatchedValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} dispatched for route ${routeLabel} to ${driverLabel}`,
            timestamp: this.toIsoString(b.dispatchedAt),
            userName: driverLabel,
            userRole: b.deliveryManRole || 'DELIVERY_MAN',
            amount: Number(b.grossDispatchedValue || 0),
            status: 'DISPATCHED',
            entityType: 'BATCH',
            entityId: b.batchNo,
            route: b.routeName,
            company: b.companyName,
            details: {
              batchId: b.id,
              batchNo: b.batchNo,
              route: b.routeName,
              deliveryMan: driverLabel,
              grossDispatchedValue: Number(b.grossDispatchedValue || 0),
            },
          });
        }

        // Batch Created Event (if created at different time than dispatch)
        if (
          b.createdAt &&
          (!b.dispatchedAt ||
            Math.abs(
              new Date(b.createdAt).getTime() -
                new Date(b.dispatchedAt).getTime(),
            ) > 60000) &&
          this.isWithin(b.createdAt, startUtc, endUtc)
        ) {
          events.push({
            id: `batch-created-${b.id}`,
            category: ActivityCategory.DELIVERY,
            action: 'BATCH_CREATED',
            title: `Dispatch Batch ${b.batchNo} Created`,
            description: `Created dispatch batch for route ${routeLabel}`,
            timestamp: this.toIsoString(b.createdAt),
            userName: 'Admin',
            userRole: 'ADMIN',
            amount: Number(b.grossDispatchedValue || 0),
            status: 'CREATED',
            entityType: 'BATCH',
            entityId: b.batchNo,
            route: b.routeName,
            company: b.companyName,
            details: {
              batchId: b.id,
              batchNo: b.batchNo,
              route: b.routeName,
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Error querying batch events: ${err?.message}`);
    }

    try {
      // 2. ORDERS (Created, Settled, Manual Due)
      const ordersQuery = `
        SELECT 
          o.id, o."orderDate", o."dispatchedAt", o."settledAt", o."createdAt", o."updatedAt",
          o.status, o."grandTotal", o."actualSoldAmount", o."collectedAmount", o."dueAmount",
          o."createdBy", o."createdByRole", o."settlementNote", o."deliveryNote",
          s.name as "shopName",
          s.ownerName as "shopOwner",
          r.name as "routeName",
          c.name as "companyName",
          u.name as "deliveryManName"
        FROM orders o
        LEFT JOIN shops s ON o."shopId" = s.id
        LEFT JOIN routes r ON o."routeId" = r.id
        LEFT JOIN companies c ON o."companyId" = c.id
        LEFT JOIN users u ON o."assignedDeliveryManId" = u.id
        WHERE 
          ${
            startUtc && endUtc
              ? `(
                  (o."createdAt" >= $1 AND o."createdAt" <= $2) OR
                  (o."settledAt" >= $1 AND o."settledAt" <= $2)
                )`
              : '1=1'
          }
        ORDER BY o.id DESC
        LIMIT 300
      `;

      const orders = await this.dataSource.query(
        ordersQuery,
        params.length > 0 ? params : [],
      );

      for (const o of orders) {
        const creator = o.createdBy || 'Admin';
        const role = o.createdByRole || 'ADMIN';
        const shopLabel = o.shopName || 'Market Orders';
        const routeLabel = o.routeName || '';

        // Order Settled Event
        if (
          o.settledAt &&
          o.status === 'SETTLED' &&
          this.isWithin(o.settledAt, startUtc, endUtc)
        ) {
          events.push({
            id: `order-settled-${o.id}`,
            category: ActivityCategory.ORDERS,
            action: 'ORDER_SETTLED',
            title: `Order #${o.id} Settled (${shopLabel})`,
            description: `Sold ৳${Number(o.actualSoldAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Collected ৳${Number(o.collectedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}${Number(o.dueAmount) > 0 ? `, Due ৳${Number(o.dueAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}`,
            timestamp: this.toIsoString(o.settledAt),
            userName: creator,
            userRole: role,
            amount: Number(o.actualSoldAmount || o.grandTotal || 0),
            status: 'SETTLED',
            entityType: 'ORDER',
            entityId: String(o.id),
            route: o.routeName,
            shop: o.shopName,
            company: o.companyName,
            details: {
              orderId: o.id,
              shopName: o.shopName,
              routeName: o.routeName,
              grandTotal: Number(o.grandTotal || 0),
              actualSoldAmount: Number(o.actualSoldAmount || 0),
              collectedAmount: Number(o.collectedAmount || 0),
              dueAmount: Number(o.dueAmount || 0),
              deliveryMan: o.deliveryManName,
              settlementNote: o.settlementNote,
            },
          });
        }

        // Order Created / Manual Due
        if (o.createdAt && this.isWithin(o.createdAt, startUtc, endUtc)) {
          const isManualDue = o.status === 'MANUAL_DUE';
          events.push({
            id: `order-created-${o.id}`,
            category: ActivityCategory.ORDERS,
            action: isManualDue ? 'ORDER_MANUAL_DUE' : 'ORDER_CREATED',
            title: isManualDue
              ? `Manual Due Order #${o.id} Created (${shopLabel})`
              : `Order #${o.id} Created (${shopLabel})`,
            description: `Order created by ${creator} for ৳${Number(o.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}${routeLabel ? ` on route ${routeLabel}` : ''}`,
            timestamp: this.toIsoString(o.createdAt),
            userName: creator,
            userRole: role,
            amount: Number(o.grandTotal || 0),
            status: o.status || 'PENDING',
            entityType: 'ORDER',
            entityId: String(o.id),
            route: o.routeName,
            shop: o.shopName,
            company: o.companyName,
            details: {
              orderId: o.id,
              shopName: o.shopName,
              routeName: o.routeName,
              grandTotal: Number(o.grandTotal || 0),
              status: o.status,
              createdBy: creator,
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Error querying order events: ${err?.message}`);
    }

    try {
      // 3. DUE COLLECTIONS (Collected, Approved, Rejected)
      const duesQuery = `
        SELECT 
          dc.id, dc."dueId", dc."orderId", dc."shopId", dc."routeId", dc."srId", dc."srName",
          dc."collectedAmount", dc."collectionDate", dc.note, dc.status, dc."approvedBy", dc."approvedAt",
          dc."rejectedReason", dc."createdAt", dc."updatedAt",
          s.name as "shopName",
          r.name as "routeName"
        FROM due_collections dc
        LEFT JOIN shops s ON dc."shopId" = s.id
        LEFT JOIN routes r ON dc."routeId" = r.id
        WHERE 
          ${
            startUtc && endUtc
              ? `(
                  (dc."createdAt" >= $1 AND dc."createdAt" <= $2) OR
                  (dc."approvedAt" >= $1 AND dc."approvedAt" <= $2)
                )`
              : '1=1'
          }
        ORDER BY dc.id DESC
        LIMIT 200
      `;

      const dueCollections = await this.dataSource.query(
        duesQuery,
        params.length > 0 ? params : [],
      );

      for (const dc of dueCollections) {
        const sr = dc.srName || 'SR';
        const shopLabel = dc.shopName || 'Shop';
        const amount = Number(dc.collectedAmount || 0);

        // Due Approved
        if (
          dc.approvedAt &&
          dc.status === 'APPROVED' &&
          this.isWithin(dc.approvedAt, startUtc, endUtc)
        ) {
          events.push({
            id: `due-approved-${dc.id}`,
            category: ActivityCategory.COLLECTIONS,
            action: 'DUE_COLLECTION_APPROVED',
            title: `Due Collection Approved for ${shopLabel}`,
            description: `৳${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} collected by ${sr} was approved by ${dc.approvedBy || 'Admin'}`,
            timestamp: this.toIsoString(dc.approvedAt),
            userName: dc.approvedBy || 'Admin',
            userRole: 'ADMIN',
            amount: amount,
            status: 'APPROVED',
            entityType: 'DUE_COLLECTION',
            entityId: String(dc.id),
            route: dc.routeName,
            shop: dc.shopName,
            details: {
              collectionId: dc.id,
              orderId: dc.orderId,
              shopName: dc.shopName,
              collectedAmount: amount,
              srName: sr,
              approvedBy: dc.approvedBy,
              note: dc.note,
            },
          });
        }

        // Due Collected
        if (dc.createdAt && this.isWithin(dc.createdAt, startUtc, endUtc)) {
          events.push({
            id: `due-collected-${dc.id}`,
            category: ActivityCategory.COLLECTIONS,
            action: 'DUE_COLLECTED',
            title: `Due Payment Collected from ${shopLabel}`,
            description: `৳${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} received by SR ${sr}${dc.note ? ` (Note: ${dc.note})` : ''}`,
            timestamp: this.toIsoString(dc.createdAt),
            userName: sr,
            userRole: 'SR',
            amount: amount,
            status: dc.status || 'PENDING',
            entityType: 'DUE_COLLECTION',
            entityId: String(dc.id),
            route: dc.routeName,
            shop: dc.shopName,
            details: {
              collectionId: dc.id,
              orderId: dc.orderId,
              shopName: dc.shopName,
              collectedAmount: amount,
              srName: sr,
              status: dc.status,
              note: dc.note,
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Error querying due collection events: ${err?.message}`);
    }

    try {
      // 4. STOCK MOVEMENTS (Returns, Damage, Purchases, Adjustments)
      const stockQuery = `
        SELECT 
          sm.id, sm."productId", sm."companyId", sm.type, sm.quantity, sm.note, sm.reference,
          sm."user", sm."createdAt", sm."balanceAfter",
          p.name as "productName",
          c.name as "companyName"
        FROM stock_movements sm
        LEFT JOIN products p ON sm."productId" = p.id
        LEFT JOIN companies c ON sm."companyId" = c.id
        WHERE 
          ${dateCondition('sm."createdAt"', 1)}
        ORDER BY sm.id DESC
        LIMIT 200
      `;

      const stockMovements = await this.dataSource.query(
        stockQuery,
        params.length > 0 ? params : [],
      );

      for (const sm of stockMovements) {
        const prodName = sm.productName || 'Product';
        const qty = Number(sm.quantity || 0);
        const actionType = `STOCK_${sm.type || 'MOVEMENT'}`;

        let title = `Stock Movement: ${prodName}`;
        if (sm.type === 'RETURN_IN') {
          title = `Return Stock Received: ${prodName} (+${qty})`;
        } else if (sm.type === 'DAMAGE_IN') {
          title = `Damaged Stock Recorded: ${prodName} (+${qty})`;
        } else if (sm.type === 'OUT' || sm.type === 'DISPATCH_OUT') {
          title = `Stock Dispatched: ${prodName} (-${qty})`;
        } else if (sm.type === 'PURCHASE_IN') {
          title = `Purchase Stock In: ${prodName} (+${qty})`;
        }

        events.push({
          id: `stock-move-${sm.id}`,
          category: ActivityCategory.STOCK,
          action: actionType,
          title,
          description:
            sm.note ||
            `${sm.type} of ${qty} units. Balance after: ${sm.balanceAfter || 0}`,
          timestamp: this.toIsoString(sm.createdAt),
          userName: sm.user || 'Admin',
          userRole: 'ADMIN',
          amount: null,
          status: sm.type,
          entityType: 'PRODUCT',
          entityId: String(sm.productId),
          company: sm.companyName,
          details: {
            movementId: sm.id,
            productId: sm.productId,
            productName: sm.productName,
            companyName: sm.companyName,
            type: sm.type,
            quantity: qty,
            balanceAfter: Number(sm.balanceAfter || 0),
            reference: sm.reference,
            note: sm.note,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Error querying stock movement events: ${err?.message}`);
    }

    try {
      // 5. PURCHASES & COMPANY PAYMENTS
      const purchasesQuery = `
        SELECT 
          p.id, p."purchaseDate", p."invoiceNo", p."companyId", p."supplierName",
          p."totalAmount", p."paidAmount", p."dueAmount", p.status, p.note, p."createdAt",
          c.name as "companyName"
        FROM purchases p
        LEFT JOIN companies c ON p."companyId" = c.id
        WHERE 
          ${dateCondition('p."createdAt"', 1)}
        ORDER BY p.id DESC
        LIMIT 100
      `;

      const purchases = await this.dataSource.query(
        purchasesQuery,
        params.length > 0 ? params : [],
      );

      for (const p of purchases) {
        events.push({
          id: `purchase-${p.id}`,
          category: ActivityCategory.PURCHASES,
          action: 'PURCHASE_CREATED',
          title: `Purchase Invoice #${p.invoiceNo} (${p.companyName || 'Company'})`,
          description: `Total ৳${Number(p.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Paid ৳${Number(p.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}${p.supplierName ? `, Supplier: ${p.supplierName}` : ''}`,
          timestamp: this.toIsoString(p.createdAt),
          userName: 'Admin',
          userRole: 'ADMIN',
          amount: Number(p.totalAmount || 0),
          status: p.status || 'DRAFT',
          entityType: 'PURCHASE',
          entityId: p.invoiceNo,
          company: p.companyName,
          details: {
            purchaseId: p.id,
            invoiceNo: p.invoiceNo,
            supplierName: p.supplierName,
            companyName: p.companyName,
            totalAmount: Number(p.totalAmount || 0),
            paidAmount: Number(p.paidAmount || 0),
            dueAmount: Number(p.dueAmount || 0),
            status: p.status,
          },
        });
      }

      // Company Payments
      const paymentsQuery = `
        SELECT 
          cp.id, cp."companyId", cp.amount, cp."paymentDate", cp."paymentMethod", cp."transactionRef",
          cp.note, cp."createdByName", cp."createdAt",
          c.name as "companyName"
        FROM company_payments cp
        LEFT JOIN companies c ON cp."companyId" = c.id
        WHERE 
          ${dateCondition('cp."createdAt"', 1)}
        ORDER BY cp.id DESC
        LIMIT 100
      `;

      const payments = await this.dataSource.query(
        paymentsQuery,
        params.length > 0 ? params : [],
      );

      for (const cp of payments) {
        events.push({
          id: `comp-pay-${cp.id}`,
          category: ActivityCategory.PURCHASES,
          action: 'COMPANY_PAYMENT',
          title: `Company Payment Paid to ${cp.companyName || 'Partner'}`,
          description: `Paid ৳${Number(cp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} via ${cp.paymentMethod || 'CASH'}${cp.transactionRef ? ` (Ref: ${cp.transactionRef})` : ''}`,
          timestamp: this.toIsoString(cp.createdAt),
          userName: cp.createdByName || 'Admin',
          userRole: 'ADMIN',
          amount: Number(cp.amount || 0),
          status: 'PAID',
          entityType: 'COMPANY_PAYMENT',
          entityId: String(cp.id),
          company: cp.companyName,
          details: {
            paymentId: cp.id,
            companyName: cp.companyName,
            amount: Number(cp.amount || 0),
            paymentMethod: cp.paymentMethod,
            transactionRef: cp.transactionRef,
            note: cp.note,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Error querying purchase events: ${err?.message}`);
    }

    try {
      // 6. EXPLICIT ACTIVITY LOGS TABLE
      const logsQuery = `
        SELECT 
          id, category, action, "entityType", "entityId", title, description, details,
          "userId", "userName", "userRole", "ipAddress", "createdAt"
        FROM activity_logs
        WHERE 
          ${dateCondition('"createdAt"', 1)}
        ORDER BY id DESC
        LIMIT 200
      `;

      const explicitLogs = await this.dataSource.query(
        logsQuery,
        params.length > 0 ? params : [],
      );

      for (const log of explicitLogs) {
        events.push({
          id: `log-${log.id}`,
          category: log.category || ActivityCategory.SYSTEM,
          action: log.action || 'CUSTOM_ACTION',
          title: log.title,
          description: log.description,
          timestamp: this.toIsoString(log.createdAt),
          userName: log.userName || 'System',
          userRole: log.userRole || 'SYSTEM',
          amount: log.details?.amount ? Number(log.details.amount) : null,
          status: log.details?.status || 'LOGGED',
          entityType: log.entityType,
          entityId: log.entityId,
          details: log.details,
        });
      }
    } catch (err: any) {
      // If table doesn't exist yet, it's ok
    }

    return events;
  }

  /**
   * Helper to normalize database timestamp to true UTC ISO string.
   * Since Postgres timestamp columns without timezone store Bangladesh local wall-clock time,
   * subtracting 6 hours aligns it to UTC so frontend formatting in Asia/Dhaka is exact.
   */
  private toIsoString(dateVal: any): string {
    if (!dateVal) return new Date().toISOString();
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return new Date().toISOString();

    const trueUtcMs = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours() - 6,
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    );
    return new Date(trueUtcMs).toISOString();
  }

  /**
   * Helper to check if a date is within [startUtc, endUtc]
   */
  private isWithin(dateVal: any, startUtc?: Date, endUtc?: Date): boolean {
    if (!dateVal) return false;
    if (!startUtc || !endUtc) return true;
    const d = new Date(dateVal).getTime();
    return d >= startUtc.getTime() && d <= endUtc.getTime();
  }

  /**
   * Calculates UTC Start and End boundaries for Bangladesh Time (Asia/Dhaka, UTC+6)
   */
  private calculateDateRangeUtc(
    period: string,
    customStart?: string,
    customEnd?: string,
  ): { startUtc?: Date; endUtc?: Date } {
    if (period === 'all') {
      return {};
    }

    const now = new Date();
    // Offset for Asia/Dhaka (+6 hours)
    const bstOffsetMs = 6 * 60 * 60 * 1000;
    const nowBst = new Date(now.getTime() + bstOffsetMs);

    const year = nowBst.getUTCFullYear();
    const month = nowBst.getUTCMonth();
    const date = nowBst.getUTCDate();

    let startBst: Date;
    let endBst: Date;

    if (period === 'today') {
      startBst = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
      endBst = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
    } else if (period === 'yesterday') {
      startBst = new Date(Date.UTC(year, month, date - 1, 0, 0, 0, 0));
      endBst = new Date(Date.UTC(year, month, date - 1, 23, 59, 59, 999));
    } else if (period === 'last_7_days') {
      startBst = new Date(Date.UTC(year, month, date - 6, 0, 0, 0, 0));
      endBst = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
    } else if (period === 'this_month') {
      startBst = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      endBst = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
    } else if (customStart && customEnd) {
      const [sy, sm, sd] = customStart.split('-').map(Number);
      const [ey, em, ed] = customEnd.split('-').map(Number);
      startBst = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0));
      endBst = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));
    } else {
      startBst = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
      endBst = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
    }

    // Convert back from BST local representation to absolute UTC
    const startUtc = new Date(startBst.getTime() - bstOffsetMs);
    const endUtc = new Date(endBst.getTime() - bstOffsetMs);

    return { startUtc, endUtc };
  }
}
