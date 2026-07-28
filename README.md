
```markdown
# 🏢 Enterprise Distribution & Inventory ERP System

An enterprise-grade, full-stack Enterprise Resource Planning (ERP) solution built for wholesale distribution, inventory tracking, multi-channel order fulfillment, and automated financial ledgers. Designed with modern architecture, real-time background sync, and strict data integrity.

---

## 🔑 Demo Admin Credentials

Try out the live system using the pre-configured admin login:
- **Email:** `admin@gmail.com`
- **Password:** `136633`

---

## 🚀 Key Features & Business Modules

### 📦 Complete Stock & Inventory Audit
- **Movement-Based Live Stock:** Calculates live stock by aggregating transaction movements (Opening, Stock In, Stock Out, Return, Adjustment, Damage) rather than storing flat integers—ensuring a 100% audit trail.
- **Inventory Health Alerts:** Low stock and zero stock automated triggers.
- **Capital Investment Metrics:** Real-time metrics showing total inventory value based on buy prices.

### 💼 Order, Sales & Profit Analytics
- **Dynamic Multi-Item Invoicing:** Quick sale creation with line-item discounts and automatically generated invoices.
- **Profitability Tracking:** Automated profit and margin calculation per sale and per item.
- **Daily Print Reports:** Optimized A4 layout for daily sales summaries and field sheets.

### 🛣️ Route & Shop Distribution System
- **Logical Mapping:** Group customers/shops by logical routes for efficient field sales and localized distribution.
- **Shop Ledger & Dues Management:** Real-time tracking of paid vs. due amounts, partial payment logs, and approval workflows.

### 🏢 Supplier Accounts & Purchases Ledger
- **Supplier Operations:** Purchase order recording linked directly to company catalogs.
- **Payable Ledger:** Comprehensive accounts payable system tracking debts, references, and supplier payments.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework:** Next.js 15 (React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS, Lucide Icons
- **State Management & Caching:** TanStack Query (React Query) v5 with optimistic updates and global sync indicator

### **Backend**
- **Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Database & ORM:** PostgreSQL with TypeORM
- **Real-Time Operations:** Socket.IO
- **Security:** JWT Authentication with persistent sessions & RBAC

---

## 📁 Repository Structure

```text
├── backend/                  # NestJS API Engine
│   ├── src/
│   │   ├── modules/          # Auth, Companies, Products, Stock, Sales, Purchases, Routes, Shops, Dues
│   │   ├── database/         # TypeORM Config, Migrations, Seeders
│   │   └── main.ts
│   └── package.json
└── frontend/                 # Next.js App Router Application
    ├── app/                  # App Router Pages & Layouts
    ├── components/           # Workspace-specific components (Stock, Sales, Dashboard, Dues)
    ├── lib/
    │   └── api/              # Standardized API integration layer
    └── package.json

```

---

## 🌐 API Overview

| Endpoint | Description |
| --- | --- |
| `/auth` | JWT Login, session verification, user role authorization |
| `/companies` | Supplier management & global filtering context |
| `/products` | Centralized catalog management linked to suppliers |
| `/stock` | Stock movements, live stock calculation, damages |
| `/sales` | Invoice generation, profit margin calculations, dues |
| `/purchases` | Purchase orders & company payable ledger |
| `/routes` & `/shops` | Area distribution & shop customer ledgers |

---

## ⚡ Quick Start & Setup

### Prerequisites

* **Node.js** (v18+)
* **PostgreSQL** (v14+)
* **npm** or **yarn**


### 1. Backend Setup

```bash
cd backend
npm install

# Copy environment variables
cp .env.example .env

```

Configure your `.env`:

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=erp_db
JWT_SECRET=your_jwt_secret

```

```bash
# Seed database with initial data
npm run seed

# Run in development mode
npm run start: dev

```

---

### 2. Frontend Setup

```bash
cd frontend
npm install

# Copy environment variables
cp .env.local.example .env.local

```

Configure `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api

```

```bash
npm run dev

```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License

This project is licensed under the MIT License.
