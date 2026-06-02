import { apiRequest } from './client';
import type {
  CompanyWiseDueSummary,
  CompanyWiseSalesSummary,
  CreateManualDuePayload,
  CreateSalePayload,
  DueOverviewSummary,
  ManualDueResponse,
  MonthlySalesSummary,
  PaginatedResponse,
  ReceiveSalePaymentPayload,
  RouteWiseDueSummary,
  RouteWiseSalesSummary,
  Sale,
  SalesQuery,
  ShopDueDetails,
  ShopWiseDueSummary,
  TodayProfitSummary,
  TodaySalesSummary,
} from '@/types/api';

export function getSales(query: SalesQuery = {}) {
  return apiRequest<PaginatedResponse<Sale>>('sales', {
    query,
  });
}

export function getSale(id: number) {
  return apiRequest<Sale>(`sales/${id}`);
}

export function createSale(payload: CreateSalePayload) {
  return apiRequest<Sale>('sales', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function receiveSalePayment(id: number, payload: ReceiveSalePaymentPayload) {
  return apiRequest<Sale>(`sales/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addManualDue(payload: CreateManualDuePayload) {
  return apiRequest<ManualDueResponse>('sales/manual-due', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSale(id: number, payload: CreateSalePayload) {
  return apiRequest<Sale>(`sales/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteSale(id: number) {
  return apiRequest<{ success: boolean }>(`sales/${id}`, {
    method: 'DELETE',
  });
}

export function getTodaySalesSummary(query: SalesQuery = {}) {
  return apiRequest<TodaySalesSummary>('sales/summary/today-sales', {
    query,
  });
}

export function getTodayProfitSummary(query: SalesQuery = {}) {
  return apiRequest<TodayProfitSummary>('sales/summary/today-profit', {
    query,
  });
}

export function getMonthlySalesSummary(query: SalesQuery = {}) {
  const today = new Date();

  return apiRequest<MonthlySalesSummary>('sales/summary/monthly', {
    query: {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      ...query,
    },
  });
}

export function getRouteWiseSalesSummary(query: SalesQuery = {}) {
  return apiRequest<RouteWiseSalesSummary[]>('sales/summary/route-wise', {
    query,
  });
}

export function getCompanyWiseSalesSummary(query: SalesQuery = {}) {
  return apiRequest<CompanyWiseSalesSummary[]>('sales/summary/company-wise', {
    query,
  });
}

export function getRouteWiseDueSummary(query: SalesQuery = {}) {
  return apiRequest<RouteWiseDueSummary[]>('sales/summary/route-wise-due', {
    query,
  });
}

export function getShopWiseDueSummary(query: SalesQuery = {}) {
  return apiRequest<ShopWiseDueSummary[]>('sales/summary/shop-wise-due', {
    query,
  });
}

export function getCompanyWiseDueSummary(query: SalesQuery = {}) {
  return apiRequest<CompanyWiseDueSummary[]>('sales/summary/company-wise-due', {
    query,
  });
}

export function getDueOverview(query: SalesQuery = {}) {
  return apiRequest<DueOverviewSummary>('sales/summary/due-overview', {
    query,
  });
}

export function getShopDueDetails(shopId: number) {
  return apiRequest<ShopDueDetails>(`sales/shops/${shopId}/due-details`);
}

export type DailySummaryReportGroupItem = {
  productId: number;
  productName: string;
  quantitySold: number;
  unitPrice: number;
  totalAmount: number;
};

export type DailySummaryReportGroup = {
  companyId: number;
  companyName: string;
  items: DailySummaryReportGroupItem[];
  subtotalQuantity: number;
  subtotalAmount: number;
};

export type DailySummaryReport = {
  date: string;
  scope: 'all' | 'company';
  companyId: number | null;
  groups: DailySummaryReportGroup[];
  grandTotalQuantity: number;
  grandTotalAmount: number;
};

export function getDailySummaryReport(query: { date?: string; companyId?: number; routeId?: number; scope?: 'all' | 'company' }) {
  return apiRequest<DailySummaryReport>('delivery-summaries/reports/daily-summary', {
    query,
  });
}
