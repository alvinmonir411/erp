import { apiRequest } from './client';

export interface ActivityEvent {
  id: string;
  category: 'DELIVERY' | 'ORDERS' | 'COLLECTIONS' | 'STOCK' | 'PURCHASES' | 'AUTH' | 'SYSTEM' | string;
  action: string;
  title: string;
  description?: string;
  timestamp: string;
  userName?: string;
  userRole?: string;
  amount?: number | null;
  status?: string;
  entityType?: string;
  entityId?: string;
  route?: string | null;
  shop?: string | null;
  company?: string | null;
  details?: Record<string, any>;
}

export interface ActivityStats {
  totalEvents: number;
  deliveryEvents: number;
  orderEvents: number;
  collectionEvents: number;
  stockEvents: number;
  totalFinancialValue: number;
  todayCount: number;
}

export interface ActivityLogsResponse {
  items: ActivityEvent[];
  total: number;
  stats: ActivityStats;
  period: string;
}

export interface ActivityLogFilterParams {
  period?: 'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'all';
  category?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function getActivityLogs(params: ActivityLogFilterParams = {}) {
  const query = new URLSearchParams();
  if (params.period) query.append('period', params.period);
  if (params.category && params.category !== 'ALL') query.append('category', params.category);
  if (params.search) query.append('search', params.search);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.limit) query.append('limit', String(params.limit));
  if (params.offset) query.append('offset', String(params.offset));

  const url = `/activity-logs${query.toString() ? `?${query.toString()}` : ''}`;
  return apiRequest<ActivityLogsResponse>(url, {
    method: 'GET',
  });
}
