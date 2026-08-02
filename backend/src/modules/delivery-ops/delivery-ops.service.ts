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
import { DispatchBatchExpense } from './entities/dispatch-batch-expense.entity';
import { CreateDeliveryPersonDto } from './dto/create-delivery-person.dto';
import { CreateDispatchBatchDto } from './dto/create-dispatch-batch.dto';
import { QueryDispatchBatchesDto } from './dto/query-dispatch-batches.dto';
import { RecordBatchReturnsDto } from './dto/record-batch-returns.dto';
import { SettleDispatchBatchDto } from './dto/settle-dispatch-batch.dto';
import {
  DeliveryResultDto,
  DeliveryResultStatus,
} from './dto/delivery-result.dto';
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
  return paid / common + free / common;
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
    @InjectRepository(DispatchBatchExpense)
    private readonly expenseRepository: Repository<DispatchBatchExpense>,
    private readonly stockService: StockService,
    private readonly duesService: DuesService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly dataSource: DataSource,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

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
      throw new ForbiddenException(
        'You do not have permission to access this delivery batch',
      );
    }
  }

  private assertBatchEditableByDelivery(batch: DispatchBatch) {
    if (
      [
        DispatchBatchStatus.SETTLED,
        DispatchBatchStatus.PARTIALLY_SETTLED,
      ].includes(batch.status)
    ) {
      throw new BadRequestException(
        'This batch is settled and delivery entries are locked',
      );
    }
    if (batch.status === DispatchBatchStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a cancelled batch');
    }
  }

  async getDeliveryPeople(includeInactive = false) {
    const deliveryUsers = await this.userRepository.find({
      where: { role: Role.DELIVERY_MAN },
      order: { name: 'ASC' },
    });

    const userPeople = deliveryUsers.map((user) => ({
      id: user.id,
      userId: user.id,
      name: user.name,
      phone: (user as any).phone || user.email || '',
      isActive: user.status === UserStatus.ACTIVE,
    }));

    const legacyPeople = await this.deliveryPersonRepository.find({
      order: { name: 'ASC' },
    });

    const combined: any[] = [...userPeople];
    for (const legacy of legacyPeople) {
      if (
        !combined.some(
          (p) =>
            String(p.id) === String(legacy.id) ||
            p.name.trim().toLowerCase() === legacy.name.trim().toLowerCase(),
        )
      ) {
        combined.push({
          id: legacy.id,
          userId: undefined,
          name: legacy.name,
          phone: legacy.phone || '',
          isActive: legacy.isActive,
        });
      }
    }

    return combined;
  }

  async getDeliveryPersonById(id: number) {
    const person = await this.deliveryPersonRepository.findOne({
      where: { id },
    });
    if (!person) throw new NotFoundException('Delivery person not found');
    return person;
  }

  async createDeliveryPerson(dto: CreateDeliveryPersonDto) {
    const person = this.deliveryPersonRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
    });
    return this.deliveryPersonRepository.save(person);
  }

  async updateDeliveryPerson(
    id: number,
    dto: Partial<CreateDeliveryPersonDto>,
  ) {
    const person = await this.getDeliveryPersonById(id);
    Object.assign(person, dto);
    return this.deliveryPersonRepository.save(person);
  }

  async deleteDeliveryPerson(id: number) {
    const person = await this.getDeliveryPersonById(id);
    const usedInOrders = await this.orderRepository.findOne({
      where: { deliveryPersonId: id },
    });
    const usedInBatches = await this.batchRepository.findOne({
      where: { deliveryPersonId: id },
    });
    if (usedInOrders || usedInBatches) {
      person.isActive = false;
      await this.deliveryPersonRepository.save(person);
      return { deleted: true, softDelete: true };
    }
    await this.deliveryPersonRepository.remove(person);
    return { deleted: true, softDelete: false };
  }

  async getEligibleOrders(query: QueryDispatchBatchesDto, user?: any) {
    const qb = this.orderRepository
      .createQueryBuilder('order')
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
      qb.andWhere('order.createdById = :userId', {
        userId: user.id || user.sub,
      });
    }

    if (user && user.role === Role.DELIVERY_MAN) {
      qb.andWhere('order.assignedDeliveryManId = :userId', {
        userId: user.id || user.sub,
      });
    }

    if (query.companyId) {
      qb.innerJoin('order.items', 'filterItems')
        .innerJoin('filterItems.product', 'filterProduct')
        .andWhere('filterProduct.companyId = :companyId', {
          companyId: query.companyId,
        });
    }
    if (query.routeId)
      qb.andWhere('order.routeId = :routeId', { routeId: query.routeId });
    if (query.deliveryPersonId) {
      const rawId = String(query.deliveryPersonId);
      const numId = Number(rawId);
      qb.andWhere(
        '(order.deliveryPersonId = :numId OR order.assignedDeliveryManId = :rawId)',
        {
          numId: isNaN(numId) ? -1 : numId,
          rawId,
        },
      );
    }
    if (query.dispatchDate)
      qb.andWhere('order.orderDate = :dispatchDate', {
        dispatchDate: query.dispatchDate,
      });
    const orders = await qb.orderBy('order.createdAt', 'ASC').getMany();
    const activeOrderIds = await this.getActiveBatchOrderIds();
    return orders.filter((order) => !activeOrderIds.has(order.id));
  }

  private async getActiveBatchOrderIds(): Promise<Set<number>> {
    const activeBatches = await this.batchRepository.find({
      where: {
        status: In([
          ...this.editableBatchStatuses,
          DispatchBatchStatus.PARTIALLY_SETTLED,
        ]),
      },
      relations: ['orders'],
    });
    const ids = new Set<number>();
    activeBatches.forEach((b) => b.orders.forEach((o) => ids.add(o.orderId)));
    return ids;
  }

  async getDispatchBatches(query: QueryDispatchBatchesDto, user?: any) {
    const isPaginated = query.page !== undefined || query.limit !== undefined;

    const qb = this.batchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.company', 'company')
      .leftJoinAndSelect('batch.route', 'route')
      .leftJoinAndSelect('batch.deliveryPerson', 'deliveryPerson')
      .leftJoinAndSelect('batch.assignedDeliveryMan', 'assignedDeliveryMan');

    if (isPaginated) {
      // For filtering/searching, we use leftJoin (no select) to avoid select bloat
      qb.leftJoin('batch.orders', 'batchOrders')
        .leftJoin('batchOrders.order', 'order')
        .leftJoin('order.shop', 'shop')
        .leftJoin('order.route', 'orderRoute');
    } else {
      // Maintain full backward compatibility
      qb.leftJoinAndSelect('batch.orders', 'batchOrders')
        .leftJoinAndSelect('batchOrders.order', 'order')
        .leftJoinAndSelect('order.shop', 'shop')
        .leftJoinAndSelect('order.route', 'orderRoute')
        .leftJoinAndSelect('batch.items', 'items');
    }

    qb.orderBy('batch.dispatchDate', 'DESC').addOrderBy(
      'batch.createdAt',
      'DESC',
    );

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

    if (query.companyId) {
      qb.leftJoin('batch.items', 'batchItemFilter')
        .leftJoin('batchItemFilter.product', 'batchProductFilter')
        .andWhere(
          '(batch.companyId = :companyId OR batchProductFilter.companyId = :companyId)',
          { companyId: query.companyId },
        );
    }
    if (query.routeId)
      qb.andWhere('batch.routeId = :routeId', { routeId: query.routeId });
    if (query.startDate && query.endDate) {
      qb.andWhere('batch.dispatchDate BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    } else if (query.dispatchDate) {
      qb.andWhere('batch.dispatchDate = :dispatchDate', {
        dispatchDate: query.dispatchDate,
      });
    }
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
        qb.andWhere(
          '(batch.status IN (:...settledStatuses) OR batchOrders.deliveryStatus = :completed)',
          {
            settledStatuses: [
              DispatchBatchStatus.SETTLED,
              DispatchBatchStatus.PARTIALLY_SETTLED,
            ],
            completed: 'COMPLETED',
          },
        );
      } else if (
        Object.values(DispatchBatchStatus).includes(query.status as any)
      ) {
        qb.andWhere('batch.status = :status', { status: query.status });
      } else {
        // If unknown status, don't filter or return empty?
        // Returning empty is safer to avoid showing everything.
        qb.andWhere('batch.id = -1');
      }
    }

    if (!isPaginated) {
      return qb.getMany();
    } else {
      const page = Number(query.page || 1);
      const limit = Number(query.limit || 10);
      const skip = (page - 1) * limit;

      qb.skip(skip).take(limit);

      const [items, total] = await qb.getManyAndCount();
      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }
  }

  async createDispatchBatch(dto: CreateDispatchBatchDto) {
    if (!dto.assignedDeliveryManId) {
      throw new BadRequestException(
        'Delivery man is required before creating a dispatch batch',
      );
    }

    const deliveryMan = await this.userRepository.findOne({
      where: {
        id: dto.assignedDeliveryManId,
        role: Role.DELIVERY_MAN,
        status: UserStatus.ACTIVE,
      },
    });

    if (!deliveryMan) {
      throw new BadRequestException(
        'Selected delivery man must be an active DELIVERY_MAN user',
      );
    }

    const savedBatchId = await this.dataSource.transaction(async (manager) => {
      const orders = await manager.find(Order, {
        where: { id: In(dto.orderIds) },
        relations: ['items', 'items.product'],
      });

      if (orders.length !== dto.orderIds.length) {
        throw new BadRequestException(
          'One or more selected orders were not found',
        );
      }

      const activeOrderIds = await this.getActiveBatchOrderIds();
      const alreadyBatched = dto.orderIds.find((id) => activeOrderIds.has(id));
      if (alreadyBatched) {
        throw new BadRequestException(
          `Order #${alreadyBatched} is already in an active dispatch batch`,
        );
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
        grossDispatchedValue: orders.reduce(
          (sum, o) => sum + Number(o.grandTotal),
          0,
        ),
        totalAdvancePaid: orders.reduce(
          (sum, o) => sum + Number(o.advancePaid || 0),
          0,
        ),
      });

      const savedBatch = await manager.save(batch);

      const batchOrders = orders.map((o) =>
        manager.create(DispatchBatchOrder, {
          batchId: savedBatch.id,
          orderId: o.id,
          estimatedAmount: o.grandTotal,
          finalSoldAmount: o.grandTotal,
          dueAmount: Math.max(
            0,
            Number(o.grandTotal) - Number(o.advancePaid || 0),
          ),
        }),
      );
      await manager.save(batchOrders);

      // Aggregate items for the batch load sheet
      const aggregate = new Map<number, { qty: number; amount: number }>();
      for (const order of orders) {
        for (const item of order.items) {
          const qty = Number(item.quantity) + Number(item.freeQuantity || 0);
          const existing = aggregate.get(item.productId) ?? {
            qty: 0,
            amount: 0,
          };
          aggregate.set(item.productId, {
            qty: existing.qty + qty,
            amount: existing.amount + Number(item.lineTotal),
          });
        }
      }

      const batchItems = Array.from(aggregate.entries()).map(
        ([productId, val]) =>
          manager.create(DispatchBatchItem, {
            batchId: savedBatch.id,
            productId,
            totalDispatchedQty: val.qty,
            totalDeliveredQty: val.qty,
            estimatedAmount: val.amount,
            finalSoldAmount: val.amount,
          }),
      );
      await manager.save(batchItems);

      // Update Order Status
      await manager.update(
        Order,
        { id: In(dto.orderIds) },
        {
          status: OrderStatus.ASSIGNED,
          deliveryPersonId: dto.deliveryPersonId,
          assignedDeliveryManId: dto.assignedDeliveryManId,
        },
      );

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
        'company',
        'route',
        'deliveryPerson',
        'assignedDeliveryMan',
        'items',
        'items.product',
        'expenses',
      ],
    });
    if (!batch) throw new NotFoundException('Batch not found');
    this.ensureDeliveryManOwnsBatch(batch, user);

    // Split query: fetch batch orders with nested relations separately to avoid massive cartesian join
    const batchOrders = await this.batchOrderRepository.find({
      where: { batchId: id },
      relations: [
        'returns',
        'returns.items',
        'collections',
        'order',
        'order.company',
        'order.route',
        'order.shop',
        'order.assignedDeliveryMan',
        'order.items',
        'order.items.product',
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
      const paidDelivered = (batch.orders || []).reduce(
        (sum: number, bo: any) => {
          const orderItem = (bo.order?.items || []).find(
            (oi: any) => oi.productId === bi.productId,
          );
          return sum + Number(orderItem?.deliveredPaidQuantity || 0);
        },
        0,
      );
      const freeDelivered = Math.max(
        0,
        Number(bi.totalDeliveredQty || 0) - paidDelivered,
      );

      return {
        productName: bi.product?.name || 'Unknown',
        dispatched: bi.totalDispatchedQty, // paid + free dispatched (physical)
        returned: bi.totalReturnedQty || 0, // paid + free returned (physical)
        damaged: bi.totalDamagedQty || 0,
        delivered: bi.totalDeliveredQty, // paid + free delivered (physical)
        deliveredPaid: paidDelivered, // paid-only delivered → used for Sold Qty
        freeDelivered, // free-only delivered (for reference)
        finalSoldAmount: bi.finalSoldAmount, // revenue (excludes free items)
      };
    });

    const summary = {
      totalDispatchedQty: (batch.items || []).reduce(
        (sum: number, bi: any) => sum + Number(bi.totalDispatchedQty),
        0,
      ),
      grossDispatchedValue: batch.grossDispatchedValue,
      returnAdjustedValue: Math.max(
        0,
        Number(batch.grossDispatchedValue || 0) - Number(batch.finalSoldValue || 0),
      ),
      finalSoldValue:
        batch.finalSoldValue ||
        (batch.items || []).reduce(
          (sum: number, bi: any) => sum + Number(bi.finalSoldAmount),
          0,
        ),
      totalCollectedAmount: batch.totalCollectedAmount,
      totalDueAmount: batch.totalDueAmount,
      totalReturnAmount:
        Number(batch.grossDispatchedValue || 0) -
        Number(batch.finalSoldValue || 0),
      totalCashExpected: (batch.orders || []).reduce((sum: number, bo: any) => {
        return (
          sum +
          Math.max(
            0,
            Number(bo.finalSoldAmount || 0) -
              Number(bo.order?.advancePaid || 0),
          )
        );
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
      cashExpected: Math.max(
        0,
        Number(bo.finalSoldAmount || 0) - Number(bo.order?.advancePaid || 0),
      ),
      note: bo.deliveryNote || bo.order?.deliveryNote || '',
      items: (bo.order?.items || []).map((oi: any) => ({
        productName: oi.product?.name || 'Unknown',
        dispatchedQuantity:
          Number(oi.quantity || 0) + Number(oi.freeQuantity || 0),
        deliveredQuantity: Number(oi.deliveredQuantity || 0),
        returnedQuantity: Number(oi.returnedQuantity || 0),
        damagedQuantity: Number(oi.damagedQuantity || 0),
      })),
    }));

    return {
      ...batch,
      itemWiseTotals,
      selectedOrders,
      estimatedTotalAmount: (batch.items || []).reduce(
        (sum: number, bi: any) => sum + Number(bi.estimatedAmount),
        0,
      ),
      productSummary,
      summary,
      orders,
    };
  }

  async dispatchBatch(id: number) {
    const batch = await this.getDispatchBatch(id);
    if (
      ![DispatchBatchStatus.DRAFT, DispatchBatchStatus.PRINTED].includes(
        batch.status,
      )
    ) {
      throw new BadRequestException('Invalid batch status for dispatch');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      // Stock is already deducted during Order Confirmation.
      // We just move statuses.
      await manager.update(DispatchBatch, id, {
        status: DispatchBatchStatus.DISPATCHED,
        dispatchedAt: new Date(),
      });
      await manager.update(
        Order,
        { id: In(batch.orders.map((o: any) => o.orderId)) },
        {
          status: OrderStatus.OUT_FOR_DELIVERY,
          dispatchedAt: new Date(),
          isLocked: true,
        },
      );
      return this.getDispatchBatch(id);
    });

    this.realtimeGateway.emitPayload('batchUpdated', result);
    return result;
  }

  async recordReturns(id: number, dto: RecordBatchReturnsDto) {
    try {
      const batch = (await this.getDispatchBatch(id)) as any;
      this.assertBatchEditableByDelivery(batch);

      return await this.dataSource.transaction(async (manager) => {
        console.log(`[recordReturns] Batch #${id} DTO:`, JSON.stringify(dto));
      for (const orderDto of dto.orders || []) {
        const batchOrder = batch.orders.find(
          (bo: DispatchBatchOrder) => Number(bo.orderId) === Number(orderDto.orderId),
        );
        if (!batchOrder) {
          throw new BadRequestException(
            `Order #${orderDto.orderId} is not part of this batch`,
          );
        }

        const order = batchOrder.order;
        let finalSoldAmount = 0;

        for (const itemDto of orderDto.items || []) {
          const orderItem = order.items.find(
            (item: OrderItem) =>
              (itemDto.orderItemId && Number(item.id) === Number(itemDto.orderItemId)) ||
              (!itemDto.orderItemId && Number(item.productId) === Number(itemDto.productId)),
          );
          if (!orderItem) continue;

          const orderedPaidQty = Number(orderItem.quantity || 0);
          const orderedFreeQty = Number(orderItem.freeQuantity || 0);

          const returnedPaidQty = Number(itemDto.returnedPaidQuantity || 0);
          const returnedFreeQty = Number(itemDto.returnedFreeQuantity || 0);
          const damagedPaidQty = Number(itemDto.damagedPaidQuantity || 0);
          const damagedFreeQty = Number(itemDto.damagedFreeQuantity || 0);

          const finalPaidDelivered = Math.max(
            0,
            orderedPaidQty - returnedPaidQty - damagedPaidQty,
          );
          const finalDeliveredFree = Math.max(
            0,
            orderedFreeQty - returnedFreeQty - damagedFreeQty,
          );

          finalSoldAmount += this.calculateItemSoldAmount(
            orderItem,
            finalPaidDelivered,
          );

          orderItem.deliveredPaidQuantity = finalPaidDelivered;
          orderItem.deliveredFreeQuantity = finalDeliveredFree;
          orderItem.returnedPaidQuantity = returnedPaidQty;
          orderItem.returnedFreeQuantity = returnedFreeQty;
          orderItem.damagedPaidQuantity = damagedPaidQty;
          orderItem.damagedFreeQuantity = damagedFreeQty;

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
        const newDueAmount = Math.max(
          0,
          finalSoldAmount - advancePaid - existingCollectedAmount,
        );

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
    } catch (error: any) {
      console.error('[recordReturns ERROR]:', error);
      throw error;
    }
  }

  async createShopForOrder(
    orderId: number,
    dto: CreateShopForOrderDto,
    user?: any,
  ) {
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

  async submitDeliveryResult(
    orderId: number,
    dto: DeliveryResultDto,
    user?: any,
  ) {
    const batchOrder = await this.batchOrderRepository.findOne({
      where: { orderId },
      relations: [
        'batch',
        'batch.assignedDeliveryMan',
        'batch.route',
        'order',
        'order.items',
        'order.items.product',
        'order.shop',
        'order.route',
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
        const orderItem = order.items.find(
          (item) => item.productId === itemDto.productId,
        );
        if (!orderItem) {
          throw new BadRequestException(
            `Product ${itemDto.productId} is not part of order #${orderId}`,
          );
        }

        const orderedPaidQty = Number(orderItem.quantity || 0);
        const orderedFreeQty = Number(orderItem.freeQuantity || 0);

        const returnedPaidQty = Number(itemDto.returnedPaidQty || 0);
        const returnedFreeQty = Number(itemDto.returnedFreeQty || 0);
        const damagedPaidQty = Number(itemDto.damagedPaidQty || 0);
        const damagedFreeQty = Number(itemDto.damagedFreeQty || 0);

        const finalPaidDelivered = Math.max(
          0,
          orderedPaidQty - returnedPaidQty - damagedPaidQty,
        );
        const finalDeliveredFree = Math.max(
          0,
          orderedFreeQty - returnedFreeQty - damagedFreeQty,
        );

        finalSoldAmount += this.calculateItemSoldAmount(
          orderItem,
          finalPaidDelivered,
        );
        totalReturned += returnedPaidQty + returnedFreeQty;
        totalDamaged += damagedPaidQty + damagedFreeQty;

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
      const cashExpected = Math.max(
        0,
        Number((finalSoldAmount - Number(order.advancePaid || 0)).toFixed(2)),
      );

      // Default to cashExpected if cashCollected is not provided (e.g. legacy or simplified submission)
      const cashCollected =
        dto.cashCollected !== undefined
          ? Number(dto.cashCollected)
          : cashExpected;
      const dueAmount = Math.max(
        0,
        Number((cashExpected - cashCollected).toFixed(2)),
      );

      console.log(
        `[DeliveryResult] Order #${orderId}: expected=${cashExpected}, collected=${cashCollected}, due=${dueAmount}`,
      );

      if (dueAmount > 0 && !order.shopId) {
        throw new BadRequestException(
          'Shop is required when delivery has due/baki.',
        );
      }

      if (cashCollected > cashExpected + 0.01) {
        throw new BadRequestException(
          'Cash collected cannot exceed the final payable amount',
        );
      }

      // Validating that the client's dueAmount matches our calculation if provided
      if (
        dto.dueAmount !== undefined &&
        Math.abs(Number(dto.dueAmount || 0) - dueAmount) > 0.01
      ) {
        throw new BadRequestException(
          `Due amount mismatch. Expected ${dueAmount}, but received ${dto.dueAmount}`,
        );
      }

      await manager.delete(CashCollection, { batchOrderId: batchOrder.id });
      if (cashCollected > 0) {
        await manager.save(
          CashCollection,
          manager.create(CashCollection, {
            batchId: batchOrder.batchId,
            batchOrderId: batchOrder.id,
            amount: cashCollected,
            paymentMode: 'CASH',
            note: dto.deliveryNote,
          }),
        );
      }

      await manager.delete(DeliveryReturn, { batchOrderId: batchOrder.id });
      await manager.delete(DamageRecord, {
        batchId: batchOrder.batchId,
        orderId,
      });

      const returnItems = dto.items.filter(
        (item) =>
          Number(item.returnedPaidQty || 0) > 0 ||
          Number(item.returnedFreeQty || 0) > 0 ||
          Number(item.damagedPaidQty || 0) > 0 ||
          Number(item.damagedFreeQty || 0) > 0,
      );
      if (returnItems.length > 0) {
        const deliveryReturn = await manager.save(
          DeliveryReturn,
          manager.create(DeliveryReturn, {
            batchId: batchOrder.batchId,
            batchOrderId: batchOrder.id,
            note: dto.deliveryNote,
            returnReason:
              returnItems
                .map((item) => item.returnReason)
                .filter(Boolean)
                .join(', ') || undefined,
          }),
        );

        await manager.save(
          returnItems.map((item) => {
            const orderItem = order.items.find(
              (oi) => oi.productId === item.productId,
            );
            return manager.create(DeliveryReturnItem, {
              deliveryReturnId: deliveryReturn.id,
              productId: item.productId,
              returnedPaidQuantity: Number(item.returnedPaidQty || 0),
              returnedFreeQuantity: Number(item.returnedFreeQty || 0),
              damagedPaidQuantity: Number(item.damagedPaidQty || 0),
              damagedFreeQuantity: Number(item.damagedFreeQty || 0),
              deliveredPaidQuantity: Number(
                orderItem?.deliveredPaidQuantity || 0,
              ),
              deliveredFreeQuantity: Number(
                orderItem?.deliveredFreeQuantity || 0,
              ),
              reason: item.returnReason,
              note: dto.deliveryNote,
            });
          }),
        );

        const damageRows = returnItems
          .filter(
            (item) =>
              Number(item.damagedPaidQty || 0) > 0 ||
              Number(item.damagedFreeQty || 0) > 0,
          )
          .map((item) =>
            manager.create(DamageRecord, {
              batchId: batchOrder.batchId,
              orderId,
              productId: item.productId,
              quantity:
                Number(item.damagedPaidQty || 0) +
                Number(item.damagedFreeQty || 0),
              reason: item.damageReason,
              note: dto.deliveryNote,
            }),
          );
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
        relations: [
          'items',
          'items.product',
          'company',
          'route',
          'shop',
          'deliveryPerson',
          'assignedDeliveryMan',
        ],
      });
    });

    if (updatedOrder) {
      this.realtimeGateway.emitPayload('orderUpdated', updatedOrder);
      try {
        const updatedBatch = await this.getDispatchBatch(batchOrder.batchId);
        this.realtimeGateway.emitPayload('batchUpdated', updatedBatch);
      } catch (e) {
        console.error(
          'Failed to emit batchUpdated for batchId',
          batchOrder.batchId,
          e,
        );
      }
    }

    return updatedOrder;
  }

  private calculateItemSoldAmount(
    item: OrderItem,
    deliveredPaid: number,
  ): number {
    const paidQty = Number(item.quantity || 0);
    if (paidQty <= 0) return 0;
    const unitPriceAfterItemDiscount = Number(item.lineTotal || 0) / paidQty;
    return Number(deliveredPaid) * unitPriceAfterItemDiscount;
  }

  private applyOrderDiscount(order: Order, itemSoldAmount: number) {
    const subtotal = Number(order.subtotal || 0);
    const invoiceDiscountApplied =
      subtotal > 0
        ? Number(order.discountAmount || 0) * (itemSoldAmount / subtotal)
        : 0;

    return Math.max(
      0,
      Number((itemSoldAmount - invoiceDiscountApplied).toFixed(2)),
    );
  }

  private async recalculateBatchTotals(manager: any, batchId: number) {
    const batch = await manager.findOne(DispatchBatch, {
      where: { id: batchId },
      relations: ['orders', 'items'],
    });
    if (!batch) return;

    const batchOrderIds = (batch.orders || []).map((bo: any) => bo.id);
    const orderIds = (batch.orders || []).map((bo: any) => bo.orderId);

    // Fetch fresh batch orders and order items directly from DB to avoid entity manager caching stale values
    let freshOrderItems: OrderItem[] = [];
    if (orderIds.length > 0) {
      freshOrderItems = await manager
        .createQueryBuilder(OrderItem, 'oi')
        .where('oi.orderId IN (:...orderIds)', { orderIds })
        .getMany();
    }

    let freshBatchOrders: DispatchBatchOrder[] = [];
    if (batchOrderIds.length > 0) {
      freshBatchOrders = await manager
        .createQueryBuilder(DispatchBatchOrder, 'dbo')
        .where('dbo.id IN (:...batchOrderIds)', { batchOrderIds })
        .getMany();
    }

    const productTotals = new Map<
      number,
      {
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
      }
    >();

    let finalSoldValue = 0;
    let totalCollectedAmount = 0;
    let totalDueAmount = 0;

    for (const batchOrder of freshBatchOrders) {
      finalSoldValue += Number(batchOrder.finalSoldAmount || 0);
      totalCollectedAmount += Number(batchOrder.collectedAmount || 0);
      totalDueAmount += Number(batchOrder.dueAmount || 0);
    }

    console.log(`[recalculateBatchTotals] Batch #${batchId} freshOrderItems:`, JSON.stringify(freshOrderItems.map(oi => ({ id: oi.id, orderId: oi.orderId, productId: oi.productId, returnedPaidQuantity: oi.returnedPaidQuantity }))));

    for (const orderItem of freshOrderItems) {
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

      existing.returned += returnedPaid + returnedFree;
      existing.returnedPaid += returnedPaid;
      existing.returnedFree += returnedFree;
      existing.damaged += damagedPaid + damagedFree;
      existing.damagedPaid += damagedPaid;
      existing.damagedFree += damagedFree;
      existing.delivered += deliveredPaid + deliveredFree;
      existing.deliveredPaid += deliveredPaid;
      existing.deliveredFree += deliveredFree;
      existing.finalSoldAmount += this.calculateItemSoldAmount(
        orderItem,
        deliveredPaid,
      );
      productTotals.set(orderItem.productId, existing);
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

    const grossDispatched = Number(batch.grossDispatchedValue || 0);
    const returnAdjustedValue = Math.max(0, grossDispatched - finalSoldValue);

    await manager.update(DispatchBatch, batchId, {
      returnAdjustedValue,
      finalSoldValue,
      totalCollectedAmount,
      totalDueAmount,
      shortageOrExcess: totalCollectedAmount - finalSoldValue,
    });
  }

  async settleBatch(id: number, dto: SettleDispatchBatchDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Lock the main batch record first using QueryBuilder to ensure NO joins are generated
      const lockBatch = await manager
        .createQueryBuilder(DispatchBatch, 'batch')
        .setLock('pessimistic_write')
        .where('batch.id = :id', { id })
        .getOne();

      if (!lockBatch) throw new NotFoundException('Batch not found');

      // 2. Now fetch with relations (safe since row is already locked in this transaction)
      const currentBatch = await manager.findOne(DispatchBatch, {
        where: { id },
        relations: [
          'orders',
          'orders.order',
          'orders.order.items',
          'orders.order.items.product',
        ],
      });

      if (!currentBatch) throw new NotFoundException('Batch not found');
      if (currentBatch.status === DispatchBatchStatus.SETTLED)
        throw new BadRequestException('Batch is already settled');
      if (currentBatch.status === DispatchBatchStatus.CANCELLED)
        throw new BadRequestException('Cannot settle a cancelled batch');

      // 2. Fail-fast if ANY order is already settled or lacks a shop
      for (const bo of currentBatch.orders) {
        if (
          bo.isSettled ||
          [OrderStatus.SETTLED, OrderStatus.PARTIAL_DUE].includes(
            bo.order?.status,
          )
        ) {
          throw new BadRequestException(
            `Order #${bo.orderId} is already settled. Batch settlement rejected.`,
          );
        }
        const orderDueEntries = dto.dueEntries?.filter((d) => Number(d.orderId) === Number(bo.orderId)) || [];
        const requestedDue = orderDueEntries.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
        const hasDuesWithoutShopId = orderDueEntries.some(d => !d.shopId);

        if (!bo.order?.shopId && Number(requestedDue) > 0 && (orderDueEntries.length === 0 || hasDuesWithoutShopId)) {
          throw new BadRequestException(
            `Order #${bo.orderId} is a direct order (no shop) and cannot have a due without specifying a shop. Settlement rejected.`,
          );
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
          collectionMap.set(
            Number(col.orderId),
            Number(col.collectedAmount || 0),
          );
        }
      }

      // 3. Process each order with mathematical precision
      for (const batchOrder of currentBatch.orders) {
        const order = batchOrder.order;
        if (!order) continue;

        const settlementItems = order.items.map((item) => ({
          productId: item.productId,
          returnedPaidQuantity: Number(item.returnedPaidQuantity || 0),
          returnedFreeQuantity: Number(item.returnedFreeQuantity || 0),
          damagedPaidQuantity: Number(item.damagedPaidQuantity || 0),
          damagedFreeQuantity: Number(item.damagedFreeQuantity || 0),
        }));

        // Use collectedAmount from dto.collections if provided by frontend;
        // fall back to batchOrder.collectedAmount (set during per-order delivery result submission)
        const collectedFromDto = collectionMap.get(Number(batchOrder.orderId));
        const collectedAmount = Number(
          collectedFromDto !== undefined
            ? collectedFromDto
            : Number(batchOrder.collectedAmount || 0),
        );

        const orderDueEntries = dto.dueEntries
          ?.filter((d) => Number(d.orderId) === Number(batchOrder.orderId))
          .map((d) => ({
            shopId: d.shopId,
            productId: d.productId,
            amount: d.amount,
            note: d.note || dto.note || batchOrder.deliveryNote,
          }));

        // Settle individual order (Calculates finalSoldAmount and returns stock)
        const settledOrder = await this.ordersService.settleOrder(
          order.id,
          {
            items: settlementItems,
            collectedAmount: Number(collectedAmount),
            settlementNote: dto.note || batchOrder.deliveryNote,
            dueEntries: orderDueEntries,
          } as any,
          manager,
        );

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
        totalExpectedCash += Math.max(
          0,
          Number(settledOrder.actualSoldAmount || 0) -
            Number(settledOrder.advancePaid || 0),
        );
      }

      // --- EXPENSE PROCESSING & RECONCILIATION ---
      const vanRent = Math.max(0, Number(dto.vanRent || 0));
      const salary = Math.max(0, Number(dto.salary || 0));
      let customExpensesTotal = 0;

      const validExpensesToInsert: Array<{
        dispatchBatchId: number;
        expenseType: string;
        name: string;
        amount: number;
        note?: string;
      }> = [];

      if (dto.customExpenses && dto.customExpenses.length > 0) {
        for (const exp of dto.customExpenses) {
          const amt = Number(exp.amount || 0);
          if (isNaN(amt) || amt < 0) {
            throw new BadRequestException(`Invalid expense amount for "${exp.name || 'Expense'}"`);
          }
          if (amt === 0 || !exp.name || !exp.name.trim()) {
            continue; // Ignore empty rows
          }
          customExpensesTotal += amt;
          validExpensesToInsert.push({
            dispatchBatchId: id,
            expenseType: exp.expenseType || 'Other',
            name: exp.name.trim(),
            amount: amt,
            note: exp.note?.trim(),
          });
        }
      }

      const totalExpenses = Number(
        (vanRent + salary + customExpensesTotal).toFixed(2),
      );

      // Validate totalExpenses against Gross Cash Collectable across all orders
      const grossCashCollectable = totalExpectedCash;
      if (totalExpenses > grossCashCollectable + 0.01) {
        throw new BadRequestException(
          `Total Expenses (${totalExpenses}) cannot exceed Gross Cash Collectable (${grossCashCollectable})`,
        );
      }

      const netExpectedCash = Math.max(
        0,
        Number((grossCashCollectable - totalExpenses).toFixed(2)),
      );

      // Clear previous DispatchBatchExpense records for this batch
      await manager.delete(DispatchBatchExpense, { dispatchBatchId: id });
      if (validExpensesToInsert.length > 0) {
        await manager.save(
          DispatchBatchExpense,
          validExpensesToInsert.map((e) => manager.create(DispatchBatchExpense, e)),
        );
      }

      if (dto.actualCashReceived === undefined || dto.actualCashReceived === null || isNaN(Number(dto.actualCashReceived))) {
        throw new BadRequestException(
          'Actual Cash Received by Admin is required (অ্যাডমিন কতৃক প্রাপ্ত নগদ টাকা ফিল্ডটি বাধ্যতামূলক)',
        );
      }
      const actualCashReceived = Number(dto.actualCashReceived);

      const finalDueBaki = totalDueAmount;
      const finalCashCollectable = Number(actualCashReceived);

      const cashDiscrepancy = Number(
        (actualCashReceived - netExpectedCash).toFixed(2),
      );

      // Compute grossDispatchedValue across all orders in currentBatch
      let grossDispatchedValue = 0;
      for (const bo of currentBatch.orders) {
        if (bo.order && bo.order.items) {
          for (const item of bo.order.items) {
            grossDispatchedValue += Number(item.quantity || 0) * Number(item.unitPrice || 0);
          }
        }
      }
      const returnAdjustedValue = Math.max(0, grossDispatchedValue - totalFinalValue);

      // 5. Update Batch with Audit Metadata
      await manager.update(DispatchBatch, id, {
        status: DispatchBatchStatus.SETTLED,
        settledAt: new Date(),
        grossDispatchedValue,
        returnAdjustedValue,
        totalCollectedAmount: finalCashCollectable,
        finalSoldValue: totalFinalValue,
        totalDueAmount: finalDueBaki,
        vanRent,
        salary,
        totalExpenses,
        shortageOrExcess: cashDiscrepancy,
        settlementNote:
          `${dto.note || ''} [Expenses: VanRent=${vanRent}, Salary=${salary}, Custom=${customExpensesTotal}, Total=${totalExpenses} | NetExpectedCash=${netExpectedCash}, Actual=${actualCashReceived}]`.trim(),
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

  async getDeliveryExpenseReport(query: QueryDispatchBatchesDto, user?: any) {
    const qb = this.batchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.route', 'route')
      .leftJoinAndSelect('batch.deliveryPerson', 'deliveryPerson')
      .leftJoinAndSelect('batch.assignedDeliveryMan', 'assignedDeliveryMan')
      .leftJoinAndSelect('batch.expenses', 'expenses')
      .where('batch.status = :status', { status: DispatchBatchStatus.SETTLED });

    if (query.startDate && query.endDate) {
      qb.andWhere('batch.dispatchDate BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    } else if (query.dispatchDate) {
      qb.andWhere('batch.dispatchDate = :dispatchDate', {
        dispatchDate: query.dispatchDate,
      });
    }

    if (query.routeId) {
      qb.andWhere('batch.routeId = :routeId', { routeId: query.routeId });
    }

    if (query.deliveryPersonId) {
      const numId = Number(query.deliveryPersonId);
      qb.andWhere(
        '(batch.deliveryPersonId = :deliveryPersonId OR batch.assignedDeliveryManId = :deliveryPersonIdUuid)',
        {
          deliveryPersonId: isNaN(numId) ? -1 : numId,
          deliveryPersonIdUuid: String(query.deliveryPersonId),
        },
      );
    }

    if (user && user.role === Role.DELIVERY_MAN) {
      const userId = user.id || user.sub;
      if (userId) {
        qb.andWhere('batch.assignedDeliveryManId = :userId', { userId });
      } else {
        qb.andWhere('batch.id = -1');
      }
    }

    qb.orderBy('batch.dispatchDate', 'DESC').addOrderBy('batch.createdAt', 'DESC');

    const batches = await qb.getMany();

    let totalVanRent = 0;
    let totalSalary = 0;
    let totalOtherExpenses = 0;

    const rows = batches.map((batch) => {
      const vanRent = Number(batch.vanRent || 0);
      const salary = Number(batch.salary || 0);
      const customExpensesList = batch.expenses || [];
      const otherExpensesTotal = customExpensesList.reduce(
        (sum, e) => sum + Number(e.amount || 0),
        0,
      );
      const totalExpense = Number(
        (batch.totalExpenses || vanRent + salary + otherExpensesTotal).toFixed(2),
      );

      totalVanRent += vanRent;
      totalSalary += salary;
      totalOtherExpenses += otherExpensesTotal;

      const grossCashCollectable = Number(batch.finalSoldValue || batch.grossDispatchedValue || 0) - Number(batch.totalDueAmount || 0);
      const netExpectedCash = Math.max(0, Number((grossCashCollectable - totalExpense).toFixed(2)));

      return {
        id: batch.id,
        batchNo: batch.batchNo,
        dispatchDate: batch.dispatchDate,
        route: batch.route?.name || 'Unknown Route',
        deliveryPerson:
          batch.assignedDeliveryMan?.name ||
          batch.deliveryPerson?.name ||
          'Unassigned',
        grossCashCollectable,
        vanRent,
        salary,
        otherExpenses: otherExpensesTotal,
        totalExpense,
        netExpectedCash,
        actualCashReceived: Number(batch.totalCollectedAmount || 0),
        shortageOrExcess: Number(batch.shortageOrExcess || 0),
        customExpenses: customExpensesList.map((exp) => ({
          id: exp.id,
          expenseType: exp.expenseType,
          name: exp.name,
          amount: Number(exp.amount || 0),
          note: exp.note,
        })),
      };
    });

    const totalExpenses = Number((totalVanRent + totalSalary + totalOtherExpenses).toFixed(2));

    return {
      summary: {
        totalExpenses,
        totalVanRent,
        totalSalary,
        totalOtherExpenses,
      },
      rows,
    };
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
        where: {
          ...where,
          status: In([DispatchBatchStatus.DRAFT, DispatchBatchStatus.PRINTED]),
        },
      }),
    };
  }

  async getReports(query: QueryDispatchBatchesDto, user?: any) {
    const reportQuery = { ...query };
    delete reportQuery.page;
    delete reportQuery.limit;

    const batches = (await this.getDispatchBatches(
      reportQuery,
      user,
    )) as DispatchBatch[];

    const rows = batches.map((batch) => ({
      id: batch.id,
      batchNo: batch.batchNo,
      dispatchDate: batch.dispatchDate,
      deliveryPerson:
        batch.assignedDeliveryMan?.name ||
        batch.deliveryPerson?.name ||
        'Unassigned',
      grossDispatchedValue: Number(batch.grossDispatchedValue || 0),
      finalSoldValue: Number(batch.finalSoldValue || 0),
      totalCollectedAmount: Number(batch.totalCollectedAmount || 0),
      totalDueAmount: Number(batch.totalDueAmount || 0),
      status: batch.status,
    }));

    const totals = rows.reduce(
      (acc: any, row: any) => ({
        grossDispatchedValue:
          acc.grossDispatchedValue + row.grossDispatchedValue,
        finalSoldValue: acc.finalSoldValue + row.finalSoldValue,
        totalCollectedAmount:
          acc.totalCollectedAmount + row.totalCollectedAmount,
        totalDueAmount: acc.totalDueAmount + row.totalDueAmount,
      }),
      {
        grossDispatchedValue: 0,
        finalSoldValue: 0,
        totalCollectedAmount: 0,
        totalDueAmount: 0,
      },
    );

    return { rows, totals };
  }

  async getMorningReport(id: number, user?: any) {
    const batch = (await this.getDispatchBatch(id, user)) as any;
    return this.formatBatchForReport(batch);
  }

  async getFinalReport(id: number, user?: any) {
    const batch = (await this.getDispatchBatch(id, user)) as any;
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
      const batch = await manager
        .createQueryBuilder(DispatchBatch, 'batch')
        .setLock('pessimistic_write')
        .where('batch.id = :id', { id })
        .getOne();

      if (!batch) {
        throw new NotFoundException(`Dispatch batch #${id} not found`);
      }

      // Fetch with relations
      const fullBatch = await manager.findOne(DispatchBatch, {
        where: { id },
        relations: [
          'orders',
          'orders.order',
          'orders.order.items',
          'orders.order.items.product',
          'items',
        ],
      });

      if (!fullBatch) {
        throw new NotFoundException(`Dispatch batch #${id} not found`);
      }

      const isSettled = [
        DispatchBatchStatus.SETTLED,
        DispatchBatchStatus.PARTIALLY_SETTLED,
      ].includes(batch.status);
      const orderIds = fullBatch.orders.map((bo) => bo.orderId);

      // 2. Process each order in the batch: restore stock and delete order & related entries
      for (const batchOrder of fullBatch.orders) {
        const order = batchOrder.order;
        if (!order) continue;

        for (const orderItem of order.items || []) {
          const dispatchedQty =
            Number(orderItem.quantity || 0) +
            Number(orderItem.freeQuantity || 0);
          const returnedQty =
            Number(orderItem.returnedPaidQuantity || 0) +
            Number(orderItem.returnedFreeQuantity || 0);

          const qtyToRestore = isSettled
            ? Math.max(0, dispatchedQty - returnedQty)
            : Math.max(0, dispatchedQty);

          if (qtyToRestore > 0) {
            await this.stockService.create(
              {
                productId: orderItem.productId,
                companyId: orderItem.product?.companyId || order.companyId || 0,
                type: StockMovementType.RETURN_IN,
                quantity: qtyToRestore,
                reference: `Delete Batch #${id}`,
                note: `Restored ${qtyToRestore} units — batch #${id} deleted, order #${order.id} permanently removed`,
              },
              'System',
              manager,
            );
          }
        }

        // Delete all dependent records for this order
        await manager.query(
          'DELETE FROM due_collections WHERE "orderId" = $1',
          [order.id],
        );
        await manager.query('DELETE FROM dues WHERE "orderId" = $1', [
          order.id,
        ]);
        await manager.query(
          'DELETE FROM damage_records WHERE "orderId" = $1',
          [order.id],
        );
        await manager.query(
          'DELETE FROM dispatch_batch_orders WHERE "orderId" = $1',
          [order.id],
        );
        await manager.query(
          'DELETE FROM order_items WHERE "orderId" = $1',
          [order.id],
        );
        await manager.query(
          'DELETE FROM orders WHERE "id" = $1',
          [order.id],
        );
      }

      // 3. Delete batch items, expenses, and batch record
      await manager.query(
        'DELETE FROM dispatch_batch_items WHERE "batchId" = $1',
        [id],
      );
      await manager.query(
        'DELETE FROM dispatch_batch_expenses WHERE "dispatchBatchId" = $1',
        [id],
      );
      await manager.query(
        'DELETE FROM dispatch_batch_orders WHERE "batchId" = $1',
        [id],
      );
      await manager.query(
        'DELETE FROM dispatch_batches WHERE "id" = $1',
        [id],
      );

      return {
        success: true,
        message: `Batch #${id} and all related orders, free items, and dues have been permanently deleted.`,
        orderIds,
      };
    });

    this.realtimeGateway.emitPayload('batchDeleted', { id });
    if (result && result.orderIds) {
      for (const orderId of result.orderIds) {
        this.realtimeGateway.emitPayload('orderDeleted', { id: orderId });
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
    const totalReturnedQty = items.reduce(
      (sum, item) => sum + Number(item.totalReturnedQty || 0),
      0,
    );
    const totalDamagedQty = items.reduce(
      (sum, item) => sum + Number(item.totalDamagedQty || 0),
      0,
    );
    const totalDeliveredQty = items.reduce(
      (sum, item) => sum + Number(item.totalDeliveredQty || 0),
      0,
    );
    const completedOrders = orders.filter(
      (order) => order.deliveryStatus === 'COMPLETED' || order.isSettled,
    ).length;

    return {
      completedOrders,
      pendingOrders: Math.max(0, orders.length - completedOrders),
      totalReturnedQty,
      totalDamagedQty,
      totalDeliveredQty,
      totalCashExpected: orders.reduce((sum, batchOrder) => {
        return (
          sum +
          Math.max(
            0,
            Number(batchOrder.finalSoldAmount || 0) -
              Number(batchOrder.order?.advancePaid || 0),
          )
        );
      }, 0),
      totalCashCollected: orders.reduce(
        (sum, batchOrder) => sum + Number(batchOrder.collectedAmount || 0),
        0,
      ),
      totalDueCreated: orders.reduce(
        (sum, batchOrder) => sum + Number(batchOrder.dueAmount || 0),
        0,
      ),
    };
  }
}
