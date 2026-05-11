'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { StatCard } from '@/components/ui/stat-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToast } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { getDeliveryDashboard, getDispatchBatches } from '@/lib/api/delivery-ops';
import { useCompanies, useRoutes } from '@/hooks/use-common-queries';
import { batchStatusConfig, StatusBadge } from './delivery-ops-ui';
import type { DispatchBatch } from '@/types/api';
import { AlertCircle, ArrowUpRight, BarChart3, CheckCircle, CheckCircle2, CheckCircle2Icon, ClipboardList, DollarSign, Filter, HandCoins, History, MapPin, Package, Plus, Search, TrendingUp, Truck, Undo2, Wallet, ArrowLeft, LogOut, User } from 'lucide-react';



export function DeliveryOpsDashboardPage() {
  const { error: showErrorToast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [companyId, setCompanyId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [search, setSearch] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [batches, setBatches] = useState<DispatchBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [dashboardData, batchData] = await Promise.all([
        getDeliveryDashboard(date),
        getDispatchBatches({
          dispatchDate: date,
          companyId: companyId ? Number(companyId) : undefined,
          routeId: routeId ? Number(routeId) : undefined,
          search: search || undefined,
        }),
      ]);

      setDashboard(dashboardData);
      setBatches(batchData);
    } catch (error) {
      showErrorToast('Failed to load delivery operations dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date, companyId, routeId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">Delivery Operations</h1>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Manage your logistics & dispatch queue</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Link 
            href="/delivery-ops/fast-track" 
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Fast Track
          </Link>
          <Link 
            href="/delivery-ops/batches/new" 
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-wider hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Package className="h-3.5 w-3.5" /> New Batch
          </Link>
          <Link 
            href="/delivery-ops/reports" 
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
          >
            <BarChart3 className="h-3.5 w-3.5" /> Reports
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="modern-card">
        <div className="flex flex-col border-b border-border">
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-accent" /> Dispatch Queue
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-muted border-border hover:bg-secondary'
                  }`}
              >
                <Filter className="h-3 w-3" /> Filters
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="grid gap-6 border-t border-border p-6 md:grid-cols-3 animate-in fade-in slide-in-from-top-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Dispatch Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm focus:bg-white outline-none transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Company</label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm focus:bg-white outline-none"
                >
                  <option value="">All Companies</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Route</label>
                <select
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm focus:bg-white outline-none"
                >
                  <option value="">All Routes</option>
                  {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="px-6 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by batch ID or personnel name..."
                className="w-full rounded-xl border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/20 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-border">
                <th className="px-6 py-4">Batch Details</th>
                <th className="px-6 py-4">Personnel / Route</th>
                <th className="px-6 py-4 text-right">Dispatched</th>
                <th className="px-6 py-4 text-right">Sold (Final)</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <p className="text-xs font-bold text-muted">Scanning Queue...</p>
                    </div>
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16">
                    <StateMessage title="No batches found" description="Adjust your filters or initiate a new dispatch cycle." />
                  </td>
                </tr>
              ) : (
                batches.map((batch) => {
                  const config = batchStatusConfig[batch.status];
                  return (
                    <tr key={batch.id} className="group hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/delivery-ops/batches/${batch.id}`} className="text-sm font-bold text-foreground hover:text-accent transition-colors">
                          {batch.batchNo}
                        </Link>
                        <p className="mt-1 text-[10px] font-bold text-muted uppercase tracking-tight">
                          {batch.totalOrders} Order(s) · {formatDate(batch.dispatchDate)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-foreground">{batch.assignedDeliveryMan?.name || batch.deliveryPerson?.name}</p>
                        <p className="mt-1 text-[10px] font-bold text-muted uppercase tracking-tight flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {batch.route?.name}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-foreground">
                        {formatCurrency(batch.grossDispatchedValue)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">
                        {formatCurrency(batch.finalSoldValue || 0)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge {...config} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/delivery-ops/batches/${batch.id}`} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted hover:text-primary transition-colors">
                          Manage <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-border">
          {isLoading ? (
            <div className="px-6 py-10 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
              <p className="text-xs font-bold text-muted">Loading...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-muted">No batches found</p>
            </div>
          ) : (
            batches.map((batch) => {
              const config = batchStatusConfig[batch.status];
              return (
                <div key={batch.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Link href={`/delivery-ops/batches/${batch.id}`} className="text-xs font-black text-primary">
                      {batch.batchNo}
                    </Link>
                    <StatusBadge {...config} />
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-black text-foreground">{batch.assignedDeliveryMan?.name || batch.deliveryPerson?.name}</p>
                    <p className="text-[10px] font-bold text-muted flex items-center gap-1 uppercase tracking-tight">
                      <MapPin className="h-3 w-3" /> {batch.route?.name}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Dispatched</span>
                      <span className="text-sm font-black">{formatCurrency(batch.grossDispatchedValue)}</span>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Sold (Final)</span>
                      <span className="text-sm font-black text-emerald-600">{formatCurrency(batch.finalSoldValue || 0)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] font-bold text-muted uppercase">{batch.totalOrders} Order(s) · {formatDate(batch.dispatchDate)}</span>
                    <Link href={`/delivery-ops/batches/${batch.id}`} className="text-[10px] font-black uppercase tracking-widest text-primary px-3 py-1.5 bg-primary/5 rounded-lg">
                      Manage
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

