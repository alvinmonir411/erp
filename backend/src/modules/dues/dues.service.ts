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
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

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
      .leftJoinAndSelect('due.route', 'route')
      .where('due.status != :paidStatus', { paidStatus: DueStatus.PAID })
      .orderBy('due.createdAt', 'DESC');

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
    return dues.map(due => ({
      ...due,
      deliveryManName: due.order?.assignedDeliveryMan?.name || due.order?.deliveryPerson?.name || null,
    }));
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

  async upsertByOrderId(orderId: number, dueAmount: number, note?: string) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['shop', 'route'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.upsertDue(order, dueAmount, this.dataSource.manager, note);
  }

  async upsertDue(
    order: Order,
    dueAmount: number,
    manager: any,
    note?: string,
  ) {
    if (dueAmount <= 0) {
      if (dueAmount < 0) {
        throw new BadRequestException('Due cannot be negative.');
      }
      // If due amount is explicitly 0, we can mark it as PAID or just not create it
      const due = await manager.findOne(Due, { where: { orderId: order.id } });
      if (due) {
        due.remainingDue = 0;
        due.status = DueStatus.PAID;
        await manager.save(due);
      }
      return due;
    }

    // Basic validations as requested
    if (!order.shopId) {
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
    // Note: do NOT subtract alreadyCollected here — the caller (settleOrder) already passes the
    // correctly-calculated net dueAmount after collection. Double-subtracting causes false rejections.
    const maxAllowed = Math.max(0, finalAmount - advance);

    if (dueAmount > maxAllowed + 0.01) {
      throw new BadRequestException(
        `Due amount cannot be greater than final amount. Max allowed is BDT ${maxAllowed}.`,
      );
    }

    let due = await manager.findOne(Due, { where: { orderId: order.id } });

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

    if (!due) {
      due = manager.create(Due, {
        orderId: order.id,
        shopId: order.shopId,
        routeId: order.routeId,
        srId: srId,
        srName: srName,
        dueAmount: dueAmount,
        paidAmount: 0,
        remainingDue: dueAmount,
        status: DueStatus.DUE,
        note: note,
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

      if (note) {
        due.note = note;
      }
    }

    await manager.save(due);
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
      .leftJoinAndSelect('due.route', 'route')
      .where('due.shopId = :shopId', { shopId });

    if (user.role === Role.SR) {
      query.andWhere('due.srId = :userId', { userId: user.id || user.sub });
    }

    const dues = await query.orderBy('due.createdAt', 'DESC').take(200).getMany();
    return dues.map(due => ({
      ...due,
      deliveryManName: due.order?.assignedDeliveryMan?.name || due.order?.deliveryPerson?.name || null,
    }));
  }
}
