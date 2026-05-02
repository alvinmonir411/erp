import { apiRequest } from './client';
import type { DeliveryPerson, DispatchBatch, Order } from '@/types/api';

export type DispatchBatchQuery = {
  companyId?: number;
  routeId?: number;
  deliveryPersonId?: number;
  dispatchDate?: string;
  status?: string;
  search?: string;
};

export type DashboardSummary = {
  totalBatches: number;
  draftBatches: number;
  dispatchedBatches: number;
  returnPending: number;
  settledBatches: number;
  grossDispatchedValue: number;
  finalSoldValue: number;
  totalDueAmount: number;
  totalCollections: number;
};

export type CreateDispatchBatchPayload = {
  dispatchDate: string;
  companyId?: number;
  routeId: number;
  deliveryPersonId: number;
  marketArea?: string;
  note?: string;
  orderIds: number[];
};

export type RecordReturnPayload = {
  note?: string;
  orders: {
    orderId: number;
    returnReason?: string;
    note?: string;
    items: {
      productId: number;
      dispatchedQuantity: number;
      returnedQuantity: number;
      damagedQuantity: number;
      reason?: string;
      note?: string;
    }[];
  }[];
};

export type SettlementPayload = {
  note?: string;
  collections: {
    orderId: number;
    collectedAmount: number;
    paymentMode?: string;
    note?: string;
  }[];
  dueEntries?: {
    orderId: number;
    amount: number;
    note?: string;
  }[];
};

export function getDeliveryDashboard(date?: string) {
  return apiRequest<DashboardSummary>('delivery-ops/dashboard', {
    query: { date },
  });
}

export function getDeliveryPeople(includeInactive = false) {
  return apiRequest<DeliveryPerson[]>('delivery-ops/personnel', {
    query: includeInactive ? { includeInactive: 'true' } : undefined,
  });
}

export function createDeliveryPerson(payload: Partial<DeliveryPerson>) {
  return apiRequest<DeliveryPerson>('delivery-ops/personnel', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateDeliveryPerson(id: number, payload: Partial<DeliveryPerson>) {
  return apiRequest<DeliveryPerson>(`delivery-ops/personnel/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteDeliveryPerson(id: number) {
  return apiRequest<{ deleted: boolean; softDelete?: boolean; message?: string }>(`delivery-ops/personnel/${id}`, {
    method: 'DELETE',
  });
}

export function getEligibleDispatchOrders(query: DispatchBatchQuery = {}) {
  return apiRequest<Order[]>('delivery-ops/confirmed-orders', {
    query,
  });
}

export function getDispatchBatches(query: DispatchBatchQuery = {}) {
  return apiRequest<DispatchBatch[]>('delivery-ops/batches', {
    query,
  });
}

export function getDispatchBatch(id: number) {
  return apiRequest<DispatchBatch>(`delivery-ops/batches/${id}`);
}

export function createDispatchBatch(payload: CreateDispatchBatchPayload) {
  return apiRequest<DispatchBatch>('delivery-ops/batches', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function markMorningPrinted(id: number) {
  return apiRequest<DispatchBatch>(`delivery-ops/batches/${id}/print-morning`, {
    method: 'PATCH',
  });
}

export function markBatchDispatched(id: number) {
  return apiRequest<DispatchBatch>(`delivery-ops/batches/${id}/dispatch`, {
    method: 'PATCH',
  });
}

export function recordBatchReturns(id: number, payload: RecordReturnPayload) {
  return apiRequest<DispatchBatch>(`delivery-ops/batches/${id}/returns`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function settleDispatchBatch(id: number, payload: SettlementPayload) {
  return apiRequest<DispatchBatch>(`delivery-ops/batches/${id}/settlement`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMorningDispatchReport(id: number) {
  return apiRequest<any>(`delivery-ops/batches/${id}/reports/morning`);
}

export function getFinalDispatchReport(id: number) {
  return apiRequest<any>(`delivery-ops/batches/${id}/reports/final`);
}

export function getDispatchReports(query: DispatchBatchQuery = {}) {
  return apiRequest<any>('delivery-ops/reports', {
    query,
  });
}
