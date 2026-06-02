'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  DollarSign, 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ArrowRight,
  Filter,
  MoreVertical,
  Calendar,
  User as UserIcon,
  Store,
  FileText,
  Loader2,
  History,
  Plus
} from 'lucide-react';
import { getDues, collectDue, getDueStats } from '@/lib/api/dues';
import { apiRequest } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/format';
import { useAuth } from '../auth/auth-provider';
import { useToast } from '@/components/ui/toast-provider';
import { Role } from '@/types/api';

import Link from 'next/link';
import { getOrder } from '@/lib/api/orders';
import { OrderModal } from '@/components/orders/order-modal';
import { addManualDue } from '@/lib/api/sales';
import { getShops } from '@/lib/api/shops';

export function DuesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedDue, setSelectedDue] = useState<any>(null);

  // Order Details Modal State
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [isViewingOrderLoading, setIsViewingOrderLoading] = useState(false);

  // Manual Due Modal State
  const [isManualDueModalOpen, setIsManualDueModalOpen] = useState(false);

  const { data: dues = [], isLoading } = useQuery({
    queryKey: ['dues'],
    queryFn: getDues,
  });

  const { data: stats } = useQuery({
    queryKey: ['due-stats'],
    queryFn: getDueStats,
  });

  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const collectMutation = useMutation({
    mutationFn: collectDue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dues'] });
      setIsCollectModalOpen(false);
      setSelectedDue(null);
      showSuccessToast('Collection request submitted for approval.');
    },
    onError: (error: any) => {
      showErrorToast(error.response?.data?.message || 'Failed to submit collection');
    }
  });

  const handleViewOrder = async (orderId: number) => {
    try {
      setIsViewingOrderLoading(true);
      const orderData = await getOrder(orderId);
      setViewingOrder(orderData);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to fetch order details');
    } finally {
      setIsViewingOrderLoading(false);
    }
  };

  const filteredDues = dues.filter((due: any) => 
    due.shop?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    due.srName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    due.orderId.toString().includes(searchTerm)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'PARTIAL': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-rose-50 text-rose-700 border-rose-100';
    }
  };

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
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            <DollarSign className="w-4 h-4" />
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
            <>
              <Link
                href="/dues/approvals"
                className="inline-flex items-center gap-2 rounded-lg bg-white border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-zinc-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Approve Payments
              </Link>
              <button
                onClick={() => setIsManualDueModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 text-white px-4 py-2 text-sm font-bold hover:bg-zinc-800 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Manual Due
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted uppercase tracking-wider text-[10px]">Total Outstanding</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(stats?.totalRemaining ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted uppercase tracking-wider text-[10px]">Total Collected</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(stats?.totalPaid ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted uppercase tracking-wider text-[10px]">Pending Approval</p>
              <p className="text-2xl font-bold text-foreground text-amber-600">
                {formatCurrency(stats?.pendingApproval ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted uppercase tracking-wider text-[10px]">Active Dues</p>
              <p className="text-2xl font-bold text-foreground">
                {dues.filter((d: any) => d.remainingDue > 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-zinc-50/50 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search by shop or SR..."
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
                <th className="px-6 py-4">Responsible SR</th>
                <th className="px-6 py-4">Due Amount</th>
                <th className="px-6 py-4">Paid</th>
                <th className="px-6 py-4">Remaining</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    <p className="mt-2 text-muted">Loading dues...</p>
                  </td>
                </tr>
              ) : filteredDues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted text-lg">
                    No outstanding dues found.
                  </td>
                </tr>
              ) : (
                filteredDues.map((due: any) => (
                  <tr key={due.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 border border-zinc-200">
                          <Store className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{due.shop?.name || 'Direct Sale'}</p>
                          <button
                            onClick={() => handleViewOrder(due.orderId)}
                            className="text-[10px] font-black text-primary hover:underline uppercase tracking-tight block text-left"
                          >
                            Order #{due.orderId}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                          {due.srName?.charAt(0) || 'U'}
                        </div>
                        <span className="font-medium text-zinc-700">{due.srName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">{formatCurrency(due.dueAmount)}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">{formatCurrency(due.paidAmount)}</td>
                    <td className="px-6 py-4">
                      <span className={`font-black ${due.remainingDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(due.remainingDue)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black border ${getStatusColor(due.status)}`}>
                        {due.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedDue(due);
                            setIsHistoryModalOpen(true);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200"
                          title="View History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        {due.remainingDue > 0 && (
                          <button
                            onClick={() => {
                              setSelectedDue(due);
                              setIsCollectModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-primary/90"
                          >
                            <DollarSign className="w-3 h-3" />
                            Collect
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden flex flex-col divide-y divide-border">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-sm text-muted">Loading dues...</p>
            </div>
          ) : filteredDues.length === 0 ? (
            <div className="p-12 text-center text-muted text-sm">
              No outstanding dues found.
            </div>
          ) : (
            filteredDues.map((due: any) => (
              <div key={due.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 border border-zinc-200">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm">{due.shop?.name || 'Direct Sale'}</p>
                      <button
                        onClick={() => handleViewOrder(due.orderId)}
                        className="text-[10px] font-black text-primary hover:underline uppercase tracking-tight block text-left mb-0.5"
                      >
                        Order #{due.orderId}
                      </button>
                      <p className="text-[10px] font-medium text-muted uppercase tracking-tight">SR: {due.srName}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black border ${getStatusColor(due.status)}`}>
                    {due.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold text-muted uppercase">Original</p>
                    <p className="font-bold text-zinc-900 text-sm">{formatCurrency(due.dueAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted uppercase">Paid</p>
                    <p className="font-bold text-emerald-600 text-sm">{formatCurrency(due.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted uppercase">Remaining</p>
                    <p className={`font-black text-sm ${due.remainingDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatCurrency(due.remainingDue)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => {
                      setSelectedDue(due);
                      setIsHistoryModalOpen(true);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-700 transition-colors hover:bg-zinc-200"
                  >
                    <History className="w-4 h-4" />
                    History
                  </button>
                  {due.remainingDue > 0 && (
                    <button
                      onClick={() => {
                        setSelectedDue(due);
                        setIsCollectModalOpen(true);
                      }}
                      className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary/90"
                    >
                      <DollarSign className="w-4 h-4" />
                      Collect Payment
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isCollectModalOpen && selectedDue && (
        <CollectModal 
          due={selectedDue} 
          onClose={() => setIsCollectModalOpen(false)} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['dues'] });
            queryClient.invalidateQueries({ queryKey: ['due-stats'] });
          }}
        />
      )}

      {isHistoryModalOpen && selectedDue && (
        <HistoryModal 
          due={selectedDue} 
          onClose={() => setIsHistoryModalOpen(false)} 
        />
      )}

      {isViewingOrderLoading && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm font-bold text-zinc-700">Loading order details...</span>
          </div>
        </div>
      )}

      {viewingOrder && (
        <OrderModal
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}

      {isManualDueModalOpen && (
        <ManualDueModal
          onClose={() => setIsManualDueModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['dues'] });
            queryClient.invalidateQueries({ queryKey: ['due-stats'] });
          }}
        />
      )}
    </div>
  );
}

function ManualDueModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [shopId, setShopId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user?.role !== Role.SUPER_ADMIN) {
    return null;
  }

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['all-shops-for-due'],
    queryFn: () => getShops(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);

    if (!shopId) {
      showErrorToast('Please select a shop.');
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showErrorToast('Amount must be greater than 0.');
      return;
    }

    if (reason.trim().length < 3) {
      showErrorToast('Reason must be at least 3 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      await addManualDue({
        shopId,
        amount: parsedAmount,
        reason: reason.trim(),
        note: note.trim() || undefined,
      });
      showSuccessToast('Manual due recorded successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to add manual due');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-border animate-in slide-in-from-bottom sm:zoom-in duration-200 mb-0 pb-safe pb-4 sm:pb-0">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-zinc-50/50">
          <h3 className="text-lg font-bold text-foreground">Add Manual Due</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Select Shop</label>
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              required
              disabled={isLoading}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              <option value="">-- Choose Shop --</option>
              {shops.map((shop: any) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name} {shop.route ? `· ${shop.route.name}` : ''}
                </option>
              ))}
            </select>
            {isLoading && <p className="text-[10px] text-muted">Loading shops list...</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Due Amount (BDT)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Reason / Reference</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g., Unpaid balance from invoice #1234"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Note (Optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Additional comments or context..."
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-zinc-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Due Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CollectModal({ due, onClose, onSuccess }: { due: any, onClose: () => void, onSuccess: () => void }) {
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(due.remainingDue.toString());
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // We need to know if there are pending collections for this due to calculate maxCollectable
  const { data: collections = [] } = useQuery({
    queryKey: ['order-collections', due.orderId],
    queryFn: () => apiRequest<any[]>(`/dues/order/${due.orderId}/collections`, { method: 'GET' }),
  });

  const pendingAmount = collections
    .filter((c: any) => c.status === 'PENDING')
    .reduce((sum: number, c: any) => sum + Number(c.collectedAmount), 0);

  const maxCollectable = Math.max(0, Number(due.remainingDue) - pendingAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const collectAmount = Number(amount);
    
    if (collectAmount <= 0) {
      showErrorToast('Amount must be greater than 0');
      return;
    }
    
    if (collectAmount > maxCollectable) {
      showErrorToast(`Amount exceeds max collectable (${formatCurrency(maxCollectable)}). There might be pending approvals.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await collectDue({
        orderId: due.orderId,
        amount: collectAmount,
        note,
        collectionDate: date
      });
      showSuccessToast('Collection submitted for approval');
      onSuccess();
      onClose();
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to submit collection');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-border animate-in slide-in-from-bottom sm:zoom-in duration-200 mb-0 pb-safe pb-4 sm:pb-0">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-zinc-50/50">
          <h3 className="text-lg font-bold text-foreground">Collect Installment</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-muted" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Shop:</span>
              <span className="font-bold">{due.shop?.name}</span>
            </div>
            <div className="flex justify-between text-sm text-rose-600">
              <span className="font-medium">Remaining Due:</span>
              <span className="font-black">{formatCurrency(due.remainingDue)}</span>
            </div>
            {pendingAmount > 0 && (
              <div className="flex justify-between text-sm text-amber-600">
                <span className="font-medium">Pending Approval:</span>
                <span className="font-bold">-{formatCurrency(pendingAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-zinc-200 pt-2 font-black text-emerald-600">
              <span>Max Collectable:</span>
              <span>{formatCurrency(maxCollectable)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Amount to Collect</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="number"
                step="0.01"
                required
                max={maxCollectable}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Collection Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Note (Optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Installment details..."
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-zinc-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || maxCollectable <= 0}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryModal({ due, onClose }: { due: any, onClose: () => void }) {
  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['order-collections', due.orderId],
    queryFn: () => apiRequest<any[]>(`/dues/order/${due.orderId}/collections`, { method: 'GET' }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-border animate-in slide-in-from-bottom sm:zoom-in duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-lg font-bold text-foreground leading-none">Collection History</h3>
            <p className="text-xs font-bold text-muted uppercase mt-1">Shop: {due.shop?.name} · Order #{due.orderId}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-muted" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
             <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                <p className="text-[10px] font-black uppercase text-muted">Original Due</p>
                <p className="text-lg font-bold text-zinc-900">{formatCurrency(due.dueAmount)}</p>
             </div>
             <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                <p className="text-[10px] font-black uppercase text-emerald-600">Total Paid</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(due.paidAmount)}</p>
             </div>
             <div className="rounded-xl bg-rose-50 p-3 border border-rose-100">
                <p className="text-[10px] font-black uppercase text-rose-600">Remaining</p>
                <p className="text-lg font-bold text-rose-700">{formatCurrency(due.remainingDue)}</p>
             </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="bg-zinc-50/50 text-[10px] font-black uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">SR Name</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    </td>
                  </tr>
                ) : collections.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">No history found.</td>
                  </tr>
                ) : (
                  collections.map((c: any) => (
                    <tr key={c.id} className="hover:bg-zinc-50/30">
                      <td className="px-4 py-3 text-xs font-bold text-zinc-600">{new Date(c.collectionDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs font-medium text-zinc-700">{c.srName}</td>
                      <td className="px-4 py-3 text-right font-black text-primary">{formatCurrency(c.collectedAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black border ${
                          c.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          c.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-zinc-50/50 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
