import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ProductsModule } from './modules/products/products.module';
import { RoutesModule } from './modules/routes/routes.module';
import { ShopsModule } from './modules/shops/shops.module';
import { UsersModule } from './modules/users/users.module';
import { OrdersModule } from './modules/orders/orders.module';
import { StockModule } from './modules/stock/stock.module';
import { DeliverySummariesModule } from './modules/delivery-summaries/delivery-summaries.module';
import { DeliveryOpsModule } from './modules/delivery-ops/delivery-ops.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DuesModule } from './modules/dues/dues.module';
import { SalesModule } from './modules/sales/sales.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // Safe default rate limit: 100 requests per minute
    }]),
    CacheModule.register({
      isGlobal: true,
      ttl: 600, // 10 minutes cache TTL by default
      max: 200, // Max items in cache
    }),
    DatabaseModule,
    HealthModule,
    CompaniesModule,
    ProductsModule,
    RoutesModule,
    ShopsModule,
    UsersModule,
    AuthModule,
    OrdersModule,
    StockModule,
    DeliverySummariesModule,
    DeliveryOpsModule,
    DashboardModule,
    ReportsModule,
    DuesModule,
    SalesModule,
    RealtimeModule,
  ],
})
export class AppModule {}
