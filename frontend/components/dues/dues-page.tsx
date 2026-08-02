'use client';

import { useState, useMemo } from 'react';
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
import { useCompanies, useRoutes } from '@/hooks/use-common-queries';
import { getUsers } from '@/lib/api/users';

import Link from 'next/link';
import { getOrder } from '@/lib/api/orders';
import { OrderModal } from '@/components/orders/order-modal';
import { addManualDue } from '@/lib/api/sales';
import { getShops } from '@/lib/api/shops';

export function DuesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeliveryMan, setSelectedDeliveryMan] = useState('');
  const [selectedSR, setSelectedSR] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
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

  // Fetch companies, routes and users for complete filter options
  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const uniqueDeliveryMen = useMemo(() => {
    return Array.from(new Set(
      users.filter((u: any) => u.role === Role.DELIVERY_MAN).map((u: any) => u.name)
    )) as string[];
  }, [users]);

  const uniqueSRs = useMemo(() => {
    return Array.from(new Set(
      users.filter((u: any) => u.role === Role.SR || u.role === Role.ADMIN || u.role === Role.SUPER_ADMIN).map((u: any) => u.name)
    )) as string[];
  }, [users]);

  const uniqueCompanies = useMemo(() => {
    return Array.from(new Set(companies.map((c: any) => c.name))) as string[];
  }, [companies]);

  const uniqueRoutes = useMemo(() => {
    return Array.from(new Set(routes.map((r: any) => r.name))) as string[];
  }, [routes]);

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

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedDeliveryMan('');
    setSelectedSR('');
    setSelectedCompany('');
    setSelectedRoute('');
    setSelectedDate('');
  };

  const filteredDues = useMemo(() => {
    return dues.filter((due: any) => {
      // 1. Search Term filter
      const matchesSearch = !searchTerm ? true : (
        due.shop?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        due.shop?.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        due.shop?.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        due.deliveryManName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        due.orderId.toString().includes(searchTerm)
      );

      if (!matchesSearch) return false;

      // 2. Delivery Man filter
      if (selectedDeliveryMan && due.deliveryManName !== selectedDeliveryMan) {
        return false;
      }

      // 3. SR Name filter
      if (selectedSR && due.srName !== selectedSR) {
        return false;
      }

      // 4. Company filter
      if (selectedCompany) {
        const orderCompany = due.order?.company?.name;
        const shopCompany = due.shop?.company?.name;
        if (orderCompany !== selectedCompany && shopCompany !== selectedCompany) {
          return false;
        }
      }

      // 5. Route filter
      if (selectedRoute && due.route?.name !== selectedRoute) {
        return false;
      }

      // 6. Date filter (compare order date or created date)
      if (selectedDate) {
        const orderDateStr = due.order?.orderDate;
        const createdAtDateStr = due.createdAt ? new Date(due.createdAt).toISOString().split('T')[0] : '';
        if (orderDateStr !== selectedDate && createdAtDateStr !== selectedDate) {
          return false;
        }
      }

      return true;
    });
  }, [dues, searchTerm, selectedDeliveryMan, selectedSR, selectedCompany, selectedRoute, selectedDate]);

  const filteredDuesTotalRemaining = useMemo(() => {
    return filteredDues.reduce((sum: number, due: any) => sum + Number(due.remainingDue || 0), 0);
  }, [filteredDues]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'PARTIAL': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-rose-50 text-rose-700 border-rose-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 no-print">
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

      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden no-print">
        <div className="p-4 border-b border-border bg-zinc-50/50 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="relative col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Search shop, owner, phone, delivery man..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
              />
            </div>

            {/* Delivery Man Select */}
            <div>
              <select
                value={selectedDeliveryMan}
                onChange={(e) => setSelectedDeliveryMan(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-zinc-700 font-medium"
              >
                <option value="">All Delivery Men</option>
                {uniqueDeliveryMen.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* SR Select */}
            <div>
              <select
                value={selectedSR}
                onChange={(e) => setSelectedSR(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-zinc-700 font-medium"
              >
                <option value="">All SRs</option>
                {uniqueSRs.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Company Select */}
            <div>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-zinc-700 font-medium"
              >
                <option value="">All Companies</option>
                {uniqueCompanies.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Route Select */}
            <div>
              <select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-zinc-700 font-medium"
              >
                <option value="">All Routes</option>
                {uniqueRoutes.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
            {/* Date Filter & Summary */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted font-medium">Order Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-zinc-700"
              />
              {(searchTerm || selectedDeliveryMan || selectedSR || selectedCompany || selectedRoute || selectedDate) && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Total due showing of filtered list */}
            <div className="text-xs text-zinc-600 font-bold">
              Total Due in Filtered List: <span className="text-rose-600 font-black text-sm">{formatCurrency(filteredDuesTotalRemaining)}</span>
            </div>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-6 py-4">Shop & Order</th>
                <th className="px-6 py-4">Delivery Man</th>
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
                          <button
                            onClick={() => {
                              setSelectedDue(due);
                              setIsHistoryModalOpen(true);
                            }}
                            className="font-bold text-foreground hover:text-primary transition-colors text-left hover:underline block"
                          >
                            {due.shop?.name || 'Direct Sale'}
                          </button>
                          <button
                            onClick={() => handleViewOrder(due.orderId)}
                            className="text-[10px] font-black text-primary hover:underline uppercase tracking-tight block text-left mt-0.5"
                          >
                            Order #{due.orderId}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-[9px] font-bold flex-shrink-0">
                          {due.deliveryManName?.charAt(0) || 'D'}
                        </div>
                        <span className="font-bold text-zinc-900 text-xs">{due.deliveryManName || '—'}</span>
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
                      <button
                        onClick={() => {
                          setSelectedDue(due);
                          setIsHistoryModalOpen(true);
                        }}
                        className="font-bold text-foreground hover:text-primary text-sm transition-colors text-left hover:underline block"
                      >
                        {due.shop?.name || 'Direct Sale'}
                      </button>
                      <button
                        onClick={() => handleViewOrder(due.orderId)}
                        className="text-[10px] font-black text-primary hover:underline uppercase tracking-tight block text-left mb-0.5"
                      >
                        Order #{due.orderId}
                      </button>
                      <p className="text-[10px] font-medium text-muted uppercase tracking-tight">Delivery Man: {due.deliveryManName || '—'}</p>
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
  const [shopSearch, setShopSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

  const selectedShop = useMemo(() => {
    return shops.find((s: any) => String(s.id) === String(shopId));
  }, [shops, shopId]);

  const filteredShops = useMemo(() => {
    if (!shopSearch.trim()) return shops;
    const q = shopSearch.toLowerCase();
    return shops.filter((s: any) =>
      s.name?.toLowerCase().includes(q) ||
      s.ownerName?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.route?.name?.toLowerCase().includes(q)
    );
  }, [shops, shopSearch]);

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
          <div className="space-y-1.5 relative">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Select Shop</label>

            {selectedShop ? (
              <div className="flex items-center justify-between p-3 border border-primary/40 rounded-xl bg-primary/5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{selectedShop.name}</p>
                    <p className="text-xs font-medium text-muted">
                      {selectedShop.route?.name ? `Route: ${selectedShop.route.name}` : ''}
                      {selectedShop.ownerName ? ` · ${selectedShop.ownerName}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShopId(''); setShopSearch(''); setIsDropdownOpen(true); }}
                  className="text-xs font-bold text-primary hover:underline px-2 py-1"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={shopSearch}
                    onChange={(e) => {
                      setShopSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Search shop by name, route, phone..."
                    disabled={isLoading}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                  />
                </div>

                {isLoading && <p className="text-[10px] text-muted mt-1">Loading shops list...</p>}

                {isDropdownOpen && !isLoading && (
                  <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white border border-border rounded-xl shadow-xl z-50 divide-y divide-zinc-100">
                    {filteredShops.length > 0 ? (
                      filteredShops.map((shop: any) => (
                        <button
                          key={shop.id}
                          type="button"
                          onClick={() => {
                            setShopId(String(shop.id));
                            setIsDropdownOpen(false);
                            setShopSearch('');
                          }}
                          className="w-full text-left p-3 hover:bg-zinc-50 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-foreground">{shop.name}</p>
                            <p className="text-xs text-muted">
                              {shop.route?.name ? `Route: ${shop.route.name}` : 'No route'}
                              {shop.ownerName ? ` · ${shop.ownerName}` : ''}
                            </p>
                          </div>
                          {shop.phone && (
                            <span className="text-[11px] font-mono text-muted bg-zinc-100 px-2 py-0.5 rounded-md">
                              {shop.phone}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-muted">No shops found for &quot;{shopSearch}&quot;</div>
                    )}
                  </div>
                )}
              </div>
            )}
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
