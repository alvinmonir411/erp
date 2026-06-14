import { apiRequest } from './client';

export async function getFreeQuantityReport(filters: any) {
  return apiRequest<any>('reports/free-quantity', {
    query: filters,
  });
}

export async function getDamageReport(filters: any) {
  return apiRequest<any>('reports/damage', {
    query: filters,
  });
}
