'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeViewProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCodeView({ value, size = 56, className = '' }: QrCodeViewProps) {
  const [svgString, setSvgString] = useState<string>('');

  useEffect(() => {
    if (!value) return;
    let isMounted = true;
    QRCode.toString(
      value,
      {
        type: 'svg',
        width: size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      },
      (err, string) => {
        if (!err && string && isMounted) {
          setSvgString(string);
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (!svgString) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-slate-100 animate-pulse rounded ${className}`}
      />
    );
  }

  return (
    <div
      className={`inline-block select-none ${className}`}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
}
