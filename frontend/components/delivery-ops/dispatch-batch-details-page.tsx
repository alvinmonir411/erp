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

  // No print logic here anymore, handled by dedicated routes

  // Aggregate items across all orders in the batch
  const aggregatedItems = useMemo(() => {
    if (!batch) return [];
    const map = new Map<number, { productId: number; name: string; unit: string; totalQty: number; price: number }>();
    batch.orders.forEach(bo => {
      bo.order.items.forEach(item => {
        const existing = map.get(item.productId);
        const qty = Number(item.quantity) + Number(item.freeQuantity || 0);
        if (existing) {
          existing.totalQty += qty;
        } else {
          map.set(item.productId, {
            productId: item.productId,
            name: item.product.name,
            unit: item.product.unit,
            totalQty: qty,
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
      
      totalOrder += item.totalQty;
      totalReturned += ret;
      totalDamaged += dam;
      totalAmount += delivered * item.price;
    });

    return { totalOrder, totalReturned, totalDamaged, totalSold: totalOrder - totalReturned - totalDamaged, totalAmount };
  }, [batch, aggregatedItems, batchReturnState]);

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
    window.open(`/delivery-ops/batches/${batchId}/print-final-settlement`, "_blank");
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

    // Validate returns against dispatched quantities
    for (const item of aggregatedItems) {
      const state = batchReturnState[item.productId] || { returned: '0', damaged: '0' };
      const returned = Number(state.returned || 0);
      const damaged = Number(state.damaged || 0);

      if (returned < 0 || damaged < 0) {
        showErrorToast(`Negative values are not allowed for ${item.name}`);
        return;
      }

      if (returned + damaged > item.totalQty) {
        showErrorToast(`Total returns (${returned + damaged}) for ${item.name} cannot exceed total dispatched quantity (${item.totalQty})`);
        return;
      }
    }

    try {
      setIsSavingReturns(true);
      
      const ordersToUpdate = batch.orders.map(bo => {
        return {
          orderId: bo.orderId,
          items: bo.order.items.map(item => {
            const state = batchReturnState[item.productId] || { returned: '0', damaged: '0' };
            const totalDispatchedForThisProduct = aggregatedItems.find(ai => ai.productId === item.productId)?.totalQty || 1;
            const dispatchedInThisOrder = Number(item.quantity) + Number(item.freeQuantity || 0);
            const ratio = dispatchedInThisOrder / totalDispatchedForThisProduct;
            
            // Proportional distribution of returns
            return {
              productId: item.productId,
              dispatchedQuantity: dispatchedInThisOrder,
              returnedQuantity: Math.round(Number(state.returned) * ratio),
              damagedQuantity: Math.round(Number(state.damaged) * ratio),
              // deliveredQuantity is calculated by backend or frontend-only, do not send
            };
          })
        };
      });

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
      // Simplify collection: full amount as cash for all orders
      await settleDispatchBatch(batchId, {
        collections: batch.orders.map((batchOrder) => ({
          orderId: batchOrder.orderId,
          collectedAmount: Number(batchOrder.finalSoldAmount || 0),
          paymentMode: 'CASH',
        })),
      });
      
      showSuccessToast('Batch marked as settled');
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
                  <div className={`rounded-2xl p-3 flex justify-between items-center ${deliveredQty < 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                     <p className="text-xs font-black uppercase tracking-widest text-slate-400">Actual Delivered</p>
                     <p className={`text-lg font-black ${deliveredQty < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatNumber(Math.max(0, deliveredQty))}</p>
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
        
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 border-2 border-slate-900 divide-x-2 divide-y-2 md:divide-y-0 divide-slate-900">
          <div className="p-4 lg:p-6 bg-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Qty</p>
            <p className="text-xl lg:text-2xl font-black text-slate-900">{formatNumber(finalMetrics?.totalOrder || 0)}</p>
          </div>
          <div className="p-4 lg:p-6 bg-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Returned</p>
            <p className="text-xl lg:text-2xl font-black text-rose-600">{formatNumber(finalMetrics?.totalReturned || 0)}</p>
          </div>
          <div className="p-4 lg:p-6 bg-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Final Sold</p>
            <p className="text-xl lg:text-2xl font-black text-emerald-700">{formatNumber(finalMetrics?.totalSold || 0)}</p>
          </div>
          <div className="p-4 lg:p-6 bg-slate-900 text-white col-span-2 md:col-span-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Final Amount</p>
            <p className="text-xl lg:text-2xl font-black truncate">{formatCurrency(finalMetrics?.totalAmount || 0)}</p>
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
              className="w-full max-w-md flex items-center justify-center gap-3 rounded-none border-4 border-slate-900 bg-slate-900 px-12 py-4 text-base lg:text-lg font-black uppercase tracking-widest text-white transition hover:bg-white hover:text-slate-900 disabled:opacity-50"
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
    </div>
  );
}
