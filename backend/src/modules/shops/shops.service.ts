import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from '../routes/entities/route.entity';
import { CreateShopDto } from './dto/create-shop.dto';
import { QueryShopsDto } from './dto/query-shops.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { Shop } from './entities/shop.entity';

@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopsRepository: Repository<Shop>,
    @InjectRepository(Route)
    private readonly routesRepository: Repository<Route>,
  ) {}

  async create(createShopDto: CreateShopDto, user?: any) {
    const route = await this.findRouteOrFail(createShopDto.routeId);
    this.ensureRouteIsActive(route);
    await this.ensureUniqueShopName(createShopDto.routeId, createShopDto.name);

    const shop = this.shopsRepository.create({
      ...createShopDto,
      ownerName: createShopDto.ownerName ?? null,
      phone: createShopDto.phone ?? null,
      address: createShopDto.address ?? null,
      isActive: createShopDto.isActive ?? true,
      createdById: user ? (user.id || user.sub) : null,
    });

    return this.shopsRepository.save(shop);
  }

  async findAll(query: QueryShopsDto, user?: any) {
    const queryBuilder = this.shopsRepository
      .createQueryBuilder('shop')
      .leftJoinAndSelect('shop.route', 'route')
      .orderBy('shop.name', 'ASC');

    if (query.routeId) {
      queryBuilder.andWhere('shop.routeId = :routeId', {
        routeId: query.routeId,
      });
    }

    if (query.companyId) {
      queryBuilder.andWhere('shop.companyId = :companyId', {
        companyId: query.companyId,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(shop.name ILIKE :search OR shop.ownerName ILIKE :search OR route.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('shop.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    // 1. Fetch matching info for summary totals
    const allMatchingShops = await queryBuilder
      .select(['shop.id', 'shop.isActive'])
      .getMany();

    const totalMatching = allMatchingShops.length;
    const activeMatching = allMatchingShops.filter(s => s.isActive).length;
    const allMatchingIds = allMatchingShops.map(s => s.id);

    let globalTotalDue = 0;
    if (allMatchingIds.length > 0) {
      let globalDueQuery = `SELECT SUM("remainingDue") as "totalDue" 
         FROM dues 
         WHERE "shopId" IN (${allMatchingIds.join(',')}) 
         AND status IN ('DUE', 'PARTIAL') 
         AND "remainingDue" > 0`;

      if (user) {
        if (user.role === 'SR') {
          globalDueQuery += ` AND "srId" = '${user.id || user.sub}'`;
        } else if (user.role === 'MANAGER' && user.allowedRouteIds && user.allowedRouteIds.length > 0) {
          globalDueQuery += ` AND "routeId" IN (${user.allowedRouteIds.join(',')})`;
        }
      }

      const res = await this.shopsRepository.manager.query(globalDueQuery);
      globalTotalDue = Number(res[0]?.totalDue || 0);
    }

    // 2. Fetch actual page items
    let shops: Shop[];
    let total = totalMatching;
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 12);

    if (query.page === undefined && query.limit === undefined) {
      shops = await queryBuilder.getMany();
    } else {
      const skip = (page - 1) * limit;
      shops = await queryBuilder.skip(skip).take(limit).getMany();
    }

    // 3. Compute dues for the returned shops only
    let duesSummary: Record<number, number> = {};
    if (shops.length > 0) {
      const shopIds = shops.map(s => s.id);
      
      let dueQuery = `SELECT "shopId", SUM("remainingDue") as "totalDue" 
         FROM dues 
         WHERE "shopId" IN (${shopIds.join(',')}) 
         AND status IN ('DUE', 'PARTIAL') 
         AND "remainingDue" > 0`;

      if (user) {
        if (user.role === 'SR') {
          dueQuery += ` AND "srId" = '${user.id || user.sub}'`;
        } else if (user.role === 'MANAGER' && user.allowedRouteIds && user.allowedRouteIds.length > 0) {
          dueQuery += ` AND "routeId" IN (${user.allowedRouteIds.join(',')})`;
        }
      }

      dueQuery += ` GROUP BY "shopId"`;

      const dues = await this.shopsRepository.manager.query(dueQuery);
      dues.forEach((d: any) => {
        duesSummary[d.shopId] = Number(d.totalDue || 0);
      });
    }

    const items = shops.map(shop => ({
      ...shop,
      totalOrders: 0,
      totalDue: duesSummary[shop.id] || 0,
    }));

    if (query.page === undefined && query.limit === undefined) {
      return items;
    } else {
      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: {
          totalShops: totalMatching,
          activeShops: activeMatching,
          totalDue: globalTotalDue,
        },
      };
    }
  }

  async findOne(id: number) {
    const shop = await this.shopsRepository.findOne({
      where: { id },
      relations: { route: true },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found.');
    }

    return shop;
  }

  async update(id: number, updateShopDto: UpdateShopDto) {
    const shop = await this.findOne(id);
    const nextRouteId = updateShopDto.routeId ?? shop.routeId;
    const nextName = updateShopDto.name ?? shop.name;
    const route = await this.findRouteOrFail(nextRouteId);
    this.ensureRouteIsActive(route);

    if (nextRouteId !== shop.routeId || nextName !== shop.name) {
      await this.ensureUniqueShopName(nextRouteId, nextName, shop.id);
    }

    Object.assign(shop, {
      ...updateShopDto,
      ownerName:
        updateShopDto.ownerName !== undefined
          ? (updateShopDto.ownerName ?? null)
          : shop.ownerName,
      phone:
        updateShopDto.phone !== undefined
          ? (updateShopDto.phone ?? null)
          : shop.phone,
      address:
        updateShopDto.address !== undefined
          ? (updateShopDto.address ?? null)
          : shop.address,
    });

    return this.shopsRepository.save(shop);
  }

  async deactivate(id: number) {
    const shop = await this.findOne(id);
    shop.isActive = false;
    return this.shopsRepository.save(shop);
  }

  async remove(id: number) {
    const shop = await this.findOne(id);
    await this.shopsRepository.remove(shop);
  }

  async listByRoute(routeId: number) {
    await this.findRouteOrFail(routeId);

    return this.shopsRepository.find({
      where: { routeId },
      relations: { route: true },
      order: { name: 'ASC' },
    });
  }

  private async findRouteOrFail(routeId: number) {
    const route = await this.routesRepository.findOne({
      where: { id: routeId },
    });

    if (!route) {
      throw new NotFoundException('Route not found.');
    }

    return route;
  }

  private ensureRouteIsActive(route: Route) {
    if (!route.isActive) {
      throw new BadRequestException(
        'Cannot create or move a shop under an inactive route.',
      );
    }
  }

  private async ensureUniqueShopName(
    routeId: number,
    name: string,
    excludeId?: number,
  ) {
    const existingShop = await this.shopsRepository.findOne({
      where: { routeId, name },
    });

    if (existingShop && existingShop.id !== excludeId) {
      throw new ConflictException('Shop name already exists for this route.');
    }
  }
}
