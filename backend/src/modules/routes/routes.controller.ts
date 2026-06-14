import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Inject,
} from '@nestjs/common';
import { CreateRouteDto } from './dto/create-route.dto';
import { QueryRoutesDto } from './dto/query-routes.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RoutesService } from './routes.service';

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutesController {
  constructor(
    private readonly routesService: RoutesService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: any,
  ) {}

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Post()
  async create(@Body() createRouteDto: CreateRouteDto) {
    await this.cacheManager.clear();
    return this.routesService.create(createRouteDto);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.SR)
  @Get()
  async findAll(@Query() query: QueryRoutesDto) {
    const cacheKey = `routes_list_${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const data = await this.routesService.findAll(query);
    await this.cacheManager.set(cacheKey, data, 600000); // 10 minutes TTL
    return data;
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.SR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.SR)
  @Get(':id/shops')
  async listShops(@Param('id', ParseIntPipe) id: number) {
    const cacheKey = `route_shops_${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const data = await this.routesService.listShops(id);
    await this.cacheManager.set(cacheKey, data, 600000); // 10 minutes TTL
    return data;
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRouteDto: UpdateRouteDto,
  ) {
    await this.cacheManager.clear();
    return this.routesService.update(id, updateRouteDto);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Patch(':id/deactivate')
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    await this.cacheManager.clear();
    return this.routesService.deactivate(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.cacheManager.clear();
    return this.routesService.remove(id);
  }
}
