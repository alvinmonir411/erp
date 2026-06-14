'use client';

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

interface LoadingContextValue {
  isLoading: boolean;
  message: string;
  startLoading: (message?: string) => () => void;
}

const LoadingContext = createContext<LoadingContextValue>({
  isLoading: false,
  message: '',
  startLoading: () => () => {},
});

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<{ id: number; message: string }[]>([]);
  const counter = useRef(0);

  const startLoading = useCallback((message = 'Processing...') => {
    const id = ++counter.current;
    setStack(prev => [...prev, { id, message }]);
    return () => {
      setStack(prev => prev.filter(item => item.id !== id));
    };
  }, []);

  const isLoading = stack.length > 0;
  const message = stack[stack.length - 1]?.message ?? '';

  return (
    <LoadingContext.Provider value={{ isLoading, message, startLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  return useContext(LoadingContext);
}

/**
 * Wrap any async function with a global loading state.
 * Usage:
 *   const { withLoading } = useWithLoading();
 *   await withLoading(() => someApiCall(), 'Saving...');
 */
export function useWithLoading() {
  const { startLoading } = useGlobalLoading();

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, message?: string): Promise<T> => {
      const stop = startLoading(message);
      try {
        return await fn();
      } finally {
        stop();
      }
    },
    [startLoading],
  );

  return { withLoading };
}
