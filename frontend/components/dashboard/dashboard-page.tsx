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
} from 'lucide-react';
import { SRDuesList } from './sr-dues-list';
import { useAuth } from '../auth/auth-provider';
import { Role } from '@/types/api';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className ?? ''}`} />;
}

const MONTH_NAMES_BN = [
  { en: 'January', bn: 'জানুয়ারি' },
  { en: 'February', bn: 'ফেব্রুয়ারি' },
  { en: 'March', bn: 'মার্চ' },
  { en: 'April', bn: 'এপ্রিল' },
  { en: 'May', bn: 'মে' },
  { en: 'June', bn: 'জুন' },
  { en: 'July', bn: 'জুলাই' },
  { en: 'August', bn: 'আগস্ট' },
  { en: 'September', bn: 'সেপ্টেম্বর' },
  { en: 'October', bn: 'অক্টোবর' },
  { en: 'November', bn: 'নভেম্বর' },
  { en: 'December', bn: 'ডিসেম্বর' },
];

export function DashboardPage() {
  const { user } = useAuth();
  
  // Current date
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

  // Get Bangla Month label
  const activeMonthBn = periodInfo.month ? MONTH_NAMES_BN[periodInfo.month - 1]?.bn : '';
  const displayPeriodTitle = period === 'all_time' 
    ? 'শুরু থেকে আজ পর্যন্ত (সকল ইতিহাস)' 
    : `${activeMonthBn || periodInfo.monthName || ''} ${periodInfo.year || ''}`;

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
                {user?.role === Role.SR ? 'ফিল্ড সেলস ড্যাশবোর্ড' : 'ব্যবসার সামগ্রিক হিসাব ও ড্যাশবোর্ড'}
              </h1>
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mt-0.5">
                <span>📅 সময়কাল: </span>
                <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  {displayPeriodTitle}
                </span>
                {periodInfo.totalDays ? (
                  <span className="text-slate-500">({periodInfo.totalDays} দিনের মাস)</span>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector Tabs in Simple Bangla */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
            <button
              onClick={() => {
                setPeriod('this_month');
                setIsMonthPickerOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
                period === 'this_month'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              চলতি মাস
            </button>

            <button
              onClick={() => {
                setPeriod('last_month');
                setIsMonthPickerOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
                period === 'last_month'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              গত মাস
            </button>

            <button
              onClick={() => {
                setPeriod('all_time');
                setIsMonthPickerOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
                period === 'all_time'
                  ? 'bg-white text-indigo-700 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              সকল ইতিহাস
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
                  : 'অন্য মাস দেখুন...'}
              </span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>

            {isMonthPickerOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <span className="text-xs font-black text-slate-800">মাস ও সাল বাছাই করুন</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="text-xs font-black bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800"
                  >
                    {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <option key={y} value={y}>{y} সাল</option>
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
            title="রিফ্রেশ করুন"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 🟢 Info Notice Banner in Bangla */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/90 via-blue-50/40 to-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-xs">
            ১
          </div>
          <div>
            <p className="font-black text-indigo-950 text-xs sm:text-sm">
              {isCurrentMonthActive ? 'মাসের ১ তারিখের অটো-হিসাব সাইকেল চালু আছে' : `দেখছেন: ${displayPeriodTitle}`}
            </p>
            <p className="text-indigo-800/80 text-[11px] mt-0.5">
              {isCurrentMonthActive 
                ? `প্রতি মাসের ১ তারিখে চলতি মাসের বিক্রি, কালেকশন ও লাভের হিসাব স্বয়ংক্রিয়ভাবে ০ থেকে শুরু হয় (১ থেকে ${periodInfo.totalDays || 30} তারিখ)। সব পুরোনো হিসাব ডাটাবেজে অক্ষত আছে।`
                : `${displayPeriodTitle} মাসের সম্পূর্ণ লেনদেন ও লাভ-ক্ষতির হিসাব দেখানো হচ্ছে।`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 text-[11px] font-black px-3 py-1 rounded-full border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            লাইভ রিয়েল-টাইম
          </span>
        </div>
      </div>

      {/* ⚡ 1. TODAY'S REAL-TIME PULSE */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-5 w-5 text-rose-500 animate-pulse" />
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              {user?.role === Role.SR ? "আজকের তৎপরতা ও বিক্রি" : "আজকের তাৎক্ষণিক হিসাব"}
            </h2>
            <p className="text-[11px] font-semibold text-slate-400">আজকের লাইভ অর্ডার বুকিং, ডেলিভারি ও ক্যাশ কালেকশন</p>
          </div>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="আজকের অর্ডার"
            value={formatNumber(today?.ordersCount ?? orders?.todayOrdersCount)}
            description={`মূল্য: ${formatCurrency(today?.orderValue ?? orders?.todayOrderValue)}`}
            icon={ShoppingCart}
            colorTheme="cyan"
          />
          <StatCard
            label="আজকের ডেলিভারি চালান"
            value={formatNumber(today?.dispatchCount ?? delivery?.todayDispatch)}
            description={(today?.dispatchAmount ?? delivery?.todayDispatchAmount) > 0 ? `মূল্য: ${formatCurrency(today?.dispatchAmount ?? delivery?.todayDispatchAmount)}` : undefined}
            icon={Truck}
            colorTheme="amber"
          />
          <StatCard
            label="আজকের নগদ বিক্রি"
            value={formatCurrency(today?.settledValue ?? money?.todayFinalSold ?? 0)}
            description="ডেলিভারিকৃত প্রকৃত বিক্রি"
            icon={DollarSign}
            colorTheme="indigo"
          />
          <StatCard
            label="আজকের নতুন বাকি"
            value={formatCurrency(today?.dueAmount ?? money?.todayDue ?? 0)}
            description="আজকের নতুন বকেয়া"
            icon={AlertCircle}
            colorTheme="rose"
          />
          <StatCard
            label="আজকের ক্যাশ আদায়"
            value={formatCurrency(today?.dueCollection ?? money?.todayDueCollection ?? 0)}
            description="আজকের নগদ কালেকশন"
            icon={CheckCircle}
            colorTheme="emerald"
          />
          <StatCard
            label="আজকের বাতিল অর্ডার"
            value={formatNumber(today?.cancelledOrders ?? orders?.todayCancelled ?? 0)}
            description="বাতিলকৃত অর্ডার সংখ্যা"
            icon={XCircle}
            colorTheme="slate"
          />
        </div>
      </section>

      {/* 📊 2. MONTHLY PERFORMANCE (1st to 28/30/31) */}
      <section className="rounded-3xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                {displayPeriodTitle} — মোট হিসাব-নিকাশ
              </h2>
              <p className="text-[11px] font-semibold text-slate-500">
                ১ তারিখ থেকে {periodInfo.totalDays || 30} তারিখের মোট বিক্রি, কালেকশন, বাকি ও লাভ (মাসের ১ তারিখে ০ থেকে শুরু হয়)
              </p>
            </div>
          </div>
          <span className="text-xs font-black text-indigo-700 bg-white border border-indigo-200 px-3.5 py-1.5 rounded-xl shadow-xs self-start sm:self-auto">
            {isCurrentMonthActive ? `চলতি মাস (১ থেকে ${periodInfo.totalDays || 30} তারিখ)` : displayPeriodTitle}
          </span>
        </div>

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="মাসের মোট বিক্রি"
            value={formatCurrency(periodMetrics?.netSales ?? money?.totalFinalSold)}
            description="ডেলিভারিকৃত প্রকৃত বিক্রি"
            icon={CheckCircle}
            colorTheme="emerald"
          />
          <StatCard
            label="মোট অর্ডার বুকিং মূল্য"
            value={formatCurrency(periodMetrics?.orderValue ?? orders?.totalOrderValue)}
            description={`অর্ডার সংখ্যা: ${formatNumber(periodMetrics?.ordersCount ?? orders?.totalOrders)}টি`}
            icon={DollarSign}
            colorTheme="indigo"
          />
          <StatCard
            label="মাসের মোট ক্যাশ আদায়"
            value={formatCurrency(periodMetrics?.dueCollection ?? money?.periodDueCollection ?? 0)}
            description="মাসে মোট কালেকশন"
            icon={Wallet}
            colorTheme="cyan"
          />
          <StatCard
            label="মাসের নতুন বাকি"
            value={formatCurrency(periodMetrics?.newDue ?? money?.periodDue ?? 0)}
            description="চলতি মাসে দেওয়া বাকি"
            icon={AlertCircle}
            colorTheme="amber"
          />
          <StatCard
            label="মোট ডেলিভারি চালান"
            value={formatNumber(periodMetrics?.dispatchCount ?? delivery?.totalDispatch)}
            description={`ডেলিভারি সম্পন্ন: ${formatNumber(periodMetrics?.deliveredCount ?? delivery?.delivered)}টি (${deliveryRate})`}
            icon={Truck}
            colorTheme="primary"
          />
          {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER) ? (
            <StatCard
              label="মাসের মোট লাভ (মুনাফা)"
              value={formatCurrency(periodMetrics?.profit ?? money?.totalProfit ?? 0)}
              description="চলতি মাসের নিট প্রফিট"
              icon={TrendingUp}
              colorTheme="violet"
            />
          ) : (
            <StatCard
              label="মাসের বাতিল অর্ডার"
              value={formatNumber(periodMetrics?.cancelledOrders ?? orders?.cancelledOrders)}
              description="বাতিলকৃত অর্ডার সংখ্যা"
              icon={XCircle}
              colorTheme="rose"
            />
          )}
        </div>
      </section>

      {/* 🏦 3. LIVE BUSINESS HEALTH & INVENTORY (Cumulative Live Snapshot) */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-5 w-5 text-emerald-600" />
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              সার্বিক মোট বকেয়া ও গুদাম স্টক (Live Status)
            </h2>
            <p className="text-[11px] font-semibold text-slate-400">মার্কেটে মোট পাওনা বাকি ও গুদামে থাকা পণ্যের বর্তমান স্থিতি</p>
          </div>
        </div>

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="মার্কেটে মোট বাকি পাওনা"
            value={formatCurrency(money?.totalDue ?? 0)}
            description="গ্রাহকদের কাছে বর্তমান মোট বাকি"
            icon={AlertCircle}
            colorTheme="rose"
          />
          <StatCard
            label="অনুমোদনের অপেক্ষায় আদায়"
            value={formatCurrency(money?.pendingCollected ?? 0)}
            description="কালেকশন জমা (পেন্ডিং)"
            icon={Clock}
            colorTheme="amber"
          />
          <StatCard
            label="সর্বমোট অনুমোদিত আদায়"
            value={formatCurrency(money?.approvedCollected ?? 0)}
            description="আজীবন মোট কালেকশন"
            icon={CheckCircle}
            colorTheme="emerald"
          />
          {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER || user?.role === Role.ADMIN) ? (
            <StatCard
              label="গুদামে মোট মালের দাম (স্টক)"
              value={formatCurrency(stock?.stockValue ?? 0)}
              description={`মোট পণ্য সংখ্যা: ${formatNumber(stock?.activeProducts ?? 0)}টি`}
              icon={Layers}
              colorTheme="violet"
            />
          ) : (
            <StatCard
              label="বাতিলকৃত কালেকশন"
              value={formatCurrency(money?.rejectedCollected ?? 0)}
              description="অস্বীকৃত কালেকশন"
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
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-600">গুদাম স্টক স্থিতি (ইনভেন্টরি রিপোর্ট)</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">মোট পণ্য</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(stock.totalProducts)} টি</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">চালু পণ্য</p>
              <p className="text-lg font-black text-emerald-600">{formatNumber(stock.activeProducts)} টি</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">মজুদ আছে</p>
              <p className="text-lg font-black text-blue-600">{formatNumber(stock.inStockProducts)} টি</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">কম স্টক (সতর্কতা)</p>
              <p className="text-lg font-black text-amber-600">{formatNumber(stock.lowStockProducts)} টি</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">স্টক শেষ</p>
              <p className="text-lg font-black text-rose-600">{formatNumber(stock.outOfStockProducts)} টি</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">মোট স্টক মূল্য</p>
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
                {displayPeriodTitle} — দিনভিত্তিক বিক্রয় গ্রাফ (Daily Sales Trend)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ১ তারিখ থেকে {periodInfo.totalDays || 30} তারিখ পর্যন্ত প্রতিদিন কত টাকার মাল ডেলিভারি/বিক্রি হয়েছে
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-black text-indigo-700 bg-indigo-50 px-3.5 py-1.5 rounded-xl border border-indigo-100">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
              সেটেল্ড নগদ বিক্রি
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
                    <div className="invisible group-hover:visible absolute -top-10 z-20 rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[10px] font-black shadow-xl whitespace-nowrap">
                      {dayItem.day} {activeMonthBn || ''}: {formatCurrency(dayItem.amount)}
                    </div>
                    <div className="flex-1 w-full flex items-end justify-center mb-2">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          dayItem.amount > 0
                            ? isTodayDate
                              ? 'bg-gradient-to-t from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/20'
                              : 'bg-indigo-500/85 group-hover:bg-indigo-600'
                            : 'bg-slate-100 group-hover:bg-slate-200'
                        }`}
                        style={{ height: `${Math.max(6, height)}%` }}
                      />
                    </div>
                    <span className={`text-[9px] font-black ${isTodayDate ? 'text-indigo-700 font-black underline' : 'text-slate-400'}`}>
                      {dayItem.day}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] font-black text-slate-400 px-2 pt-2 border-t border-slate-100">
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
            <Building2 className="h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                কোম্পানি অনুযায়ী বিক্রি ও লাভ ({displayPeriodTitle})
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">নির্বাচিত সময়ে কোম্পানি বা সাপ্লায়ারভিত্তিক মোট পারফরম্যান্স</p>
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
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">কোম্পানি সামারি</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">মোট বিক্রি</p>
                      <p className="text-sm font-black text-emerald-600">{formatCurrency(c.sales)}</p>
                    </div>
                    {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER) ? (
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">মোট লাভ</p>
                        <p className="text-sm font-black text-violet-600">{formatCurrency(c.profit)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">কোম্পানি আইডি</p>
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
