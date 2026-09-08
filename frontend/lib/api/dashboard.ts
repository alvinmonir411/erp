import { apiRequest } from './client';

export interface DashboardFilterParams {
  companyId?: number;
  period?: 'this_month' | 'last_month' | 'all_time' | 'custom';
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
