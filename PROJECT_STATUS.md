# 1. Project Overview

This project is a dealer/distribution ERP-style admin workspace with:

- a NestJS REST backend
- a Next.js frontend admin UI
- PostgreSQL persistence through TypeORM

Based on the current implementation, the app currently supports:

- company master data management
- product master data management
- route and shop master data management
- stock movement entry and stock summary calculation
- sales creation with multiple sale items
- due sales tracking
- due payment collection against an existing sale
- sales summary views and filterable sales listings

## Current MVP Scope

The current MVP scope appears to be:

- maintain operational master data
- calculate stock from stock movements
- create sales and reduce stock
- track due balances on sales
- collect later due payments
- review sales summaries by route/company/date

Authentication, purchasing, returns, reports/export, and migration-based schema management are not clearly implemented as part of the current MVP.

# 2. Tech Stack

## Backend

- NestJS 11
- TypeScript
- class-validator
- class-transformer
- Joi
- RxJS

## Frontend

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4

## Database

- PostgreSQL

## ORM

- TypeORM 0.3

## Other Detected Libraries

- `pg`
- `reflect-metadata`
- `eslint`
- `prettier`
- `jest`

# 3. Project Structure

## Root Structure

```text
.
|-- backend/
|-- frontend/
|-- .gitignore
|-- README.md
`-- PROJECT_STATUS.md
```

## Backend Structure

```text
backend/
|-- src/
|   |-- common/
|   |-- config/
|   |-- database/
|   |   |-- init.ts
|   |   |-- reset.ts
|   |   `-- typeorm.config.ts
|   |-- health/
|   |-- modules/
|   |   |-- companies/
|   |   |-- products/
|   |   |-- routes/
|   |   |-- sales/
|   |   |-- shops/
|   |   `-- stock/
|   |-- app.module.ts
|   `-- main.ts
|-- .env.example
`-- package.json
```

## Frontend Structure

```text
frontend/
|-- app/
|   |-- companies/
|   |-- products/
|   |   `-- all/
|   |-- routes/
|   |-- sales/
|   |   |-- create/
|   |   `-- [id]/
|   |-- shops/
|   |-- stock/
|   |-- layout.tsx
|   `-- page.tsx
|-- components/
|   |-- companies/
|   |-- dashboard/
|   |-- layout/
|   |-- products/
|   |-- routes/
|   |-- sales/
|   |-- shops/
|   |-- stock/
|   `-- ui/
|-- lib/
|   |-- api/
|   `-- utils/
|-- types/
|-- .env.local.example
`-- package.json
```

# 4. Backend Modules (REAL ONLY)

## Companies

### What it does

- creates companies
- lists companies with optional search and active filter
- fetches a single company
- updates a company
- deletes a company if no products exist under it

### Key entities used

- `Company`
- `Product`

### Important business logic implemented

- company code must be unique
- company cannot be deleted while products exist for it

## Products

### What it does

- creates products for a company
- lists products with optional company/search/active filters
- fetches a single product
- updates a product
- deletes a product if no stock movements exist for it

### Key entities used

- `Product`
- `Company`
- `StockMovement`

### Important business logic implemented

- product company must exist
- SKU must be unique within a company
- product cannot be deleted if stock movements already exist

## Stock

### What it does

- records opening stock
- records stock-in
- records adjustments
- lists stock movements
- calculates current stock summary
- filters low-stock products
- filters zero-stock products

### Key entities used

- `StockMovement`
- `Company`
- `Product`

### Important business logic implemented

- opening stock quantity must be greater than zero
- stock-in quantity must be greater than zero
- adjustment quantity cannot be zero
- stock movement cannot be created for inactive company
- stock movement cannot be created for inactive product
- product must belong to the submitted company
- current stock is derived from stock movements
- `SALE_OUT` movements are subtracted in stock summary calculations

## Routes

### What it does

- creates routes
- lists routes
- fetches route details
- updates route master data
- deactivates routes
- lists shops under a route

### Key entities used

- `Route`
- `Shop`

### Important business logic implemented

- route name must be unique
- route deactivation is implemented

## Shops

### What it does

- creates shops under routes
- lists shops with route/search/active filters
- fetches a single shop
- updates a shop
- deactivates a shop
- lists shops by route

### Key entities used

- `Shop`
- `Route`

### Important business logic implemented

- route must exist
- route must be active before creating or moving a shop under it
- shop name must be unique within a route

## Sales

### What it does

- creates sales with multiple items
- lists sales with multiple filters
- fetches sale details
- returns sales summaries
- returns due-overview summary
- receives payment against an existing due sale

### Key entities used

- `Sale`
- `SaleItem`
- `SalePayment`
- `Company`
- `Route`
- `Shop`
- `Product`
- `StockMovement`

### Important business logic implemented

- company must exist and be active
- route must exist and be active
- optional shop must exist, be active, and belong to the selected route
- all sold products must exist, be active, and belong to the selected company
- available stock is validated before sale creation
- invoice number is checked for uniqueness if provided
- invoice number is auto-generated when blank
- paid amount cannot exceed total amount
- due sale requires a shop
- sale item totals and profits are calculated server-side
- `SALE_OUT` stock movements are created during sale creation
- initial paid amount is saved as a `SalePayment` record when `paidAmount > 0`
- received due payment cannot exceed current due amount
- payment cannot be received on a fully paid sale

# 5. API Endpoints (AUTO-DETECTED FROM CONTROLLERS)

Only endpoints found in controllers are listed below.

## Health

- `GET /api` → API info
- `GET /api/health` → health status

## Companies

- `POST /api/companies` → create company
- `GET /api/companies` → list companies
- `GET /api/companies/:id` → get company by id
- `PATCH /api/companies/:id` → update company
- `DELETE /api/companies/:id` → delete company

## Products

- `POST /api/products` → create product
- `GET /api/products` → list products
- `GET /api/products/:id` → get product by id
- `PATCH /api/products/:id` → update product
- `DELETE /api/products/:id` → delete product

## Stock

- `POST /api/stock/opening` → create opening stock movement
- `POST /api/stock/in` → create stock-in movement
- `POST /api/stock/adjustment` → create adjustment movement
- `GET /api/stock/movements` → list stock movements
- `GET /api/stock/summary/current` → current stock summary
- `GET /api/stock/summary/low-stock` → low-stock summary
- `GET /api/stock/summary/zero-stock` → zero-stock summary

## Routes

- `POST /api/routes` → create route
- `GET /api/routes` → list routes
- `GET /api/routes/:id` → get route by id
- `GET /api/routes/:id/shops` → list shops under route
- `PATCH /api/routes/:id` → update route
- `PATCH /api/routes/:id/deactivate` → deactivate route

## Shops

- `POST /api/shops` → create shop
- `GET /api/shops` → list shops
- `GET /api/shops/:id` → get shop by id
- `GET /api/shops/route/:routeId` → list shops by route
- `PATCH /api/shops/:id` → update shop
- `PATCH /api/shops/:id/deactivate` → deactivate shop

## Sales

- `POST /api/sales` → create sale
- `GET /api/sales` → list sales
- `GET /api/sales/summary/today-sales` → today sales summary
- `GET /api/sales/summary/today-profit` → today profit summary
- `GET /api/sales/summary/monthly` → monthly sales summary
- `GET /api/sales/summary/route-wise` → route-wise sales summary
- `GET /api/sales/summary/company-wise` → company-wise sales summary
- `GET /api/sales/summary/due-overview` → due overview summary
- `GET /api/sales/:id` → sale details
- `POST /api/sales/:id/payments` → receive payment against sale

# 6. Data Models / Entities

The following entity definitions are visible in TypeORM code.

## Company

### Fields

- `id`
- `name`
- `code`
- `address`
- `phone`
- `isActive`
- `createdAt`
- `updatedAt`

### Relations

- `products: Product[]`
- `stockMovements: StockMovement[]`

## Product

### Fields

- `id`
- `companyId`
- `name`
- `sku`
- `unit`
- `buyPrice`
- `salePrice`
- `isActive`
- `createdAt`
- `updatedAt`

### Relations

- `company: Company`
- `stockMovements: StockMovement[]`

## StockMovement

### Fields

- `id`
- `companyId`
- `productId`
- `type`
- `quantity`
- `note`
- `movementDate`
- `createdAt`
- `updatedAt`

### Relations

- `company: Company`
- `product: Product`

## Route

### Fields

- `id`
- `name`
- `area`
- `isActive`
- `createdAt`
- `updatedAt`

### Relations

- `shops: Shop[]`

## Shop

### Fields

- `id`
- `routeId`
- `name`
- `ownerName`
- `phone`
- `address`
- `isActive`
- `createdAt`
- `updatedAt`

### Relations

- `route: Route`

## Sale

### Fields

- `id`
- `companyId`
- `routeId`
- `shopId`
- `saleDate`
- `invoiceNo`
- `totalAmount`
- `paidAmount`
- `dueAmount`
- `totalProfit`
- `note`
- `createdAt`
- `updatedAt`

### Relations

- `company: Company`
- `route: Route`
- `shop: Shop | null`
- `items: SaleItem[]`
- `payments: SalePayment[]`

## SaleItem

### Fields

- `id`
- `saleId`
- `productId`
- `quantity`
- `unitPrice`
- `buyPrice`
- `lineTotal`
- `lineProfit`
- `createdAt`
- `updatedAt`

### Relations

- `sale: Sale`
- `product: Product`

## Additional Detected Entity

### SalePayment

This entity is implemented in code and is part of the current sales flow.

#### Fields

- `id`
- `saleId`
- `amount`
- `paymentDate`
- `note`
- `createdAt`
- `updatedAt`

#### Relations

- `sale: Sale`

# 7. Business Logic Implemented

Only logic clearly visible in service-layer code is listed here.

- stock is derived from stock movement records
- `SALE_OUT` stock movement reduces stock
- stock movement product must belong to the submitted company
- inactive companies cannot receive stock movements
- inactive products cannot receive stock movements
- adjustment quantity cannot be zero
- route names are unique
- company codes are unique
- product SKU is unique within a company
- shop name is unique within a route
- shops cannot be created or moved under inactive routes
- sales validate company, route, shop, and product existence
- sales reject inactive company, route, shop, or product
- shop must belong to the selected route for a sale
- sale validates available stock before creation
- sale due requires shop
- paid amount cannot exceed total amount
- sale totals and profits are calculated on the backend
- sale creation creates `SALE_OUT` stock movement rows
- initial paid amount is stored as a payment record
- later payment collection updates `paidAmount` and `dueAmount`
- overpayment is blocked

The following are not clearly enforced in code:

- customer-level credit limits
- stock reservation before sale confirmation
- audit logging
- role-based access control

# 8. Frontend Implementation

## Dashboard

### What data it loads

- companies via `getCompanies()`
- products per company via `getProducts(companyId)`
- low stock per company via `getLowStockProducts(companyId)`
- zero stock per company via `getZeroStockProducts(companyId)`

### What actions user can perform

- view total companies
- view total products
- view active companies
- click low/zero stock card to open stock alerts section
- navigate to companies/products/stock from dashboard shortcuts

### APIs it calls

- `GET /api/companies`
- `GET /api/products`
- `GET /api/stock/summary/low-stock`
- `GET /api/stock/summary/zero-stock`

## Companies

### What data it loads

- companies list via `getCompanies()`

### What actions user can perform

- select a company to inspect details
- create company
- edit company
- toggle active state through update payload

### APIs it calls

- `GET /api/companies`
- `POST /api/companies`
- `PATCH /api/companies/:id`

## Products

### What data it loads

- companies via `getCompanies()`
- products for selected company via `getProducts(companyId, search)`
- stock summary for selected company via `getStockSummary(companyId, search)`

### What actions user can perform

- filter by company
- search by product name or SKU
- create product
- edit product
- view current stock column

### APIs it calls

- `GET /api/companies`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- `GET /api/stock/summary/current`

## All Products

### What data it loads

- all products via `getProducts(undefined, search)`
- companies via `getCompanies()`
- stock summary per company via repeated `getStockSummary(companyId, search)`

### What actions user can perform

- search products
- view total product counter
- view zero-stock rows highlighted in red
- navigate to `/products`

### APIs it calls

- `GET /api/products`
- `GET /api/companies`
- `GET /api/stock/summary/current`

## Stock

### What data it loads

- companies via `getCompanies()`
- products via `getProducts(companyId)`
- stock summary via `getStockSummary(companyId, search)`
- low stock via `getLowStockProducts(companyId, threshold, search)`
- zero stock via `getZeroStockProducts(companyId, search)`
- stock movements via `getStockMovements(companyId, productId)`

### What actions user can perform

- filter by company
- filter by product
- search by product name or SKU
- add opening stock
- add stock-in
- add adjustment
- browse movement history
- page through summary tables

### APIs it calls

- `GET /api/companies`
- `GET /api/products`
- `GET /api/stock/summary/current`
- `GET /api/stock/summary/low-stock`
- `GET /api/stock/summary/zero-stock`
- `GET /api/stock/movements`
- `POST /api/stock/opening`
- `POST /api/stock/in`
- `POST /api/stock/adjustment`

## Routes

### What data it loads

- routes via `getRoutes(search)`

### What actions user can perform

- search routes
- create route
- edit route
- toggle active state through update payload

### APIs it calls

- `GET /api/routes`
- `POST /api/routes`
- `PATCH /api/routes/:id`

### Status

- partial implementation for route deactivation in frontend
- backend has `PATCH /api/routes/:id/deactivate`, but current frontend page does not expose a dedicated deactivate action

## Shops

### What data it loads

- routes via `getRoutes()`
- shops via `getShops(routeId, search)`

### What actions user can perform

- filter by route
- search shops
- create shop
- edit shop
- toggle active state through update payload

### APIs it calls

- `GET /api/routes`
- `GET /api/shops`
- `POST /api/shops`
- `PATCH /api/shops/:id`

### Status

- partial implementation for shop deactivation in frontend
- backend has `PATCH /api/shops/:id/deactivate`, but current frontend page does not expose a dedicated deactivate action

## Sales

### What data it loads

- sales list via `getSales(query)`
- companies via `getCompanies()`
- routes via `getRoutes()`
- shops for selected route via `getShops(routeId)`
- today sales summary via `getTodaySalesSummary(query)`
- today profit summary via `getTodayProfitSummary(query)`
- monthly sales summary via `getMonthlySalesSummary(query)`
- route-wise sales summary via `getRouteWiseSalesSummary(query)`
- company-wise sales summary via `getCompanyWiseSalesSummary(query)`
- due overview via `getDueOverview(query)`

### What actions user can perform

- filter by company
- filter by route
- filter by shop
- filter by date range
- search by invoice/company/route/shop
- show only due sales
- clear filters
- open sale details
- create a sale

### APIs it calls

- `GET /api/companies`
- `GET /api/routes`
- `GET /api/shops`
- `GET /api/sales`
- `GET /api/sales/summary/today-sales`
- `GET /api/sales/summary/today-profit`
- `GET /api/sales/summary/monthly`
- `GET /api/sales/summary/route-wise`
- `GET /api/sales/summary/company-wise`
- `GET /api/sales/summary/due-overview`

## Sales Create

### What data it loads

- companies via `getCompanies()`
- routes via `getRoutes()`
- products for selected company via `getProducts(companyId)`
- shops for selected route via `getShops(routeId)`

### What actions user can perform

- select company, route, shop, sale date
- optionally provide invoice number
- enter paid amount and note
- add/remove sale item rows
- change unit price per item
- save and go to details
- save and continue next order

### APIs it calls

- `GET /api/companies`
- `GET /api/routes`
- `GET /api/products`
- `GET /api/shops`
- `POST /api/sales`

## Sales Details

### What data it loads

- sale details via `getSale(id)`

### What actions user can perform

- inspect sale header and item lines
- view payment history
- receive due payment
- return to sales list

### APIs it calls

- `GET /api/sales/:id`
- `POST /api/sales/:id/payments`

# 9. API Integration Status

## Fully connected pages

- dashboard
- companies
- products
- all products
- stock
- routes
- shops
- sales list
- create sale
- sale details

## Partial implementations

- route deactivation: backend implemented, not surfaced as a dedicated frontend action
- shop deactivation: backend implemented, not surfaced as a dedicated frontend action
- company delete: backend implemented, not exposed in current frontend API helper/page
- product delete: backend implemented, not exposed in current frontend API helper/page

## Broken or unclear flows

- due sale details loading had recent error context in user-reported behavior; backend now contains a fallback path in `SalesService.findOne`, but production behavior is not independently verified from this document alone
- Bengali text in `create-sale-page.tsx` shows encoding artifacts in terminal output; rendering behavior in browser is not clearly verified from code inspection alone

# 10. Seed / Demo Data

No confirmed seed logic.

What is clearly implemented:

- `backend/src/database/init.ts`
  - sets `DB_SYNCHRONIZE=true`
  - sets `DB_DROP_SCHEMA=false`
  - initializes schema without demo data
- `backend/src/database/reset.ts`
  - sets `DB_SYNCHRONIZE=true`
  - sets `DB_DROP_SCHEMA=true`
  - recreates schema without demo data

So the current codebase initializes empty tables only.

# 11. Known Issues / Current Problems

Only code-visible or directly observed issues are listed here.

- frontend API helper files do not expose backend delete endpoints for companies/products
- frontend route and shop pages do not expose dedicated deactivate actions even though backend supports them
- sale details payment history depends on the `sale_payments` table existing; older local databases may require rerunning `npm run db:init`
- some text strings in `create-sale-page.tsx` appear with encoding issues in terminal inspection; browser rendering is not clearly verified here

# 12. Next Development Steps

Based on currently missing modules/features in the codebase, the next obvious steps are:

- returns module
- reports/export module
- dashboard improvements

Due collection is already implemented in the current codebase, so it is not listed as a missing next step.

# 13. Local Development Guide

## Backend

### Run

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run db:init
npm run start:dev
```

