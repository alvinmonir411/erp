'use client';

import React from 'react';
import { Search, X, Eye, Loader2 } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

export type DrilldownType = 'sales' | 'orders' | 'collections' | 'dues' | 'dispatches' | 'cancelled' | null;

export interface DrilldownViewProps {
  type: DrilldownType;
  periodTitle: string;
  items: any[];
  isLoading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onClose: () => void;
  onViewOrder: (orderId: number) => void;
  accentColor?: 'indigo' | 'rose' | 'emerald' | 'amber' | 'cyan' | 'slate';
}

export function DrilldownView({
  type,
  periodTitle,
  items,
  isLoading,
  search,
  onSearchChange,
  onClose,
  onViewOrder,
  accentColor = 'indigo',
}: DrilldownViewProps) {
  if (!type) return null;

  const getTitle = () => {
    switch (type) {
      case 'sales':
        return `Delivered Sales Breakdown (${items.length} Invoices)`;
      case 'orders':
        return `Booked Orders List (${items.length} Orders)`;
      case 'collections':
        return `Cash Collection Records (${items.length} Collections)`;
      case 'dues':
        return `New Market Due Invoices (${items.length} Invoices)`;
      case 'dispatches':
        return `Delivery Dispatch Batches (${items.length} Batches)`;
      case 'cancelled':
        return `Cancelled Orders List (${items.length} Cancelled)`;
      default:
        return 'Detailed Breakdown';
    }
  };

  const borderClass =
    accentColor === 'rose'
      ? 'border-rose-200'
      : accentColor === 'emerald'
      ? 'border-emerald-200'
      : accentColor === 'amber'
      ? 'border-amber-200'
      : accentColor === 'cyan'
      ? 'border-cyan-200'
      : accentColor === 'slate'
      ? 'border-slate-300'
      : 'border-indigo-200';

  const dotClass =
    accentColor === 'rose'
      ? 'bg-rose-500'
      : accentColor === 'emerald'
      ? 'bg-emerald-500'
      : accentColor === 'amber'
      ? 'bg-amber-500'
      : accentColor === 'cyan'
      ? 'bg-cyan-500'
      : accentColor === 'slate'
      ? 'bg-slate-700'
      : 'bg-indigo-600';

  return (
    <div className={`bg-white rounded-2xl border ${borderClass} p-4 sm:p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${dotClass} animate-ping`} />
            <h3 className="text-base sm:text-lg font-black text-slate-900">{getTitle()}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Period: <span className="font-bold text-indigo-700">{periodTitle}</span> • Click any order to view memo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter this list..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 w-44 sm:w-56"
            />
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-rose-500" />
            Close Table
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="mt-4 overflow-x-auto">
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="mt-2 text-xs font-bold text-slate-400">Loading data...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-bold">
            No records found for this filter.
          </div>
        ) : (
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
              {type === 'sales' && (
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Shop Name</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Delivery Person</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Settled Sales</th>
                  <th className="px-4 py-3 text-right">Due Amount</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              )}
              {type === 'orders' && (
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Shop Name</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Sales Rep (SR)</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Order Value</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              )}
              {type === 'collections' && (
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Shop Name</th>
                  <th className="px-4 py-3">Collected By (SR)</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Collected Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              )}
              {type === 'dues' && (
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Shop Name</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Sales Rep (SR)</th>
                  <th className="px-4 py-3 text-right">Original Due</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Remaining Due</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              )}
              {type === 'dispatches' && (
                <tr>
                  <th className="px-4 py-3">Batch #</th>
                  <th className="px-4 py-3">Delivery Person</th>
                  <th className="px-4 py-3">Dispatch Date</th>
                  <th className="px-4 py-3 text-center">Orders Count</th>
                  <th className="px-4 py-3 text-right">Total Batch Value</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              )}
              {type === 'cancelled' && (
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Shop Name</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Sales Rep (SR)</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Order Value</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  {type === 'sales' && (
                    <>
                      <td className="px-4 py-3 font-black text-indigo-600">#{item.id}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.shopName}</td>
                      <td className="px-4 py-3 text-slate-500">{item.routeName || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{item.deliveryManName || item.deliveryPersonName || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{item.orderDate || (item.settledAt ? new Date(item.settledAt).toLocaleDateString() : '—')}</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-600">{formatCurrency(item.soldAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(item.dueAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onViewOrder(item.id)}
                          className="inline-flex items-center gap-1 text-indigo-600 font-black hover:underline cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Memo
                        </button>
                      </td>
                    </>
                  )}
                  {type === 'orders' && (
                    <>
                      <td className="px-4 py-3 font-black text-indigo-600">#{item.id}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.shopName}</td>
                      <td className="px-4 py-3 text-slate-500">{item.routeName || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{item.srName || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{item.orderDate || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—')}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">{formatCurrency(item.grandTotal)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-black">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onViewOrder(item.id)}
                          className="inline-flex items-center gap-1 text-indigo-600 font-black hover:underline cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Memo
                        </button>
                      </td>
                    </>
                  )}
                  {type === 'collections' && (
                    <>
                      <td className="px-4 py-3 font-black text-indigo-600">#{item.orderId || item.id}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.shopName}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{item.srName || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {item.collectionDate || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—')}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-600">{formatCurrency(item.collectedAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${
                          item.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          item.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {item.status === 'APPROVED' ? 'Approved' : item.status === 'PENDING' ? 'Pending' : 'Cancelled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.orderId ? (
                          <button
                            onClick={() => onViewOrder(item.orderId)}
                            className="inline-flex items-center gap-1 text-indigo-600 font-black hover:underline cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Memo
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </>
                  )}
                  {type === 'dues' && (
                    <>
                      <td className="px-4 py-3 font-black text-indigo-600">#{item.orderId || item.id}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.shopName}</td>
                      <td className="px-4 py-3 text-slate-500">{item.routeName || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{item.srName || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(item.dueAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(item.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-black text-rose-600">{formatCurrency(item.remainingDue)}</td>
                      <td className="px-4 py-3 text-center">
                        {item.orderId ? (
                          <button
                            onClick={() => onViewOrder(item.orderId)}
                            className="inline-flex items-center gap-1 text-indigo-600 font-black hover:underline cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Memo
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </>
                  )}
                  {type === 'dispatches' && (
                    <>
                      <td className="px-4 py-3 font-black text-indigo-600">#{item.batchNumber}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.deliveryPersonName || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{item.dispatchDate || (item.dispatchedAt ? new Date(item.dispatchedAt).toLocaleDateString() : '—')}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">{item.totalOrders}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">{formatCurrency(item.totalAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200">
                          {item.status}
                        </span>
                      </td>
                    </>
                  )}
                  {type === 'cancelled' && (
                    <>
                      <td className="px-4 py-3 font-black text-rose-600">#{item.id}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.shopName}</td>
                      <td className="px-4 py-3 text-slate-500">{item.routeName || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{item.srName || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{item.orderDate || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—')}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">{formatCurrency(item.grandTotal)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-black border border-rose-200">
                          {item.status || 'CANCELLED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onViewOrder(item.id)}
                          className="inline-flex items-center gap-1 text-indigo-600 font-black hover:underline cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Memo
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
