import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { DeliverySummary, DeliverySummaryStatus } from './entities/delivery-summary.entity';
import { DeliverySummaryItem } from './entities/delivery-summary-item.entity';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/entities/order.entity';
import { StockService } from '../stock/stock.service';
import { StockMovementType } from '../stock/stock.constants';

@Injectable()
export class DeliverySummariesService {
  constructor(
    @InjectRepository(DeliverySummary)
    private readonly summaryRepository: Repository<DeliverySummary>,
    @InjectRepository(DeliverySummaryItem)
    private readonly itemRepository: Repository<DeliverySummaryItem>,
    private readonly ordersService: OrdersService,
    private readonly stockService: StockService,
    private readonly dataSource: DataSource,
  ) { }

  async findAll(query: any = {}) {
    const qb = this.summaryRepository.createQueryBuilder('s')
      .leftJoinAndSelect('s.company', 'company')
      .leftJoinAndSelect('s.route', 'route')
      .orderBy('s.deliveryDate', 'DESC')
      .addOrderBy('s.createdAt', 'DESC');

    if (query.startDate && query.endDate) {
      qb.andWhere('s.deliveryDate BETWEEN :start AND :end', {
        start: query.startDate,
        end: query.endDate,
      });
    }

    if (query.companyId) {
      qb.andWhere('s.companyId = :companyId', { companyId: query.companyId });
    }

    if (query.routeId) {
      qb.andWhere('s.routeId = :routeId', { routeId: query.routeId });
    }

    const total = await qb.getCount();

    if (query.page !== undefined || query.limit !== undefined) {
      const page = Number(query.page || 1);
      const limit = Number(query.limit || 15);
      const skip = (page - 1) * limit;
      qb.skip(skip).take(limit);
    }

    const items = await qb.getMany();
    return { items, totalItems: total };
  }

