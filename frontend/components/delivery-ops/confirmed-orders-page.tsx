'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, MapPin, Search, Store, Truck, ArrowLeft, Filter, ChevronDown, ChevronUp, Layers, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToast } from '@/components/ui/toast-provider';
import { useCompanies, useRoutes } from '@/hooks/use-common-queries';
import { getEligibleDispatchOrders } from '@/lib/api/delivery-ops';
import { formatCurrency, formatDate, formatNumber, getTodayBDDate } from '@/lib/utils/format';
import type { Order } from '@/types/api';
import { orderStatusConfig, StatusBadge } from './delivery-ops-ui';

export function ConfirmedOrdersPage() {
  const router = useRouter();
  const { error: showErrorToast } = useToast();
  const [date, setDate] = useState(() => getTodayBDDate());
  const [companyId, setCompanyId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/delivery-ops');
    }
  };

  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const data = await getEligibleDispatchOrders({
        dispatchDate: date,
        companyId: companyId ? Number(companyId) : undefined,
        routeId: routeId ? Number(routeId) : undefined,
        search: search || undefined,
      });
      setOrders(data);
    } catch (error) {
      showErrorToast('Failed to load dispatch-ready orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [date, companyId, routeId]);

  useEffect(() => {
    const timer = setTimeout(() => fetchOrders(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const summaries = useMemo(() => {
    const totalValue = orders.reduce((sum, order) => sum + Number(order.grandTotal), 0);
    const totalQty = orders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce(
          (itemSum, item) => itemSum + Number(item.quantity) + Number(item.freeQuantity || 0),
          0,
        ),
      0,
    );

    return {
      totalValue,
      totalQty,
    };
  }, [orders]);

  return (
    <div className="space-y-6 pb-24">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white px-4 py-3 border-b border-slate-100 lg:hidden">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 font-bold text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-slate-900">Queue</h1>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-xl transition-colors ${showFilters ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      <div className="hidden lg:flex lg:flex-row lg:items-end lg:justify-between pt-4 lg:pt-0">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700">
            Dispatch Preparation
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            Confirmed Orders Queue
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Review dispatch-eligible orders before grouping them into a single morning batch.
          </p>
        </div>
        <Link
          href="/delivery-ops/batches/new"
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
        >
          Create Batch
        </Link>
      </div>

      <div className={`${showFilters ? 'block' : 'hidden'} lg:block pt-12 lg:pt-0`}>
        <PageCard>
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Order Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Company
              </label>
              <select
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Route
              </label>
              <select
                value={routeId}
                onChange={(event) => setRouteId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition"
              >
                <option value="">All Routes</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Shop, area, note"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition"
                />
              </div>
            </div>
          </div>
        </PageCard>
      </div>

      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-50 rounded-xl"><Layers className="h-4 w-4 text-slate-400" /></div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Orders Ready</p>
                <h3 className="text-xl font-black text-slate-900">{orders.length}</h3>
             </div>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-cyan-50 rounded-xl"><Truck className="h-4 w-4 text-cyan-600" /></div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Qty</p>
                <h3 className="text-lg font-black text-slate-900">{formatNumber(summaries.totalQty)}</h3>
             </div>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-50 rounded-xl"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Value</p>
                <h3 className="text-lg font-black text-emerald-700 truncate">{formatCurrency(summaries.totalValue)}</h3>
             </div>
          </div>
        </div>
      </div>

      <PageCard noPadding className="hidden lg:block">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <th className="px-6 py-4">Order</th>
                <th className="px-6 py-4">Network</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4 text-center">Dispatch Qty</th>
                <th className="px-6 py-4 text-right">Value</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm font-medium text-slate-400">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16">
                    <StateMessage
                      title="No confirmed orders"
                      description="No eligible orders are available for the selected filters or date."
                    />
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const config = orderStatusConfig[order.status];
                  const totalQty = order.items.reduce(
                    (sum, item) => sum + Number(item.quantity) + Number(item.freeQuantity || 0),
                    0,
                  );

                  return (
                    <tr key={order.id} className="transition hover:bg-slate-50/60">
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-slate-900">
                          #{String(order.id).padStart(6, '0')}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-400">
                          {formatDate(order.orderDate)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <Building2 className="h-4 w-4 text-slate-300" />
                          {order.company?.name}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-400">
                          <MapPin className="h-4 w-4 text-slate-300" />
                          {order.route?.name}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <Store className="h-4 w-4 text-slate-300" />
                          {order.shop?.name || 'Direct Order'}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-400">
                          <Truck className="h-4 w-4 text-slate-300" />
                          {order.marketArea || 'Market area not tagged'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-black text-slate-900">
                        {formatNumber(totalQty)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">
                        {formatCurrency(Number(order.grandTotal))}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge {...config} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </PageCard>

      {/* Mobile Card List */}
      <div className="lg:hidden space-y-4">
        {isLoading ? (
          <div className="py-20 text-center text-sm font-bold text-slate-400">Loading queue...</div>
        ) : orders.length === 0 ? (
          <div className="py-20 bg-white rounded-[2rem] border border-slate-100">
            <StateMessage
              title="Queue is empty"
              description="No dispatch-eligible orders found."
            />
          </div>
        ) : (
          orders.map((order) => {
            const config = orderStatusConfig[order.status];
            const totalQty = order.items.reduce(
              (sum, item) => sum + Number(item.quantity) + Number(item.freeQuantity || 0),
              0,
            );

            return (
              <div key={order.id} className="bg-white rounded-3xl border border-slate-100 p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xs font-black">
                         #{String(order.id).slice(-4)}
                      </div>
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatDate(order.orderDate)}</p>
                         <p className="font-black text-slate-900">#{String(order.id).padStart(6, '0')}</p>
                      </div>
                   </div>
                   <StatusBadge {...config} />
                </div>

                <div className="space-y-2 py-2">
                   <div className="flex items-start gap-3">
                      <Store className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div>
                         <p className="text-sm font-black text-slate-900 leading-none">{order.shop?.name || 'Direct Order'}</p>
                         <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tight">{order.marketArea || 'No area'}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <p className="text-xs font-bold text-slate-600">{order.company?.name} · {order.route?.name}</p>
                   </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grand Total</p>
                      <p className="text-lg font-black text-emerald-600">{formatCurrency(Number(order.grandTotal))}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dispatch Qty</p>
                      <p className="text-lg font-black text-slate-900">{formatNumber(totalQty)}</p>
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Bottom Button for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 lg:hidden z-40">
        <Link
          href="/delivery-ops/batches/new"
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-slate-900 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl"
        >
          <Truck className="h-4 w-4" />
          Create Dispatch Batch
        </Link>
      </div>
    </div>
  );
}
