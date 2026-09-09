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
      showSuccessToast('Payment approved successfully and due balance updated.');
    },
    onError: (err: any) => {
      showErrorToast(err.message || 'Failed to approve payment.');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectCollection(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      setIsRejectModalOpen(false);
      setRejectReason('');
      showSuccessToast('Payment collection request rejected.');
    },
    onError: (err: any) => {
      showErrorToast(err.message || 'Failed to reject payment.');
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
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-sm text-slate-500 max-w-md">Only Super Admin can approve or reject payment collections.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Due & Collection Management</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Shop dues, cash collections, and payment approvals</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dues"
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <DollarSign className="w-4 h-4 text-indigo-600" />
            Due List
          </Link>
          <Link
            href="/dues/collections"
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Clock className="w-4 h-4 text-amber-500" />
            Collection History
          </Link>
          {user?.role === Role.SUPER_ADMIN && (
            <Link
              href="/dues/approvals"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-500/20"
            >
              <CheckCircle className="w-4 h-4" />
              Payment Approvals
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
              placeholder="Search by shop or SR name..."
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
                <th className="px-5 py-3.5">Shop & Order</th>
                <th className="px-5 py-3.5">Collected By (SR)</th>
                <th className="px-5 py-3.5">Collected Amount</th>
                <th className="px-5 py-3.5">Due Balance Change</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto mb-2" />
                    Loading pending requests...
                  </td>
                </tr>
              ) : filteredPending.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm font-bold">
                    No payment requests pending approval.
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
                          <p className="text-[10px] font-black text-indigo-600 mt-1">Order #{c.orderId}</p>
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
                          <span className="text-rose-600 font-bold">Before: {formatCurrency(c.due?.remainingDue || 0)}</span>
                          <span className="text-emerald-700 font-black">After Approval: {formatCurrency(Math.max(0, (c.due?.remainingDue || 0) - c.collectedAmount))}</span>
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
                          title="Approve Payment"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedId(c.id);
                            setIsRejectModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 transition-colors"
                          title="Reject Payment"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
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
              <p className="mt-2 text-xs text-slate-400 font-bold">Loading requests...</p>
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              No payments pending approval.
            </div>
          ) : (
            filteredPending.map((c: any) => (
              <div key={c.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-slate-900 text-sm">{c.shop?.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Order #{c.orderId} • SR: {c.srName}</p>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">{new Date(c.collectionDate).toLocaleDateString()}</span>
                </div>
                
                <div className="flex justify-between items-center bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 mt-1">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">Collected Amount</p>
                    <p className="font-black text-emerald-800 text-base">{formatCurrency(c.collectedAmount)}</p>
                  </div>
                  <div className="text-right flex flex-col text-[10px]">
                    <span className="text-rose-600 font-bold">Before: {formatCurrency(c.due?.remainingDue || 0)}</span>
                    <span className="text-emerald-700 font-black">After: {formatCurrency(Math.max(0, (c.due?.remainingDue || 0) - c.collectedAmount))}</span>
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
                    Reject
                  </button>
                  <button
                    onClick={() => setApproveTarget(c)}
                    className="flex-[2] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Payment
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
              Reason for Rejection
            </h3>
            <p className="mt-1 text-xs text-slate-500">Please provide the reason why this payment collection is being rejected.</p>
            
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              placeholder="e.g., Incorrect amount, duplicate entry, payment bounced..."
              rows={3}
            />

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs sm:text-sm font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedId && rejectMutation.mutate({ id: selectedId, reason: rejectReason })}
                disabled={!rejectReason || rejectMutation.isPending}
                className="flex-[2] sm:flex-1 rounded-xl bg-rose-600 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Rejection
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
        title="Approve Payment Collection?"
        description="Approving will automatically deduct the collected amount from the shop due ledger."
        confirmText="Approve Payment"
        cancelText="Cancel"
        variant="success"
        isLoading={approveMutation.isPending}
        details={approveTarget ? [
          { label: 'Shop Name', value: approveTarget.shop?.name || 'N/A' },
          { label: 'SR Name', value: approveTarget.srName || 'N/A' },
          { label: 'Amount', value: formatCurrency(approveTarget.collectedAmount) },
        ] : []}
      />
    </div>
  );
}
