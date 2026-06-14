'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';
import { GlobalLoading } from './global-loading';
import { AuthProvider } from './auth/auth-provider';
import { LoadingProvider } from '@/lib/loading-context';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            gcTime: 0,
            retry: 1,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            refetchOnReconnect: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <AuthProvider>
          <GlobalLoading />
          {children}
        </AuthProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}
