'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  XCircle, 
  Store, 
  DollarSign, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  FileText, 
  Loader2, 
  TrendingDown, 
  Phone, 
  MapPin, 
  ShieldCheck,
  Receipt,
  User as UserIcon,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { getShopDues, getCollections } from '@/lib/api/dues';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface CustomerLedgerModalProps {
  shop: {
    id: number;
    name: string;
    ownerName?: string;
    phone?: string;
    address?: string;
    route?: { name: string };
  };
  onClose: () => void;
  onOpenMultiCollect: () => void;
  onViewOrder: (orderId: number) => void;
}

export function CustomerLedgerModal({
  shop,
  onClose,
  onOpenMultiCollect,
  onViewOrder,
}: CustomerLedgerModalProps) {
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'COLLECTIONS' | 'PROFILE'>('INVOICES');

  // Fetch shop's dues/invoices
  const { data: dues = [], isLoading: isDuesLoading } = useQuery({
    queryKey: ['shop-dues', shop.id],
    queryFn: () => getShopDues(shop.id),
  });

  // Fetch collections for this shop
  const { data: allCollections = [], isLoading: isCollectionsLoading } = useQuery({
    queryKey: ['due-collections'],
    queryFn: getCollections,
  });

  const shopCollections = useMemo(() => {
    return allCollections
      .filter((c: any) => String(c.shopId) === String(shop.id))
      .sort((a: any, b: any) => new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime());
  }, [allCollections, shop.id]);

  const totals = useMemo(() => {
    let totalOriginal = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    let bucketCurrent = 0; // 0-15 days
    let bucket16_30 = 0;
    let bucket31_60 = 0;
    let bucket60Plus = 0;

    const now = new Date().getTime();

    dues.forEach((d: any) => {
      const orig = Number(d.dueAmount || 0);
      const paid = Number(d.paidAmount || 0);
      const rem = Number(d.remainingDue || 0);

      totalOriginal += orig;
      totalPaid += paid;
      totalRemaining += rem;

      if (rem > 0) {
        const orderDateStr = d.dueDate || d.order?.orderDate || d.createdAt;
        const diffDays = orderDateStr 
          ? Math.floor((now - new Date(orderDateStr).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        if (diffDays <= 15) bucketCurrent += rem;
        else if (diffDays <= 30) bucket16_30 += rem;
        else if (diffDays <= 60) bucket31_60 += rem;
        else bucket60Plus += rem;
      }
    });

    return {
      totalOriginal,
      totalPaid,
      totalRemaining,
      bucketCurrent,
      bucket16_30,
      bucket31_60,
      bucket60Plus,
    };
  }, [dues]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] mb-0 pb-safe sm:pb-0">
        
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {shop.name}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" />
                  Verified Ledger
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                {shop.ownerName && <span>Owner: <strong className="text-slate-700">{shop.ownerName}</strong></span>}
                {shop.route?.name && <span>· Route: <strong className="text-slate-700">{shop.route.name}</strong></span>}
              </p>
              {shop.address && (
                <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                  <span className="font-semibold text-slate-700">{shop.address}</span>
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {shop.phone && (
              <a
                href={`tel:${shop.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-colors shadow-xs"
                title="Call Customer"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Call Customer</span>
              </a>
            )}
            <button 
              type="button" 
              onClick={onClose} 
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Financial Highlights Ribbon */}
        <div className="grid grid-cols-3 gap-2 p-3 sm:p-5 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 border-b border-slate-200">
          <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200">
            <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400">Total Invoiced</p>
            <p className="text-xs sm:text-base font-black text-slate-900 mt-0.5">
              {formatCurrency(totals.totalOriginal)}
            </p>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-emerald-200">
            <p className="text-[9px] sm:text-[10px] font-black uppercase text-emerald-600">Total Settled</p>
            <p className="text-xs sm:text-base font-black text-emerald-700 mt-0.5">
              {formatCurrency(totals.totalPaid)}
            </p>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-rose-200">
            <p className="text-[9px] sm:text-[10px] font-black uppercase text-rose-600">Outstanding Due</p>
            <p className="text-xs sm:text-base font-black text-rose-700 mt-0.5">
              {formatCurrency(totals.totalRemaining)}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-4 sm:px-6 pt-3 border-b border-slate-200 bg-white flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('INVOICES')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'INVOICES'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Orders & Due Invoices ({dues.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COLLECTIONS')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'COLLECTIONS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Payment Receipts History ({shopCollections.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'PROFILE'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className="w-4 h-4" />
            Shop Info & Aging Breakdown
          </button>
        </div>

        {/* Tab Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
          {/* TAB 1: INVOICES LIST */}
          {activeTab === 'INVOICES' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">
                  Customer Invoice Records ({dues.length} total)
                </span>
                {totals.totalRemaining > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMultiCollect();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Collect Payment
                  </button>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Order Invoice</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Delivery Person</th>
                      <th className="px-4 py-3 text-right">Invoiced Due</th>
                      <th className="px-4 py-3 text-right">Paid Amount</th>
                      <th className="px-4 py-3 text-right">Remaining</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isDuesLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1" />
                          Loading ledger invoices...
                        </td>
                      </tr>
                    ) : dues.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400 font-bold">
                          No transactions recorded for this customer yet.
                        </td>
                      </tr>
                    ) : (
                      dues.map((d: any) => {
                        const isOverdue = Number(d.remainingDue) > 0;
                        return (
                          <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => onViewOrder(d.orderId)}
                                className="font-black text-indigo-600 hover:underline block text-left"
                              >
                                Order #{d.orderId}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {formatDate(d.dueDate || d.order?.orderDate || d.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-slate-700 font-medium">
                              {d.deliveryManName || '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">
                              {formatCurrency(d.dueAmount)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-emerald-600">
                              {formatCurrency(d.paidAmount)}
                            </td>
                            <td className="px-4 py-3 text-right font-black">
                              <span className={isOverdue ? 'text-rose-600' : 'text-emerald-600'}>
                                {formatCurrency(d.remainingDue)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${
                                d.status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : d.status === 'PARTIAL'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {d.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View: High-Density Responsive Invoice Cards */}
              <div className="md:hidden flex flex-col gap-2.5">
                {isDuesLoading ? (
                  <div className="p-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    Loading invoices...
                  </div>
                ) : dues.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl">
                    No transactions recorded for this customer yet.
                  </div>
                ) : (
                  dues.map((d: any) => {
                    const isDue = Number(d.remainingDue) > 0;
                    return (
                      <div 
                        key={d.id} 
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => onViewOrder(d.orderId)}
                            className="font-black text-indigo-600 text-sm hover:underline flex items-center gap-1"
                          >
                            <span>Order #{d.orderId}</span>
                            <ExternalLink className="w-3 h-3 text-indigo-400" />
                          </button>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                            d.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : d.status === 'PARTIAL'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {d.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-100 text-center">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Invoiced</span>
                            <span className="text-xs font-bold text-slate-900">{formatCurrency(d.dueAmount)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Paid</span>
                            <span className="text-xs font-bold text-emerald-600">{formatCurrency(d.paidAmount)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Remaining</span>
                            <span className={`text-xs font-black ${isDue ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {formatCurrency(d.remainingDue)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                          <span>Date: <strong>{formatDate(d.dueDate || d.order?.orderDate || d.createdAt)}</strong></span>
                          <span>Delivery: <strong>{d.deliveryManName || '—'}</strong></span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: COLLECTIONS RECEIPTS HISTORY */}
          {activeTab === 'COLLECTIONS' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-600">
                Past Payment Collection Records ({shopCollections.length} total)
              </span>

              {isCollectionsLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1" />
                  Loading payment history...
                </div>
              ) : shopCollections.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl">
                  No payment collections recorded for this customer yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {shopCollections.map((c: any) => (
                    <div 
                      key={c.id} 
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">Order #{c.orderId}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                            c.status === 'APPROVED' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : c.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Collector: <strong className="text-slate-700">{c.srName || 'SR'}</strong> · Date: <strong>{formatDate(c.collectionDate)}</strong>
                        </p>
                        {c.note && (
                          <p className="text-[11px] text-slate-600 mt-1 bg-white p-2 rounded-lg border border-slate-200">
                            {c.note}
                          </p>
                        )}
                      </div>

                      <div className="text-left sm:text-right flex-shrink-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Amount Collected</span>
                        <span className="text-base sm:text-lg font-black text-emerald-600">
                          {formatCurrency(c.collectedAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SHOP PROFILE & AGING ANALYSIS */}
          {activeTab === 'PROFILE' && (
            <div className="space-y-4">
              {/* Profile Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Shop & Contact Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Shop Name:</span>
                    <strong className="text-slate-900 text-sm">{shop.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Owner / Proprietor:</span>
                    <strong className="text-slate-900 text-sm">{shop.ownerName || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Phone Number:</span>
                    {shop.phone ? (
                      <a href={`tel:${shop.phone}`} className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {shop.phone}
                      </a>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Route / Area:</span>
                    <strong className="text-slate-900">{shop.route?.name || 'Unassigned'}</strong>
                  </div>
                  {shop.address && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[10px]">Address:</span>
                      <span>{shop.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Aging Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Receivable Aging Breakdown
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">0-15 Days (Current)</p>
                    <p className="text-sm font-black text-emerald-600 mt-0.5">{formatCurrency(totals.bucketCurrent)}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">16-30 Days</p>
                    <p className="text-sm font-black text-indigo-600 mt-0.5">{formatCurrency(totals.bucket16_30)}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">31-60 Days</p>
                    <p className="text-sm font-black text-amber-600 mt-0.5">{formatCurrency(totals.bucket31_60)}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
                    <p className="text-[10px] font-bold text-rose-500 uppercase">60+ Days (Overdue)</p>
                    <p className="text-sm font-black text-rose-600 mt-0.5">{formatCurrency(totals.bucket60Plus)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Sticky Bottom Bar */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Net Due:</span>
            <span className="text-sm sm:text-base font-black text-rose-600">
              {formatCurrency(totals.totalRemaining)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {totals.totalRemaining > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMultiCollect();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all"
              >
                <DollarSign className="w-4 h-4" />
                <span>Collect Payment</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
