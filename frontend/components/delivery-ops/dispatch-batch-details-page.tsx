'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  HandCoins,
  PackageCheck,
  Printer,
  Save,
  Send,
  ShieldAlert,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';
import { PageCard } from '@/components/ui/page-card';
import { useToast } from '@/components/ui/toast-provider';
import {
  getDispatchBatch,
  getFinalDispatchReport,
  getMorningDispatchReport,
  markBatchDispatched,
  markMorningPrinted,
  recordBatchReturns,
  settleDispatchBatch,
} from '@/lib/api/delivery-ops';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';
import type { DispatchBatch } from '@/types/api';
import { batchStatusConfig, orderStatusConfig, StatusBadge } from './delivery-ops-ui';
import { PrintSummary } from './print-summary';
import { DueModal } from './due-modal';

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    a %= b;
    [a, b] = [b, a];
  }
  return a;
};

const getBundleSize = (paid: number, free: number): number => {
  if (!free || free === 0) return 1;
  const common = gcd(paid, free);
  return (paid / common) + (free / common);
};

export function DispatchBatchDetailsPage({ id }: { id: string }) {
  const router = useRouter();
  const batchId = Number(id);
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [batch, setBatch] = useState<DispatchBatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingReturns, setIsSavingReturns] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [activeTab, setActiveTab] = useState<'sheet' | 'entry' | 'settle'>('sheet');
  const [batchReturnState, setBatchReturnState] = useState<Record<number, { returned: string; damaged: string }>>({});
  const [draftDues, setDraftDues] = useState<Record<number, number>>({});
  const [dueModalProduct, setDueModalProduct] = useState<{ id: number; name: string } | null>(null);

  // No print logic here anymore, handled by dedicated routes

  // Aggregate items across all orders in the batch
  const aggregatedItems = useMemo(() => {
    if (!batch) return [];
    const map = new Map<number, { productId: number; name: string; unit: string; totalQty: number; totalPaidQty: number; price: number }>();
    batch.orders.forEach(bo => {
      bo.order.items.forEach(item => {
        const existing = map.get(item.productId);
        const qty = Number(item.quantity) + Number(item.freeQuantity || 0);
        const paidQty = Number(item.quantity);
        if (existing) {
          existing.totalQty += qty;
          existing.totalPaidQty += paidQty;
        } else {
          map.set(item.productId, {
            productId: item.productId,
            name: item.product.name,
            unit: item.product.unit,
            totalQty: qty,
            totalPaidQty: paidQty,
            price: Number(item.unitPrice)
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [batch]);

  // Initialize return state from aggregated items
  useEffect(() => {
    if (batch && aggregatedItems.length > 0) {
      const initialState: Record<number, { returned: string; damaged: string }> = {};
      aggregatedItems.forEach(item => {
        // Try to find existing returns from the batch data if available
        let returned = 0;
        let damaged = 0;
        batch.orders.forEach(bo => {
          const boItem = bo.order.items.find(i => i.productId === item.productId);
          if (boItem) {
            returned += Number(boItem.returnedQuantity || 0);
            damaged += Number(boItem.damagedQuantity || 0);
          }
        });
        initialState[item.productId] = {
          returned: String(returned),
          damaged: String(damaged)
        };
      });
      setBatchReturnState(initialState);
    }
  }, [batch, aggregatedItems]);
  const finalMetrics = useMemo(() => {
    if (!batch || aggregatedItems.length === 0) return null;
    let totalOrder = 0;
    let totalReturned = 0;
    let totalDamaged = 0;
    let totalAmount = 0;

    aggregatedItems.forEach(item => {
      const state = batchReturnState[item.productId] || { returned: '0', damaged: '0' };
      const ret = Number(state.returned || 0);
      const dam = Number(state.damaged || 0);
      const delivered = Math.max(0, item.totalQty - ret - dam);
      
      const ratio = item.totalQty > 0 ? (item.totalPaidQty / item.totalQty) : 0;
      const deliveredPaid = delivered * ratio;

      totalOrder += item.totalQty;
      totalReturned += ret;
      totalDamaged += dam;
      totalAmount += deliveredPaid * item.price;
    });

    const totalDueDraft = Object.values(draftDues).reduce((sum, val) => sum + val, 0);
    const cashCollectable = Math.max(0, totalAmount - totalDueDraft);

    return { totalOrder, totalReturned, totalDamaged, totalSold: totalOrder - totalReturned - totalDamaged, totalAmount, totalDueDraft, cashCollectable };
  }, [batch, aggregatedItems, batchReturnState, draftDues]);

  const fetchBatch = async () => {
    try {
      setIsLoading(true);
      const data = await getDispatchBatch(batchId);
      setBatch(data);
    } catch (error) {
      showErrorToast('Failed to load dispatch batch');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatch();
  }, [batchId]);

  const batchStatus = batch ? batchStatusConfig[batch.status] : null;

  const handlePrintMorning = async () => {
    try {
      await markMorningPrinted(batchId);
      window.open(`/delivery-ops/batches/${batchId}/print-morning-summary`, "_blank");
      fetchBatch();
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to print morning summary');
    }
  };
  
  const handlePrintFieldSheet = async () => {
    window.open(`/delivery-ops/batches/${batchId}/print-field-sheet`, "_blank");
  };

  const handlePrintFinalSettlement = async () => {
    const draftQuery = encodeURIComponent(JSON.stringify(draftDues));
    window.open(`/delivery-ops/batches/${batchId}/print-final-settlement?draftDues=${draftQuery}`, "_blank");
  };

  const handleDispatch = async () => {
    try {
      await markBatchDispatched(batchId);
      showSuccessToast('Batch dispatched successfully');
      fetchBatch();
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to dispatch batch');
    }
  };

  const handleSaveReturns = async () => {
    if (!batch) return;

    const productBundleSizes: Record<number, number> = {};
    for (const item of aggregatedItems) {
      const state = batchReturnState[item.productId] || { returned: '0', damaged: '0' };
      const returned = Number(state.returned || 0);
      const damaged = Number(state.damaged || 0);
      const totalReturn = returned + damaged;

      // Find bundle size from order items
      let bundleSize = 1;
      for (const bo of batch.orders) {
        const oi = bo.order.items.find((i) => i.productId === item.productId);
        if (oi && Number(oi.freeQuantity) > 0) {
          bundleSize = getBundleSize(Number(oi.quantity), Number(oi.freeQuantity));
          break;
        }
      }
      productBundleSizes[item.productId] = bundleSize;

      if (returned < 0 || damaged < 0) {
        showErrorToast(`Negative values are not allowed for ${item.name}`);
        return;
      }

      if (totalReturn > item.totalQty) {
        showErrorToast(
          `Total returns (${totalReturn}) for ${item.name} cannot exceed total dispatched quantity (${item.totalQty})`,
        );
        return;
      }

      if (totalReturn % bundleSize !== 0) {
        showErrorToast(
          `Return quantity for ${item.name} must include the matching free product for this offer.`,
        );
        return;
      }
    }

    // Distribute returns to individual orders in multiples of bundle size
    const remainingReturned: Record<number, number> = {};
    const remainingDamaged: Record<number, number> = {};
    Object.entries(batchReturnState).forEach(([pid, s]) => {
      remainingReturned[Number(pid)] = Number(s.returned || 0);
      remainingDamaged[Number(pid)] = Number(s.damaged || 0);
    });

    const ordersToUpdate = batch.orders.map((bo) => {
      return {
        orderId: bo.orderId,
        items: bo.order.items.map((item) => {
          const bSize = productBundleSizes[item.productId] || 1;
          const dispatchedInThisOrder = Number(item.quantity) + Number(item.freeQuantity || 0);

          let orderReturned = 0;
          if (remainingReturned[item.productId] > 0) {
            const canTake = Math.min(remainingReturned[item.productId], dispatchedInThisOrder);
            orderReturned = Math.floor(canTake / bSize) * bSize;
            remainingReturned[item.productId] -= orderReturned;
          }

          let orderDamaged = 0;
          if (remainingDamaged[item.productId] > 0) {
            const canTake = Math.min(
              remainingDamaged[item.productId],
              dispatchedInThisOrder - orderReturned,
            );
            orderDamaged = Math.floor(canTake / bSize) * bSize;
            remainingDamaged[item.productId] -= orderDamaged;
          }

          return {
            productId: item.productId,
            dispatchedQuantity: dispatchedInThisOrder,
            returnedQuantity: orderReturned,
            damagedQuantity: orderDamaged,
          };
        }),
      };
    });

    try {
      setIsSavingReturns(true);
      await recordBatchReturns(batchId, { orders: ordersToUpdate });
      showSuccessToast('Returns recorded successfully');
      fetchBatch();
      setActiveTab('settle');
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to save returns');
    } finally {
      setIsSavingReturns(false);
    }
  };

  const handleSettle = async () => {
    if (!batch || !finalMetrics) return;

    try {
      setIsSettling(true);
      
      // Complete Settlement
      await settleDispatchBatch(batchId, {
        collections: batch.orders.map((batchOrder) => {
          const draftDue = draftDues[batchOrder.orderId] || 0;
          const finalAmount = Number(batchOrder.finalSoldAmount || 0);
          return {
            orderId: batchOrder.orderId,
            collectedAmount: Math.max(0, finalAmount - draftDue),
            paymentMode: 'CASH',
          };
        }),
      });
      
      showSuccessToast('Batch marked as settled and dues recorded');
      setDraftDues({});
      fetchBatch();
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to settle batch');
    } finally {
      setIsSettling(false);
    }
  };


  if (isLoading) {
    return <div className="p-8 text-center text-sm font-medium text-slate-400">Loading batch...</div>;
  }

  if (!batch || !batchStatus) {
    return <div className="p-8 text-center text-sm font-medium text-slate-400">Batch not found.</div>;
  }

  const tabs = [
    { id: 'sheet', label: '1. Field Sheet (View)' },
    { id: 'entry', label: '2. Return Entry (Edit)' },
  ] as const;

  return (
    <div className="space-y-6 pb-20">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}} />
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white px-4 py-3 border-b border-slate-100 lg:hidden">
        <button
          onClick={() => router.push('/delivery-ops')}
          className="flex items-center gap-2 font-bold text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-slate-900">{batch.batchNo}</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between pt-12 lg:pt-0">
        <div className="flex items-start gap-4">
          <Link
            href="/delivery-ops"
            className="hidden lg:flex rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
                {batch.batchNo}
              </h1>
              <StatusBadge {...batchStatus} />
            </div>
            <p className="mt-2 text-xs lg:text-sm font-medium text-slate-500">
              {formatDate(batch.dispatchDate)} · {batch.deliveryPerson.name} · {batch.route.name}
            </p>
            {batch.status === 'SETTLED' && (
              <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                <ShieldAlert className="h-3 w-3" />
                Locked after settlement
              </div>
            )}
          </div>
        </div>

        {batch.status === 'DRAFT' && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handlePrintMorning()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Morning Sheet
            </button>
            <button
              onClick={handleDispatch}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-amber-200 transition hover:bg-amber-600"
            >
              <Send className="h-4 w-4" />
              Dispatch to Field
            </button>
          </div>
        )}

        {['DISPATCHED', 'RETURN_PENDING', 'PARTIALLY_SETTLED', 'SETTLED'].includes(batch.status) && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePrintFinalSettlement}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-900 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Print Final Settlement
            </button>
          </div>
        )}
      </div>

      <div className="flex space-x-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sheet' && (
        <PageCard 
          title="Field Delivery Sheet" 
          description="Consolidated view for field record keeping."
          action={
            <button
              onClick={handlePrintFieldSheet}
              className="hidden lg:flex rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <span className="inline-flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Print Field Sheet
              </span>
            </button>
          }
          noPadding
        >
          <div className="hidden lg:block overflow-x-auto">
            {aggregatedItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold">No products in this batch</div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-6 py-4 text-center w-16">SL</th>
                    <th className="px-6 py-4 text-left">Product Name</th>
                    <th className="px-6 py-4 text-center w-24">Qty</th>
                    <th className="px-6 py-4 text-center w-24">Return</th>
                    <th className="px-6 py-4 text-center w-24">Sales</th>
                    <th className="px-6 py-4 text-center w-24">Price</th>
                    <th className="px-6 py-4 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {aggregatedItems.map((item, index) => (
                    <tr key={item.productId} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{item.name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-black text-slate-700">
                          {formatNumber(item.totalQty)}
                        </span>
                      </td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4 text-center font-medium text-slate-400">{formatCurrency(item.price)}</td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile Field Sheet View */}
          <div className="lg:hidden divide-y divide-slate-100">
            {aggregatedItems.map((item, index) => (
              <div key={item.productId} className="p-4 space-y-3">
                 <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                       <span className="text-xs font-black text-slate-300">{index + 1}</span>
                       <p className="font-bold text-slate-900">{item.name}</p>
                    </div>
                    <p className="text-xs font-black text-slate-400">{item.unit}</p>
                 </div>
                 <div className="flex items-center justify-between">
                    <div className="bg-slate-100 rounded-xl px-4 py-2">
                       <p className="text-[8px] font-black uppercase text-slate-400">Target Qty</p>
                       <p className="text-lg font-black text-slate-900">{formatNumber(item.totalQty)}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] font-black uppercase text-slate-400">Unit Price</p>
                       <p className="text-sm font-bold text-slate-600">{formatCurrency(item.price)}</p>
                    </div>
                 </div>
              </div>
            ))}
            {aggregatedItems.length === 0 && <div className="p-12 text-center text-slate-400 font-bold">No products</div>}
          </div>
        </PageCard>
      )}

      {activeTab === 'entry' && (
        <PageCard 
          title="Return Entry" 
          description="Enter actual field returns and damages."
          className="lg:no-padding"
          action={
            <div className="hidden lg:flex gap-2">
              <button
                onClick={handleSaveReturns}
                disabled={isSavingReturns || batch.status === 'SETTLED' || !['DISPATCHED', 'RETURN_PENDING', 'PARTIALLY_SETTLED'].includes(batch.status)}
                className="rounded-2xl bg-cyan-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-200 disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none"
              >
                <span className="inline-flex items-center gap-2">
                  {isSavingReturns ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {batch.status === 'SETTLED' ? 'Locked' : 'Save Returns'}
                </span>
              </button>
            </div>
          }
          noPadding
        >
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4 text-center w-16">SL</th>
                  <th className="px-6 py-4 text-left">Product Name</th>
                  <th className="px-6 py-4 text-center w-24">Qty</th>
                  <th className="px-6 py-4 text-center w-32">Returned</th>
                  <th className="px-6 py-4 text-center w-32">Damaged</th>
                  <th className="px-6 py-4 text-center w-24">Delivered</th>
                  <th className="px-6 py-4 text-center w-24">Due</th>
                  <th className="px-6 py-4 text-center w-24">Cash</th>
                  <th className="px-6 py-4 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {aggregatedItems.map((item, index) => {
                  const state = batchReturnState[item.productId] || { returned: '0', damaged: '0' };
                  const deliveredQty = item.totalQty - Number(state.returned || 0) - Number(state.damaged || 0);
                  
                  return (
                    <tr key={item.productId} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{item.name}</td>
                      <td className="px-6 py-4 text-center font-black text-slate-700">
                        {formatNumber(item.totalQty)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.totalQty}
                          value={state.returned}
                          disabled={batch.status === 'SETTLED'}
                          onChange={(e) => setBatchReturnState(prev => ({
                            ...prev,
                            [item.productId]: { ...state, returned: e.target.value }
                          }))}
                          className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center font-black text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/10 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.totalQty}
                          value={state.damaged}
                          disabled={batch.status === 'SETTLED'}
                          onChange={(e) => setBatchReturnState(prev => ({
                            ...prev,
                            [item.productId]: { ...state, damaged: e.target.value }
                          }))}
                          className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center font-black text-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/10 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`rounded-xl px-3 py-2 font-black ${deliveredQty < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {formatNumber(Math.max(0, deliveredQty))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         {/* Aggregating draft dues for this item's associated orders */}
                         <div className="font-black text-amber-600">
                            {formatCurrency(batch.orders
                              .filter(bo => bo.order.items.some(i => i.productId === item.productId))
                              .reduce((sum, bo) => sum + (draftDues[bo.orderId] || 0), 0)
                            )}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className="font-black text-emerald-600">
                            {formatCurrency(Math.max(0, 
                               (deliveredQty * (item.totalPaidQty / (item.totalQty || 1)) * item.price) - 
                               batch.orders
                                .filter(bo => bo.order.items.some(i => i.productId === item.productId))
                                .reduce((sum, bo) => sum + (draftDues[bo.orderId] || 0), 0)
                            ))}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setDueModalProduct({ id: item.productId, name: item.name })}
                          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black uppercase text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          {batch.orders.some(bo => bo.order.items.some(i => i.productId === item.productId) && draftDues[bo.orderId] > 0) ? 'Edit Due' : 'Due'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Entry Form */}
          <div className="lg:hidden divide-y divide-slate-100">
            {aggregatedItems.map((item, index) => {
              const state = batchReturnState[item.productId] || { returned: '0', damaged: '0' };
              const deliveredQty = item.totalQty - Number(state.returned || 0) - Number(state.damaged || 0);
              return (
                <div key={item.productId} className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <div className="bg-slate-100 rounded-lg px-2 py-1 text-[10px] font-black text-slate-500 uppercase">
                      Target: {formatNumber(item.totalQty)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400">Returned</label>
                        <input
                          type="number"
                          value={state.returned}
                          disabled={batch.status === 'SETTLED'}
                          onChange={(e) => setBatchReturnState(prev => ({
                            ...prev,
                            [item.productId]: { ...state, returned: e.target.value }
                          }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-black text-rose-600 outline-none disabled:opacity-50"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400">Damaged</label>
                        <input
                          type="number"
                          value={state.damaged}
                          disabled={batch.status === 'SETTLED'}
                          onChange={(e) => setBatchReturnState(prev => ({
                            ...prev,
                            [item.productId]: { ...state, damaged: e.target.value }
                          }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-black text-amber-600 outline-none disabled:opacity-50"
                        />
                     </div>
                  </div>
                  <div className={`rounded-2xl p-3 space-y-3 ${deliveredQty < 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                     <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actual Delivered</p>
                        <p className={`text-lg font-black ${deliveredQty < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatNumber(Math.max(0, deliveredQty))}</p>
                     </div>
                     <div className="flex justify-between items-center border-t border-slate-200/50 pt-2">
                        <div className="space-y-0.5">
                           <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Due/Baki</p>
                           <p className="font-black text-amber-600">
                              {formatCurrency(batch.orders
                                .filter(bo => bo.order.items.some(i => i.productId === item.productId))
                                .reduce((sum, bo) => sum + (draftDues[bo.orderId] || 0), 0)
                              )}
                           </p>
                        </div>
                        <div className="text-right space-y-0.5">
                           <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Cash</p>
                           <p className="font-black text-emerald-600">
                              {formatCurrency(Math.max(0, 
                                 (deliveredQty * (item.totalPaidQty / (item.totalQty || 1)) * item.price) - 
                                 batch.orders
                                  .filter(bo => bo.order.items.some(i => i.productId === item.productId))
                                  .reduce((sum, bo) => sum + (draftDues[bo.orderId] || 0), 0)
                              ))}
                           </p>
                        </div>
                     </div>
                     <button 
                        onClick={() => setDueModalProduct({ id: item.productId, name: item.name })}
                        className="w-full py-2.5 rounded-xl bg-amber-500 text-[10px] font-black uppercase text-white shadow-sm flex items-center justify-center gap-2"
                      >
                        {batch.orders.some(bo => bo.order.items.some(i => i.productId === item.productId) && draftDues[bo.orderId] > 0) ? 'Edit Due' : 'Add Due'}
                      </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="lg:hidden p-4 border-t border-slate-100">
             <button
                onClick={handleSaveReturns}
                disabled={isSavingReturns || batch.status === 'SETTLED' || !['DISPATCHED', 'RETURN_PENDING', 'PARTIALLY_SETTLED'].includes(batch.status)}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-cyan-700 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-cyan-100 disabled:opacity-50 disabled:bg-slate-300"
              >
                {isSavingReturns ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Save Field Records
              </button>
          </div>
        </PageCard>
      )}

      {/* Final Summary - Simplified 'Not Fancy' Style */}
      <div className="mt-10 pt-10 border-t-2 border-slate-900 pb-24">
        <h2 className="text-base font-black uppercase tracking-widest text-slate-900 mb-6">Final Batch Summary</h2>
        
        <div className="flex flex-col lg:flex-row border-2 border-slate-900 divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-slate-900">
          <div className="flex-1 p-4 lg:p-6 bg-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 lg:mb-1">Total Qty</p>
            <p className="text-xl lg:text-2xl font-black text-slate-900">{formatNumber(finalMetrics?.totalOrder || 0)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 lg:mb-1">Returned</p>
            <p className="text-xl lg:text-2xl font-black text-rose-600">{formatNumber(finalMetrics?.totalReturned || 0)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 lg:mb-1">Final Sold</p>
            <p className="text-xl lg:text-2xl font-black text-emerald-700">{formatNumber(finalMetrics?.totalSold || 0)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-slate-900 text-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 lg:mb-1">Final Amount</p>
            <p className="text-xl lg:text-2xl font-black truncate">{formatCurrency(finalMetrics?.totalAmount || 0)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 lg:mb-1">Due/Baki</p>
            <p className="text-xl lg:text-2xl font-black text-amber-700">{formatCurrency(finalMetrics?.totalDueDraft || 0)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-emerald-950 text-white border-l-0 lg:border-l-4 border-emerald-500 flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300 lg:mb-1">Cash Collectable</p>
            <p className="text-xl lg:text-2xl font-black truncate text-emerald-400">{formatCurrency(finalMetrics?.cashCollectable || 0)}</p>
          </div>
        </div>

        {batch.status !== 'SETTLED' && (
          <div className="mt-12 flex flex-col items-center justify-center space-y-6">
            <div className="text-center px-4">
              <p className="text-sm font-black uppercase tracking-widest text-slate-900">Settlement Status</p>
              <p className="text-xs font-bold text-slate-500 mt-1 uppercase">Ready to close batch & update ledger</p>
            </div>
            
            <button
              onClick={handleSettle}
              disabled={isSettling}
              className="w-full sm:max-w-md flex items-center justify-center gap-3 rounded-none border-4 border-slate-900 bg-slate-900 px-6 sm:px-12 py-4 text-base sm:text-lg font-black uppercase tracking-widest text-white transition hover:bg-white hover:text-slate-900 disabled:opacity-50"
            >
              {isSettling ? <RefreshCw className="h-5 w-5 animate-spin" /> : <HandCoins className="h-5 w-5" />}
              {isSettling ? 'Processing...' : 'Complete Settlement'}
            </button>
          </div>
        )}

        {batch.status === 'SETTLED' && (
          <div className="mt-12 flex flex-col items-center justify-center space-y-6">
            <div className="text-center px-4">
              <p className="text-sm font-black uppercase tracking-widest text-emerald-600">Batch Fully Settled</p>
              <p className="text-xs font-bold text-slate-500 mt-1 uppercase">Ledger updated and inventory finalized</p>
            </div>
            
            <button
              onClick={handlePrintFinalSettlement}
              className="w-full max-w-md flex items-center justify-center gap-3 rounded-none border-4 border-slate-900 bg-white px-12 py-4 text-base lg:text-lg font-black uppercase tracking-widest text-slate-900 transition hover:bg-slate-900 hover:text-white"
            >
              <Printer className="h-5 w-5" />
              Print Final Settlement
            </button>
          </div>
        )}
      </div>

      {dueModalProduct && (
        <DueModal 
          isOpen={!!dueModalProduct}
          onClose={() => setDueModalProduct(null)}
          productId={dueModalProduct.id}
          productName={dueModalProduct.name}
          batchOrders={batch.orders}
          draftDues={draftDues}
          route={batch.route}
          onAddDraftDue={(orderId, amount) => {
            setDraftDues(prev => ({
              ...prev,
              [orderId]: amount
            }));
          }}
          onSuccess={() => fetchBatch()}
        />
      )}
    </div>
  );
}
