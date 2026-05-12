import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getProducts } from '@/lib/api/products';

export function useProductsList(companyId?: number | null) {
  return useQuery({
    queryKey: ['products', 'list', companyId],
    queryFn: () => getProducts(companyId ? { companyId } : undefined),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}
