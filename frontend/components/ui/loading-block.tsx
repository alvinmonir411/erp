import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingBlockProps {
  label?: string;
  subLabel?: string;
  className?: string;
}

export function LoadingBlock({
  label = 'Loading data...',
  subLabel = 'Please wait a moment...',
  className = '',
}: LoadingBlockProps) {
  return (
    <div
      className={`relative flex min-h-[280px] w-full flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 p-8 shadow-sm transition-all duration-300 ${className}`}
    >
      <div className="relative flex items-center justify-center">
        {/* Soft pulse glow backdrop */}
        <div className="absolute h-16 w-16 rounded-full bg-indigo-500/15 animate-ping opacity-60" />
        
        {/* Modern icon container */}
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50/90 border border-indigo-100 shadow-sm">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        </div>
      </div>

      {/* Text Info */}
      <div className="mt-5 text-center space-y-1.5 max-w-sm">
        <p className="text-base font-bold text-slate-800 tracking-tight">{label}</p>
        {subLabel && (
          <p className="text-xs text-slate-500 font-medium leading-relaxed">{subLabel}</p>
        )}
      </div>

      {/* Animated subtle progress bar */}
      <div className="mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 animate-pulse" />
      </div>
    </div>
  );
}

