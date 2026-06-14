import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { DeliveryPerson } from './entities/delivery-person.entity';
import {
  DispatchBatch,
  DispatchBatchStatus,
} from './entities/dispatch-batch.entity';
import { DispatchBatchOrder } from './entities/dispatch-batch-order.entity';
import { DispatchBatchItem } from './entities/dispatch-batch-item.entity';
import { DeliveryReturn } from './entities/delivery-return.entity';
import { DeliveryReturnItem } from './entities/delivery-return-item.entity';
import { CashCollection } from './entities/cash-collection.entity';
import { DamageRecord } from './entities/damage-record.entity';
import { CreateDeliveryPersonDto } from './dto/create-delivery-person.dto';
import { CreateDispatchBatchDto } from './dto/create-dispatch-batch.dto';
import { QueryDispatchBatchesDto } from './dto/query-dispatch-batches.dto';
import { RecordBatchReturnsDto } from './dto/record-batch-returns.dto';
import { SettleDispatchBatchDto } from './dto/settle-dispatch-batch.dto';
import { DeliveryResultDto, DeliveryResultStatus } from './dto/delivery-result.dto';
import { CreateShopForOrderDto } from './dto/create-shop-for-order.dto';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { DiscountType, OrderStatus } from '../orders/orders.constants';
import { Product } from '../products/entities/product.entity';
import { StockService } from '../stock/stock.service';
import { DuesService } from '../dues/dues.service';
import { OrdersService } from '../orders/orders.service';
import { StockMovementType } from '../stock/stock.constants';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Shop } from '../shops/entities/shop.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    a %= b;
    [a, b] = [b, a];
  }
  return a;
};

const getBundleSize = (paid: number, free: number): number => {
  if (!free || free === 0) return 1;
  const common = gcd(paid, free);
  return (paid / common) + (free / common);
};

@Injectable()
export class DeliveryOpsService {
  constructor(
    @InjectRepository(DeliveryPerson)
    private readonly deliveryPersonRepository: Repository<DeliveryPerson>,
    @InjectRepository(DispatchBatch)
    private readonly batchRepository: Repository<DispatchBatch>,
    @InjectRepository(DispatchBatchOrder)
    private readonly batchOrderRepository: Repository<DispatchBatchOrder>,
    @InjectRepository(DispatchBatchItem)
    private readonly batchItemRepository: Repository<DispatchBatchItem>,
    @InjectRepository(DeliveryReturn)
    private readonly deliveryReturnRepository: Repository<DeliveryReturn>,
    @InjectRepository(DeliveryReturnItem)
    private readonly deliveryReturnItemRepository: Repository<DeliveryReturnItem>,
    @InjectRepository(CashCollection)
    private readonly cashCollectionRepository: Repository<CashCollection>,
    @InjectRepository(DamageRecord)
    private readonly damageRecordRepository: Repository<DamageRecord>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly stockService: StockService,
    private readonly duesService: DuesService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly dataSource: DataSource,
    private readonly realtimeGateway: RealtimeGateway,
  ) { }

  private readonly editableBatchStatuses = [
    DispatchBatchStatus.DRAFT,
    DispatchBatchStatus.PRINTED,
    DispatchBatchStatus.DISPATCHED,
    DispatchBatchStatus.RETURN_PENDING,
  ];

  private getUserId(user?: any): string | undefined {
    return user?.id || user?.sub;
  }

  private isDeliveryMan(user?: any): boolean {
    return user?.role === Role.DELIVERY_MAN;
  }

  private ensureDeliveryManOwnsBatch(batch: DispatchBatch, user?: any) {
    if (!this.isDeliveryMan(user)) return;
    const userId = this.getUserId(user);
    if (!userId || batch.assignedDeliveryManId !== String(userId)) {
      throw new ForbiddenException('You do not have permission to access this delivery batch');
    }
  }

  private assertBatchEditableByDelivery(batch: DispatchBatch) {
    if ([DispatchBatchStatus.SETTLED, DispatchBatchStatus.PARTIALLY_SETTLED].includes(batch.status)) {
      throw new BadRequestException('This batch is settled and delivery entries are locked');
    }
    if (batch.status === DispatchBatchStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a cancelled batch');
    }
  }

  async getDeliveryPeople(includeInactive = false) {
    return this.deliveryPersonRepository.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getDeliveryPersonById(id: number) {
    const person = await this.deliveryPersonRepository.findOne({ where: { id } });
    if (!person) throw new NotFoundException('Delivery person not found');
    return person;
  }

  async createDeliveryPerson(dto: CreateDeliveryPersonDto) {
    const person = this.deliveryPersonRepository.create({ ...dto, isActive: dto.isActive ?? true });
    return this.deliveryPersonRepository.save(person);
  }

  async updateDeliveryPerson(id: number, dto: Partial<CreateDeliveryPersonDto>) {
    const person = await this.getDeliveryPersonById(id);
    Object.assign(person, dto);
    return this.deliveryPersonRepository.save(person);
  }

  async deleteDeliveryPerson(id: number) {
    const person = await this.getDeliveryPersonById(id);
    const usedInOrders = await this.orderRepository.findOne({ where: { deliveryPersonId: id } });
    const usedInBatches = await this.batchRepository.findOne({ where: { deliveryPersonId: id } });
    if (usedInOrders || usedInBatches) {
      person.isActive = false;
      await this.deliveryPersonRepository.save(person);
      return { deleted: true, softDelete: true };
    }
    await this.deliveryPersonRepository.remove(person);
    return { deleted: true, softDelete: false };
  }

  async getEligibleOrders(query: QueryDispatchBatchesDto, user?: any) {
    const qb = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.company', 'company')
      .leftJoinAndSelect('order.route', 'route')
      .leftJoinAndSelect('order.shop', 'shop')
      .leftJoinAndSelect('order.deliveryPerson', 'deliveryPerson')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.status IN (:...statuses)', {
        statuses: [OrderStatus.CONFIRMED, OrderStatus.ASSIGNED],
      });

    if (user && user.role === Role.SR) {
      qb.andWhere('order.createdById = :userId', { userId: user.id || user.sub });
    }

    if (user && user.role === Role.DELIVERY_MAN) {
      qb.andWhere('order.assignedDeliveryManId = :userId', { userId: user.id || user.sub });
    }

