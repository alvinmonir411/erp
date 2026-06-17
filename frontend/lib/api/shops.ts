import { apiRequest } from './client';
import type { CreateShopPayload, Shop, UpdateShopPayload } from '@/types/api';

export function getShops(
  queryOrRouteId?: number | { routeId?: number; companyId?: number; search?: string; isActive?: boolean; page?: number; limit?: number },
  companyId?: number,
) {
  let query: any = undefined;
  if (typeof queryOrRouteId === 'number') {
    query = { routeId: queryOrRouteId };
    if (companyId !== undefined) {
      query.companyId = companyId;
    }
  } else if (queryOrRouteId && typeof queryOrRouteId === 'object') {
    query = queryOrRouteId;
  }
  return apiRequest<any>('shops', { query });
}

export function getShop(id: number) {
  return apiRequest<Shop>(`shops/${id}`);
}

export function createShop(payload: CreateShopPayload) {
  return apiRequest<Shop>('shops', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateShop(id: number, payload: UpdateShopPayload) {
  return apiRequest<Shop>(`shops/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteShop(id: number) {
  return apiRequest<void>(`shops/${id}`, { method: 'DELETE' });
}
