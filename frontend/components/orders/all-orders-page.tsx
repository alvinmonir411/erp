'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../auth/auth-provider';
import {
  Search, Calendar, Filter, Download,
  Eye, Edit, Trash2, Printer, CheckCircle,
  XCircle, Clock, Package, Building2, MapPin,
  Store, ChevronRight, MoreVertical, LayoutGrid,
  TrendingUp, ShoppingCart, AlertCircle, RefreshCw,
  Lock, ShieldAlert, CreditCard, Save, ChevronDown, ChevronUp, Plus, DollarSign, Truck, Undo2,
  ArrowLeft, LogOut,
  User, Info, Phone
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Pagination } from '@/components/ui/pagination';
import { StateMessage } from '@/components/ui/state-message';
import { useToast } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, getTodayBD, formatBDDate } from '@/lib/utils/format';
import {
  getOrders, getOrderStats, deleteOrder, updateOrderStatus,
  settleOrder
} from '@/lib/api/orders';
import { useCompanies, useRoutes, useShops } from '@/hooks/use-common-queries';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OrderModal } from './order-modal';
import { OrderPrintModal } from './order-print-modal';

const STATUS_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle },
  ASSIGNED: { label: 'Assigned', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Package },
  OUT_FOR_DELIVERY: { label: 'Dispatched', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Package },
  DELIVERED: { label: 'Delivered', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: ShoppingCart },
  PARTIAL_DUE: { label: 'Partial Due', color: 'bg-amber-100 text-amber-800 border-amber-300 font-bold', icon: DollarSign },
  MANUAL_DUE: { label: 'Manual Due Record', color: 'bg-rose-100 text-rose-800 border-rose-300 font-black', icon: DollarSign },
  SETTLED: { label: 'Settled / Paid', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle },
};

const PAGE_SIZE = 10;

