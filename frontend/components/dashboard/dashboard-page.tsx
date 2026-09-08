'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardMetrics, DashboardFilterParams } from '@/lib/api/dashboard';
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
  ArrowUpRight,
} from 'lucide-react';
import { SRDuesList } from './sr-dues-list';
import { useAuth } from '../auth/auth-provider';
import { Role } from '@/types/api';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className ?? ''}`} />;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function DashboardPage() {
  const { user } = useAuth();
  
  // Current date for default picker values
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  // Filter States
  const [period, setPeriod] = useState<'this_month' | 'last_month' | 'all_time' | 'custom'>('this_month');
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

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

  if (isLoading) {
    return (
      <div className="space-y-8 p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (error || !d) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
        <AlertCircle className="h-14 w-14 text-rose-500 animate-bounce" />
        <h3 className="mt-4 text-xl font-black text-slate-900">ড্যাশবোর্ড লোড হতে সমস্যা হয়েছে</h3>
        <p className="mt-2 text-sm text-slate-500 max-w-md">
          ডাটাবেস কানেকশন অথবা সার্ভার স্ট্যাটাস চেক করুন এবং পুনরায় চেষ্টা করুন।
        </p>
        <button
          onClick={() => refetch()}
          className="mt-6 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
        >
          <RefreshCw className="h-4 w-4" /> আবার চেষ্টা করুন
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

  return (
    <div className="space-y-8 pb-20 p-2 sm:p-4 md:p-6">
      
      {/* 🧭 Top Filter & Period Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                {user?.role === Role.SR ? 'ফিল্ড সেলস ড্যাশবোর্ড' : 'বিজনেস এনালিটিক্স ড্যাশবোর্ড'}
              </h1>
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <span>📅 সাইকেল: </span>
                <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {periodInfo.label || 'চলতি মাস'}
                </span>
                {periodInfo.totalDays ? (
                  <span className="text-slate-400">({periodInfo.totalDays} দিনের মাস)</span>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
            <button
              onClick={() => {
                setPeriod('this_month');
                setIsMonthPickerOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                period === 'this_month'
                  ? 'bg-white text-indigo-600 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              চলতি মাস (This Month)
            </button>

            <button
              onClick={() => {
                setPeriod('last_month');
                setIsMonthPickerOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                period === 'last_month'
                  ? 'bg-white text-indigo-600 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              গত মাস (Last Month)
            </button>

            <button
              onClick={() => {
                setPeriod('all_time');
                setIsMonthPickerOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                period === 'all_time'
                  ? 'bg-white text-indigo-600 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              সব ইতিহাস (All Time)
            </button>
          </div>

          {/* Custom Month Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                period === 'custom'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {period === 'custom'
                  ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                  : 'নির্দিষ্ট মাস...'}
              </span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>

            {isMonthPickerOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <span className="text-xs font-black text-slate-800">মাস ও বছর নির্বাচন</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="text-xs font-black bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-slate-700"
                  >
                    {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_NAMES.map((name, idx) => {
                    const mNum = idx + 1;
                    const isSelected = period === 'custom' && selectedMonth === mNum && selectedYear === selectedYear;
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          setSelectedMonth(mNum);
                          setPeriod('custom');
                          setIsMonthPickerOpen(false);
                        }}
                        className={`px-2 py-1.5 text-[11px] font-bold rounded-lg transition-colors text-center ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-black'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {name.slice(0, 3)}
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
            title="রিফ্রেশ করুন"
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 🟢 Info Banner for Month Cycle */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">
            1
          </div>
          <div>
            <p className="font-black text-indigo-950">
              {isCurrentMonthActive ? 'মাসের ১ তারিখ থেকে অটো-রিসেট সাইকেল চালু আছে' : `দেখছেন: ${periodInfo.label}`}
            </p>
            <p className="text-indigo-700/80 text-[11px]">
              {isCurrentMonthActive 
                ? `প্রতি মাসের ১ তারিখে মাসিক মেট্রিকগুলো স্বয়ংক্রিয়ভাবে ০ থেকে শুরু হয় (১ থেকে ${periodInfo.totalDays || 30} তারিখ)। সব ইতিহাস সংরক্ষিত আছে।`
                : `${periodInfo.label} মাসের সম্পূর্ণ হিসাব প্রদর্শিত হচ্ছে।`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
            লাইভ ডাটা
          </span>
        </div>
      </div>

      {/* ⚡ 1. TODAY'S REAL-TIME PULSE */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-rose-500 animate-pulse" />
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              {user?.role === Role.SR ? "আজকের তৎপরতা (Today's Pulse)" : "আজকের তাৎক্ষণিক হিসাব (Today's Pulse)"}
            </h2>
            <p className="text-[10px] font-bold text-slate-400">আজকের রিয়েল-টাইম অর্ডার, ডেলিভারি ও কালেকশন</p>
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
            label="Today Dispatch"
            value={formatNumber(today?.dispatchCount ?? delivery?.todayDispatch)}
            description={(today?.dispatchAmount ?? delivery?.todayDispatchAmount) > 0 ? `Value: ${formatCurrency(today?.dispatchAmount ?? delivery?.todayDispatchAmount)}` : undefined}
            icon={Truck}
            colorTheme="amber"
          />
          <StatCard
            label="Today Final Sold"
            value={formatCurrency(today?.settledValue ?? money?.todayFinalSold ?? 0)}
            description="ডেলিভারিকৃত প্রকৃত বিক্রি"
            icon={DollarSign}
            colorTheme="indigo"
          />
          <StatCard
            label="Today New Due"
            value={formatCurrency(today?.dueAmount ?? money?.todayDue ?? 0)}
            description="আজকের নতুন বাকি"
            icon={AlertCircle}
            colorTheme="rose"
          />
          <StatCard
            label="Today Collection"
            value={formatCurrency(today?.dueCollection ?? money?.todayDueCollection ?? 0)}
            description="আজকের নগদ রিকভারি"
            icon={CheckCircle}
            colorTheme="emerald"
          />
          <StatCard
            label="Today Cancelled"
            value={formatNumber(today?.cancelledOrders ?? orders?.todayCancelled ?? 0)}
            description="বাতিলকৃত অর্ডার"
            icon={XCircle}
            colorTheme="slate"
          />
        </div>
      </section>

      {/* 📊 2. MONTHLY / PERIOD PERFORMANCE (Resets on 1st of Month) */}
      <section className="rounded-3xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                {periodInfo.label} — মাসিক কর্মক্ষমতা (Performance)
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                ১ তারিখ থেকে {periodInfo.totalDays || 30} তারিখের হিসাব (মাসের শুরুতে এটি ০ থেকে গণনা শুরু করে)
              </p>
            </div>
          </div>
          <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-3 py-1 rounded-full self-start sm:self-auto">
            {period === 'this_month' ? 'চলতি মাস (Active Cycle)' : periodInfo.label}
          </span>
        </div>

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="Period Final Sold"
            value={formatCurrency(periodMetrics?.netSales ?? money?.totalFinalSold)}
            description="প্রকৃত মোট বিক্রি (Settled)"
            icon={CheckCircle}
            colorTheme="emerald"
          />
          <StatCard
            label="Period Orders Value"
            value={formatCurrency(periodMetrics?.orderValue ?? orders?.totalOrderValue)}
            description={`Orders: ${formatNumber(periodMetrics?.ordersCount ?? orders?.totalOrders)}`}
            icon={DollarSign}
            colorTheme="indigo"
          />
          <StatCard
            label="Period Collections"
            value={formatCurrency(periodMetrics?.dueCollection ?? money?.periodDueCollection ?? 0)}
            description="মাসে মোট আদায়কৃত টাকা"
            icon={Wallet}
            colorTheme="cyan"
          />
          <StatCard
            label="Period New Due"
            value={formatCurrency(periodMetrics?.newDue ?? money?.periodDue ?? 0)}
            description="মাসে মোট নতুন বাকি"
            icon={AlertCircle}
            colorTheme="amber"
          />
          <StatCard
            label="Period Dispatched"
            value={formatNumber(periodMetrics?.dispatchCount ?? delivery?.totalDispatch)}
            description={`Delivered: ${formatNumber(periodMetrics?.deliveredCount ?? delivery?.delivered)} (${deliveryRate})`}
            icon={Truck}
            colorTheme="primary"
          />
          {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER) ? (
            <StatCard
              label="Period Net Profit"
              value={formatCurrency(periodMetrics?.profit ?? money?.totalProfit ?? 0)}
              description="মাসের মোট মুনাফা"
              icon={TrendingUp}
              colorTheme="violet"
            />
          ) : (
            <StatCard
              label="Period Cancelled"
              value={formatNumber(periodMetrics?.cancelledOrders ?? orders?.cancelledOrders)}
              description="বাতিলকৃত অর্ডার"
              icon={XCircle}
              colorTheme="rose"
            />
          )}
        </div>
      </section>

      {/* 🏦 3. LIVE BUSINESS HEALTH & INVENTORY (Never Resets - Cumulative Live Snapshot) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5 text-emerald-600" />
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              সার্বিক চলমান লাইভ হিসাব (Live Cumulative Health)
            </h2>
            <p className="text-[10px] font-bold text-slate-400">মার্কেটের মোট পাওনা বাকি এবং বর্তমান ইনভেন্টরি স্থিতি</p>
          </div>
        </div>

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Market Due"
            value={formatCurrency(money?.totalDue ?? 0)}
            description="গ্রাহকদের কাছে বর্তমান মোট পাওনা"
            icon={AlertCircle}
            colorTheme="rose"
          />
          <StatCard
            label="Pending Approval Due"
            value={formatCurrency(money?.pendingCollected ?? 0)}
            description="অনুমোদনের অপেক্ষায় কালেকশন"
            icon={Clock}
            colorTheme="amber"
          />
          <StatCard
            label="Approved Collections"
            value={formatCurrency(money?.approvedCollected ?? 0)}
            description="আজীবন মোট অনুমোদিত কালেকশন"
            icon={CheckCircle}
            colorTheme="emerald"
          />
          {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER || user?.role === Role.ADMIN) ? (
            <StatCard
              label="Total Stock Value"
              value={formatCurrency(stock?.stockValue ?? 0)}
              description={`Active Products: ${formatNumber(stock?.activeProducts ?? 0)}`}
              icon={Layers}
              colorTheme="violet"
            />
          ) : (
            <StatCard
              label="Rejected Collection"
              value={formatCurrency(money?.rejectedCollected ?? 0)}
              description="বাতিলকৃত কালেকশন"
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
            <Package className="h-5 w-5 text-cyan-500" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">গুদাম স্টক স্থিতি (Warehouse Stock)</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Total Products</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(stock.totalProducts)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Active</p>
              <p className="text-lg font-black text-emerald-600">{formatNumber(stock.activeProducts)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">In Stock</p>
              <p className="text-lg font-black text-blue-600">{formatNumber(stock.inStockProducts)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Low Stock Alert</p>
              <p className="text-lg font-black text-amber-600">{formatNumber(stock.lowStockProducts)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Out of Stock</p>
              <p className="text-lg font-black text-rose-600">{formatNumber(stock.outOfStockProducts)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Stock Value</p>
              <p className="text-lg font-black text-violet-600">{formatCurrency(stock.stockValue)}</p>
            </div>
          </div>
        </section>
      )}

      {/* 📈 4. MONTHLY PROGRESSION & DAILY SALES TREND CHART */}
      <section className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-sm">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                {periodInfo.label} — দিনভিত্তিক সেলস গ্রাফ (Daily Sales Trend)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ১ তারিখ থেকে {periodInfo.totalDays || 30} তারিখ পর্যন্ত প্রতিদিনের সেটেল্ড বিক্রয় অগ্রগতি
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
              সেটেল্ড সেলস
            </span>
          </div>
        </div>

        {/* Dynamic Month Day Trend */}
        {d.charts?.monthlyTrend && d.charts.monthlyTrend.length > 0 ? (
          <div className="space-y-2">
            <div className="flex h-56 sm:h-64 items-end gap-1 sm:gap-1.5 px-1 sm:px-2 overflow-x-auto pb-4 pt-8">
              {d.charts.monthlyTrend.map((dayItem: any) => {
                const max = Math.max(...d.charts.monthlyTrend.map((x: any) => x.amount), 1);
                const height = (dayItem.amount / max) * 100;
                const isTodayDate = dayItem.date === new Date().toISOString().split('T')[0];

                return (
                  <div key={dayItem.day} className="group relative flex flex-1 h-full flex-col items-center min-w-[22px] sm:min-w-[26px]">
                    <div className="invisible group-hover:visible absolute -top-10 z-20 rounded-lg bg-slate-900 text-white px-2 py-1 text-[10px] font-bold shadow-xl whitespace-nowrap">
                      {dayItem.label}: {formatCurrency(dayItem.amount)}
                    </div>
                    <div className="flex-1 w-full flex items-end justify-center mb-2">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          dayItem.amount > 0
                            ? isTodayDate
                              ? 'bg-gradient-to-t from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/20'
                              : 'bg-indigo-500/80 group-hover:bg-indigo-600'
                            : 'bg-slate-100 group-hover:bg-slate-200'
                        }`}
                        style={{ height: `${Math.max(6, height)}%` }}
                      />
                    </div>
                    <span className={`text-[9px] font-black ${isTodayDate ? 'text-indigo-600 underline' : 'text-slate-400'}`}>
                      {dayItem.day}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 px-2">
              <span>১ তারিখ</span>
              <span>১৫ তারিখ</span>
              <span>{periodInfo.totalDays || 30} তারিখ (মাসের শেষ দিন)</span>
            </div>
          </div>
        ) : (
          /* Fallback to Last 7 Days if no month array */
          <div className="flex h-56 sm:h-64 items-end gap-2 px-2 overflow-x-auto pb-4">
            {d.charts.last7Days.map((day: any) => {
              const max = Math.max(...d.charts.last7Days.map((x: any) => x.amount), 1);
              const height = (day.amount / max) * 100;
              return (
                <div key={day.date} className="group relative flex flex-1 h-full flex-col items-center min-w-[32px]">
                  <div className="invisible group-hover:visible absolute -top-10 z-20 rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[10px] font-bold shadow-xl whitespace-nowrap">
                    {formatCurrency(day.amount)}
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
            <Building2 className="h-5 w-5 text-indigo-500" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                কোম্পানি অনুযায়ী সেলস ও মুনাফা ({periodInfo.label})
              </h2>
              <p className="text-[10px] font-bold text-slate-400">নির্বাচিত মাসের কোম্পানিভিত্তিক মোট পারফরম্যান্স</p>
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
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Company Wise Summary</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Total Sales</p>
                      <p className="text-sm font-black text-emerald-600">{formatCurrency(c.sales)}</p>
                    </div>
                    {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER) ? (
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-400">Total Profit</p>
                        <p className="text-sm font-black text-violet-600">{formatCurrency(c.profit)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-400">Company ID</p>
                        <p className="text-sm font-black text-slate-500">#{c.companyId}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 📜 SR Specific Dues */}
      {user?.role === Role.SR && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-rose-500" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              আমার পাওনা বকেয়া তালিকা (My Outstanding Dues)
            </h2>
          </div>
          <SRDuesList />
        </section>
      )}
    </div>
  );
}
