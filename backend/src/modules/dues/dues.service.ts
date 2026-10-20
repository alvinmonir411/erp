import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Due, DueStatus } from './entities/due.entity';
import {
  DueCollection,
  CollectionStatus,
} from './entities/due-collection.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/orders.constants';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { Shop } from '../shops/entities/shop.entity';

@Injectable()
export class DuesService {
  constructor(
    @InjectRepository(Due)
    private readonly duesRepository: Repository<Due>,
    @InjectRepository(DueCollection)
    private readonly collectionsRepository: Repository<DueCollection>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(user: any) {
    const role = user.role;
    const userId = user.id || user.sub;

    const query = this.duesRepository
      .createQueryBuilder('due')
      .leftJoinAndSelect('due.order', 'order')
      .leftJoinAndSelect('order.assignedDeliveryMan', 'assignedDeliveryMan')
      .leftJoinAndSelect('order.deliveryPerson', 'deliveryPerson')
      .leftJoinAndSelect('order.company', 'orderCompany')
      .leftJoinAndSelect('due.shop', 'shop')
      .leftJoinAndSelect('shop.route', 'shopRoute')
      .leftJoinAndSelect('due.route', 'route')
      .leftJoinAndSelect('order.route', 'orderRoute')
      .where('due.status != :paidStatus', { paidStatus: DueStatus.PAID })
      .orderBy('due.dueDate', 'DESC', 'NULLS LAST')
      .addOrderBy('due.createdAt', 'DESC');

    if (role === Role.SR) {
      query.andWhere('due.srId = :userId', { userId });
    } else if (role === Role.MANAGER) {
      // Filter by manager's allowed routes if assigned
      if (user.allowedRouteIds && user.allowedRouteIds.length > 0) {
        query.andWhere('due.routeId IN (:...routeIds)', {
          routeIds: user.allowedRouteIds,
        });
      }
    } else if (role === Role.DELIVERY_MAN) {
      const person = await this.dataSource.manager.findOne(
        'delivery_people' as any,
        { where: { userId } } as any,
      );
      if (person) {
        query.andWhere('order.deliveryPersonId = :personId', {
          personId: (person as any).id,
        });
      } else {
        query.andWhere('due.id = -1');
      }
    }

    const dues = await query.take(200).getMany();
    return dues.map(due => {
      const resolvedRoute = due.shop?.route || due.route || due.order?.route || null;
      return {
        ...due,
        route: resolvedRoute,
        shop: due.shop
          ? {
              ...due.shop,
              route: due.shop.route || resolvedRoute,
            }
          : null,
        deliveryManName:
          due.order?.assignedDeliveryMan?.name ||
          due.order?.deliveryPerson?.name ||
          null,
      };
    });
  }

  async findPendingCollections(user: any) {
    const role = user.role;
    const userId = user.id || user.sub;

    const query = this.collectionsRepository
      .createQueryBuilder('collection')
      .leftJoinAndSelect('collection.order', 'order')
      .leftJoinAndSelect('collection.shop', 'shop')
      .where('collection.status = :status', {
        status: CollectionStatus.PENDING,
      })
      .orderBy('collection.createdAt', 'DESC');

    if (role === Role.SR) {
      query.andWhere('collection.srId = :userId', { userId });
    } else if (role === Role.MANAGER) {
      if (user.allowedRouteIds && user.allowedRouteIds.length > 0) {
        query.andWhere('collection.routeId IN (:...routeIds)', {
          routeIds: user.allowedRouteIds,
        });
      }
    } else if (role === Role.DELIVERY_MAN) {
      const person = await this.dataSource.manager.findOne(
        'delivery_people' as any,
        { where: { userId } } as any,
      );
      if (person) {
        query.andWhere('order.deliveryPersonId = :personId', {
          personId: (person as any).id,
        });
      } else {
        query.andWhere('collection.id = -1');
      }
    }

    return query.take(200).getMany();
  }

  async findCollections(user: any) {
    const role = user.role;
    const userId = user.id || user.sub;

    const query = this.collectionsRepository
      .createQueryBuilder('collection')
      .leftJoinAndSelect('collection.order', 'order')
      .leftJoinAndSelect('collection.shop', 'shop')
      .orderBy('collection.createdAt', 'DESC');

    if (role === Role.SR) {
      query.where('collection.srId = :userId', { userId });
    } else if (role === Role.MANAGER) {
      if (user.allowedRouteIds && user.allowedRouteIds.length > 0) {
        query.where('collection.routeId IN (:...routeIds)', {
          routeIds: user.allowedRouteIds,
        });
      }
    } else if (role === Role.DELIVERY_MAN) {
      const person = await this.dataSource.manager.findOne(
        'delivery_people' as any,
        { where: { userId } } as any,
      );
      if (person) {
        query.where('order.deliveryPersonId = :personId', {
          personId: (person as any).id,
        });
      } else {
        query.where('collection.id = -1');
      }
    }

    return query.take(200).getMany();
  }

  async findCollectionsByOrderId(orderId: number) {
    return this.collectionsRepository.find({
      where: { orderId },
      relations: ['shop'],
      order: { createdAt: 'DESC' },
    });
  }

  async collectDue(
    data: {
      orderId: number;
      amount: number;
      note?: string;
      collectionDate?: string;
    },
    user: any,
  ) {
    const due = await this.duesRepository.findOne({
      where: { orderId: data.orderId },
    });

    if (!due) {
      throw new NotFoundException('Due record not found for this order');
    }

    // Role check: SR can only collect own due
    if (user.role === Role.SR && due.srId !== (user.id || user.sub)) {
      throw new ConflictException(
        'You can only collect payments for your own assigned dues',
      );
    }

    if (data.amount <= 0) {
      throw new ConflictException('Collected amount must be greater than 0');
    }

    // Check pending collections to prevent over-collection
    const pendingAmount = await this.collectionsRepository
      .createQueryBuilder('c')
      .select('SUM(c.collectedAmount)', 'sum')
      .where('c.dueId = :dueId', { dueId: due.id })
      .andWhere('c.status = :status', { status: CollectionStatus.PENDING })
      .getRawOne();

    const totalPending = Number(pendingAmount?.sum || 0);
    const maxCollectable = due.remainingDue - totalPending;

    if (data.amount > maxCollectable) {
      throw new ConflictException(
        `Collected amount exceeds remaining balance. Remaining: ${due.remainingDue}, Pending: ${totalPending}, Max Allowed: ${maxCollectable}`,
      );
    }

    const collection = this.collectionsRepository.create({
      dueId: due.id,
      orderId: due.orderId,
      shopId: due.shopId,
      routeId: due.routeId,
      srId: user.id || user.sub,
      srName: user.name || user.username,
      collectedAmount: data.amount,
      collectionDate: data.collectionDate
        ? new Date(data.collectionDate)
        : new Date(),
      note: data.note,
      status: CollectionStatus.PENDING,
    });

    return this.collectionsRepository.save(collection);
  }

  async upsertByOrderId(
    orderId: number,
    dueAmount: number,
    note?: string,
    dueDate?: string,
  ) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['shop', 'route'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.upsertDue(
      order,
      dueAmount,
      this.dataSource.manager,
      note,
      undefined,
      dueDate,
    );
  }

  async upsertDue(
    order: Order,
    dueAmount: number,
    manager: any,
    note?: string,
    targetShopId?: number,
    dueDate?: string,
  ) {
    const finalShopId = targetShopId ?? order.shopId;

    if (dueAmount <= 0) {
      if (dueAmount < 0) {
        throw new BadRequestException('Due cannot be negative.');
      }
      // If due amount is explicitly 0, we can mark it as PAID or just not create it
      if (finalShopId) {
        const due = await manager.findOne(Due, { where: { orderId: order.id, shopId: finalShopId } });
        if (due) {
          due.remainingDue = 0;
          due.status = DueStatus.PAID;
          await manager.save(due);
        }
        return due;
      }
      return null;
    }

    // Basic validations as requested
    if (!finalShopId) {
      throw new BadRequestException('Shop is required before creating due.');
    }
    if (!order.createdById) {
      throw new BadRequestException('SR/order creator is missing.');
    }
    if (!order.routeId) {
      throw new BadRequestException('Route is missing.');
    }

    const finalAmount = Number(order.actualSoldAmount || order.grandTotal || 0);
    const advance = Number(order.advancePaid || 0);
    const maxAllowed = Math.max(0, finalAmount - advance);

    if (dueAmount > maxAllowed + 0.01) {
      throw new BadRequestException(
        `Due amount cannot be greater than final amount. Max allowed is BDT ${maxAllowed}.`,
      );
    }

    let srId = order.createdById;
    let srName = order.createdBy;

    // Resolve route's SR if order was created by an Admin/Manager
    if (order.createdByRole !== Role.SR || !srId) {
      try {
        const srUsers = await manager.getRepository(User).find({
          where: { role: Role.SR, status: 'ACTIVE' },
        });
        const srForRoute = srUsers.find((u: any) => {
          if (!u.allowedRouteIds) return false;
          return u.allowedRouteIds.map(Number).includes(Number(order.routeId));
        });
        if (srForRoute) {
          srId = srForRoute.id;
          srName = srForRoute.name;
        }
      } catch (err) {
        // Fallback to order details if lookups fail
      }
    }

    const dateStr = dueDate
      ? (typeof dueDate === 'string' && dueDate.includes('T')
          ? dueDate.split('T')[0]
          : String(dueDate).slice(0, 10))
      : undefined;
    const fallbackDate = order.orderDate
      ? (order.orderDate instanceof Date ? order.orderDate : new Date(order.orderDate))
      : undefined;
    const normalizedDueDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : fallbackDate;
    if (normalizedDueDate && Number.isNaN(normalizedDueDate.getTime())) {
      throw new BadRequestException('Invalid due date.');
    }

    let targetRouteId = order.routeId;
    if (finalShopId) {
      const shopRec = await manager.getRepository(Shop).findOne({ where: { id: finalShopId } });
      if (shopRec && shopRec.routeId) {
        targetRouteId = shopRec.routeId;
      }
    }

    let due = await manager.findOne(Due, {
      where: { orderId: order.id, shopId: finalShopId },
      lock: { mode: 'pessimistic_write' },
    });

    try {
      if (!due) {
        // Safe insert using QueryBuilder with OR UPDATE to handle concurrent insert race conditions
        await manager
          .createQueryBuilder()
          .insert()
          .into(Due)
          .values({
            orderId: order.id,
            shopId: finalShopId,
            routeId: targetRouteId || order.routeId,
            srId: srId,
            srName: srName,
            dueAmount: dueAmount,
            paidAmount: 0,
            remainingDue: dueAmount,
            status: DueStatus.DUE,
            note: note,
            dueDate: normalizedDueDate,
          })
          .orUpdate(
            ['dueAmount', 'remainingDue', 'status', 'note', 'dueDate', 'routeId'],
            ['orderId', 'shopId']
          )
          .execute();

        due = await manager.findOne(Due, {
          where: { orderId: order.id, shopId: finalShopId },
        });
      } else {
        // Update existing due
        due.dueAmount = dueAmount;
        due.remainingDue = Math.max(0, dueAmount - Number(due.paidAmount || 0));

        if (due.remainingDue <= 0) {
          due.status = DueStatus.PAID;
          due.remainingDue = 0;
        } else if (due.paidAmount > 0) {
          due.status = DueStatus.PARTIAL;
        } else {
          due.status = DueStatus.DUE;
        }

        if (targetRouteId) {
          due.routeId = targetRouteId;
        }
        if (note) {
          due.note = note;
        }
        if (normalizedDueDate) {
          due.dueDate = normalizedDueDate;
        } else if (!due.dueDate && fallbackDate) {
          due.dueDate = fallbackDate;
        }
        await manager.save(due);
      }
    } catch (err) {
      // Fallback update in case of concurrency anomalies
      due = await manager.findOne(Due, {
        where: { orderId: order.id, shopId: finalShopId },
      });
      if (due) {
        due.dueAmount = dueAmount;
        due.remainingDue = Math.max(0, dueAmount - Number(due.paidAmount || 0));
        due.status = due.remainingDue <= 0 ? DueStatus.PAID : (due.paidAmount > 0 ? DueStatus.PARTIAL : DueStatus.DUE);
        if (note) due.note = note;
        if (normalizedDueDate) due.dueDate = normalizedDueDate;
        await manager.save(due);
      }
    }

    return due;
  }

  async approveCollection(id: number, adminUser: any) {
    const collection = await this.collectionsRepository.findOne({
      where: { id },
      relations: ['due'],
    });

    if (!collection) {
      throw new NotFoundException('Collection request not found');
    }

    if (collection.status !== CollectionStatus.PENDING) {
      throw new ConflictException('Collection request is already processed');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update Collection Status
      collection.status = CollectionStatus.APPROVED;
      collection.approvedBy = adminUser.name || adminUser.username;
      collection.approvedAt = new Date();
      await queryRunner.manager.save(collection);

      // Update Due Record
      const due = collection.due;
      due.paidAmount =
        Number(due.paidAmount) + Number(collection.collectedAmount);
      due.remainingDue = Math.max(0, Number(due.dueAmount) - due.paidAmount);

      if (due.remainingDue <= 0) {
        due.status = DueStatus.PAID;
        due.remainingDue = 0;
      } else if (due.paidAmount > 0) {
        due.status = DueStatus.PARTIAL;
      }

      await queryRunner.manager.save(due);

      // Also update the Order collectedAmount and dueAmount for consistency
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: due.orderId },
      });
      if (order) {
        order.collectedAmount =
          Number(order.collectedAmount) + Number(collection.collectedAmount);
        order.dueAmount = Math.max(
          0,
          Number(order.actualSoldAmount) -
            Number(order.advancePaid || 0) -
            Number(order.collectedAmount),
        );

        if (order.dueAmount <= 0) {
          order.dueAmount = 0;
          order.status = 'SETTLED' as any;
        }
        await queryRunner.manager.save(order);
      }

