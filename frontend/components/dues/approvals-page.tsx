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

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: getPendingCollections,
  });

  const approveMutation = useMutation({
    mutationFn: approveCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      alert('Payment approved and due balance updated.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectCollection(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      setIsRejectModalOpen(false);
      setRejectReason('');
      alert('Payment collection rejected.');
    },
  });

  const filteredPending = pending.filter((c: any) => 
    c.shop?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.srName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Finance Hub</h2>
          <p className="text-sm text-muted">Manage dues, collections and approvals in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dues"
            className="inline-flex items-center gap-2 rounded-lg bg-white border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-zinc-50 transition-colors"
          >
            <DollarSign className="w-4 h-4 text-primary" />
            Due List
          </Link>
          <Link
            href="/dues/collections"
            className="inline-flex items-center gap-2 rounded-lg bg-white border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-zinc-50 transition-colors"
          >
            <Clock className="w-4 h-4 text-amber-500" />
            Collections
          </Link>
          {user?.role === Role.SUPER_ADMIN && (
            <Link
              href="/dues/approvals"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Approve Payments
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-zinc-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Filter requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            />
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-6 py-4">Shop & Order</th>
                <th className="px-6 py-4">SR Name</th>
                <th className="px-6 py-4">Requested</th>
                <th className="px-6 py-4">Balance Impact</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                    Loading pending requests...
                  </td>
                </tr>
              ) : filteredPending.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    No pending approval requests.
                  </td>
                </tr>
              ) : (
                filteredPending.map((c: any) => (
                  <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
                          <Store className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground leading-none">{c.shop?.name}</p>
                          <p className="text-[10px] font-bold text-muted mt-1 uppercase">Order #{c.orderId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3 h-3 text-muted" />
                        <span className="font-medium">{c.srName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-emerald-600 text-base">{formatCurrency(c.collectedAmount)}</span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col text-[10px]">
                          <span className="text-rose-500 font-bold">Before: {formatCurrency(c.due?.remainingDue || 0)}</span>
                          <span className="text-emerald-500 font-black">After: {formatCurrency(Math.max(0, (c.due?.remainingDue || 0) - c.collectedAmount))}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-muted text-xs">
                      {new Date(c.collectionDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            if (window.confirm('Approve this payment?')) {
                              approveMutation.mutate(c.id);
                            }
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedId(c.id);
                            setIsRejectModalOpen(true);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
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
        <div className="md:hidden flex flex-col divide-y divide-border">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-sm text-muted">Loading requests...</p>
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="p-12 text-center text-muted text-sm">
              No pending approval requests.
            </div>
          ) : (
            filteredPending.map((c: any) => (
              <div key={c.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-foreground text-sm">{c.shop?.name}</p>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-tight">Order #{c.orderId} • SR: {c.srName}</p>
                  </div>
                  <span className="text-xs text-muted font-medium">{new Date(c.collectionDate).toLocaleDateString()}</span>
                </div>
                
                <div className="flex justify-between items-center bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50 mt-1">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Amount Requested</p>
                    <p className="font-black text-emerald-700 text-lg">{formatCurrency(c.collectedAmount)}</p>
                  </div>
                  <div className="text-right flex flex-col text-[10px]">
                    <span className="text-rose-500 font-bold">Before: {formatCurrency(c.due?.remainingDue || 0)}</span>
                    <span className="text-emerald-600 font-black">After: {formatCurrency(Math.max(0, (c.due?.remainingDue || 0) - c.collectedAmount))}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => {
                      setSelectedId(c.id);
                      setIsRejectModalOpen(true);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-100"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Approve this payment?')) {
                        approveMutation.mutate(c.id);
                      }
                    }}
                    className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 border border-border animate-in slide-in-from-bottom sm:zoom-in duration-200 mb-0 pb-safe pb-4 sm:pb-0">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              Reject Collection
            </h3>
            <p className="mt-2 text-sm text-muted">Please provide a reason for rejecting this payment collection.</p>
            
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-4 w-full rounded-lg border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              placeholder="e.g. Invalid amount, check bounce..."
              rows={3}
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="flex-1 rounded-lg border border-border py-3 sm:py-2 text-sm font-semibold hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedId && rejectMutation.mutate({ id: selectedId, reason: rejectReason })}
                disabled={!rejectReason || rejectMutation.isPending}
                className="flex-[2] sm:flex-1 rounded-lg bg-rose-600 py-3 sm:py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
