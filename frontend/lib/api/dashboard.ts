import { apiRequest } from './client';

export interface DashboardFilterParams {
  companyId?: number;
  period?: 'today' | 'last_7_days' | 'this_month' | 'last_month' | 'this_year' | 'all_time' | 'custom';
  month?: number;
  year?: number;
}

export async function getDashboardMetrics(params: DashboardFilterParams = {}) {
  return apiRequest<any>('/dashboard/metrics', {
    method: 'GET',
    query: {
      companyId: params.companyId,
      period: params.period,
      month: params.month,
      year: params.year,
    },
  });
}

export interface DashboardDrilldownParams extends DashboardFilterParams {
  type: 'sales' | 'orders' | 'collections' | 'dues' | 'dispatches' | 'cancelled' | 'top_products' | 'profit';
  page?: number;
  limit?: number;
}

export async function getDashboardDrilldown(params: DashboardDrilldownParams) {
  return apiRequest<any>('/dashboard/drilldown', {
    method: 'GET',
    query: {
      type: params.type,
      companyId: params.companyId,
      period: params.period,
      month: params.month,
      year: params.year,
      page: params.page,
      limit: params.limit,
    },
  });
}
