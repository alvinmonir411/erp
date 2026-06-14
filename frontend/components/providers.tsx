"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';
import { GlobalLoading } from './global-loading';
import { AuthProvider } from './auth/auth-provider';
import { LoadingProvider } from '@/lib/loading-context';
import { SocketProvider } from './providers/socket-provider';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000,   // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false, // WebSockets handle live cache invalidation
            refetchOnMount: true,
            refetchOnReconnect: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <LoadingProvider>
          <AuthProvider>
            <GlobalLoading />
            {children}
          </AuthProvider>
        </LoadingProvider>
      </SocketProvider>
    </QueryClientProvider>
  );
}
