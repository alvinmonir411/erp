import { apiRequest } from './client';
import type { Due, DueCollection } from '@/types/api';

export async function getDues() {
  return apiRequest<Due[]>('/dues', {
    method: 'GET',
  });
}

export async function getPendingCollections() {
  return apiRequest<DueCollection[]>('/dues/pending-collections', {
    method: 'GET',
  });
}

export async function getCollections() {
  return apiRequest<DueCollection[]>('/dues/collections', {
    method: 'GET',
  });
}

export async function collectDue(data: {
  orderId: number;
  amount: number;
  note?: string;
  collectionDate?: string;
}) {
  return apiRequest<DueCollection>('/dues/collect', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function upsertDue(data: {
  orderId: number;
  amount: number;
  note?: string;
}) {
  return apiRequest<Due>('/dues/upsert', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approveCollection(id: number) {
  return apiRequest<DueCollection>(`/dues/approve/${id}`, {
    method: 'PATCH',
  });
}

export async function rejectCollection(id: number, reason: string) {
  return apiRequest<DueCollection>(`/dues/reject/${id}`, {
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
  return apiRequest<{
    totalRemaining: number;
    totalPaid: number;
    pendingApproval: number;
  }>('/dues/stats', {
    method: 'GET',
  });
}

export async function getShopDues(shopId: number) {
  return apiRequest<Due[]>(`/dues/shop/${shopId}`, {
    method: 'GET',
  });
}
