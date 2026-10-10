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
  AlertCircle,
  RotateCcw,
  Edit2,
  Layers,
  History,
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { 
  getPendingCollections, 
  getCollections,
  approveCollection, 
  rejectCollection 
} from '@/lib/api/dues';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import { useAuth } from '../auth/auth-provider';
import { Role } from '@/types/api';
import { useToast } from '@/components/ui/toast-provider';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { EditCollectionModal } from './edit-collection-modal';
import { RevertCollectionModal } from './revert-collection-modal';

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Rejection modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Approval modal target
  const [approveTarget, setApproveTarget] = useState<any | null>(null);

  // Recovery & Edit modals
  const [revertTarget, setRevertTarget] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);

  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const { data: pending = [], isLoading: isPendingLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: getPendingCollections,
  });

  const { data: allCollections = [], isLoading: isAllCollectionsLoading } = useQuery({
    queryKey: ['all-approvals-history'],
    queryFn: getCollections,
  });

  const approvedCollections = allCollections.filter((c: any) => c.status === 'APPROVED');

  const approveMutation = useMutation({
    mutationFn: approveCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['all-approvals-history'] });
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
      queryClient.invalidateQueries({ queryKey: ['all-approvals-history'] });
      setIsRejectModalOpen(false);
      setRejectReason('');
      showSuccessToast('Payment collection request rejected.');
    },
    onError: (err: any) => {
      showErrorToast(err.message || 'Failed to reject payment.');
    }
  });

  const filteredPending = pending.filter((c: any) => 
    c.shop?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.srName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.orderId?.toString().includes(searchTerm)
  );

  const filteredApproved = approvedCollections.filter((c: any) => 
    c.shop?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.srName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.orderId?.toString().includes(searchTerm)
  );

  if (user?.role !== Role.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-sm text-slate-500 max-w-md">Only Super Admin can approve, edit, or revert payment collections.</p>
      </div>
    );
  }

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    queryClient.invalidateQueries({ queryKey: ['all-approvals-history'] });
    queryClient.invalidateQueries({ queryKey: ['dues'] });
    queryClient.invalidateQueries({ queryKey: ['due-stats'] });
    queryClient.invalidateQueries({ queryKey: ['due-collections'] });
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Payment Approvals & Recovery
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
              Audited Ledger Vouchers
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Approve incoming cash collections, edit collection amounts, and revert mistaken approvals
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <Link
            href="/dues"
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-white border border-slate-200 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs shrink-0 whitespace-nowrap"
          >
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
            <span>Customer AR</span>
          </Link>
          <Link
            href="/dues/collections"
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-white border border-slate-200 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs shrink-0 whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
            <span>Collection History</span>
          </Link>
          <Link
            href="/dues/approvals"
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-indigo-600 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-500/20 shrink-0 whitespace-nowrap"
          >
            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Payment Approvals</span>
          </Link>
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex items-center justify-between no-print">
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeTab === 'PENDING'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-500" />
            Pending Approvals
            <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
              pending.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {pending.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('APPROVED')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeTab === 'APPROVED'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            Approved & Recovery
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 font-bold">
              {approvedCollections.length}
            </span>
          </button>
        </div>

        <div className="text-xs font-bold text-slate-500 hidden sm:block">
          {activeTab === 'PENDING' ? `${filteredPending.length} pending requests` : `${filteredApproved.length} approved records`}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden no-print">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by shop, SR name or order #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
            />
          </div>
        </div>

        {/* TAB 1: PENDING APPROVALS TABLE */}
        {activeTab === 'PENDING' && (
          <>
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
                  {isPendingLoading ? (
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
                              <p className="font-black text-slate-900 leading-none text-sm">{c.shop?.name || 'Direct Sale'}</p>
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
                          <span className="font-black text-emerald-600 text-sm sm:text-base">
                            {formatCurrency(c.collectedAmount)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col text-[11px]">
                            <span className="text-rose-600 font-bold">Before: {formatCurrency(c.due?.remainingDue || 0)}</span>
                            <span className="text-emerald-700 font-black">
                              After: {formatCurrency(Math.max(0, (c.due?.remainingDue || 0) - c.collectedAmount))}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs font-semibold">
                          {formatDate(c.collectionDate)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditTarget(c)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-700 px-2.5 py-1.5 text-xs font-bold hover:bg-slate-200 transition-colors"
                              title="Edit Collection"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setApproveTarget(c)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 text-xs font-bold hover:bg-emerald-100 transition-colors"
                              title="Approve Payment"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
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

            {/* Mobile View for Pending */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
              {isPendingLoading ? (
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
                        <p className="font-black text-slate-900 text-sm">{c.shop?.name || 'Direct Sale'}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Order #{c.orderId} • SR: {c.srName}</p>
                      </div>
                      <span className="text-xs text-slate-500 font-bold">{formatDate(c.collectionDate)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 mt-1">
                      <div>
                        <p className="text-[10px] font-bold text-emerald-700 uppercase">Collected Amount</p>
                        <p className="font-black text-emerald-800 text-base">{formatCurrency(c.collectedAmount)}</p>
                      </div>
                      <div className="text-right flex flex-col text-[10px]">
                        <span className="text-rose-600 font-bold">Before: {formatCurrency(c.due?.remainingDue || 0)}</span>
                        <span className="text-emerald-700 font-black">
                          After: {formatCurrency(Math.max(0, (c.due?.remainingDue || 0) - c.collectedAmount))}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setEditTarget(c)}
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(c.id);
                          setIsRejectModalOpen(true);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 border border-rose-200 hover:bg-rose-100"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => setApproveTarget(c)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* TAB 2: APPROVED COLLECTIONS & RECOVERY TABLE */}
        {activeTab === 'APPROVED' && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Shop & Order</th>
                    <th className="px-5 py-3.5">Collected By</th>
                    <th className="px-5 py-3.5">Approved Amount</th>
                    <th className="px-5 py-3.5">Approved By & Date</th>
                    <th className="px-5 py-3.5">Notes / Reference</th>
                    <th className="px-5 py-3.5 text-right">Mistake Recovery Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isAllCollectionsLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto mb-2" />
                        Loading approved collections...
                      </td>
                    </tr>
                  ) : filteredApproved.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm font-bold">
                        No approved collection records found.
                      </td>
                    </tr>
                  ) : (
                    filteredApproved.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-black text-slate-900 text-sm">{c.shop?.name || 'Direct Sale'}</p>
                            <p className="text-[10px] font-black text-indigo-600 tracking-tight">Order #{c.orderId}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-slate-800 text-xs">{c.srName}</span>
                          <span className="text-[10px] text-slate-400 block">{formatDate(c.collectionDate)}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-black text-emerald-600 text-sm sm:text-base">
                            {formatCurrency(c.collectedAmount)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-slate-700 text-xs block">{c.approvedBy || 'Admin'}</span>
                          <span className="text-[10px] text-slate-400">
                            {c.approvedAt ? formatDate(c.approvedAt) : '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs max-w-xs truncate" title={c.note}>
                          {c.note || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditTarget(c)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 text-xs font-bold hover:bg-indigo-100 transition-colors"
                              title="Edit Amount or Notes"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setRevertTarget(c)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 text-xs font-black hover:bg-rose-100 transition-colors"
                              title="Revert Mistaken Approval"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Revert / Recover
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View for Approved */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
              {isAllCollectionsLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
                  <p className="mt-2 text-xs text-slate-400 font-bold">Loading records...</p>
                </div>
              ) : filteredApproved.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-bold">
                  No approved collection records found.
                </div>
              ) : (
                filteredApproved.map((c: any) => (
                  <div key={c.id} className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-slate-900 text-sm">{c.shop?.name || 'Direct Sale'}</p>
                        <p className="text-[10px] font-bold text-slate-400">Order #{c.orderId} • Approved By: {c.approvedBy || 'Admin'}</p>
                      </div>
                      <span className="font-black text-emerald-600 text-sm">{formatCurrency(c.collectedAmount)}</span>
                    </div>

                    {c.note && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {c.note}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditTarget(c)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevertTarget(c)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Revert / Recover
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Reject Modal */}
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
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs sm:text-sm font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
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

      {/* Edit Collection Modal */}
      {editTarget && (
        <EditCollectionModal
          collection={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={handleRefreshAll}
        />
      )}

      {/* Revert / Recover Approval Modal */}
      {revertTarget && (
        <RevertCollectionModal
          collection={revertTarget}
          onClose={() => setRevertTarget(null)}
          onSuccess={handleRefreshAll}
        />
      )}
    </div>
  );
}
