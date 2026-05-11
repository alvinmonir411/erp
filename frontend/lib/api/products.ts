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
