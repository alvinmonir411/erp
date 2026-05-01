import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
import { Order, OrderItem } from '../orders/entities/order.entity';
import { DiscountType, OrderStatus } from '../orders/orders.constants';
import { Product } from '../products/entities/product.entity';
import { StockService } from '../stock/stock.service';
import { DuesService } from '../dues/dues.service';
import { StockMovementType } from '../stock/stock.constants';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { isTodayBD } from '../../common/utils/date.utils';

type CalculatedOrderSettlement = {
  orderId: number;
  dispatchedQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  deliveredQuantity: number;
  deliveredSubtotal: number;
  invoiceDiscountApplied: number;
  finalSoldAmount: number;
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
    private readonly stockService: StockService,
    private readonly duesService: DuesService,
    private readonly dataSource: DataSource,
  ) {}

  async getDeliveryPeople(includeInactive = false) {
    return this.deliveryPersonRepository.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getDeliveryPersonById(id: number) {
    const person = await this.deliveryPersonRepository.findOne({ where: { id } });
    if (!person) {
      throw new NotFoundException('Delivery person not found');
    }
    return person;
  }

  async createDeliveryPerson(dto: CreateDeliveryPersonDto) {
    const person = this.deliveryPersonRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
    });
    return this.deliveryPersonRepository.save(person);
  }

  async updateDeliveryPerson(id: number, dto: Partial<CreateDeliveryPersonDto>) {
    const person = await this.getDeliveryPersonById(id);
    Object.assign(person, dto);
    return this.deliveryPersonRepository.save(person);
  }

  async deleteDeliveryPerson(id: number) {
    const person = await this.getDeliveryPersonById(id);
    // Soft delete by marking inactive, or hard delete if not used in orders
    const usedInOrders = await this.orderRepository.findOne({ where: { deliveryPersonId: id } });
    const usedInBatches = await this.batchRepository.findOne({ where: { deliveryPersonId: id } });
    
    if (usedInOrders || usedInBatches) {
      person.isActive = false;
      await this.deliveryPersonRepository.save(person);
      return { deleted: true, softDelete: true, message: 'Delivery person deactivated because they have associated records.' };
    }
    
    await this.deliveryPersonRepository.remove(person);
    return { deleted: true, softDelete: false };
  }

  async getEligibleOrders(query: QueryDispatchBatchesDto) {
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

    if (query.companyId) {
      qb.andWhere('order.companyId = :companyId', { companyId: query.companyId });
    }
    if (query.routeId) {
      qb.andWhere('order.routeId = :routeId', { routeId: query.routeId });
    }
    if (query.deliveryPersonId) {
      qb.andWhere('order.deliveryPersonId = :deliveryPersonId', {
        deliveryPersonId: query.deliveryPersonId,
      });
    }
    if (query.dispatchDate) {
      qb.andWhere('order.orderDate = :dispatchDate', {
        dispatchDate: query.dispatchDate,
      });
    }
    if (query.search) {
      qb.andWhere(
        '(LOWER(shop.name) LIKE :search OR LOWER(company.name) LIKE :search OR LOWER(route.name) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    const orders = await qb.orderBy('order.createdAt', 'ASC').getMany();
    const activeOrderIds = await this.getActiveBatchOrderIds();

    return orders.filter((order) => !activeOrderIds.has(order.id));
  }

  async getDispatchBatches(query: QueryDispatchBatchesDto) {
    const qb = this.batchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.company', 'company')
      .leftJoinAndSelect('batch.route', 'route')
      .leftJoinAndSelect('batch.deliveryPerson', 'deliveryPerson')
      .leftJoinAndSelect('batch.orders', 'batchOrders')
      .leftJoinAndSelect('batch.items', 'items')
      .orderBy('batch.dispatchDate', 'DESC')
      .addOrderBy('batch.createdAt', 'DESC');

    if (query.companyId) {
      qb.andWhere('batch.companyId = :companyId', { companyId: query.companyId });
    }
    if (query.routeId) {
      qb.andWhere('batch.routeId = :routeId', { routeId: query.routeId });
    }
    if (query.deliveryPersonId) {
      qb.andWhere('batch.deliveryPersonId = :deliveryPersonId', {
        deliveryPersonId: query.deliveryPersonId,
      });
    }
    if (query.dispatchDate) {
      qb.andWhere('batch.dispatchDate = :dispatchDate', {
        dispatchDate: query.dispatchDate,
      });
    }
    if (query.status) {
      qb.andWhere('batch.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        '(LOWER(batch.batchNo) LIKE :search OR LOWER(deliveryPerson.name) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    return qb.getMany();
  }

  async createDispatchBatch(dto: CreateDispatchBatchDto) {
    const activeOrderIds = await this.getActiveBatchOrderIds();
    for (const orderId of dto.orderIds) {
      if (activeOrderIds.has(orderId)) {
        throw new BadRequestException(
          `Order #${orderId} is already part of another active dispatch batch`,
        );
      }
    }

    const batchId = await this.dataSource.transaction(async (manager) => {
      const orders = await manager.find(Order, {
        where: { id: In(dto.orderIds) },
        relations: ['company', 'route', 'shop', 'items', 'items.product'],
      });

      if (orders.length !== dto.orderIds.length) {
        throw new BadRequestException('One or more selected orders were not found');
      }

      for (const order of orders) {
        if (![OrderStatus.CONFIRMED, OrderStatus.ASSIGNED].includes(order.status)) {
          throw new BadRequestException(
            `Order #${order.id} is not eligible for dispatch batching`,
          );
        }
        if (dto.companyId && order.companyId !== dto.companyId) {
          throw new BadRequestException(
            `Order #${order.id} belongs to a different company than the batch`,
          );
        }
        if (order.routeId !== dto.routeId) {
          throw new BadRequestException(
            'All orders in a batch must belong to the same route',
          );
        }
        if (order.deliveryPersonId && order.deliveryPersonId !== dto.deliveryPersonId) {
          throw new BadRequestException(
            `Order #${order.id} is already assigned to a different delivery person`,
          );
        }
      }

      const batch = manager.create(DispatchBatch, {
        batchNo: await this.generateBatchNo(manager, dto.dispatchDate),
        dispatchDate: new Date(dto.dispatchDate),
        companyId: dto.companyId,
        routeId: dto.routeId,
        deliveryPersonId: dto.deliveryPersonId,
        marketArea: dto.marketArea,
        note: dto.note,
        status: DispatchBatchStatus.DRAFT,
        totalOrders: orders.length,
        grossDispatchedValue: orders.reduce(
          (sum, order) => sum + Number(order.grandTotal),
          0,
        ),
        totalAdvancePaid: orders.reduce(
          (sum, order) => sum + Number(order.advancePaid || 0),
          0,
        ),
      });

      const savedBatch = await manager.save(batch);

      const batchOrders = orders.map((order) =>
        manager.create(DispatchBatchOrder, {
          batchId: savedBatch.id,
          orderId: order.id,
          estimatedAmount: order.grandTotal,
          finalSoldAmount: order.grandTotal,
          dueAmount: Math.max(0, Number(order.grandTotal) - Number(order.advancePaid || 0)),
        }),
      );

      await manager.save(batchOrders);

      const aggregate = new Map<
        number,
        { qty: number; amount: number }
      >();

      for (const order of orders) {
        for (const item of order.items) {
          const dispatchedQty = Number(item.quantity) + Number(item.freeQuantity || 0);
          const existing = aggregate.get(item.productId) ?? { qty: 0, amount: 0 };
          aggregate.set(item.productId, {
            qty: existing.qty + dispatchedQty,
            amount: existing.amount + Number(item.lineTotal),
          });
        }
      }

      const batchItems = Array.from(aggregate.entries()).map(([productId, value]) =>
        manager.create(DispatchBatchItem, {
          batchId: savedBatch.id,
          productId,
          totalDispatchedQty: value.qty,
          totalDeliveredQty: value.qty,
          estimatedAmount: value.amount,
          finalSoldAmount: value.amount,
        }),
      );

      await manager.save(batchItems);

      await Promise.all(
        orders.map((order) =>
          manager.update(Order, order.id, {
            status: OrderStatus.ASSIGNED,
            deliveryPersonId: dto.deliveryPersonId,
            marketArea: dto.marketArea,
          }),
        ),
      );

      return savedBatch.id;
    });

    return this.getDispatchBatch(batchId);
  }

  async getDispatchBatch(id: number) {
    const batch = await this.batchRepository.findOne({
      where: { id },
      relations: [
        'company',
        'route',
        'deliveryPerson',
        'items',
        'items.product',
        'orders',
        'orders.order',
        'orders.order.shop',
        'orders.order.company',
        'orders.order.route',
        'orders.order.deliveryPerson',
        'orders.order.items',
        'orders.order.items.product',
        'orders.returns',
        'orders.returns.items',
        'orders.collections',
      ],
    });

    if (!batch) {
      throw new NotFoundException('Dispatch batch not found');
    }

    const settlement = this.calculateBatchSettlement(batch);
    return {
      ...batch,
      metrics: settlement,
    };
  }

  async markMorningPrinted(id: number) {
    const batch = await this.getDispatchBatch(id);
    if (batch.status === DispatchBatchStatus.CANCELLED) {
      throw new BadRequestException('Cancelled batches cannot be printed');
    }

    await this.batchRepository.update(id, {
      status: DispatchBatchStatus.PRINTED,
      isMorningPrinted: true,
      morningPrintedAt: new Date(),
    });

    return this.getDispatchBatch(id);
  }

  async dispatchBatch(id: number) {
    const batch = await this.getDispatchBatch(id);
    if (
      ![DispatchBatchStatus.DRAFT, DispatchBatchStatus.PRINTED].includes(
        batch.status,
      )
    ) {
      throw new BadRequestException('Batch cannot be dispatched in its current state');
    }

    return this.dataSource.transaction(async (manager) => {
      for (const item of batch.items) {
        await this.stockService.create(
          {
            productId: item.productId,
            companyId: item.product.companyId,
            type: StockMovementType.STOCK_OUT,
            quantity: -Number(item.totalDispatchedQty),
            reference: batch.batchNo,
            note: `Dispatch batch ${batch.batchNo} issued to market`,
          },
          'Dispatch',
          manager,
        );
      }

      await manager.update(DispatchBatch, id, {
        status: DispatchBatchStatus.DISPATCHED,
        dispatchedAt: new Date(),
      });

      await Promise.all(
        batch.orders.map((batchOrder) =>
          manager.update(Order, batchOrder.orderId, {
            status: OrderStatus.OUT_FOR_DELIVERY,
            dispatchedAt: new Date(),
            isLocked: true,
          }),
        ),
      );

      return this.getDispatchBatch(id);
    });
  }

  private gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      a %= b;
      [a, b] = [b, a];
    }
    return a;
  }

  private getBundleSize(paid: number, free: number): number {
    if (!free || free === 0) return 1;
    const common = this.gcd(paid, free);
    return (paid / common) + (free / common);
  }

  async recordReturns(id: number, dto: RecordBatchReturnsDto) {
    const batch = await this.getDispatchBatch(id);

    if (batch.status === DispatchBatchStatus.SETTLED) {
      throw new BadRequestException('Batch already settled. No changes allowed.');
    }

    if (
      ![
        DispatchBatchStatus.DISPATCHED,
        DispatchBatchStatus.RETURN_PENDING,
        DispatchBatchStatus.PARTIALLY_SETTLED,
      ].includes(batch.status)
    ) {
      throw new BadRequestException('Returns can only be recorded after dispatch');
    }

    const batchOrderByOrderId = new Map(
      batch.orders.map((batchOrder) => [batchOrder.orderId, batchOrder]),
    );

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(DeliveryReturnItem, {
        deliveryReturnId: In(
          (
            await manager.find(DeliveryReturn, {
              where: { batchId: id },
              select: ['id'],
            })
          ).map((item) => item.id),
        ),
      });
      await manager.delete(DeliveryReturn, { batchId: id });
      await manager.delete(DamageRecord, { batchId: id });

      // Clean up previous stock movements for this batch returns/damages to avoid duplication
      await manager.delete(StockMovement, {
        reference: batch.batchNo,
        type: In([StockMovementType.RETURN_IN, StockMovementType.DAMAGE]),
      });

      const aggregate = new Map<
        number,
        { returned: number; damaged: number; delivered: number; soldAmount: number }
      >();

      for (const orderEntry of dto.orders) {
        const batchOrder = batchOrderByOrderId.get(orderEntry.orderId);
        if (!batchOrder) {
          throw new BadRequestException(
            `Order #${orderEntry.orderId} is not part of this batch`,
          );
        }

        const order = batchOrder.order;
        const orderItemMap = new Map(order.items.map((item) => [item.productId, item]));
        const deliveryReturn = await manager.save(
          manager.create(DeliveryReturn, {
            batchId: id,
            batchOrderId: batchOrder.id,
            note: orderEntry.note,
            returnReason: orderEntry.returnReason,
          }),
        );

        let totalReturned = 0;
        let totalDamaged = 0;

        for (const itemEntry of orderEntry.items) {
          const orderItem = orderItemMap.get(itemEntry.productId);
          if (!orderItem) {
            throw new BadRequestException(
              `Product #${itemEntry.productId} is not part of order #${order.id}`,
            );
          }

          const dispatchedQuantity =
            Number(orderItem.quantity) + Number(orderItem.freeQuantity || 0);
          if (Number(itemEntry.dispatchedQuantity) !== dispatchedQuantity) {
            throw new BadRequestException(
              `Dispatched quantity mismatch for product ${orderItem.product.name}`,
            );
          }

          const returnedQuantity = Number(itemEntry.returnedQuantity || 0);
          const damagedQuantity = Number(itemEntry.damagedQuantity || 0);
          if (returnedQuantity < 0 || damagedQuantity < 0) {
            throw new BadRequestException('Return and damage quantities must be zero or more');
          }

          // Bundle validation
          const paid = Number(orderItem.quantity);
          const free = Number(orderItem.freeQuantity || 0);
          if (free > 0) {
            const bundleSize = this.getBundleSize(paid, free);
            if ((returnedQuantity + damagedQuantity) % bundleSize !== 0) {
              throw new BadRequestException(
                `Return quantity for ${orderItem.product.name} must include the matching free product for this offer.`,
              );
            }
          }

          if (returnedQuantity + damagedQuantity > dispatchedQuantity) {
            throw new BadRequestException(
              `Returned + damaged quantity cannot exceed dispatched quantity for ${orderItem.product.name}`,
            );
          }

          const deliveredQuantity = dispatchedQuantity - returnedQuantity - damagedQuantity;

          // Split returns into paid and free components
          const paidRatio = dispatchedQuantity > 0 ? Number(orderItem.quantity) / dispatchedQuantity : 0;
          const paidReturnedQuantity = returnedQuantity * paidRatio;
          const freeReturnedQuantity = returnedQuantity - paidReturnedQuantity;

          await manager.save(
            manager.create(DeliveryReturnItem, {
              deliveryReturnId: deliveryReturn.id,
              productId: itemEntry.productId,
              dispatchedQuantity,
              returnedQuantity,
              paidReturnedQuantity,
              freeReturnedQuantity,
              damagedQuantity,
              deliveredQuantity,
              note: itemEntry.note,
              reason: itemEntry.reason,
            }),
          );

          totalReturned += returnedQuantity;
          totalDamaged += damagedQuantity;

          if (returnedQuantity > 0) {
            await this.stockService.create(
              {
                productId: itemEntry.productId,
                companyId: order.companyId,
                type: StockMovementType.RETURN_IN,
                quantity: returnedQuantity,
                reference: batch.batchNo,
                note: `Returned from dispatch batch ${batch.batchNo}`,
              },
              'Dispatch Return',
              manager,
            );
          }

          if (damagedQuantity > 0) {
            await manager.save(
              manager.create(DamageRecord, {
                batchId: id,
                orderId: order.id,
                productId: itemEntry.productId,
                quantity: damagedQuantity,
                reason: itemEntry.reason,
                note: itemEntry.note,
              }),
            );

            // Damaged items remain out of sellable stock (already deducted at dispatch).
            // We record a 0-quantity movement just for the audit trail of the damage event.
            await this.stockService.create(
              {
                productId: itemEntry.productId,
                companyId: order.companyId,
                type: StockMovementType.DAMAGE,
                quantity: 0,
                reference: batch.batchNo,
                note: `Damaged ${damagedQuantity} unit(s) in dispatch batch ${batch.batchNo}`,
              },
              'Dispatch Damage',
              manager,
            );
          }

          const deliveredChargeableQuantity = Math.max(
            0,
            Math.min(
              Number(orderItem.quantity),
              deliveredQuantity,
            ),
          );
          const itemNetPerPaidUnit =
            Number(orderItem.quantity) > 0
              ? Number(orderItem.lineTotal) / Number(orderItem.quantity)
              : 0;
          const soldAmount = deliveredChargeableQuantity * itemNetPerPaidUnit;

          const itemAggregate = aggregate.get(itemEntry.productId) ?? {
            returned: 0,
            damaged: 0,
            delivered: 0,
            soldAmount: 0,
          };

          aggregate.set(itemEntry.productId, {
            returned: itemAggregate.returned + returnedQuantity,
            damaged: itemAggregate.damaged + damagedQuantity,
            delivered: itemAggregate.delivered + deliveredQuantity,
            soldAmount: itemAggregate.soldAmount + soldAmount,
          });

          await manager.update(OrderItem, orderItem.id, {
            deliveredQuantity,
            returnedQuantity,
            damagedQuantity,
          });
        }

        const calculatedSettlement = this.calculateOrderSettlement(order);
        const nextStatus =
          totalReturned + totalDamaged === 0
            ? OrderStatus.DELIVERED
            : calculatedSettlement.deliveredQuantity > 0
              ? OrderStatus.PARTIALLY_DELIVERED
              : OrderStatus.RETURNED_PARTIAL;

        await manager.update(Order, order.id, {
          status: nextStatus,
          actualSoldAmount: calculatedSettlement.finalSoldAmount,
          dueAmount: Math.max(
            0,
            calculatedSettlement.finalSoldAmount - Number(order.advancePaid || 0),
          ),
          deliveredAt: new Date(),
        });

        await manager.update(DispatchBatchOrder, batchOrder.id, {
          finalSoldAmount: calculatedSettlement.finalSoldAmount,
          dueAmount: Math.max(
            0,
            calculatedSettlement.finalSoldAmount - Number(order.advancePaid || 0),
          ),
        });
      }

      for (const batchItem of batch.items) {
        const next = aggregate.get(batchItem.productId) ?? {
          returned: 0,
          damaged: 0,
          delivered: Number(batchItem.totalDispatchedQty),
          soldAmount: Number(batchItem.estimatedAmount),
        };

        await manager.update(DispatchBatchItem, batchItem.id, {
          totalReturnedQty: next.returned,
          totalDamagedQty: next.damaged,
          totalDeliveredQty: next.delivered,
          finalSoldAmount: next.soldAmount,
        });
      }

      const refreshed = await this.getDispatchBatch(id);
      const metrics = refreshed.metrics;

      await manager.update(DispatchBatch, id, {
        status: DispatchBatchStatus.RETURN_PENDING,
        returnsRecordedAt: new Date(),
        returnAdjustedValue:
          Number(metrics.grossDispatchedValue) - Number(metrics.finalSoldValue),
        finalSoldValue: metrics.finalSoldValue,
      });

      return this.getDispatchBatch(id);
    });
  }

  async settleBatch(id: number, dto: SettleDispatchBatchDto) {
    const batch = await this.getDispatchBatch(id);
    if (batch.status === DispatchBatchStatus.SETTLED) {
      throw new BadRequestException('Batch already settled. No changes allowed.');
    }

    if (
      ![
        DispatchBatchStatus.DISPATCHED,
        DispatchBatchStatus.RETURN_PENDING,
        DispatchBatchStatus.PARTIALLY_SETTLED,
      ].includes(batch.status)
    ) {
      throw new BadRequestException('Batch is not ready for settlement');
    }

    return this.dataSource.transaction(async (manager) => {
      let totalCollected = 0;
      let totalDue = 0;
      let shortageOrExcess = 0;

      for (const collectionInput of dto.collections) {
        const batchOrder = batch.orders.find(
          (item) => item.orderId === collectionInput.orderId,
        );
        if (!batchOrder) {
          throw new BadRequestException(
            `Order #${collectionInput.orderId} is not part of this batch`,
          );
        }

        const order = batchOrder.order;
        const calculated = this.calculateOrderSettlement(order);
        const payableAfterAdvance = Math.max(
          0,
          calculated.finalSoldAmount - Number(order.advancePaid || 0),
        );
        const collectedAmount = Number(collectionInput.collectedAmount || 0);
        const dueAmount = Math.max(0, payableAfterAdvance - collectedAmount);
        const orderShortageOrExcess = Number(
          (collectedAmount - payableAfterAdvance).toFixed(2),
        );

        await manager.save(
          manager.create(CashCollection, {
            batchId: id,
            batchOrderId: batchOrder.id,
            amount: collectedAmount,
            paymentMode: collectionInput.paymentMode || 'CASH',
            note: collectionInput.note,
          }),
        );

        await manager.update(DispatchBatchOrder, batchOrder.id, {
          collectedAmount,
          dueAmount,
          shortageOrExcess: orderShortageOrExcess,
          isSettled: true,
        });

        await manager.update(Order, order.id, {
          actualSoldAmount: calculated.finalSoldAmount,
          collectedAmount,
          dueAmount,
          settlementNote: collectionInput.note,
          settledAt: dueAmount === 0 ? new Date() : undefined,
          status:
            dueAmount === 0
              ? OrderStatus.SETTLED
              : calculated.deliveredQuantity ===
                  calculated.dispatchedQuantity
                ? OrderStatus.DELIVERED
                : OrderStatus.PARTIALLY_DELIVERED,
        });

        // Update Due Record via shared service
        await this.duesService.upsertDue(order, dueAmount, manager);

        totalCollected += collectedAmount;
        totalDue += dueAmount;
        shortageOrExcess += orderShortageOrExcess;
      }

      const finalSoldValue = batch.orders.reduce((sum, batchOrder) => {
        const order = batchOrder.order;
        return sum + this.calculateOrderSettlement(order).finalSoldAmount;
      }, 0);

      await manager.update(DispatchBatch, id, {
        status:
          totalDue === 0
            ? DispatchBatchStatus.SETTLED
            : DispatchBatchStatus.PARTIALLY_SETTLED,
        finalSoldValue,
        totalAdvancePaid: batch.orders.reduce(
          (sum, item) => sum + Number(item.order.advancePaid || 0),
          0,
        ),
        totalCollectedAmount: totalCollected,
        totalDueAmount: totalDue,
        shortageOrExcess,
        settlementNote: dto.note,
        settledAt: new Date(),
      });

      return this.getDispatchBatch(id);
    });
  }

  async getMorningReport(id: number) {
    const batch = await this.getDispatchBatch(id);

    return {
      batchId: batch.id,
      batchNo: batch.batchNo,
      dispatchDate: batch.dispatchDate,
      deliveryPerson: batch.deliveryPerson,
      company: batch.company,
      route: batch.route,
      marketArea: batch.marketArea,
      selectedOrders: batch.orders.map((batchOrder) => ({
        orderId: batchOrder.order.id,
        shopName: batchOrder.order.shop?.name ?? 'Direct Order',
        orderDate: batchOrder.order.orderDate,
        status: batchOrder.order.status,
        estimatedAmount: batchOrder.estimatedAmount,
        items: batchOrder.order.items.map((item) => ({
          productName: item.product.name,
          quantity: Number(item.quantity),
          freeQuantity: Number(item.freeQuantity || 0),
          dispatchedQuantity: Number(item.quantity) + Number(item.freeQuantity || 0),
          lineTotal: item.lineTotal,
        })),
      })),
      itemWiseTotals: batch.items.map((item) => ({
        productName: item.product.name,
        quantity: item.totalDispatchedQty,
        estimatedAmount: item.estimatedAmount,
      })),
      estimatedTotalAmount: batch.grossDispatchedValue,
    };
  }

  async getFinalReport(id: number) {
    const batch = await this.getDispatchBatch(id);
    const metrics = batch.metrics;

    return {
      batchId: batch.id,
      batchNo: batch.batchNo,
      dispatchDate: batch.dispatchDate,
      deliveryPerson: batch.deliveryPerson,
      route: batch.route,
      company: batch.company,
      summary: metrics,
      orders: batch.orders.map((batchOrder) => {
        const settlement = this.calculateOrderSettlement(batchOrder.order);

        return {
          orderId: batchOrder.order.id,
          shopName: batchOrder.order.shop?.name ?? 'Direct Order',
          status: batchOrder.order.status,
          advancePaid: batchOrder.order.advancePaid,
          collectedAmount: batchOrder.collectedAmount,
          dueAmount: batchOrder.dueAmount,
          shortageOrExcess: batchOrder.shortageOrExcess,
          calculations: settlement,
          items: batchOrder.order.items.map((item) => ({
            productName: item.product.name,
            dispatchedQuantity:
              Number(item.quantity) + Number(item.freeQuantity || 0),
            returnedQuantity: item.returnedQuantity,
            damagedQuantity: item.damagedQuantity,
            deliveredQuantity: item.deliveredQuantity,
          })),
        };
      }),
      productSummary: batch.items.map((item) => ({
        productName: item.product.name,
        dispatched: item.totalDispatchedQty,
        returned: item.totalReturnedQty,
        damaged: item.totalDamagedQty,
        delivered: item.totalDeliveredQty,
        finalSoldAmount: item.finalSoldAmount,
      })),
    };
  }

  async getReports(query: QueryDispatchBatchesDto) {
    const batches = await this.getDispatchBatches(query);

    return {
      filters: query,
      rows: batches.map((batch) => ({
        id: batch.id,
        batchNo: batch.batchNo,
        dispatchDate: batch.dispatchDate,
        status: batch.status,
        deliveryPerson: batch.deliveryPerson?.name,
        totalOrders: batch.totalOrders,
        grossDispatchedValue: batch.grossDispatchedValue,
        finalSoldValue: batch.finalSoldValue,
        totalCollectedAmount: batch.totalCollectedAmount,
        totalDueAmount: batch.totalDueAmount,
      })),
      totals: batches.reduce(
        (acc, batch) => ({
          grossDispatchedValue:
            acc.grossDispatchedValue + Number(batch.grossDispatchedValue || 0),
          finalSoldValue: acc.finalSoldValue + Number(batch.finalSoldValue || 0),
          totalCollectedAmount:
            acc.totalCollectedAmount + Number(batch.totalCollectedAmount || 0),
          totalDueAmount: acc.totalDueAmount + Number(batch.totalDueAmount || 0),
        }),
        {
          grossDispatchedValue: 0,
          finalSoldValue: 0,
          totalCollectedAmount: 0,
          totalDueAmount: 0,
        },
      ),
    };
  }

  async getDashboard(date?: string) {
    const queryDate = date || new Date().toISOString().split('T')[0];
    
    // Total batches (all time)
    const allBatches = await this.getDispatchBatches({});
    // Today's batches
    const todayBatches = await this.getDispatchBatches({ dispatchDate: queryDate });

    const calcSum = (arr: any[], key: string) => arr.reduce((sum, item) => sum + Number(item[key] || 0), 0);
    const filterStatus = (arr: any[], statuses: string[]) => arr.filter(b => statuses.includes(b.status));

    return {
      totalBatches: allBatches.length,
      todayBatches: todayBatches.length,
      draftBatches: filterStatus(allBatches, [DispatchBatchStatus.DRAFT, DispatchBatchStatus.PRINTED]).length,
      dispatchedBatches: filterStatus(allBatches, [DispatchBatchStatus.DISPATCHED]).length,
      returnPending: filterStatus(allBatches, [DispatchBatchStatus.RETURN_PENDING]).length,
      settledBatches: filterStatus(allBatches, [DispatchBatchStatus.SETTLED, DispatchBatchStatus.PARTIALLY_SETTLED]).length,
      todaySettled: todayBatches.filter(b => b.settledAt && isTodayBD(b.settledAt)).length, // rough estimate if settledAt is present
      
      totalDispatchAmount: calcSum(allBatches, 'grossDispatchedValue'),
      todayDispatchAmount: calcSum(todayBatches, 'grossDispatchedValue'),
      
      totalFinalSold: calcSum(allBatches, 'finalSoldValue'),
      todayFinalSold: calcSum(todayBatches, 'finalSoldValue'),
      
      totalReturnedQty: allBatches.reduce((sum, b) => sum + (b.items?.reduce((s: any, i: any) => s + Number(i.totalReturnedQty || 0), 0) || 0), 0),
      todayReturnedQty: todayBatches.reduce((sum, b) => sum + (b.items?.reduce((s: any, i: any) => s + Number(i.totalReturnedQty || 0), 0) || 0), 0),
      
      totalCollected: calcSum(allBatches, 'totalCollectedAmount'),
      todayCollected: calcSum(todayBatches, 'totalCollectedAmount'),
      
      totalDue: calcSum(allBatches, 'totalDueAmount'),
      todayDue: calcSum(todayBatches, 'totalDueAmount'),

      // Fallback old keys
      grossDispatchedValue: calcSum(allBatches, 'grossDispatchedValue'),
      finalSoldValue: calcSum(allBatches, 'finalSoldValue'),
      totalDueAmount: calcSum(allBatches, 'totalDueAmount'),
      totalCollections: calcSum(allBatches, 'totalCollectedAmount'),
    };
  }

  private async generateBatchNo(manager: DataSource['manager'], date: string) {
    const count = await manager.count(DispatchBatch, {
      where: { dispatchDate: new Date(date) },
    });

    const compactDate = date.replaceAll('-', '');
    return `DB-${compactDate}-${String(count + 1).padStart(3, '0')}`;
  }

  private async getActiveBatchOrderIds() {
    const batchOrders = await this.batchOrderRepository.find({
      relations: ['batch'],
    });

    return new Set(
      batchOrders
        .filter((batchOrder) =>
          ![DispatchBatchStatus.SETTLED, DispatchBatchStatus.CANCELLED].includes(
            batchOrder.batch.status,
          ),
        )
        .map((batchOrder) => batchOrder.orderId),
    );
  }

  private calculateBatchSettlement(batch: DispatchBatch) {
    const orderCalculations = batch.orders.map((batchOrder) =>
      this.calculateOrderSettlement(batchOrder.order),
    );

    const grossDispatchedValue = batch.orders.reduce(
      (sum, batchOrder) => sum + Number(batchOrder.estimatedAmount || 0),
      0,
    );
    const finalSoldValue = orderCalculations.reduce(
      (sum, calc) => sum + calc.finalSoldAmount,
      0,
    );
    const totalAdvancePaid = batch.orders.reduce(
      (sum, batchOrder) => sum + Number(batchOrder.order.advancePaid || 0),
      0,
    );
    const totalCollectedAmount = batch.orders.reduce(
      (sum, batchOrder) => sum + Number(batchOrder.collectedAmount || 0),
      0,
    );
    const totalDueAmount = batch.orders.reduce(
      (sum, batchOrder) => sum + Number(batchOrder.dueAmount || 0),
      0,
    );

    return {
      grossDispatchedValue: Number(grossDispatchedValue.toFixed(2)),
      returnAdjustedValue: Number((grossDispatchedValue - finalSoldValue).toFixed(2)),
      finalSoldValue: Number(finalSoldValue.toFixed(2)),
      totalAdvancePaid: Number(totalAdvancePaid.toFixed(2)),
      totalCollectedAmount: Number(totalCollectedAmount.toFixed(2)),
      totalDueAmount: Number(totalDueAmount.toFixed(2)),
      shortageOrExcess: Number((totalCollectedAmount - Math.max(0, finalSoldValue - totalAdvancePaid)).toFixed(2)),
      orders: orderCalculations,
    };
  }

  private calculateOrderSettlement(order: Order): CalculatedOrderSettlement {
    let dispatchedQuantity = 0;
    let returnedQuantity = 0;
    let damagedQuantity = 0;
    let deliveredQuantity = 0;
    let deliveredSubtotal = 0;

    for (const item of order.items) {
      const dispatched = Number(item.quantity) + Number(item.freeQuantity || 0);
      const returned = Number(item.returnedQuantity || 0);
      const damaged = Number(item.damagedQuantity || 0);
      const delivered = dispatched - returned - damaged;
      const deliveredChargeableQuantity = dispatched > 0 
        ? delivered * (Number(item.quantity) / dispatched)
        : 0;
      const itemNetPerPaidUnit =
        Number(item.quantity) > 0
          ? Number(item.lineTotal) / Number(item.quantity)
          : 0;

      dispatchedQuantity += dispatched;
      returnedQuantity += returned;
      damagedQuantity += damaged;
      deliveredQuantity += delivered;
      deliveredSubtotal += deliveredChargeableQuantity * itemNetPerPaidUnit;
    }

    const invoiceDiscountApplied =
      Number(order.subtotal) > 0
        ? Number(order.discountAmount || 0) *
          (deliveredSubtotal / Number(order.subtotal))
        : 0;

    const finalSoldAmount = Math.max(
      0,
      Number((deliveredSubtotal - invoiceDiscountApplied).toFixed(2)),
    );

    return {
      orderId: order.id,
      dispatchedQuantity: Number(dispatchedQuantity.toFixed(2)),
      returnedQuantity: Number(returnedQuantity.toFixed(2)),
      damagedQuantity: Number(damagedQuantity.toFixed(2)),
      deliveredQuantity: Number(deliveredQuantity.toFixed(2)),
      deliveredSubtotal: Number(deliveredSubtotal.toFixed(2)),
      invoiceDiscountApplied: Number(invoiceDiscountApplied.toFixed(2)),
      finalSoldAmount,
    };
  }
}
