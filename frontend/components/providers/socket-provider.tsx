'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface SocketContextType {
  socket: null;
  isConnected: boolean;
  isPolling: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isPolling: false,
});

export const useSocket = () => useContext(SocketContext);

const POLLING_INTERVAL_MS = 60000; // 60 seconds gentle background sync

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Gentle periodic background refresh for active dashboard and delivery views
    pollIntervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['delivery'], refetchType: 'active' });
    }, POLLING_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [queryClient]);

  return (
    <SocketContext.Provider value={{ socket: null, isConnected: false, isPolling: true }}>
      {children}
    </SocketContext.Provider>
  );
}
