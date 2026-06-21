import { apiRequest } from './client';
import type { DeliveryPerson, DispatchBatch, Order } from '@/types/api';

export type DispatchBatchQuery = {
  companyId?: number;
  routeId?: number;
  deliveryPersonId?: number;
  dispatchDate?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
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
  deliveryPersonId?: number;
  assignedDeliveryManId: string;
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
      returnedPaidQuantity: number;
      returnedFreeQuantity: number;
      damagedPaidQuantity: number;
      damagedFreeQuantity: number;
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
  actualCashReceived?: number;
};

export type DeliveryResultPayload = {
  status: 'DRAFT' | 'COMPLETED';
  items: {
    productId: number;
    returnedPaidQty: number;
    returnedFreeQty: number;
    damagedPaidQty: number;
    damagedFreeQty: number;
    returnReason?: string;
    damageReason?: string;
  }[];
  cashCollected: number;
  dueAmount: number;
  deliveryNote?: string;
};

export type CreateShopForOrderPayload = {
  name: string;
  ownerName?: string;
  phone?: string;
  address?: string;
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
  return apiRequest<any>('delivery-ops/batches', {
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

export function submitDeliveryResult(orderId: number, payload: DeliveryResultPayload) {
  return apiRequest<Order>(`delivery-ops/delivery-result/${orderId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createShopForOrder(orderId: number, payload: CreateShopForOrderPayload) {
  return apiRequest<Order>(`delivery-ops/orders/${orderId}/create-shop`, {
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

export function deleteDispatchBatch(id: number) {
  return apiRequest<{ success: boolean; message: string }>(`delivery-ops/batches/${id}`, {
    method: 'DELETE',
  });
}
