import { getBDDayRange, isTodayBD, isTodayBDDate, getBDTodayString } from '../../common/utils/date.utils';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository, DataSource } from 'typeorm';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/orders.constants';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Injectable, Logger } from '@nestjs/common';

import { Role } from '../../common/enums/role.enum';
import { Due } from '../dues/entities/due.entity';
import { DueCollection, CollectionStatus } from '../dues/entities/due-collection.entity';

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
    private readonly dataSource: DataSource,
  ) { }
  private readonly logger = new Logger(DashboardService.name);

  async getDashboardData(companyId?: number, user?: any) {
    const { startUtc: todayStartUTC, endUtc: todayEndUTC } = getBDDayRange();
    const safeNum = (val: any) => {
      const n = Number(val);
      return isFinite(n) ? n : 0;
    };

    // Filter based on role
    const isSR = user?.role === Role.SR;
    const userId = user?.id || user?.sub;

    const where: any = companyId ? { companyId } : {};
    if (isSR) {
      where.createdById = userId;
    }

    // 1. Fetch orders
    const allOrders = await this.ordersRepository.find({
      where,
      relations: ['items', 'items.product'],
    });

    const nonCancelled = allOrders.filter(o => o.status !== OrderStatus.CANCELLED);
    const settledOrders = allOrders.filter(o => o.status === OrderStatus.SETTLED);

    const totalOrderValue = nonCancelled.reduce((sum, o) => sum + safeNum(o.grandTotal), 0);
    const netSales = settledOrders.reduce((sum, o) => sum + safeNum(o.actualSoldAmount), 0);

    // Total Profit (Only for Admin/Manager usually, but let's calculate)
    const itemsQuery = this.orderItemsRepository.createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoin('item.order', 'order')
      .where('order.status = :status', { status: OrderStatus.SETTLED });
    if (companyId) itemsQuery.andWhere('order.companyId = :companyId', { companyId });
    if (isSR) itemsQuery.andWhere('order.createdById = :userId', { userId });
    
    const settledItems = await itemsQuery.getMany();

    const totalProfit = settledItems.reduce((sum: number, item: OrderItem) => {
      const delivered = safeNum(item.deliveredQuantity);
      const buyPrice = safeNum(item.product?.buyPrice);
      const itemPrice = item.quantity > 0 ? item.lineTotal / item.quantity : item.unitPrice;
      return sum + (delivered * (itemPrice - buyPrice));
    }, 0);

    // Dues and Collections metrics
    let totalDueAmount = 0;
    let collections: any[] = [];
    let pendingCollected = 0;
    let approvedCollected = 0;
    let rejectedCollected = 0;
    try {
      const duesRecords = await this.duesRepository.find({
        where: isSR ? { srId: userId } : (companyId ? { order: { companyId } } : {}),
        relations: ['order']
      });
      totalDueAmount = duesRecords.reduce((sum, d) => sum + safeNum(d.remainingDue), 0);

      collections = await this.collectionsRepository.find({
        where: isSR ? { srId: userId } : (companyId ? { order: { companyId } } : {}),
        relations: ['order']
      });
      pendingCollected = collections.filter(c => c.status === CollectionStatus.PENDING).reduce((sum, c) => sum + safeNum(c.collectedAmount), 0);
      approvedCollected = collections.filter(c => c.status === CollectionStatus.APPROVED).reduce((sum, c) => sum + safeNum(c.collectedAmount), 0);
      rejectedCollected = collections.filter(c => c.status === CollectionStatus.REJECTED).reduce((sum, c) => sum + safeNum(c.collectedAmount), 0);
    } catch (err) {
      this.logger.error('Error fetching dues/collections for dashboard:', err.message);
    }

    // Daily Operations
    const todayOrdersList = allOrders.filter(o => isTodayBD(o.createdAt) && o.status !== OrderStatus.CANCELLED);
    const todayOrders = {
      amount: todayOrdersList.reduce((sum, o) => sum + safeNum(o.grandTotal), 0),
      count: todayOrdersList.length
    };

    const todayDispatch = allOrders.filter(o => isTodayBD(o.dispatchedAt)).length;
    const todaySettledValue = allOrders.filter(o => o.status === OrderStatus.SETTLED && isTodayBD(o.settledAt))
      .reduce((sum, o) => sum + safeNum(o.actualSoldAmount), 0);

    const todayCancelled = allOrders.filter(o => o.status === OrderStatus.CANCELLED && isTodayBD(o.updatedAt)).length;

    // Stock metrics
    let stockValue = 0;
    let productsCount = 0;
    try {
      const products = await this.productsRepository.find({ where: companyId ? { companyId } : {} });
      stockValue = products.reduce((sum, p) => sum + (safeNum(p.currentStock) * safeNum(p.buyPrice)), 0);
      productsCount = products.length;
    } catch (err) {
      this.logger.error('Error fetching stock for dashboard:', err.message);
    }

    // Recent Orders (Newest 10)
    const recentOrders = allOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);

    // Main Chart: Last 7 Days Sales
    const last7Days = [];
    const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
    const startOfTodayBD = new Date(new Date().getTime() + BD_OFFSET_MS);
    startOfTodayBD.setUTCHours(0,0,0,0);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfTodayBD.getTime() - i * 24 * 60 * 60 * 1000);
      const dStart = new Date(d.getTime() - BD_OFFSET_MS);
      const dEnd = new Date(dStart.getTime() + 24 * 60 * 60 * 1000);

      const daySales = allOrders.filter(o => o.status === OrderStatus.SETTLED && o.settledAt && o.settledAt >= dStart && o.settledAt < dEnd)
        .reduce((sum, o) => sum + safeNum(o.actualSoldAmount), 0);

      last7Days.push({
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Dhaka' }),
        amount: daySales
      });
    }

    return {
      uiMetrics: {
        orders: {
          totalOrders: allOrders.length,
          todayOrdersCount: todayOrders.count,
          totalOrderValue,
          todayOrderValue: todayOrders.amount,
          cancelledOrders: allOrders.filter(o => o.status === OrderStatus.CANCELLED).length,
          todayCancelled
        },
        delivery: {
          totalDispatch: allOrders.filter(o => o.dispatchedAt).length,
          todayDispatch,
          pendingDispatch: allOrders.filter(o => [OrderStatus.CONFIRMED, OrderStatus.ASSIGNED].includes(o.status)).length,
          delivered: allOrders.filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.SETTLED).length,
        },
        money: {
          totalGrossAmount: totalOrderValue,
          todayGrossAmount: todayOrders.amount,
          totalFinalSold: netSales,
          todayFinalSold: todaySettledValue,
          totalDue: totalDueAmount,
          pendingCollected,
          approvedCollected,
          rejectedCollected,
          totalProfit: (user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER) ? totalProfit : 0,
        },
        stock: {
          totalProducts: productsCount,
          stockValue: (user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER) ? stockValue : 0,
        }
      },
      charts: { last7Days },
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        grandTotal: o.grandTotal,
        status: o.status,
        orderDate: o.orderDate,
        createdAt: o.createdAt
      }))
    };
  }
}
