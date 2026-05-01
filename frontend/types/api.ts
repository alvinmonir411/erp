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

export type DeliveryPerson = User;
export type DispatchBatch = any;
