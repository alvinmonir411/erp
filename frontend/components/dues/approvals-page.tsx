'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  User as UserIcon, 
  Store, 
  DollarSign, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';
import { getPendingCollections, approveCollection, rejectCollection } from '@/lib/api/dues';
import { formatCurrency } from '@/lib/utils/format';
import Link from 'next/link';
import { useAuth } from '../auth/auth-provider';
import { Role } from '@/types/api';
import { useToast } from '@/components/ui/toast-provider';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<any | null>(null);

  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: getPendingCollections,
  });

  const approveMutation = useMutation({
    mutationFn: approveCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      queryClient.invalidateQueries({ queryKey: ['due-stats'] });
      showSuccessToast('পেমেন্টটি সফলভাবে অনুমোদন করা হয়েছে এবং বাকি ব্যালেন্স আপডেট হয়েছে।');
    },
    onError: (err: any) => {
      showErrorToast(err.message || 'পেমেন্ট অনুমোদন করতে ব্যর্থ হয়েছে।');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectCollection(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      setIsRejectModalOpen(false);
      setRejectReason('');
      showSuccessToast('পেমেন্ট কালেকশনটি বাতিল করা হয়েছে।');
    },
    onError: (err: any) => {
      showErrorToast(err.message || 'পেমেন্ট বাতিল করতে ব্যর্থ হয়েছে।');
    }
  });

  const filteredPending = pending.filter((c: any) => 
    c.shop?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.srName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user?.role !== Role.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900">অনুমতি নেই</h2>
        <p className="text-sm text-slate-500 max-w-md">শুধুমাত্র সুপার অ্যাডমিন পেমেন্ট কালেকশন অনুমোদন বা বাতিল করতে পারবেন।</p>
      </div>
    );
  }

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
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Clock className="w-4 h-4 text-amber-500" />
            আদায় হিস্ট্রি
          </Link>
          {user?.role === Role.SUPER_ADMIN && (
            <Link
              href="/dues/approvals"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-500/20"
            >
              <CheckCircle className="w-4 h-4" />
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
              placeholder="দোকান বা এসআর নাম দিয়ে খুঁজুন..."
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
                <th className="px-5 py-3.5">জমাকৃত টাকার পরিমাণ</th>
                <th className="px-5 py-3.5">বাকি ব্যালেন্স পরিবর্তন</th>
                <th className="px-5 py-3.5">তারিখ</th>
                <th className="px-5 py-3.5 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto mb-2" />
                    পেন্ডিং রিকোয়েস্ট লোড হচ্ছে...
                  </td>
                </tr>
              ) : filteredPending.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm font-bold">
                    অনুমোদনের অপেক্ষায় কোনো পেমেন্ট রিকোয়েস্ট নেই।
                  </td>
                </tr>
              ) : (
                filteredPending.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 leading-none text-sm">{c.shop?.name}</p>
                          <p className="text-[10px] font-black text-indigo-600 mt-1">অর্ডার #{c.orderId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-slate-800 text-xs">{c.srName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-black text-emerald-600 text-sm sm:text-base">{formatCurrency(c.collectedAmount)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                       <div className="flex flex-col text-[11px]">
                          <span className="text-rose-600 font-bold">পূর্বে: {formatCurrency(c.due?.remainingDue || 0)}</span>
                          <span className="text-emerald-700 font-black">অনুমোদনের পর: {formatCurrency(Math.max(0, (c.due?.remainingDue || 0) - c.collectedAmount))}</span>
                       </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs font-semibold">
                      {new Date(c.collectionDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setApproveTarget(c)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 text-xs font-bold hover:bg-emerald-100 transition-colors"
                          title="অনুমোদন করুন"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          অনুমোদন
                        </button>
                        <button
                          onClick={() => {
                            setSelectedId(c.id);
                            setIsRejectModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 transition-colors"
                          title="বাতিল করুন"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          বাতিল
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
              <p className="mt-2 text-xs text-slate-400 font-bold">রিকোয়েস্ট লোড হচ্ছে...</p>
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              অনুমোদনের অপেক্ষায় কোনো পেমেন্ট নেই।
            </div>
          ) : (
            filteredPending.map((c: any) => (
              <div key={c.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-slate-900 text-sm">{c.shop?.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">অর্ডার #{c.orderId} • এসআর: {c.srName}</p>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">{new Date(c.collectionDate).toLocaleDateString()}</span>
                </div>
                
                <div className="flex justify-between items-center bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 mt-1">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">জমার পরিমাণ</p>
                    <p className="font-black text-emerald-800 text-base">{formatCurrency(c.collectedAmount)}</p>
                  </div>
                  <div className="text-right flex flex-col text-[10px]">
                    <span className="text-rose-600 font-bold">পূর্বে: {formatCurrency(c.due?.remainingDue || 0)}</span>
                    <span className="text-emerald-700 font-black">পরে: {formatCurrency(Math.max(0, (c.due?.remainingDue || 0) - c.collectedAmount))}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => {
                      setSelectedId(c.id);
                      setIsRejectModalOpen(true);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    বাতিল
                  </button>
                  <button
                    onClick={() => setApproveTarget(c)}
                    className="flex-[2] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    অনুমোদন করুন
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in duration-200 mb-0 pb-safe pb-4 sm:pb-0">
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              কালেকশন বাতিলের কারণ
            </h3>
            <p className="mt-1 text-xs text-slate-500">কেন এই পেমেন্ট কালেকশনটি বাতিল করছেন তা লিখুন।</p>
            
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              placeholder="যেমন: টাকার পরিমাণ অমিল, ভুল এন্ট্রি..."
              rows={3}
            />

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs sm:text-sm font-bold hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                onClick={() => selectedId && rejectMutation.mutate({ id: selectedId, reason: rejectReason })}
                disabled={!rejectReason || rejectMutation.isPending}
                className="flex-[2] sm:flex-1 rounded-xl bg-rose-600 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                বাতিল নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Approval */}
      <ConfirmModal
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onConfirm={async () => {
          if (approveTarget) {
            await approveMutation.mutateAsync(approveTarget.id);
            setApproveTarget(null);
          }
        }}
        title="কালেকশন অনুমোদন করতে চান?"
        description="অনুমোদন করার সাথে সাথে সংশ্লিষ্ট দোকানের বাকি হিসাব স্বয়ংক্রিয়ভাবে কমে যাবে।"
        confirmText="অনুমোদন নিশ্চিত করুন"
        cancelText="বাতিল"
        variant="success"
        isLoading={approveMutation.isPending}
        details={approveTarget ? [
          { label: 'দোকানের নাম', value: approveTarget.shop?.name || 'N/A' },
          { label: 'এসআর (SR)', value: approveTarget.srName || 'N/A' },
          { label: 'জমার পরিমাণ', value: formatCurrency(approveTarget.collectedAmount) },
        ] : []}
      />
    </div>
  );
}
