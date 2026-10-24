'use client';

import React, { useMemo } from 'react';
import { generateCode128Bars } from '@/lib/utils/barcode';

interface BarcodeViewProps {
  value: string;
  height?: number;
  width?: number; // module width in px
  showText?: boolean;
  className?: string;
}

export function BarcodeView({
  value,
  height = 48,
  width = 1.5,
  showText = true,
  className = '',
}: BarcodeViewProps) {
  const bars = useMemo(() => {
    try {
      return generateCode128Bars(value);
    } catch {
      return '';
    }
  }, [value]);

  if (!bars) {
    return <span className="text-xs text-rose-500 font-mono">Invalid Barcode</span>;
  }

  const svgWidth = bars.length * width;

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        width={svgWidth}
        height={height}
        viewBox={`0 0 ${svgWidth} ${height}`}
        className="shape-rendering-crispEdges block"
      >
        {bars.split('').map((char, index) => {
          if (char === '1') {
            return (
              <rect
                key={index}
                x={index * width}
                y={0}
                width={width}
                height={height}
                fill="#000000"
              />
            );
          }
          return null;
        })}
      </svg>
      {showText && (
        <span className="font-mono text-[11px] font-bold tracking-wider text-slate-800 mt-0.5 uppercase">
          {value}
        </span>
      )}
    </div>
  );
}
