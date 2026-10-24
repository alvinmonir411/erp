import { apiRequest } from './client';

export interface RecycleBinItem {
  id: number;
  entityType: 'ORDER' | 'DISPATCH_BATCH' | 'DUE' | string;
  entityId: number;
  entityNumber?: string;
  title: string;
  shopName?: string;
  routeName?: string;
  totalAmount: number;
  dueAmount: number;
  itemCount: number;
  snapshot: any;
  deletedById?: string;
  deletedByName?: string;
  deletedByRole?: string;
  status: 'DELETED' | 'RESTORED' | string;
  restoredAt?: string;
  restoredByName?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecycleBinStats {
  totalDeleted: number;
  deletedOrders: number;
  deletedBatches: number;
  totalRestored: number;
  recoverableValue: number;
  recoverableDue: number;
}

export interface QueryRecycleBinParams {
  entityType?: 'ALL' | 'ORDER' | 'DISPATCH_BATCH' | 'DUE';
  status?: 'ALL' | 'DELETED' | 'RESTORED';
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getRecycleBinItems(params?: QueryRecycleBinParams) {
  const query = new URLSearchParams();
  if (params?.entityType && params.entityType !== 'ALL') query.append('entityType', params.entityType);
  if (params?.status && params.status !== 'ALL') query.append('status', params.status);
  if (params?.search) query.append('search', params.search);
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.offset) query.append('offset', String(params.offset));

  const url = `/recycle-bin${query.toString() ? `?${query.toString()}` : ''}`;
  return apiRequest<{
    items: RecycleBinItem[];
    total: number;
    limit: number;
    offset: number;
  }>(url);
}

export async function getRecycleBinStats() {
  return apiRequest<RecycleBinStats>('/recycle-bin/stats');
}

export async function getRecycleBinItem(id: number) {
  return apiRequest<RecycleBinItem>(`/recycle-bin/${id}`);
}

export async function restoreRecycleBinItem(id: number) {
  return apiRequest<{
    success: boolean;
    message: string;
    restoredItem: RecycleBinItem;
  }>(`/recycle-bin/restore/${id}`, {
    method: 'POST',
  });
}

export async function purgeRecycleBinItem(id: number) {
  return apiRequest<{
    success: boolean;
    message: string;
  }>(`/recycle-bin/${id}`, {
    method: 'DELETE',
  });
}
