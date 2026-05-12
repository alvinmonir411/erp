import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getCompanies } from '@/lib/api/companies';
import { getProducts } from '@/lib/api/products';
import {
  getLowStockProducts,
  getStockMovements,
  getStockSummary,
  getZeroStockProducts,
} from '@/lib/api/stock';
import { StockMovementQuery } from '@/types/api';

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: getCompanies,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProducts(companyId: number | null) {
  return useQuery({
    queryKey: ['products', companyId],
    queryFn: () => (companyId ? getProducts({ companyId }) : Promise.resolve([])),
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useStockSummary(companyId: number | null, search?: string) {
  return useQuery({
    queryKey: ['stock', 'summary', companyId, search],
    queryFn: () => getStockSummary(companyId ?? undefined, search),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useLowStock(companyId: number | null, search?: string) {
  return useQuery({
    queryKey: ['stock', 'low', companyId, search],
    queryFn: () => getLowStockProducts(companyId ?? undefined, 10, search),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useZeroStock(companyId: number | null, search?: string) {
  return useQuery({
    queryKey: ['stock', 'zero', companyId, search],
    queryFn: () => getZeroStockProducts(companyId ?? undefined, search),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useStockMovements(companyId: number | null, filters: StockMovementQuery) {
  return useQuery({
    queryKey: ['stock', 'movements', companyId, filters],
    queryFn: () => (companyId ? getStockMovements(companyId, filters) : Promise.resolve([])),
    enabled: !!companyId,
    staleTime: 10 * 1000,
    placeholderData: keepPreviousData,
  });
}
