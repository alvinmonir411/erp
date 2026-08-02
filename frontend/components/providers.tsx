"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, ReactNode } from 'react';
import { GlobalLoading } from './global-loading';
import { AuthProvider } from './auth/auth-provider';
import { LoadingProvider } from '@/lib/loading-context';
import { SocketProvider } from './providers/socket-provider';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.type === 'number'
      ) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.type === 'number'
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
