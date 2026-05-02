'use client';

import Link from 'next/link';
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useCompanies, useRoutes, useShops } from '@/hooks/use-common-queries';
import {
  useSalesList,
  useTodaySales,
  useTodayProfit,
  useMonthlySales,
  useDueOverview,
  useRouteSales,
  useCompanySales,
  useRouteDue,
  useShopDue,
  useCompanyDue
} from '@/hooks/use-sales-queries';
import { PageCard } from '@/components/ui/page-card';
import { Pagination } from '@/components/ui/pagination';
import { StateMessage } from '@/components/ui/state-message';
import { useToast, useToastNotification } from '@/components/ui/toast-provider';
import { deleteSale } from '@/lib/api/sales';
import { formatCurrency, formatDate, getTodayBD, formatBDDate, toNumber } from '@/lib/utils/format';
import type { Sale } from '@/types/api';

const salesPageSize = 10;
const summaryPageSize = 8;

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFilterDateTime(value: string, boundary: 'start' | 'end') {
  const time = boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999';
  return new Date(`${value}${time}`).toISOString();
}

export function SalesPage() {
  const shopDueSectionRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();

  // Filter States
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(() => {
    const cid = searchParams.get('companyId');
    return cid ? Number(cid) : null;
  });
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(() => {
    const rid = searchParams.get('routeId');
    return rid ? Number(rid) : null;
  });
  const [selectedShopId, setSelectedShopId] = useState<number | null>(() => {
    const sid = searchParams.get('shopId');
    return sid ? Number(sid) : null;
  });
  const [fromDate, setFromDate] = useState(() => searchParams.get('fromDate') || '');
  const [toDate, setToDate] = useState(() => searchParams.get('toDate') || '');
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [dueOnly, setDueOnly] = useState(() => searchParams.get('dueOnly') === 'true');

  // Pagination States
  const [salesPage, setSalesPage] = useState(() => {
    const p = searchParams.get('page');
    return p ? Number(p) : 1;
  });
  const [routeSummaryPage, setRouteSummaryPage] = useState(1);
  const [companySummaryPage, setCompanySummaryPage] = useState(1);
  const [routeDuePage, setRouteDuePage] = useState(1);
  const [shopDuePage, setShopDuePage] = useState(1);
  const [companyDuePage, setCompanyDuePage] = useState(1);

  useEffect(() => {
    const cid = searchParams.get('companyId');
    setSelectedCompanyId(cid ? Number(cid) : null);
    
    const rid = searchParams.get('routeId');
    setSelectedRouteId(rid ? Number(rid) : null);
    
    const sid = searchParams.get('shopId');
    setSelectedShopId(sid ? Number(sid) : null);
    
    setFromDate(searchParams.get('fromDate') || '');
    setToDate(searchParams.get('toDate') || '');
    setSearchTerm(searchParams.get('search') || '');
    setDueOnly(searchParams.get('dueOnly') === 'true');
    
    const p = searchParams.get('page');
    setSalesPage(p ? Number(p) : 1);
  }, [searchParams]);

  // Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState({
    date: formatBDDate(getTodayBD()),
    scope: 'all' as 'all' | 'company',
    companyId: '' as string | number,
  });

  // Queries
  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();
  const { data: shops = [] } = useShops(selectedRouteId);

  const salesQuery = useMemo(() => ({
    companyId: selectedCompanyId ?? undefined,
    routeId: selectedRouteId ?? undefined,
    shopId: selectedShopId ?? undefined,
    fromDate: fromDate ? getFilterDateTime(fromDate, 'start') : undefined,
    toDate: toDate ? getFilterDateTime(toDate, 'end') : undefined,
    dueOnly: dueOnly || undefined,
    search: searchTerm.trim() || undefined,
    page: salesPage,
    limit: salesPageSize,
  }), [selectedCompanyId, selectedRouteId, selectedShopId, fromDate, toDate, dueOnly, searchTerm, salesPage]);

  const { data: salesData, isFetching: isFetchingSales } = useSalesList(salesQuery);
  const { data: todaySales } = useTodaySales();
  const { data: todayProfit } = useTodayProfit();
  const { data: monthlySales } = useMonthlySales();
  const { data: dueOverview } = useDueOverview();
  const { data: routeSales = [] } = useRouteSales();
  const { data: companySales = [] } = useCompanySales();
  const { data: routeDue = [] } = useRouteDue();
  const { data: shopDue = [] } = useShopDue();
  const { data: companyDue = [] } = useCompanyDue();

  const sales = salesData?.items ?? [];
  const salesTotalItems = salesData?.totalItems ?? 0;

  // Memoized Paginatons
  const paginatedRouteSummary = useMemo(() => {
    const start = (routeSummaryPage - 1) * summaryPageSize;
    return routeSales.slice(start, start + summaryPageSize);
  }, [routeSummaryPage, routeSales]);

  const paginatedCompanySummary = useMemo(() => {
    const start = (companySummaryPage - 1) * summaryPageSize;
    return companySales.slice(start, start + summaryPageSize);
  }, [companySummaryPage, companySales]);

  const paginatedRouteDueSummary = useMemo(() => {
    const start = (routeDuePage - 1) * summaryPageSize;
    return routeDue.slice(start, start + summaryPageSize);
  }, [routeDuePage, routeDue]);

  const paginatedShopDueSummary = useMemo(() => {
    const start = (shopDuePage - 1) * summaryPageSize;
    return shopDue.slice(start, start + summaryPageSize);
  }, [shopDuePage, shopDue]);

  const paginatedCompanyDueSummary = useMemo(() => {
    const start = (companyDuePage - 1) * summaryPageSize;
    return companyDue.slice(start, start + summaryPageSize);
  }, [companyDuePage, companyDue]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCompanyId(null);
    setSelectedRouteId(null);
    setSelectedShopId(null);
    setFromDate('');
    setToDate('');
    setDueOnly(false);
    setSalesPage(1);
  };

  return (
    <div className="space-y-6">
      <PageCard
        title="Sales"
        description="Track daily sales, filter by company, route, shop, and date, and monitor due sales and collections."
        action={
          <div className="flex gap-3">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none"
            >
              Print Summary
            </button>
            <Link
              href="/sales/create"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5"
            >
              Create Sale
            </Link>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice..."
            className="rounded-2xl border-0 bg-slate-100 px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <select
            value={selectedCompanyId ?? ''}
            onChange={(e) => setSelectedCompanyId(Number(e.target.value) || null)}
            className="rounded-2xl border-0 bg-slate-100 px-4 py-3 text-sm outline-none"
          >
            <option value="">All companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={selectedRouteId ?? ''}
            onChange={(e) => setSelectedRouteId(Number(e.target.value) || null)}
            className="rounded-2xl border-0 bg-slate-100 px-4 py-3 text-sm outline-none"
          >
            <option value="">All routes</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select
            value={selectedShopId ?? ''}
            onChange={(e) => setSelectedShopId(Number(e.target.value) || null)}
            className="rounded-2xl border-0 bg-slate-100 px-4 py-3 text-sm outline-none"
          >
            <option value="">All shops</option>
            {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-2xl border-0 bg-slate-100 px-4 py-3 text-sm outline-none" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-2xl border-0 bg-slate-100 px-4 py-3 text-sm outline-none" />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-4">
            <button onClick={() => setDueOnly(!dueOnly)} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${dueOnly ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
              {dueOnly ? 'Showing Due Only' : 'Show All Sales'}
            </button>
            <button onClick={clearFilters} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600">Clear Filters</button>
          </div>
        </div>
      </PageCard>

      {/* Overview Stats */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Today Sales" value={formatCurrency(todaySales?.totalAmount ?? 0)} subValue={`${todaySales?.saleCount ?? 0} Invoices`} tone="indigo" />
        <SummaryCard label="Today Profit" value={formatCurrency(todayProfit?.totalProfit ?? 0)} subValue="Net Margin" tone="emerald" />
        <SummaryCard label="Monthly Sales" value={formatCurrency(monthlySales?.totalAmount ?? 0)} subValue={`Profit: ${formatCurrency(monthlySales?.totalProfit ?? 0)}`} tone="blue" />
        <SummaryCard label="Total Due" value={formatCurrency(dueOverview?.totalDue ?? 0)} subValue={`${dueOverview?.dueSaleCount ?? 0} Pending`} tone="rose" />
      </div>

      {/* Main Tables */}
      <div className="grid gap-6 xl:grid-cols-[1fr_350px]">
        <div className="space-y-6">
          <PageCard title="Recent Sales" description="Recent transactions based on your filters.">
            <SalesTable 
              sales={sales} 
              isFetching={isFetchingSales} 
              onDeleted={() => {
                // Refresh queries using React Query if possible, or just force reload
                window.location.reload();
              }}
            />
            <Pagination currentPage={salesPage} totalItems={salesTotalItems} pageSize={salesPageSize} onPageChange={setSalesPage} />
          </PageCard>
        </div>

        <div className="space-y-6">
          <PageCard title="Route Performance" action={<Pagination currentPage={routeSummaryPage} totalItems={routeSales.length} pageSize={summaryPageSize} onPageChange={setRouteSummaryPage} />}>
            <SummaryTable items={paginatedRouteSummary} labelKey="routeName" />
          </PageCard>

          <PageCard title="Company Performance" action={<Pagination currentPage={companySummaryPage} totalItems={companySales.length} pageSize={summaryPageSize} onPageChange={setCompanySummaryPage} />}>
            <SummaryTable items={paginatedCompanySummary} labelKey="companyName" />
          </PageCard>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3" ref={shopDueSectionRef}>
        <PageCard title="Due by Route" action={<Pagination currentPage={routeDuePage} totalItems={routeDue.length} pageSize={summaryPageSize} onPageChange={setRouteDuePage} />}>
          <DueSummaryTable items={paginatedRouteDueSummary} labelKey="routeName" />
        </PageCard>
        <PageCard title="Due by Shop" action={<Pagination currentPage={shopDuePage} totalItems={shopDue.length} pageSize={summaryPageSize} onPageChange={setShopDuePage} />}>
          <DueSummaryTable items={paginatedShopDueSummary} labelKey="shopName" />
        </PageCard>
        <PageCard title="Due by Company" action={<Pagination currentPage={companyDuePage} totalItems={companyDue.length} pageSize={summaryPageSize} onPageChange={setCompanyDuePage} />}>
          <DueSummaryTable items={paginatedCompanyDueSummary} labelKey="companyName" />
        </PageCard>
      </div>

      {isPrintModalOpen && (
        <PrintModal
          options={printOptions}
          setOptions={setPrintOptions}
          companies={companies}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  );
}

// Sub-components
function SummaryCard({ label, value, subValue, tone }: { label: string, value: string, subValue: string, tone: string }) {
  const tones: any = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    blue: 'bg-blue-50 border-blue-100 text-blue-900',
    rose: 'bg-rose-50 border-rose-100 text-rose-900',
  };
  return (
    <div className={`p-6 rounded-[32px] border ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
      <p className="text-2xl font-black mt-2">{value}</p>
      <p className="text-xs mt-1 opacity-60 font-bold">{subValue}</p>
    </div>
  );
}

function SalesTable({ sales, isFetching, onDeleted }: { sales: Sale[], isFetching: boolean, onDeleted: () => void }) {
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const { error: showErrorToast } = useToast();

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this sale? This will reverse stock movements and payments.')) return;
    setIsDeleting(id);
    try {
      await deleteSale(id);
      onDeleted();
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Failed to delete sale');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className={`overflow-x-auto ${isFetching ? 'opacity-50' : ''}`}>
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Customer / Route</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sales.map(sale => (
            <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-4">
                <Link href={`/sales/${sale.id}`} className="font-bold text-indigo-600 hover:underline">{sale.invoiceNo}</Link>
                <p className="text-[10px] text-slate-400">{sale.company?.name}</p>
              </td>
              <td className="px-4 py-4">
                <p className="font-bold text-slate-900">{sale.shop?.name ?? 'Direct Sale'}</p>
                <p className="text-[10px] text-slate-400">{sale.route?.name}</p>
              </td>
              <td className="px-4 py-4 font-bold text-slate-900">{formatCurrency(sale.totalAmount)}</td>
              <td className="px-4 py-4">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${toNumber(sale.dueAmount) > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {toNumber(sale.dueAmount) > 0 ? `Due: ${formatCurrency(sale.dueAmount)}` : 'Paid'}
                </span>
                <p className="text-[10px] text-slate-500 mt-1">{formatDate(sale.saleDate)}</p>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <Link 
                    href={`/sales/${sale.id}/edit`}
                    className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    title="Edit Sale"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                  <button 
                    onClick={() => handleDelete(sale.id)}
                    disabled={isDeleting === sale.id}
                    className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
                    title="Delete Sale"
                  >
                    {isDeleting === sale.id ? (
                       <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTable({ items, labelKey }: { items: any[], labelKey: string }) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
          <span className="text-xs font-bold text-slate-700">{item[labelKey]}</span>
          <span className="text-xs font-black text-slate-900">{formatCurrency(item.totalAmount)}</span>
        </div>
      ))}
    </div>
  );
}

function DueSummaryTable({ items, labelKey }: { items: any[], labelKey: string }) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-rose-50 border border-rose-100">
          <span className="text-xs font-bold text-rose-900">{item[labelKey]}</span>
          <span className="text-xs font-black text-rose-900">{formatCurrency(item.totalDue)}</span>
        </div>
      ))}
    </div>
  );
}

function PrintModal({ options, setOptions, companies, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl border border-slate-100">
        <h3 className="text-2xl font-black text-slate-900">Print Summary</h3>
        <p className="text-sm text-slate-500 mt-2">Configure your daily sales report.</p>

        <div className="mt-8 space-y-4">
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-slate-400">Date</span>
            <input type="date" value={options.date} onChange={e => setOptions({ ...options, date: e.target.value })} className="mt-1 w-full rounded-2xl bg-slate-100 px-4 py-3 outline-none" />
          </label>
          <div className="flex gap-2">
            <button onClick={() => setOptions({ ...options, scope: 'all' })} className={`flex-1 py-3 rounded-2xl text-xs font-bold ${options.scope === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>All Companies</button>
            <button onClick={() => setOptions({ ...options, scope: 'company' })} className={`flex-1 py-3 rounded-2xl text-xs font-bold ${options.scope === 'company' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Single Company</button>
          </div>
          {options.scope === 'company' && (
            <select value={options.companyId} onChange={e => setOptions({ ...options, companyId: e.target.value })} className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none">
              <option value="">Select Company</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        <div className="mt-10 flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">Cancel</button>
          <button onClick={() => window.open(`/sales/print?date=${options.date}&scope=${options.scope}${options.companyId ? `&companyId=${options.companyId}` : ''}`, '_blank')} className="flex-1 py-4 rounded-2xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200">Preview & Print</button>
        </div>
      </div>
    </div>
  );
}
