'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { 
  ArrowLeft, Filter, Calendar, Building2, User, 
  MapPin, DollarSign, TrendingUp, Package, AlertCircle, 
  Search, Download, Printer, ChevronDown, ChevronUp,
  LayoutGrid, List, Layers, Store, Users, ShoppingCart,
  XCircle, Trash2, Loader2, Tag, FileText
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageCard } from '@/components/ui/page-card';
import { useToast } from '@/components/ui/toast-provider';
import { useCompanies, useRoutes, useShops, useProducts } from '@/hooks/use-common-queries';
import { getDamageReport, createManualDamage, deleteDamageRecord } from '@/lib/api/reports';
import { useAuth } from '@/components/auth/auth-provider';
import { getDeliveryMen } from '@/lib/api/users';
import { formatCurrency, formatDate, formatNumber, getTodayBDDate } from '@/lib/utils/format';
import { StateMessage } from '@/components/ui/state-message';
import { LoadingBlock } from '@/components/ui/loading-block';

export function DamageReportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDeleteDamage = async (id: number) => {
    try {
      setDeletingId(id);
      await deleteDamageRecord(id);
      showSuccessToast('Damage record deleted successfully');
      await fetchReport();
    } catch (err: any) {
      showErrorToast(err?.message || 'Failed to delete damage record');
    } finally {
      setDeletingId(null);
    }
  };
  
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

  // Manual Damage Entry Modal States
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [damageForm, setDamageForm] = useState({
    companyId: '',
    productId: '',
    quantity: '',
    reason: '',
    note: '',
    routeId: '',
    shopId: '',
    assignedDeliveryManId: '',
  });
  const [productSearch, setProductSearch] = useState('');
  const [showProductList, setShowProductList] = useState(false);

  const productRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (productRef.current && !productRef.current.contains(event.target as Node)) {
        setShowProductList(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Queries
  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();
  const { data: shops = [] } = useShops(filters.routeId ? Number(filters.routeId) : undefined);
  const { data: modalShops = [] } = useShops(damageForm.routeId ? Number(damageForm.routeId) : undefined);
  const { data: products = [] } = useProducts();

  // Memoized fallbacks for shops and products arrays
  const filterShopList = useMemo(() => {
    return Array.isArray(shops) ? shops : (shops as any)?.items || [];
  }, [shops]);

  const modalShopList = useMemo(() => {
    return Array.isArray(modalShops) ? modalShops : (modalShops as any)?.items || [];
  }, [modalShops]);

  const productList = useMemo(() => {
    return Array.isArray(products) ? products : (products as any)?.items || [];
  }, [products]);

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleCreateDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!damageForm.productId) {
      showErrorToast('Please select a product from the list');
      return;
    }

    const qty = Number(damageForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      showErrorToast('Please enter a valid quantity');
      return;
    }

    try {
      setIsSaving(true);
      await createManualDamage({
        productId: Number(damageForm.productId),
        quantity: qty,
        reason: damageForm.reason || undefined,
        note: damageForm.note || undefined,
        companyId: damageForm.companyId ? Number(damageForm.companyId) : undefined,
        routeId: damageForm.routeId ? Number(damageForm.routeId) : undefined,
        shopId: damageForm.shopId ? Number(damageForm.shopId) : undefined,
        assignedDeliveryManId: damageForm.assignedDeliveryManId || undefined,
      });
      showSuccessToast('Damage entry recorded successfully');
      setShowDamageModal(false);
      setDamageForm({
        companyId: '',
        productId: '',
        quantity: '',
        reason: '',
        note: '',
        routeId: '',
        shopId: '',
        assignedDeliveryManId: '',
      });
      setProductSearch('');
      await fetchReport();
    } catch (err: any) {
      showErrorToast(err?.message || 'Failed to record damage');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const [people, reportData] = await Promise.all([
        getDeliveryMen(),
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
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setDamageForm({
                companyId: '',
                productId: '',
                quantity: '',
                reason: '',
                note: '',
                routeId: '',
                shopId: '',
                assignedDeliveryManId: '',
              });
              setProductSearch('');
              setShowProductList(false);
              setShowDamageModal(true);
            }} 
            className="p-2 rounded-xl bg-rose-50 text-rose-600 transition-colors"
            title="Damage Entry"
          >
            <AlertCircle className="h-4 w-4" />
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-xl transition-colors ${showFilters ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="hidden lg:flex lg:items-end lg:justify-between pt-4 lg:pt-0 print:block">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-700 print:text-slate-500">Analytics & Insights</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 print:text-2xl print:mt-1">Damage Report</h1>
          <p className="mt-2 text-sm font-medium text-slate-500 print:hidden">Analyze damaged products across all dimensions.</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button 
            onClick={() => {
              setDamageForm({
                companyId: '',
                productId: '',
                quantity: '',
                reason: '',
                note: '',
                routeId: '',
                shopId: '',
                assignedDeliveryManId: '',
              });
              setProductSearch('');
              setShowProductList(false);
              setShowDamageModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition active:scale-95 animate-in fade-in"
          >
            <AlertCircle className="h-4 w-4" /> Damage Entry
          </button>
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
                {filterShopList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                {productList.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
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

      <PageCard noPadding className="relative overflow-hidden print:border-none print:shadow-none">
        {isLoading && report && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
          </div>
        )}
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
                    {canDelete && <th className="px-6 py-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report?.detailRows.map((r: any) => (
                    <tr key={r.id} className="transition hover:bg-slate-50/60">
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">{formatDate(r.date)}</td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-900">
                          {r.orderId ? `#${r.orderId}` : 'Manual'}
                        </p>
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
                      {canDelete && (
                        <td className="px-6 py-4 text-right">
                          <button
                            disabled={deletingId !== null}
                            onClick={() => handleDeleteDamage(r.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete Record"
                          >
                            {deletingId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      )}
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
                       <span className="text-xs font-black text-slate-900">
                         {r.orderId ? `#${r.orderId}` : 'Manual'}
                       </span>
                    </div>
                    {canDelete && (
                      <button
                        disabled={deletingId !== null}
                        onClick={() => handleDeleteDamage(r.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete Record"
                      >
                        {deletingId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
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
                  <tr key={`${row.id || 'null'}-${row.label}`} className="transition hover:bg-slate-50/60">
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

      {/* Damage Entry Modal */}
      {showDamageModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowDamageModal(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Rich Header */}
            <div className="relative bg-gradient-to-r from-rose-950 via-rose-900 to-red-950 px-8 py-6 text-white flex justify-between items-center border-b border-rose-900/20 overflow-hidden">
              <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-rose-300 leading-none">Inventory Adjustments</p>
                <h2 className="mt-1.5 text-2xl font-black tracking-tight">Damage Entry</h2>
                <p className="text-xs font-medium opacity-65 mt-0.5">Record and allocate manual product damages</p>
              </div>
              <button 
                onClick={() => setShowDamageModal(false)} 
                className="relative z-10 rounded-2xl bg-white/10 p-2.5 hover:bg-white/20 transition-all active:scale-95"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateDamage} className="p-8 space-y-5 overflow-y-auto max-h-[80vh] scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Policy Banner */}
                <div className="md:col-span-2 rounded-xl bg-amber-50/80 border border-amber-200/50 p-3.5 flex gap-3 items-start text-xs text-amber-900 animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black leading-none">Manual Entry Policy</p>
                    <p className="mt-1 opacity-80 font-medium">This entry functions purely as an audit log and does not adjust active product stock values.</p>
                  </div>
                </div>

                {/* Allocation details header */}
                <div className="md:col-span-2 flex items-center gap-3 py-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-600 bg-rose-50 border border-rose-100/80 px-2 py-0.5 rounded-md">01</span>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">Allocation details</span>
                  <span className="h-[2px] bg-slate-100 flex-1"></span>
                </div>

                {/* Company Dropdown */}
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Company</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select 
                      required 
                      value={damageForm.companyId} 
                      onChange={e => {
                        setDamageForm({...damageForm, companyId: e.target.value, productId: ''});
                        setProductSearch('');
                      }} 
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-10 py-3 text-sm focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none text-slate-900 bg-white dark:text-slate-900 dark:bg-white font-bold appearance-none cursor-pointer"
                    >
                      <option className="text-slate-900 bg-white" value="">Select Company</option>
                      {companies.map((c: any) => <option className="text-slate-900 bg-white" key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Route Dropdown */}
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Route</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select 
                      required 
                      value={damageForm.routeId} 
                      onChange={e => setDamageForm({...damageForm, routeId: e.target.value, shopId: ''})} 
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-10 py-3 text-sm focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none text-slate-900 bg-white dark:text-slate-900 dark:bg-white font-bold appearance-none cursor-pointer"
                    >
                      <option className="text-slate-900 bg-white" value="">Select Route</option>
                      {routes.map((r: any) => <option className="text-slate-900 bg-white" key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Shop Dropdown */}
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Shop</label>
                  <div className="relative">
                    <Store className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select 
                      required 
                      value={damageForm.shopId} 
                      onChange={e => setDamageForm({...damageForm, shopId: e.target.value})} 
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-10 py-3 text-sm focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none text-slate-900 bg-white dark:text-slate-900 dark:bg-white font-bold appearance-none cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                      disabled={!damageForm.routeId}
                    >
                      <option className="text-slate-900 bg-white" value="">Select Shop</option>
                      {modalShopList.map((s: any) => <option className="text-slate-900 bg-white" key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Staff Dropdown */}
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Staff (Delivery Man)</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select 
                      required 
                      value={damageForm.assignedDeliveryManId} 
                      onChange={e => setDamageForm({...damageForm, assignedDeliveryManId: e.target.value})} 
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-10 py-3 text-sm focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none text-slate-900 bg-white dark:text-slate-900 dark:bg-white font-bold appearance-none cursor-pointer"
                    >
                      <option className="text-slate-900 bg-white" value="">Select Staff</option>
                      {deliveryPeople.map((p: any) => <option className="text-slate-900 bg-white" key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Damage particulars header */}
                <div className="md:col-span-2 flex items-center gap-3 pt-3 py-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-600 bg-rose-50 border border-rose-100/80 px-2 py-0.5 rounded-md">02</span>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">Damage particulars</span>
                  <span className="h-[2px] bg-slate-100 flex-1"></span>
                </div>

                {/* Product Section */}
                {damageForm.productId ? (
                  <div className="relative rounded-3xl border border-rose-100 bg-rose-50/30 p-4.5 flex items-center justify-between animate-in fade-in zoom-in-95 duration-200 md:col-span-2 shadow-inner">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-white border border-rose-100 rounded-2xl shadow-sm text-rose-600">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-200/50 px-2.5 py-0.5 rounded-md">
                            {productList.find((p: any) => String(p.id) === damageForm.productId)?.sku || 'SKU'}
                          </span>
                          {companies.find((c: any) => String(c.id) === damageForm.companyId) && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
                              {companies.find((c: any) => String(c.id) === damageForm.companyId)?.name}
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-slate-900 mt-2 leading-tight">
                          {productList.find((p: any) => String(p.id) === damageForm.productId)?.name || 'Selected Product'}
                        </h4>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDamageForm({ ...damageForm, productId: '' });
                        setProductSearch('');
                      }}
                      className="text-[10px] font-black uppercase tracking-wider text-rose-600 hover:text-rose-700 hover:bg-rose-100/60 px-4 py-2.5 rounded-xl transition-all active:scale-95 border border-rose-200/40 bg-white shadow-sm shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div ref={productRef} className="relative space-y-1.5 md:col-span-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Search Product</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        required
                        type="text"
                        placeholder="Search SKU or Product Name..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setShowProductList(true);
                        }}
                        onFocus={() => setShowProductList(true)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-11 pr-4 text-sm focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none text-slate-950 font-bold"
                      />
                    </div>
                    {showProductList && (
                      <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-100 bg-white/95 backdrop-blur-md p-1 shadow-2xl scrollbar-thin animate-in fade-in slide-in-from-top-2">
                        <div className="px-3 py-2 text-[9px] font-black text-slate-400 tracking-wider uppercase border-b border-slate-50">
                          Matching Products
                        </div>
                        {productList
                          .filter((p: any) => !damageForm.companyId || p.companyId === Number(damageForm.companyId))
                          .filter((p: any) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                          .map((p: any) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setDamageForm({ 
                                  ...damageForm, 
                                  productId: String(p.id),
                                  companyId: String(p.companyId) 
                                });
                                setProductSearch(p.name);
                                setShowProductList(false);
                              }}
                              className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-slate-900">{p.name}</p>
                                  <span className="px-2 py-0.5 text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-100 rounded-md uppercase tracking-wider">{p.sku}</span>
                                </div>
                                {companies.find((c: any) => c.id === p.companyId) && (
                                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    {companies.find((c: any) => c.id === p.companyId)?.name}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))}
                        {productList
                          .filter((p: any) => !damageForm.companyId || p.companyId === Number(damageForm.companyId))
                          .filter((p: any) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                          .length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400 font-medium">
                              No products match search criteria
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                )}

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Quantity</label>
                  <div className="relative">
                    <Package className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input 
                      required 
                      type="number" 
                      min="0.01" 
                      step="any"
                      value={damageForm.quantity} 
                      onChange={e => setDamageForm({...damageForm, quantity: e.target.value})} 
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 py-3 text-sm focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none text-slate-950 font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Reason</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input 
                      type="text"
                      value={damageForm.reason} 
                      onChange={e => setDamageForm({...damageForm, reason: e.target.value})} 
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 py-3 text-sm focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none text-slate-950 font-bold"
                      placeholder="Expired, Broken, etc." 
                    />
                  </div>
                </div>

                {/* Note / Remarks (Full Width) */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Note / Remarks</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-4 h-4 w-4 text-slate-400 pointer-events-none" />
                    <textarea 
                      value={damageForm.note} 
                      onChange={e => setDamageForm({...damageForm, note: e.target.value})} 
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 py-3 text-sm focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none text-slate-950 font-medium min-h-[80px]" 
                      placeholder="Write details or extra notes..." 
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  disabled={isSaving} 
                  onClick={() => setShowDamageModal(false)} 
                  className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving || !damageForm.productId} 
                  className="flex-1 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-600/20 hover:shadow-rose-600/35 hover:from-rose-700 hover:to-rose-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    'Save Damage'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