      await queryRunner.commitTransaction();
      return collection;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectCollection(id: number, data: { reason: string }, adminUser: any) {
    const collection = await this.collectionsRepository.findOne({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException('Collection request not found');
    }

    if (collection.status !== CollectionStatus.PENDING) {
      throw new ConflictException('Collection request is already processed');
    }

    collection.status = CollectionStatus.REJECTED;
    collection.rejectedReason = data.reason;
    return this.collectionsRepository.save(collection);
  }

  async revertCollection(
    id: number,
    data: { reason?: string },
    adminUser: any,
  ) {
    const collection = await this.collectionsRepository.findOne({
      where: { id },
      relations: ['due'],
    });

    if (!collection) {
      throw new NotFoundException('Collection request not found');
    }

    if (collection.status === CollectionStatus.PENDING) {
      throw new ConflictException('Collection request is already pending');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const amountToReverse = Number(collection.collectedAmount || 0);

      // If it was APPROVED, reverse the financial effects on Due and Order
      if (collection.status === CollectionStatus.APPROVED && amountToReverse > 0) {
        const due =
          collection.due ||
          (await queryRunner.manager.findOne(Due, {
            where: { id: collection.dueId },
          }));

        if (due) {
          due.paidAmount = Math.max(0, Number(due.paidAmount || 0) - amountToReverse);
          due.remainingDue = Math.max(0, Number(due.dueAmount || 0) - due.paidAmount);

          if (due.paidAmount <= 0) {
            due.status = DueStatus.DUE;
          } else if (due.remainingDue > 0) {
            due.status = DueStatus.PARTIAL;
          } else {
            due.status = DueStatus.PAID;
          }

          await queryRunner.manager.save(due);
        }

        const order = await queryRunner.manager.findOne(Order, {
          where: { id: collection.orderId },
        });

        if (order) {
          order.collectedAmount = Math.max(
            0,
            Number(order.collectedAmount || 0) - amountToReverse,
          );
          const finalAmt = Number(order.actualSoldAmount || order.grandTotal || 0);
          const adv = Number(order.advancePaid || 0);
          order.dueAmount = Math.max(
            0,
            finalAmt - adv - Number(order.collectedAmount || 0),
          );

          if (order.dueAmount > 0.01) {
            order.status = OrderStatus.PARTIAL_DUE;
          } else {
            order.status = OrderStatus.SETTLED;
          }

          await queryRunner.manager.save(order);
        }
      }

      // Reset collection status back to PENDING for review, correction, or rejection
      const previousStatus = collection.status;
      collection.status = CollectionStatus.PENDING;
      collection.approvedBy = null as any;
      collection.approvedAt = null as any;
      collection.rejectedReason = null as any;

      const auditMsg = ` [REVERTED: Reverted from ${previousStatus} by ${adminUser.name || adminUser.username || 'Admin'} on ${new Date().toISOString()}${data?.reason ? ` - Reason: ${data.reason}` : ''}]`;
      collection.note = (collection.note || '') + auditMsg;

      const saved = await queryRunner.manager.save(collection);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async editCollection(
    id: number,
    data: {
      collectedAmount?: number;
      collectionDate?: string;
      note?: string;
    },
    adminUser: any,
  ) {
    const collection = await this.collectionsRepository.findOne({
      where: { id },
      relations: ['due'],
    });

    if (!collection) {
      throw new NotFoundException('Collection request not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const oldAmount = Number(collection.collectedAmount || 0);
      const newAmount =
        data.collectedAmount !== undefined
          ? Number(data.collectedAmount)
          : oldAmount;

      if (newAmount <= 0) {
        throw new BadRequestException('Collection amount must be greater than 0');
      }

      const diff = newAmount - oldAmount;

      // If already APPROVED, adjust due and order balance by the diff
      if (collection.status === CollectionStatus.APPROVED && diff !== 0) {
        const due =
          collection.due ||
          (await queryRunner.manager.findOne(Due, {
            where: { id: collection.dueId },
          }));

        if (due) {
          const newDuePaid = Number(due.paidAmount || 0) + diff;
          if (newDuePaid < 0) {
            throw new BadRequestException(
              'Adjustment would result in negative paid amount on Due',
            );
          }
          due.paidAmount = newDuePaid;
          due.remainingDue = Math.max(0, Number(due.dueAmount || 0) - due.paidAmount);

          if (due.remainingDue <= 0) {
            due.status = DueStatus.PAID;
            due.remainingDue = 0;
          } else if (due.paidAmount > 0) {
            due.status = DueStatus.PARTIAL;
          } else {
            due.status = DueStatus.DUE;
          }

          await queryRunner.manager.save(due);
        }

        const order = await queryRunner.manager.findOne(Order, {
          where: { id: collection.orderId },
        });

        if (order) {
          order.collectedAmount = Math.max(
            0,
            Number(order.collectedAmount || 0) + diff,
          );
          const finalAmt = Number(order.actualSoldAmount || order.grandTotal || 0);
          const adv = Number(order.advancePaid || 0);
          order.dueAmount = Math.max(
            0,
            finalAmt - adv - Number(order.collectedAmount || 0),
          );

          if (order.dueAmount <= 0.01) {
            order.dueAmount = 0;
            order.status = OrderStatus.SETTLED;
          } else {
            order.status = OrderStatus.PARTIAL_DUE;
          }

          await queryRunner.manager.save(order);
        }
      }

      // Update collection fields
      collection.collectedAmount = newAmount;
      if (data.collectionDate) {
        collection.collectionDate = new Date(data.collectionDate);
      }
      if (data.note !== undefined) {
        collection.note = data.note;
      }

      const auditNote = ` [EDITED by ${adminUser.name || adminUser.username || 'Admin'} on ${new Date().toISOString()}]`;
      if (!collection.note?.includes('EDITED by')) {
        collection.note = (collection.note || '') + auditNote;
      }

      const saved = await queryRunner.manager.save(collection);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getSRDueSummary() {
    return this.duesRepository
      .createQueryBuilder('due')
      .select('due.srName', 'srName')
      .addSelect('due.srId', 'srId')
      .addSelect('SUM(due.dueAmount)', 'totalDue')
      .addSelect('SUM(due.paidAmount)', 'totalPaid')
      .addSelect('SUM(due.remainingDue)', 'remainingDue')
      .groupBy('due.srId')
      .addGroupBy('due.srName')
      .getRawMany();
  }

  async getStats(user: any) {
    const query = this.duesRepository
      .createQueryBuilder('due')
      .select('SUM(due.dueAmount)', 'totalDue')
      .addSelect('SUM(due.paidAmount)', 'totalPaid')
      .addSelect('SUM(due.remainingDue)', 'totalRemaining');

    if (user.role === Role.SR) {
      query.where('due.srId = :userId', { userId: user.id || user.sub });
    } else if (user.role === Role.MANAGER) {
      if (user.allowedRouteIds && user.allowedRouteIds.length > 0) {
        query.where('due.routeId IN (:...routeIds)', {
          routeIds: user.allowedRouteIds,
        });
      }
    }

    const mainStats = await query.getRawOne();

    const pendingCollections = await this.collectionsRepository
      .createQueryBuilder('c')
      .select('SUM(c.collectedAmount)', 'sum')
      .where('c.status = :status', { status: CollectionStatus.PENDING });

    if (user.role === Role.SR) {
      pendingCollections.andWhere('c.srId = :userId', {
        userId: user.id || user.sub,
      });
    } else if (user.role === Role.MANAGER) {
      if (user.allowedRouteIds && user.allowedRouteIds.length > 0) {
        pendingCollections.andWhere('c.routeId IN (:...routeIds)', {
          routeIds: user.allowedRouteIds,
        });
      }
    }

    const pending = await pendingCollections.getRawOne();

    return {
      totalDue: Number(mainStats.totalDue || 0),
      totalPaid: Number(mainStats.totalPaid || 0),
      totalRemaining: Number(mainStats.totalRemaining || 0),
      pendingApproval: Number(pending.sum || 0),
    };
  }

  async findShopDues(shopId: number, user: any) {
    const query = this.duesRepository
      .createQueryBuilder('due')
      .leftJoinAndSelect('due.order', 'order')
      .leftJoinAndSelect('order.assignedDeliveryMan', 'assignedDeliveryMan')
      .leftJoinAndSelect('order.deliveryPerson', 'deliveryPerson')
      .leftJoinAndSelect('order.company', 'orderCompany')
      .leftJoinAndSelect('due.shop', 'shop')
      .leftJoinAndSelect('shop.route', 'shopRoute')
      .leftJoinAndSelect('due.route', 'route')
      .leftJoinAndSelect('order.route', 'orderRoute')
      .where('due.shopId = :shopId', { shopId });

    if (user.role === Role.SR) {
      query.andWhere('due.srId = :userId', { userId: user.id || user.sub });
    }

    const dues = await query
      .orderBy('due.dueDate', 'DESC', 'NULLS LAST')
      .addOrderBy('due.createdAt', 'DESC')
      .take(200)
      .getMany();
    return dues.map(due => {
      const resolvedRoute = due.shop?.route || due.route || due.order?.route || null;
      return {
        ...due,
        route: resolvedRoute,
        shop: due.shop
          ? {
              ...due.shop,
              route: due.shop.route || resolvedRoute,
            }
          : null,
        deliveryManName:
          due.order?.assignedDeliveryMan?.name ||
          due.order?.deliveryPerson?.name ||
          null,
      };
    });
  }
}