### Environment variables

From `backend/.env.example`:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://username:password@ep-example.us-east-2.aws.neon.tech/dealer_erp?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:3000
DB_SYNCHRONIZE=false
DB_DROP_SCHEMA=false
```

### Notes

- API prefix is `/api`
- CORS origin uses `FRONTEND_URL`
- validation pipe uses `whitelist`, `transform`, and `forbidNonWhitelisted`
- `JWT_SECRET` exists in env example, but authentication is not clearly implemented

## Frontend

### Run

```powershell
cd frontend
npm install
Copy-Item .env.local.example .env.local
npm run dev
```

### Environment variables

From `frontend/.env.local.example`:

```  
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

# 14. Testing Checklist

## Company

- [ ] create a company
- [ ] edit a company
- [ ] verify duplicate company code is rejected

## Product

- [ ] create a product under a company
- [ ] edit a product
- [ ] verify duplicate SKU in same company is rejected
- [ ] verify current stock shows on products page

## Stock

- [ ] add opening stock
- [ ] add stock-in
- [ ] add adjustment
- [ ] verify current stock summary updates
- [ ] verify low-stock list updates
- [ ] verify zero-stock list updates

## Route

- [ ] create a route
- [ ] edit a route
- [ ] verify duplicate route name is rejected

## Shop

- [ ] create a shop under a route
- [ ] edit a shop
- [ ] verify duplicate shop name in same route is rejected
- [ ] verify inactive route blocks shop create/move

## Sales

- [ ] create a sale with multiple items
- [ ] verify stock validation blocks insufficient stock
- [ ] verify due sale requires shop
- [ ] verify sale appears in sales list
- [ ] verify summaries update
- [ ] open sale details
- [ ] receive due payment
- [ ] verify paid amount and due amount update
- [ ] verify payment history appears

