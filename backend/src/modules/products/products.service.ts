import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
  ) {}

  async create(createProductDto: CreateProductDto) {
    await this.ensureCompanyExists(createProductDto.companyId);
    await this.ensureUniqueSku(
      createProductDto.companyId,
      createProductDto.sku,
    );

    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async findAll(query: QueryProductsDto) {
    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.company', 'company')
      .orderBy('product.name', 'ASC');

    const companyId = Number(query.companyId);
    if (query.companyId && !isNaN(companyId)) {
      queryBuilder.andWhere('product.companyId = :companyId', {
        companyId: companyId,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('product.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    if (query.stockLevel === 'out') {
      queryBuilder.andWhere('product.currentStock <= 0');
    } else if (query.stockLevel === 'low') {
      queryBuilder.andWhere(
        'product.currentStock > 0 AND product.currentStock <= 10',
      );
    } else if (query.stockLevel === 'normal') {
      queryBuilder.andWhere('product.currentStock > 10');
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 100;
    const skip = (page - 1) * limit;

    try {
      const total = await queryBuilder.getCount();

      // If no pagination requested, return simple array for backward compatibility
      if (!query.page && !query.limit) {
        return queryBuilder.getMany() as any;
      }

      const page = query.page || 1;
      const limit = query.limit || 100;
      const skip = (page - 1) * limit;

      const items = await queryBuilder.skip(skip).take(limit).getMany();

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error in ProductsService.findAll:', error);
      throw error;
    }
  }

  async getSummary(companyId?: number) {
    const LOW_STOCK_THRESHOLD = 10;

    // 1. Overall Summary
    const baseQuery = this.productsRepository.createQueryBuilder('p');
    if (companyId) {
      baseQuery.where('p.companyId = :companyId', { companyId });
    }

    const metrics = await baseQuery
      .select('COUNT(*)', 'totalProducts')
      .addSelect(
        'SUM(CASE WHEN p."isActive" = true THEN 1 ELSE 0 END)',
        'activeProducts',
      )
      .addSelect(
        'SUM(CASE WHEN p."isActive" = false THEN 1 ELSE 0 END)',
        'inactiveProducts',
      )
      .addSelect(
        `SUM(CASE WHEN p."isActive" = true AND p."currentStock" > 0 AND p."currentStock" <= ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END)`,
        'lowStockProducts',
      )
      .addSelect(
        'SUM(CASE WHEN p."isActive" = true AND p."currentStock" <= 0 THEN 1 ELSE 0 END)',
        'outOfStockProducts',
      )
      .addSelect(
        `SUM(CASE WHEN p."isActive" = true AND p."currentStock" > ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END)`,
        'inStockProducts',
      )
      .addSelect('SUM(p."currentStock")', 'totalStockQuantity')
      .addSelect('SUM(p."currentStock" * p."buyPrice")', 'totalStockValue')
      .getRawOne();

    // 2. Company-wise Summary (Only if global summary)
    let companyWiseProducts = [];
    if (!companyId) {
      companyWiseProducts = await this.productsRepository
        .createQueryBuilder('p')
        .leftJoin('p.company', 'c')
        .select('c.id', 'companyId')
        .addSelect('c.name', 'companyName')
        .addSelect('COUNT(*)', 'totalProducts')
        .addSelect(
          'SUM(CASE WHEN p."isActive" = true THEN 1 ELSE 0 END)',
          'activeProducts',
        )
        .addSelect(
          'SUM(CASE WHEN p."isActive" = false THEN 1 ELSE 0 END)',
          'inactiveProducts',
        )
        .addSelect(
          `SUM(CASE WHEN p."isActive" = true AND p."currentStock" > 0 AND p."currentStock" <= ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END)`,
          'lowStockProducts',
        )
        .addSelect(
          'SUM(CASE WHEN p."isActive" = true AND p."currentStock" <= 0 THEN 1 ELSE 0 END)',
          'outOfStockProducts',
        )
        .addSelect(
          `SUM(CASE WHEN p."isActive" = true AND p."currentStock" > ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END)`,
          'inStockProducts',
        )
        .addSelect('SUM(p."currentStock")', 'totalStockQuantity')
        .addSelect('SUM(p."currentStock" * p."buyPrice")', 'totalStockValue')
        .groupBy('c.id')
        .addGroupBy('c.name')
        .getRawMany();
    }

    const safeNum = (val: any) => Number(val || 0);

    return {
      totalProducts: safeNum(metrics.totalProducts),
      activeProducts: safeNum(metrics.activeProducts),
      inactiveProducts: safeNum(metrics.inactiveProducts),
      lowStockProducts: safeNum(metrics.lowStockProducts),
      outOfStockProducts: safeNum(metrics.outOfStockProducts),
      inStockProducts: safeNum(metrics.inStockProducts),
      totalStockQuantity: safeNum(metrics.totalStockQuantity),
      totalStockValue: safeNum(metrics.totalStockValue),
      companyWiseProducts: companyWiseProducts.map((c) => ({
        ...c,
        totalProducts: safeNum(c.totalProducts),
        activeProducts: safeNum(c.activeProducts),
        inactiveProducts: safeNum(c.inactiveProducts),
        lowStockProducts: safeNum(c.lowStockProducts),
        outOfStockProducts: safeNum(c.outOfStockProducts),
        inStockProducts: safeNum(c.inStockProducts),
        totalStockQuantity: safeNum(c.totalStockQuantity),
        totalStockValue: safeNum(c.totalStockValue),
      })),
    };
  }

  async findOne(id: number) {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: {
        company: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);
    const nextCompanyId = updateProductDto.companyId ?? product.companyId;
    const nextSku = updateProductDto.sku ?? product.sku;

    await this.ensureCompanyExists(nextCompanyId);

    if (nextCompanyId !== product.companyId || nextSku !== product.sku) {
      await this.ensureUniqueSku(nextCompanyId, nextSku, product.id);
    }

    Object.assign(product, updateProductDto);
    return this.productsRepository.save(product);
  }

  async remove(id: number) {
    const product = await this.findOne(id);
    try {
      await this.productsRepository.remove(product);
      return { success: true };
    } catch (error: any) {
      if (
        error.code === '23503' ||
        error.message?.includes('foreign key constraint')
      ) {
        throw new ConflictException(
          'Cannot delete this product because it has been used in sales orders or stock history. Please Edit the product and mark it as Inactive instead.',
        );
      }
      throw error;
    }
  }

  private async ensureCompanyExists(companyId: number) {
    const company = await this.companiesRepository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }
  }

  private async ensureUniqueSku(
    companyId: number,
    sku: string,
    excludeProductId?: number,
  ) {
    const existingProduct = await this.productsRepository.findOne({
      where: { companyId, sku },
    });

    if (existingProduct && existingProduct.id !== excludeProductId) {
      throw new ConflictException(
        'Product SKU already exists for this company.',
      );
    }
  }
}
