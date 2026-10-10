'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  DollarSign, 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Store, 
  FileText, 
  Loader2, 
  History, 
  Plus, 
  Layers, 
  ShieldCheck, 
  AlertTriangle,
  Users,
  Sparkles,
  Filter,
  Phone,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  User,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { getDues, getDueStats } from '@/lib/api/dues';
import { apiRequest } from '@/lib/api/client';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { useAuth } from '../auth/auth-provider';
import { useToast } from '@/components/ui/toast-provider';
import { Role } from '@/types/api';
import { useRoutes } from '@/hooks/use-common-queries';

import Link from 'next/link';
import { getOrder } from '@/lib/api/orders';
import { OrderModal } from '@/components/orders/order-modal';
import { addManualDue } from '@/lib/api/sales';
import { getShops } from '@/lib/api/shops';
import { MultiInvoiceCollectModal } from './multi-invoice-collect-modal';
import { CustomerLedgerModal } from './customer-ledger-modal';
import { EditCollectionModal } from './edit-collection-modal';
import { RevertCollectionModal } from './revert-collection-modal';

export function DuesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Search and comprehensive filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedDeliveryMan, setSelectedDeliveryMan] = useState('');
  const [selectedSR, setSelectedSR] = useState('');
  const [selectedAgingFilter, setSelectedAgingFilter] = useState('');
  const [selectedDueStatus, setSelectedDueStatus] = useState<'ALL' | 'ACTIVE' | 'SETTLED'>('ALL');
  const [sortBy, setSortBy] = useState<'HIGHEST_DUE' | 'LOWEST_DUE' | 'NAME' | 'MOST_INVOICES'>('HIGHEST_DUE');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Enterprise Multi-Invoice & Ledger Modals
  const [shopForMultiCollect, setShopForMultiCollect] = useState<any>(null);
  const [shopForLedger, setShopForLedger] = useState<any>(null);

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

  // Fetch routes for filter dropdown
  const { data: routes = [] } = useRoutes();

  const uniqueRoutes = useMemo(() => {
    return Array.from(new Set(routes.map((r: any) => r.name))).filter(Boolean) as string[];
  }, [routes]);

  // Unique Delivery Personnel from all dues
  const uniqueDeliveryMen = useMemo(() => {
    const set = new Set<string>();
    dues.forEach((d: any) => {
      if (d.deliveryManName) set.add(d.deliveryManName);
    });
    return Array.from(set).sort();
  }, [dues]);

  // Unique Sales Representatives from all dues
  const uniqueSRs = useMemo(() => {
    const set = new Set<string>();
    dues.forEach((d: any) => {
      if (d.srName) set.add(d.srName);
    });
    return Array.from(set).sort();
  }, [dues]);

  const handleViewOrder = async (orderId: number) => {
    try {
      setIsViewingOrderLoading(true);
      const orderData = await getOrder(orderId);
      setViewingOrder(orderData);
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to load order details');
    } finally {
      setIsViewingOrderLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedRoute('');
    setSelectedDeliveryMan('');
    setSelectedSR('');
    setSelectedAgingFilter('');
    setSelectedDueStatus('ALL');
    setSortBy('HIGHEST_DUE');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedRoute) count++;
    if (selectedDeliveryMan) count++;
    if (selectedSR) count++;
    if (selectedAgingFilter) count++;
    if (selectedDueStatus !== 'ALL') count++;
    if (sortBy !== 'HIGHEST_DUE') count++;
    return count;
  }, [searchTerm, selectedRoute, selectedDeliveryMan, selectedSR, selectedAgingFilter, selectedDueStatus, sortBy]);

  // Aggregate Customer Accounts / Sub-Ledgers from dues
  const shopAccounts = useMemo(() => {
    const shopMap = new Map<string, any>();
    const now = new Date().getTime();

    dues.forEach((due: any) => {
      const shopKey = due.shopId ? `shop_${due.shopId}` : 'direct_sales';
      const shopObj = due.shop || {
        id: -1,
        name: 'Direct Route Sale / Clearing',
        ownerName: 'Route Direct',
        phone: '—',
        route: due.route || { name: 'Route Clearing' },
      };

      if (!shopMap.has(shopKey)) {
        shopMap.set(shopKey, {
          shopKey,
          shopId: due.shopId,
          shop: shopObj,
          totalDue: 0,
          totalPaid: 0,
          remainingDue: 0,
          invoiceCount: 0,
          openInvoiceCount: 0,
          agingCurrent: 0,
          aging16_30: 0,
          aging31_60: 0,
          aging60Plus: 0,
          lastDate: due.order?.orderDate || due.createdAt,
          hasDraftAnomaly: false,
          deliveryMen: new Set<string>(),
          srNames: new Set<string>(),
        });
      }

      const acc = shopMap.get(shopKey)!;
      const dueAmt = Number(due.dueAmount || 0);
      const paidAmt = Number(due.paidAmount || 0);
      const remAmt = Number(due.remainingDue || 0);

      acc.totalDue += dueAmt;
      acc.totalPaid += paidAmt;
      acc.remainingDue += remAmt;
      acc.invoiceCount += 1;
      if (remAmt > 0) acc.openInvoiceCount += 1;

      if (due.deliveryManName) acc.deliveryMen.add(due.deliveryManName);
      if (due.srName) acc.srNames.add(due.srName);

      // Flag Gate 3 audit draft orders (Orders 30 & 51)
      if (due.orderId === 30 || due.orderId === 51) {
        acc.hasDraftAnomaly = true;
      }

      if (remAmt > 0) {
        const orderDateStr = due.order?.orderDate || due.createdAt;
        const diffDays = orderDateStr 
          ? Math.floor((now - new Date(orderDateStr).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        if (diffDays <= 15) acc.agingCurrent += remAmt;
        else if (diffDays <= 30) acc.aging16_30 += remAmt;
        else if (diffDays <= 60) acc.aging31_60 += remAmt;
        else acc.aging60Plus += remAmt;
      }
    });

    return Array.from(shopMap.values()).map(acc => ({
      ...acc,
      deliveryMenList: Array.from(acc.deliveryMen) as string[],
      srNamesList: Array.from(acc.srNames) as string[],
    }));
  }, [dues]);

  // Filtered Shop Accounts
  const filteredShopAccounts = useMemo(() => {
    const list = shopAccounts.filter((acc: any) => {
      // 1. Search filter
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches = (
          acc.shop.name?.toLowerCase().includes(q) ||
          acc.shop.ownerName?.toLowerCase().includes(q) ||
          acc.shop.phone?.toLowerCase().includes(q) ||
          acc.shop.address?.toLowerCase().includes(q) ||
          acc.shop.route?.name?.toLowerCase().includes(q)
        );
        if (!matches) return false;
      }

      // 2. Route filter
      if (selectedRoute && acc.shop.route?.name !== selectedRoute) {
        return false;
      }

      // 3. Delivery Person filter
      if (selectedDeliveryMan && !acc.deliveryMenList.includes(selectedDeliveryMan)) {
        return false;
      }

      // 4. Sales Rep filter
      if (selectedSR && !acc.srNamesList.includes(selectedSR)) {
        return false;
      }

      // 5. Due status filter
      if (selectedDueStatus === 'ACTIVE' && acc.remainingDue <= 0) {
        return false;
      }
      if (selectedDueStatus === 'SETTLED' && acc.remainingDue > 0) {
        return false;
      }

      // 6. Aging filter
      if (selectedAgingFilter === 'OVERDUE' && acc.aging60Plus <= 0) {
        return false;
      }
      if (selectedAgingFilter === 'WATCHLIST' && acc.aging31_60 <= 0) {
        return false;
      }
      if (selectedAgingFilter === 'STANDARD' && acc.aging16_30 <= 0) {
        return false;
      }
      if (selectedAgingFilter === 'CURRENT' && acc.agingCurrent <= 0) {
        return false;
      }

      return true;
    });

    // Sorting
    return list.sort((a: any, b: any) => {
      if (sortBy === 'HIGHEST_DUE') return b.remainingDue - a.remainingDue;
      if (sortBy === 'LOWEST_DUE') return a.remainingDue - b.remainingDue;
      if (sortBy === 'MOST_INVOICES') return b.invoiceCount - a.invoiceCount;
      if (sortBy === 'NAME') return (a.shop.name || '').localeCompare(b.shop.name || '');
      return b.remainingDue - a.remainingDue;
    });
  }, [shopAccounts, searchTerm, selectedRoute, selectedDeliveryMan, selectedSR, selectedDueStatus, selectedAgingFilter, sortBy]);

  // Portfolio Aging Ribbon Totals
  const portfolioAging = useMemo(() => {
    let current = 0;
    let d16_30 = 0;
    let d31_60 = 0;
    let d60Plus = 0;
    const now = new Date().getTime();

    dues.forEach((due: any) => {
      const rem = Number(due.remainingDue || 0);
      if (rem > 0) {
        const orderDateStr = due.order?.orderDate || due.createdAt;
        const diffDays = orderDateStr 
          ? Math.floor((now - new Date(orderDateStr).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        if (diffDays <= 15) current += rem;
        else if (diffDays <= 30) d16_30 += rem;
        else if (diffDays <= 60) d31_60 += rem;
        else d60Plus += rem;
      }
    });

    return { current, d16_30, d31_60, d60Plus };
  }, [dues]);

  const filteredTotalRemaining = useMemo(() => {
    return filteredShopAccounts.reduce((sum: number, acc: any) => sum + acc.remainingDue, 0);
  }, [filteredShopAccounts]);

  return (
    <div className="space-y-6">
      {/* Header & Main Navigation */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 sm:gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Customer Accounts Receivable
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600" />
              Reconciled Ledger
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Customer subledgers, multi-invoice payment settlements, and aging breakdown.
          </p>
        </div>
        
        {/* Sleek Horizontal Navigation Pill Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <Link
            href="/dues"
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-indigo-600 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-500/20 shrink-0 whitespace-nowrap"
          >
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Customer AR</span>
          </Link>
          <Link
            href="/dues/collections"
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-white border border-slate-200 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs shrink-0 whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
            <span>Collection History</span>
          </Link>
          {user?.role === Role.SUPER_ADMIN && (
            <>
              <Link
                href="/dues/approvals"
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-white border border-slate-200 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs shrink-0 whitespace-nowrap"
              >
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                <span>Payment Approvals</span>
              </Link>
              <button
                onClick={() => setIsManualDueModalOpen(true)}
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-slate-900 text-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm shrink-0 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Manual Due Entry</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4 no-print">
        {/* 1. Market Receivable */}
        <div className="rounded-2xl sm:rounded-3xl border border-rose-100 sm:border-slate-200 bg-white p-3 sm:p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 sm:text-slate-500 truncate">
              <span className="sm:hidden">Total Due</span>
              <span className="hidden sm:inline">Market Receivable</span>
            </span>
            <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-2xl bg-rose-50 text-rose-600 shrink-0">
              <AlertCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-[15px] sm:text-2xl font-black text-rose-600 tracking-tight truncate" title={formatCurrency(stats?.totalRemaining ?? 0)}>
              {formatCurrency(stats?.totalRemaining ?? 0)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5 hidden sm:block">
              Total active market balance
            </p>
          </div>
        </div>

        {/* 2. Total Collected */}
        <div className="rounded-2xl sm:rounded-3xl border border-emerald-100 sm:border-slate-200 bg-white p-3 sm:p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 sm:text-slate-500 truncate">
              <span className="sm:hidden">Collected</span>
              <span className="hidden sm:inline">Total Collected</span>
            </span>
            <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
              <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-[15px] sm:text-2xl font-black text-emerald-600 tracking-tight truncate" title={formatCurrency(stats?.totalPaid ?? 0)}>
              {formatCurrency(stats?.totalPaid ?? 0)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5 hidden sm:block">
              Collected customer payments
            </p>
          </div>
        </div>

        {/* 3. Pending Approval */}
        <div className="rounded-2xl sm:rounded-3xl border border-amber-100 sm:border-slate-200 bg-white p-3 sm:p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 sm:text-slate-500 truncate">
              <span className="sm:hidden">Pending</span>
              <span className="hidden sm:inline">Pending Approval</span>
            </span>
            <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-2xl bg-amber-50 text-amber-600 shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-[15px] sm:text-2xl font-black text-amber-600 tracking-tight truncate" title={formatCurrency(stats?.pendingApproval ?? 0)}>
              {formatCurrency(stats?.pendingApproval ?? 0)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5 hidden sm:block">
              Awaiting manager approval
            </p>
          </div>
        </div>

        {/* 4. Active Debtor Accounts */}
        <div className="rounded-2xl sm:rounded-3xl border border-indigo-100 sm:border-slate-200 bg-white p-3 sm:p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 sm:text-slate-500 truncate">
              <span className="sm:hidden">Debtors</span>
              <span className="hidden sm:inline">Debtor Accounts</span>
            </span>
            <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-2xl bg-indigo-50 text-indigo-600 shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-[15px] sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              <span>{shopAccounts.filter((a: any) => a.remainingDue > 0).length}</span>
              <span className="text-xs sm:text-sm font-semibold text-slate-400 ml-1.5">of {shopAccounts.length}</span>
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5 hidden sm:block">
              Shops with active balances
            </p>
          </div>
        </div>
      </div>

      {/* AR Aging Portfolio Breakdown Ribbon */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white shadow-md no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-indigo-300">
                Portfolio Aging Analysis
              </h2>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-md font-bold">
                Daily Roll-Forward
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
              Reconciled across {shopAccounts.length} verified customer accounts
            </p>
          </div>
          <div className="flex sm:flex-col justify-between items-center sm:items-end">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Market Outstanding
            </span>
            <span className="text-base sm:text-xl font-black text-rose-400">
              {formatCurrency(stats?.totalRemaining ?? 0)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 pt-3.5">
          <div className="p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">0 - 15 Days</p>
              <span className="text-[9px] text-slate-400 block leading-tight">Current</span>
            </div>
            <p className="text-xs sm:text-base font-black text-white mt-1.5 truncate">
              {formatCurrency(portfolioAging.current)}
            </p>
          </div>

          <div className="p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">16 - 30 Days</p>
              <span className="text-[9px] text-slate-400 block leading-tight">Standard</span>
            </div>
            <p className="text-xs sm:text-base font-black text-white mt-1.5 truncate">
              {formatCurrency(portfolioAging.d16_30)}
            </p>
          </div>

          <div className="p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">31 - 60 Days</p>
              <span className="text-[9px] text-slate-400 block leading-tight">Watchlist</span>
            </div>
            <p className="text-xs sm:text-base font-black text-white mt-1.5 truncate">
              {formatCurrency(portfolioAging.d31_60)}
            </p>
          </div>

          <div className="p-2.5 sm:p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">60+ Days</p>
              <span className="text-[9px] text-rose-400/80 block leading-tight">Overdue Alert</span>
            </div>
            <p className="text-xs sm:text-base font-black text-rose-300 mt-1.5 truncate">
              {formatCurrency(portfolioAging.d60Plus)}
            </p>
          </div>
        </div>
      </div>

      {/* COMPREHENSIVE FILTER & SETTINGS BAR */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden no-print">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 space-y-3">
          
          {/* Main Top Filter Bar (Search + Quick Mobile Toggle) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search shop by name, owner, phone, route, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Mobile Filter Toggle Button */}
            <div className="flex items-center gap-2 sm:hidden">
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition-colors ${
                  isMobileFiltersOpen || activeFilterCount > 0
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
                {isMobileFiltersOpen ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
              </button>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Expanded Dropdowns Grid (Always visible on Desktop, collapsible on Mobile) */}
          <div className={`${isMobileFiltersOpen ? 'block' : 'hidden sm:block'} space-y-3 pt-1`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              
              {/* 1. Route Select */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                  Route / Area
                </label>
                <select
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700 font-medium"
                >
                  <option value="">All Routes</option>
                  {uniqueRoutes.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* 2. Delivery Person Select */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                  Delivery Person
                </label>
                <select
                  value={selectedDeliveryMan}
                  onChange={(e) => setSelectedDeliveryMan(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700 font-medium"
                >
                  <option value="">All Delivery Personnel</option>
                  {uniqueDeliveryMen.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* 3. Sales Rep (SR) Select */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                  Sales Rep (SR)
                </label>
                <select
                  value={selectedSR}
                  onChange={(e) => setSelectedSR(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700 font-medium"
                >
                  <option value="">All Sales Reps</option>
                  {uniqueSRs.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* 4. Aging Bracket Filter */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                  Aging Period
                </label>
                <select
                  value={selectedAgingFilter}
                  onChange={(e) => setSelectedAgingFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700 font-medium"
                >
                  <option value="">All Aging Periods</option>
                  <option value="CURRENT">0 - 15 Days (Current)</option>
                  <option value="STANDARD">16 - 30 Days (Standard)</option>
                  <option value="WATCHLIST">31 - 60 Days (Watchlist)</option>
                  <option value="OVERDUE">60+ Days (Overdue Alert)</option>
                </select>
              </div>

              {/* 5. Sort By Select */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                  Sort Order
                </label>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700 font-medium"
                >
                  <option value="HIGHEST_DUE">Highest Due First</option>
                  <option value="LOWEST_DUE">Lowest Due First</option>
                  <option value="NAME">Shop Name (A-Z)</option>
                  <option value="MOST_INVOICES">Most Invoices</option>
                </select>
              </div>
            </div>

            {/* Bottom Row: Status Tabs + Summary + Reset */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/70">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                <div className="inline-flex p-0.5 rounded-xl bg-slate-200/80 text-xs font-bold text-slate-600 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedDueStatus('ALL')}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                      selectedDueStatus === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    All ({shopAccounts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDueStatus('ACTIVE')}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                      selectedDueStatus === 'ACTIVE' ? 'bg-white text-rose-600 shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Active Dues ({shopAccounts.filter((a: any) => a.remainingDue > 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDueStatus('SETTLED')}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                      selectedDueStatus === 'SETTLED' ? 'bg-white text-emerald-600 shadow-xs' : 'hover:text-slate-900'
                    }`}
                  >
                    Settled ({shopAccounts.filter((a: any) => a.remainingDue <= 0).length})
                  </button>
                </div>

                {activeFilterCount > 0 && (
                  <button
                    onClick={handleResetFilters}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline shrink-0 whitespace-nowrap ml-1"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Filtered Total Display */}
              <div className="text-xs text-slate-600 font-bold flex items-center justify-between sm:justify-end gap-1.5 pt-1 sm:pt-0">
                <span className="text-slate-500">Filtered Total:</span>
                <span className="text-rose-600 font-black text-sm">
                  {formatCurrency(filteredTotalRemaining)}
                </span>
                <span className="text-slate-400 text-[11px] font-normal">
                  ({filteredShopAccounts.length} shops)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CUSTOMER AR ACCOUNTS TABLE (Desktop View) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Customer / Shop Account</th>
                <th className="px-5 py-3.5">Route & Fulfillment</th>
                <th className="px-5 py-3.5 text-right">Total Invoiced</th>
                <th className="px-5 py-3.5 text-right">Total Paid</th>
                <th className="px-5 py-3.5 text-right">Outstanding Due</th>
                <th className="px-5 py-3.5 text-center">Aging & Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
                    <p className="mt-2 text-xs font-bold text-slate-400">Loading customer AR accounts...</p>
                  </td>
                </tr>
              ) : filteredShopAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm font-bold">
                    No customer accounts found matching filters.
                  </td>
                </tr>
              ) : (
                filteredShopAccounts.map((acc: any) => {
                  const hasDue = acc.remainingDue > 0;
                  return (
                    <tr key={acc.shopKey} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 flex-shrink-0">
                            <Store className="w-4 h-4" />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setShopForLedger(acc.shop)}
                              className="font-black text-slate-900 hover:text-indigo-600 transition-colors text-left hover:underline block text-sm"
                            >
                              {acc.shop.name}
                            </button>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                              {acc.shop.ownerName && <span>Owner: <strong>{acc.shop.ownerName}</strong></span>}
                              {acc.shop.phone && (
                                <a 
                                  href={`tel:${acc.shop.phone}`} 
                                  className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 font-bold"
                                >
                                  <Phone className="w-2.5 h-2.5" />
                                  {acc.shop.phone}
                                </a>
                              )}
                            </div>
                            {acc.shop.address && (
                              <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                                <span className="font-medium text-slate-700">{acc.shop.address}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-700 text-xs block">
                          {acc.shop.route?.name || 'Direct / Unassigned'}
                        </span>
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          <span className="text-[10px] text-slate-400">
                            {acc.openInvoiceCount} open / {acc.invoiceCount} invoices
                          </span>
                          {acc.deliveryMenList.length > 0 && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                              Deliv: {acc.deliveryMenList.join(', ')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right font-medium text-slate-700 whitespace-nowrap">
                        {formatCurrency(acc.totalDue)}
                      </td>

                      <td className="px-5 py-3.5 text-right font-medium text-emerald-600 whitespace-nowrap">
                        {formatCurrency(acc.totalPaid)}
                      </td>

                      <td className="px-5 py-3.5 text-right font-black text-sm whitespace-nowrap">
                        <span className={hasDue ? 'text-rose-600' : 'text-emerald-600'}>
                          {formatCurrency(acc.remainingDue)}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          {acc.aging60Plus > 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                              Overdue &gt; 60d
                            </span>
                          ) : acc.aging31_60 > 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                              31-60d
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Current &lt; 30d
                            </span>
                          )}
                          
                          {acc.hasDraftAnomaly && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                              Audit Draft Flag
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShopForLedger(acc.shop)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                            title="View Customer Subledger with all invoices"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Ledger
                          </button>

                          {hasDue && (
                            <button
                              type="button"
                              onClick={() => setShopForMultiCollect(acc.shop)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Collect Payment
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

        {/* MOBILE CARDS FOR CUSTOMER ACCOUNTS (Mobile First View) */}
        <div className="md:hidden flex flex-col divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
              <p className="mt-2 text-xs text-slate-400 font-bold">Loading customer accounts...</p>
            </div>
          ) : filteredShopAccounts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              No customer accounts found.
            </div>
          ) : (
            filteredShopAccounts.map((acc: any) => {
              const hasDue = acc.remainingDue > 0;
              return (
                <div key={acc.shopKey} className="p-4 flex flex-col gap-3 hover:bg-slate-50/50 transition-colors">
                  
                  {/* Shop Header Row */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                        <Store className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <button
                          onClick={() => setShopForLedger(acc.shop)}
                          className="font-black text-slate-900 text-sm hover:underline text-left block leading-snug truncate"
                        >
                          {acc.shop.name}
                        </button>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {acc.shop.ownerName ? `${acc.shop.ownerName}` : 'Owner: —'}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border shrink-0 ${
                      hasDue 
                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {hasDue ? 'Active Due' : 'Settled'}
                    </span>
                  </div>

                  {/* Shop Address & Route Box (Prominently visible on mobile) */}
                  <div className="flex items-start gap-2 text-xs bg-slate-50 border border-slate-200/90 rounded-xl p-2.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-[11px] leading-tight break-words">
                        {acc.shop.address || <span className="text-slate-400 font-normal italic">Address: Not specified</span>}
                      </p>
                      {acc.shop.route?.name && (
                        <p className="text-[10px] text-slate-500 mt-1 font-medium flex items-center gap-1">
                          Route: <span className="font-bold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.2 rounded">{acc.shop.route.name}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contact & Invoice Counts Strip */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {acc.shop.phone && (
                      <a
                        href={`tel:${acc.shop.phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100"
                        title="Call Customer Directly"
                      >
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{acc.shop.phone}</span>
                      </a>
                    )}

                    <span className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                      {acc.openInvoiceCount} open / {acc.invoiceCount} invoices
                    </span>

                    {acc.deliveryMenList.length > 0 && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Deliv: <strong>{acc.deliveryMenList.join(', ')}</strong>
                      </span>
                    )}
                  </div>

                  {/* 3-Box Financial Summary Strip */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-200/80 text-center">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase truncate">Invoiced</p>
                      <p className="font-bold text-slate-800 text-xs mt-0.5 truncate">{formatCurrency(acc.totalDue)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase truncate">Paid</p>
                      <p className="font-bold text-emerald-600 text-xs mt-0.5 truncate">{formatCurrency(acc.totalPaid)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase truncate">Net Due</p>
                      <p className={`font-black text-xs mt-0.5 truncate ${hasDue ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(acc.remainingDue)}
                      </p>
                    </div>
                  </div>

                  {/* Aging Badges row if overdue */}
                  {(acc.aging60Plus > 0 || acc.aging31_60 > 0 || acc.hasDraftAnomaly) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {acc.aging60Plus > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                          Critical Overdue &gt; 60d
                        </span>
                      )}
                      {acc.aging31_60 > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                          Watchlist 31-60d
                        </span>
                      )}
                      {acc.hasDraftAnomaly && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Audit Draft Flag
                        </span>
                      )}
                    </div>
                  )}

                  {/* Mobile Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setShopForLedger(acc.shop)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Ledger & History
                    </button>
                    {hasDue && (
                      <button
                        onClick={() => setShopForMultiCollect(acc.shop)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Collect Payment
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODALS */}

      {/* 1. Multi-Invoice Enterprise Collection Modal */}
      {shopForMultiCollect && (
        <MultiInvoiceCollectModal
          shop={shopForMultiCollect}
          onClose={() => setShopForMultiCollect(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['dues'] });
            queryClient.invalidateQueries({ queryKey: ['due-stats'] });
            queryClient.invalidateQueries({ queryKey: ['shop-dues', shopForMultiCollect.id] });
          }}
        />
      )}

      {/* 2. Customer Sub-Ledger Modal */}
      {shopForLedger && (
        <CustomerLedgerModal
          shop={shopForLedger}
          onClose={() => setShopForLedger(null)}
          onOpenMultiCollect={() => {
            setShopForMultiCollect(shopForLedger);
            setShopForLedger(null);
          }}
          onViewOrder={(orderId) => handleViewOrder(orderId)}
        />
      )}

      {/* 3. Order Details Modal */}
      {isViewingOrderLoading && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-sm font-bold text-slate-700">Loading order details...</span>
          </div>
        </div>
      )}

      {viewingOrder && (
        <OrderModal
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}

      {/* 4. Manual Due Modal */}
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
      showErrorToast('Reason must be at least 3 characters long.');
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
      showSuccessToast('New manual due added successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to add manual due.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in duration-200 mb-0 pb-safe pb-4 sm:pb-0">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-base sm:text-lg font-black text-slate-900">Add Manual Due Entry</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5 relative">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Shop</label>

            {selectedShop ? (
              <div className="flex items-center justify-between p-3 border border-indigo-200 rounded-xl bg-indigo-50/40 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedShop.name}</p>
                    <p className="text-xs text-slate-500">
                      {selectedShop.route?.name ? `Route: ${selectedShop.route.name}` : ''}
                      {selectedShop.ownerName ? ` · ${selectedShop.ownerName}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShopId(''); setShopSearch(''); setIsDropdownOpen(true); }}
                  className="text-xs font-bold text-indigo-600 hover:underline px-2 py-1"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={shopSearch}
                    onChange={(e) => {
                      setShopSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Search shop by name, route or mobile..."
                    disabled={isLoading}
                    className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  />
                </div>

                {isLoading && <p className="text-[10px] text-slate-400 mt-1">Loading shops...</p>}

                {isDropdownOpen && !isLoading && (
                  <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 divide-y divide-slate-100">
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
                          className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">{shop.name}</p>
                            <p className="text-xs text-slate-500">
                              {shop.route?.name ? `Route: ${shop.route.name}` : 'No Route'}
                              {shop.ownerName ? ` · ${shop.ownerName}` : ''}
                            </p>
                          </div>
                          {shop.phone && (
                            <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {shop.phone}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">&quot;{shopSearch}&quot; No shops found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Due Amount (BDT)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Due Reason / Reference</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="e.g., Previous unpaid balance, adjustment memo"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Notes (Optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Add any additional notes here..."
            />
          </div>

          <div className="pt-3 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-xs sm:text-sm font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="flex-1 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Due Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
