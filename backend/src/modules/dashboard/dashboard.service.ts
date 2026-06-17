import {
  getBDDayRange,
  isTodayBD,
  isTodayBDDate,
  getBDTodayString,
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

  async getDashboardData(companyId?: number, user?: any) {
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
        return { uiMetrics: null, charts: { last7Days: [] }, recentOrders: [] };
      where.createdById = userId;
    }

    // 1. Conditional SQL Aggregations (Single Query for all Order Metrics)
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

      aggResult = await qb
        .select('COUNT(DISTINCT order.id)', 'totalOrdersCount')
        .addSelect(
          "SUM(CASE WHEN order.status <> 'CANCELLED' THEN COALESCE(item.lineTotal, 0) ELSE 0 END)",
          'totalOrderValue',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN order.status = 'CANCELLED' THEN order.id END)",
          'cancelledOrdersCount',
        )
        .addSelect(
          `SUM(CASE WHEN order.status = 'SETTLED' THEN
          COALESCE(item.deliveredPaidQuantity, 0) * (
            CASE WHEN COALESCE(item.quantity, 0) > 0 THEN (COALESCE(item.lineTotal, 0) / item.quantity)
            ELSE COALESCE(item.unitPrice, 0) END
          )
        ELSE 0 END)`,
          'netSales',
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
          `SUM(CASE WHEN order.status = 'SETTLED' AND order.settledAt >= :todayStartUTC AND order.settledAt <= :todayEndUTC THEN
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

        // Delivery status totals
        .addSelect(
          'COUNT(DISTINCT CASE WHEN order.dispatchedAt IS NOT NULL THEN order.id END)',
          'totalDispatchCount',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN order.status IN ('CONFIRMED', 'ASSIGNED') THEN order.id END)",
          'pendingDispatchCount',
        )
        .addSelect(
          "COUNT(DISTINCT CASE WHEN order.status IN ('DELIVERED', 'SETTLED') THEN order.id END)",
          'deliveredCount',
        )
        .setParameters({ todayStartUTC, todayEndUTC, companyId, todayDateStr })
        .getRawOne();
    } else {
      const baseQb = this.ordersRepository.createQueryBuilder('order');
      if (isSR) {
        baseQb.andWhere('order.createdById = :userId', { userId });
      }

      aggResult = await baseQb
        .select('COUNT(order.id)', 'totalOrdersCount')
        .addSelect(
          `SUM(CASE WHEN order.status <> 'CANCELLED' THEN COALESCE(order.grandTotal, 0) ELSE 0 END)`,
          'totalOrderValue',
        )
        .addSelect(
          `SUM(CASE WHEN order.status = 'CANCELLED' THEN 1 ELSE 0 END)`,
          'cancelledOrdersCount',
        )
        .addSelect(
          `SUM(CASE WHEN order.status = 'SETTLED' THEN COALESCE(order.actualSoldAmount, 0) ELSE 0 END)`,
          'netSales',
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
          `SUM(CASE WHEN order.status = 'SETTLED' AND order.settledAt >= :todayStartUTC AND order.settledAt <= :todayEndUTC THEN COALESCE(order.actualSoldAmount, 0) ELSE 0 END)`,
          'todaySettledValue',
        )
        .addSelect(
          `COUNT(CASE WHEN order.status = 'CANCELLED' AND order.updatedAt >= :todayStartUTC AND order.updatedAt <= :todayEndUTC THEN 1 END)`,
          'todayCancelledCount',
        )

        // Delivery status totals
        .addSelect(
          `COUNT(CASE WHEN order.dispatchedAt IS NOT NULL THEN 1 END)`,
          'totalDispatchCount',
        )
        .addSelect(
          `COUNT(CASE WHEN order.status IN ('CONFIRMED', 'ASSIGNED') THEN 1 END)`,
          'pendingDispatchCount',
        )
        .addSelect(
          `COUNT(CASE WHEN order.status IN ('DELIVERED', 'SETTLED') THEN 1 END)`,
          'deliveredCount',
        )
        .setParameters({ todayStartUTC, todayEndUTC, todayDateStr })
        .getRawOne();
    }

    // 2. Profit calculation via direct query
    const profitResult = await this.orderItemsRepository
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
        'profit',
      )
      .where('order.status = :status', { status: OrderStatus.SETTLED })
      .andWhere(companyId ? 'product.companyId = :companyId' : '1=1', {
        companyId,
      })
      .andWhere(isSR ? 'order.createdById = :userId' : '1=1', { userId })
      .getRawOne();

    const totalProfit = safeNum(profitResult?.profit);

    // 3. Dues and Collections metrics via database aggregations
    let totalDueAmount = 0;
    let todayDueAmount = 0;
    let todayCollectedAmount = 0;
    let pendingCollected = 0;
    let approvedCollected = 0;
    let rejectedCollected = 0;

    try {
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

      // Fetch today's new dues
      const todayDuesQb = this.duesRepository
        .createQueryBuilder('due')
        .leftJoin('due.order', 'order')
        .select('SUM(COALESCE(due.dueAmount, 0))', 'todayDue')
        .where(
          'due.createdAt >= :todayStartUTC AND due.createdAt <= :todayEndUTC',
          { todayStartUTC, todayEndUTC },
        );
      if (companyId) {
        todayDuesQb
          .innerJoin('order.items', 'item')
          .innerJoin('item.product', 'product')
          .andWhere('product.companyId = :companyId', { companyId });
      }
      if (isSR) todayDuesQb.andWhere('due.srId = :userId', { userId });
      const todayDueRes = await todayDuesQb.getRawOne();
      todayDueAmount = safeNum(todayDueRes?.todayDue);

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

      // Fetch today's approved due collections
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
    } catch (err) {
      this.logger.error(
        'Error fetching dues/collections for dashboard:',
        err.message,
      );
    }

    // 4. Daily Operations
    const todayOrders = {
      amount: safeNum(aggResult?.todayOrderValue),
      count: safeNum(aggResult?.todayOrdersCount),
    };

    const todayDispatch = safeNum(aggResult?.todayDispatchCount);
    const todaySettledValue = safeNum(aggResult?.todaySettledValue);
    const todayCancelled = safeNum(aggResult?.todayCancelledCount);

    // 5. Stock metrics from ProductsService (Unified Source)
    let productMetrics: any = {
      totalProducts: 0,
      stockValue: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
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

    // 7. Main Chart: Last 7 Days Sales (Single Grouped Query)
    const last7Days = [];
    const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
    const startOfTodayBD = new Date(new Date().getTime() + BD_OFFSET_MS);
    startOfTodayBD.setUTCHours(0, 0, 0, 0);

    const startRangeUtc = new Date(
      startOfTodayBD.getTime() - 6 * 24 * 60 * 60 * 1000 - BD_OFFSET_MS,
    );

    const chartQb = this.ordersRepository.createQueryBuilder('order');
    if (companyId) {
      chartQb
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
        .where('order.status = :status', { status: OrderStatus.SETTLED })
        .andWhere('product.companyId = :companyId', { companyId })
        .andWhere('order.settledAt >= :startRangeUtc', { startRangeUtc })
        .groupBy(`DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`);
    } else {
      chartQb
        .select(
          `DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`,
          'dayDate',
        )
        .addSelect('SUM(COALESCE(order.actualSoldAmount, 0))', 'daySales')
        .where('order.status = :status', { status: OrderStatus.SETTLED })
        .andWhere('order.settledAt >= :startRangeUtc', { startRangeUtc })
        .groupBy(`DATE_TRUNC('day', order.settledAt + INTERVAL '6 hours')`);
    }

    if (isSR) chartQb.andWhere('order.createdById = :userId', { userId });

    const chartData = await chartQb.getRawMany();

    const chartMap = new Map<string, number>();
    for (const row of chartData) {
      if (row.dayDate) {
        const dStr = new Date(row.dayDate).toISOString().split('T')[0];
        chartMap.set(dStr, safeNum(row.daySales));
      }
    }

    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfTodayBD.getTime() - i * 24 * 60 * 60 * 1000);
      const dKey = d.toISOString().split('T')[0];
      const salesAmount = chartMap.get(dKey) || 0;

      last7Days.push({
        date: d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          timeZone: 'Asia/Dhaka',
        }),
        amount: salesAmount,
      });
    }

    // 8. Company-wise Sales and Profit
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
      .where('order.status = :status', { status: OrderStatus.SETTLED });

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

    const canViewProfit =
      user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER;
    if (canViewProfit) {
      try {
        const profitQb = this.orderItemsRepository
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
          .where('order.status = :status', { status: OrderStatus.SETTLED });

        if (companyId) {
          profitQb.andWhere('product.companyId = :companyId', { companyId });
        }
        if (isSR) {
          profitQb.andWhere('order.createdById = :userId', { userId });
        }

        const profitData = await profitQb
          .groupBy('product.companyId')
          .getRawMany();

        for (const p of profitData) {
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
        this.logger.error(
          'Error fetching company-wise profit for dashboard:',
          err.message,
        );
      }
    }

    const companySummary = Array.from(companyMap.values());

    return {
      uiMetrics: {
        orders: {
          totalOrders: safeNum(aggResult?.totalOrdersCount),
          todayOrdersCount: todayOrders.count,
          totalOrderValue: safeNum(aggResult?.totalOrderValue),
          todayOrderValue: todayOrders.amount,
          cancelledOrders: safeNum(aggResult?.cancelledOrdersCount),
          todayCancelled,
        },
        delivery: {
          totalDispatch: safeNum(aggResult?.totalDispatchCount),
          todayDispatch,
          todayDispatchAmount: safeNum(aggResult?.todayDispatchValue),
          pendingDispatch: safeNum(aggResult?.pendingDispatchCount),
          delivered: safeNum(aggResult?.deliveredCount),
        },
        money: {
          totalGrossAmount: safeNum(aggResult?.totalOrderValue),
          todayGrossAmount: todayOrders.amount,
          totalFinalSold: safeNum(aggResult?.netSales),
          todayFinalSold: todaySettledValue,
          totalDue: totalDueAmount,
          todayDue: todayDueAmount,
          todayDueCollection: todayCollectedAmount,
          pendingCollected,
          approvedCollected,
          rejectedCollected,
          totalProfit:
            user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER
              ? totalProfit
              : 0,
        },
        stock: {
          totalProducts: productMetrics.totalProducts,
          activeProducts: productMetrics.activeProducts,
          inactiveProducts: productMetrics.inactiveProducts,
          lowStockProducts: productMetrics.lowStockProducts,
          outOfStockProducts: productMetrics.outOfStockProducts,
          inStockProducts: productMetrics.inStockProducts,
          stockValue:
            user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER
              ? productMetrics.totalStockValue
              : 0,
        },
      },
      charts: { last7Days },
      companySummary,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        grandTotal: o.grandTotal,
        status: o.status,
        orderDate: o.orderDate,
        createdAt: o.createdAt,
      })),
    };
  }
}
