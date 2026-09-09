'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardMetrics, getDashboardDrilldown, DashboardFilterParams } from '@/lib/api/dashboard';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { StatCard } from '@/components/ui/stat-card';
import {
  TrendingUp,
  Package,
  AlertCircle,
  Truck,
  CheckCircle,
  DollarSign,
  Activity,
  ShoppingCart,
  XCircle,
  Clock,
  Wallet,
  Building2,
  Layers,
  Calendar,
  ChevronDown,
  RefreshCw,
  Sparkles,
  RotateCcw,
  BarChart3,
  Search,
  Eye,
  Loader2,
  X,
  Store,
  User as UserIcon,
  Flame,
  Trophy,
  Tag,
  Filter,
  ArrowUpDown,
  ArrowUpRight,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { SRDuesList } from './sr-dues-list';
import { useAuth } from '../auth/auth-provider';
import { Role } from '@/types/api';
import { OrderModal } from '@/components/orders/order-modal';
import { getOrder } from '@/lib/api/orders';
import { useToast } from '@/components/ui/toast-provider';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className ?? ''}`} />;
}

const MONTH_NAMES_BN = [
  { en: 'January', bn: 'January' },
  { en: 'February', bn: 'February' },
  { en: 'March', bn: 'March' },
  { en: 'April', bn: 'April' },
  { en: 'May', bn: 'May' },
  { en: 'June', bn: 'June' },
  { en: 'July', bn: 'July' },
  { en: 'August', bn: 'August' },
  { en: 'September', bn: 'September' },
  { en: 'October', bn: 'October' },
  { en: 'November', bn: 'November' },
  { en: 'December', bn: 'December' },
];

type DrilldownType = 'sales' | 'orders' | 'collections' | 'dues' | 'dispatches' | 'cancelled' | null;

export function DashboardPage() {
  const { user } = useAuth();
  const { error: showErrorToast } = useToast();
  
  // Current date
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  // Filter States
  const [period, setPeriod] = useState<'today' | 'last_7_days' | 'this_month' | 'last_month' | 'this_year' | 'all_time' | 'custom'>('this_month');
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // Drilldown filter state (which card is clicked)
  const [activeDrilldown, setActiveDrilldown] = useState<DrilldownType>(null);
  const [drilldownSearch, setDrilldownSearch] = useState('');

  // Chart Hover & Active Tooltip State
  const [hoveredChartDay, setHoveredChartDay] = useState<any>(null);

  // Top Products Filter State
  const [selectedTopProductCompany, setSelectedTopProductCompany] = useState<number | 'all'>('all');
  const [topProductSearch, setTopProductSearch] = useState('');
  const [productSalesFilter, setProductSalesFilter] = useState<'sold' | 'unsold' | 'all'>('sold');
  const [topProductStockFilter, setTopProductStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [topProductSort, setTopProductSort] = useState<'sold_qty_desc' | 'sold_val_desc' | 'stock_desc' | 'stock_asc' | 'name_asc'>('sold_qty_desc');

  // Modal for Viewing Single Company Top Products (Direct from Company Card)
  const [viewingCompanyProducts, setViewingCompanyProducts] = useState<{ companyId: number; companyName: string } | null>(null);
  const [modalProductSearch, setModalProductSearch] = useState('');
  const [modalSalesFilter, setModalSalesFilter] = useState<'sold' | 'unsold' | 'all'>('sold');
  const [modalProductStockFilter, setModalProductStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [modalProductSort, setModalProductSort] = useState<'sold_qty_desc' | 'sold_val_desc' | 'stock_desc' | 'name_asc'>('sold_qty_desc');

  // Order Details Modal State
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [isViewingOrderLoading, setIsViewingOrderLoading] = useState(false);

  const queryParams: DashboardFilterParams = {
    period,
    month: period === 'custom' ? selectedMonth : undefined,
    year: period === 'custom' ? selectedYear : undefined,
  };

  const { data: d, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['dashboard', 'metrics', queryParams],
    queryFn: () => getDashboardMetrics(queryParams),
    refetchInterval: 30000,
  });

  // Fetch Drilldown data when a card is clicked
  const { data: drilldownData, isLoading: isDrilldownLoading } = useQuery({
    queryKey: ['dashboard', 'drilldown', { ...queryParams, type: activeDrilldown }],
    queryFn: () => getDashboardDrilldown({ ...queryParams, type: activeDrilldown! }),
    enabled: !!activeDrilldown,
  });

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

  const toggleDrilldown = (type: DrilldownType) => {
    if (activeDrilldown === type) {
      setActiveDrilldown(null);
    } else {
      setActiveDrilldown(type);
      setDrilldownSearch('');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 p-3 md:p-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <Skeleton className="h-12 w-64 rounded-2xl" />
          <Skeleton className="h-12 w-80 rounded-2xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error || !d) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
        <AlertCircle className="h-14 w-14 text-rose-500 animate-bounce" />
        <h3 className="mt-4 text-xl font-black text-slate-900">Failed to Load Dashboard</h3>
        <p className="mt-2 text-sm text-slate-500 max-w-md">
          Please check your database connection or server status and try again.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-6 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const { orders, delivery, money, stock, today, period: periodMetrics } = d.uiMetrics;
  const periodInfo = d.periodInfo || {};

  const deliveryRate = delivery.totalDispatch > 0 
    ? `${Math.round((delivery.delivered / delivery.totalDispatch) * 100)}%` 
    : '0%';

  const isCurrentMonthActive = period === 'this_month';

  const activeMonthBn = periodInfo.month ? MONTH_NAMES_BN[periodInfo.month - 1]?.bn : '';
  const displayPeriodTitle = 
    period === 'today' ? 'Today Live Stats' :
    period === 'last_7_days' ? 'Last 7 Days Stats' :
    period === 'this_year' ? `${currentYear} Annual Overview` :
    period === 'all_time' ? 'All Time History' :
    `${activeMonthBn || periodInfo.monthName || ''} ${periodInfo.year || ''}`;

  // Filter Drilldown items with search term
  const drilldownItems = (drilldownData?.items || []).filter((item: any) => {
    if (!drilldownSearch.trim()) return true;
    const q = drilldownSearch.toLowerCase();
    return (
      item.id?.toString().includes(q) ||
      item.batchNumber?.toLowerCase().includes(q) ||
      item.shopName?.toLowerCase().includes(q) ||
      item.productName?.toLowerCase().includes(q) ||
      item.srName?.toLowerCase().includes(q) ||
      item.deliveryManName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 pb-20 p-2 sm:p-4 md:p-6">
      
      {/* 🧭 Top Filter & Period Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                {user?.role === Role.SR ? 'Field Sales Dashboard' : 'Executive Business Dashboard'}
              </h1>
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mt-0.5">
                <span>📅 Period: </span>
                <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  {displayPeriodTitle}
                </span>
                {periodInfo.totalDays ? (
                  <span className="text-slate-500">({periodInfo.totalDays} Days)</span>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector Tabs in Simple Bangla */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold gap-0.5">
            <button
              onClick={() => {
                setPeriod('today');
                setIsMonthPickerOpen(false);
                setActiveDrilldown(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                period === 'today'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Today
            </button>

            <button
              onClick={() => {
                setPeriod('last_7_days');
                setIsMonthPickerOpen(false);
                setActiveDrilldown(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                period === 'last_7_days'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-indigo-500" />
              7 Days
            </button>

            <button
              onClick={() => {
                setPeriod('this_month');
                setIsMonthPickerOpen(false);
                setActiveDrilldown(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                period === 'this_month'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Current Month
            </button>

            <button
              onClick={() => {
                setPeriod('last_month');
                setIsMonthPickerOpen(false);
                setActiveDrilldown(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                period === 'last_month'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Last Month
            </button>

            <button
              onClick={() => {
                setPeriod('this_year');
                setIsMonthPickerOpen(false);
                setActiveDrilldown(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                period === 'this_year'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Current Year
            </button>

            <button
              onClick={() => {
                setPeriod('all_time');
                setIsMonthPickerOpen(false);
                setActiveDrilldown(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                period === 'all_time'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Custom Month Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                period === 'custom'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {period === 'custom'
                  ? `${MONTH_NAMES_BN[selectedMonth - 1]?.bn} ${selectedYear}`
                  : 'Select Another Month...'}
              </span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>

            {isMonthPickerOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <span className="text-xs font-black text-slate-800">Select Month & Year</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="text-xs font-black bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800"
                  >
                    {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_NAMES_BN.map((mObj, idx) => {
                    const mNum = idx + 1;
                    const isSelected = period === 'custom' && selectedMonth === mNum && selectedYear === selectedYear;
                    return (
                      <button
                        key={mObj.en}
                        onClick={() => {
                          setSelectedMonth(mNum);
                          setPeriod('custom');
                          setIsMonthPickerOpen(false);
                          setActiveDrilldown(null);
                        }}
                        className={`px-2 py-2 text-[11px] font-bold rounded-lg transition-colors text-center ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-black'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {mObj.bn}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh Dashboard"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ⚡ 1. TODAY'S REAL-TIME PULSE */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-5 w-5 text-rose-500 animate-pulse" />
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              {user?.role === Role.SR ? "Today Activity & Sales" : "Today Instant Overview"}
            </h2>
            <p className="text-[11px] font-semibold text-slate-400">Live order booking, dispatches, and cash collection for today</p>
          </div>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="Today Orders"
            value={formatNumber(today?.ordersCount ?? orders?.todayOrdersCount)}
            description={`Value: ${formatCurrency(today?.orderValue ?? orders?.todayOrderValue)}`}
            icon={ShoppingCart}
            colorTheme="cyan"
          />
          <StatCard
            label="Today Dispatches"
            value={formatNumber(today?.dispatchCount ?? delivery?.todayDispatch)}
            description={(today?.dispatchAmount ?? delivery?.todayDispatchAmount) > 0 ? `Value: ${formatCurrency(today?.dispatchAmount ?? delivery?.todayDispatchAmount)}` : undefined}
            icon={Truck}
            colorTheme="amber"
          />
          <StatCard
            label="Today Delivered Sales"
            value={formatCurrency(today?.settledValue ?? money?.todayFinalSold ?? 0)}
            description="Actual settled sales"
            icon={DollarSign}
            colorTheme="indigo"
          />
          <StatCard
            label="Today New Due"
            value={formatCurrency(today?.dueAmount ?? money?.todayDue ?? 0)}
            description="Uncollected credit due"
            icon={AlertCircle}
            colorTheme="rose"
          />
          <StatCard
            label="Today Cash Collected"
            value={formatCurrency(today?.dueCollection ?? money?.todayDueCollection ?? 0)}
            description="Cash received from shops"
            icon={CheckCircle}
            colorTheme="emerald"
          />
          <StatCard
            label="Today Cancelled Orders"
            value={formatNumber(today?.cancelledOrders ?? orders?.todayCancelled ?? 0)}
            description="Cancelled / rejected orders"
            icon={XCircle}
            colorTheme="slate"
          />
        </div>
      </section>

      {/* 📊 2. MONTHLY PERFORMANCE CARDS (INTERACTIVE & CLICKABLE) */}
      <section className="rounded-3xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                {displayPeriodTitle} — Period Overview
              </h2>
              <p className="text-[11px] font-semibold text-slate-500">
                👉 Click any card below to drilldown into detailed transaction records
              </p>
            </div>
          </div>
          <span className="text-xs font-black text-indigo-700 bg-white border border-indigo-200 px-3.5 py-1.5 rounded-xl shadow-xs self-start sm:self-auto">
            {isCurrentMonthActive ? `Current Month (Days 1 to ${periodInfo.totalDays || 30})` : displayPeriodTitle}
          </span>
        </div>

        {/* 6 Clickable Interactive Cards */}
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          
          {/* Card 1: Sales */}
          <div 
            onClick={() => toggleDrilldown('sales')}
            className={`cursor-pointer transition-all duration-300 rounded-[18px] ${
              activeDrilldown === 'sales'
                ? 'ring-4 ring-emerald-500 ring-offset-2 scale-[1.03] shadow-xl'
                : 'hover:scale-[1.02]'
            }`}
          >
            <StatCard
              label="Total Delivered Sales 👆"
              value={formatCurrency(periodMetrics?.netSales ?? money?.totalFinalSold)}
              description={activeDrilldown === 'sales' ? '🟢 Active filter (tap to close)' : 'Click to view sales records'}
              icon={CheckCircle}
              colorTheme="emerald"
            />
          </div>

          {/* Card 2: Orders Value */}
          <div 
            onClick={() => toggleDrilldown('orders')}
            className={`cursor-pointer transition-all duration-300 rounded-[18px] ${
              activeDrilldown === 'orders'
                ? 'ring-4 ring-indigo-500 ring-offset-2 scale-[1.03] shadow-xl'
                : 'hover:scale-[1.02]'
            }`}
          >
            <StatCard
              label="Total Order Value 👆"
              value={formatCurrency(periodMetrics?.orderValue ?? orders?.totalOrderValue)}
              description={activeDrilldown === 'orders' ? '🟢 Active filter (tap to close)' : `Total Orders: ${formatNumber(periodMetrics?.ordersCount ?? orders?.totalOrders)}`}
              icon={DollarSign}
              colorTheme="indigo"
            />
          </div>

          {/* Card 3: Collections */}
          <div 
            onClick={() => toggleDrilldown('collections')}
            className={`cursor-pointer transition-all duration-300 rounded-[18px] ${
              activeDrilldown === 'collections'
                ? 'ring-4 ring-cyan-500 ring-offset-2 scale-[1.03] shadow-xl'
                : 'hover:scale-[1.02]'
            }`}
          >
            <StatCard
              label="Total Cash Collected 👆"
              value={formatCurrency(periodMetrics?.dueCollection ?? money?.periodDueCollection ?? 0)}
              description={activeDrilldown === 'collections' ? '🟢 Active filter (tap to close)' : 'Click to view collection records'}
              icon={Wallet}
              colorTheme="cyan"
            />
          </div>

          {/* Card 4: New Due */}
          <div 
            onClick={() => toggleDrilldown('dues')}
            className={`cursor-pointer transition-all duration-300 rounded-[18px] ${
              activeDrilldown === 'dues'
                ? 'ring-4 ring-amber-500 ring-offset-2 scale-[1.03] shadow-xl'
                : 'hover:scale-[1.02]'
            }`}
          >
            <StatCard
              label="New Market Due 👆"
              value={formatCurrency(periodMetrics?.newDue ?? money?.periodDue ?? 0)}
              description={activeDrilldown === 'dues' ? '🟢 Active filter (tap to close)' : 'Click to view due records'}
              icon={AlertCircle}
              colorTheme="amber"
            />
          </div>

          {/* Card 5: Dispatched */}
          <div 
            onClick={() => toggleDrilldown('dispatches')}
            className={`cursor-pointer transition-all duration-300 rounded-[18px] ${
              activeDrilldown === 'dispatches'
                ? 'ring-4 ring-blue-500 ring-offset-2 scale-[1.03] shadow-xl'
                : 'hover:scale-[1.02]'
            }`}
          >
            <StatCard
              label="Total Dispatched Orders 👆"
              value={formatNumber(periodMetrics?.dispatchCount ?? delivery?.totalDispatch)}
              description={activeDrilldown === 'dispatches' ? '🟢 Active filter (tap to close)' : `Delivered: ${formatNumber(periodMetrics?.deliveredCount ?? delivery?.delivered)}`}
              icon={Truck}
              colorTheme="primary"
            />
          </div>

          {/* Card 6: Cancelled Orders */}
          <div 
            onClick={() => toggleDrilldown('cancelled')}
            className={`cursor-pointer transition-all duration-300 rounded-[18px] ${
              activeDrilldown === 'cancelled'
                ? 'ring-4 ring-rose-500 ring-offset-2 scale-[1.03] shadow-xl'
                : 'hover:scale-[1.02]'
            }`}
          >
            <StatCard
              label="Cancelled Orders 👆"
              value={formatNumber(periodMetrics?.cancelledOrders ?? orders?.cancelledOrders ?? 0)}
              description={activeDrilldown === 'cancelled' ? '🟢 Active filter (tap to close)' : 'Click to view cancelled records'}
              icon={XCircle}
              colorTheme="rose"
            />
          </div>
        </div>

        {/* 📋 DYNAMIC DRILLDOWN FILTERED DATA LIST (SHOWS ON CARD CLICK) */}
        {activeDrilldown && (
          <div className="bg-white rounded-2xl border border-indigo-200 p-4 sm:p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-indigo-600 animate-ping" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {activeDrilldown === 'sales' && `Delivered Sales Breakdown (${drilldownItems.length} Invoices)`}
                    {activeDrilldown === 'orders' && `Booked Orders List (${drilldownItems.length} Orders)`}
                    {activeDrilldown === 'collections' && `Cash Collection Records (${drilldownItems.length} Collections)`}
                    {activeDrilldown === 'dues' && `New Market Due Invoices (${drilldownItems.length} Invoices)`}
                    {activeDrilldown === 'dispatches' && `Delivery Dispatch Batches (${drilldownItems.length} Batches)`}
                    {activeDrilldown === 'cancelled' && `Cancelled Orders List (${drilldownItems.length} Cancelled)`}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Period: <span className="font-bold text-indigo-700">{displayPeriodTitle}</span> • Click any order to view memo
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter this list..."
                    value={drilldownSearch}
                    onChange={(e) => setDrilldownSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50"
                  />
                </div>
                <button
                  onClick={() => setActiveDrilldown(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-rose-500" />
                  Close Table
                </button>
              </div>
            </div>

            {/* Drilldown Table Content */}
            <div className="mt-4 overflow-x-auto">
              {isDrilldownLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                  <p className="mt-2 text-xs font-bold text-slate-400">Loading data...</p>
                </div>
              ) : drilldownItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-bold">
                  No records found.
                </div>
              ) : (
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                    {activeDrilldown === 'sales' && (
                      <tr>
                        <th className="px-4 py-3">Order #</th>
                        <th className="px-4 py-3">Shop Name</th>
                        <th className="px-4 py-3">Route</th>
                        <th className="px-4 py-3">Delivery Person</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Settled Sales</th>
                        <th className="px-4 py-3 text-right">Due Amount</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    )}
                    {activeDrilldown === 'orders' && (
                      <tr>
                        <th className="px-4 py-3">Order #</th>
                        <th className="px-4 py-3">Shop Name</th>
                        <th className="px-4 py-3">Route</th>
                        <th className="px-4 py-3">Sales Rep (SR)</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Order Value</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    )}
                    {activeDrilldown === 'collections' && (
                      <tr>
                        <th className="px-4 py-3">Order #</th>
                        <th className="px-4 py-3">Shop Name</th>
                        <th className="px-4 py-3">Collected By (SR)</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Collected Amount</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    )}
                    {activeDrilldown === 'dues' && (
                      <tr>
                        <th className="px-4 py-3">Order #</th>
                        <th className="px-4 py-3">Shop Name</th>
                        <th className="px-4 py-3">Route</th>
                        <th className="px-4 py-3">Sales Rep (SR)</th>
                        <th className="px-4 py-3 text-right">Original Due</th>
                        <th className="px-4 py-3 text-right">Paid</th>
                        <th className="px-4 py-3 text-right">Remaining Due</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    )}
                    {activeDrilldown === 'dispatches' && (
                      <tr>
                        <th className="px-4 py-3">Batch #</th>
                        <th className="px-4 py-3">Delivery Person</th>
                        <th className="px-4 py-3">Dispatch Date</th>
                        <th className="px-4 py-3 text-center">Orders Count</th>
                        <th className="px-4 py-3 text-right">Total Batch Value</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    )}
                    {activeDrilldown === 'cancelled' && (
                      <tr>
                        <th className="px-4 py-3">Order #</th>
                        <th className="px-4 py-3">Shop Name</th>
                        <th className="px-4 py-3">Route</th>
                        <th className="px-4 py-3">Sales Rep (SR)</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Order Value</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drilldownItems.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        {activeDrilldown === 'sales' && (
                          <>
                            <td className="px-4 py-3 font-black text-indigo-600">#{item.id}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{item.shopName}</td>
                            <td className="px-4 py-3 text-slate-500">{item.routeName || '—'}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{item.deliveryManName || '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{item.orderDate}</td>
                            <td className="px-4 py-3 text-right font-black text-emerald-600">{formatCurrency(item.soldAmount)}</td>
                            <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(item.dueAmount)}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleViewOrder(item.id)}
                                className="inline-flex items-center gap-1 text-indigo-600 font-black hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Memo
                              </button>
                            </td>
                          </>
                        )}
                        {activeDrilldown === 'orders' && (
                          <>
                            <td className="px-4 py-3 font-black text-indigo-600">#{item.id}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{item.shopName}</td>
                            <td className="px-4 py-3 text-slate-500">{item.routeName || '—'}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{item.srName || '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{item.orderDate}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">{formatCurrency(item.grandTotal)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-black">
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleViewOrder(item.id)}
                                className="inline-flex items-center gap-1 text-indigo-600 font-black hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Memo
                              </button>
                            </td>
                          </>
                        )}
                        {activeDrilldown === 'collections' && (
                          <>
                            <td className="px-4 py-3 font-black text-indigo-600">#{item.orderId}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{item.shopName}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{item.srName || '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{new Date(item.collectionDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-right font-black text-emerald-600">{formatCurrency(item.collectedAmount)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${
                                item.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                item.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {item.status === 'APPROVED' ? 'Approved' : item.status === 'PENDING' ? 'Pending' : 'Cancelled'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleViewOrder(item.orderId)}
                                className="inline-flex items-center gap-1 text-indigo-600 font-black hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" /> Memo
                              </button>
                            </td>
                          </>
                        )}
                        {activeDrilldown === 'dues' && (
                          <>
                            <td className="px-4 py-3 font-black text-indigo-600">#{item.orderId}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{item.shopName}</td>
                            <td className="px-4 py-3 text-slate-500">{item.routeName || '—'}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{item.srName || '—'}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(item.dueAmount)}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(item.paidAmount)}</td>
                            <td className="px-4 py-3 text-right font-black text-rose-600">{formatCurrency(item.remainingDue)}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleViewOrder(item.orderId)}
                                className="inline-flex items-center gap-1 text-indigo-600 font-black hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" /> Memo
                              </button>
                            </td>
                          </>
                        )}
                        {activeDrilldown === 'dispatches' && (
                          <>
                            <td className="px-4 py-3 font-black text-indigo-600">#{item.batchNumber}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{item.deliveryPersonName || '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{item.dispatchDate}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">{item.totalOrders} </td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">{formatCurrency(item.totalAmount)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200">
                                {item.status}
                              </span>
                            </td>
                          </>
                        )}
                        {activeDrilldown === 'cancelled' && (
                          <>
                            <td className="px-4 py-3 font-black text-rose-600">#{item.id}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{item.shopName}</td>
                            <td className="px-4 py-3 text-slate-500">{item.routeName || '—'}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{item.srName || '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{item.orderDate}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">{formatCurrency(item.grandTotal)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-black border border-rose-200">
                                {item.status || 'CANCELLED'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleViewOrder(item.id)}
                                className="inline-flex items-center gap-1 text-indigo-600 font-black hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Memo
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 🏦 3. LIVE BUSINESS HEALTH & INVENTORY (Cumulative Live Snapshot) */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-5 w-5 text-emerald-600" />
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Overall Market Due & Warehouse Stock (Live Status)
            </h2>
            <p className="text-[11px] font-semibold text-slate-400">Current market dues and warehouse inventory summary</p>
          </div>
        </div>

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Market Due"
            value={formatCurrency(money?.totalDue ?? 0)}
            description="Total customer receivables"
            icon={AlertCircle}
            colorTheme="rose"
          />
          <StatCard
            label="Pending Collections"
            value={formatCurrency(money?.pendingCollected ?? 0)}
            description="Unapproved collection receipts"
            icon={Clock}
            colorTheme="amber"
          />
          <StatCard
            label="Total Approved Collections"
            value={formatCurrency(money?.approvedCollected ?? 0)}
            description="Lifetime settled cash"
            icon={CheckCircle}
            colorTheme="emerald"
          />
          {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER || user?.role === Role.ADMIN) ? (
            <StatCard
              label="Total Inventory Value"
              value={formatCurrency(stock?.stockValue ?? 0)}
              description={`Active Items: ${formatNumber(stock?.activeProducts ?? 0)}`}
              icon={Layers}
              colorTheme="violet"
            />
          ) : (
            <StatCard
              label="Rejected Collections"
              value={formatCurrency(money?.rejectedCollected ?? 0)}
              description="Rejected payment receipts"
              icon={XCircle}
              colorTheme="slate"
            />
          )}
        </div>
      </section>

      {/* 📦 Stock Breakdown (Admin & Manager) */}
      {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER || user?.role === Role.ADMIN) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-5 w-5 text-cyan-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-600">Warehouse Stock Overview (Inventory Report)</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Total SKUs</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(stock.totalProducts)} </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Active Products</p>
              <p className="text-lg font-black text-emerald-600">{formatNumber(stock.activeProducts)} </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">In Stock</p>
              <p className="text-lg font-black text-blue-600">{formatNumber(stock.inStockProducts)} </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Low Stock Alert</p>
              <p className="text-lg font-black text-amber-600">{formatNumber(stock.lowStockProducts)} </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Out of Stock</p>
              <p className="text-lg font-black text-rose-600">{formatNumber(stock.outOfStockProducts)} </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Total Stock Value</p>
              <p className="text-lg font-black text-violet-600">{formatCurrency(stock.stockValue)}</p>
            </div>
          </div>
        </section>
      )}

      {/* 📈 4. MONTHLY PROGRESSION & DAILY SALES TREND CHART */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-sm">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                {displayPeriodTitle} — Daily Sales Trend
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              From 1st to {periodInfo.totalDays || 30} Daily delivered and settled sales value
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-black text-indigo-700 bg-indigo-50 px-3.5 py-1.5 rounded-xl border border-indigo-100">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
              Settled Cash Sales
            </span>
          </div>
        </div>

        {/* 📊 Live Hover Detail Indicator */}
        <div className="mb-4 min-h-[48px] flex items-center justify-between px-4 py-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-100/80 transition-all">
          {hoveredChartDay ? (
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-indigo-600 animate-ping" />
              <div>
                <span className="text-xs font-black text-slate-800">
                  {hoveredChartDay.day} {activeMonthBn || ''} ({hoveredChartDay.date}):
                </span>{' '}
                <span className="text-sm font-black text-indigo-700">
                  {formatCurrency(hoveredChartDay.amount)}
                </span>
                <span className="ml-2 text-[11px] font-semibold text-slate-500">Delivered Sales</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Hover or tap on any bar to see sales details for that day</span>
            </div>
          )}
          {hoveredChartDay && (
            <button
              onClick={() => setHoveredChartDay(null)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded-md hover:bg-white transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Dynamic Month Day Trend */}
        {d.charts?.monthlyTrend && d.charts.monthlyTrend.length > 0 ? (
          <div className="space-y-2">
            <div className="flex h-60 sm:h-68 items-end gap-1 sm:gap-1.5 px-1 sm:px-2 overflow-x-auto pb-4 pt-12">
              {d.charts.monthlyTrend.map((dayItem: any) => {
                const max = Math.max(...d.charts.monthlyTrend.map((x: any) => x.amount), 1);
                const height = (dayItem.amount / max) * 100;
                const isTodayDate = dayItem.date === new Date().toISOString().split('T')[0];
                const isHovered = hoveredChartDay?.day === dayItem.day;

                return (
                  <div
                    key={dayItem.day}
                    onMouseEnter={() => setHoveredChartDay(dayItem)}
                    onMouseLeave={() => setHoveredChartDay(null)}
                    onClick={() => setHoveredChartDay(dayItem)}
                    className="group relative flex flex-1 h-full flex-col items-center min-w-[24px] sm:min-w-[28px] cursor-pointer"
                  >
                    {/* Floating Tooltip with Arrow */}
                    <div
                      className={`pointer-events-none absolute -top-9 z-30 flex flex-col items-center transition-all duration-150 ${
                        isHovered
                          ? 'opacity-100 scale-100'
                          : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'
                      }`}
                    >
                      <div className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[10px] font-black shadow-2xl whitespace-nowrap border border-slate-700">
                        {dayItem.day} {activeMonthBn || ''}: {formatCurrency(dayItem.amount)}
                      </div>
                      <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700" />
                    </div>

                    <div className="flex-1 w-full flex items-end justify-center mb-2">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          dayItem.amount > 0
                            ? isTodayDate || isHovered
                              ? 'bg-gradient-to-t from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/30 scale-x-110'
                              : 'bg-indigo-500/85 group-hover:bg-indigo-600'
                            : isHovered
                              ? 'bg-slate-300'
                              : 'bg-slate-100 group-hover:bg-slate-200'
                        }`}
                        style={{ height: `${Math.max(6, height)}%` }}
                      />
                    </div>
                    <span className={`text-[9px] font-black ${isTodayDate || isHovered ? 'text-indigo-700 font-black underline scale-110' : 'text-slate-400'}`}>
                      {dayItem.day}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] font-black text-slate-400 px-2 pt-2 border-t border-slate-100">
              <span>Day 1</span>
              <span>Day 15</span>
              <span>{periodInfo.totalDays || 30} Day (End of Month)</span>
            </div>
          </div>
        ) : (
          <div className="flex h-60 sm:h-68 items-end gap-2 px-2 overflow-x-auto pb-4 pt-12">
            {d.charts.last7Days.map((day: any) => {
              const max = Math.max(...d.charts.last7Days.map((x: any) => x.amount), 1);
              const height = (day.amount / max) * 100;
              return (
                <div
                  key={day.date}
                  className="group relative flex flex-1 h-full flex-col items-center min-w-[32px] cursor-pointer"
                >
                  <div className="pointer-events-none absolute -top-9 z-30 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-all duration-150">
                    <div className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[10px] font-bold shadow-2xl whitespace-nowrap border border-slate-700">
                      {formatCurrency(day.amount)}
                    </div>
                    <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700" />
                  </div>
                  <div className="flex-1 w-full flex items-end justify-center mb-2">
                    <div
                      className="w-full rounded-t-lg bg-indigo-500/80 transition-all group-hover:bg-indigo-600"
                      style={{ height: `${Math.max(8, height)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">{day.date}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 🏢 5. COMPANY-WISE BREAKDOWN */}
      {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER || user?.role === Role.ADMIN) && d.companySummary && d.companySummary.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                Sales by Company ({displayPeriodTitle})
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">Total sales performance broken down by company and supplier</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.companySummary.map((c: any) => (
              <div
                key={c.companyId}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 line-clamp-1">{c.companyName}</h4>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Company Summary</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Total Sales</p>
                      <p className="text-sm font-black text-emerald-600">{formatCurrency(c.sales)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Company ID</p>
                      <p className="text-sm font-black text-slate-500">#{c.companyId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setViewingCompanyProducts({ companyId: c.companyId, companyName: c.companyName });
                        setModalProductSearch('');
                      }}
                      className="flex-1 py-2 px-2.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black flex items-center justify-center gap-1 hover:bg-indigo-600 hover:text-white transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      Active Products
                    </button>
                    <Link
                      href={`/purchases/companies/${c.companyId}`}
                      className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                      title="Company Ledger & Purchases"
                    >
                      <span>Ledger</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 🏆 6. TOP RUNNING / BEST-SELLING PRODUCTS (BY COMPANY & OVERALL) */}
      {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER || user?.role === Role.ADMIN || user?.role === Role.SR) && (
        <section id="top-products-section" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
                  <Flame className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    Top Selling Products by Company
                  </h2>
                  <p className="text-xs text-slate-500">
                    {displayPeriodTitle} — Top running and best selling items ranking
                  </p>
                </div>
              </div>
            </div>

            {/* Search, Filter and Sort Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              {/* Sold toggle (Sold, Unsold, All) & Stock Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                  <button
                    onClick={() => setProductSalesFilter('sold')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      productSalesFilter === 'sold'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🔥 Selling Items ({(d.topProducts || []).filter((p: any) => p.soldQuantity > 0).length})
                  </button>
                  <button
                    onClick={() => setProductSalesFilter('unsold')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      productSalesFilter === 'unsold'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ⚪ No Sales ({(d.topProducts || []).filter((p: any) => p.soldQuantity === 0).length})
                  </button>
                  <button
                    onClick={() => setProductSalesFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      productSalesFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Products ({(d.topProducts || []).length})
                  </button>
                </div>

                {/* Stock Filter Pills */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-bold">
                  <span className="text-[10px] text-slate-400 font-bold px-1 hidden sm:inline">Stock:</span>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'in_stock', label: '🟢 In Stock' },
                    { id: 'low_stock', label: '🟡 Low Stock' },
                    { id: 'out_of_stock', label: '🔴 Out of Stock' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setTopProductStockFilter(st.id as any)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        topProductStockFilter === st.id
                          ? 'bg-indigo-600 text-white font-black'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort & Search */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Sort Dropdown */}
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-500">Sort By:</span>
                  <select
                    value={topProductSort}
                    onChange={(e) => setTopProductSort(e.target.value as any)}
                    className="text-xs font-black text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="sold_qty_desc">🔥 Quantity Sold (High to Low)</option>
                    <option value="sold_val_desc">💰 Sales Value (High to Low)</option>
                    <option value="stock_desc">📦 In-Stock Qty (High to Low)</option>
                    <option value="stock_asc">⚠️ Low Stock First (Reorder)</option>
                    <option value="name_asc">🔤 Product Name (A-Z)</option>
                  </select>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search product or company..."
                    value={topProductSearch}
                    onChange={(e) => setTopProductSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white w-full sm:w-52 shadow-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Company Filter Tabs */}
          {d.companySummary && d.companySummary.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedTopProductCompany('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                  selectedTopProductCompany === 'all'
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Companies ({
                  (d.topProducts || []).filter((p: any) => {
                    if (productSalesFilter === 'sold') return p.soldQuantity > 0;
                    if (productSalesFilter === 'unsold') return p.soldQuantity === 0;
                    return true;
                  }).length
                })
              </button>
              {d.companySummary.map((comp: any) => {
                const count = (d.topProducts || [])
                  .filter((p: any) => p.companyId === comp.companyId)
                  .filter((p: any) => {
                    if (productSalesFilter === 'sold') return p.soldQuantity > 0;
                    if (productSalesFilter === 'unsold') return p.soldQuantity === 0;
                    return true;
                  }).length;
                return (
                  <button
                    key={comp.companyId}
                    onClick={() => setSelectedTopProductCompany(comp.companyId)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedTopProductCompany === comp.companyId
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{comp.companyName}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                      selectedTopProductCompany === comp.companyId ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Top Products Table */}
          <div className="overflow-x-auto">
            {(() => {
              const filteredList = (d.topProducts || [])
                .filter((item: any) => {
                  const matchesCompany = selectedTopProductCompany === 'all' || item.companyId === selectedTopProductCompany;
                  const matchesSold = 
                    productSalesFilter === 'sold' ? item.soldQuantity > 0 :
                    productSalesFilter === 'unsold' ? item.soldQuantity === 0 :
                    true;
                  const matchesStock = 
                    topProductStockFilter === 'all' ? true :
                    topProductStockFilter === 'in_stock' ? item.currentStock > 0 :
                    topProductStockFilter === 'low_stock' ? (item.currentStock > 0 && item.currentStock <= 10) :
                    item.currentStock <= 0;
                  const matchesSearch = !topProductSearch || 
                    item.productName.toLowerCase().includes(topProductSearch.toLowerCase()) ||
                    item.companyName.toLowerCase().includes(topProductSearch.toLowerCase());
                  return matchesCompany && matchesSold && matchesStock && matchesSearch;
                })
                .sort((a: any, b: any) => {
                  if (topProductSort === 'sold_qty_desc') return b.soldQuantity - a.soldQuantity || b.salesValue - a.salesValue;
                  if (topProductSort === 'sold_val_desc') return b.salesValue - a.salesValue || b.soldQuantity - a.soldQuantity;
                  if (topProductSort === 'stock_desc') return b.currentStock - a.currentStock;
                  if (topProductSort === 'stock_asc') return a.currentStock - b.currentStock;
                  if (topProductSort === 'name_asc') return a.productName.localeCompare(b.productName);
                  return 0;
                });

              if (filteredList.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    {productSalesFilter === 'sold'
                      ? 'No items sold under this filter.'
                      : productSalesFilter === 'unsold'
                      ? 'No zero-sales products found under this filter.'
                      : 'No products found.'}
                  </div>
                );
              }

              return (
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-center">Rank</th>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3 text-right">Selling Price</th>
                      <th className="px-4 py-3 text-center">Quantity Sold</th>
                      <th className="px-4 py-3 text-right">Sales Amount</th>
                      <th className="px-4 py-3 text-center">Warehouse Stock</th>
                      <th className="px-4 py-3 text-center">Selling Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredList.map((prod: any, idx: number) => {
                      const isTop1 = idx === 0 && prod.soldQuantity > 0;
                      const isTop3 = idx < 3 && prod.soldQuantity > 0;
                      return (
                        <tr key={prod.productId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                              isTop1 ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-xs' :
                              isTop3 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                              'text-slate-500 font-bold bg-slate-100'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {prod.productName}
                              {isTop1 && <span className="text-xs">👑</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-600">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                              {prod.companyName}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                            {formatCurrency(prod.price)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`font-black text-sm ${prod.soldQuantity > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                              {formatNumber(prod.soldQuantity)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold ml-1">{prod.unit}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-emerald-600">
                            {formatCurrency(prod.salesValue)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`font-bold ${
                              prod.currentStock > 10 ? 'text-slate-700' : prod.currentStock > 0 ? 'text-amber-600' : 'text-rose-600'
                            }`}>
                              {formatNumber(prod.currentStock)} {prod.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {prod.soldQuantity > 0 ? (
                              isTop1 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 text-[10px] font-black border border-orange-200 animate-pulse">
                                  <Flame className="w-3 h-3 text-orange-500" /> #1 Top Seller
                                </span>
                              ) : isTop3 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-200">
                                  ⚡ Fast Moving
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                  🟢 Active Products
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-semibold border border-slate-200">
                                ⚪ No Sales
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </section>
      )}

      {/* 📜 SR Specific Dues */}
      {user?.role === Role.SR && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-rose-500" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              My Outstanding Dues
            </h2>
          </div>
          <SRDuesList />
        </section>
      )}

      {/* 🏢 Company Top Products Popup Modal (Direct Click on Company Card) */}
      {viewingCompanyProducts && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingCompanyProducts(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200"
        >
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {viewingCompanyProducts.companyName} — Top Selling & Active Products
                  </h3>
                  <p className="text-xs text-slate-500">
                    {displayPeriodTitle} • Top products ranking and quantities sold for this company
                  </p>
                </div>
              </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/purchases/companies/${viewingCompanyProducts.companyId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 text-xs font-bold transition-colors"
                  >
                    <span>📄 Purchases & Company Ledger</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setViewingCompanyProducts(null)}
                    className="h-9 w-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
            </div>

            {/* Modal Search, Filter & Count */}
            <div className="p-4 sm:px-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products in this company..."
                  value={modalProductSearch}
                  onChange={(e) => setModalProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 font-medium"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                {/* Sold / Unsold / All Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setModalSalesFilter('sold')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      modalSalesFilter === 'sold'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🔥 Sold Items ({(d.topProducts || []).filter((p: any) => p.companyId === viewingCompanyProducts.companyId && p.soldQuantity > 0).length})
                  </button>
                  <button
                    onClick={() => setModalSalesFilter('unsold')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      modalSalesFilter === 'unsold'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ⚪ No Sales ({(d.topProducts || []).filter((p: any) => p.companyId === viewingCompanyProducts.companyId && p.soldQuantity === 0).length})
                  </button>
                  <button
                    onClick={() => setModalSalesFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      modalSalesFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({(d.topProducts || []).filter((p: any) => p.companyId === viewingCompanyProducts.companyId).length})
                  </button>
                </div>

                {/* Stock Filter Pills */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  {[
                    { id: 'all', label: 'All Stock' },
                    { id: 'in_stock', label: '🟢 In Stock' },
                    { id: 'out_of_stock', label: '🔴 Out of Stock' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setModalProductStockFilter(st.id as any)}
                      className={`px-2 py-1 rounded-lg transition-all ${
                        modalProductStockFilter === st.id
                          ? 'bg-indigo-600 text-white font-black'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Sort Dropdown */}
                <select
                  value={modalProductSort}
                  onChange={(e) => setModalProductSort(e.target.value as any)}
                  className="text-xs font-black text-slate-800 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
                >
                  <option value="sold_qty_desc">🔥 Sold Quantity</option>
                  <option value="sold_val_desc">💰 Sales Value</option>
                  <option value="stock_desc">📦 Current Stock</option>
                  <option value="name_asc">🔤 Name (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {(() => {
                const companyProducts = (d.topProducts || [])
                  .filter((p: any) => p.companyId === viewingCompanyProducts.companyId)
                  .filter((p: any) => {
                    if (modalSalesFilter === 'sold') return p.soldQuantity > 0;
                    if (modalSalesFilter === 'unsold') return p.soldQuantity === 0;
                    return true;
                  })
                  .filter((p: any) => {
                    if (modalProductStockFilter === 'all') return true;
                    if (modalProductStockFilter === 'in_stock') return p.currentStock > 0;
                    if (modalProductStockFilter === 'low_stock') return p.currentStock > 0 && p.currentStock <= 10;
                    return p.currentStock <= 0;
                  })
                  .filter((p: any) => 
                    !modalProductSearch || p.productName.toLowerCase().includes(modalProductSearch.toLowerCase())
                  )
                  .sort((a: any, b: any) => {
                    if (modalProductSort === 'sold_qty_desc') return b.soldQuantity - a.soldQuantity || b.salesValue - a.salesValue;
                    if (modalProductSort === 'sold_val_desc') return b.salesValue - a.salesValue || b.soldQuantity - a.soldQuantity;
                    if (modalProductSort === 'stock_desc') return b.currentStock - a.currentStock;
                    if (modalProductSort === 'name_asc') return a.productName.localeCompare(b.productName);
                    return 0;
                  });

                if (companyProducts.length === 0) {
                  return (
                    <div className="py-16 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      {modalSalesFilter === 'sold'
                        ? 'No products sold for this company yet.'
                        : modalSalesFilter === 'unsold'
                        ? 'No zero-sales products for this company.'
                        : 'No products found for this company.'}
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-center">Rank</th>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3 text-right">Selling Price</th>
                        <th className="px-4 py-3 text-center">Quantity Sold</th>
                        <th className="px-4 py-3 text-right">Sales Amount</th>
                        <th className="px-4 py-3 text-center">Warehouse Stock</th>
                        <th className="px-4 py-3 text-center">Selling Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {companyProducts.map((prod: any, idx: number) => {
                        const isTop1 = idx === 0 && prod.soldQuantity > 0;
                        const isTop3 = idx < 3 && prod.soldQuantity > 0;
                        return (
                          <tr key={prod.productId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5 text-center">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                                isTop1 ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-xs' :
                                isTop3 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                'text-slate-500 font-bold bg-slate-100'
                              }`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                {prod.productName}
                                {isTop1 && <span className="text-xs">👑</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                              {formatCurrency(prod.price)}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`font-black text-sm ${prod.soldQuantity > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                                {formatNumber(prod.soldQuantity)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold ml-1">{prod.unit}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-black text-emerald-600">
                              {formatCurrency(prod.salesValue)}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`font-bold ${
                                prod.currentStock > 10 ? 'text-slate-700' : prod.currentStock > 0 ? 'text-amber-600' : 'text-rose-600'
                              }`}>
                                {formatNumber(prod.currentStock)} {prod.unit}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              {prod.soldQuantity > 0 ? (
                                isTop1 ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 text-[10px] font-black border border-orange-200 animate-pulse">
                                    <Flame className="w-3 h-3 text-orange-500" /> #1 Top Seller
                                  </span>
                                ) : isTop3 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-200">
                                    ⚡ Fast Moving
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                    🟢 Active Products
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-semibold border border-slate-200">
                                  ⚪ No Sales
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingCompanyProducts(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {isViewingOrderLoading && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-sm font-bold text-slate-700">Loading invoice memo details...</span>
          </div>
        </div>
      )}

      {viewingOrder && (
        <OrderModal
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}
    </div>
  );
}
