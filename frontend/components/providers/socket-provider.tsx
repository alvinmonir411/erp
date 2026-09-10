'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isPolling: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isPolling: false,
});

export const useSocket = () => useContext(SocketContext);

const POLLING_INTERVAL_MS = 60000; // 60 seconds gentle polling for background sync

const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
  try {
    const url = new URL(apiUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return `${url.protocol}//${url.hostname}:5003`;
    }
    // Vercel Serverless does not support persistent WebSockets unless NEXT_PUBLIC_SOCKET_URL is provided.
    return null;
  } catch (e) {
    return null;
  }
};

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const queryClient = useQueryClient();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshAll = useCallback(() => {
    // Targeted background sync: only revalidate actively displayed summary data
    queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
    queryClient.invalidateQueries({ queryKey: ['delivery'], refetchType: 'active' });
  }, [queryClient]);

  const handleSocketEvent = useCallback((eventType: string, data?: any) => {
    if (eventType.startsWith('order')) {
      queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['dues'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['delivery'], refetchType: 'active' });
    } else if (eventType.startsWith('batch')) {
      queryClient.invalidateQueries({ queryKey: ['delivery'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['stock'], refetchType: 'active' });
    }

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

    if (!socketUrl) {
      // Production (Vercel): Use gentle background polling for active screen
      setIsPolling(true);

      // Poll every 60 seconds gently
      pollIntervalRef.current = setInterval(refreshAll, POLLING_INTERVAL_MS);

      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setIsPolling(false);
      };
    }

    // Development / dedicated socket server: use WebSocket
    const socketInstance = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => setIsConnected(true));
    socketInstance.on('disconnect', () => setIsConnected(false));
    socketInstance.on('connect_error', () => setIsConnected(false));

    const events = ['orderCreated', 'orderUpdated', 'orderDeleted', 'batchCreated', 'batchUpdated', 'batchDeleted'];
    events.forEach(event => {
      socketInstance.on(event, (data) => handleSocketEvent(event, data));
    });

    setSocket(socketInstance);

    return () => {
      events.forEach(event => socketInstance.off(event));
      socketInstance.disconnect();
    };
  }, [handleSocketEvent, refreshAll]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isPolling }}>
      {children}
    </SocketContext.Provider>
  );
}
