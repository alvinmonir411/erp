import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Company } from '../modules/companies/entities/company.entity';
import { CompaniesService } from '../modules/companies/companies.service';
import { UsersService } from '../modules/users/users.service';
import { Role } from '../common/enums/role.enum';
import { Product } from '../modules/products/entities/product.entity';
import { ProductUnit } from '../modules/products/entities/product-unit.enum';
import { ProductsService } from '../modules/products/products.service';
import { Route } from '../modules/routes/entities/route.entity';
import { RoutesService } from '../modules/routes/routes.service';
import { Shop } from '../modules/shops/entities/shop.entity';
import { ShopsService } from '../modules/shops/shops.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const logger = new Logger('DatabaseSeed');

  try {
    const usersService = app.get(UsersService);
    const companiesService = app.get(CompaniesService);
    const productsService = app.get(ProductsService);
    const routesService = app.get(RoutesService);
    const shopsService = app.get(ShopsService);

    const companiesRepository = dataSource.getRepository(Company);
    const productsRepository = dataSource.getRepository(Product);
    const routesRepository = dataSource.getRepository(Route);
    const shopsRepository = dataSource.getRepository(Shop);

    logger.log('Starting simplified database seed...');

    // 1. Create Super Admin
    await usersService.createSuperAdmin({
      email: 'admin@erp.com',
      username: 'admin',
      password: 'password123',
      name: 'Super Admin',
    });
    logger.log('Super admin user created/verified');

    // 2. Create Companies
    const companies = new Map<string, Company>();
    const companySeeds = [
      {
        key: 'keya',
        name: 'Keya Cosmetics',
        code: 'KYC',
        address: 'Gazipur',
        phone: '01711111111',
      },
      {
        key: 'pran',
        name: 'Pran RFL',
        code: 'PRAN',
        address: 'Dhaka',
        phone: '01711111112',
      },
      {
        key: 'unilever',
        name: 'Unilever Bangladesh',
        code: 'ULB',
        address: 'Chittagong',
        phone: '01711111113',
      },
    ];

    for (const seed of companySeeds) {
      let company = await companiesRepository.findOne({
        where: { code: seed.code },
      });
      if (!company) {
        company = await companiesService.create(seed);
      }
      companies.set(seed.key, company);
    }
    logger.log('Companies created/verified');

    // 3. Create Routes
    const routes = new Map<string, Route>();
    const routeSeeds = [
      { key: 'mirpur', name: 'Mirpur Route', area: 'Mirpur' },
      { key: 'uttara', name: 'Uttara Route', area: 'Uttara' },
      { key: 'gulshan', name: 'Gulshan Route', area: 'Gulshan' },
    ];

    for (const seed of routeSeeds) {
      let route = await routesRepository.findOne({
        where: { name: seed.name },
      });
      if (!route) {
        route = await routesService.create({
          name: seed.name,
          area: seed.area,
        });
      }
      routes.set(seed.key, route);
    }
    logger.log('Routes created/verified');

    // 4. Create Shops
    const shopSeeds = [
      {
        name: 'Rahman Store',
        routeKey: 'mirpur',
        ownerName: 'Md. Rahman',
        phone: '01810000001',
        address: 'Mirpur 10',
      },
      {
        name: 'Noor Traders',
        routeKey: 'mirpur',
        ownerName: 'Nur Alam',
        phone: '01810000002',
        address: 'Mirpur 11',
      },
      {
        name: 'Maa General Store',
        routeKey: 'uttara',
        ownerName: 'Shila Akter',
        phone: '01810000003',
        address: 'Uttara Sector 3',
      },
    ];

    for (const seed of shopSeeds) {
      const shop = await shopsRepository.findOne({
        where: { name: seed.name },
      });
      if (!shop) {
        const route = routes.get(seed.routeKey);
        const company = companies.get('keya'); // Assign to a default company
        if (route && company) {
          await shopsService.create({
            name: seed.name,
            routeId: route.id,
            companyId: company.id,
            ownerName: seed.ownerName,
            phone: seed.phone,
            address: seed.address,
          });
        }
      }
    }
    logger.log('Shops created/verified');

    // 5. Create Products
    const productSeeds = [
      {
        companyKey: 'keya',
        name: 'Keya Soap',
        sku: 'KYC-001',
        unit: ProductUnit.PCS,
        buyPrice: 45,
        salePrice: 55,
      },
      {
        companyKey: 'keya',
        name: 'Keya Toothpaste',
        sku: 'KYC-002',
        unit: ProductUnit.PCS,
        buyPrice: 75,
        salePrice: 90,
      },
      {
        companyKey: 'pran',
        name: 'Pran Frooto',
        sku: 'PRAN-001',
        unit: ProductUnit.PACK,
        buyPrice: 15,
        salePrice: 20,
      },
      {
        companyKey: 'unilever',
        name: 'Lux Soap',
        sku: 'ULB-001',
        unit: ProductUnit.PCS,
        buyPrice: 50,
        salePrice: 60,
      },
    ];

    for (const seed of productSeeds) {
      const product = await productsRepository.findOne({
        where: { sku: seed.sku },
      });
      if (!product) {
        const company = companies.get(seed.companyKey);
        if (company) {
          await productsService.create({
            ...seed,
            companyId: company.id,
          });
        }
      }
    }
    logger.log('Products created/verified');

    logger.log('Seed completed successfully!');
  } catch (error) {
    logger.error('Seed failed!');
    throw error;
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : error;
  Logger.error(message, undefined, 'DatabaseSeed');
  process.exit(1);
});
