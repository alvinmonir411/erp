import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from '../shops/entities/shop.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { QueryRoutesDto } from './dto/query-routes.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { Route } from './entities/route.entity';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private readonly routesRepository: Repository<Route>,
    @InjectRepository(Shop)
    private readonly shopsRepository: Repository<Shop>,
  ) {}

  async create(createRouteDto: CreateRouteDto) {
    await this.ensureUniqueName(createRouteDto.name);

    const route = this.routesRepository.create({
      ...createRouteDto,
      area: createRouteDto.area ?? null,
      isActive: createRouteDto.isActive ?? true,
    });

    return this.routesRepository.save(route);
  }

  async findAll(query: QueryRoutesDto) {
    const queryBuilder = this.routesRepository
      .createQueryBuilder('route')
      .loadRelationCountAndMap('route.shopCount', 'route.shops')
      .loadRelationCountAndMap('route.activeShopCount', 'route.shops', 'shop', (qb) =>
        qb.where('shop.isActive = :isActive', { isActive: true }),
      )
      .orderBy('route.name', 'ASC');

    if (query.search) {
      queryBuilder.andWhere(
        '(route.name ILIKE :search OR route.area ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('route.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    if (query.page === undefined && query.limit === undefined) {
      return queryBuilder.getMany();
    } else {
      const page = Number(query.page || 1);
      const limit = Number(query.limit || 10);
      const skip = (page - 1) * limit;

      queryBuilder.skip(skip).take(limit);

      const [items, total] = await queryBuilder.getManyAndCount();
      const [totalRoutes, activeRoutes, totalShops, activeShops, uniqueAreasResult] = await Promise.all([
        this.routesRepository.count(),
        this.routesRepository.count({ where: { isActive: true } }),
        this.shopsRepository.count(),
        this.shopsRepository.count({ where: { isActive: true } }),
        this.routesRepository.createQueryBuilder('route')
          .select('COUNT(DISTINCT(route.area))', 'count')
          .where('route.area IS NOT NULL AND route.area != :empty', { empty: '' })
          .getRawOne(),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: {
          totalRoutes,
          activeRoutes,
          totalShops,
          activeShops,
          uniqueAreas: Number(uniqueAreasResult?.count || 0),
        },
      };
    }
  }

  async findOne(id: number) {
    const route = await this.routesRepository.findOne({
      where: { id },
      relations: {
        shops: true,
      },
    });

    if (!route) {
      throw new NotFoundException('Route not found.');
    }

    return route;
  }

  async update(id: number, updateRouteDto: UpdateRouteDto) {
    const route = await this.findRouteEntity(id);

    if (updateRouteDto.name && updateRouteDto.name !== route.name) {
      await this.ensureUniqueName(updateRouteDto.name, route.id);
    }

    Object.assign(route, {
      ...updateRouteDto,
      area:
        updateRouteDto.area !== undefined
          ? (updateRouteDto.area ?? null)
          : route.area,
    });

    return this.routesRepository.save(route);
  }

  async deactivate(id: number) {
    const route = await this.findRouteEntity(id);
    route.isActive = false;
    return this.routesRepository.save(route);
  }

  async remove(id: number) {
    const route = await this.findRouteEntity(id);
    const shopCount = await this.shopsRepository.count({ where: { routeId: id } });
    if (shopCount > 0) {
      throw new Error(
        `Route cannot be deleted because it has ${shopCount} shop(s) assigned to it.`,
      );
    }
    await this.routesRepository.remove(route);
  }

  async listShops(id: number) {
    await this.findRouteEntity(id);

    return this.shopsRepository.find({
      where: { routeId: id },
      order: { name: 'ASC' },
    });
  }

  private async ensureUniqueName(name: string, excludeId?: number) {
    const existingRoute = await this.routesRepository.findOne({
      where: { name },
    });

    if (existingRoute && existingRoute.id !== excludeId) {
      throw new ConflictException('Route name already exists.');
    }
  }

  private async findRouteEntity(id: number) {
    const route = await this.routesRepository.findOne({
      where: { id },
    });

    if (!route) {
      throw new NotFoundException('Route not found.');
    }

    return route;
  }
}