  async findOne(id: number) {
    const summary = await this.summaryRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'company', 'route'],
    });

    if (!summary) throw new NotFoundException('Delivery summary not found');
    return summary;
  }

  async syncOrders(date: string, companyId: number, routeId: number) {
    // 1. Find all confirmed/delivered orders for this date+company+route
    const orders = (await this.ordersService.findAll({
      startDate: date,
      endDate: date,
      companyId,
      routeId,
    })) as Order[];

    if (orders.length === 0) {
      throw new BadRequestException('No orders found for the selected date, company, and route');
    }

    return await this.dataSource.transaction(async (manager) => {
      // 2. Check if summary already exists
      let summary = await manager.findOne(DeliverySummary, {
        where: {
          deliveryDate: new Date(date),
          companyId,
          routeId
        },
        relations: ['items'],
      });

      if (!summary) {
        summary = manager.create(DeliverySummary, {
          deliveryDate: new Date(date),
          companyId,
          routeId,
          status: DeliverySummaryStatus.DRAFT,
        });
        summary = await manager.save(summary);
      }

      // 3. Aggregate product quantities
      const productMap = new Map<number, { ordered: number, price: number }>();

      for (const order of orders) {
        for (const item of order.items) {
          if (item.product?.companyId !== companyId) continue;
          const existing = productMap.get(item.productId) || { ordered: 0, price: item.unitPrice };
          productMap.set(item.productId, {
            ordered: existing.ordered + Number(item.quantity) + Number(item.freeQuantity || 0),
            price: item.unitPrice, // We use the price from the orders
          });
        }
      }

      // 4. Update or Create Items
      const summaryItems: DeliverySummaryItem[] = [];
      let totalAmount = 0;

      for (const [productId, data] of productMap.entries()) {
        let item = summary.items?.find(i => i.productId === productId);

        if (!item) {
          item = manager.create(DeliverySummaryItem, {
            summaryId: summary.id,
            productId,
            orderedQuantity: data.ordered,
            returnedQuantity: 0,
            soldQuantity: data.ordered,
            unitPrice: data.price,
            lineTotal: data.ordered * data.price,
          });
        } else {
          item.orderedQuantity = data.ordered;
          item.soldQuantity = item.orderedQuantity - item.returnedQuantity;
          item.unitPrice = data.price;
          item.lineTotal = item.soldQuantity * item.unitPrice;
        }

        totalAmount += item.lineTotal;
        summaryItems.push(item);
      }

      summary.totalAmount = totalAmount;
      await manager.save(summary);
      await manager.save(summaryItems);

      return this.findOne(summary.id);
    });
  }

  async updateReturns(id: number, items: { productId: number, returnedQuantity: number }[]) {
    const summary = await this.findOne(id);

    return await this.dataSource.transaction(async (manager) => {
      let totalAmount = 0;

      for (const update of items) {
        const item = summary.items.find(i => i.productId === update.productId);
        if (item) {
          const oldReturned = Number(item.returnedQuantity);
          const newReturned = Number(update.returnedQuantity);

          item.returnedQuantity = newReturned;
          item.soldQuantity = item.orderedQuantity - item.returnedQuantity;
          item.lineTotal = item.soldQuantity * item.unitPrice;

          totalAmount += item.lineTotal;
          await manager.save(item);

          // Stock Integration: Record the return
          const diff = newReturned - oldReturned;
          if (diff !== 0) {
            await this.stockService.create({
              productId: item.productId,
              companyId: summary.companyId,
              type: StockMovementType.RETURN_IN,
              quantity: diff, // Positive means stock coming back
              note: `Return from Delivery Summary #${summary.id}`,
              reference: `DS #${summary.id}`,
            }, 'Admin', manager);
          }
        }
      }

      summary.totalAmount = totalAmount;
      summary.status = DeliverySummaryStatus.COMPLETED;
      await manager.save(summary);

      return this.findOne(id);
    });
  }

  async markAsPrinted(id: number, mode: 'morning' | 'final') {
    const summary = await this.findOne(id);
    if (mode === 'morning') summary.morningPrinted = true;
    else summary.finalPrinted = true;
    return this.summaryRepository.save(summary);
  }

  async delete(id: number) {
    const summary = await this.findOne(id);

    return await this.dataSource.transaction(async (manager) => {
      // Rollback returned stock to prevent stock leaks upon summary deletion
      for (const item of summary.items) {
        const returned = Number(item.returnedQuantity || 0);
        if (returned > 0) {
          await this.stockService.create({
            productId: item.productId,
            companyId: summary.companyId,
            type: StockMovementType.ADJUSTMENT,
            quantity: -returned,
            note: `Reverted returned stock due to deletion of Delivery Summary #${summary.id}`,
            reference: `DS #${summary.id}`,
          }, 'Admin', manager);
        }
      }
      return manager.remove(DeliverySummary, summary);
    });
  }

  async getDailyReport(date: string, companyId?: number, routeId?: number) {
    const orders = (await this.ordersService.findAll({
      startDate: date,
      endDate: date,
      companyId,
      routeId,
    })) as Order[];

    const companyMap = new Map<number, { name: string, items: Map<number, { name: string, qty: number, price: number }> }>();

    for (const order of orders) {
      for (const item of order.items) {
        const prodCompanyId = Number(item.product?.companyId || order.companyId || 0);
        const prodCompanyName = item.product?.company?.name || order.company?.name || 'Unknown';

        if (!companyMap.has(prodCompanyId)) {
          companyMap.set(prodCompanyId, { name: prodCompanyName, items: new Map() });
        }

        const co = companyMap.get(prodCompanyId)!;
        if (!co.items.has(item.productId)) {
          co.items.set(item.productId, { name: item.product.name, qty: 0, price: item.unitPrice });
        }
        const prod = co.items.get(item.productId)!;
        prod.qty += Number(item.quantity) + Number(item.freeQuantity || 0);
      }
    }

    const groups = Array.from(companyMap.entries()).map(([coId, co]) => {
      const items = Array.from(co.items.entries()).map(([pId, p]) => ({
        productId: pId,
        productName: p.name,
        quantitySold: p.qty,
        unitPrice: p.price,
        totalAmount: p.qty * p.price,
      }));

      const subtotalQuantity = items.reduce((s, i) => s + i.quantitySold, 0);
      const subtotalAmount = items.reduce((s, i) => s + i.totalAmount, 0);

      return {
        companyId: coId,
        companyName: co.name,
        items,
        subtotalQuantity,
        subtotalAmount,
      };
    });

    const grandTotalQuantity = groups.reduce((s, g) => s + g.subtotalQuantity, 0);
    const grandTotalAmount = groups.reduce((s, g) => s + g.subtotalAmount, 0);

    return {
      date,
      scope: companyId ? 'company' : 'all',
      companyId: companyId || null,
      groups,
      grandTotalQuantity,
      grandTotalAmount,
    };
  }
}
