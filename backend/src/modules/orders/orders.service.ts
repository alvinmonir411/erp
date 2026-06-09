import { BadRequestException, Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getBDDayRange, isTodayBD, isTodayBDDate } from '../../common/utils/date.utils';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderItem } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { DiscountType, OrderStatus } from './orders.constants';
import { SettleOrderDto } from './dto/settle-order.dto';
import { StockMovementType } from '../stock/stock.constants';
import { Product } from '../products/entities/product.entity';
import { StockService } from '../stock/stock.service';
import { DuesService } from '../dues/dues.service';
import { Role } from '../../common/enums/role.enum';
import { Due } from '../dues/entities/due.entity';
import { DueCollection } from '../dues/entities/due-collection.entity';
import { DispatchBatchOrder } from '../delivery-ops/entities/dispatch-batch-order.entity';
import { DispatchBatchStatus } from '../delivery-ops/entities/dispatch-batch.entity';
import { DamageRecord } from '../delivery-ops/entities/damage-record.entity';
import { DeliveryPerson } from '../delivery-ops/entities/delivery-person.entity';
import { Shop } from '../shops/entities/shop.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Due)
    private readonly duesRepository: Repository<Due>,
    @InjectRepository(DispatchBatchOrder)
    private readonly batchOrderRepository: Repository<DispatchBatchOrder>,
    private readonly stockService: StockService,
    private readonly duesService: DuesService,
    private readonly dataSource: DataSource,
  ) { }

  private readonly logger = new Logger(OrdersService.name);

  /**
   * Prevents changes to orders that are part of an active dispatch batch.
   */
  private async validateBatchLock(orderId: number) {
    const batchOrder = await this.batchOrderRepository.findOne({
      where: { orderId },
      relations: ['batch'],
    });

    if (
      batchOrder && 
      [
        DispatchBatchStatus.RETURN_PENDING,
        DispatchBatchStatus.PARTIALLY_SETTLED,
        DispatchBatchStatus.SETTLED
      ].includes(batchOrder.batch.status as DispatchBatchStatus)
    ) {
      throw new BadRequestException(
        `Order #${orderId} is locked because its delivery batch (${batchOrder.batch.batchNo}) is currently in the settlement phase.`,
      );
    }
  }

  /**
   * Centralized stock handling for orders.
   */
  private async handleStockChange(
    order: Order,
    items: OrderItem[],
    type: StockMovementType,
    manager: any,
  ) {
    for (const item of items) {
      const qty = Number(item.quantity) + Number(item.freeQuantity || 0);
      if (qty === 0) continue;

      // For STOCK_OUT, we use negative quantity
      const movementQty = type === StockMovementType.STOCK_OUT ? -qty : qty;

      await this.stockService.create(
        {
          productId: item.productId,
          companyId: order.companyId,
          type: type,
          quantity: movementQty,
          reference: `Order #${order.id}`,
          note: `${type === StockMovementType.STOCK_OUT ? 'Reserved' : 'Released'} for order #${order.id}`,
        },
        'System',
        manager,
      );
    }
  }

  async create(dto: CreateOrderDto, user?: any) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    return this.dataSource.transaction(async (manager) => {
      const order = manager.create(Order, {
        orderDate: new Date(dto.orderDate),
        companyId: dto.companyId,
        routeId: dto.routeId,
        deliveryPersonId: dto.deliveryPersonId,
        marketArea: dto.marketArea,
        shopId: dto.shopId,
        discountType: dto.discountType || DiscountType.FIXED,
        discountValue: dto.discountValue || 0,
        advancePaid: dto.advancePaid || 0,
        note: dto.note,
        status: dto.deliveryPersonId ? OrderStatus.ASSIGNED : OrderStatus.CONFIRMED,
        createdBy: user?.name || user?.username || 'Admin',
        createdById: (user?.id || user?.sub) ?? null,
        createdByRole: user?.role || Role.SUPER_ADMIN,
      });

      const { items, subtotal, grandTotal } = this.buildOrderItems(dto.items, manager);

      // Validate stock
      for (const itemDto of dto.items) {
        const totalRequested = Number(itemDto.quantity) + Number(itemDto.freeQuantity || 0);
        const currentStock = await this.getProductStock(itemDto.productId, manager);
        if (currentStock < totalRequested) {
          const product = await manager.findOne(Product, { where: { id: itemDto.productId } });
          throw new BadRequestException(`Insufficient stock for product ${product?.name}. Available: ${currentStock}, Requested: ${totalRequested}`);
        }
      }

      order.subtotal = subtotal;
      order.discountAmount = this.getInvoiceDiscountAmount(subtotal, order.discountType, order.discountValue);
      order.grandTotal = Math.max(0, grandTotal - order.discountAmount);
      order.actualSoldAmount = order.grandTotal;
      order.dueAmount = Math.max(0, order.grandTotal - Number(order.advancePaid || 0));

      const savedOrder = await manager.save(order);

      for (const item of items) {
        item.orderId = savedOrder.id;
      }
      await manager.save(items);

      // Deduct stock immediately upon confirmation/assignment
      await this.handleStockChange(savedOrder, items, StockMovementType.STOCK_OUT, manager);

      const finalOrder = await manager.findOne(Order, {
        where: { id: savedOrder.id },
        relations: ['items', 'items.product', 'company', 'route', 'shop', 'deliveryPerson'],
      });
      if (!finalOrder) throw new NotFoundException(`Order #${savedOrder.id} not found after creation`);
      return finalOrder;
    });
  }

  async update(id: number, dto: CreateOrderDto) {
    await this.validateBatchLock(id);
    const existingOrder = await this.findOne(id);

    if ([OrderStatus.CANCELLED, OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE].includes(existingOrder.status)) {
      throw new BadRequestException('Cannot edit a cancelled or settled order');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Return old stock
      await this.handleStockChange(existingOrder, existingOrder.items, StockMovementType.RETURN_IN, manager);

      // 2. Clear old items
      await manager.delete(OrderItem, { orderId: id });

      const { items, subtotal, grandTotal } = this.buildOrderItems(dto.items, manager);

      // 3. Validate new stock
      for (const itemDto of dto.items) {
        const totalRequested = Number(itemDto.quantity) + Number(itemDto.freeQuantity || 0);
        const currentStock = await this.getProductStock(itemDto.productId, manager);
        if (currentStock < totalRequested) {
          const product = await manager.findOne(Product, { where: { id: itemDto.productId } });
          throw new BadRequestException(`Insufficient stock for product ${product?.name}. Available: ${currentStock}, Requested: ${totalRequested}`);
        }
      }

      const discountType = dto.discountType || DiscountType.FIXED;
      const discountValue = dto.discountValue || 0;
      const discountAmount = this.getInvoiceDiscountAmount(subtotal, discountType, discountValue);

      await manager.update(Order, id, {
        orderDate: new Date(dto.orderDate),
        companyId: dto.companyId,
        routeId: dto.routeId,
        deliveryPersonId: dto.deliveryPersonId,
        marketArea: dto.marketArea,
        shopId: dto.shopId,
        discountType,
        discountValue,
        discountAmount,
        subtotal,
        grandTotal: Math.max(0, grandTotal - discountAmount),
        actualSoldAmount: Math.max(0, grandTotal - discountAmount),
        advancePaid: dto.advancePaid || 0,
        dueAmount: Math.max(0, Math.max(0, grandTotal - discountAmount) - Number(dto.advancePaid || 0)),
        note: dto.note,
        status: dto.deliveryPersonId ? OrderStatus.ASSIGNED : OrderStatus.CONFIRMED,
      });

      for (const item of items) {
        item.orderId = id;
      }
      await manager.save(items);

      // 4. Deduct new stock
      const updatedOrder = await manager.findOne(Order, { where: { id } });
      if (!updatedOrder) {
        throw new NotFoundException(`Order #${id} not found during stock update`);
      }
      await this.handleStockChange(updatedOrder, items, StockMovementType.STOCK_OUT, manager);

      return this.findOne(id);
    });
  }

  async updateStatus(id: number, status: OrderStatus) {
    const order = await this.findOne(id);
    if (!order) throw new BadRequestException('Order not found');

    // Prevent unsafe manual changes if part of a batch
    await this.validateBatchLock(id);

    return this.dataSource.transaction(async (manager) => {
      if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
        // Return stock if cancelled
        await this.handleStockChange(order, order.items, StockMovementType.RETURN_IN, manager);
      }

      const patch: Partial<Order> = { status };
      if (status === OrderStatus.OUT_FOR_DELIVERY) {
        patch.dispatchedAt = new Date();
        patch.isLocked = true;
      }
      if ([OrderStatus.DELIVERED, OrderStatus.PARTIALLY_DELIVERED].includes(status)) {
        patch.deliveredAt = new Date();
      }
      if ([OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE].includes(status)) {
        patch.settledAt = new Date();
      }

      await manager.update(Order, id, patch);
      return this.findOne(id);
    });
  }

  async delete(id: number) {
    console.log(`[OrdersService.delete] Called with id: ${id} (${typeof id})`);
    const order = await this.findOne(id);
    await this.validateBatchLock(id);

    return this.dataSource.transaction(async (manager) => {
      if (order.status !== OrderStatus.CANCELLED) {
        console.log(`[OrdersService.delete] Handling stock return for order #${id}`);
        await this.handleStockChange(order, order.items, StockMovementType.RETURN_IN, manager);
      }
      
      console.log(`[OrdersService.delete] Starting raw deletions for order #${id}`);
      
      const res1 = await manager.query('DELETE FROM due_collections WHERE "orderId" = $1', [id]);
      console.log(`[OrdersService.delete] Deleted due_collections:`, res1);

      const res2 = await manager.query('DELETE FROM dues WHERE "orderId" = $1', [id]);
      console.log(`[OrdersService.delete] Deleted dues:`, res2);

      const res3 = await manager.query('DELETE FROM damage_records WHERE "orderId" = $1', [id]);
      console.log(`[OrdersService.delete] Deleted damage_records:`, res3);

      const res4 = await manager.query('DELETE FROM dispatch_batch_orders WHERE "orderId" = $1', [id]);
      console.log(`[OrdersService.delete] Deleted dispatch_batch_orders:`, res4);

      const res5 = await manager.query('DELETE FROM order_items WHERE "orderId" = $1', [id]);
      console.log(`[OrdersService.delete] Deleted order_items:`, res5);

      console.log(`[OrdersService.delete] Executing manager.delete for Order #${id}`);
      const deleteResult = await manager.delete(Order, id);
      console.log(`[OrdersService.delete] manager.delete result:`, deleteResult);
      return deleteResult;
    });
  }

  async updateShop(id: number, shopId: number) {
    const order = await this.findOne(id);
    
    // Intentionally bypassing validateBatchLock(id) here.
    // This breaks the deadlock where an order without a shop gets locked in an active batch,
    // and settlement fails because due creation requires a shop, but shop cannot be linked due to the batch lock.
    
    const shop = await this.dataSource.getRepository(Shop).findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException(`Shop #${shopId} not found`);
    }

    if (shop.companyId !== order.companyId) {
      throw new BadRequestException('Shop belongs to a different company than the order');
    }

    if (shop.routeId !== order.routeId) {
      throw new BadRequestException('Shop belongs to a different route than the order');
    }

    await this.ordersRepository.update(id, { shopId });
    return this.findOne(id);
  }

  async updateDelivery(id: number, dto: any, user: any) {
    const order = await this.findOne(id, user);

    if ([OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE].includes(order.status)) {
      throw new BadRequestException('Cannot update delivery for a settled order');
    }

    if (user.role === Role.DELIVERY_MAN) {
      const userId = user.id || user.sub;
      if (!userId || order.assignedDeliveryManId !== String(userId)) {
        throw new ForbiddenException('You are not assigned to this delivery');
      }
    }

    return this.dataSource.transaction(async (manager) => {
      // Update items
      for (const itemDto of dto.items) {
        const item = order.items.find(i => i.productId === itemDto.productId);
        if (item) {
          const totalDispatched = Number(item.quantity) + Number(item.freeQuantity || 0);
          const returned = Number(itemDto.returnedQuantity || 0);
          const damaged = Number(itemDto.damagedQuantity || 0);

          if (returned + damaged > totalDispatched) {
            throw new BadRequestException(`Returned + Damaged quantity (${returned + damaged}) for product ID ${itemDto.productId} exceeds dispatched quantity (${totalDispatched})`);
          }

          await manager.update(OrderItem, item.id, {
            returnedPaidQuantity: returned,
            damagedPaidQuantity: damaged,
            deliveredPaidQuantity: Number(item.quantity) - (returned + damaged),
          });
        }
      }

      // Update order
      await manager.update(Order, id, {
        collectedAmount: dto.collectedAmount || 0,
        deliveryNote: dto.deliveryNote || '',
        status: dto.status || order.status,
        deliveredAt: new Date(),
      });

      return this.findOne(id, user);
    });
  }

  async settleOrder(id: number, dto: SettleOrderDto, manager?: any) {
    const exec = async (m: any) => {
      // 1. Lock the order row first using QueryBuilder to ensure NO joins are generated
      const lockOrder = await m.createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write')
        .where('order.id = :id', { id })
        .getOne();
      if (!lockOrder) throw new BadRequestException('Order not found');

      // 2. Fetch with relations
      const order = await m.findOne(Order, {
        where: { id },
        relations: ['items', 'items.product', 'company'],
      });

      if (!order) throw new BadRequestException('Order not found');
      if ([OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE].includes(order.status)) return order;

      let totalSoldAmount = 0;

      for (const itemDto of dto.items) {
        const orderItem = order.items.find((i: { productId: number; }) => i.productId === itemDto.productId);
        if (!orderItem) continue;

        const returnedPaid = Number(itemDto.returnedPaidQuantity || 0);
        const returnedFree = Number(itemDto.returnedFreeQuantity || 0);
        const damagedPaid = Number(itemDto.damagedPaidQuantity || 0);
        const damagedFree = Number(itemDto.damagedFreeQuantity || 0);

        const deliveredPaid = Math.max(0, Number(orderItem.quantity) - returnedPaid - damagedPaid);
        const deliveredFree = Math.max(0, Number(orderItem.freeQuantity) - returnedFree - damagedFree);

        // --- Stock Logic ---
        // 1. Returned Stock -> Added back to inventory (idempotent)
        const totalReturned = returnedPaid + returnedFree;
        if (totalReturned > 0) {
          await this.stockService.create({
            productId: orderItem.productId,
            companyId: order.companyId,
            type: StockMovementType.RETURN_IN,
            quantity: totalReturned,
            reference: `Order #${id}`,
            idempotencyKey: `SETTLE_RET_${id}_${orderItem.productId}`,
            note: `Returned ${totalReturned} units (${returnedPaid} paid, ${returnedFree} free) from order #${id}`,
          }, 'Admin', m);
        }

        // 2. Damaged Stock -> Audited but NOT returned to inventory
        const totalDamaged = damagedPaid + damagedFree;
        if (totalDamaged > 0) {
          await this.stockService.create({
            productId: orderItem.productId,
            companyId: order.companyId,
            type: StockMovementType.DAMAGE,
            quantity: -totalDamaged,
            reference: `Order #${id}`,
            idempotencyKey: `SETTLE_DAM_${id}_${orderItem.productId}`,
            note: `Damaged ${totalDamaged} units (${damagedPaid} paid, ${damagedFree} free) from order #${id}`,
          }, 'Admin', m);
        }

        // --- Money Formula ---
        const lineItemPrice = Number(orderItem.quantity) > 0 
          ? Number(orderItem.lineTotal) / Number(orderItem.quantity)
          : 0;

        totalSoldAmount += deliveredPaid * lineItemPrice;

        await m.update(OrderItem, orderItem.id, {
          deliveredPaidQuantity: deliveredPaid,
          deliveredFreeQuantity: deliveredFree,
          returnedPaidQuantity: returnedPaid,
          returnedFreeQuantity: returnedFree,
          damagedPaidQuantity: damagedPaid,
          damagedFreeQuantity: damagedFree,
        });
      }

      // Calculate final invoice discount proportionally
      const invoiceDiscountRatio = Number(order.subtotal) > 0 
        ? totalSoldAmount / Number(order.subtotal)
        : 0;
      const finalInvoiceDiscount = Number(order.discountAmount || 0) * invoiceDiscountRatio;

      const grandTotal = Math.max(0, Number((totalSoldAmount - finalInvoiceDiscount).toFixed(2)));
      const collectedAmount = Number(dto.collectedAmount || 0);
      
      // Triple-Check Rule: Expected Cash = Sold Amount - Advance Paid
      const expectedCash = Math.max(0, grandTotal - Number(order.advancePaid || 0));
      
      // Expected Due = Expected Cash - Reported Collected
      const dueAmount = Math.max(0, Number((expectedCash - collectedAmount).toFixed(2)));

      await m.update(Order, id, {
        actualSoldAmount: grandTotal,
        collectedAmount,
        dueAmount,
        settlementNote: dto.settlementNote,
        settledAt: new Date(),
        status: dueAmount > 0.01 ? OrderStatus.PARTIAL_DUE : OrderStatus.SETTLED,
        isLocked: true,
      });

      // ── Update in-memory object so upsertDue sees the freshly-calculated values ──
      // Without this, upsertDue reads stale order.actualSoldAmount / order.collectedAmount
      // from the DB fetch above, and rejects legitimate dues with a false "amount > max" error.
      order.actualSoldAmount = grandTotal;
      order.collectedAmount = collectedAmount;
      await this.duesService.upsertDue(order, dueAmount, m, dto.settlementNote);

      return m.findOne(Order, {
        where: { id },
        relations: ['items', 'items.product', 'company', 'route', 'shop'],
      });
    };

    if (manager) return exec(manager);
    return this.dataSource.transaction(exec);
  }

  // --- Helper Methods ---

  async findOne(id: number, user?: any) {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'company', 'route', 'shop', 'deliveryPerson', 'assignedDeliveryMan'],
    });

    if (!order) throw new NotFoundException('Order not found');

    // Access control for SR
    if (user && user.role === Role.SR) {
      if (order.createdById !== (user.id || user.sub)) {
        throw new ForbiddenException('You do not have permission to view this order');
      }
    }

    // Access control for DELIVERY_MAN
    if (user && user.role === Role.DELIVERY_MAN) {
      const userId = user.id || user.sub;
      const batchOrder = await this.batchOrderRepository.findOne({
        where: { orderId: id },
        relations: ['batch'],
      });
      const assignedByOrder = order.assignedDeliveryManId === String(userId);
      const assignedByBatch = batchOrder?.batch?.assignedDeliveryManId === String(userId);
      if (!userId || (!assignedByOrder && !assignedByBatch)) {
        throw new ForbiddenException('You do not have permission to view this order');
      }
    }

    // Attach shop total due if available
    if (order.shopId) {
      try {
        const shopDues = await this.duesService.findShopDues(order.shopId, { role: Role.ADMIN });
        (order as any).shopTotalDue = shopDues.reduce((sum, d) => sum + Number(d.remainingDue || 0), 0);
      } catch {
        (order as any).shopTotalDue = 0;
      }
    } else {
      (order as any).shopTotalDue = 0;
    }

    return order;
  }

  async findAll(query: any = {}, user?: any) {
    const qb = this.ordersRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.company', 'company')
      .leftJoinAndSelect('order.route', 'route')
      .leftJoinAndSelect('order.shop', 'shop')
      .leftJoinAndSelect('order.deliveryPerson', 'deliveryPerson')
      .leftJoinAndSelect('order.assignedDeliveryMan', 'assignedDeliveryMan')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product');

    if (user && user.role === Role.SR) {
      qb.andWhere('order.createdById = :userId', { userId: user.id || user.sub });
    }

    if (user && user.role === Role.DELIVERY_MAN) {
      const userId = user.id || user.sub;
      if (userId) {
        qb.andWhere('order.assignedDeliveryManId = :userId', { userId });
      } else {
        qb.andWhere('order.id = -1');
      }
    }

    if (query.status) qb.andWhere('order.status = :status', { status: query.status });
    if (query.companyId) qb.andWhere('order.companyId = :companyId', { companyId: query.companyId });
    if (query.routeId) qb.andWhere('order.routeId = :routeId', { routeId: query.routeId });

    qb.orderBy('order.orderDate', 'DESC').addOrderBy('order.createdAt', 'DESC');
    return qb.getMany();
  }

  private buildOrderItems(itemsDto: any[], manager: any) {
    let subtotal = 0;
    const items: OrderItem[] = [];

    for (const itemDto of itemsDto) {
      const grossAmount = Number(itemDto.quantity) * Number(itemDto.unitPrice);
      const discAmt = itemDto.discountType === DiscountType.PERCENT
        ? grossAmount * (Number(itemDto.discountValue) / 100)
        : Number(itemDto.discountValue || 0);

      const lineTotal = Math.max(0, grossAmount - discAmt);
      subtotal += lineTotal;

      items.push(manager.create(OrderItem, {
        productId: itemDto.productId,
        quantity: itemDto.quantity,
        freeQuantity: itemDto.freeQuantity || 0,
        unitPrice: itemDto.unitPrice,
        discountType: itemDto.discountType || DiscountType.FIXED,
        discountValue: itemDto.discountValue || 0,
        discountAmount: discAmt,
        lineTotal,
      }));
    }

    return { items, subtotal, grandTotal: subtotal };
  }

  private getInvoiceDiscountAmount(subtotal: number, type: DiscountType, val: number) {
    return type === DiscountType.PERCENT ? subtotal * (Number(val) / 100) : Number(val);
  }

  private async getProductStock(productId: number, manager: any): Promise<number> {
    const product = await manager.findOne(Product, { where: { id: productId } });
    return Number(product?.currentStock || 0);
  }

  async getStats(user?: any) {
    // Basic stats implementation (omitted for brevity, can be refined later)
    return {};
  }
}
