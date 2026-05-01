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
  User
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

const STATUS_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: Clock },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  ASSIGNED: { label: 'Assigned', color: 'bg-indigo-100 text-indigo-700', icon: Package },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: 'bg-amber-100 text-amber-700', icon: Package },
  DELIVERED: { label: 'Delivered', color: 'bg-cyan-100 text-cyan-700', icon: ShoppingCart },
  SETTLED: { label: 'Settled', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700', icon: XCircle },
};

const PAGE_SIZE = 15;

export function AllOrdersPage() {
  const { user } = useAuth();
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const router = useRouter();

  // Data States
  const [orders, setOrders] = useState<any[]>([]);
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
  const [isActionLoading, setIsActionLoading] = useState<number | null>(null);

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
      setOrders(data);
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

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      setIsActionLoading(id);
      await deleteOrder(id);
      showSuccessToast('Order deleted successfully');
      fetchOrders();
      fetchStats();
    } catch (e) {
      showErrorToast('Failed to delete order');
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
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-border shadow-sm">
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
      <div className="modern-card overflow-hidden">
        {/* Header & Tabs */}
        <div className="border-b border-border bg-white px-6">
          <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`relative px-4 py-2 text-sm font-bold transition-all ${activeTab === tab.value
                    ? 'text-primary'
                    : 'text-muted hover:text-foreground'
                    }`}
                >
                  {tab.label}
                  {activeTab === tab.value && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-muted border-border hover:bg-secondary'
                  }`}
              >
                <Filter className="h-4 w-4" /> Filters
              </button>
              <Link
                href="/orders/new"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" /> New Order
              </Link>
            </div>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="grid gap-6 border-t border-border py-6 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-top-4">
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
          <div className="pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by Order ID, Shop Name, or Note..."
                className="w-full rounded-xl border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-accent/20 transition-all"
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
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <p className="text-sm font-bold text-muted">Retrieving Orders...</p>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <StateMessage title="No orders found" description="Adjust your filters or create a new order." />
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="group hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-sm font-bold text-foreground hover:text-accent transition-colors"
                      >
                        #{order.id.toString().padStart(6, '0')}
                      </button>
                      <p className="mt-1 text-[10px] font-bold text-muted flex items-center gap-1 uppercase tracking-tight">
                        <Calendar className="h-3 w-3" /> {formatDate(order.createdAt)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-foreground">{order.shop?.name || 'Direct Shop'}</p>
                      <p className="mt-1 text-[10px] font-bold text-muted flex items-center gap-1 uppercase tracking-tight">
                        <MapPin className="h-3 w-3" /> {order.route?.name || 'No Route'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-sm font-bold text-foreground">
                        {order.items?.reduce((sum: number, item: any) => sum + Number(item.quantity) + Number(item.freeQuantity), 0) || 0}
                      </p>
                      <p className="text-[10px] font-bold text-muted uppercase">Units</p>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">
                      {formatCurrency(order.grandTotal)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_CONFIG[order.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
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
                        {user?.role !== 'SR' && order.status !== 'SETTLED' && (
                          <Link
                            href={`/orders/${order.id}/edit`}
                            className="p-2 text-muted hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-border">
          {isLoading ? (
            <div className="px-6 py-10 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
              <p className="text-xs font-bold text-muted">Loading...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-muted">No orders found</p>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="p-4 space-y-3" onClick={() => setSelectedOrder(order)}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-primary">#{order.id.toString().padStart(6, '0')}</span>
                    <span className="text-[10px] font-bold text-muted uppercase">{formatDate(order.createdAt)}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_CONFIG[order.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-black text-foreground">{order.shop?.name || 'Direct Shop'}</p>
                  <p className="text-[10px] font-bold text-muted flex items-center gap-1 uppercase tracking-tight">
                    <MapPin className="h-3 w-3" /> {order.route?.name || 'No Route'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Units</span>
                    <span className="text-sm font-black">{order.items?.reduce((sum: number, item: any) => sum + Number(item.quantity) + Number(item.freeQuantity), 0) || 0}</span>
                  </div>
                  <div className="text-right flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Grand Total</span>
                    <span className="text-sm font-black text-foreground">{formatCurrency(order.grandTotal)}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button className="text-[10px] font-bold uppercase text-primary px-3 py-1.5 bg-primary/5 rounded-lg">View Details</button>
                  {user?.role !== 'SR' && order.status !== 'SETTLED' && (
                    <Link href={`/orders/${order.id}/edit`} className="text-[10px] font-bold uppercase text-amber-600 px-3 py-1.5 bg-amber-50 rounded-lg">Edit</Link>
                  )}
                  {user?.role === 'SUPER_ADMIN' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }}
                      className="text-[10px] font-bold uppercase text-rose-600 px-3 py-1.5 bg-rose-50 rounded-lg"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="border-t border-border px-6 py-4 bg-secondary/10">
          <Pagination
            currentPage={page}
            totalItems={stats?.totalOrders || orders.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* Modal - Same logic as before but cleaner UI */}
      {selectedOrder && (
        <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}


function OrderModal({ order, onClose }: { order: any, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 mb-0 pb-safe pb-4 sm:pb-0">
        <div className="bg-primary p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Order #{order.id.toString().padStart(6, '0')}</h2>
            <p className="text-xs font-bold opacity-60 uppercase tracking-widest">{formatDate(order.createdAt)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-8 md:grid-cols-2 mb-8">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Shop Details</p>
              <p className="text-sm font-bold text-foreground">{order.shop?.name || 'Direct Customer'}</p>
              <p className="text-xs font-medium text-muted">{order.shop?.address || 'No address provided'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Route / Network</p>
              <p className="text-sm font-bold text-foreground">{order.route?.name}</p>
              <p className="text-xs font-medium text-muted">{order.company?.name}</p>
            </div>
          </div>

          <div className="overflow-x-auto mb-8 rounded-xl border border-border">
            <table className="w-full text-left min-w-[400px]">
              <thead className="bg-secondary/30 text-[10px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items?.map((item: any, idx: number) => (
                  <tr key={idx} className="text-sm">
                    <td className="px-4 py-3 font-bold text-foreground">{item.product?.name}</td>
                    <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-medium text-muted">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-primary/5 rounded-2xl p-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted font-bold">Subtotal</span>
              <span className="text-foreground font-bold">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-rose-500 font-bold">Discount</span>
                <span className="text-rose-500 font-bold">-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            <div className="pt-3 border-t border-border flex justify-between items-end">
              <span className="text-xs font-black uppercase text-muted">Grand Total</span>
              <span className="text-2xl font-black text-primary">{formatCurrency(order.grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-secondary/30 border-t border-border flex gap-3">
          <button onClick={() => window.print()} className="flex-1 rounded-xl border border-border bg-white py-3 text-sm font-bold text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2">
            <Printer className="h-4 w-4" /> Print Invoice
          </button>
          <button onClick={onClose} className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


function SettlementModal({ order, onClose, onSettled }: { order: any, onClose: () => void, onSettled: () => void }) {
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
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
