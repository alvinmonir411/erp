'use client';

import { useMemo, memo } from 'react';
import { formatNumber, toNumber } from '@/lib/utils/format';
import { StockSummaryItem } from '@/types/api';

type StockSummaryTableProps = {
  items: StockSummaryItem[];
  onQuickAction?: (productId: number, mode: 'stock-in' | 'adjustment') => void;
};

export const StockSummaryTable = memo(function StockSummaryTable({
  items,
  onQuickAction,
}: StockSummaryTableProps) {
  const totalQty = useMemo(() => items.reduce((sum, item) => sum + toNumber(item.currentStock), 0), [items]);
  const totalValue = useMemo(() => items.reduce((sum, item) => sum + toNumber(item.investmentValue), 0), [items]);

  if (items.length === 0) {
    return (
      <div className="rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
        <p className="text-sm font-semibold text-slate-500">No products found matching the filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[1fr_120px_140px_160px_100px] gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <div>Product Info</div>
            <div className="text-right">Unit Price</div>
            <div className="text-center">Live Status</div>
            <div>Value</div>
            <div className="text-right">Action</div>
          </div>
          {items.map((item) => (
            <div key={item.productId} className="grid grid-cols-[1fr_120px_140px_160px_100px] items-center gap-4 border-b border-slate-100 px-6 py-5 last:border-0 hover:bg-slate-50/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${getStockToneClassName(item)} font-bold`}>
                  {item.productName[0]}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{item.productName}</p>
                  <p className="mt-0.5 text-xs text-slate-400">SKU: {item.sku} • {item.company?.name}</p>
                </div>
              </div>
              <div className="text-right font-semibold text-slate-600">
                {formatNumber(item.salePrice ?? 0)}
              </div>
              <div className="text-center">
                <p className={`text-lg font-bold tabular-nums ${item.isZeroStock ? 'text-rose-600' : item.isLowStock ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {formatNumber(item.currentStock)}
                </p>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-1.5 rounded-full ${getStockMeterClassName(item)}`} style={{ width: getStockMeterWidth(item) }} />
                </div>
                <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStockStateBadgeClassName(item)}`}>
                  {getStockStateLabel(item)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Tk {formatNumber(item.investmentValue ?? 0)}</p>
                <p className="text-[10px] text-slate-400">@{formatNumber(item.buyPrice)}/unit</p>
              </div>
              <div className="flex flex-col gap-1">
                {onQuickAction && (
                  <>
                    <button
                      type="button"
                      onClick={() => onQuickAction(item.productId, 'stock-in')}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Stock In
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickAction(item.productId, 'adjustment')}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-700 transition hover:bg-amber-100"
                    >
                      Adjust
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3.5">
        <p className="text-xs font-medium text-slate-400">{items.length} product{items.length === 1 ? '' : 's'} shown</p>
        <div className="flex gap-6 text-xs font-bold">
          <div><span className="text-slate-400 font-medium">Total Qty: </span><span className="text-slate-900">{formatNumber(totalQty)}</span></div>
          <div><span className="text-slate-400 font-medium">Total Value: </span><span className="text-slate-900">Tk {formatNumber(totalValue)}</span></div>
        </div>
      </div>
    </div>
  );
});

function getStockStateLabel(item: StockSummaryItem) {
  if (item.isZeroStock) return 'Out of stock';
  if (item.isLowStock) return 'Low stock';
  return 'Healthy stock';
}

function getStockStateBadgeClassName(item: StockSummaryItem) {
  if (item.isZeroStock) return 'bg-rose-100 text-rose-700';
  if (item.isLowStock) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

function getStockToneClassName(item: StockSummaryItem) {
  if (item.isZeroStock) return 'bg-rose-50 text-rose-900';
  if (item.isLowStock) return 'bg-amber-50 text-amber-900';
  return 'bg-emerald-50 text-emerald-900';
}

function getStockMeterClassName(item: StockSummaryItem) {
  if (item.isZeroStock) return 'bg-rose-500';
  if (item.isLowStock) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function getStockMeterWidth(item: StockSummaryItem) {
  if (item.isZeroStock) return '10%';
  if (item.isLowStock) return '42%';
  return '84%';
}
