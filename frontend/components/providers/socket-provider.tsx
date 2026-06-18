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

const POLLING_INTERVAL_MS = 15000;

const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5001/api';
  try {
    const url = new URL(apiUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return `${url.protocol}//${url.hostname}:5003`;
    }
    // Vercel Serverless does not support persistent WebSockets.
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
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['dues'] });
    queryClient.invalidateQueries({ queryKey: ['delivery'] });
    queryClient.invalidateQueries({ queryKey: ['stock'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient]);

  const handleSocketEvent = useCallback((eventType: string, data?: any) => {
    if (eventType.startsWith('order')) {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
    } else if (eventType.startsWith('batch')) {
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
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
      // Production (Vercel): Use silent HTTP polling instead of WebSocket
      setIsPolling(true);

      // Immediate first refresh on mount
      refreshAll();

      // Poll every 15 seconds
      pollIntervalRef.current = setInterval(refreshAll, POLLING_INTERVAL_MS);

      // Refresh when user switches back to this tab
      const handleFocus = () => refreshAll();
      window.addEventListener('focus', handleFocus);

      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        window.removeEventListener('focus', handleFocus);
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
