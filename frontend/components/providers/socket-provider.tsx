'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

const getSocketUrl = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5001/api';
  try {
    const url = new URL(apiUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return `${url.protocol}//${url.hostname}:5002`;
    }
    return `${url.protocol}//${url.host}`;
  } catch (e) {
    return 'http://localhost:5002';
  }
};

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = useCallback((eventType: string, data?: any) => {
    console.log(`[SocketProvider] Refreshing queries for event: ${eventType}`, data);
    
    // 1. Invalidate target query caches based on event domain to optimize database load
    if (eventType.startsWith('order')) {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
    } else if (eventType.startsWith('batch')) {
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    }

    // 2. Dispatch custom events for components using legacy/state-based fetching
    if (typeof window !== 'undefined') {
      if (eventType.startsWith('order')) {
        window.dispatchEvent(new CustomEvent('order-refresh', { detail: { eventType, data } }));
      } else if (eventType.startsWith('batch')) {
        window.dispatchEvent(new CustomEvent('batch-refresh', { detail: { eventType, data } }));
      }
    }
  }, [queryClient]);

  useEffect(() => {
    const socketUrl = getSocketUrl();
    console.log('[SocketProvider] Connecting to socket at:', socketUrl);
    const socketInstance = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('[SocketProvider] Connected to WebSocket server');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('[SocketProvider] Disconnected from WebSocket server');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('[SocketProvider] Connection Error:', err.message);
      setIsConnected(false);
    });

    // Domain event hooks
    const events = ['orderCreated', 'orderUpdated', 'orderDeleted', 'batchCreated', 'batchUpdated', 'batchDeleted'];
    events.forEach(event => {
      socketInstance.on(event, (data) => handleRefresh(event, data));
    });

    setSocket(socketInstance);

    return () => {
      events.forEach(event => socketInstance.off(event));
      socketInstance.disconnect();
    };
  }, [handleRefresh]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
