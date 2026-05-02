import { apiRequest } from './client';

export type StockMovementType = 'OPENING' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'RETURN_IN' | 'DAMAGE' | 'SALE';

export interface CreateStockMovementPayload {
  productId: number;
  companyId: number;
  type: StockMovementType;
  quantity: number;
  note?: string;
  reference?: string;
}

export function createStockMovement(payload: CreateStockMovementPayload) {
  return apiRequest<any>('stock/movements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getStockHistory(params: {
  companyId?: number;
  productId?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  return apiRequest<any[]>('stock/history', {
    query: params as Record<string, any>,
  });
}

export function getStockSummary(companyId?: number, search?: string) {
  return apiRequest<any>('stock/summary', {
    query: {
      companyId,
      search,
    },
  });
}

export function getStockMovements(companyId?: number, filters: Record<string, any> = {}) {
  return getStockHistory({
    companyId,
    ...filters,
  });
}

export async function getLowStockProducts(
  companyId?: number,
  threshold = 10,
  search?: string,
) {
  const data: any = await getStockSummary(companyId, search);
  const list = Array.isArray(data) ? data : data.currentStockList || [];
  return list.filter(
    (item: any) =>
      Number(item.currentStock || 0) > 0 && Number(item.currentStock || 0) <= threshold,
  );
}

export async function getZeroStockProducts(companyId?: number, search?: string) {
  const data: any = await getStockSummary(companyId, search);
  const list = Array.isArray(data) ? data : data.currentStockList || [];
  return list.filter((item: any) => Number(item.currentStock || 0) <= 0);
}

export async function getStockInvestmentSummary(
  companyId?: number,
  search?: string,
) {
  return getStockSummary(companyId, search);
}

export function addDamage(payload: {
  companyId: number;
  productId: number;
  quantity: number;
  note?: string;
  movementDate?: string;
}) {
  return createStockMovement({
    companyId: payload.companyId,
    productId: payload.productId,
    quantity: -Math.abs(payload.quantity),
    note: payload.note,
    reference: payload.movementDate,
    type: 'DAMAGE',
  });
}
