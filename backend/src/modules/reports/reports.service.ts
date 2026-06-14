import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { DamageRecord } from '../delivery-ops/entities/damage-record.entity';
import { OrderStatus } from '../orders/orders.constants';
import { getBDDayRange, isTodayBDDate } from '../../common/utils/date.utils';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(DamageRecord)
    private readonly damageRecordRepository: Repository<DamageRecord>,
    private readonly dataSource: DataSource,
  ) {}

  async getFreeQuantityReport(filters: any, user?: any) {
    const qb = this.orderItemsRepository.createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.order', 'order')
      .leftJoinAndSelect('order.company', 'company')
      .leftJoinAndSelect('order.route', 'route')
      .leftJoinAndSelect('order.shop', 'shop')
      .leftJoinAndSelect('order.deliveryPerson', 'deliveryPerson')
      .where('item.freeQuantity > 0');

    if (user && user.role === Role.SR) {
      qb.andWhere('order.createdById = :userId', { userId: user.id || user.sub });
    }

    // Apply Filters
    if (filters.dateMode === 'Today') {
      const { startUtc, endUtc } = getBDDayRange();
      qb.andWhere('order.orderDate BETWEEN :start AND :end', { start: startUtc, end: endUtc });
    } else if (filters.dateMode === 'Selected Date' && filters.date) {
      qb.andWhere('order.orderDate = :date', { date: filters.date });
    } else if (filters.dateMode === 'Date Range' && filters.fromDate && filters.toDate) {
      qb.andWhere('order.orderDate BETWEEN :fromDate AND :toDate', { 
        fromDate: filters.fromDate, 
        toDate: filters.toDate 
      });
    }

    if (filters.companyId) {
      qb.andWhere('order.companyId = :companyId', { companyId: filters.companyId });
    }
    if (filters.routeId) {
      qb.andWhere('order.routeId = :routeId', { routeId: filters.routeId });
    }
    if (filters.shopId) {
      qb.andWhere('order.shopId = :shopId', { shopId: filters.shopId });
    }
    if (filters.deliveryManId) {
      qb.andWhere('order.deliveryPersonId = :deliveryManId', { deliveryManId: filters.deliveryManId });
    }
    if (filters.productId) {
      qb.andWhere('item.productId = :productId', { productId: filters.productId });
    }
    if (filters.orderStatus) {
      qb.andWhere('order.status = :orderStatus', { orderStatus: filters.orderStatus });
    }

    const items = await qb.getMany();

    // Summary Calculations
    const safeNum = (val: any) => isNaN(Number(val)) ? 0 : Number(val);
    const totalFreeQty = items.reduce((sum, i) => sum + safeNum(i.freeQuantity), 0);
    const todayFreeQty = items.filter(i => i.order && isTodayBDDate(i.order.orderDate)).reduce((sum, i) => sum + safeNum(i.freeQuantity), 0);
    const totalFreeValue = items.reduce((sum, i) => sum + (safeNum(i.freeQuantity) * safeNum(i.product?.salePrice)), 0);
    const totalOrders = new Set(items.map(i => i.orderId).filter(Boolean)).size;
    const totalShops = new Set(items.map(i => i.order?.shopId).filter(Boolean)).size;

    // Grouping Helpers
    const groupBy = (arr: any[], keyGetter: (item: any) => any) => {
      const map = new Map();
      arr.forEach((item) => {
        const key = keyGetter(item);
        const collection = map.get(key);
        if (!collection) {
          map.set(key, [item]);
        } else {
          collection.push(item);
        }
      });
      return map;
    };

    const mapToSummary = (map: Map<any, any[]>, labelGetter: (items: any[]) => string) => {
      return Array.from(map.entries()).map(([key, groupItems]) => ({
        id: key,
        label: labelGetter(groupItems),
        totalQty: groupItems.reduce((sum, i) => sum + safeNum(i.freeQuantity), 0),
        totalValue: groupItems.reduce((sum, i) => sum + (safeNum(i.freeQuantity) * safeNum(i.product?.salePrice)), 0),
      })).sort((a, b) => b.totalQty - a.totalQty);
    };

    const companySummary = mapToSummary(groupBy(items, i => i.order?.companyId), items => items[0]?.order?.company?.name || 'Unknown');
    const routeSummary = mapToSummary(groupBy(items, i => i.order?.routeId), items => items[0]?.order?.route?.name || 'Unknown');
    const productSummary = mapToSummary(groupBy(items, i => i.productId), items => items[0]?.product?.name || 'Unknown');
    const shopSummary = mapToSummary(groupBy(items, i => i.order?.shopId), items => items[0]?.order?.shop?.name || 'Direct Order');
    const deliveryManSummary = mapToSummary(groupBy(items, i => i.order?.deliveryPersonId), items => items[0]?.order?.deliveryPerson?.name || 'Unassigned');

    return {
      summary: {
        totalFreeQty,
        todayFreeQty,
        totalFreeValue,
        totalOrders,
        totalShops,
        topProduct: productSummary[0]?.label || 'N/A',
        topRoute: routeSummary[0]?.label || 'N/A',
        topCompany: companySummary[0]?.label || 'N/A',
      },
      detailRows: items.map(i => ({
        id: i.id,
        date: i.order?.orderDate,
        orderId: i.orderId,
        company: i.order?.company?.name,
        route: i.order?.route?.name,
        shop: i.order?.shop?.name || 'Direct Order',
        deliveryMan: i.order?.deliveryPerson?.name || 'Unassigned',
        product: i.product?.name,
        orderedQty: i.quantity,
        freeQty: i.freeQuantity,
        unit: i.product?.unit,
        price: i.product?.salePrice,
        freeValue: Number(i.freeQuantity) * Number(i.product?.salePrice || 0),
        status: i.order?.status || 'Unknown',
      })),
      companySummary,
      routeSummary,
      productSummary,
      shopSummary,
      deliveryManSummary,
    };
  }

  async getDamageReport(filters: any, user?: any) {
    const qb = this.damageRecordRepository.createQueryBuilder('damage')
      .leftJoinAndSelect('damage.product', 'product')
      .leftJoinAndSelect('damage.order', 'order')
      .leftJoinAndSelect('order.company', 'company')
      .leftJoinAndSelect('order.route', 'route')
      .leftJoinAndSelect('order.shop', 'shop')
      .leftJoinAndSelect('order.deliveryPerson', 'deliveryPerson')
      .leftJoinAndSelect('damage.batch', 'batch');

    if (user && user.role === Role.SR) {
      qb.andWhere('order.createdById = :userId', { userId: user.id || user.sub });
    }

    // Apply Filters
    if (filters.dateMode === 'Today') {
      const { startUtc, endUtc } = getBDDayRange();
      qb.andWhere('damage.createdAt BETWEEN :start AND :end', { start: startUtc, end: endUtc });
    } else if (filters.dateMode === 'Selected Date' && filters.date) {
      qb.andWhere('DATE(damage.createdAt) = :date', { date: filters.date });
    } else if (filters.dateMode === 'Date Range' && filters.fromDate && filters.toDate) {
      qb.andWhere('DATE(damage.createdAt) BETWEEN :fromDate AND :toDate', { 
        fromDate: filters.fromDate, 
        toDate: filters.toDate 
      });
    }

    if (filters.companyId) {
      qb.andWhere('order.companyId = :companyId', { companyId: filters.companyId });
    }
    if (filters.routeId) {
      qb.andWhere('order.routeId = :routeId', { routeId: filters.routeId });
    }
    if (filters.shopId) {
      qb.andWhere('order.shopId = :shopId', { shopId: filters.shopId });
    }
    if (filters.deliveryManId) {
      qb.andWhere('order.deliveryPersonId = :deliveryManId', { deliveryManId: filters.deliveryManId });
    }
    if (filters.productId) {
      qb.andWhere('damage.productId = :productId', { productId: filters.productId });
    }

    const items = await qb.getMany();

    // Summary Calculations
    const safeNum = (val: any) => isNaN(Number(val)) ? 0 : Number(val);
    const totalDamagedQty = items.reduce((sum, i) => sum + safeNum(i.quantity), 0);
    const todayDamagedQty = items.filter(i => isTodayBDDate(i.createdAt)).reduce((sum, i) => sum + safeNum(i.quantity), 0);
    const totalDamageValue = items.reduce((sum, i) => sum + (safeNum(i.quantity) * safeNum(i.product?.salePrice)), 0);
    const totalOrders = new Set(items.map(i => i.orderId).filter(Boolean)).size;
    const totalShops = new Set(items.map(i => i.order?.shopId).filter(Boolean)).size;

    // Grouping Helpers
    const groupBy = (arr: any[], keyGetter: (item: any) => any) => {
      const map = new Map();
      arr.forEach((item) => {
        const key = keyGetter(item);
        const collection = map.get(key);
        if (!collection) {
          map.set(key, [item]);
        } else {
          collection.push(item);
        }
      });
      return map;
    };

    const mapToSummary = (map: Map<any, any[]>, labelGetter: (items: any[]) => string) => {
      return Array.from(map.entries()).map(([key, groupItems]) => ({
        id: key,
        label: labelGetter(groupItems),
        totalQty: groupItems.reduce((sum, i) => sum + safeNum(i.quantity), 0),
        totalValue: groupItems.reduce((sum, i) => sum + (safeNum(i.quantity) * safeNum(i.product?.salePrice)), 0),
      })).sort((a, b) => b.totalQty - a.totalQty);
    };

    const companySummary = mapToSummary(groupBy(items, i => i.order?.companyId), items => items[0]?.order?.company?.name || 'Unknown');
    const routeSummary = mapToSummary(groupBy(items, i => i.order?.routeId), items => items[0]?.order?.route?.name || 'Unknown');
    const productSummary = mapToSummary(groupBy(items, i => i.productId), items => items[0]?.product?.name || 'Unknown');
    const shopSummary = mapToSummary(groupBy(items, i => i.order?.shopId), items => items[0]?.order?.shop?.name || 'Direct Order');
    const deliveryManSummary = mapToSummary(groupBy(items, i => i.order?.deliveryPersonId), items => items[0]?.order?.deliveryPerson?.name || 'Unassigned');

    return {
      summary: {
        totalDamagedQty,
        todayDamagedQty,
        totalDamageValue,
        totalOrders,
        totalShops,
        topProduct: productSummary[0]?.label || 'N/A',
        topRoute: routeSummary[0]?.label || 'N/A',
        topCompany: companySummary[0]?.label || 'N/A',
      },
      detailRows: items.map(i => ({
        id: i.id,
        date: i.createdAt,
        orderId: i.orderId,
        company: i.order?.company?.name,
        route: i.order?.route?.name,
        shop: i.order?.shop?.name || 'Direct Order',
        deliveryMan: i.order?.deliveryPerson?.name || 'Unassigned',
        product: i.product?.name,
        damagedQty: i.quantity,
        unit: i.product?.unit,
        price: i.product?.salePrice,
        damageValue: Number(i.quantity) * Number(i.product?.salePrice || 0),
        reason: i.reason || 'N/A',
        batchNo: i.batch?.batchNo,
      })),
      companySummary,
      routeSummary,
      productSummary,
      shopSummary,
      deliveryManSummary,
    };
  }
}
