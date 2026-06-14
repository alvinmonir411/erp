'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useGlobalLoading } from '@/lib/loading-context';

export function GlobalLoading() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const { isLoading: isManualLoading, message } = useGlobalLoading();

  const isActive = isFetching > 0 || isMutating > 0 || isManualLoading;

  // Small delay to avoid flickering on fast requests
  const [show, setShow] = useState(false);
  useEffect(() => {
    let t: NodeJS.Timeout;
    if (isActive) t = setTimeout(() => setShow(true), 80);
    else setShow(false);
    return () => clearTimeout(t);
  }, [isActive]);

  if (!show) return null;

  return (
    <>
      {/* Full-screen semi-transparent backdrop — blocks all clicks while loading */}
      <div className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[1px]" />

      {/* Centered loading card */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div
          className="flex flex-col items-center gap-4 rounded-3xl border border-white/60 bg-white/95 px-10 py-8 shadow-2xl shadow-black/10 backdrop-blur-xl"
          style={{ animation: 'globalLoadIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          {/* Spinner ring */}
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
            <div
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500"
              style={{ animation: 'spin 0.7s linear infinite' }}
            />
            <div
              className="absolute inset-[6px] rounded-full border-2 border-transparent border-t-violet-400"
              style={{ animation: 'spin 1.1s linear infinite reverse' }}
            />
          </div>

          {/* Message */}
          <div className="text-center">
            <p className="text-sm font-black tracking-tight text-slate-800">
              {message || 'Please wait...'}
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Do not close or refresh
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes globalLoadIn {
          from { opacity: 0; transform: scale(0.88) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
