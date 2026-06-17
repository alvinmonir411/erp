import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Due } from '../dues/entities/due.entity';
import { DuesService } from '../dues/dues.service';
import { Order } from '../orders/entities/order.entity';
import { DiscountType, OrderStatus } from '../orders/orders.constants';
import { Shop } from '../shops/entities/shop.entity';
import { CreateManualDueDto } from './dto/create-manual-due.dto';

type AuthenticatedUser = {
  id?: string;
  sub?: string;
  name?: string;
  username?: string;
  role?: Role;
  allowedRouteIds?: number[] | string | null;
};

export type ManualDueResult = {
  order: Order;
  due: Due;
  shop: Shop;
  shopTotalDue: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: OrderStatus.MANUAL_DUE;
};

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopsRepository: Repository<Shop>,
    private readonly duesService: DuesService,
    private readonly dataSource: DataSource,
  ) {}

  async addManualDue(
    dto: CreateManualDueDto,
    user: AuthenticatedUser,
  ): Promise<ManualDueResult> {
    const shopId = this.parsePositiveInteger(dto.shopId, 'Shop');
    const amount = this.normalizeMoney(dto.amount);
    const reason = dto.reason.trim();
    const note = dto.note?.trim();

    if (!reason) {
      throw new BadRequestException('Reason is required.');
    }

    const userId = user.id || user.sub;
    if (!userId) {
      throw new ForbiddenException('Authenticated user id is required.');
    }

    const shop = await this.shopsRepository.findOne({
      where: { id: shopId },
      relations: ['route'],
    });

    if (!shop) {
      throw new NotFoundException('Shop not found.');
    }

    if (!shop.companyId) {
      throw new BadRequestException('Shop company is missing.');
    }

    if (!shop.routeId) {
      throw new BadRequestException('Shop route is missing.');
    }

    this.ensureRouteAccess(shop, user);

    const ledgerNote = this.buildLedgerNote(reason, note);

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const order = manager.create(Order, {
        orderDate: new Date(),
        companyId: shop.companyId,
        routeId: shop.routeId,
        shopId: shop.id,
        subtotal: amount,
        discountAmount: 0,
        discountType: DiscountType.FIXED,
        discountValue: 0,
        grandTotal: amount,
        advancePaid: 0,
        actualSoldAmount: amount,
        collectedAmount: 0,
        dueAmount: amount,
        settledAt: new Date(),
        isLocked: true,
        status: OrderStatus.MANUAL_DUE,
        note: ledgerNote,
        settlementNote: ledgerNote,
        createdBy: user.name || user.username || 'Admin',
        createdById: userId,
        createdByRole: user.role || Role.ADMIN,
      });

      const savedOrder = await manager.save(order);
      const due = await this.duesService.upsertDue(
        savedOrder,
        amount,
        manager,
        ledgerNote,
      );

      if (!due) {
        throw new BadRequestException('Manual due could not be recorded.');
      }

      const reloadedOrder = await manager.findOne(Order, {
        where: { id: savedOrder.id },
        relations: ['company', 'route', 'shop'],
      });

      const total = await manager
        .createQueryBuilder(Due, 'due')
        .select('COALESCE(SUM(due.remainingDue), 0)', 'totalDue')
        .where('due.shopId = :shopId', { shopId: shop.id })
        .andWhere('due.remainingDue > 0')
        .getRawOne<{ totalDue: string | number | null }>();

      return {
        order: reloadedOrder || savedOrder,
        due,
        shop,
        shopTotalDue: Number(total?.totalDue || 0),
        totalAmount: amount,
        paidAmount: 0,
        dueAmount: amount,
        status: OrderStatus.MANUAL_DUE,
      };
    });
  }

  private parsePositiveInteger(value: string, label: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(`${label} id must be a positive integer.`);
    }

    return parsed;
  }

  private normalizeMoney(value: number): number {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0.');
    }

    return Number(amount.toFixed(2));
  }

  private buildLedgerNote(reason: string, note?: string): string {
    return note ? `Manual due: ${reason}\n${note}` : `Manual due: ${reason}`;
  }

  private ensureRouteAccess(shop: Shop, user: AuthenticatedUser): void {
    if (user.role !== Role.MANAGER || !user.allowedRouteIds) {
      return;
    }

    const allowedRouteIds = Array.isArray(user.allowedRouteIds)
      ? user.allowedRouteIds
      : String(user.allowedRouteIds)
          .split(',')
          .map((routeId) => Number(routeId.trim()))
          .filter((routeId) => Number.isInteger(routeId));

    if (allowedRouteIds.length > 0 && !allowedRouteIds.includes(shop.routeId)) {
      throw new ForbiddenException(
        'You do not have access to this shop route.',
      );
    }
  }
}