export function AllOrdersPage() {
  const { user } = useAuth();
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const router = useRouter();

  // Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [routeId, setRouteId] = useState<string>('');
  const [shopId, setShopId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Selection & Details
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [printingOrder, setPrintingOrder] = useState<any>(null);
  const [settlingOrder, setSettlingOrder] = useState<any>(null);
  const [isActionLoading, setIsActionLoading] = useState<number | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);

  // Queries
  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();
  const { data: shops = [] } = useShops(routeId ? Number(routeId) : undefined);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const query: any = {
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        companyId: companyId || undefined,
        routeId: routeId || undefined,
        shopId: shopId || undefined,
        status: activeTab === 'ALL' ? undefined : activeTab,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const data = await getOrders(query);
      if (data && typeof data === 'object' && 'items' in data) {
        setOrders(data.items || []);
        setTotalItems(data.total || 0);
      } else {
        setOrders(Array.isArray(data) ? data : []);
        setTotalItems(Array.isArray(data) ? data.length : 0);
      }
    } catch (e) {
      showErrorToast('Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setIsStatsLoading(true);
      const data = await getOrderStats();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats');
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, companyId, routeId, shopId, activeTab, startDate, endDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length > 2 || search.length === 0) {
        fetchOrders();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      fetchOrders();
      fetchStats();
    };
    window.addEventListener('order-refresh', handleRefresh);
    return () => {
      window.removeEventListener('order-refresh', handleRefresh);
    };
  }, [page, companyId, routeId, shopId, activeTab, startDate, endDate, search]);

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    try {
      setIsActionLoading(id);
      await updateOrderStatus(id, newStatus);
      showSuccessToast(`Order status updated to ${newStatus}`);
      fetchOrders();
      fetchStats();
    } catch (e) {
      showErrorToast('Failed to update status');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleDelete = (id: number) => {
    const ord = orders.find(o => o.id === id);
    if (ord) {
      setOrderToDelete(ord);
    }
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    try {
      setIsActionLoading(orderToDelete.id);
      await deleteOrder(orderToDelete.id);
      showSuccessToast('Order deleted successfully');
      setOrderToDelete(null);
      fetchOrders();
      fetchStats();
    } catch (e: any) {
      showErrorToast(e.message || 'Failed to delete order');
    } finally {
      setIsActionLoading(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCompanyId('');
    setRouteId('');
    setShopId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const tabs = [
    { label: 'All', value: 'ALL' },
    { label: 'Pending', value: 'CONFIRMED' },
    { label: 'Dispatched', value: 'OUT_FOR_DELIVERY' },
    { label: 'Settled', value: 'SETTLED' },
    { label: 'Due / Unpaid', value: 'MANUAL_DUE' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 md:pb-8">
      {/* Desktop Top Header (Hidden on Mobile to eliminate duplication and save space) */}
      <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-border shadow-sm no-print">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">Order Management</h1>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Review and manage customer orders</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link
            href="/orders/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> New Order
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="modern-card overflow-hidden no-print">
        {/* Header & Tabs */}
        <div className="border-b border-border bg-white px-3 sm:px-6">
          <div className="flex flex-col gap-3 py-3 sm:py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 py-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold shrink-0 whitespace-nowrap transition active:scale-95 ${activeTab === tab.value
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-600 bg-slate-100/80 hover:bg-slate-200/70'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-bold transition-all active:scale-95 ${showFilters ? 'bg-primary text-white border-primary shadow-xs' : 'bg-white text-slate-700 border-border hover:bg-secondary'
                  }`}
              >
                <Filter className="h-3.5 w-3.5" /> Filters {showFilters ? '▲' : '▼'}
              </button>
              <Link
                href="/orders/new"
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-primary/90 transition-all shadow-xs active:scale-95"
              >
                <Plus className="h-4 w-4" /> New Order
              </Link>
            </div>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="grid gap-3 sm:gap-6 border-t border-border py-4 sm:py-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Company</label>
                <select
                  value={companyId}
                  onChange={e => setCompanyId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm focus:bg-white outline-none"
                >
                  <option value="">All Companies</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Route</label>
                <select
                  value={routeId}
                  onChange={e => setRouteId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm focus:bg-white outline-none"
                >
                  <option value="">All Routes</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Shop</label>
                <select
                  value={shopId}
                  onChange={e => setShopId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm focus:bg-white outline-none"
                >
                  <option value="">All Shops</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={clearFilters}
                  className="w-full rounded-lg border border-border bg-white px-4 py-2 text-sm font-bold text-muted hover:bg-secondary transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="pb-4 sm:pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search order ID, shop, note..."
                className="w-full rounded-xl border border-border bg-secondary/50 py-2.5 sm:py-3 pl-9 pr-4 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/20 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-border">
                <th className="px-6 py-4">Order Info</th>
                <th className="px-6 py-4">Customer / Route</th>
                <th className="px-6 py-4 text-center">Qty</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Notes</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <p className="text-sm font-bold text-muted">Retrieving Orders...</p>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <StateMessage title="No orders found" description="Adjust your filters or create a new order." />
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const isManualDue = order.status === 'MANUAL_DUE' || !order.items || order.items.length === 0;
                  const totalUnits = order.items?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) + Number(item.freeQuantity || 0), 0) || 0;
                  const totalItemsCount = order.items?.length || 0;
                  const grandTotal = Number(order.actualSoldAmount || order.grandTotal || 0);
                  const paidAmount = Number(order.collectedAmount || order.advancePaid || 0);
                  const dueAmount = order.dueAmount !== undefined && order.dueAmount !== null
                    ? Number(order.dueAmount)
                    : (order.status === 'SETTLED' ? 0 : Math.max(0, grandTotal - paidAmount));

                  return (
                    <tr key={order.id} className={`group hover:bg-secondary/30 transition-colors ${isManualDue ? 'bg-amber-50/20' : ''}`}>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-sm font-bold text-foreground hover:text-accent transition-colors flex items-center gap-1.5"
                        >
                          #{order.id.toString().padStart(6, '0')}
                          {isManualDue && (
                            <span className="text-[9px] font-black uppercase bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">
                              Due
                            </span>
                          )}
                        </button>
                        <p className="mt-1 text-[10px] font-bold text-muted flex items-center gap-1 uppercase tracking-tight">
                          <Calendar className="h-3 w-3" /> {formatDate(order.orderDate || order.createdAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-foreground">{order.shop?.name || 'Direct Shop'}</p>
                        <p className="mt-1 text-[10px] font-bold text-muted flex items-center gap-1 uppercase tracking-tight">
                          <MapPin className="h-3 w-3" /> {order.route?.name || 'No Route'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isManualDue ? (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-black text-rose-700 border border-rose-200">
                              <DollarSign className="h-3 w-3" /> Due Record
                            </span>
                            <p className="text-[10px] text-muted font-bold mt-0.5">No Items</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              {totalUnits}
                            </p>
                            <p className="text-[10px] font-bold text-muted uppercase">Units ({totalItemsCount} items)</p>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-black text-foreground">
                          {formatCurrency(grandTotal)}
                        </p>
                        {dueAmount > 0 ? (
                          <p className="text-[11px] font-black text-rose-600 mt-0.5">
                            Due: {formatCurrency(dueAmount)}
                          </p>
                        ) : (
                          <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                            Paid in Full
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider border shadow-2xs ${STATUS_CONFIG[order.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_CONFIG[order.status]?.label || order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] font-medium text-slate-500 max-w-[150px] truncate" title={order.note}>
                        {order.note || '—'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 text-muted hover:text-primary transition-colors"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setPrintingOrder(order)}
                          className="p-2 text-muted hover:text-indigo-600 transition-colors"
                          title="Print Cash Memo / Invoice"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {user?.role !== 'SR' && !['SETTLED', 'PARTIAL_DUE'].includes(order.status) && (
                          <>
                            <Link
                              href={`/orders/${order.id}/edit`}
                              className="p-2 text-muted hover:text-primary transition-colors"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => setSettlingOrder(order)}
                              className="p-2 text-muted hover:text-emerald-600 transition-colors"
                              title="Settle Order"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {user?.role === 'SUPER_ADMIN' && (
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="p-2 text-muted hover:text-rose-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Feed - Alada Alada Card View */}
        <div className="md:hidden space-y-3.5 p-3 sm:p-4 bg-slate-100/70 rounded-2xl">
          {isLoading ? (
            <div className="px-6 py-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="px-6 py-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm font-bold text-slate-500">No orders found</p>
            </div>
          ) : (
            orders.map((order) => {
              const isManualDue = order.status === 'MANUAL_DUE' || !order.items || order.items.length === 0;
              const totalUnits = order.items?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) + Number(item.freeQuantity || 0), 0) || 0;
              const totalItemsCount = order.items?.length || 0;
              const grandTotal = Number(order.actualSoldAmount || order.grandTotal || 0);
              const paidAmount = Number(order.collectedAmount || order.advancePaid || 0);
              const dueAmount = order.dueAmount !== undefined && order.dueAmount !== null
                ? Number(order.dueAmount)
                : (order.status === 'SETTLED' ? 0 : Math.max(0, grandTotal - paidAmount));

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden space-y-3 cursor-pointer ${
                    isManualDue
                      ? 'border-l-4 border-l-rose-500 border-slate-200 bg-gradient-to-br from-rose-50/20 via-white to-white'
                      : order.status === 'SETTLED'
                      ? 'border-l-4 border-l-emerald-500 border-slate-200'
                      : dueAmount > 0
                      ? 'border-l-4 border-l-amber-500 border-slate-200'
                      : 'border-slate-200'
                  }`}
                  onClick={() => setSelectedOrder(order)}
                >
                  {/* Card Top: Order ID + Date & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 tracking-tight">
                          #{order.id.toString().padStart(6, '0')}
                        </span>
                        {isManualDue && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">
                            <DollarSign className="h-3 w-3" /> Due Record
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(order.orderDate || order.createdAt)}
                      </p>
                    </div>

                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border shadow-2xs ${
                      STATUS_CONFIG[order.status]?.color || 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {STATUS_CONFIG[order.status]?.label || order.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Shop & Route Details */}
                  <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-900 flex items-center gap-1.5 truncate">
                        <Store className="h-4 w-4 text-slate-500 shrink-0" />
                        <span>{order.shop?.name || 'Walk-in Direct Customer'}</span>
                      </p>
                      {order.shop?.phone && (
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5 shrink-0">
                          <Phone className="h-2.5 w-2.5" /> {order.shop.phone}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-bold text-slate-500">
                      <span className="flex items-center gap-1 text-slate-600">
                        <MapPin className="h-3 w-3 text-slate-400" /> {order.route?.name || 'No Route'}
                      </span>
                      {order.shop?.ownerName && (
                        <span className="text-slate-500">
                          Owner: <strong className="text-slate-700">{order.shop.ownerName}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Note / Remarks if any */}
                  {order.note && (
                    <div className="text-[11px] font-medium text-amber-900 bg-amber-50/70 border border-amber-200/70 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="line-clamp-2 leading-relaxed">{order.note}</p>
                    </div>
                  )}

                  {/* Units vs Products Clarity */}
                  <div className="rounded-xl bg-slate-50/50 p-2.5 border border-slate-100">
                    {isManualDue ? (
                      <div className="flex items-center justify-between text-xs font-bold text-amber-800">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                          <span>Item Units:</span>
                        </span>
                        <span className="font-black text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded text-[11px] border border-rose-200">
                          No Physical Items (Direct Due Entry)
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500 flex items-center gap-1">
                          <Package className="h-3.5 w-3.5 text-slate-400" /> Total Units:
                        </span>
                        <span className="font-black text-slate-800">
                          {totalUnits} Units {totalItemsCount > 0 && <span className="text-slate-400 font-medium text-[11px]">({totalItemsCount} items)</span>}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Financial Breakdown (Grand Total, Paid, Due) */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {isManualDue ? 'Recorded Due' : 'Total Bill'}
                        </span>
                        <p className="text-sm font-black text-slate-900 truncate">
                          {formatCurrency(grandTotal)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Remaining Due
                        </span>
                        {dueAmount > 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-sm font-black text-rose-600">
                              {formatCurrency(dueAmount)}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-200">
                              DUE
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600 inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle className="h-3 w-3" /> Paid
                          </span>
                        )}
                      </div>
                    </div>

                    {paidAmount > 0 && dueAmount > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold bg-slate-50 px-2.5 py-1 rounded-lg">
                        <span>Paid:</span>
                        <span className="font-bold text-emerald-600">{formatCurrency(paidAmount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="flex-1 text-xs font-bold text-slate-700 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      <span>Details</span>
                    </button>
                    <button 
                      onClick={() => setPrintingOrder(order)}
                      className="flex-1 text-xs font-black text-indigo-700 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Print</span>
                    </button>
                    {user?.role !== 'SR' && !['SETTLED', 'PARTIAL_DUE'].includes(order.status) && (
                      <button
                        onClick={() => setSettlingOrder(order)}
                        className="flex-1 text-xs font-black text-emerald-700 py-2 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Settle</span>
                      </button>
                    )}
                    {user?.role === 'SUPER_ADMIN' && (
                      <button
                        onClick={() => handleDelete(order.id)}
                        disabled={isActionLoading === order.id}
                        className="h-8 w-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition active:scale-95 disabled:opacity-50 shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="border-t border-border bg-white px-6 py-4">
          <Pagination
            currentPage={page}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDeleteSuccess={() => {
            setSelectedOrder(null);
            fetchOrders();
            fetchStats();
          }}
        />
      )}

      {printingOrder && (
        <OrderPrintModal
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
        />
      )}

      {settlingOrder && (
        <SettlementModal
          order={settlingOrder}
          onClose={() => setSettlingOrder(null)}
          onSettled={() => {
            setSettlingOrder(null);
            fetchOrders();
            fetchStats();
          }}
        />
      )}

      {orderToDelete && (
        <DeleteConfirmModal
          isOpen={!!orderToDelete}
          onClose={() => setOrderToDelete(null)}
          onConfirm={handleConfirmDelete}
          isDeleting={isActionLoading === orderToDelete.id}
          orderId={orderToDelete.id}
        />
      )}
    </div>
  );
}

interface SettlementModalProps {
  order: any;
  onClose: () => void;
  onSettled: () => void;
}

function SettlementModal({ order, onClose, onSettled }: SettlementModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [returnState, setReturnState] = useState<Record<number, { returned: string, damaged: string }>>(
    Object.fromEntries(order.items.map((i: any) => [i.productId, { returned: '0', damaged: '0' }]))
  );
  const [collectedAmount, setCollectedAmount] = useState(order.grandTotal.toString());
  const [note, setNote] = useState('');

  const calculateFinals = () => {
    let totalSold = 0;
    const items = order.items.map((item: any) => {
      const state = returnState[item.productId] || { returned: '0', damaged: '0' };
      const returned = Number(state.returned || 0);
      const damaged = Number(state.damaged || 0);
      const dispatched = Number(item.quantity) + Number(item.freeQuantity || 0);
      const delivered = Math.max(0, dispatched - returned - damaged);

      const unitPriceAfterDiscount = Number(item.quantity) > 0
        ? Number(item.lineTotal) / Number(item.quantity)
        : 0;

      const chargeableDelivered = Math.max(0, Math.min(Number(item.quantity), delivered));
      const itemSoldAmount = chargeableDelivered * unitPriceAfterDiscount;
      totalSold += itemSoldAmount;

      return {
        productId: item.productId,
        productName: item.product.name,
        dispatched,
        delivered,
        returned,
        damaged,
        soldAmount: itemSoldAmount
      };
    });

    return { items, totalSold };
  };

  const { items: displayItems, totalSold } = calculateFinals();

  const handleSettle = async () => {
    try {
      setIsSaving(true);
      const payload = {
        items: Object.entries(returnState).map(([productId, state]) => ({
          productId: Number(productId),
          returnedQuantity: Number(state.returned || 0),
          damagedQuantity: Number(state.damaged || 0),
        })),
        collectedAmount: Number(collectedAmount || 0),
        settlementNote: note,
      };

      await settleOrder(order.id, payload);
      showSuccessToast('Order settled successfully');
      onSettled();
    } catch (e: any) {
      showErrorToast(e.message || 'Failed to settle order');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl rounded-t-[2.5rem] sm:rounded-[2.5rem] bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 mb-0 pb-safe pb-4 sm:pb-0">
        <div className="bg-violet-900 px-8 py-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black">Settle Order #{order.id.toString().padStart(6, '0')}</h2>
            <p className="text-sm opacity-60">Finalize returns, damages and payment collection</p>
          </div>
          <button onClick={onClose} className="rounded-2xl bg-white/10 p-2 hover:bg-white/20 transition-colors">
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="space-y-6">
            <div className="overflow-x-auto rounded-3xl border border-slate-100">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead className="bg-slate-50">
                  <tr className="font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4 text-center">Dispatch</th>
                    <th className="px-6 py-4 text-center">Return</th>
                    <th className="px-6 py-4 text-center">Damage</th>
                    <th className="px-6 py-4 text-center">Sold</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayItems.map((item) => (
                    <tr key={item.productId} className="font-medium">
                      <td className="px-6 py-4 font-black text-slate-900">{item.productName}</td>
                      <td className="px-6 py-4 text-center">{item.dispatched}</td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          value={returnState[item.productId]?.returned}
                          onChange={e => setReturnState(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], returned: e.target.value } }))}
                          className="w-16 rounded-lg bg-slate-100 border-0 p-1.5 text-center font-black text-rose-600 focus:ring-2 focus:ring-rose-500/20"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          value={returnState[item.productId]?.damaged}
                          onChange={e => setReturnState(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], damaged: e.target.value } }))}
                          className="w-16 rounded-lg bg-slate-100 border-0 p-1.5 text-center font-black text-amber-600 focus:ring-2 focus:ring-amber-500/20"
                        />
                      </td>
                      <td className="px-6 py-4 text-center font-black text-emerald-600">{item.delivered}</td>
                      <td className="px-6 py-4 text-right font-black">{formatCurrency(item.soldAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Collected Amount</label>
                  <div className="relative mt-1">
                    <CreditCard className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      value={collectedAmount}
                      onChange={e => setCollectedAmount(e.target.value)}
                      className="w-full rounded-2xl bg-slate-100 border-0 py-3 pl-11 pr-4 text-sm font-black focus:ring-2 focus:ring-violet-500/20"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Settlement Note</label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="mt-1 w-full rounded-2xl bg-slate-100 border-0 p-4 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 h-24"
                    placeholder="Add any remarks for this settlement..."
                  />
                </div>
              </div>

              <div className="rounded-[2rem] bg-slate-900 p-8 text-white space-y-4 h-fit">
                <div className="flex justify-between items-center text-sm font-bold opacity-60">
                  <span>Calculated Sold Value</span>
                  <span>{formatCurrency(totalSold)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-rose-400">
                  <span>Collected</span>
                  <span>-{formatCurrency(Number(collectedAmount || 0))}</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black uppercase tracking-widest opacity-40">Final Due</span>
                  <span className="text-3xl font-black text-amber-400">
                    {formatCurrency(Math.max(0, totalSold - Number(collectedAmount || 0)))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-8 py-6 flex justify-end gap-3 border-t border-slate-100">
          <button onClick={onClose} className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          <button
            onClick={handleSettle}
            disabled={isSaving}
            className="rounded-2xl bg-violet-600 px-8 py-3 text-sm font-black text-white shadow-lg shadow-violet-200 hover:bg-violet-700 active:scale-95 transition-all flex items-center gap-2"
          >
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Confirm Settlement
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  orderId: number;
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, isDeleting, orderId }: DeleteConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 animate-out fade-out zoom-out-95">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Delete Order #{orderId.toString().padStart(6, '0')}</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed font-bold">
              Are you sure you want to delete this order? This will reverse stock changes, delete associated dues/payments, and cannot be undone.
            </p>
          </div>
          <div className="flex w-full gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-black text-white hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isDeleting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Yes, Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
