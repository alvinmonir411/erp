import { apiRequest } from './client';
import type { Order } from '@/types/api';

export interface CreateOrderPayload {
  orderDate: string;
  companyId: number;
  routeId: number;
  deliveryPersonId?: number;
  marketArea?: string;
  shopId?: number;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number;
  advancePaid?: number;
  note?: string;
  items: {
    productId: number;
    quantity: number;
    freeQuantity: number;
    unitPrice: number;
    discountType: 'FIXED' | 'PERCENT';
    discountValue: number;
  }[];
}

export function createOrder(payload: CreateOrderPayload) {
  return apiRequest<Order>('orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getOrders(query?: Record<string, any>) {
  return apiRequest<Order[]>('orders', { query });
}

export function getOrder(id: number) {
  return apiRequest<Order>(`orders/${id}`);
}

export function getOrderStats() {
  return apiRequest<Record<string, number>>('orders/stats');
}

export function updateOrderStatus(id: number, status: string) {
  return apiRequest<Order>(`orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function updateOrder(id: number, payload: CreateOrderPayload) {
  return apiRequest<Order>(`orders/${id}/update`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteOrder(id: number) {
  return apiRequest<{ affected?: number }>(`orders/${id}`, {
    method: 'DELETE',
  });
}

export function settleOrder(id: number, payload: { items: any[], collectedAmount?: number, settlementNote?: string }) {
  return apiRequest<Order>(`orders/${id}/settle`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateOrderShop(id: number, shopId: number) {
  return apiRequest<Order>(`orders/shop-link/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ shopId }),
  });
}