    if (query.companyId) qb.andWhere('order.companyId = :companyId', { companyId: query.companyId });
    if (query.routeId) qb.andWhere('order.routeId = :routeId', { routeId: query.routeId });
    if (query.deliveryPersonId) qb.andWhere('order.deliveryPersonId = :deliveryPersonId', { deliveryPersonId: query.deliveryPersonId });
    if (query.dispatchDate) qb.andWhere('order.orderDate = :dispatchDate', { dispatchDate: query.dispatchDate });
    const orders = await qb.orderBy('order.createdAt', 'ASC').getMany();
    const activeOrderIds = await this.getActiveBatchOrderIds();
    return orders.filter((order) => !activeOrderIds.has(order.id));
  }

  private async getActiveBatchOrderIds(): Promise<Set<number>> {
    const activeBatches = await this.batchRepository.find({
      where: { status: In([...this.editableBatchStatuses, DispatchBatchStatus.PARTIALLY_SETTLED]) },
      relations: ['orders'],
    });
    const ids = new Set<number>();
    activeBatches.forEach(b => b.orders.forEach(o => ids.add(o.orderId)));
    return ids;
  }

  async getDispatchBatches(query: QueryDispatchBatchesDto, user?: any) {
    const qb = this.batchRepository.createQueryBuilder('batch')
      .leftJoinAndSelect('batch.company', 'company')
      .leftJoinAndSelect('batch.route', 'route')
      .leftJoinAndSelect('batch.deliveryPerson', 'deliveryPerson')
      .leftJoinAndSelect('batch.assignedDeliveryMan', 'assignedDeliveryMan')
      .leftJoinAndSelect('batch.orders', 'batchOrders')
      .leftJoinAndSelect('batchOrders.order', 'order')
      .leftJoinAndSelect('order.shop', 'shop')
      .leftJoinAndSelect('order.route', 'orderRoute')
      .leftJoinAndSelect('batch.items', 'items')
      .orderBy('batch.dispatchDate', 'DESC')
      .addOrderBy('batch.createdAt', 'DESC');

    if (user && user.role === Role.SR) {
      const userId = user.id || user.sub;
      if (userId) {
        qb.andWhere('order.createdById = :userId', { userId });
      }
    }

    if (user && user.role === Role.DELIVERY_MAN) {
      const userId = user.id || user.sub;
      if (userId) {
        qb.andWhere('batch.assignedDeliveryManId = :userId', { userId });
      } else {
        // If role is DELIVERY_MAN but no ID, return empty to be safe
        qb.andWhere('batch.id = -1');
      }
    }

    if (query.companyId) qb.andWhere('batch.companyId = :companyId', { companyId: query.companyId });
    if (query.routeId) qb.andWhere('batch.routeId = :routeId', { routeId: query.routeId });
    if (query.search) {
      qb.andWhere(
        '(batch.batchNo ILIKE :search OR CAST(order.id AS TEXT) ILIKE :search OR shop.name ILIKE :search OR shop.ownerName ILIKE :search OR shop.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.status) {
      if (query.status === 'ASSIGNED') {
        qb.andWhere('batch.status IN (:...assignedStatuses)', {
          assignedStatuses: this.editableBatchStatuses,
        });
      } else if (query.status === 'DELIVERED' || query.status === 'COMPLETED') {
        qb.andWhere('(batch.status IN (:...settledStatuses) OR batchOrders.deliveryStatus = :completed)', {
          settledStatuses: [DispatchBatchStatus.SETTLED, DispatchBatchStatus.PARTIALLY_SETTLED],
          completed: 'COMPLETED',
        });
      } else if (Object.values(DispatchBatchStatus).includes(query.status as any)) {
        qb.andWhere('batch.status = :status', { status: query.status });
      } else {
        // If unknown status, don't filter or return empty?
        // Returning empty is safer to avoid showing everything.
        qb.andWhere('batch.id = -1');
      }
    }

    return qb.getMany();
  }

  async createDispatchBatch(dto: CreateDispatchBatchDto) {
    if (!dto.assignedDeliveryManId) {
      throw new BadRequestException('Delivery man is required before creating a dispatch batch');
    }

    const deliveryMan = await this.userRepository.findOne({
      where: {
        id: dto.assignedDeliveryManId,
        role: Role.DELIVERY_MAN,
        status: UserStatus.ACTIVE,
      },
    });

    if (!deliveryMan) {
      throw new BadRequestException('Selected delivery man must be an active DELIVERY_MAN user');
    }

    const savedBatchId = await this.dataSource.transaction(async (manager) => {
      const orders = await manager.find(Order, {
        where: { id: In(dto.orderIds) },
        relations: ['items', 'items.product'],
      });

      if (orders.length !== dto.orderIds.length) {
        throw new BadRequestException('One or more selected orders were not found');
      }

      const activeOrderIds = await this.getActiveBatchOrderIds();
      const alreadyBatched = dto.orderIds.find((id) => activeOrderIds.has(id));
      if (alreadyBatched) {
        throw new BadRequestException(`Order #${alreadyBatched} is already in an active dispatch batch`);
      }

      const batch = manager.create(DispatchBatch, {
        batchNo: this.generateBatchNo(manager, dto.dispatchDate),
        dispatchDate: new Date(dto.dispatchDate),
        companyId: dto.companyId,
        routeId: dto.routeId,
        deliveryPersonId: dto.deliveryPersonId,
        assignedDeliveryManId: dto.assignedDeliveryManId,
        marketArea: dto.marketArea,
        note: dto.note,
        status: DispatchBatchStatus.DRAFT,
        totalOrders: orders.length,
        grossDispatchedValue: orders.reduce((sum, o) => sum + Number(o.grandTotal), 0),
        totalAdvancePaid: orders.reduce((sum, o) => sum + Number(o.advancePaid || 0), 0),
      });

      const savedBatch = await manager.save(batch);

      const batchOrders = orders.map(o => manager.create(DispatchBatchOrder, {
        batchId: savedBatch.id,
        orderId: o.id,
        estimatedAmount: o.grandTotal,
        finalSoldAmount: o.grandTotal,
        dueAmount: Math.max(0, Number(o.grandTotal) - Number(o.advancePaid || 0)),
      }));
      await manager.save(batchOrders);

      // Aggregate items for the batch load sheet
      const aggregate = new Map<number, { qty: number; amount: number }>();
      for (const order of orders) {
        for (const item of order.items) {
          const qty = Number(item.quantity) + Number(item.freeQuantity || 0);
          const existing = aggregate.get(item.productId) ?? { qty: 0, amount: 0 };
          aggregate.set(item.productId, { qty: existing.qty + qty, amount: existing.amount + Number(item.lineTotal) });
        }
      }

      const batchItems = Array.from(aggregate.entries()).map(([productId, val]) => manager.create(DispatchBatchItem, {
        batchId: savedBatch.id,
        productId,
        totalDispatchedQty: val.qty,
        totalDeliveredQty: val.qty,
        estimatedAmount: val.amount,
        finalSoldAmount: val.amount,
      }));
      await manager.save(batchItems);

      // Update Order Status
      await manager.update(Order, { id: In(dto.orderIds) }, {
        status: OrderStatus.ASSIGNED,
        deliveryPersonId: dto.deliveryPersonId,
        assignedDeliveryManId: dto.assignedDeliveryManId,
      });

      return savedBatch.id;
    });

    const result = await this.getDispatchBatch(savedBatchId);
    this.realtimeGateway.emitPayload('batchCreated', result);
    return result;
  }

  async getDispatchBatch(id: number, user?: any) {
    const batch = await this.batchRepository.findOne({
      where: { id },
      relations: [
        'company', 'route', 'deliveryPerson', 'assignedDeliveryMan', 'items', 'items.product',
      ],
    });
    if (!batch) throw new NotFoundException('Batch not found');
    this.ensureDeliveryManOwnsBatch(batch, user);

    // Split query: fetch batch orders with nested relations separately to avoid massive cartesian join
    const batchOrders = await this.batchOrderRepository.find({
      where: { batchId: id },
      relations: [
        'returns', 'returns.items', 'collections',
        'order', 'order.company', 'order.route', 'order.shop',
        'order.assignedDeliveryMan', 'order.items', 'order.items.product'
      ],
    });
    batch.orders = batchOrders;

    return { ...batch, metrics: this.calculateBatchSettlement(batch) };
  }

  private formatBatchForReport(batch: any) {
    const itemWiseTotals = (batch.items || []).map((bi: any) => ({
      productName: bi.product?.name || 'Unknown',
      quantity: bi.totalDispatchedQty,
      estimatedAmount: bi.estimatedAmount,
    }));

    const selectedOrders = (batch.orders || []).map((bo: any) => ({
      orderId: bo.orderId,
      shopName: bo.order?.shop?.name || 'Unknown',
      shopOwnerName: bo.order?.shop?.ownerName || '',
      shopPhone: bo.order?.shop?.phone || '',
      shopAddress: bo.order?.shop?.address || '',
      estimatedAmount: bo.estimatedAmount,
      items: (bo.order?.items || []).map((oi: any) => ({
        productName: oi.product?.name || 'Unknown',
        dispatchedQuantity: Number(oi.quantity) + Number(oi.freeQuantity || 0),
        orderedQuantity: Number(oi.quantity || 0),
        freeQuantity: Number(oi.freeQuantity || 0),
      })),
    }));

    const productSummary = (batch.items || []).map((bi: any) => {
      const paidDelivered = (batch.orders || []).reduce((sum: number, bo: any) => {
        const orderItem = (bo.order?.items || []).find((oi: any) => oi.productId === bi.productId);
        return sum + Number(orderItem?.deliveredPaidQuantity || 0);
      }, 0);
      const freeDelivered = Math.max(0, Number(bi.totalDeliveredQty || 0) - paidDelivered);

      return {
        productName: bi.product?.name || 'Unknown',
        dispatched: bi.totalDispatchedQty,       // paid + free dispatched (physical)
        returned: bi.totalReturnedQty || 0,       // paid + free returned (physical)
        damaged: bi.totalDamagedQty || 0,
        delivered: bi.totalDeliveredQty,          // paid + free delivered (physical)
        deliveredPaid: paidDelivered,             // paid-only delivered → used for Sold Qty
        freeDelivered,                            // free-only delivered (for reference)
        finalSoldAmount: bi.finalSoldAmount,      // revenue (excludes free items)
      };
    });

    const summary = {
      totalDispatchedQty: (batch.items || []).reduce((sum: number, bi: any) => sum + Number(bi.totalDispatchedQty), 0),
      grossDispatchedValue: batch.grossDispatchedValue,
      returnAdjustedValue: batch.returnAdjustedValue || (batch.items || []).reduce((sum: number, bi: any) => sum + Number(bi.finalSoldAmount), 0),
      finalSoldValue: batch.finalSoldValue || (batch.items || []).reduce((sum: number, bi: any) => sum + Number(bi.finalSoldAmount), 0),
      totalCollectedAmount: batch.totalCollectedAmount,
      totalDueAmount: batch.totalDueAmount,
      totalReturnAmount: Number(batch.grossDispatchedValue || 0) - Number(batch.finalSoldValue || 0),
      totalCashExpected: (batch.orders || []).reduce((sum: number, bo: any) => {
        return sum + Math.max(0, Number(bo.finalSoldAmount || 0) - Number(bo.order?.advancePaid || 0));
      }, 0),
    };

    const orders = (batch.orders || []).map((bo: any) => ({
      orderId: bo.orderId,
      shopName: bo.order?.shop?.name || 'Unknown',
      shopOwnerName: bo.order?.shop?.ownerName || '',
      shopPhone: bo.order?.shop?.phone || '',
      shopAddress: bo.order?.shop?.address || '',
      deliveryStatus: bo.deliveryStatus,
      calculations: {
        finalSoldAmount: bo.finalSoldAmount,
      },
      advancePaid: bo.order?.advancePaid || 0,
      collectedAmount: bo.collectedAmount,
      dueAmount: bo.dueAmount,
      cashExpected: Math.max(0, Number(bo.finalSoldAmount || 0) - Number(bo.order?.advancePaid || 0)),
      note: bo.deliveryNote || bo.order?.deliveryNote || '',
      items: (bo.order?.items || []).map((oi: any) => ({
        productName: oi.product?.name || 'Unknown',
        dispatchedQuantity: Number(oi.quantity || 0) + Number(oi.freeQuantity || 0),
        deliveredQuantity: Number(oi.deliveredQuantity || 0),
        returnedQuantity: Number(oi.returnedQuantity || 0),
        damagedQuantity: Number(oi.damagedQuantity || 0),
      })),
    }));

    return {
      ...batch,
      itemWiseTotals,
      selectedOrders,
      estimatedTotalAmount: (batch.items || []).reduce((sum: number, bi: any) => sum + Number(bi.estimatedAmount), 0),
      productSummary,
      summary,
      orders,
    };
  }

  async dispatchBatch(id: number) {
    const batch = await this.getDispatchBatch(id);
    if (![DispatchBatchStatus.DRAFT, DispatchBatchStatus.PRINTED].includes(batch.status)) {
      throw new BadRequestException('Invalid batch status for dispatch');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      // Stock is already deducted during Order Confirmation.
      // We just move statuses.
      await manager.update(DispatchBatch, id, { status: DispatchBatchStatus.DISPATCHED, dispatchedAt: new Date() });
      await manager.update(Order, { id: In(batch.orders.map((o: any) => o.orderId)) }, {
        status: OrderStatus.OUT_FOR_DELIVERY,
        dispatchedAt: new Date(),
        isLocked: true,
      });
      return this.getDispatchBatch(id);
    });

    this.realtimeGateway.emitPayload('batchUpdated', result);
    return result;
  }

  async recordReturns(id: number, dto: RecordBatchReturnsDto) {
    const batch = await this.getDispatchBatch(id) as any;
    this.assertBatchEditableByDelivery(batch);

    return this.dataSource.transaction(async (manager) => {
      for (const orderDto of dto.orders || []) {
        const batchOrder = batch.orders.find((bo: DispatchBatchOrder) => bo.orderId === orderDto.orderId);
        if (!batchOrder) {
          throw new BadRequestException(`Order #${orderDto.orderId} is not part of this batch`);
        }

        const order = batchOrder.order;
        let finalSoldAmount = 0;

        for (const itemDto of orderDto.items || []) {
          const orderItem = order.items.find((item: OrderItem) => item.productId === itemDto.productId);
          if (!orderItem) continue;

          const orderedPaidQty = Number(orderItem.quantity || 0);
          const orderedFreeQty = Number(orderItem.freeQuantity || 0);

          const returnedPaidQty = Number(itemDto.returnedPaidQuantity || 0);
          const returnedFreeQty = Number(itemDto.returnedFreeQuantity || 0);
          const damagedPaidQty = Number(itemDto.damagedPaidQuantity || 0);
          const damagedFreeQty = Number(itemDto.damagedFreeQuantity || 0);

          const finalPaidDelivered = Math.max(0, orderedPaidQty - returnedPaidQty - damagedPaidQty);
          const finalDeliveredFree = Math.max(0, orderedFreeQty - returnedFreeQty - damagedFreeQty);

          finalSoldAmount += this.calculateItemSoldAmount(orderItem, finalPaidDelivered);

          await manager.update(OrderItem, orderItem.id, {
            deliveredPaidQuantity: finalPaidDelivered,
            deliveredFreeQuantity: finalDeliveredFree,
            returnedPaidQuantity: returnedPaidQty,
            returnedFreeQuantity: returnedFreeQty,
            damagedPaidQuantity: damagedPaidQty,
            damagedFreeQuantity: damagedFreeQty,
          });
        }

        finalSoldAmount = this.applyOrderDiscount(order, finalSoldAmount);
        const advancePaid = Number(order.advancePaid || 0);
        const existingCollectedAmount = Number(batchOrder.collectedAmount || 0);
        const newDueAmount = Math.max(0, finalSoldAmount - advancePaid - existingCollectedAmount);

        await manager.update(DispatchBatchOrder, batchOrder.id, {
          finalSoldAmount,
          dueAmount: newDueAmount,
          deliveryStatus: batchOrder.deliveryStatus,
          deliveryNote: orderDto.note || dto.note,
        });

        await manager.update(Order, order.id, {
          actualSoldAmount: finalSoldAmount,
          dueAmount: newDueAmount,
          deliveryNote: orderDto.note || dto.note,
          status: OrderStatus.PARTIALLY_DELIVERED,
        });
      }

      await manager.update(DispatchBatch, id, {
        status: DispatchBatchStatus.RETURN_PENDING,
        returnsRecordedAt: new Date(),
        note: dto.note || batch.note,
      });

      await this.recalculateBatchTotals(manager, id);
    });

    const result = await this.getDispatchBatch(id);
    this.realtimeGateway.emitPayload('batchUpdated', result);
    return result;
  }

  async createShopForOrder(orderId: number, dto: CreateShopForOrderDto, user?: any) {
    const batchOrder = await this.batchOrderRepository.findOne({
      where: { orderId },
      relations: ['batch', 'order'],
    });

    if (!batchOrder) {
      throw new NotFoundException('Assigned delivery order not found');
    }

    this.ensureDeliveryManOwnsBatch(batchOrder.batch, user);
    this.assertBatchEditableByDelivery(batchOrder.batch);

    if (batchOrder.order.shopId) {
      throw new BadRequestException('This order already has a shop linked');
    }

    return this.dataSource.transaction(async (manager) => {
      const shop = new Shop();
      shop.name = dto.name;
      shop.ownerName = dto.ownerName || null;
      shop.phone = dto.phone || null;
      shop.address = dto.address || null;
      shop.companyId = batchOrder.order.companyId;
      shop.routeId = batchOrder.order.routeId;
      shop.isActive = true;
      shop.createdById = this.getUserId(user) ?? null;

      const savedShop = await manager.save(shop);

      await manager.update(Order, orderId, {
        shopId: savedShop.id,
      });

      return manager.findOne(Order, {
        where: { id: orderId },
        relations: ['shop'],
      });
    });
  }

  async submitDeliveryResult(orderId: number, dto: DeliveryResultDto, user?: any) {
    const batchOrder = await this.batchOrderRepository.findOne({
      where: { orderId },
      relations: [
        'batch', 'batch.assignedDeliveryMan', 'batch.route',
        'order', 'order.items', 'order.items.product', 'order.shop', 'order.route',
      ],
    });

    if (!batchOrder) {
      throw new NotFoundException('Assigned delivery order not found');
    }

    this.ensureDeliveryManOwnsBatch(batchOrder.batch, user);
    this.assertBatchEditableByDelivery(batchOrder.batch);

    const updatedOrder = await this.dataSource.transaction(async (manager) => {
      const order = batchOrder.order;
      let finalSoldAmount = 0;
      let totalReturned = 0;
      let totalDamaged = 0;

      for (const itemDto of dto.items) {
        const orderItem = order.items.find((item) => item.productId === itemDto.productId);
        if (!orderItem) {
          throw new BadRequestException(`Product ${itemDto.productId} is not part of order #${orderId}`);
        }

        const orderedPaidQty = Number(orderItem.quantity || 0);
        const orderedFreeQty = Number(orderItem.freeQuantity || 0);

        const returnedPaidQty = Number(itemDto.returnedPaidQty || 0);
        const returnedFreeQty = Number(itemDto.returnedFreeQty || 0);
        const damagedPaidQty = Number(itemDto.damagedPaidQty || 0);
        const damagedFreeQty = Number(itemDto.damagedFreeQty || 0);

        const finalPaidDelivered = Math.max(0, orderedPaidQty - returnedPaidQty - damagedPaidQty);
        const finalDeliveredFree = Math.max(0, orderedFreeQty - returnedFreeQty - damagedFreeQty);

        finalSoldAmount += this.calculateItemSoldAmount(orderItem, finalPaidDelivered);
        totalReturned += (returnedPaidQty + returnedFreeQty);
        totalDamaged += (damagedPaidQty + damagedFreeQty);

        await manager.update(OrderItem, orderItem.id, {
          deliveredPaidQuantity: finalPaidDelivered,
          deliveredFreeQuantity: finalDeliveredFree,
          returnedPaidQuantity: returnedPaidQty,
          returnedFreeQuantity: returnedFreeQty,
          damagedPaidQuantity: damagedPaidQty,
          damagedFreeQuantity: damagedFreeQty,
        });
      }

      finalSoldAmount = this.applyOrderDiscount(order, finalSoldAmount);
      const cashExpected = Math.max(0, Number((finalSoldAmount - Number(order.advancePaid || 0)).toFixed(2)));

      // Default to cashExpected if cashCollected is not provided (e.g. legacy or simplified submission)
      const cashCollected = dto.cashCollected !== undefined ? Number(dto.cashCollected) : cashExpected;
      const dueAmount = Math.max(0, Number((cashExpected - cashCollected).toFixed(2)));

      console.log(`[DeliveryResult] Order #${orderId}: expected=${cashExpected}, collected=${cashCollected}, due=${dueAmount}`);

      if (dueAmount > 0 && !order.shopId) {
        throw new BadRequestException('Shop is required when delivery has due/baki.');
      }

      if (cashCollected > cashExpected + 0.01) {
        throw new BadRequestException('Cash collected cannot exceed the final payable amount');
      }

      // Validating that the client's dueAmount matches our calculation if provided
      if (dto.dueAmount !== undefined && Math.abs(Number(dto.dueAmount || 0) - dueAmount) > 0.01) {
        throw new BadRequestException(`Due amount mismatch. Expected ${dueAmount}, but received ${dto.dueAmount}`);
      }

      await manager.delete(CashCollection, { batchOrderId: batchOrder.id });
      if (cashCollected > 0) {
        await manager.save(CashCollection, manager.create(CashCollection, {
          batchId: batchOrder.batchId,
          batchOrderId: batchOrder.id,
          amount: cashCollected,
          paymentMode: 'CASH',
          note: dto.deliveryNote,
        }));
      }

      await manager.delete(DeliveryReturn, { batchOrderId: batchOrder.id });
      await manager.delete(DamageRecord, { batchId: batchOrder.batchId, orderId });

      const returnItems = dto.items.filter((item) =>
        Number(item.returnedPaidQty || 0) > 0 ||
        Number(item.returnedFreeQty || 0) > 0 ||
        Number(item.damagedPaidQty || 0) > 0 ||
        Number(item.damagedFreeQty || 0) > 0
      );
      if (returnItems.length > 0) {
        const deliveryReturn = await manager.save(DeliveryReturn, manager.create(DeliveryReturn, {
          batchId: batchOrder.batchId,
          batchOrderId: batchOrder.id,
          note: dto.deliveryNote,
          returnReason: returnItems.map((item) => item.returnReason).filter(Boolean).join(', ') || undefined,
        }));

        await manager.save(returnItems.map((item) => {
          const orderItem = order.items.find((oi) => oi.productId === item.productId);
          return manager.create(DeliveryReturnItem, {
            deliveryReturnId: deliveryReturn.id,
            productId: item.productId,
            returnedPaidQuantity: Number(item.returnedPaidQty || 0),
            returnedFreeQuantity: Number(item.returnedFreeQty || 0),
            damagedPaidQuantity: Number(item.damagedPaidQty || 0),
            damagedFreeQuantity: Number(item.damagedFreeQty || 0),
            deliveredPaidQuantity: Number(orderItem?.deliveredPaidQuantity || 0),
            deliveredFreeQuantity: Number(orderItem?.deliveredFreeQuantity || 0),
            reason: item.returnReason,
            note: dto.deliveryNote,
          });
        }));

        const damageRows = returnItems
          .filter((item) => Number(item.damagedPaidQty || 0) > 0 || Number(item.damagedFreeQty || 0) > 0)
          .map((item) => manager.create(DamageRecord, {
            batchId: batchOrder.batchId,
            orderId,
            productId: item.productId,
            quantity: Number(item.damagedPaidQty || 0) + Number(item.damagedFreeQty || 0),
            reason: item.damageReason,
            note: dto.deliveryNote,
          }));
        if (damageRows.length > 0) {
          await manager.save(damageRows);
        }
      }

      const completed = dto.status === DeliveryResultStatus.COMPLETED;
      const nextOrderStatus = completed
        ? OrderStatus.DELIVERY_COMPLETED
        : OrderStatus.OUT_FOR_DELIVERY;

      await manager.update(DispatchBatchOrder, batchOrder.id, {
        finalSoldAmount,
        collectedAmount: cashCollected,
        dueAmount,
        deliveryStatus: completed ? 'COMPLETED' : 'DRAFT',
        deliveryNote: dto.deliveryNote,
        deliveryCompletedAt: completed ? new Date() : undefined,
      });

      await manager.update(Order, orderId, {
        actualSoldAmount: finalSoldAmount,
        collectedAmount: cashCollected,
        dueAmount,
        deliveryNote: dto.deliveryNote,
        deliveredAt: completed ? new Date() : order.deliveredAt,
        status: nextOrderStatus,
        isLocked: true,
      });

      await this.recalculateBatchTotals(manager, batchOrder.batchId);

      return manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items', 'items.product', 'company', 'route', 'shop', 'deliveryPerson', 'assignedDeliveryMan'],
      });
    });

    if (updatedOrder) {
      this.realtimeGateway.emitPayload('orderUpdated', updatedOrder);
      try {
        const updatedBatch = await this.getDispatchBatch(batchOrder.batchId);
        this.realtimeGateway.emitPayload('batchUpdated', updatedBatch);
      } catch (e) {
        console.error('Failed to emit batchUpdated for batchId', batchOrder.batchId, e);
      }
    }

    return updatedOrder;
  }

  private calculateItemSoldAmount(item: OrderItem, deliveredPaid: number): number {
    const paidQty = Number(item.quantity || 0);
    if (paidQty <= 0) return 0;
    const unitPriceAfterItemDiscount = Number(item.lineTotal || 0) / paidQty;
    return Number(deliveredPaid) * unitPriceAfterItemDiscount;
  }

  private applyOrderDiscount(order: Order, itemSoldAmount: number) {
    const subtotal = Number(order.subtotal || 0);
    const invoiceDiscountApplied = subtotal > 0
      ? Number(order.discountAmount || 0) * (itemSoldAmount / subtotal)
      : 0;

    return Math.max(0, Number((itemSoldAmount - invoiceDiscountApplied).toFixed(2)));
  }

  private async recalculateBatchTotals(manager: any, batchId: number) {
    const batch = await manager.findOne(DispatchBatch, {
      where: { id: batchId },
      relations: ['orders', 'orders.order', 'orders.order.items', 'items'],
    });
    if (!batch) return;

    const productTotals = new Map<number, {
      returned: number;
      returnedPaid: number;
      returnedFree: number;
      damaged: number;
      damagedPaid: number;
      damagedFree: number;
      delivered: number;
      deliveredPaid: number;
      deliveredFree: number;
      finalSoldAmount: number;
    }>();

    let finalSoldValue = 0;
    let totalCollectedAmount = 0;
    let totalDueAmount = 0;

    for (const batchOrder of batch.orders) {
      finalSoldValue += Number(batchOrder.finalSoldAmount || 0);
      totalCollectedAmount += Number(batchOrder.collectedAmount || 0);
      totalDueAmount += Number(batchOrder.dueAmount || 0);

      for (const orderItem of batchOrder.order?.items || []) {
        const existing = productTotals.get(orderItem.productId) || {
          returned: 0,
          returnedPaid: 0,
          returnedFree: 0,
          damaged: 0,
          damagedPaid: 0,
          damagedFree: 0,
          delivered: 0,
          deliveredPaid: 0,
          deliveredFree: 0,
          finalSoldAmount: 0,
        };
        const deliveredPaid = Number(orderItem.deliveredPaidQuantity || 0);
        const deliveredFree = Number(orderItem.deliveredFreeQuantity || 0);
        const returnedPaid = Number(orderItem.returnedPaidQuantity || 0);
        const returnedFree = Number(orderItem.returnedFreeQuantity || 0);
        const damagedPaid = Number(orderItem.damagedPaidQuantity || 0);
        const damagedFree = Number(orderItem.damagedFreeQuantity || 0);

        existing.returned += (returnedPaid + returnedFree);
        existing.returnedPaid += returnedPaid;
        existing.returnedFree += returnedFree;
        existing.damaged += (damagedPaid + damagedFree);
        existing.damagedPaid += damagedPaid;
        existing.damagedFree += damagedFree;
        existing.delivered += (deliveredPaid + deliveredFree);
        existing.deliveredPaid += deliveredPaid;
        existing.deliveredFree += deliveredFree;
        existing.finalSoldAmount += this.calculateItemSoldAmount(orderItem, deliveredPaid);
        productTotals.set(orderItem.productId, existing);
      }
    }

    for (const item of batch.items || []) {
      const totals = productTotals.get(item.productId) || {
        returned: 0,
        returnedPaid: 0,
        returnedFree: 0,
        damaged: 0,
        damagedPaid: 0,
        damagedFree: 0,
        delivered: Number(item.totalDispatchedQty || 0),
        deliveredPaid: 0,
        deliveredFree: 0,
        finalSoldAmount: Number(item.estimatedAmount || 0),
      };
      await manager.update(DispatchBatchItem, item.id, {
        totalReturnedQty: totals.returned,
        returnedPaidQty: totals.returnedPaid,
        returnedFreeQty: totals.returnedFree,
        totalDamagedQty: totals.damaged,
        damagedPaidQty: totals.damagedPaid,
        damagedFreeQty: totals.damagedFree,
        totalDeliveredQty: totals.delivered,
        deliveredPaidQty: totals.deliveredPaid,
        deliveredFreeQty: totals.deliveredFree,
        finalSoldAmount: totals.finalSoldAmount,
      });
    }

    await manager.update(DispatchBatch, batchId, {
      returnAdjustedValue: finalSoldValue,
      finalSoldValue,
      totalCollectedAmount,
      totalDueAmount,
      shortageOrExcess: totalCollectedAmount - finalSoldValue,
    });
  }

  async settleBatch(id: number, dto: SettleDispatchBatchDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Lock the main batch record first using QueryBuilder to ensure NO joins are generated
      const lockBatch = await manager.createQueryBuilder(DispatchBatch, 'batch')
        .setLock('pessimistic_write')
        .where('batch.id = :id', { id })
        .getOne();

      if (!lockBatch) throw new NotFoundException('Batch not found');

      // 2. Now fetch with relations (safe since row is already locked in this transaction)
      const currentBatch = await manager.findOne(DispatchBatch, {
        where: { id },
        relations: ['orders', 'orders.order', 'orders.order.items', 'orders.order.items.product']
      });

      if (!currentBatch) throw new NotFoundException('Batch not found');
      if (currentBatch.status === DispatchBatchStatus.SETTLED) throw new BadRequestException('Batch is already settled');
      if (currentBatch.status === DispatchBatchStatus.CANCELLED) throw new BadRequestException('Cannot settle a cancelled batch');

      // 2. Fail-fast if ANY order is already settled or lacks a shop
      for (const bo of currentBatch.orders) {
        if (bo.isSettled || [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE].includes(bo.order?.status)) {
          throw new BadRequestException(`Order #${bo.orderId} is already settled. Batch settlement rejected.`);
        }
        const requestedDue = dto.dueEntries?.find(d => Number(d.orderId) === Number(bo.orderId))?.amount || 0;
        if (!bo.order?.shopId && Number(requestedDue) > 0) {
          throw new BadRequestException(`Order #${bo.orderId} is a direct order (no shop) and cannot have a due. Settlement rejected.`);
        }
      }

      let totalReportedCollected = 0;
      let totalExpectedCash = 0;
      let totalFinalValue = 0;
      let totalDueAmount = 0;

      // Build a lookup map from dto.collections (what the frontend calculated per order)
      const collectionMap = new Map<number, number>();
      if (dto.collections && dto.collections.length > 0) {
        for (const col of dto.collections) {
          collectionMap.set(Number(col.orderId), Number(col.collectedAmount || 0));
        }
      }

      // 3. Process each order with mathematical precision
      for (const batchOrder of currentBatch.orders) {
        const order = batchOrder.order;
        if (!order) continue;

        const settlementItems = order.items.map(item => ({
          productId: item.productId,
          returnedPaidQuantity: Number(item.returnedPaidQuantity || 0),
          returnedFreeQuantity: Number(item.returnedFreeQuantity || 0),
          damagedPaidQuantity: Number(item.damagedPaidQuantity || 0),
          damagedFreeQuantity: Number(item.damagedFreeQuantity || 0),
        }));

        // Use collectedAmount from dto.collections if provided by frontend;
        // fall back to batchOrder.collectedAmount (set during per-order delivery result submission)
        const collectedFromDto = collectionMap.get(Number(batchOrder.orderId));
        const collectedAmount = Number(collectedFromDto !== undefined
          ? collectedFromDto
          : Number(batchOrder.collectedAmount || 0));

        const requestedDue = dto.dueEntries?.find(d => Number(d.orderId) === Number(batchOrder.orderId))?.amount || 0;

        // Settle individual order (Calculates finalSoldAmount and returns stock)
        const settledOrder = await this.ordersService.settleOrder(order.id, {
          items: settlementItems,
          collectedAmount: Number(collectedAmount),
          dueAmount: Number(requestedDue),
          settlementNote: dto.note || batchOrder.deliveryNote,
        } as any, manager);

        await manager.update(DispatchBatchOrder, batchOrder.id, {
          isSettled: true,
          deliveryStatus: 'COMPLETED',
          collectedAmount: Number(collectedAmount),
          dueAmount: Number(settledOrder.dueAmount || 0),
          finalSoldAmount: Number(settledOrder.actualSoldAmount || 0),
        });

        totalReportedCollected += Number(collectedAmount);
        totalFinalValue += Number(settledOrder.actualSoldAmount || 0);
        totalDueAmount += Number(settledOrder.dueAmount || 0);
        totalExpectedCash += Math.max(0, Number(settledOrder.actualSoldAmount || 0) - Number(settledOrder.advancePaid || 0));
      }

      // 4. Triple-Check Reconciliation with Explicit Numeric Casting
      const totalAmount = Number(totalFinalValue || 0);
      const actualCashReceived = Number(dto.actualCashReceived ?? totalReportedCollected);
      
      const finalDueBaki = Number((totalAmount - actualCashReceived).toFixed(2));
      const finalCashCollectable = Number(actualCashReceived);

      console.log('=== PERSISTING SETTLEMENT VALUES ===');
      console.log('totalAmountSold (Total Amount Sold):', totalAmount);
      console.log('actualCashReceived (Actual Cash Received):', actualCashReceived);
      console.log('cashCollectable:', finalCashCollectable);
      console.log('dueBaki:', finalDueBaki);

      const cashDiscrepancy = Number(actualCashReceived - totalReportedCollected);

      // 5. Update Batch with Audit Metadata
      await manager.update(DispatchBatch, id, {
        status: DispatchBatchStatus.SETTLED,
        settledAt: new Date(),
        totalCollectedAmount: finalCashCollectable,
        finalSoldValue: totalAmount,
        totalDueAmount: finalDueBaki,
        shortageOrExcess: cashDiscrepancy,
        settlementNote: `${dto.note || ''} [Triple-Check: ExpectedCash=${totalExpectedCash}, Reported=${totalReportedCollected}, Actual=${actualCashReceived}]`.trim()
      });

      return this.getDispatchBatch(id);
    });

    this.realtimeGateway.emitPayload('batchUpdated', result);
    if (result && result.orders) {
      for (const bo of result.orders) {
        if (bo.order) {
          this.realtimeGateway.emitPayload('orderUpdated', bo.order);
        }
      }
    }
    return result;
  }



  async getDashboard(date?: string, user?: any) {
    const where: any = {};
    if (user && user.role === Role.DELIVERY_MAN) {
      const userId = user.id || user.sub;
      if (userId) {
        where.assignedDeliveryManId = userId;
      } else {
        where.assignedDeliveryManId = '00000000-0000-0000-0000-000000000000';
      }
    }

    return {
      totalBatches: await this.batchRepository.count({ where }),
      pendingBatches: await this.batchRepository.count({
        where: { ...where, status: In([DispatchBatchStatus.DRAFT, DispatchBatchStatus.PRINTED]) }
      }),
    };
  }

  async getReports(query: QueryDispatchBatchesDto, user?: any) {
    const batches = await this.getDispatchBatches(query, user);

    const rows = batches.map(batch => ({
      id: batch.id,
      batchNo: batch.batchNo,
      dispatchDate: batch.dispatchDate,
      deliveryPerson: batch.assignedDeliveryMan?.name || batch.deliveryPerson?.name || 'Unassigned',
      grossDispatchedValue: Number(batch.grossDispatchedValue || 0),
      finalSoldValue: Number(batch.finalSoldValue || 0),
      totalCollectedAmount: Number(batch.totalCollectedAmount || 0),
      totalDueAmount: Number(batch.totalDueAmount || 0),
      status: batch.status,
    }));

    const totals = rows.reduce((acc, row) => ({
      grossDispatchedValue: acc.grossDispatchedValue + row.grossDispatchedValue,
      finalSoldValue: acc.finalSoldValue + row.finalSoldValue,
      totalCollectedAmount: acc.totalCollectedAmount + row.totalCollectedAmount,
      totalDueAmount: acc.totalDueAmount + row.totalDueAmount,
    }), {
      grossDispatchedValue: 0,
      finalSoldValue: 0,
      totalCollectedAmount: 0,
      totalDueAmount: 0,
    });

    return { rows, totals };
  }

  async getMorningReport(id: number, user?: any) {
    const batch = await this.getDispatchBatch(id, user) as any;
    return this.formatBatchForReport(batch);
  }

  async getFinalReport(id: number, user?: any) {
    const batch = await this.getDispatchBatch(id, user) as any;
    return this.formatBatchForReport(batch);
  }

  async markMorningPrinted(id: number) {
    await this.batchRepository.update(id, {
      status: DispatchBatchStatus.PRINTED,
      isMorningPrinted: true,
      morningPrintedAt: new Date(),
    });
    return this.getDispatchBatch(id);
  }

  async deleteDispatchBatch(id: number) {
    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Lock the batch to prevent concurrent modifications
      const batch = await manager.createQueryBuilder(DispatchBatch, 'batch')
        .setLock('pessimistic_write')
        .where('batch.id = :id', { id })
        .getOne();

      if (!batch) {
        throw new NotFoundException(`Dispatch batch #${id} not found`);
      }

      // Fetch with relations
      const fullBatch = await manager.findOne(DispatchBatch, {
        where: { id },
        relations: ['orders', 'orders.order', 'orders.order.items', 'items'],
      });

      if (!fullBatch) {
        throw new NotFoundException(`Dispatch batch #${id} not found`);
      }

      const isSettled = [DispatchBatchStatus.SETTLED, DispatchBatchStatus.PARTIALLY_SETTLED].includes(batch.status);
      const orderIds = fullBatch.orders.map(bo => bo.orderId);

      // 2. Process each order in the batch
      for (const batchOrder of fullBatch.orders) {
        const order = batchOrder.order;
        if (!order) continue;

        for (const orderItem of order.items) {
          const dispatchedQty = Number(orderItem.quantity || 0) + Number(orderItem.freeQuantity || 0);
          const returnedQty = Number(orderItem.returnedPaidQuantity || 0) + Number(orderItem.returnedFreeQuantity || 0);

          // ── SINGLE RETURN_IN: avoid double-write TypeORM cache bug ──
          // For SETTLED batches: settleOrder() already did RETURN_IN for returnedQty.
          //   So only restore the undelivered portion: dispatchedQty - returnedQty.
          //   Net: current(S₀ - dispatched + returned) + (dispatched - returned) = S₀ ✓
          // For ACTIVE batches: no RETURN_IN has happened yet (settlement never ran).
          //   Restore the full dispatched qty.
          //   Net: current(S₀ - dispatched) + dispatched = S₀ ✓
          const qtyToRestore = isSettled
            ? Math.max(0, dispatchedQty - returnedQty)
            : Math.max(0, dispatchedQty);

          if (qtyToRestore > 0) {
            await this.stockService.create({
              productId: orderItem.productId,
              companyId: order.companyId,
              type: StockMovementType.RETURN_IN,
              quantity: qtyToRestore,
              reference: `Delete Batch #${id}`,
              note: `Restored ${qtyToRestore} units — batch #${id} (${isSettled ? 'settled' : 'active'}) deleted, order #${order.id} reverted`,
            }, 'System', manager);
          }

          if (isSettled) {
            await manager.query('DELETE FROM due_collections WHERE "orderId" = $1', [order.id]);
            await manager.query('DELETE FROM dues WHERE "orderId" = $1', [order.id]);
            await manager.query('DELETE FROM damage_records WHERE "orderId" = $1', [order.id]);
          }
        }

        // 3. Revert Order fields to CONFIRMED state
        await manager.update(Order, order.id, {
          status: OrderStatus.CONFIRMED,
          deliveryPersonId: null as any,
          assignedDeliveryManId: null as any,
          dispatchedAt: null as any,
          deliveredAt: null as any,
          settledAt: null as any,
          actualSoldAmount: order.grandTotal,
          collectedAmount: 0,
          dueAmount: Math.max(0, Number(order.grandTotal) - Number(order.advancePaid || 0)),
          deliveryNote: null as any,
          settlementNote: null as any,
          isLocked: false,
        });

        // 4. Revert OrderItem fields
        for (const orderItem of order.items) {
          await manager.update(OrderItem, orderItem.id, {
            deliveredPaidQuantity: 0,
            deliveredFreeQuantity: 0,
            returnedPaidQuantity: 0,
            returnedFreeQuantity: 0,
            damagedPaidQuantity: 0,
            damagedFreeQuantity: 0,
          });
        }
      }

      // 5. Delete the batch
      await manager.remove(DispatchBatch, fullBatch);

      return {
        success: true,
        message: `Batch #${id} deleted and related orders reverted to CONFIRMED.`,
        orderIds,
      };
    });

    this.realtimeGateway.emitPayload('batchDeleted', { id });
    if (result && result.orderIds) {
      for (const orderId of result.orderIds) {
        try {
          const updatedOrder = await this.orderRepository.findOne({
            where: { id: orderId },
            relations: ['items', 'items.product', 'company', 'route', 'shop', 'deliveryPerson', 'assignedDeliveryMan'],
          });
          if (updatedOrder) {
            this.realtimeGateway.emitPayload('orderUpdated', updatedOrder);
          }
        } catch (e) {
          console.error(`Failed to fetch and emit orderUpdated for order #${orderId}`, e);
        }
      }
    }

    return { success: result.success, message: result.message };
  }

  private generateBatchNo(manager: any, date: string): string {
    const d = new Date(date);
    return `BCH-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`;
  }

  private calculateBatchSettlement(batch: DispatchBatch) {
    const orders = batch.orders || [];
    const items = batch.items || [];
    const totalReturnedQty = items.reduce((sum, item) => sum + Number(item.totalReturnedQty || 0), 0);
    const totalDamagedQty = items.reduce((sum, item) => sum + Number(item.totalDamagedQty || 0), 0);
    const totalDeliveredQty = items.reduce((sum, item) => sum + Number(item.totalDeliveredQty || 0), 0);
    const completedOrders = orders.filter((order) => order.deliveryStatus === 'COMPLETED' || order.isSettled).length;

    return {
      completedOrders,
      pendingOrders: Math.max(0, orders.length - completedOrders),
      totalReturnedQty,
      totalDamagedQty,
      totalDeliveredQty,
      totalCashExpected: orders.reduce((sum, batchOrder) => {
        return sum + Math.max(0, Number(batchOrder.finalSoldAmount || 0) - Number(batchOrder.order?.advancePaid || 0));
      }, 0),
      totalCashCollected: orders.reduce((sum, batchOrder) => sum + Number(batchOrder.collectedAmount || 0), 0),
      totalDueCreated: orders.reduce((sum, batchOrder) => sum + Number(batchOrder.dueAmount || 0), 0),
    };
  }
}
