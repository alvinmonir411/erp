'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageCard } from '@/components/ui/page-card';
import { useToast } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { getBusinessOverview } from '@/lib/api/analytics';
import { getRoutes } from '@/lib/api/routes';
import { getDeliveryPeople } from '@/lib/api/delivery-ops';
import { getCompanies } from '@/lib/api/companies';
import {
  TrendingUp,
  Box,
  DollarSign,
  Receipt,
  Gift,
  AlertTriangle,
  PieChart,
  BarChart3,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  Download,
  Printer,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Truck,
  UserCheck,
  Building2,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
} from 'lucide-react';

export function ExpensesPage() {
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Filter options
  const [routes, setRoutes] = useState<any[]>([]);
  const [deliveryPeople, setDeliveryPeople] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);

  // Filter state
  const [datePreset, setDatePreset] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'expenses' | 'freeItems' | 'damage' | 'inventory' | 'sales' | 'collections'
  >('overview');

  // Sorting state for tables
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const [rList, pList, cList] = await Promise.all([
        getRoutes(),
        getDeliveryPeople(),
        getCompanies(),
      ]);
      setRoutes(rList || []);
      setDeliveryPeople(pList || []);
      setCompanies(cList || []);
    } catch (e) {
      // Ignore filter load errors
    }
  };

  const fetchOverviewData = async () => {
    try {
      setIsLoading(true);
      const queryParams: any = {
        datePreset,
      };
      if (datePreset === 'custom') {
        if (startDate) queryParams.startDate = startDate;
        if (endDate) queryParams.endDate = endDate;
      }
      if (selectedRouteId) queryParams.routeId = selectedRouteId;
      if (selectedPersonnelId) queryParams.deliveryManId = selectedPersonnelId;
      if (selectedCompanyId) queryParams.companyId = selectedCompanyId;

      const res = await getBusinessOverview(queryParams);
      setData(res);
    } catch (e: any) {
      showErrorToast(e.message || 'Failed to load business analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, [datePreset, startDate, endDate, selectedRouteId, selectedPersonnelId, selectedCompanyId]);

  // Export handlers
  const exportToCSV = (tableName: string, rows: any[]) => {
    if (!rows || rows.length === 0) {
      showErrorToast('No data available to export');
      return;
    }
    const headers = Object.keys(rows[0]).join(',');
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Business_Analytics_${tableName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccessToast(`${tableName} exported to CSV successfully`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Safe defaults
  const inventory = data?.inventory || { totalStockQty: 0, totalStockValue: 0, currentStockWorth: 0, lowStockCount: 0, outOfStockCount: 0, list: [] };
  const sales = data?.sales || { totalSalesAmount: 0, totalOrders: 0, list: [] };
  const collections = data?.collections || { totalCollectedCash: 0, pendingCollection: 0, collectionEfficiencyPct: 0, list: [] };
  const expenses = data?.expenses || { totalExpenses: 0, vanRent: 0, salary: 0, fuel: 0, food: 0, otherExpenses: 0, breakdownByRoute: [], breakdownByPerson: [], list: [] };
  const freeItems = data?.freeItems || { totalQty: 0, totalCost: 0, list: [] };
  const damage = data?.damage || { totalQty: 0, totalLossValue: 0, list: [] };
  const businessHealth = data?.businessHealth || { netBusinessWorth: 0, netBusinessAsset: 0, operationalLeakage: 0, leakagePct: 0, status: 'HEALTHY', label: 'Healthy', badgeColor: 'emerald' };
  const insights = data?.insights || [];
  const charts = data?.charts || { expenseCategoryPie: [], routeWiseExpense: [], deliveryPersonExpense: [], operationalLeakageBreakdown: [] };

  // Filtered rows for active tab table search
  const filteredTableData = useMemo(() => {
    let list: any[] = [];
    if (activeTab === 'expenses') list = expenses.list || [];
    else if (activeTab === 'freeItems') list = freeItems.list || [];
    else if (activeTab === 'damage') list = damage.list || [];
    else if (activeTab === 'inventory') list = inventory.list || [];
    else if (activeTab === 'sales') list = sales.list || [];
    else if (activeTab === 'collections') list = sales.list || [];

    if (!tableSearch.trim()) return list;
    const q = tableSearch.toLowerCase().trim();
    return list.filter((item) =>
      Object.values(item).some((val) => String(val).toLowerCase().includes(q)),
    );
  }, [activeTab, tableSearch, expenses, freeItems, damage, inventory, sales]);

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* Top Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Business Analytics (ব্যবসার বিশ্লেষণ)
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Real-Time 360° Financial & Operational Executive Control Center
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOverviewData()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm text-sm font-medium transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Filter className="w-4 h-4 text-indigo-500" />
            <span>Filter Period & Parameters:</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'custom', label: 'Custom Date' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  datePreset === p.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range & parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
          {datePreset === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Route (রুট)</label>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All Routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Person (কর্মী)</label>
            <select
              value={selectedPersonnelId}
              onChange={(e) => setSelectedPersonnelId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All Personnel</option>
              {deliveryPeople.map((dp) => (
                <option key={dp.id} value={dp.id}>
                  {dp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Company (কোম্পানি)</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TOP 8 EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Inventory */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              1. Total Inventory (স্টক)
            </span>
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Box className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(inventory.totalStockValue)}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Stock Quantity:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {inventory.totalStockQty.toLocaleString('en-IN')} pcs
              </span>
            </div>
          </div>
        </div>

        {/* 2. Total Sales */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              2. Total Sales (মোট বিক্রি)
            </span>
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(sales.totalSalesAmount)}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Completed Orders:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {sales.totalOrders} orders
              </span>
            </div>
          </div>
        </div>

        {/* 3. Total Cash Collection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              3. Cash Collection (কালেকশন)
            </span>
            <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(collections.totalCollectedCash)}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Pending Dues:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {formatCurrency(collections.pendingCollection)}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Total Operational Expenses */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              4. Operational Expenses (খরচ)
            </span>
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(expenses.totalExpenses)}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Van: {formatCurrency(expenses.vanRent)}</span>
              <span>Salary: {formatCurrency(expenses.salary)}</span>
            </div>
          </div>
        </div>

        {/* 5. Total Free Items */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              5. Total Free Items (ফ্রি মালামাল)
            </span>
            <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <Gift className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(freeItems.totalCost)}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Free Items Qty:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {freeItems.totalQty.toLocaleString('en-IN')} pcs
              </span>
            </div>
          </div>
        </div>

        {/* 6. Total Damage Loss */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              6. Damage Loss (ড্যামেজ ক্ষতি)
            </span>
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {formatCurrency(damage.totalLossValue)}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Damaged Qty:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {damage.totalQty.toLocaleString('en-IN')} pcs
              </span>
            </div>
          </div>
        </div>

        {/* 7. Current Stock Worth (Market) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              7. Stock Market Worth (বাজারমূল্য)
            </span>
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatCurrency(inventory.currentStockWorth)}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Expected Sales Assets</span>
            </div>
          </div>
        </div>

        {/* 8. Net Business Worth */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-indigo-200 dark:border-indigo-900 bg-gradient-to-br from-indigo-50/50 to-white dark:from-gray-800 dark:to-gray-800 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              8. Net Business Worth (প্রকৃত সম্পদ)
            </span>
            <div className="p-2 rounded-lg bg-indigo-600 text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {formatCurrency(businessHealth.netBusinessWorth)}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              <span>Inventory - Leakage</span>
            </div>
          </div>
        </div>
      </div>

      {/* BUSINESS HEALTH ANALYSIS CARD */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                <Activity className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Business Health Indicator (ব্যবসার সামগ্রিক অবস্থা)
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Operational Leakage calculate করা হয়েছে (Expenses + Damage Loss + Free Items). যা মোট স্টক সম্পদ থেকে লিকেজ হার নির্দেশ করে।
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/80 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Business Health Status</div>
              <div className="text-lg font-bold flex items-center gap-2 mt-0.5">
                {businessHealth.status === 'HEALTHY' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" /> Healthy (0-5%)
                  </span>
                )}
                {businessHealth.status === 'ATTENTION_NEEDED' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                    <AlertCircle className="w-4 h-4" /> Attention Needed (5-10%)
                  </span>
                )}
                {businessHealth.status === 'HIGH_RISK' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4" /> High Risk (10-20%)
                  </span>
                )}
                {businessHealth.status === 'CRITICAL' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                    <ShieldAlert className="w-4 h-4" /> Critical (20%+)
                  </span>
                )}
              </div>
            </div>
            <div className="border-l border-gray-200 dark:border-gray-700 pl-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">Leakage Rate</div>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
                {businessHealth.leakagePct}%
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid inside Health Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700/60">
          <div className="p-3.5 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
            <div className="text-xs text-gray-500">Net Business Asset</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
              {formatCurrency(businessHealth.netBusinessAsset)}
            </div>
          </div>
          <div className="p-3.5 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
            <div className="text-xs text-gray-500">Total Operational Leakage</div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {formatCurrency(businessHealth.operationalLeakage)}
            </div>
          </div>
          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg">
            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Net Business Worth</div>
            <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
              {formatCurrency(businessHealth.netBusinessWorth)}
            </div>
          </div>
        </div>

        {/* Leakage Progress Bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-400">
            <span>Operational Leakage vs Inventory Asset Gauge</span>
            <span>{businessHealth.leakagePct}% Ratio</span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${Math.min(100, businessHealth.leakagePct)}%` }}
              className={`h-full transition-all duration-500 ${
                businessHealth.leakagePct > 20
                  ? 'bg-rose-500'
                  : businessHealth.leakagePct > 10
                  ? 'bg-amber-500'
                  : businessHealth.leakagePct > 5
                  ? 'bg-yellow-500'
                  : 'bg-emerald-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* SMART BUSINESS INSIGHTS */}
      {insights.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Zap className="w-5 h-5 text-amber-500" />
            <span>Smart Business Insights & Analysis (ব্যবসার অটোমেটিক পর্যবেক্ষণ)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((ins: any, idx: number) => (
              <div
                key={idx}
                className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                  ins.type === 'danger'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                    : ins.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200'
                    : ins.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
                    : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{ins.title}</span>
                </div>
                <p className="leading-relaxed opacity-90">{ins.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISUAL CHARTS & BREAKDOWNS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Category Pie Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-500" />
              Expense Category Distribution (খরচের খাতসমূহ)
            </h3>
          </div>
          <div className="space-y-3">
            {(charts.expenseCategoryPie || []).map((cat: any, i: number) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                  <span>{cat.category}</span>
                  <span>
                    {formatCurrency(cat.amount)} ({cat.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${cat.percentage}%` }}
                    className="bg-indigo-600 h-full rounded-full transition-all"
                  />
                </div>
              </div>
            ))}
            {(!charts.expenseCategoryPie || charts.expenseCategoryPie.length === 0) && (
              <div className="text-center py-6 text-xs text-gray-400">No expense category data</div>
            )}
          </div>
        </div>

        {/* Operational Leakage Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-rose-500" />
              Operational Leakage Components (লিকেজ বিভাজন)
            </h3>
          </div>
          <div className="space-y-4">
            {(charts.operationalLeakageBreakdown || []).map((item: any, idx: number) => {
              const totalL = Math.max(1, businessHealth.operationalLeakage);
              const pct = Math.round((item.amount / totalL) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                    <span>{item.name}</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(item.amount)} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-all ${
                        idx === 0 ? 'bg-purple-600' : idx === 1 ? 'bg-rose-600' : 'bg-sky-600'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Route-Wise Expense */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-teal-500" />
              Route-Wise Expense Ranking (রুট ভিত্তিক খরচ)
            </h3>
          </div>
          <div className="space-y-3">
            {(charts.routeWiseExpense || []).slice(0, 5).map((r: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2.5 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                <span className="font-medium text-gray-800 dark:text-gray-200">{r.name}</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(r.amount)}</span>
              </div>
            ))}
            {(!charts.routeWiseExpense || charts.routeWiseExpense.length === 0) && (
              <div className="text-center py-6 text-xs text-gray-400">No route expense records</div>
            )}
          </div>
        </div>

        {/* Delivery Person Expense */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-500" />
              Delivery Person Expense Ranking (কর্মী ভিত্তিক খরচ)
            </h3>
          </div>
          <div className="space-y-3">
            {(charts.deliveryPersonExpense || []).slice(0, 5).map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2.5 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                <span className="font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(p.amount)}</span>
              </div>
            ))}
            {(!charts.deliveryPersonExpense || charts.deliveryPersonExpense.length === 0) && (
              <div className="text-center py-6 text-xs text-gray-400">No personnel expense records</div>
            )}
          </div>
        </div>
      </div>

      {/* DETAIL TABLES & TABS SECTION */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'overview', label: '📊 Overview' },
              { id: 'expenses', label: `💸 Expenses (${expenses.list?.length || 0})` },
              { id: 'freeItems', label: `🎁 Free Items (${freeItems.list?.length || 0})` },
              { id: 'damage', label: `⚠️ Damage Loss (${damage.list?.length || 0})` },
              { id: 'inventory', label: `📦 Stock Assets (${inventory.list?.length || 0})` },
              { id: 'sales', label: `💰 Sales (${sales.list?.length || 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setTableSearch('');
                }}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search table..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
            <button
              onClick={() => exportToCSV(activeTab, filteredTableData)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Tab Content Tables */}
        <div className="overflow-x-auto">
          {activeTab === 'expenses' && (
            <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-900/60 uppercase font-semibold text-gray-500">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Batch No</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Delivery Person</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredTableData.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="py-2.5 px-3">{row.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-indigo-600">{row.batchNo}</td>
                    <td className="py-2.5 px-3 font-semibold">{row.category}</td>
                    <td className="py-2.5 px-3">{row.name}</td>
                    <td className="py-2.5 px-3">{row.route}</td>
                    <td className="py-2.5 px-3">{row.deliveryPerson}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900 dark:text-white">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
                {filteredTableData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-400">
                      No expense records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'freeItems' && (
            <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-900/60 uppercase font-semibold text-gray-500">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Shop</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3 text-right">Free Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredTableData.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="py-2.5 px-3">{row.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">{row.productName}</td>
                    <td className="py-2.5 px-3">{row.shopName}</td>
                    <td className="py-2.5 px-3">{row.routeName}</td>
                    <td className="py-2.5 px-3 text-right font-semibold">{row.freeQuantity} pcs</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(row.unitPrice)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-sky-600 dark:text-sky-400">
                      {formatCurrency(row.totalValue)}
                    </td>
                  </tr>
                ))}
                {filteredTableData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-400">
                      No free item records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'damage' && (
            <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-900/60 uppercase font-semibold text-gray-500">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Reason / Note</th>
                  <th className="py-2.5 px-3 text-right">Damaged Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Loss Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredTableData.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="py-2.5 px-3">{row.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">{row.productName}</td>
                    <td className="py-2.5 px-3">{row.routeName}</td>
                    <td className="py-2.5 px-3">{row.reason}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-rose-600">{row.quantity} pcs</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(row.unitPrice)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(row.lossValue)}
                    </td>
                  </tr>
                ))}
                {filteredTableData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-400">
                      No damage records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'inventory' && (
            <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-900/60 uppercase font-semibold text-gray-500">
                <tr>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3 text-right">Current Stock</th>
                  <th className="py-2.5 px-3 text-right">Buy Price</th>
                  <th className="py-2.5 px-3 text-right">Sale Price</th>
                  <th className="py-2.5 px-3 text-right">Stock Cost Asset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredTableData.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="py-2.5 px-3 font-mono text-gray-500">{row.sku}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">{row.name}</td>
                    <td className="py-2.5 px-3">{row.companyName}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{row.currentStock} pcs</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(row.buyPrice)}</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(row.salePrice)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(row.stockValueCost)}
                    </td>
                  </tr>
                ))}
                {filteredTableData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-400">
                      No stock items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'sales' && (
            <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-900/60 uppercase font-semibold text-gray-500">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Order Invoice</th>
                  <th className="py-2.5 px-3">Shop</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Payable Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredTableData.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="py-2.5 px-3">{row.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-indigo-600">{row.orderNo}</td>
                    <td className="py-2.5 px-3">{row.shopName}</td>
                    <td className="py-2.5 px-3">{row.routeName}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900 dark:text-white">
                      {formatCurrency(row.payableAmount)}
                    </td>
                  </tr>
                ))}
                {filteredTableData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-gray-400">
                      No sales records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'overview' && (
            <div className="py-4 space-y-4">
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                Executive Business Financial Summary (ব্যবসার সারসংক্ষেপ)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                  <div className="text-xs text-gray-500">Inventory Cost Value</div>
                  <div className="text-base font-bold">{formatCurrency(inventory.totalStockValue)}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                  <div className="text-xs text-gray-500">Total Sales Delivered</div>
                  <div className="text-base font-bold">{formatCurrency(sales.totalSalesAmount)}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                  <div className="text-xs text-gray-500">Cash Collected</div>
                  <div className="text-base font-bold text-emerald-600">{formatCurrency(collections.totalCollectedCash)}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                  <div className="text-xs text-gray-500">Pending Dues</div>
                  <div className="text-base font-bold text-amber-600">{formatCurrency(collections.pendingCollection)}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                  <div className="text-xs text-gray-500">Operational Expenses</div>
                  <div className="text-base font-bold text-purple-600">{formatCurrency(expenses.totalExpenses)}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                  <div className="text-xs text-gray-500">Damage Product Loss</div>
                  <div className="text-base font-bold text-rose-600">{formatCurrency(damage.totalLossValue)}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg">
                  <div className="text-xs text-gray-500">Free Product Cost</div>
                  <div className="text-base font-bold text-sky-600">{formatCurrency(freeItems.totalCost)}</div>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-900">
                  <div className="text-xs text-indigo-600 font-semibold">Net Business Worth</div>
                  <div className="text-base font-extrabold text-indigo-700 dark:text-indigo-300">
                    {formatCurrency(businessHealth.netBusinessWorth)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
