'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCompanies, useRoutes, useShops } from '@/hooks/use-common-queries';
import { useSalesList } from '@/hooks/use-sales-queries';
import { PageCard } from '@/components/ui/page-card';
import { Pagination } from '@/components/ui/pagination';
import { StateMessage } from '@/components/ui/state-message';
import { useToast } from '@/components/ui/toast-provider';
import { deleteSale } from '@/lib/api/sales';
import { formatCurrency, formatDate, toNumber } from '@/lib/utils/format';
import Link from 'next/link';
import { 
  Search, Calendar, Building2, MapPin, 
  Store, Trash2, Edit3, ChevronRight, Download,
  ShoppingCart, Package, Truck
} from 'lucide-react';

const PAGE_SIZE = 15;

function getFilterDateTime(value: string, boundary: 'start' | 'end') {
  if (!value) return undefined;
  // Using local time boundary (no Z) to match SalesPage logic
  const time = boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999';
  return new Date(`${value}${time}`).toISOString();
}

export function OrdersListPage() {
  const searchParams = useSearchParams();
  const { error: showErrorToast, success: showSuccessToast } = useToast();

  // Filter States
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [companyId, setCompanyId] = useState<number | null>(() => {
    const id = searchParams.get('companyId');
    return id ? Number(id) : null;
  });
  const [routeId, setRouteId] = useState<number | null>(() => {
    const id = searchParams.get('routeId');
    return id ? Number(id) : null;
  });
  const [shopId, setShopId] = useState<number | null>(() => {
    const id = searchParams.get('shopId');
    return id ? Number(id) : null;
  });
  const [fromDate, setFromDate] = useState(() => searchParams.get('fromDate') || '');
  const [toDate, setToDate] = useState(() => searchParams.get('toDate') || '');
  const [dueOnly, setDueOnly] = useState(() => searchParams.get('dueOnly') === 'true');
  const [page, setPage] = useState(() => {
    const p = searchParams.get('page');
    return p ? Number(p) : 1;
  });

  // Queries
  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();
  const { data: shops = [] } = useShops(routeId);

  const query = useMemo(() => ({
    search: searchTerm.trim() || undefined,
    companyId: companyId ?? undefined,
    routeId: routeId ?? undefined,
    shopId: shopId ?? undefined,
    fromDate: fromDate ? getFilterDateTime(fromDate, 'start') : undefined,
    toDate: toDate ? getFilterDateTime(toDate, 'end') : undefined,
    dueOnly: dueOnly || undefined,
    page,
    limit: PAGE_SIZE,
  }), [searchTerm, companyId, routeId, shopId, fromDate, toDate, dueOnly, page]);

  const { data, isFetching, refetch } = useSalesList(query);
  const sales = data?.items ?? [];
  const totalItems = data?.totalItems ?? 0;

  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this order? This will reverse stock and payments.')) return;
    setIsDeleting(id);
    try {
      await deleteSale(id);
      showSuccessToast('Order deleted successfully');
      refetch();
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Failed to delete order');
    } finally {
      setIsDeleting(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCompanyId(null);
    setRouteId(null);
    setShopId(null);
    setFromDate('');
    setToDate('');
    setDueOnly(false);
    setPage(1);
  };

  useEffect(() => {
    const s = searchParams.get('search');
    setSearchTerm(s || '');

    const cid = searchParams.get('companyId');
    setCompanyId(cid ? Number(cid) : null);

    const rid = searchParams.get('routeId');
    setRouteId(rid ? Number(rid) : null);

    const sid = searchParams.get('shopId');
    setShopId(sid ? Number(sid) : null);

    setFromDate(searchParams.get('fromDate') || '');
    setToDate(searchParams.get('toDate') || '');
    setDueOnly(searchParams.get('dueOnly') === 'true');

    const p = searchParams.get('page');
    setPage(p ? Number(p) : 1);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      {/* Header & Main Navigation Hub */}
      <div className="grid gap-6 md:grid-cols-3">
        {[
          { 
            href: '/sales/create', 
            label: 'New Order', 
            desc: 'Create a new customer invoice', 
            icon: ShoppingCart, 
            color: 'bg-indigo-600 shadow-indigo-200' 
          },
          { 
            href: '/delivery-summaries/create', 
            label: 'Morning Prep', 
            desc: 'Aggregate today\'s orders', 
            icon: Package, 
            color: 'bg-amber-500 shadow-amber-200' 
          },
          { 
            href: '/delivery-summaries', 
            label: 'Delivery List', 
            desc: 'View & finalize summaries', 
            icon: Truck, 
            color: 'bg-slate-900 shadow-slate-200' 
          },
        ].map((btn) => (
          <Link
            key={btn.href}
            href={btn.href}
            className={`group relative overflow-hidden rounded-[2rem] p-6 text-white shadow-xl transition-all hover:-translate-y-1 ${btn.color}`}
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex rounded-2xl bg-white/20 p-3 backdrop-blur-md">
                <btn.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black">{btn.label}</h3>
              <p className="mt-1 text-sm font-medium opacity-80">{btn.desc}</p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 transition-transform group-hover:scale-110">
              <btn.icon className="h-32 w-32" />
            </div>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Order History</h2>
          <p className="text-sm text-slate-500">Track delivery status and payments for all orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50">
            <Download className="h-4 w-4" /> Export Data
          </button>
        </div>
      </div>

      <PageCard>
        {/* Filters Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice..."
              className="w-full rounded-2xl border-0 bg-slate-100 pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={companyId ?? ''}
              onChange={(e) => setCompanyId(Number(e.target.value) || null)}
              className="w-full appearance-none rounded-2xl border-0 bg-slate-100 pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Companies</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={routeId ?? ''}
              onChange={(e) => setRouteId(Number(e.target.value) || null)}
              className="w-full appearance-none rounded-2xl border-0 bg-slate-100 pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Routes</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="relative">
            <Store className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={shopId ?? ''}
              onChange={(e) => setShopId(Number(e.target.value) || null)}
              className="w-full appearance-none rounded-2xl border-0 bg-slate-100 pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Shops</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-2xl border-0 bg-slate-100 pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-2xl border-0 bg-slate-100 pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
          <div className="flex gap-3">
            <button
              onClick={() => setDueOnly(!dueOnly)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                dueOnly ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dueOnly ? 'Showing Due Only' : 'Show All Payments'}
            </button>
            <button
              onClick={clearFilters}
              className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-200"
            >
              Clear All
            </button>
          </div>
          <p className="text-xs font-medium text-slate-400">
            Showing <span className="font-bold text-slate-700">{sales.length}</span> of <span className="font-bold text-slate-700">{totalItems}</span> orders
          </p>
        </div>
      </PageCard>

      <PageCard noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Invoice / Date</th>
                <th className="px-6 py-4">Company / Route</th>
                <th className="px-6 py-4">Shop Name</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isFetching && sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <p className="text-sm font-medium text-slate-500">Loading orders...</p>
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <StateMessage title="No orders found" description="Try adjusting your filters to find what you are looking for." />
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="group transition-colors hover:bg-slate-50/70">
                    <td className="px-6 py-4">
                      <Link href={`/sales/${sale.id}`} className="block font-black text-slate-900 group-hover:text-indigo-600">
                        {sale.invoiceNo}
                      </Link>
                      <p className="mt-1 text-xs font-medium text-slate-400">{formatDate(sale.saleDate)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700">{sale.company?.name}</p>
                      <p className="text-xs font-medium text-slate-400">{sale.route?.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700">{sale.shop?.name ?? 'Direct Sale'}</p>
                      <p className="text-xs font-medium text-slate-400">{sale.shop?.phone ?? '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-slate-900">{formatCurrency(sale.totalAmount)}</p>
                      {toNumber(sale.dueAmount) > 0 && (
                        <p className="text-[10px] font-bold text-rose-600">Due: {formatCurrency(sale.dueAmount)}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                          toNumber(sale.dueAmount) > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {toNumber(sale.dueAmount) > 0 ? 'Partial/Due' : 'Paid'}
                        </span>
                        {sale.deliveryStatus === 'DELIVERED' ? (
                          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-black uppercase text-indigo-700">Delivered</span>
                        ) : sale.deliveryStatus === 'SHIPPED' ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">Shipped</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-400">Pending</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/sales/${sale.id}/edit`}
                          className="rounded-xl bg-slate-100 p-2.5 text-slate-600 transition-all hover:bg-slate-200 hover:text-indigo-600"
                          title="Edit Order"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(sale.id)}
                          disabled={isDeleting === sale.id}
                          className="rounded-xl bg-rose-50 p-2.5 text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-50"
                          title="Delete Order"
                        >
                          {isDeleting === sale.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                        <Link
                          href={`/sales/${sale.id}`}
                          className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 transition-all hover:bg-indigo-100"
                          title="View Details"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <Pagination
            currentPage={page}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </PageCard>
    </div>
  );
}
