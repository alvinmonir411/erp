import { apiRequest } from './client';
import type { CreateRoutePayload, Route, UpdateRoutePayload } from '@/types/api';

export function getRoutes(query?: { page?: number; limit?: number; search?: string; isActive?: boolean }) {
  return apiRequest<any>('routes', { query });
}

export function createRoute(payload: CreateRoutePayload) {
  return apiRequest<Route>('routes', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateRoute(id: number, payload: UpdateRoutePayload) {
  return apiRequest<Route>(`routes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteRoute(id: number) {
  return apiRequest<void>(`routes/${id}`, { method: 'DELETE' });
}
