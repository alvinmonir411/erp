'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  User as UserIcon,
  Store,
  Loader2,
  DollarSign
} from 'lucide-react';
import { getCollections } from '@/lib/api/dues';
import { formatCurrency } from '@/lib/utils/format';
import { useAuth } from '../auth/auth-provider';
import { Role } from '@/types/api';
import Link from 'next/link';

export function CollectionsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['due-collections'],
    queryFn: getCollections,
  });

  const filteredCollections = collections.filter((c: any) =>
    c.shop?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.srName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return { label: 'অনুমোদিত', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'REJECTED':
        return { label: 'বাতিলকৃত', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'PENDING':
        return { label: 'অনুমোদনের অপেক্ষায়', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { label: status, cls: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">বকেয়া ও কালেকশন ব্যবস্থাপনা</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">দোকানের বাকি পাওনা, নগদ আদায় ও পেমেন্ট অনুমোদন</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dues"
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <DollarSign className="w-4 h-4 text-indigo-600" />
            বকেয়া তালিকা
          </Link>
          <Link
            href="/dues/collections"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-500/20"
          >
            <Clock className="w-4 h-4" />
            আদায় হিস্ট্রি
          </Link>
          {user?.role === Role.SUPER_ADMIN && (
            <Link
              href="/dues/approvals"
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              পেমেন্ট অনুমোদন
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="আদায় হিস্ট্রি খুঁজুন (দোকান বা এসআর নাম)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
            />
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">দোকান ও অর্ডার</th>
                <th className="px-5 py-3.5">আদায়কারী (SR)</th>
                <th className="px-5 py-3.5">আদায়ের পরিমাণ</th>
                <th className="px-5 py-3.5">তারিখ</th>
                <th className="px-5 py-3.5">অবস্থা</th>
                <th className="px-5 py-3.5">নোট / কারণ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
                    <p className="mt-2 text-xs text-slate-400 font-bold">আদায় তালিকা লোড হচ্ছে...</p>
                  </td>
                </tr>
              ) : filteredCollections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm font-bold">
                    কোনো আদায়ের রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredCollections.map((c: any) => {
                  const badge = getStatusBadge(c.status);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-black text-slate-900 text-sm">{c.shop?.name}</p>
                          <p className="text-[10px] font-black text-indigo-600 tracking-tight">অর্ডার #{c.orderId}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800 text-xs">{c.srName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-black text-emerald-600 text-sm">{formatCurrency(c.collectedAmount)}</td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs font-semibold">
                        {new Date(c.collectionDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                        {c.note || '-'}
                        {c.rejectedReason && (
                          <p className="text-rose-500 font-bold mt-0.5">বাতিলের কারণ: {c.rejectedReason}</p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
              <p className="mt-2 text-xs text-slate-400 font-bold">আদায় তালিকা লোড হচ্ছে...</p>
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              কোনো আদায়ের রেকর্ড পাওয়া যায়নি।
            </div>
          ) : (
            filteredCollections.map((c: any) => {
              const badge = getStatusBadge(c.status);
              return (
                <div key={c.id} className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-slate-900 text-sm">{c.shop?.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">অর্ডার #{c.orderId} • এসআর: {c.srName}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 mt-1">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">আদায়ের পরিমাণ</p>
                      <p className="font-black text-emerald-600 text-base">{formatCurrency(c.collectedAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">তারিখ</p>
                      <p className="font-bold text-slate-700 text-xs">{new Date(c.collectionDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {(c.note || c.rejectedReason) && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {c.note && <p><span className="font-bold text-slate-700">নোট:</span> {c.note}</p>}
                      {c.rejectedReason && <p className="text-rose-500 font-bold mt-0.5">বাতিলের কারণ: {c.rejectedReason}</p>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
