'use client';

import { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock3,
  HandCoins,
  Printer,
  Route,
  Truck,
  Undo2,
} from 'lucide-react';
import { DispatchBatchStatus, OrderStatus } from '@/types/api';

export const orderStatusConfig: Record<
  OrderStatus,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-slate-100 text-slate-700',
    icon: Clock3,
  },
  CONFIRMED: {
    label: 'Confirmed',
    className: 'bg-blue-100 text-blue-700',
    icon: CheckCircle,
  },
  ASSIGNED: {
    label: 'Assigned',
    className: 'bg-cyan-100 text-cyan-700',
    icon: Route,
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    className: 'bg-amber-100 text-amber-700',
    icon: Truck,
  },
  PARTIALLY_DELIVERED: {
    label: 'Partial Delivered',
    className: 'bg-orange-100 text-orange-700',
    icon: Undo2,
  },
  DELIVERED: {
    label: 'Delivered',
    className: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle,
  },
  RETURNED_PARTIAL: {
    label: 'Returned Partial',
    className: 'bg-rose-100 text-rose-700',
    icon: Undo2,
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-rose-100 text-rose-700',
    icon: AlertTriangle,
  },
  PARTIAL_DUE: {
    label: 'Partial Due',
    className: 'bg-amber-100 text-amber-700',
    icon: HandCoins,
  },
  SETTLED: {
    label: 'Settled',
    className: 'bg-violet-100 text-violet-700',
    icon: HandCoins,
  },
};

export const batchStatusConfig: Record<
  DispatchBatchStatus,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-slate-100 text-slate-700',
    icon: Clock3,
  },
  PRINTED: {
    label: 'Printed',
    className: 'bg-blue-100 text-blue-700',
    icon: Printer,
  },
  DISPATCHED: {
    label: 'Dispatched',
    className: 'bg-amber-100 text-amber-700',
    icon: Truck,
  },
  RETURN_PENDING: {
    label: 'Return Pending',
    className: 'bg-orange-100 text-orange-700',
    icon: Undo2,
  },
  PARTIALLY_SETTLED: {
    label: 'Partial Settled',
    className: 'bg-fuchsia-100 text-fuchsia-700',
    icon: HandCoins,
  },
  SETTLED: {
    label: 'Settled',
    className: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle,
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-rose-100 text-rose-700',
    icon: AlertTriangle,
  },
};

export function StatusBadge({
  label,
  className,
  icon: Icon,
}: {
  label: string;
  className: string;
  icon: typeof Clock3;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-3 text-slate-700">
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
        {label}
      </p>
      <h3 className="mt-2 text-2xl font-black text-slate-900">{value}</h3>
      {hint ? <p className="mt-2 text-xs font-medium text-slate-500">{hint}</p> : null}
    </div>
  );
}
