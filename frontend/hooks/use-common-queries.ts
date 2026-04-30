import { useQuery } from '@tanstack/react-query';
import { getCompanies } from '@/lib/api/companies';
import { getRoutes } from '@/lib/api/routes';
import { getShops } from '@/lib/api/shops';
import { getProducts } from '@/lib/api/products';
import { Company, Route, Shop, Product } from '@/types/api';

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: () => getCompanies() as Promise<Company[]>,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: () => getRoutes() as Promise<Route[]>,
    staleTime: 5 * 60 * 1000,
  });
}

export function useShops(routeId?: number | null) {
  return useQuery({
    queryKey: ['shops', routeId],
    queryFn: () => getShops(routeId ?? undefined) as Promise<Shop[]>,
    staleTime: 2 * 60 * 1000,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => getProducts() as Promise<Product[]>,
    staleTime: 5 * 60 * 1000,
  });
}
