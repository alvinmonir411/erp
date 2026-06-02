import { apiRequest } from './client';
import type { CreateShopPayload, Shop, UpdateShopPayload } from '@/types/api';

export function getShops(routeId?: number, search?: string) {
  return apiRequest<Shop[]>('shops', { query: { routeId, search } });
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
