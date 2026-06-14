'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  ArrowLeft, Filter, Calendar, Building2, User, 
  MapPin, DollarSign, TrendingUp, Package, AlertCircle, 
  Search, Download, Printer, ChevronDown, ChevronUp,
  LayoutGrid, List, Layers, Store, Users, ShoppingCart
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageCard } from '@/components/ui/page-card';
import { useToast } from '@/components/ui/toast-provider';
import { useCompanies, useRoutes, useShops, useProducts } from '@/hooks/use-common-queries';
import { getDamageReport } from '@/lib/api/reports';
import { getDeliveryPeople } from '@/lib/api/delivery-ops';
import { formatCurrency, formatDate, formatNumber, getTodayBDDate } from '@/lib/utils/format';
import { StateMessage } from '@/components/ui/state-message';
import { LoadingBlock } from '@/components/ui/loading-block';

export function DamageReportPage() {
  const router = useRouter();
  const { error: showErrorToast } = useToast();
  
  // States
  const [filters, setFilters] = useState({
    dateMode: 'Today',
    date: getTodayBDDate(),
    fromDate: getTodayBDDate(),
    toDate: getTodayBDDate(),
    companyId: '',
    routeId: '',
    shopId: '',
    deliveryManId: '',
    productId: '',
  });
  
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');
  const [deliveryPeople, setDeliveryPeople] = useState<any[]>([]);

  // Queries
  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();
  const { data: shops = [] } = useShops(filters.routeId ? Number(filters.routeId) : undefined);
  const { data: products = [] } = useProducts();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const [people, reportData] = await Promise.all([
        getDeliveryPeople(),
        getDamageReport(filters),
      ]);
      setDeliveryPeople(people);
      setReport(reportData);
    } catch (error) {
      showErrorToast('Failed to load damage report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filters]);

  const handleExport = () => {
    const headers = ['Date', 'Order No', 'Company', 'Route', 'Shop', 'Delivery Man', 'Product', 'Damaged Qty', 'Unit', 'Price', 'Damage Value', 'Reason', 'Batch No'];
    const rows = report.detailRows.map((r: any) => [
      formatDate(r.date),
      `#${r.orderId}`,
      r.company,
      r.route,
      r.shop,
      r.deliveryMan,
      r.product,
      r.damagedQty,
      r.unit,
      r.price,
      r.damageValue,
      r.reason,
      r.batchNo
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map((r: any) => `"${r.join('","')}"`)].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `damage_report_${getTodayBDDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading && !report) return <LoadingBlock label="Generating Analytics..." />;

  const tabs = [
    { id: 'detail', label: 'Detail View', icon: List },
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'route', label: 'Route', icon: MapPin },
    { id: 'product', label: 'Product', icon: Package },
    { id: 'shop', label: 'Shop', icon: Store },
    { id: 'staff', label: 'Staff', icon: Users },
  ];

  return (
    <div className="space-y-6 pb-24 print:pb-0 print:space-y-4">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white px-4 py-3 border-b border-slate-100 lg:hidden print:hidden">
        <button onClick={handleBack} className="flex items-center gap-2 font-bold text-slate-900">
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-slate-900">Damage Qty</h1>
        <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-xl transition-colors ${showFilters ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>
          <Filter className="h-4 w-4" />
        </button>
      </div>

      <div className="hidden lg:flex lg:items-end lg:justify-between pt-4 lg:pt-0 print:block">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-700 print:text-slate-500">Analytics & Insights</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 print:text-2xl print:mt-1">Damage Report</h1>
          <p className="mt-2 text-sm font-medium text-slate-500 print:hidden">Analyze damaged products across all dimensions.</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button onClick={handleExport} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-slate-800">
            <Printer className="h-4 w-4" /> Print Report
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className={`${showFilters ? 'block' : 'hidden'} lg:block pt-12 lg:pt-0 print:hidden`}>
        <PageCard>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date Mode</label>
              <select 
                value={filters.dateMode}
                onChange={e => setFilters({...filters, dateMode: e.target.value})}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition"
              >
                <option value="Today">Today</option>
                <option value="Selected Date">Selected Date</option>
                <option value="Date Range">Date Range</option>
              </select>
            </div>

            {filters.dateMode === 'Selected Date' && (
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pick Date</label>
                <input
                  type="date"
                  value={filters.date}
                  onChange={e => setFilters({...filters, date: e.target.value})}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                />
              </div>
            )}

            {filters.dateMode === 'Date Range' && (
              <>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">From</label>
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={e => setFilters({...filters, fromDate: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">To</label>
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={e => setFilters({...filters, toDate: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Company</label>
              <select 
                value={filters.companyId}
                onChange={e => setFilters({...filters, companyId: e.target.value})}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <option value="">All Companies</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Route</label>
              <select 
                value={filters.routeId}
                onChange={e => setFilters({...filters, routeId: e.target.value, shopId: ''})}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <option value="">All Routes</option>
                {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Shop</label>
              <select 
                value={filters.shopId}
                onChange={e => setFilters({...filters, shopId: e.target.value})}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <option value="">All Shops</option>
                {shops.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Delivery Man</label>
              <select 
                value={filters.deliveryManId}
                onChange={e => setFilters({...filters, deliveryManId: e.target.value})}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <option value="">All Staff</option>
                {deliveryPeople.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Product</label>
              <select 
                value={filters.productId}
                onChange={e => setFilters({...filters, productId: e.target.value})}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <option value="">All Products</option>
                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </PageCard>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
        <div className="rounded-[1.75rem] border border-slate-100 bg-orange-50/50 p-5 shadow-sm print:bg-white print:border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-xl print:hidden"><AlertCircle className="h-4 w-4 text-orange-600" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400 leading-none">Total Damaged Qty</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{formatNumber(report?.summary?.totalDamagedQty || 0)} PCS</h3>
            </div>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-slate-100 bg-amber-50/50 p-5 shadow-sm print:bg-white print:border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl print:hidden"><TrendingUp className="h-4 w-4 text-amber-600" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 leading-none">Today Damaged Qty</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{formatNumber(report?.summary?.todayDamagedQty || 0)} PCS</h3>
            </div>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-slate-100 bg-rose-50/50 p-5 shadow-sm print:bg-white print:border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-xl print:hidden"><DollarSign className="h-4 w-4 text-rose-600" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 leading-none">Damage Value</p>
              <h3 className="mt-1 text-lg font-black text-rose-700">{formatCurrency(report?.summary?.totalDamageValue || 0)}</h3>
            </div>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/50 p-5 shadow-sm print:bg-white print:border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-200 rounded-xl print:hidden"><ShoppingCart className="h-4 w-4 text-slate-600" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Total Orders</p>
              <h3 className="mt-1 text-lg font-black text-slate-700">{formatNumber(report?.summary?.totalOrders || 0)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white rounded-3xl border border-slate-100 p-4">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Top Damaged Product</p>
           <p className="text-sm font-black text-slate-900 truncate">{report?.summary?.topProduct}</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 p-4">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Top Route</p>
           <p className="text-sm font-black text-slate-900 truncate">{report?.summary?.topRoute}</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 p-4">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Top Company</p>
           <p className="text-sm font-black text-slate-900 truncate">{report?.summary?.topCompany}</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 p-4">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Shops</p>
           <p className="text-sm font-black text-slate-900 truncate">{report?.summary?.totalShops} SHOPS</p>
        </div>
      </div>

      {/* Tabs / Views */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 print:hidden">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
              activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      <PageCard noPadding className="overflow-hidden print:border-none print:shadow-none">
        {activeTab === 'detail' && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Order / Batch</th>
                    <th className="px-6 py-4">Shop</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4 text-center">Damaged</th>
                    <th className="px-6 py-4 text-right">Loss Value</th>
                    <th className="px-6 py-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report?.detailRows.map((r: any) => (
                    <tr key={r.id} className="transition hover:bg-slate-50/60">
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">{formatDate(r.date)}</td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-900">#{r.orderId}</p>
                        {r.batchNo && <p className="mt-1 text-[9px] font-black text-slate-400 uppercase">{r.batchNo}</p>}
                      </td>
                      <td className="px-6 py-4">
                         <p className="text-xs font-bold text-slate-900 leading-none">{r.shop}</p>
                         <p className="mt-1 text-[9px] font-black text-slate-400 uppercase leading-none">{r.route}</p>
                      </td>
                      <td className="px-6 py-4">
                         <p className="text-xs font-bold text-slate-900 leading-none">{r.product}</p>
                         <p className="mt-1 text-[9px] font-black text-slate-400 uppercase leading-none">{r.company}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-black text-orange-600 bg-orange-50/30">{r.damagedQty}</td>
                      <td className="px-6 py-4 text-right text-xs font-black text-rose-600">{formatCurrency(r.damageValue)}</td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-medium text-slate-500 line-clamp-2 max-w-[150px]" title={r.reason}>
                          {r.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {report?.detailRows.map((r: any) => (
                <div key={r.id} className="p-4 space-y-3 active:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase">{formatDate(r.date)}</span>
                       <span className="text-xs font-black text-slate-900">#{r.orderId}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{r.shop}</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">{r.product}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-4">
                       <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Damaged</p>
                          <p className="text-xs font-black text-orange-600">{r.damagedQty}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-slate-400 uppercase">Loss</p>
                       <p className="text-xs font-black text-rose-600">{formatCurrency(r.damageValue)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {(activeTab !== 'detail') && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-6 py-4">{activeTab.toUpperCase()} Name</th>
                  <th className="px-6 py-4 text-center">Total Damaged Qty</th>
                  <th className="px-6 py-4 text-right">Total Loss Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(activeTab === 'company' ? report?.companySummary :
                  activeTab === 'route' ? report?.routeSummary :
                  activeTab === 'product' ? report?.productSummary :
                  activeTab === 'shop' ? report?.shopSummary :
                  report?.deliveryManSummary).map((row: any) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.label}</td>
                    <td className="px-6 py-4 text-center text-sm font-black text-orange-600">{formatNumber(row.totalQty)} PCS</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-rose-600">{formatCurrency(row.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!report?.detailRows?.length && (
          <div className="py-20 text-center">
            <StateMessage
              title="No damage records"
              description="No damaged items were found for the selected filters."
              icon={<AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-200" />}
            />
          </div>
        )}
      </PageCard>
    </div>
  );
}
