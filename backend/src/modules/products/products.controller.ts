import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Inject,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: any,
  ) {}

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Post()
  async create(@Body() createProductDto: CreateProductDto) {
    await this.cacheManager.clear();
    return this.productsService.create(createProductDto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get()
  async findAll(@Query() query: QueryProductsDto) {
    const cacheKey = `products_list_${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const data = await this.productsService.findAll(query);
    await this.cacheManager.set(cacheKey, data, 600000); // 10 minutes TTL
    return data;
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get('summary')
  async getSummary(@Query('companyId') companyId?: number) {
    const cacheKey = `products_summary_${companyId ?? 'all'}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const data = await this.productsService.getSummary(companyId);
    await this.cacheManager.set(cacheKey, data, 600000); // 10 minutes TTL
    return data;
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    await this.cacheManager.clear();
    return this.productsService.update(id, updateProductDto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.cacheManager.clear();
    return this.productsService.remove(id);
  }
}
