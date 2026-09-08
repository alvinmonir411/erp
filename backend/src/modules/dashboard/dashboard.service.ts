import {
  getBDDayRange,
  isTodayBD,
  isTodayBDDate,
  getBDTodayString,
  getBDMonthRange,
  getBDDateRangeForPeriod,
  BDMonthRange,
  BDPeriodRange,
} from '../../common/utils/date.utils';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository, DataSource } from 'typeorm';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/orders.constants';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Injectable, Logger } from '@nestjs/common';

import { Role } from '../../common/enums/role.enum';
import { Due } from '../dues/entities/due.entity';
import {
  DueCollection,
  CollectionStatus,
} from '../dues/entities/due-collection.entity';
import { ProductsService } from '../products/products.service';
import { DispatchBatch } from '../delivery-ops/entities/dispatch-batch.entity';

export interface DashboardQueryOptions {
  period?: string; // 'today' | 'last_7_days' | 'this_month' | 'last_month' | 'this_year' | 'custom' | 'all_time'
  month?: number;  // 1-12
  year?: number;   // e.g. 2026
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(StockMovement)
    private readonly movementsRepository: Repository<StockMovement>,
    @InjectRepository(Due)
    private readonly duesRepository: Repository<Due>,
    @InjectRepository(DueCollection)
    private readonly collectionsRepository: Repository<DueCollection>,
    private readonly productsService: ProductsService,
    private readonly dataSource: DataSource,
  ) {}
  private readonly logger = new Logger(DashboardService.name);

  async getDashboardData(
    companyId?: number,
    user?: any,
    options: DashboardQueryOptions = {},
  ) {
    const { startUtc: todayStartUTC, endUtc: todayEndUTC } = getBDDayRange();
    const todayDateStr = getBDTodayString();
    const safeNum = (val: any) => {
      const n = Number(val);
      return isFinite(n) ? n : 0;
    };

    // Filter based on role
    const isSR = user?.role === Role.SR;
    const userId = user?.id || user?.sub;

    const where: any = companyId ? { companyId } : {};
    if (isSR) {
      if (!userId)
        return { uiMetrics: null, charts: { last7Days: [], monthlyTrend: [] }, recentOrders: [] };
      where.createdById = userId;
    }

    // 0. Parse Period and Date Range using standardized BD timezone helper
    const period = options.period || 'this_month';
    const dateRange = getBDDateRangeForPeriod(
      period,
      options.year,
      options.month,
    );
    const {
      startDateStr,
      endDateStr,
      startUtc,
      endUtc,
      periodStartDateStr,
      periodEndDateStr,
      periodStartUtc,
      periodEndUtc,
      periodLabel,
      isAllTime,
    } = dateRange;

    // 1. Conditional SQL Aggregations for Orders (All-Time, Period, & Today)
    let aggResult: any;
    if (companyId) {
      const qb = this.ordersRepository
        .createQueryBuilder('order')
        .innerJoin('order.items', 'item')
        .innerJoin('item.product', 'product')
        .where('product.companyId = :companyId', { companyId });

      if (isSR) {
        qb.andWhere('order.createdById = :userId', { userId });
      }

      // Period condition sql snippet
      const periodCondition = isAllTime
        ? '1=1'
        : `order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr`;
      const periodSettledCondition = isAllTime
        ? '1=1'
        : `order.settledAt >= :periodStartUtc AND order.settledAt <= :periodEndUtc`;

      aggResult = await qb
        // Lifetime / All-time totals
        .select('COUNT(DISTINCT order.id)', 'lifetimeOrdersCount')
        .addSelect(
          "SUM(CASE WHEN order.status <> 'CANCELLED' THEN COALESCE(item.lineTotal, 0) ELSE 0 END)",
          'lifetimeOrderValue',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN order.status = 'CANCELLED' THEN order.id END)",
          'lifetimeCancelledCount',
        )
        .addSelect(
          `SUM(CASE WHEN order.status IN ('SETTLED', 'PARTIAL_DUE') THEN
            COALESCE(item.deliveredPaidQuantity, 0) * (
              CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
              ELSE COALESCE(item.unitPrice, 0) END
            )
          ELSE 0 END)`,
          'lifetimeNetSales',
        )

        // Period (This Month / Selected Month) metrics
        .addSelect(
          `COUNT(DISTINCT CASE WHEN (${periodCondition}) AND order.status <> 'CANCELLED' THEN order.id END)`,
          'periodOrdersCount',
        )
        .addSelect(
          `SUM(CASE WHEN (${periodCondition}) AND order.status <> 'CANCELLED' THEN COALESCE(item.lineTotal, 0) ELSE 0 END)`,
          'periodOrderValue',
        )
        .addSelect(
          `COUNT(DISTINCT CASE WHEN (${periodCondition}) AND order.status = 'CANCELLED' THEN order.id END)`,
          'periodCancelledCount',
        )
        .addSelect(
          `SUM(CASE WHEN order.status IN ('SETTLED', 'PARTIAL_DUE') AND (${periodCondition} OR ${periodSettledCondition}) THEN
            COALESCE(item.deliveredPaidQuantity, 0) * (
              CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
              ELSE COALESCE(item.unitPrice, 0) END
            )
          ELSE 0 END)`,
          'periodNetSales',
        )

        // Daily (today) metrics
        .addSelect(
          "COUNT(DISTINCT CASE WHEN order.orderDate = :todayDateStr AND order.status <> 'CANCELLED' THEN order.id END)",
          'todayOrdersCount',
        )
        .addSelect(
          "SUM(CASE WHEN order.orderDate = :todayDateStr AND order.status <> 'CANCELLED' THEN COALESCE(item.lineTotal, 0) ELSE 0 END)",
          'todayOrderValue',
        )
        .addSelect(
          'COUNT(DISTINCT CASE WHEN order.dispatchedAt >= :todayStartUTC AND order.dispatchedAt <= :todayEndUTC THEN order.id END)',
          'todayDispatchCount',
        )
        .addSelect(
          'SUM(CASE WHEN order.dispatchedAt >= :todayStartUTC AND order.dispatchedAt <= :todayEndUTC THEN COALESCE(item.lineTotal, 0) ELSE 0 END)',
          'todayDispatchValue',
        )
        .addSelect(
          `SUM(CASE WHEN order.status IN ('SETTLED', 'PARTIAL_DUE') AND order.settledAt >= :todayStartUTC AND order.settledAt <= :todayEndUTC THEN
            COALESCE(item.deliveredPaidQuantity, 0) * (
              CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
              ELSE COALESCE(item.unitPrice, 0) END
            )
          ELSE 0 END)`,
          'todaySettledValue',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN order.status = 'CANCELLED' AND order.updatedAt >= :todayStartUTC AND order.updatedAt <= :todayEndUTC THEN order.id END)",
          'todayCancelledCount',
        )

        // Delivery status totals for period
        .addSelect(
          `COUNT(DISTINCT CASE WHEN (${periodCondition}) AND order.dispatchedAt IS NOT NULL THEN order.id END)`,
          'periodDispatchOrdersCount',
        )
        .addSelect(
          `COUNT(DISTINCT CASE WHEN (${periodCondition}) AND order.status IN ('CONFIRMED', 'ASSIGNED') THEN order.id END)`,
          'periodPendingDispatchCount',
        )
        .addSelect(
          `COUNT(DISTINCT CASE WHEN (${periodCondition}) AND order.status IN ('DELIVERED', 'SETTLED') THEN order.id END)`,
          'periodDeliveredCount',
        )
        .setParameters({
          todayStartUTC,
          todayEndUTC,
          companyId,
          todayDateStr,
          periodStartDateStr,
          periodEndDateStr,
          periodStartUtc,
          periodEndUtc,
        })
        .getRawOne();
    } else {
      const baseQb = this.ordersRepository.createQueryBuilder('order');
      if (isSR) {
        baseQb.andWhere('order.createdById = :userId', { userId });
      }

      const periodCondition = isAllTime
        ? '1=1'
        : `order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr`;
      const periodSettledCondition = isAllTime
        ? '1=1'
        : `order.settledAt >= :periodStartUtc AND order.settledAt <= :periodEndUtc`;

      aggResult = await baseQb
        // Lifetime / All-time totals
        .select('COUNT(order.id)', 'lifetimeOrdersCount')
        .addSelect(
          `SUM(CASE WHEN order.status <> 'CANCELLED' THEN COALESCE(order.grandTotal, 0) ELSE 0 END)`,
          'lifetimeOrderValue',
        )
        .addSelect(
          `SUM(CASE WHEN order.status = 'CANCELLED' THEN 1 ELSE 0 END)`,
          'lifetimeCancelledCount',
        )
        .addSelect(
          `SUM(CASE WHEN order.status IN ('SETTLED', 'PARTIAL_DUE') THEN COALESCE(order.actualSoldAmount, 0) ELSE 0 END)`,
          'lifetimeNetSales',
        )

        // Period (This Month / Selected Month) metrics
        .addSelect(
          `COUNT(CASE WHEN (${periodCondition}) AND order.status <> 'CANCELLED' THEN 1 END)`,
          'periodOrdersCount',
        )
        .addSelect(
          `SUM(CASE WHEN (${periodCondition}) AND order.status <> 'CANCELLED' THEN COALESCE(order.grandTotal, 0) ELSE 0 END)`,
          'periodOrderValue',
        )
        .addSelect(
          `COUNT(CASE WHEN (${periodCondition}) AND order.status = 'CANCELLED' THEN 1 END)`,
          'periodCancelledCount',
        )
        .addSelect(
          `SUM(CASE WHEN order.status IN ('SETTLED', 'PARTIAL_DUE') AND (${periodCondition} OR ${periodSettledCondition}) THEN COALESCE(order.actualSoldAmount, 0) ELSE 0 END)`,
          'periodNetSales',
        )

        // Daily (today) metrics
        .addSelect(
          `COUNT(CASE WHEN order.orderDate = :todayDateStr AND order.status <> 'CANCELLED' THEN 1 END)`,
          'todayOrdersCount',
        )
        .addSelect(
          `SUM(CASE WHEN order.orderDate = :todayDateStr AND order.status <> 'CANCELLED' THEN COALESCE(order.grandTotal, 0) ELSE 0 END)`,
          'todayOrderValue',
        )
        .addSelect(
          `COUNT(CASE WHEN order.dispatchedAt >= :todayStartUTC AND order.dispatchedAt <= :todayEndUTC THEN 1 END)`,
          'todayDispatchCount',
        )
        .addSelect(
          `SUM(CASE WHEN order.dispatchedAt >= :todayStartUTC AND order.dispatchedAt <= :todayEndUTC THEN COALESCE(order.grandTotal, 0) ELSE 0 END)`,
          'todayDispatchValue',
        )
        .addSelect(
          `SUM(CASE WHEN order.status IN ('SETTLED', 'PARTIAL_DUE') AND order.settledAt >= :todayStartUTC AND order.settledAt <= :todayEndUTC THEN COALESCE(order.actualSoldAmount, 0) ELSE 0 END)`,
          'todaySettledValue',
        )
        .addSelect(
          `COUNT(CASE WHEN order.status = 'CANCELLED' AND order.updatedAt >= :todayStartUTC AND order.updatedAt <= :todayEndUTC THEN 1 END)`,
          'todayCancelledCount',
        )

        // Delivery status totals
        .addSelect(
          `COUNT(CASE WHEN (${periodCondition}) AND order.dispatchedAt IS NOT NULL THEN 1 END)`,
          'periodDispatchOrdersCount',
        )
        .addSelect(
          `COUNT(CASE WHEN (${periodCondition}) AND order.status IN ('CONFIRMED', 'ASSIGNED') THEN 1 END)`,
          'periodPendingDispatchCount',
        )
        .addSelect(
          `COUNT(CASE WHEN (${periodCondition}) AND order.status IN ('DELIVERED', 'SETTLED') THEN 1 END)`,
          'periodDeliveredCount',
        )
        .setParameters({
          todayStartUTC,
          todayEndUTC,
          todayDateStr,
          periodStartDateStr,
          periodEndDateStr,
          periodStartUtc,
          periodEndUtc,
        })
        .getRawOne();
    }

    // 2. Profit calculation (Period Profit & Lifetime Profit)
    const canViewProfit =
      user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER;

    let periodProfit = 0;
    let lifetimeProfit = 0;

    if (canViewProfit) {
      try {
        const profitQb = this.orderItemsRepository
          .createQueryBuilder('item')
          .leftJoin('item.product', 'product')
          .leftJoin('item.order', 'order')
          .select(
            `SUM(
              COALESCE(item.deliveredPaidQuantity, 0) * (
                CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
                ELSE COALESCE(item.unitPrice, 0) END - COALESCE(product.buyPrice, 0)
              )
            )`,
            'lifetimeProfit',
          )
          .where('order.status IN (:...statuses)', {
            statuses: [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE],
          });

        if (companyId) {
          profitQb.andWhere('product.companyId = :companyId', { companyId });
        }
        if (isSR) {
          profitQb.andWhere('order.createdById = :userId', { userId });
        }

        const lifetimeProfitRes = await profitQb.getRawOne();
        lifetimeProfit = safeNum(lifetimeProfitRes?.lifetimeProfit);

        // Calculate Period Profit
        const periodProfitQb = this.orderItemsRepository
          .createQueryBuilder('item')
          .leftJoin('item.product', 'product')
          .leftJoin('item.order', 'order')
          .select(
            `SUM(
              COALESCE(item.deliveredPaidQuantity, 0) * (
                CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
                ELSE COALESCE(item.unitPrice, 0) END - COALESCE(product.buyPrice, 0)
              )
            )`,
            'periodProfit',
          )
          .where('order.status IN (:...statuses)', {
            statuses: [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE],
          });

        if (!isAllTime && periodStartDateStr && periodEndDateStr) {
          periodProfitQb.andWhere(
            '(order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr OR (order.settledAt >= :periodStartUtc AND order.settledAt <= :periodEndUtc))',
            { periodStartDateStr, periodEndDateStr, periodStartUtc, periodEndUtc },
          );
        }
        if (companyId) {
          periodProfitQb.andWhere('product.companyId = :companyId', { companyId });
        }
        if (isSR) {
          periodProfitQb.andWhere('order.createdById = :userId', { userId });
        }

        const periodProfitRes = await periodProfitQb.getRawOne();
        periodProfit = safeNum(periodProfitRes?.periodProfit);
      } catch (err) {
        this.logger.error('Error calculating profit for dashboard:', err.message);
      }
    }

    // 3. Dues and Collections metrics via database aggregations
    let totalDueAmount = 0; // Current Live Total Due (Never resets)
    let todayDueAmount = 0;
    let periodDueAmount = 0;
    let todayCollectedAmount = 0;
    let periodCollectedAmount = 0;
    let pendingCollected = 0;
    let approvedCollected = 0;
    let rejectedCollected = 0;

    try {
      // Current Outstanding Total Due across all time
      const duesQb = this.duesRepository
        .createQueryBuilder('due')
        .leftJoin('due.order', 'order');
      if (companyId) {
        duesQb
          .innerJoin('order.items', 'item')
          .innerJoin('item.product', 'product')
          .andWhere('product.companyId = :companyId', { companyId });
      }
      if (isSR) duesQb.andWhere('due.srId = :userId', { userId });

      const dueRes = await duesQb
        .select('SUM(COALESCE(due.remainingDue, 0))', 'totalDue')
        .getRawOne();
      totalDueAmount = safeNum(dueRes?.totalDue);

      // Today's new due created
      const todayDuesQb = this.duesRepository
        .createQueryBuilder('due')
        .innerJoin('due.order', 'order')
        .select('SUM(COALESCE(due.dueAmount, 0))', 'todayDue')
        .where('order.orderDate = :todayDateStr', { todayDateStr });
      if (companyId) {
        todayDuesQb
          .innerJoin('order.items', 'item')
          .innerJoin('item.product', 'product')
          .andWhere('product.companyId = :companyId', { companyId });
      }
      if (isSR) todayDuesQb.andWhere('due.srId = :userId', { userId });
      const todayDueRes = await todayDuesQb.getRawOne();
      todayDueAmount = safeNum(todayDueRes?.todayDue);

      // Period's new due created
      const periodDuesQb = this.duesRepository
        .createQueryBuilder('due')
        .innerJoin('due.order', 'order')
        .select('SUM(COALESCE(due.dueAmount, 0))', 'periodDue');
      if (!isAllTime && periodStartDateStr && periodEndDateStr) {
        periodDuesQb.where(
          'order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr',
          { periodStartDateStr, periodEndDateStr },
        );
      }
      if (companyId) {
        periodDuesQb
          .innerJoin('order.items', 'item')
          .innerJoin('item.product', 'product')
          .andWhere('product.companyId = :companyId', { companyId });
      }
      if (isSR) periodDuesQb.andWhere('due.srId = :userId', { userId });
      const periodDueRes = await periodDuesQb.getRawOne();
      periodDueAmount = safeNum(periodDueRes?.periodDue);

      // Collections Breakdown (Pending, Approved, Rejected)
      const collQb = this.collectionsRepository
        .createQueryBuilder('coll')
        .leftJoin('coll.order', 'order');
      if (companyId) {
        collQb
          .innerJoin('order.items', 'item')
          .innerJoin('item.product', 'product')
          .andWhere('product.companyId = :companyId', { companyId });
      }
      if (isSR) collQb.andWhere('coll.srId = :userId', { userId });

      const collRes = await collQb
        .select(
          `SUM(CASE WHEN coll.status = :pending THEN COALESCE(coll.collectedAmount, 0) ELSE 0 END)`,
          'pending',
        )
        .addSelect(
          `SUM(CASE WHEN coll.status = :approved THEN COALESCE(coll.collectedAmount, 0) ELSE 0 END)`,
          'approved',
        )
        .addSelect(
          `SUM(CASE WHEN coll.status = :rejected THEN COALESCE(coll.collectedAmount, 0) ELSE 0 END)`,
          'rejected',
        )
        .setParameters({
          pending: CollectionStatus.PENDING,
          approved: CollectionStatus.APPROVED,
          rejected: CollectionStatus.REJECTED,
        })
        .getRawOne();

      pendingCollected = safeNum(collRes?.pending);
      approvedCollected = safeNum(collRes?.approved);
      rejectedCollected = safeNum(collRes?.rejected);

      // Fetch Today's approved due collections
      const todayCollQb = this.collectionsRepository
        .createQueryBuilder('coll')
        .leftJoin('coll.order', 'order')
        .select('SUM(COALESCE(coll.collectedAmount, 0))', 'todayCollected')
        .where('coll.status = :approved', {
          approved: CollectionStatus.APPROVED,
        })
        .andWhere(
          'coll.createdAt >= :todayStartUTC AND coll.createdAt <= :todayEndUTC',
          { todayStartUTC, todayEndUTC },
        );
      if (companyId) {
        todayCollQb
          .innerJoin('order.items', 'item')
          .innerJoin('item.product', 'product')
          .andWhere('product.companyId = :companyId', { companyId });
      }
      if (isSR) todayCollQb.andWhere('coll.srId = :userId', { userId });
      const todayCollRes = await todayCollQb.getRawOne();
      todayCollectedAmount = safeNum(todayCollRes?.todayCollected);

      // Fetch Period's approved due collections
      const periodCollQb = this.collectionsRepository
        .createQueryBuilder('coll')
        .leftJoin('coll.order', 'order')
        .select('SUM(COALESCE(coll.collectedAmount, 0))', 'periodCollected')
        .where('coll.status = :approved', {
          approved: CollectionStatus.APPROVED,
        });

      if (!isAllTime && periodStartUtc && periodEndUtc) {
        periodCollQb.andWhere(
          'coll.createdAt >= :periodStartUtc AND coll.createdAt <= :periodEndUtc',
          { periodStartUtc, periodEndUtc },
        );
      }
      if (companyId) {
        periodCollQb
          .innerJoin('order.items', 'item')
          .innerJoin('item.product', 'product')
          .andWhere('product.companyId = :companyId', { companyId });
      }
      if (isSR) periodCollQb.andWhere('coll.srId = :userId', { userId });
      const periodCollRes = await periodCollQb.getRawOne();
      periodCollectedAmount = safeNum(periodCollRes?.periodCollected);
    } catch (err) {
      this.logger.error(
        'Error fetching dues/collections for dashboard:',
        err.message,
      );
    }

    // 4. Dispatch Batches Metrics
    const batchRepo = this.dataSource.getRepository(DispatchBatch);
    const batchQb = batchRepo.createQueryBuilder('batch');

    if (companyId) {
      batchQb.andWhere('batch.companyId = :companyId', { companyId });
    }

    if (isSR) {
      batchQb.innerJoin('batch.orders', 'batchOrder')
        .innerJoin('batchOrder.order', 'order')
        .andWhere('order.createdById = :userId', { userId });
    }

    const batchMetrics = await batchQb
      .select(
        "COUNT(DISTINCT CASE WHEN batch.dispatchedAt >= :todayStartUTC AND batch.dispatchedAt <= :todayEndUTC AND batch.status <> 'CANCELLED' THEN batch.id END)",
        'todayDispatchCount',
      )
      .addSelect(
        isAllTime
          ? "COUNT(DISTINCT CASE WHEN batch.dispatchedAt IS NOT NULL AND batch.status <> 'CANCELLED' THEN batch.id END)"
          : "COUNT(DISTINCT CASE WHEN batch.dispatchedAt >= :periodStartUtc AND batch.dispatchedAt <= :periodEndUtc AND batch.status <> 'CANCELLED' THEN batch.id END)",
        'periodDispatchCount',
      )
      .setParameters({
        todayStartUTC,
        todayEndUTC,
        periodStartUtc,
        periodEndUtc,
      })
      .getRawOne();

    const todayDispatchCount = safeNum(batchMetrics?.todayDispatchCount);
    const periodDispatchCount = safeNum(batchMetrics?.periodDispatchCount);

    // 5. Stock metrics from ProductsService (Live State)
    let productMetrics: any = {
      totalProducts: 0,
      stockValue: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      inStockProducts: 0,
    };
    try {
      productMetrics = await this.productsService.getSummary(companyId);
    } catch (err) {
      this.logger.error('Error fetching stock for dashboard:', err.message);
    }

    // 6. Recent Orders (Newest 10)
    const recentOrders = await this.ordersRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 10,
    });

    // 7. Charts:
    // A) Last 7 Days (Always for fast rolling trend)
    const last7Days = [];
    const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
    const startOfTodayBD = new Date(new Date().getTime() + BD_OFFSET_MS);
    startOfTodayBD.setUTCHours(0, 0, 0, 0);

    const startRange7DaysUtc = new Date(
      startOfTodayBD.getTime() - 6 * 24 * 60 * 60 * 1000 - BD_OFFSET_MS,
    );

    const chart7DaysQb = this.ordersRepository.createQueryBuilder('order');
    if (companyId) {
      chart7DaysQb
        .innerJoin('order.items', 'item')
        .innerJoin('item.product', 'product')
        .select(
          `DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`,
          'dayDate',
        )
        .addSelect(
          `SUM(
            COALESCE(item.deliveredPaidQuantity, 0) * (
              CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
              ELSE COALESCE(item.unitPrice, 0) END
            )
          )`,
          'daySales',
        )
        .where('order.status IN (:...statuses)', { statuses: [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE] })
        .andWhere('product.companyId = :companyId', { companyId })
        .andWhere('order.settledAt >= :startRange7DaysUtc', { startRange7DaysUtc })
        .groupBy(`DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`);
    } else {
      chart7DaysQb
        .select(
          `DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`,
          'dayDate',
        )
        .addSelect('SUM(COALESCE(order.actualSoldAmount, 0))', 'daySales')
        .where('order.status IN (:...statuses)', { statuses: [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE] })
        .andWhere('order.settledAt >= :startRange7DaysUtc', { startRange7DaysUtc })
        .groupBy(`DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`);
    }

    if (isSR) chart7DaysQb.andWhere('order.createdById = :userId', { userId });
    const chart7DaysData = await chart7DaysQb.getRawMany();
    const chart7Map = new Map<string, number>();
    for (const row of chart7DaysData) {
      if (row.dayDate) {
        const dStr = new Date(row.dayDate).toISOString().split('T')[0];
        chart7Map.set(dStr, safeNum(row.daySales));
      }
    }

    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfTodayBD.getTime() - i * 24 * 60 * 60 * 1000);
      const dKey = d.toISOString().split('T')[0];
      const salesAmount = chart7Map.get(dKey) || 0;

      last7Days.push({
        date: d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          timeZone: 'Asia/Dhaka',
        }),
        amount: salesAmount,
      });
    }

    // B) Month Daily Breakdown Chart (from Day 1 to totalDays: 28/29/30/31)
    const monthlyTrend = [];
    const chartMonthRange =
      dateRange.month && dateRange.year
        ? getBDMonthRange(dateRange.year, dateRange.month)
        : getBDMonthRange();

    if (chartMonthRange) {
      const { startUtc, endUtc, totalDays, year, month, monthName } =
        chartMonthRange;
      const monthChartQb = this.ordersRepository.createQueryBuilder('order');
      if (companyId) {
        monthChartQb
          .innerJoin('order.items', 'item')
          .innerJoin('item.product', 'product')
          .select(
            `DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`,
            'dayDate',
          )
          .addSelect(
            `SUM(
              COALESCE(item.deliveredPaidQuantity, 0) * (
                CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
                ELSE COALESCE(item.unitPrice, 0) END
              )
            )`,
            'daySales',
          )
          .where('order.status IN (:...statuses)', {
            statuses: [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE],
          })
          .andWhere('product.companyId = :companyId', { companyId })
          .andWhere(
            'order.settledAt >= :startUtc AND order.settledAt <= :endUtc',
            { startUtc, endUtc },
          )
          .groupBy(`DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`);
      } else {
        monthChartQb
          .select(
            `DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`,
            'dayDate',
          )
          .addSelect('SUM(COALESCE(order.actualSoldAmount, 0))', 'daySales')
          .where('order.status IN (:...statuses)', {
            statuses: [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE],
          })
          .andWhere(
            'order.settledAt >= :startUtc AND order.settledAt <= :endUtc',
            { startUtc, endUtc },
          )
          .groupBy(`DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`);
      }

      if (isSR) monthChartQb.andWhere('order.createdById = :userId', { userId });
      const monthChartData = await monthChartQb.getRawMany();
      const monthMap = new Map<string, number>();
      for (const row of monthChartData) {
        if (row.dayDate) {
          const dStr = new Date(row.dayDate).toISOString().split('T')[0];
          monthMap.set(dStr, safeNum(row.daySales));
        }
      }

      for (let dNum = 1; dNum <= totalDays; dNum++) {
        const dStr = `${year}-${String(month).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
        const salesAmount = monthMap.get(dStr) || 0;
        monthlyTrend.push({
          day: dNum,
          date: dStr,
          label: `${dNum} ${monthName.slice(0, 3)}`,
          amount: salesAmount,
        });
      }
    }

    // 8. Company-wise Sales & Profit for Selected Period
    const salesQb = this.orderItemsRepository
      .createQueryBuilder('item')
      .leftJoin('item.order', 'order')
      .leftJoin('item.product', 'product')
      .leftJoin('product.company', 'company')
      .select('product.companyId', 'companyId')
      .addSelect('company.name', 'companyName')
      .addSelect(
        `SUM(
          COALESCE(item.deliveredPaidQuantity, 0) * (
            CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
            ELSE COALESCE(item.unitPrice, 0) END
          )
        )`,
        'sales',
      )
      .where('order.status IN (:...statuses)', { statuses: [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE] });

    if (!isAllTime && periodStartDateStr && periodEndDateStr) {
      salesQb.andWhere(
        '(order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr OR (order.settledAt >= :periodStartUtc AND order.settledAt <= :periodEndUtc))',
        { periodStartDateStr, periodEndDateStr, periodStartUtc, periodEndUtc },
      );
    }
    if (companyId) {
      salesQb.andWhere('product.companyId = :companyId', { companyId });
    }
    if (isSR) {
      salesQb.andWhere('order.createdById = :userId', { userId });
    }

    const salesData = await salesQb
      .groupBy('product.companyId')
      .addGroupBy('company.name')
      .getRawMany();

    const companyMap = new Map<
      number,
      { companyId: number; companyName: string; sales: number; profit: number }
    >();

    for (const s of salesData) {
      const cId = Number(s.companyId);
      companyMap.set(cId, {
        companyId: cId,
        companyName: s.companyName || `Company #${cId}`,
        sales: safeNum(s.sales),
        profit: 0,
      });
    }

    if (canViewProfit) {
      try {
        const companyProfitQb = this.orderItemsRepository
          .createQueryBuilder('item')
          .leftJoin('item.order', 'order')
          .leftJoin('item.product', 'product')
          .select('product.companyId', 'companyId')
          .addSelect(
            `SUM(
              COALESCE(item.deliveredPaidQuantity, 0) * (
                CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
                ELSE COALESCE(item.unitPrice, 0) END - COALESCE(product.buyPrice, 0)
              )
            )`,
            'profit',
          )
          .where('order.status IN (:...statuses)', { statuses: [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE] });

        if (!isAllTime && periodStartDateStr && periodEndDateStr) {
          companyProfitQb.andWhere(
            '(order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr OR (order.settledAt >= :periodStartUtc AND order.settledAt <= :periodEndUtc))',
            { periodStartDateStr, periodEndDateStr, periodStartUtc, periodEndUtc },
          );
        }
        if (companyId) {
          companyProfitQb.andWhere('product.companyId = :companyId', { companyId });
        }
        if (isSR) {
          companyProfitQb.andWhere('order.createdById = :userId', { userId });
        }

        const compProfitData = await companyProfitQb
          .groupBy('product.companyId')
          .getRawMany();

        for (const p of compProfitData) {
          const cId = Number(p.companyId);
          const existing = companyMap.get(cId);
          if (existing) {
            existing.profit = safeNum(p.profit);
          } else {
            companyMap.set(cId, {
              companyId: cId,
              companyName: `Company #${cId}`,
              sales: 0,
              profit: safeNum(p.profit),
            });
          }
        }
      } catch (err) {
        this.logger.error('Error fetching company-wise profit for dashboard:', err.message);
      }
    }

    const companySummary = Array.from(companyMap.values());

    // 🏆 Top Running / Best-Selling Products Query (All Products Ranked by Total Sold Count)
    let topProducts: any[] = [];
    try {
      // 1. Fetch all active products
      const prodQb = this.productsRepository
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.company', 'comp')
        .where('p.isActive = true');
      if (companyId) prodQb.andWhere('p.companyId = :companyId', { companyId });
      const allProducts = await prodQb.orderBy('p.name', 'ASC').getMany();

      // 2. Query sold quantities and sales values across non-cancelled orders
      const salesQb = this.orderItemsRepository
        .createQueryBuilder('item')
        .leftJoin('item.order', 'order')
        .select('item.productId', 'productId')
        .addSelect('SUM(COALESCE(item.deliveredPaidQuantity, item.quantity, 0))', 'soldQuantity')
        .addSelect('SUM(COALESCE(item.lineTotal, 0))', 'salesValue')
        .addSelect('COUNT(DISTINCT order.id)', 'orderCount')
        .where("order.status NOT IN ('CANCELLED', 'DRAFT')");

      if (!isAllTime && periodStartDateStr && periodEndDateStr) {
        salesQb.andWhere(
          '(order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr OR (order.settledAt >= :periodStartUtc AND order.settledAt <= :periodEndUtc))',
          { periodStartDateStr, periodEndDateStr, periodStartUtc, periodEndUtc },
        );
      }
      if (isSR) {
        salesQb.andWhere('order.createdById = :userId', { userId });
      }

      salesQb.groupBy('item.productId');
      const salesData = await salesQb.getRawMany();
      const salesMap = new Map<number, { soldQuantity: number; salesValue: number; orderCount: number }>();
      for (const row of salesData) {
        salesMap.set(Number(row.productId), {
          soldQuantity: safeNum(row.soldQuantity),
          salesValue: safeNum(row.salesValue),
          orderCount: safeNum(row.orderCount),
        });
      }

      // 3. Map all products and sort by soldQuantity DESC
      const combined = allProducts.map((p) => {
        const stats = salesMap.get(p.id) || { soldQuantity: 0, salesValue: 0, orderCount: 0 };
        return {
          productId: p.id,
          productName: p.name,
          companyId: p.companyId || (p.company?.id ? Number(p.company.id) : 0),
          companyName: p.company?.name || 'Unknown',
          unit: p.unit || 'Pcs',
          price: safeNum(p.salePrice ?? (p as any).price),
          currentStock: safeNum(p.currentStock),
          soldQuantity: stats.soldQuantity,
          salesValue: stats.salesValue,
          orderCount: stats.orderCount,
        };
      });

      combined.sort((a, b) => b.soldQuantity - a.soldQuantity || b.salesValue - a.salesValue);

      topProducts = combined.map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));
    } catch (err) {
      this.logger.error('Error calculating top selling products for dashboard:', err.message);
    }

    return {
      periodInfo: {
        key: period,
        label: periodLabel,
        isAllTime,
        month: dateRange.month,
        year: dateRange.year,
        monthName: dateRange.monthName,
        startDateStr: periodStartDateStr,
        endDateStr: periodEndDateStr,
        totalDays: dateRange.totalDays || 0,
      },
      uiMetrics: {
        // Today metrics (Always Today in BD Time)
        today: {
          ordersCount: safeNum(aggResult?.todayOrdersCount),
          orderValue: safeNum(aggResult?.todayOrderValue),
          dispatchCount: todayDispatchCount,
          dispatchAmount: safeNum(aggResult?.todayDispatchValue),
          settledValue: safeNum(aggResult?.todaySettledValue),
          cancelledOrders: safeNum(aggResult?.todayCancelledCount),
          dueAmount: todayDueAmount,
          dueCollection: todayCollectedAmount,
        },
        // Period / Monthly metrics (Selected Period / Month)
        period: {
          ordersCount: safeNum(aggResult?.periodOrdersCount),
          orderValue: safeNum(aggResult?.periodOrderValue),
          cancelledOrders: safeNum(aggResult?.periodCancelledCount),
          netSales: safeNum(aggResult?.periodNetSales),
          dispatchCount: periodDispatchCount,
          pendingDispatch: safeNum(aggResult?.periodPendingDispatchCount),
          deliveredCount: safeNum(aggResult?.periodDeliveredCount),
          newDue: periodDueAmount,
          dueCollection: periodCollectedAmount,
          profit: canViewProfit ? periodProfit : 0,
        },
        // Orders Overview (Legacy + Period values)
        orders: {
          totalOrders: safeNum(aggResult?.periodOrdersCount),
          todayOrdersCount: safeNum(aggResult?.todayOrdersCount),
          totalOrderValue: safeNum(aggResult?.periodOrderValue),
          todayOrderValue: safeNum(aggResult?.todayOrderValue),
          cancelledOrders: safeNum(aggResult?.periodCancelledCount),
          todayCancelled: safeNum(aggResult?.todayCancelledCount),
          lifetimeOrders: safeNum(aggResult?.lifetimeOrdersCount),
          lifetimeOrderValue: safeNum(aggResult?.lifetimeOrderValue),
        },
        // Delivery Operations
        delivery: {
          totalDispatch: periodDispatchCount,
          todayDispatch: todayDispatchCount,
          todayDispatchAmount: safeNum(aggResult?.todayDispatchValue),
          pendingDispatch: safeNum(aggResult?.periodPendingDispatchCount),
          delivered: safeNum(aggResult?.periodDeliveredCount),
        },
        // Financials & Money
        money: {
          totalGrossAmount: safeNum(aggResult?.periodOrderValue),
          todayGrossAmount: safeNum(aggResult?.todayOrderValue),
          totalFinalSold: safeNum(aggResult?.periodNetSales),
          todayFinalSold: safeNum(aggResult?.todaySettledValue),
          periodDue: periodDueAmount,
          totalDue: totalDueAmount, // Current Live Market Remaining Due
          todayDue: todayDueAmount,
          periodDueCollection: periodCollectedAmount,
          todayDueCollection: todayCollectedAmount,
          pendingCollected,
          approvedCollected,
          rejectedCollected,
          periodProfit: canViewProfit ? periodProfit : 0,
          totalProfit: canViewProfit ? periodProfit : 0,
          lifetimeProfit: canViewProfit ? lifetimeProfit : 0,
        },
        // Live Stock / Inventory (Always Live State)
        stock: {
          totalProducts: productMetrics.totalProducts,
          activeProducts: productMetrics.activeProducts,
          inactiveProducts: productMetrics.inactiveProducts,
          lowStockProducts: productMetrics.lowStockProducts,
          outOfStockProducts: productMetrics.outOfStockProducts,
          inStockProducts: productMetrics.inStockProducts,
          stockValue: canViewProfit ? productMetrics.totalStockValue : 0,
        },
      },
      charts: {
        last7Days,
        monthlyTrend,
      },
      companySummary,
      topProducts,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        grandTotal: o.grandTotal,
        status: o.status,
        orderDate: o.orderDate,
        createdAt: o.createdAt,
      })),
    };
  }

  async getDrilldownData(
    type: string,
    companyId?: number,
    user?: any,
    options: DashboardQueryOptions = {},
    page = 1,
    limit = 50,
  ) {
    const isSR = user?.role === Role.SR;
    const userId = user?.id || user?.sub;

    // 0. Parse Period and Date Range using standardized BD timezone helper
    const period = options.period || 'this_month';
    const dateRange = getBDDateRangeForPeriod(
      period,
      options.year,
      options.month,
    );
    const {
      startDateStr,
      endDateStr,
      startUtc,
      endUtc,
      periodStartDateStr,
      periodEndDateStr,
      periodStartUtc,
      periodEndUtc,
      isAllTime,
    } = dateRange;

    const safeNum = (val: any) => {
      const n = Number(val);
      return isFinite(n) ? n : 0;
    };

    // 1. SALES (SETTLED / DELIVERED ORDERS)
    if (type === 'sales') {
      const qb = this.ordersRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.shop', 'shop')
        .leftJoinAndSelect('order.company', 'company')
        .leftJoinAndSelect('order.route', 'route')
        .leftJoinAndSelect('order.deliveryPerson', 'deliveryPerson')
        .where('order.status IN (:...statuses)', {
          statuses: [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE],
        });

      if (!isAllTime && periodStartDateStr && periodEndDateStr) {
        qb.andWhere(
          '(order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr OR (order.settledAt >= :periodStartUtc AND order.settledAt <= :periodEndUtc))',
          { periodStartDateStr, periodEndDateStr, periodStartUtc, periodEndUtc },
        );
      }
      if (companyId) qb.andWhere('order.companyId = :companyId', { companyId });
      if (isSR) qb.andWhere('order.createdById = :userId', { userId });

      qb.orderBy('order.orderDate', 'DESC').addOrderBy('order.createdAt', 'DESC');

      const [items, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        type: 'sales',
        total,
        page,
        limit,
        items: items.map((o) => ({
          id: o.id,
          orderDate: o.orderDate,
          settledAt: o.settledAt,
          shopName: o.shop?.name || 'Direct Sale',
          shopOwner: o.shop?.ownerName,
          shopPhone: o.shop?.phone,
          routeName: o.route?.name,
          companyName: o.company?.name,
          deliveryManName: o.deliveryPerson?.name,
          status: o.status,
          grandTotal: safeNum(o.grandTotal),
          soldAmount: safeNum(o.actualSoldAmount || o.grandTotal),
          dueAmount: safeNum(o.dueAmount),
          collectedAmount: safeNum(o.collectedAmount),
        })),
      };
    }

    // 2. ORDERS (ALL ORDERS IN PERIOD)
    if (type === 'orders') {
      const qb = this.ordersRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.shop', 'shop')
        .leftJoinAndSelect('order.company', 'company')
        .leftJoinAndSelect('order.route', 'route')
        .where("order.status <> 'CANCELLED'");

      if (!isAllTime && periodStartDateStr && periodEndDateStr) {
        qb.andWhere(
          'order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr',
          { periodStartDateStr, periodEndDateStr },
        );
      }
      if (companyId) qb.andWhere('order.companyId = :companyId', { companyId });
      if (isSR) qb.andWhere('order.createdById = :userId', { userId });

      qb.orderBy('order.orderDate', 'DESC').addOrderBy('order.createdAt', 'DESC');

      const [items, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        type: 'orders',
        total,
        page,
        limit,
        items: items.map((o) => ({
          id: o.id,
          orderDate: o.orderDate,
          createdAt: o.createdAt,
          shopName: o.shop?.name || 'Direct Sale',
          shopOwner: o.shop?.ownerName,
          shopPhone: o.shop?.phone,
          routeName: o.route?.name,
          companyName: o.company?.name,
          srName: o.createdBy,
          status: o.status,
          grandTotal: safeNum(o.grandTotal),
          soldAmount: safeNum(o.actualSoldAmount),
        })),
      };
    }

    // 3. COLLECTIONS
    if (type === 'collections') {
      const qb = this.collectionsRepository
        .createQueryBuilder('coll')
        .leftJoinAndSelect('coll.order', 'order')
        .leftJoinAndSelect('coll.shop', 'shop')
        .leftJoinAndSelect('coll.sr', 'sr');

      if (!isAllTime && periodStartUtc && periodEndUtc) {
        qb.where(
          'coll.createdAt >= :periodStartUtc AND coll.createdAt <= :periodEndUtc',
          { periodStartUtc, periodEndUtc },
        );
      }
      if (companyId) {
        qb.innerJoin('order.items', 'item')
          .innerJoin('item.product', 'product')
          .andWhere('product.companyId = :companyId', { companyId });
      }
      if (isSR) qb.andWhere('coll.srId = :userId', { userId });

      qb.orderBy('coll.collectionDate', 'DESC').addOrderBy('coll.createdAt', 'DESC');

      const [items, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        type: 'collections',
        total,
        page,
        limit,
        items: items.map((c) => ({
          id: c.id,
          orderId: c.orderId,
          shopName: c.shop?.name || c.order?.shop?.name || 'Direct Sale',
          srName: (c as any).sr?.name || c.srName,
          collectedAmount: safeNum(c.collectedAmount),
          collectionDate: c.collectionDate,
          createdAt: c.createdAt,
          status: c.status,
          note: c.note,
        })),
      };
    }

    // 4. DUES
    if (type === 'dues') {
      const qb = this.duesRepository
        .createQueryBuilder('due')
        .leftJoinAndSelect('due.order', 'order')
        .leftJoinAndSelect('due.shop', 'shop')
        .leftJoinAndSelect('due.route', 'route');

      if (!isAllTime && periodStartDateStr && periodEndDateStr) {
        qb.where(
          'order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr',
          { periodStartDateStr, periodEndDateStr },
        );
      }
      if (companyId) {
        qb.innerJoin('order.items', 'item')
          .innerJoin('item.product', 'product')
          .andWhere('product.companyId = :companyId', { companyId });
      }
      if (isSR) qb.andWhere('due.srId = :userId', { userId });

      qb.orderBy('order.orderDate', 'DESC');

      const [items, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        type: 'dues',
        total,
        page,
        limit,
        items: items.map((d) => ({
          id: d.id,
          orderId: d.orderId,
          shopName: d.shop?.name || d.order?.shop?.name || 'Direct Sale',
          routeName: d.route?.name,
          srName: d.srName,
          dueAmount: safeNum(d.dueAmount),
          paidAmount: safeNum(d.paidAmount),
          remainingDue: safeNum(d.remainingDue),
          status: d.status,
          orderDate: d.order?.orderDate,
        })),
      };
    }

    // 5. DISPATCHES (BATCHES)
    if (type === 'dispatches') {
      const batchRepo = this.dataSource.getRepository(DispatchBatch);
      const qb = batchRepo
        .createQueryBuilder('batch')
        .leftJoinAndSelect('batch.deliveryPerson', 'deliveryPerson')
        .leftJoinAndSelect('batch.orders', 'batchOrders')
        .leftJoinAndSelect('batchOrders.order', 'order')
        .where("batch.status <> 'CANCELLED'");

      if (!isAllTime && periodStartUtc && periodEndUtc) {
        qb.andWhere(
          'batch.dispatchedAt >= :periodStartUtc AND batch.dispatchedAt <= :periodEndUtc',
          { periodStartUtc, periodEndUtc },
        );
      }
      if (companyId) qb.andWhere('batch.companyId = :companyId', { companyId });
      if (isSR) qb.andWhere('order.createdById = :userId', { userId });

      qb.orderBy('batch.dispatchDate', 'DESC').addOrderBy('batch.createdAt', 'DESC');

      const [items, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        type: 'dispatches',
        total,
        page,
        limit,
        items: items.map((b) => ({
          id: b.id,
          batchNumber: (b as any).batchNumber || (b as any).batchNo || String(b.id),
          dispatchDate: b.dispatchDate,
          dispatchedAt: b.dispatchedAt,
          deliveryPersonName: b.deliveryPerson?.name,
          status: b.status,
          totalOrders: b.orders?.length || 0,
          totalAmount: b.orders?.reduce(
            (sum: number, bo: any) => sum + safeNum(bo.order?.grandTotal),
            0,
          ) || 0,
        })),
      };
    }

    // 6. CANCELLED ORDERS
    if (type === 'cancelled') {
      const qb = this.ordersRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.shop', 'shop')
        .leftJoinAndSelect('order.route', 'route')
        .leftJoinAndSelect('order.company', 'company')
        .where('order.status = :cancelledStatus', {
          cancelledStatus: OrderStatus.CANCELLED,
        });

      if (!isAllTime && periodStartDateStr && periodEndDateStr) {
        qb.andWhere(
          'order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr',
          { periodStartDateStr, periodEndDateStr },
        );
      }
      if (companyId) {
        qb.andWhere('order.companyId = :companyId', { companyId });
      }
      if (isSR) qb.andWhere('order.createdById = :userId', { userId });

      qb.orderBy('order.orderDate', 'DESC').addOrderBy('order.createdAt', 'DESC');

      const [items, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        type: 'cancelled',
        total,
        page,
        limit,
        items: items.map((o) => ({
          id: o.id,
          orderDate: o.orderDate,
          createdAt: o.createdAt,
          shopName: o.shop?.name || 'Direct Sale',
          shopOwner: o.shop?.ownerName,
          shopPhone: o.shop?.phone,
          routeName: o.route?.name,
          companyName: o.company?.name,
          srName: o.createdBy,
          status: o.status,
          grandTotal: safeNum(o.grandTotal),
        })),
      };
    }

    // 7. PROFIT (PRODUCT-WISE PROFIT BREAKDOWN - STRICTLY FOR ANALYTICS / REPORTS)
    if (type === 'profit') {
      const qb = this.orderItemsRepository
        .createQueryBuilder('item')
        .leftJoin('item.order', 'order')
        .leftJoin('item.product', 'product')
        .leftJoin('product.company', 'company')
        .select('product.id', 'productId')
        .addSelect('product.name', 'productName')
        .addSelect('company.name', 'companyName')
        .addSelect('product.buyPrice', 'buyPrice')
        .addSelect('product.salePrice', 'sellPrice')
        .addSelect('SUM(COALESCE(item.deliveredPaidQuantity, 0))', 'totalDeliveredQty')
        .addSelect(
          `SUM(
            COALESCE(item.deliveredPaidQuantity, 0) * (
              CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
              ELSE COALESCE(item.unitPrice, 0) END
            )
          )`,
          'totalSales',
        )
        .addSelect(
          `SUM(
            COALESCE(item.deliveredPaidQuantity, 0) * (
              CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
              ELSE COALESCE(item.unitPrice, 0) END - COALESCE(product.buyPrice, 0)
            )
          )`,
          'totalProfit',
        )
        .where('order.status IN (:...statuses)', {
          statuses: [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE],
        });

      if (!isAllTime && periodStartDateStr && periodEndDateStr) {
        qb.andWhere(
          '(order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr OR (order.settledAt >= :periodStartUtc AND order.settledAt <= :periodEndUtc))',
          { periodStartDateStr, periodEndDateStr, periodStartUtc, periodEndUtc },
        );
      }
      if (companyId) qb.andWhere('product.companyId = :companyId', { companyId });
      if (isSR) qb.andWhere('order.createdById = :userId', { userId });

      qb.groupBy('product.id')
        .addGroupBy('product.name')
        .addGroupBy('company.name')
        .addGroupBy('product.buyPrice')
        .addGroupBy('product.salePrice')
        .orderBy('totalProfit', 'DESC');

      const rawItems = await qb.getRawMany();

      return {
        type: 'profit',
        total: rawItems.length,
        page: 1,
        limit: rawItems.length,
        items: rawItems.map((r) => ({
          productId: r.productId,
          productName: r.productName,
          companyName: r.companyName,
          buyPrice: safeNum(r.buyPrice),
          sellPrice: safeNum(r.sellPrice),
          deliveredQty: safeNum(r.totalDeliveredQty),
          totalSales: safeNum(r.totalSales),
          totalProfit: safeNum(r.totalProfit),
        })),
      };
    }

    // 8. TOP PRODUCTS (PRODUCT SALES RANKING BY QUANTITY & REVENUE)
    if (type === 'top_products') {
      const qb = this.orderItemsRepository
        .createQueryBuilder('item')
        .leftJoin('item.order', 'order')
        .leftJoin('item.product', 'product')
        .leftJoin('product.company', 'company')
        .select('product.id', 'productId')
        .addSelect('product.name', 'productName')
        .addSelect('product.currentStock', 'currentStock')
        .addSelect('product.unit', 'unit')
        .addSelect('product.salePrice', 'price')
        .addSelect('company.id', 'companyId')
        .addSelect('company.name', 'companyName')
        .addSelect('SUM(COALESCE(item.deliveredPaidQuantity, item.quantity, 0))', 'soldQuantity')
        .addSelect('SUM(COALESCE(item.lineTotal, 0))', 'salesValue')
        .addSelect('COUNT(DISTINCT order.id)', 'orderCount')
        .where("order.status NOT IN ('CANCELLED', 'DRAFT')");

      if (!isAllTime && periodStartDateStr && periodEndDateStr) {
        qb.andWhere(
          '(order.orderDate >= :periodStartDateStr AND order.orderDate <= :periodEndDateStr OR (order.settledAt >= :periodStartUtc AND order.settledAt <= :periodEndUtc))',
          { periodStartDateStr, periodEndDateStr, periodStartUtc, periodEndUtc },
        );
      }
      if (companyId) qb.andWhere('product.companyId = :companyId', { companyId });
      if (isSR) qb.andWhere('order.createdById = :userId', { userId });

      qb.groupBy('product.id')
        .addGroupBy('product.name')
        .addGroupBy('product.currentStock')
        .addGroupBy('product.unit')
        .addGroupBy('product.salePrice')
        .addGroupBy('company.id')
        .addGroupBy('company.name')
        .orderBy('SUM(COALESCE(item.deliveredPaidQuantity, item.quantity, 0))', 'DESC');

      const rawItems = await qb.getRawMany();

      return {
        type: 'top_products',
        total: rawItems.length,
        page: 1,
        limit: rawItems.length,
        items: rawItems.map((p, idx) => ({
          rank: idx + 1,
          productId: Number(p.productId),
          productName: p.productName,
          companyId: Number(p.companyId),
          companyName: p.companyName || 'Unknown',
          unit: p.unit || 'Pcs',
          price: safeNum(p.price),
          currentStock: safeNum(p.currentStock),
          soldQuantity: safeNum(p.soldQuantity),
          salesValue: safeNum(p.salesValue),
          orderCount: safeNum(p.orderCount),
        })),
      };
    }

    return { type, items: [], total: 0 };
  }
}

