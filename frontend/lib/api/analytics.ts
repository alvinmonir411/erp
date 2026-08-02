import { apiRequest } from './client';

export interface BusinessOverviewParams {
  datePreset?: string;
  startDate?: string;
  endDate?: string;
  routeId?: string | number;
  deliveryManId?: string;
  companyId?: string | number;
  productId?: string | number;
}

export async function getBusinessOverview(params: BusinessOverviewParams = {}) {
  return apiRequest<any>('analytics/business-overview', {
    query: params as Record<string, any>,
  });
}
