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

// Triggering backend reload for new PATCH route 5
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
      validationSchema: envValidationSchema,
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
  ],
})
export class AppModule {}
