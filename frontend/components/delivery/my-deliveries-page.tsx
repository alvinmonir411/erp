'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Info,
  MapPin,
  Package,
  Phone,
  Search,
  Store,
  Truck,
  User,
} from 'lucide-react';
import { getDispatchBatches } from '@/lib/api/delivery-ops';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { StateMessage } from '@/components/ui/state-message';
import type { DispatchBatch, DispatchBatchOrder } from '@/types/api';

type DeliveryFilter = 'ASSIGNED' | 'DELIVERED' | undefined;

function isOrderCompleted(batchOrder: DispatchBatchOrder) {
  return batchOrder.isSettled || batchOrder.deliveryStatus === 'COMPLETED';
}

function batchMatchesFilter(batch: DispatchBatch, filterStatus: DeliveryFilter) {
  if (!filterStatus) return true;
  const orders = batch.orders || [];

  if (filterStatus === 'DELIVERED') {
    return orders.length > 0 && orders.every(isOrderCompleted);
  }

  return batch.status !== 'SETTLED' && orders.some((order) => !isOrderCompleted(order));
}

export function MyDeliveriesPage({ filterStatus }: { filterStatus?: string }) {
  const [batches, setBatches] = useState<DispatchBatch[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchMyBatches = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getDispatchBatches({
        search: search || undefined,
      });
      setBatches(data);
      if (data.length > 0) {
        setExpandedBatches((current) => current.size > 0 ? current : new Set([data[0].id]));
      }
    } catch (e: any) {
      console.error('Failed to fetch deliveries', e);
      setError(e.message || 'Failed to fetch deliveries. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBatches();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchMyBatches();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const toggleExpand = (id: number) => {
    setExpandedBatches((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredBatches = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    return batches
      .filter((batch) => batchMatchesFilter(batch, filterStatus as DeliveryFilter))
      .filter((batch) => {
        if (!normalizedSearch) return true;
        return (
          batch.batchNo.toLowerCase().includes(normalizedSearch) ||
          batch.route?.name?.toLowerCase().includes(normalizedSearch) ||
          batch.marketArea?.toLowerCase().includes(normalizedSearch) ||
          batch.orders?.some((batchOrder) => {
            const order = batchOrder.order;
            return (
              String(order?.id || batchOrder.orderId).padStart(6, '0').includes(normalizedSearch) ||
              order?.shop?.name?.toLowerCase().includes(normalizedSearch) ||
              order?.shop?.ownerName?.toLowerCase().includes(normalizedSearch) ||
              order?.shop?.phone?.toLowerCase().includes(normalizedSearch)
            );
          })
        );
      });
  }, [batches, filterStatus, search]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
              Field Delivery
            </p>
            <h1 className="mt-1 text-xl font-black text-foreground">My Assigned Deliveries</h1>
            <p className="mt-1 text-xs font-semibold text-muted">Today assigned batches and order results.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search shop, batch, order, phone..."
            className="h-12 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm font-medium outline-none transition-all focus:ring-4 focus:ring-blue-500/10"
          />
        </div>
        <button
          onClick={fetchMyBatches}
          className="rounded-xl bg-slate-900 px-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800 active:scale-95"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">Batches</p>
          <p className="mt-1 text-xl font-black text-slate-900">{filteredBatches.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">Orders</p>
          <p className="mt-1 text-xl font-black text-slate-900">
            {filteredBatches.reduce((sum, batch) => sum + (batch.orders?.length || 0), 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">Done</p>
          <p className="mt-1 text-xl font-black text-emerald-600">
            {filteredBatches.reduce((sum, batch) => sum + (batch.orders || []).filter(isOrderCompleted).length, 0)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="mt-4 text-sm font-bold text-muted">Loading your deliveries...</p>
          </div>
        ) : error ? (
          <StateMessage title="Failed to load deliveries" description={error} />
        ) : filteredBatches.length === 0 ? (
          <StateMessage
            title="No assigned deliveries found"
            description="You do not have any matching delivery batches assigned right now."
          />
        ) : (
          filteredBatches.map((batch) => {
            const isExpanded = expandedBatches.has(batch.id);
            const completedOrders = (batch.orders || []).filter(isOrderCompleted).length;

            return (
              <div key={batch.id} className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleExpand(batch.id)}
                  className="flex w-full flex-col gap-4 p-4 text-left transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-blue-600">{batch.batchNo}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-700">
                        {batch.status.replace(/_/g, ' ')}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                        {completedOrders}/{batch.orders?.length || batch.totalOrders} Done
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold uppercase tracking-tight text-muted">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {batch.marketArea || batch.route?.name || 'No route'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatDate(batch.dispatchDate)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" /> {batch.assignedDeliveryMan?.name || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Total Value</p>
                      <p className="text-base font-black text-slate-900">
                        {formatCurrency(Number(batch.grossDispatchedValue || 0))}
                      </p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="divide-y divide-border border-t border-border bg-slate-50/30">
                    {batch.orders?.map((batchOrder) => {
                      const order = batchOrder.order;
                      const orderId = order?.id || batchOrder.orderId;
                      if (!orderId) return null;
                      const completed = isOrderCompleted(batchOrder);

                      return (
                        <Link
                          key={batchOrder.id}
                          href={`/my-deliveries/orders/${orderId}`}
                          className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-white"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white">
                              <Store className="h-4 w-4 text-slate-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-black text-slate-900">
                                  {order?.shop?.name || 'Unknown shop'}
                                </p>
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                  completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {completed ? 'Completed' : 'Pending'}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[10px] font-bold uppercase text-muted">
                                Order #{String(orderId).padStart(6, '0')}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500">
                                <span>{order?.shop?.ownerName || 'No owner'}</span>
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {order?.shop?.phone || 'No phone'}
                                </span>
                                <span className="line-clamp-1">{order?.shop?.address || 'No address'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs font-black text-slate-900">
                                {formatCurrency(Number(batchOrder.finalSoldAmount || batchOrder.estimatedAmount || 0))}
                              </p>
                              <p className="text-[9px] font-bold uppercase text-muted">
                                Due {formatCurrency(Number(batchOrder.dueAmount || 0))}
                              </p>
                            </div>
                            {completed ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-300" />
                            )}
                          </div>
                        </Link>
                      );
                    })}

                    {batch.note && (
                      <div className="flex items-start gap-2 border-t border-blue-100/50 bg-blue-50/30 px-5 py-3">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                        <p className="text-xs font-medium text-slate-600">{batch.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
