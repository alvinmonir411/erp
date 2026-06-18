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

export async function createManualDamage(payload: {
  productId: number;
  quantity: number;
  reason?: string;
  note?: string;
  companyId?: number;
  routeId?: number;
  shopId?: number;
  assignedDeliveryManId?: string;
}) {
  return apiRequest<any>('reports/damage', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteDamageRecord(id: number) {
  return apiRequest<any>(`reports/damage/${id}`, {
    method: 'DELETE',
  });
}
