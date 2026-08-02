import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { DispatchBatch } from '../delivery-ops/entities/dispatch-batch.entity';
import { DispatchBatchExpense } from '../delivery-ops/entities/dispatch-batch-expense.entity';
import { DamageRecord } from '../delivery-ops/entities/damage-record.entity';
import { Due } from '../dues/entities/due.entity';
import { getBDDayRange, getBDTodayString } from '../../common/utils/date.utils';

export interface BusinessOverviewQuery {
  datePreset?: string;
  startDate?: string;
  endDate?: string;
  routeId?: number;
  deliveryManId?: string;
  companyId?: number;
  productId?: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(DispatchBatch)
    private readonly batchRepository: Repository<DispatchBatch>,
    @InjectRepository(DispatchBatchExpense)
    private readonly expenseRepository: Repository<DispatchBatchExpense>,
    @InjectRepository(DamageRecord)
    private readonly damageRepository: Repository<DamageRecord>,
    @InjectRepository(Due)
    private readonly dueRepository: Repository<Due>,
    private readonly dataSource: DataSource,
  ) {}

  private parseDateRange(query: BusinessOverviewQuery) {
    const now = new Date();
    let startDate: string | undefined = query.startDate;
    let endDate: string | undefined = query.endDate;

    const preset = query.datePreset || 'this_month';

    if (preset === 'today') {
      const todayStr = getBDTodayString();
      startDate = todayStr;
      endDate = todayStr;
    } else if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      startDate = yStr;
      endDate = yStr;
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(now.getDate() - 7);
      startDate = d.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(now.getDate() - 30);
      startDate = d.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = first.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = first.toISOString().split('T')[0];
      endDate = last.toISOString().split('T')[0];
    }

    return { startDate, endDate, preset };
  }

  private safeNum(val: any): number {
    const n = Number(val);
    return isFinite(n) ? n : 0;
  }

  async getBusinessOverview(query: BusinessOverviewQuery) {
    const { startDate, endDate, preset } = this.parseDateRange(query);

    // 1. INVENTORY SUMMARY
    const prodQb = this.productRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.company', 'company');

    if (query.companyId) {
      prodQb.andWhere('p.companyId = :cId', { cId: query.companyId });
    }
    if (query.productId) {
      prodQb.andWhere('p.id = :pId', { pId: query.productId });
    }

    const products = await prodQb.getMany();

    let totalStockQty = 0;
    let totalStockValue = 0;
    let currentStockWorth = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const inventoryList = products.map((p) => {
      const qty = this.safeNum(p.currentStock);
      const buyP = this.safeNum(p.buyPrice);
      const saleP = this.safeNum(p.salePrice);
      const valCost = qty * buyP;
      const valMarket = qty * saleP;

      totalStockQty += qty;
      totalStockValue += valCost;
      currentStockWorth += valMarket;

      if (qty <= 0) outOfStockCount++;
      else if (qty <= 10) lowStockCount++;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        companyName: p.company?.name || 'N/A',
        currentStock: qty,
        buyPrice: buyP,
        salePrice: saleP,
        stockValueCost: valCost,
        stockValueMarket: valMarket,
      };
    });

    // 2. DISPATCH BATCHES & EXPENSES
    const batchQb = this.batchRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.route', 'route')
      .leftJoinAndSelect('b.deliveryPerson', 'deliveryPerson')
      .leftJoinAndSelect('b.assignedDeliveryMan', 'assignedDeliveryMan')
      .leftJoinAndSelect('b.expenses', 'expenses')
      .leftJoinAndSelect('b.items', 'items');

    if (startDate && endDate) {
      batchQb.andWhere('b.dispatchDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }
    if (query.routeId) {
      batchQb.andWhere('b.routeId = :rId', { rId: query.routeId });
    }
    if (query.deliveryManId) {
      batchQb.andWhere(
        '(b.assignedDeliveryManId = :dId OR b.deliveryPersonId = :dPersonId)',
        { dId: query.deliveryManId, dPersonId: Number(query.deliveryManId) || 0 },
      );
    }
    if (query.companyId) {
      batchQb.andWhere('b.companyId = :cId', { cId: query.companyId });
    }

    const batches = await batchQb.getMany();

    let totalVanRent = 0;
    let totalSalary = 0;
    let totalFuel = 0;
    let totalFood = 0;
    let totalOtherExpenses = 0;

    const routeExpenseMap = new Map<string, number>();
    const personExpenseMap = new Map<string, number>();
    const expenseList: any[] = [];
    const dateExpenseMap = new Map<string, { total: number; vanRent: number; salary: number; fuel: number; food: number; other: number }>();

    let totalSalesFromBatches = 0;
    let totalCollectedCash = 0;

    batches.forEach((batch) => {
      const dateStr = batch.dispatchDate
        ? new Date(batch.dispatchDate).toISOString().split('T')[0]
        : 'Unknown';
      const rName = batch.route?.name || 'Unassigned Route';
      const pName =
        batch.deliveryPerson?.name ||
        batch.assignedDeliveryMan?.name ||
        batch.assignedDeliveryMan?.username ||
        (batch.assignedDeliveryManId ? `Delivery Man (${batch.assignedDeliveryManId.substring(0, 8)})` : 'Unassigned');

      const vRent = this.safeNum(batch.vanRent);
      const sal = this.safeNum(batch.salary);

      totalVanRent += vRent;
      totalSalary += sal;

      let bOther = 0;
      let bFuel = 0;
      let bFood = 0;

      (batch.expenses || []).forEach((exp) => {
        const amt = this.safeNum(exp.amount);
        const typeLower = (exp.expenseType || '').toLowerCase();
        const nameLower = (exp.name || '').toLowerCase();

        if (typeLower.includes('fuel') || nameLower.includes('fuel') || nameLower.includes('তেল')) {
          bFuel += amt;
          totalFuel += amt;
        } else if (typeLower.includes('food') || nameLower.includes('food') || nameLower.includes('খাবার')) {
          bFood += amt;
          totalFood += amt;
        } else {
          bOther += amt;
          totalOtherExpenses += amt;
        }

        expenseList.push({
          id: `exp-${exp.id}`,
          date: dateStr,
          batchNo: batch.batchNo,
          route: rName,
          deliveryPerson: pName,
          category: exp.expenseType || 'Other',
          name: exp.name,
          amount: amt,
          note: exp.note || '',
        });
      });

      if (vRent > 0) {
        expenseList.push({
          id: `van-${batch.id}`,
          date: dateStr,
          batchNo: batch.batchNo,
          route: rName,
          deliveryPerson: pName,
          category: 'Van Rent',
          name: 'ভ্যান ভাড়া',
          amount: vRent,
          note: 'Fixed Batch Van Rent',
        });
      }

      if (sal > 0) {
        expenseList.push({
          id: `sal-${batch.id}`,
          date: dateStr,
          batchNo: batch.batchNo,
          route: rName,
          deliveryPerson: pName,
          category: 'Salary',
          name: 'বেতন/মজুরি',
          amount: sal,
          note: 'Fixed Batch Salary',
        });
      }

      const batchTotalExp = vRent + sal + bFuel + bFood + bOther;
      routeExpenseMap.set(rName, (routeExpenseMap.get(rName) || 0) + batchTotalExp);
      personExpenseMap.set(pName, (personExpenseMap.get(pName) || 0) + batchTotalExp);

      const dEntry = dateExpenseMap.get(dateStr) || { total: 0, vanRent: 0, salary: 0, fuel: 0, food: 0, other: 0 };
      dEntry.total += batchTotalExp;
      dEntry.vanRent += vRent;
      dEntry.salary += sal;
      dEntry.fuel += bFuel;
      dEntry.food += bFood;
      dEntry.other += bOther;
      dateExpenseMap.set(dateStr, dEntry);

      // Financials from batch
      totalSalesFromBatches += this.safeNum(batch.finalSoldValue || batch.grossDispatchedValue);
      totalCollectedCash += this.safeNum(batch.totalCollectedAmount);
    });

    const grandTotalExpenses = totalVanRent + totalSalary + totalFuel + totalFood + totalOtherExpenses;

    // 3. SALES & ORDERS SUMMARY
    const orderQb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.shop', 'shop')
      .leftJoinAndSelect('o.route', 'route');

    if (startDate && endDate) {
      orderQb.andWhere('o.orderDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }
    if (query.routeId) {
      orderQb.andWhere('o.routeId = :rId', { rId: query.routeId });
    }
    if (query.deliveryManId) {
      orderQb.andWhere('o.assignedDeliveryManId = :dId', { dId: query.deliveryManId });
    }
    if (query.companyId) {
      orderQb.andWhere('o.companyId = :cId', { cId: query.companyId });
    }

    const orders = await orderQb.getMany();
    const totalOrdersCount = orders.length;
    const totalSalesAmount = orders.reduce((sum, o) => sum + this.safeNum(o.grandTotal || o.actualSoldAmount), 0);

    const salesList = orders.map((o) => ({
      id: o.id,
      orderNo: `ORD-#${o.id}`,
      date: o.orderDate,
      shopName: o.shop?.name || 'N/A',
      routeName: o.route?.name || 'N/A',
      totalAmount: this.safeNum(o.grandTotal),
      payableAmount: this.safeNum(o.grandTotal || o.actualSoldAmount),
      status: o.status,
    }));

    // 4. DUES & COLLECTIONS
    const duesQb = this.dueRepository.createQueryBuilder('d').leftJoinAndSelect('d.shop', 'shop');
    if (query.routeId) {
      duesQb.andWhere('d.routeId = :rId', { rId: query.routeId });
    }
    const dues = await duesQb.getMany();
    const pendingCollection = dues.reduce((sum, d) => sum + this.safeNum(d.remainingDue), 0);
    const collectionEfficiencyPct = Math.min(
      100,
      Math.round(((totalCollectedCash || Math.max(0, totalSalesAmount - pendingCollection)) / Math.max(1, totalSalesAmount || totalCollectedCash + pendingCollection)) * 100),
    );

    // 5. FREE ITEMS SUMMARY
    const freeQb = this.orderItemRepository
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.product', 'product')
      .leftJoinAndSelect('fi.order', 'order')
      .leftJoinAndSelect('order.shop', 'shop')
      .leftJoinAndSelect('order.route', 'route')
      .where('fi.freeQuantity > 0');

    if (startDate && endDate) {
      freeQb.andWhere('order.orderDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }
    if (query.routeId) {
      freeQb.andWhere('order.routeId = :rId', { rId: query.routeId });
    }
    if (query.deliveryManId) {
      freeQb.andWhere('order.assignedDeliveryManId = :dId', { dId: query.deliveryManId });
    }
    if (query.productId) {
      freeQb.andWhere('fi.productId = :pId', { pId: query.productId });
    }

    const freeItems = await freeQb.getMany();
    let totalFreeQty = 0;
    let totalFreeCost = 0;

    const freeItemsList = freeItems.map((fi) => {
      const netQty = Math.max(0, this.safeNum(fi.freeQuantity) - this.safeNum(fi.returnedFreeQuantity));
      const unitPrice = this.safeNum(fi.product?.salePrice || fi.product?.buyPrice);
      const val = netQty * unitPrice;

      totalFreeQty += netQty;
      totalFreeCost += val;

      return {
        id: fi.id,
        date: fi.order?.orderDate || 'N/A',
        productName: fi.product?.name || 'N/A',
        shopName: fi.order?.shop?.name || 'N/A',
        routeName: fi.order?.route?.name || 'N/A',
        freeQuantity: netQty,
        unitPrice,
        totalValue: val,
      };
    });

    // 6. DAMAGE SUMMARY
    const damageQb = this.damageRepository
      .createQueryBuilder('dmg')
      .leftJoinAndSelect('dmg.product', 'product')
      .leftJoinAndSelect('dmg.route', 'route')
      .leftJoinAndSelect('dmg.shop', 'shop')
      .leftJoinAndSelect('dmg.assignedDeliveryMan', 'assignedDeliveryMan');

    if (startDate && endDate) {
      damageQb.andWhere('DATE(dmg.createdAt) BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }
    if (query.routeId) {
      damageQb.andWhere('(dmg.routeId = :rId OR route.id = :rId)', { rId: query.routeId });
    }
    if (query.deliveryManId) {
      damageQb.andWhere('(dmg.assignedDeliveryManId = :dId)', { dId: query.deliveryManId });
    }
    if (query.productId) {
      damageQb.andWhere('dmg.productId = :pId', { pId: query.productId });
    }

    const damages = await damageQb.getMany();
    let totalDamageQty = 0;
    let totalDamageLoss = 0;

    const damageList = damages.map((d) => {
      const qty = this.safeNum(d.quantity);
      const price = this.safeNum(d.product?.salePrice || d.product?.buyPrice);
      const loss = qty * price;

      totalDamageQty += qty;
      totalDamageLoss += loss;

      return {
        id: d.id,
        date: d.createdAt ? new Date(d.createdAt).toISOString().split('T')[0] : 'N/A',
        productName: d.product?.name || 'N/A',
        routeName: d.route?.name || 'N/A',
        shopName: d.shop?.name || 'N/A',
        quantity: qty,
        unitPrice: price,
        lossValue: loss,
        reason: d.reason || 'Damaged product',
      };
    });

    // 7. BUSINESS HEALTH CALCULATIONS
    const operationalLeakage = grandTotalExpenses + totalDamageLoss + totalFreeCost;
    const leakagePct = totalStockValue > 0
      ? Math.round((operationalLeakage / totalStockValue) * 1000) / 10
      : 0;
    const netBusinessWorth = Math.max(0, totalStockValue - operationalLeakage);
    const netBusinessAsset = totalStockValue;

    let healthStatus: 'HEALTHY' | 'ATTENTION_NEEDED' | 'HIGH_RISK' | 'CRITICAL' = 'HEALTHY';
    let healthLabel = 'সন্তুষ্টজনক (Healthy)';
    let healthBadgeColor = 'emerald';

    if (leakagePct > 20) {
      healthStatus = 'CRITICAL';
      healthLabel = 'জরুরী পর্যালোচনা প্রয়োজন (Critical Risk)';
      healthBadgeColor = 'red';
    } else if (leakagePct > 10) {
      healthStatus = 'HIGH_RISK';
      healthLabel = 'উচ্চ ঝুঁকি (High Risk)';
      healthBadgeColor = 'amber';
    } else if (leakagePct > 5) {
      healthStatus = 'ATTENTION_NEEDED';
      healthLabel = 'সতর্কতা প্রয়োজন (Attention Needed)';
      healthBadgeColor = 'yellow';
    }

    // 8. GENERATE SMART INSIGHTS
    const insights: any[] = [];

    // Highest expense route
    const routeBreakdown = Array.from(routeExpenseMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    if (routeBreakdown.length > 0 && routeBreakdown[0].amount > 0) {
      insights.push({
        type: 'warning',
        title: 'সর্বোচ্চ খরচকারী রুট (Top Spending Route)',
        description: `রুট "${routeBreakdown[0].name}" তে সর্বাধিক মোট ৳ ${routeBreakdown[0].amount.toLocaleString('en-IN')} খরচ হয়েছে।`,
      });
    }

    // Highest expense person
    const personBreakdown = Array.from(personExpenseMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    if (personBreakdown.length > 0 && personBreakdown[0].amount > 0) {
      insights.push({
        type: 'info',
        title: 'সর্বোচ্চ ডেলিভারি খরচকারী কর্মী',
        description: `ডেলিভারি ম্যান/ম্যানুয়াল "${personBreakdown[0].name}" মোট ৳ ${personBreakdown[0].amount.toLocaleString('en-IN')} খরচ করেছেন।`,
      });
    }

    // Damage loss insight
    if (totalDamageLoss > grandTotalExpenses && totalDamageLoss > 0) {
      insights.push({
        type: 'danger',
        title: 'ড্যামেজ ক্ষতি সর্বোচ্চ সতর্কবার্তা',
        description: `ড্যামেজ জনিত ক্ষতি (৳ ${totalDamageLoss.toLocaleString('en-IN')}) মোট অপারেটিং খরচের (৳ ${grandTotalExpenses.toLocaleString('en-IN')}) চেয়ে বেশি!`,
      });
    } else if (totalDamageLoss > 0) {
      insights.push({
        type: 'warning',
        title: 'ড্যামেজ ক্ষতির প্রভাব',
        description: `মোট ${totalDamageQty} টি পণ্যে মোট ৳ ${totalDamageLoss.toLocaleString('en-IN')} টাকার ক্ষতি হয়েছে।`,
      });
    }

    // Free Items insight
    if (totalFreeCost > 0) {
      insights.push({
        type: 'info',
        title: 'ফ্রি প্রোডাক্ট প্রদান ট্র্যাকিং',
        description: `এই সময়সীমায় মোট ${totalFreeQty} পিস পণ্য (মুল্য ৳ ${totalFreeCost.toLocaleString('en-IN')}) ফ্রি হিসেবে সরবরাহ করা হয়েছে।`,
      });
    }

    // Collection efficiency insight
    insights.push({
      type: collectionEfficiencyPct >= 90 ? 'success' : 'warning',
      title: 'ক্যাশ কালেকশন দক্ষতা',
      description: `বর্তমান কালেকশন দক্ষতা ${collectionEfficiencyPct}%। বকেয়া/ডিউ পরিমাণ ৳ ${pendingCollection.toLocaleString('en-IN')}।`,
    });

    // Health overall insight
    insights.push({
      type: healthStatus === 'HEALTHY' ? 'success' : healthStatus === 'ATTENTION_NEEDED' ? 'warning' : 'danger',
      title: `ব্যবসার বর্তমান স্বাস্থ্য: ${healthLabel}`,
      description: `মোট লিকুইডেশন/ক্ষতির হার স্টকের ${leakagePct}% (অপারেটিং লিকেজ ৳ ${operationalLeakage.toLocaleString('en-IN')})।`,
    });

    // 9. CHARTS DATA PREPARATION
    const expenseTrend = Array.from(dateExpenseMap.entries())
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalCategorySum = Math.max(1, grandTotalExpenses);
    const expenseCategoryPie = [
      { category: 'ভ্যান ভাড়া (Van Rent)', amount: totalVanRent, percentage: Math.round((totalVanRent / totalCategorySum) * 100) },
      { category: 'বেতন (Salary)', amount: totalSalary, percentage: Math.round((totalSalary / totalCategorySum) * 100) },
      { category: 'ফুয়েল/তেল (Fuel)', amount: totalFuel, percentage: Math.round((totalFuel / totalCategorySum) * 100) },
      { category: 'খাবার (Food)', amount: totalFood, percentage: Math.round((totalFood / totalCategorySum) * 100) },
      { category: 'অন্যান্য (Other Expenses)', amount: totalOtherExpenses, percentage: Math.round((totalOtherExpenses / totalCategorySum) * 100) },
    ].filter((item) => item.amount > 0);

    const operationalLeakageBreakdown = [
      { name: 'ডেলিভারি খরচ (Expenses)', amount: grandTotalExpenses },
      { name: 'ড্যামেজ ক্ষতি (Damage Loss)', amount: totalDamageLoss },
      { name: 'ফ্রি মালামাল মুল্য (Free Items)', amount: totalFreeCost },
    ];

    return {
      inventory: {
        totalStockQty,
        totalStockValue,
        currentStockWorth,
        lowStockCount,
        outOfStockCount,
        list: inventoryList,
      },
      sales: {
        totalSalesAmount,
        totalOrders: totalOrdersCount,
        list: salesList,
      },
      collections: {
        totalCollectedCash,
        pendingCollection,
        collectionEfficiencyPct,
        list: [],
      },
      expenses: {
        totalExpenses: grandTotalExpenses,
        vanRent: totalVanRent,
        salary: totalSalary,
        fuel: totalFuel,
        food: totalFood,
        otherExpenses: totalOtherExpenses,
        breakdownByRoute: routeBreakdown,
        breakdownByPerson: personBreakdown,
        list: expenseList,
      },
      freeItems: {
        totalQty: totalFreeQty,
        totalCost: totalFreeCost,
        list: freeItemsList,
      },
      damage: {
        totalQty: totalDamageQty,
        totalLossValue: totalDamageLoss,
        list: damageList,
      },
      businessHealth: {
        netBusinessWorth,
        netBusinessAsset,
        operationalLeakage,
        leakagePct,
        status: healthStatus,
        label: healthLabel,
        badgeColor: healthBadgeColor,
      },
      insights,
      charts: {
        expenseTrend,
        expenseCategoryPie,
        operationalLeakageBreakdown,
        routeWiseExpense: routeBreakdown,
        deliveryPersonExpense: personBreakdown,
      },
      filters: {
        preset,
        startDate,
        endDate,
      },
    };
  }
}
