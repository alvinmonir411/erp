'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Activity, 
  Truck, 
  ShoppingBag, 
  DollarSign, 
  Box, 
  Receipt, 
  Search, 
  RefreshCw, 
  Calendar, 
  User, 
  MapPin, 
  Store, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Layers, 
  Filter,
  Eye,
  Info
} from 'lucide-react';
import { getActivityLogs, ActivityEvent, ActivityStats } from '@/lib/api/activity-logs';
import { formatCurrency } from '@/lib/utils/format';

export function ActivityLogsPage() {
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'all'>('today');
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getActivityLogs({
        period,
        category,
        search,
        limit: 150,
      });
      if (res) {
        setItems(res.items || []);
        setStats(res.stats || null);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setIsLoading(false);
      setLastRefreshed(new Date());
    }
  }, [period, category, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Format Bangladesh Time (BST, UTC+6)
  const formatBdTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('bn-BD', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = new Date().getTime();
      const past = new Date(isoString).getTime();
      const diffSec = Math.floor((now - past) / 1000);

      if (diffSec < 60) return 'এইমাত্র';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} মিনিট আগে`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ঘণ্টা আগে`;
      return `${Math.floor(diffSec / 86400)} দিন আগে`;
    } catch {
      return '';
    }
  };

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'DELIVERY':
        return {
          icon: Truck,
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
          dot: 'bg-emerald-500',
          label: 'Delivery & Dispatch',
        };
      case 'ORDERS':
        return {
          icon: ShoppingBag,
          bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
          dot: 'bg-blue-500',
          label: 'Orders',
        };
      case 'COLLECTIONS':
        return {
          icon: DollarSign,
          bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
          dot: 'bg-amber-500',
          label: 'Due Collections',
        };
      case 'STOCK':
        return {
          icon: Box,
          bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
          badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200',
          dot: 'bg-purple-500',
          label: 'Stock Movements',
        };
      case 'PURCHASES':
        return {
          icon: Receipt,
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
          badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
          dot: 'bg-indigo-500',
          label: 'Purchases & Ledger',
        };
      default:
        return {
          icon: Activity,
          bg: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800',
          badge: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
          dot: 'bg-gray-500',
          label: 'System Activity',
        };
    }
  };

  const getActionBadgeStyle = (action: string) => {
    if (action.includes('SETTLED') || action.includes('APPROVED')) {
      return 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 dark:text-emerald-400';
    }
    if (action.includes('DISPATCHED')) {
      return 'bg-blue-500/10 text-blue-700 border border-blue-500/30 dark:text-blue-400';
    }
    if (action.includes('CREATED') || action.includes('MANUAL_DUE')) {
      return 'bg-purple-500/10 text-purple-700 border border-purple-500/30 dark:text-purple-400';
    }
    if (action.includes('RETURN') || action.includes('DAMAGE')) {
      return 'bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:text-amber-400';
    }
    return 'bg-gray-500/10 text-gray-700 border border-gray-500/30 dark:text-gray-400';
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role?.toUpperCase()) {
      case 'SUPER_ADMIN':
        return 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300';
      case 'ADMIN':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300';
      case 'MANAGER':
        return 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300';
      case 'DELIVERY_MAN':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300';
      case 'SR':
        return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                অ্যাক্টিভিটি ও অডিট লগ (Activity & Audit Trail)
              </h1>
              <p className="text-xs text-muted">
                সিস্টেমে কে, কখন, কী অ্যাকশন নিয়েছে তার রিয়েল-টাইম তথ্য ও ইতিহাস
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-medium text-muted">সর্বশেষ আপডেট</p>
            <p className="text-xs font-bold text-foreground">
              {lastRefreshed.toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-secondary disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-primary' : 'text-muted'}`} />
            <span>রিফ্রেশ</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Today Actions */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">আজকের মোট কার্যকলাপ</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground">
              {stats?.totalEvents ?? items.length}
            </span>
            <span className="text-xs font-medium text-muted">টি অ্যাকশন</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">রিয়েল-টাইম লাইভ ট্র্যাকিং</span>
          </div>
        </div>

        {/* Card 2: Delivery Batches */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">ডেলিভারি ও ব্যাচ</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Truck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground">
              {stats?.deliveryEvents ?? 0}
            </span>
            <span className="text-xs font-medium text-muted">টি ইভেন্ট</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            ব্যাচ তৈরি, ডিসপ্যাচ ও সেটেলমেন্ট
          </p>
        </div>

        {/* Card 3: Orders & Settlements */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">অর্ডার কার্যকলাপ</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShoppingBag className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground">
              {stats?.orderEvents ?? 0}
            </span>
            <span className="text-xs font-medium text-muted">টি অর্ডার</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            অর্ডার বুকিং ও ফাইনাল সেটেলমেন্ট
          </p>
        </div>

        {/* Card 4: Due Collections */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">কালেকশন ও ডিউ</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground">
              {stats?.collectionEvents ?? 0}
            </span>
            <span className="text-xs font-medium text-muted">টি কালেকশন</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            বাকি আদায় ও অনুমোদন কার্যকলাপ
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        {/* Time Period Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-secondary rounded-xl">
            <button
              onClick={() => setPeriod('today')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                period === 'today'
                  ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>আজকের (Today Live)</span>
            </button>
            <button
              onClick={() => setPeriod('yesterday')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                period === 'yesterday'
                  ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              গতকাল (Yesterday)
            </button>
            <button
              onClick={() => setPeriod('last_7_days')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                period === 'last_7_days'
                  ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              গত ৭ দিন (7 Days)
            </button>
            <button
              onClick={() => setPeriod('this_month')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                period === 'this_month'
                  ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              চলতি মাস (This Month)
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                period === 'all'
                  ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              সব সময় (All Time)
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="ব্যাচ, ইউজার, দোকান বা রুট খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-background py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted mr-1">ক্যাটাগরি:</span>
          {[
            { key: 'ALL', label: 'সবগুলো (All)' },
            { key: 'DELIVERY', label: 'ডেলিভারি ও ব্যাচ (Delivery)' },
            { key: 'ORDERS', label: 'অর্ডার (Orders)' },
            { key: 'COLLECTIONS', label: 'কালেকশন (Collections)' },
            { key: 'STOCK', label: 'স্টক মুভমেন্ট (Stock)' },
            { key: 'PURCHASES', label: 'ক্রয় ও লেজার (Purchases)' },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                category === c.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-secondary/60 text-muted hover:bg-secondary hover:text-foreground'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-3">
        {isLoading ? (
          // Skeleton Loader
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="animate-pulse rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-secondary" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-secondary" />
                    <div className="h-3 w-1/2 rounded bg-secondary/60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-foreground">কোনো কার্যকলাপ পাওয়া যায়নি</h3>
            <p className="mt-1 text-xs text-muted max-w-sm">
              নির্বাচিত ফিল্টার অনুযায়ী এই সময়ে কোনো কার্যকলাপ রেকর্ড হয়নি। ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।
            </p>
          </div>
        ) : (
          // Timeline Cards
          items.map((event) => {
            const meta = getCategoryMeta(event.category);
            const Icon = meta.icon;
            const isExpanded = expandedId === event.id;

            return (
              <div
                key={event.id}
                className="overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-md"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: Icon and Main Details */}
                    <div className="flex items-start gap-3.5">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${meta.bg}`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${getActionBadgeStyle(event.action)}`}>
                            {event.action.replace(/_/g, ' ')}
                          </span>

                          <span className="text-xs font-semibold text-muted">
                            {meta.label}
                          </span>

                          {event.amount !== null && event.amount !== undefined && event.amount > 0 && (
                            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                              {formatCurrency(event.amount)}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-foreground leading-snug">
                          {event.title}
                        </h3>

                        {event.description && (
                          <p className="text-xs text-muted leading-relaxed">
                            {event.description}
                          </p>
                        )}

                        {/* Metadata Tags: User, Route, Shop */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                          {/* User & Role */}
                          {event.userName && (
                            <div className="flex items-center gap-1.5 text-foreground">
                              <User className="h-3.5 w-3.5 text-muted" />
                              <span className="font-semibold">{event.userName}</span>
                              {event.userRole && (
                                <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${getRoleBadgeStyle(event.userRole)}`}>
                                  {event.userRole}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Route */}
                          {event.route && (
                            <div className="flex items-center gap-1 text-muted">
                              <MapPin className="h-3.5 w-3.5 text-muted" />
                              <span className="font-medium text-foreground">{event.route}</span>
                            </div>
                          )}

                          {/* Shop */}
                          {event.shop && (
                            <div className="flex items-center gap-1 text-muted">
                              <Store className="h-3.5 w-3.5 text-muted" />
                              <span className="font-medium text-foreground">{event.shop}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Timestamp & Details Toggle */}
                    <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-start gap-2 shrink-0 border-t border-border/50 pt-2 sm:border-0 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <div className="flex items-center gap-1 text-xs font-bold text-foreground sm:justify-end">
                          <Clock className="h-3 w-3 text-muted" />
                          <span>{formatRelativeTime(event.timestamp)}</span>
                        </div>
                        <p className="text-[11px] text-muted">
                          {formatBdTime(event.timestamp)}
                        </p>
                      </div>

                      {event.details && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : event.id)}
                          className="flex items-center gap-1 rounded-lg bg-secondary/80 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary transition"
                        >
                          <span>{isExpanded ? 'সংক্ষেপ' : 'বিস্তারিত'}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-muted" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Breakdown Drawer */}
                  {isExpanded && event.details && (
                    <div className="mt-4 rounded-xl border border-border/80 bg-secondary/30 p-4 text-xs space-y-3">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <Info className="h-4 w-4 text-primary" />
                        <span>অতিরিক্ত তথ্য ও আর্থিক বিবরণ (Breakdown Details):</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {event.details.grossDispatchedValue !== undefined && (
                          <div className="rounded-lg bg-card p-2.5 border border-border">
                            <p className="text-[10px] uppercase font-bold text-muted">গ্রস ডিসপ্যাচ মূল্য</p>
                            <p className="text-xs font-bold text-foreground">{formatCurrency(event.details.grossDispatchedValue)}</p>
                          </div>
                        )}
                        {event.details.returnAdjustedValue !== undefined && (
                          <div className="rounded-lg bg-card p-2.5 border border-border">
                            <p className="text-[10px] uppercase font-bold text-muted">রিটার্ন মূল্য</p>
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{formatCurrency(event.details.returnAdjustedValue)}</p>
                          </div>
                        )}
                        {event.details.finalSoldValue !== undefined && (
                          <div className="rounded-lg bg-card p-2.5 border border-border">
                            <p className="text-[10px] uppercase font-bold text-muted">ফাইনাল বিক্রি (Sold)</p>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(event.details.finalSoldValue)}</p>
                          </div>
                        )}
                        {event.details.totalCollectedAmount !== undefined && (
                          <div className="rounded-lg bg-card p-2.5 border border-border">
                            <p className="text-[10px] uppercase font-bold text-muted">ক্যাশ কালেকশন</p>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{formatCurrency(event.details.totalCollectedAmount)}</p>
                          </div>
                        )}
                      </div>

                      {/* Additional detail notes */}
                      {event.details.settlementNote && (
                        <div className="rounded-lg bg-card p-2.5 border border-border">
                          <p className="text-[10px] uppercase font-bold text-muted">সেটেলমেন্ট নোট</p>
                          <p className="text-xs font-medium text-foreground">{event.details.settlementNote}</p>
                        </div>
                      )}

                      {event.details.note && !event.details.settlementNote && (
                        <div className="rounded-lg bg-card p-2.5 border border-border">
                          <p className="text-[10px] uppercase font-bold text-muted">নোট / মন্তব্য</p>
                          <p className="text-xs font-medium text-foreground">{event.details.note}</p>
                        </div>
                      )}

                      {/* Raw meta info for stock / purchases if available */}
                      {event.details.balanceAfter !== undefined && (
                        <div className="flex items-center gap-4 text-xs font-medium text-muted">
                          <span>পরবর্তী স্টক ব্যালেন্স: <strong className="text-foreground">{event.details.balanceAfter}</strong></span>
                          {event.details.quantity && <span>পরিমাণ: <strong className="text-foreground">{event.details.quantity}</strong></span>}
                          {event.details.reference && <span>রেফারেন্স: <strong className="text-foreground">{event.details.reference}</strong></span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
