import { apiRequest } from './client';

export async function getDues() {
  return apiRequest<any[]>('/dues', {
    method: 'GET',
  });
}

export async function getPendingCollections() {
  return apiRequest<any[]>('/dues/pending-collections', {
    method: 'GET',
  });
}

export async function getCollections() {
  return apiRequest<any[]>('/dues/collections', {
    method: 'GET',
  });
}

export async function collectDue(data: {
  orderId: number;
  amount: number;
  note?: string;
  collectionDate?: string;
}) {
  return apiRequest<any>('/dues/collect', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function upsertDue(data: {
  orderId: number;
  amount: number;
  note?: string;
}) {
  return apiRequest<any>('/dues/upsert', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approveCollection(id: number) {
  return apiRequest<any>(`/dues/approve/${id}`, {
    method: 'PATCH',
  });
}

export async function rejectCollection(id: number, reason: string) {
  return apiRequest<any>(`/dues/reject/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export async function getSRDueSummary() {
  return apiRequest<any>('/dues/sr-summary', {
    method: 'GET',
  });
}

export async function getDueStats() {
  return apiRequest<any>('/dues/stats', {
    method: 'GET',
  });
}

export async function getShopDues(shopId: number) {
  return apiRequest<any[]>(`/dues/shop/${shopId}`, {
    method: 'GET',
  });
}
