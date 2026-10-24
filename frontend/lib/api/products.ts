import { apiRequest } from './client';
import type {
  CreateProductPayload,
  Product,
  UpdateProductPayload,
} from '@/types/api';

export function getProducts(query?: {
  companyId?: number;
  search?: string;
  isActive?: boolean;
  stockLevel?: 'low' | 'out' | 'normal';
  page?: number;
  limit?: number;
}) {
  return apiRequest<any>('products', {
    query: query as Record<string, any>,
  });
}

export function getProductsSummary(companyId?: number) {
  return apiRequest<{
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    totalStockQuantity: number;
    totalStockValue: number;
    companyWiseProducts: Array<{
      companyId: number;
      companyName: string;
      totalProducts: number;
      activeProducts: number;
      inactiveProducts: number;
      lowStockProducts: number;
      outOfStockProducts: number;
      totalStockQuantity: number;
      totalStockValue: number;
    }>;
  }>('products/summary', {
    query: companyId ? { companyId } : undefined,
  });
}

export function createProduct(payload: CreateProductPayload) {
  return apiRequest<Product>('products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProduct(id: number, payload: UpdateProductPayload) {
  return apiRequest<Product>(`products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(id: number) {
  return apiRequest<{ success: boolean }>(`products/${id}`, {
    method: 'DELETE',
  });
}

export function generateCartonLabels(payload: {
  productId: number;
  packSize?: number;
  count: number;
  prefix?: string;
}) {
  return apiRequest<{
    success: boolean;
    count: number;
    product: {
      id: number;
      name: string;
      sku: string;
      companyName: string;
    };
    labels: Array<{
      id: number;
      cartonCode: string;
      productId: number;
      packSize: number;
      status: string;
      printedAt: string;
    }>;
  }>('products/carton-labels/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getCartonLabels(query?: {
  productId?: number;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return apiRequest<{
    items: Array<{
      id: number;
      cartonCode: string;
      productId: number;
      packSize: number;
      status: string;
      printedAt: string;
      product?: Product;
    }>;
    total: number;
  }>('products/carton-labels/list', {
    query: query as Record<string, any>,
  });
}

export function scanCarton(cartonCode: string, batchId?: number) {
  return apiRequest<{
    found: boolean;
    type?: string;
    carton?: any;
    product?: Product;
    packSize?: number;
    isAlreadyScanned?: boolean;
    message?: string;
  }>('products/carton/scan', {
    method: 'POST',
    body: JSON.stringify({ cartonCode, currentBatchId: batchId }),
  });
}

export function updateProductPackaging(
  id: number,
  payload: {
    defaultCartonSize?: number;
    freeSchemeBuyQty?: number;
    freeSchemeFreeQty?: number;
    cartonBarcodePrefix?: string;
  },
) {
  return apiRequest<Product>(`products/${id}/packaging`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
