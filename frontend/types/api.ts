export const API_VERSION = '1.0.0';

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SR = 'SR',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export type Company = {
  [key: string]: any;
  id: number;
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCompanyPayload = {
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive?: boolean;
};

export type UpdateCompanyPayload = Partial<CreateCompanyPayload>;

export type ProductUnit = 'PCS' | 'KG' | 'LITER' | 'PACK' | 'DOZEN' | 'OTHER';

export type Product = {
  [key: string]: any;
  id: number;
  companyId: number;
  name: string;
  sku: string;
  unit: ProductUnit;
  buyPrice: number;
  salePrice: number;
  currentStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  company?: Company;
};

export type CreateProductPayload = {
  companyId: number;
  name: string;
  sku: string;
  unit: ProductUnit;
  buyPrice: number;
  salePrice: number;
  isActive?: boolean;
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

export type Route = {
  [key: string]: any;
  id: number;
  name: string;
  area: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Shop = {
  [key: string]: any;
  id: number;
  routeId: number;
  name: string;
  ownerName: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  route?: Route;
};

export type CreateRoutePayload = {
  name: string;
  area?: string;
  isActive?: boolean;
};

export type UpdateRoutePayload = Partial<CreateRoutePayload>;

export type CreateShopPayload = {
  routeId: number;
  name: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
};

export type UpdateShopPayload = Partial<CreateShopPayload>;

export type PaginatedResponse<T> = {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
};

export type User = {
  id: string;
  email: string;
  username: string;
  name: string;
  role: Role;
  status: UserStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LoginResponse = {
  access_token: string;
  user: User;
};

export type OrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'RETURNED_PARTIAL'
  | 'CANCELLED'
  | 'SETTLED';

export type DispatchBatchStatus =
  | 'DRAFT'
  | 'PRINTED'
  | 'DISPATCHED'
  | 'RETURN_PENDING'
  | 'PARTIALLY_SETTLED'
  | 'SETTLED'
  | 'CANCELLED';

export type DiscountType = 'FIXED' | 'PERCENT';

export type OrderItem = {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  freeQuantity: number;
  unitPrice: number;
  discountType?: DiscountType;
  discountValue?: number;
  lineTotal: number;
  product?: Product;
  deliveredQuantity?: number;
  returnedQuantity?: number;
  damagedQuantity?: number;
  paidReturnedQuantity?: number;
  freeReturnedQuantity?: number;
};

export type Order = {
  id: number;
  orderDate: string;
  companyId: number;
  routeId: number;
  shopId: number;
  deliveryPersonId: number | null;
  marketArea: string | null;
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  grandTotal: number;
  actualSoldAmount: number;
  collectedAmount: number;
  dueAmount: number;
  advancePaid: number;
  status: OrderStatus;
  note: string | null;
  settlementNote: string | null;
  createdBy: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  company?: Company;
  route?: Route;
  shop?: Shop;
  deliveryPerson?: DeliveryPerson;
};

export type DeliveryPerson = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PurchaseQuery = {
  companyId?: number;
  fromDate?: string;
  toDate?: string;
  search?: string;
};

export type CreatePurchasePayload = {
  companyId: number;
  purchaseDate: string;
  note?: string;
  referenceNo?: string;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[];
  paidAmount?: number;
};

export type ReceivePurchasePaymentPayload = {
  amount: number;
  paymentDate?: string;
  note?: string;
};

export type RecordReturnPayload = {
  note?: string;
  orders: {
    orderId: number;
    returnReason?: string;
    note?: string;
    items: {
      productId: number;
      dispatchedQuantity: number;
      returnedQuantity: number;
      damagedQuantity: number;
      reason?: string;
      note?: string;
    }[];
  }[];
};

export type CreateDispatchBatchPayload = {
  dispatchDate: string;
  companyId?: number;
  routeId: number;
  deliveryPersonId: number;
  marketArea?: string;
  note?: string;
  orderIds: number[];
};

export type SettlementPayload = {
  note?: string;
  collections: {
    orderId: number;
    collectedAmount: number;
    paymentMode?: string;
    note?: string;
  }[];
};

export type DispatchBatchQuery = {
  companyId?: number;
  routeId?: number;
  deliveryPersonId?: number;
  dispatchDate?: string;
  status?: string;
  search?: string;
};

export type DispatchBatchOrder = {


  id: number;
  batchId: number;
  orderId: number;
  order: Order;
  estimatedAmount: number;
  finalSoldAmount: number;
  collectedAmount: number;
  dueAmount: number;
  shortageOrExcess: number;
  isSettled: boolean;
};

export type DispatchBatch = {
  id: number;
  batchNo: string;
  dispatchDate: string;
  companyId?: number;
  company?: Company;
  routeId: number;
  route: Route;
  deliveryPersonId: number;
  deliveryPerson: DeliveryPerson;
  marketArea?: string;
  status: DispatchBatchStatus;
  totalOrders: number;
  grossDispatchedValue: number;
  returnAdjustedValue: number;
  finalSoldValue: number;
  totalAdvancePaid: number;
  totalCollectedAmount: number;
  totalDueAmount: number;
  shortageOrExcess: number;
  isMorningPrinted: boolean;
  isFinalPrinted: boolean;
  morningPrintedAt?: string;
  dispatchedAt?: string;
  returnsRecordedAt?: string;
  settledAt?: string;
  note?: string;
  settlementNote?: string;
  orders: DispatchBatchOrder[];
};


export type Purchase = {
  id: number;
  referenceNo?: string | null;
  companyId: number;
  purchaseDate: string;
  totalAmount: number;
  paidAmount: number;
  payableAmount: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: Company;
  items?: PurchaseItem[];
};

export type PurchaseItem = {
  id: number;
  purchaseId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product?: Product;
};

export type CompanyWisePayableSummary = {
  companyId: number;
  companyName: string;
  companyCode?: string;
  purchaseCount: number;
  payablePurchaseCount: number;
  totalAmount: number;
  totalPaid: number;
  totalPayable: number;
  lastPurchaseDate?: string | null;
};

export type CompanyPayableLedger = {
  company: {
    id: number;
    name: string;
    code: string;
  };
  summary: {
    purchaseCount: number;
    totalPaid: number;
    totalPayable: number;
  };
  payablePurchases: Purchase[];
  paymentHistory: CompanyPayableHistoryEntry[];
};

export type CompanyPayableHistoryEntry = {
  id: number;
  paymentDate: string;
  purchaseId: number;
  referenceNo?: string | null;
  amount: number;
  purchaseTotalAmount: number;
  purchasePaidAmount: number;
  purchasePayableAmount: number;
  note?: string | null;
};

export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'OPENING';

export type StockMovement = {
  id: number;
  productId: number;
  companyId: number;
  type: StockMovementType;
  quantity: number;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
  product?: Product;
  company?: Company;
};

export type StockSummaryItem = {
  productId: number;
  productName: string;
  sku: string;
  unit: ProductUnit;
  currentStock: number;
  buyPrice: number;
  salePrice: number;
  stockValue: number;
  company?: Company;
};

export type StockInvestmentSummary = {
  totalProducts: number;
  totalStockValue: number;
  totalBuyValue: number;
  totalSaleValue: number;
};


export type SaleItem = {
  id: number;
  saleId: number;
  productId: number;
  quantity: number;
  freeQuantity: number;
  unitPrice: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  lineTotal: number;
  product?: Product;
};

export type Sale = {
  id: number;
  invoiceNo: string;
  saleDate: string;
  companyId: number;
  routeId: number;
  shopId?: number | null;
  totalAmount: number;
  invoiceDiscountAmount?: number;
  paidAmount: number;
  dueAmount: number;
  note?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
  company?: Company;
  route?: Route;
  shop?: Shop;
};

export type SalesQuery = {
  companyId?: number;
  routeId?: number;
  shopId?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  year?: number;
  month?: number;
};

export type CreateSalePayload = {
  saleDate: string;
  companyId: number;
  routeId: number;
  shopId?: number;
  note?: string;
  items: {
    productId: number;
    quantity: number;
    freeQuantity?: number;
    unitPrice: number;
    discountType?: DiscountType;
    discountValue?: number;
  }[];
  invoiceDiscountType?: DiscountType;
  invoiceDiscountValue?: number;
  paidAmount?: number;
};

export type ReceiveSalePaymentPayload = {
  amount: number;
  paymentDate?: string;
  note?: string;
};

export type TodaySalesSummary = {
  totalSales: number;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
};

export type TodayProfitSummary = {
  totalRevenue: number;
  totalCost: number;
  profit: number;
};

export type MonthlySalesSummary = {
  year: number;
  month: number;
  totalSales: number;
  totalAmount: number;
};

export type RouteWiseSalesSummary = {
  routeId: number;
  routeName: string;
  totalSales: number;
  totalAmount: number;
};

export type CompanyWiseSalesSummary = {
  companyId: number;
  companyName: string;
  totalSales: number;
  totalAmount: number;
};

export type RouteWiseDueSummary = {
  routeId: number;
  routeName: string;
  totalDue: number;
};

export type ShopWiseDueSummary = {
  shopId: number;
  shopName: string;
  totalDue: number;
};

export type CompanyWiseDueSummary = {
  companyId: number;
  companyName: string;
  totalDue: number;
};

export type DueOverviewSummary = {
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  totalShopsWithDue: number;
};

export type ShopDueDetails = {
  shopId: number;
  shopName: string;
  totalDue: number;
  totalPaid: number;
  remainingDue: number;
  dues: any[];
};
