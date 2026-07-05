'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWithLoading } from '@/lib/loading-context';
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
  Trash2,
  CheckCircle2,
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
  deleteDispatchBatch,
} from '@/lib/api/delivery-ops';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';
import type { DispatchBatch, DispatchBatchOrder } from '@/types/api';
import { batchStatusConfig, orderStatusConfig, StatusBadge } from './delivery-ops-ui';
import { PrintSummary } from './print-summary';
import { DueModal } from './due-modal';
import { DeleteBatchConfirmModal } from './delivery-ops-dashboard-page';

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

const safeMoney = (val: number) => {
  return Math.round(val * 100) / 100;
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
  const [batchReturnState, setBatchReturnState] = useState<Record<number, {
    returned: string;
    damaged: string;
    free: string;
  }>>({});
  const [draftDues, setDraftDues] = useState<Record<string, Array<{ shopId: number; shopName: string; amount: number; note?: string }>>>({});
  const [dueModalProduct, setDueModalProduct] = useState<{ id: number; name: string } | null>(null);
  const [actualCashReceived, setActualCashReceived] = useState<string>('');
  const [batchToDelete, setBatchToDelete] = useState<{ id: number; batchNo: string; isSettled: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const { withLoading } = useWithLoading();
  // Track whether admin has manually edited the cash field — if yes, never auto-overwrite it
  const cashManuallyEdited = useRef(false);

  // No print logic here anymore, handled by dedicated routes

  // Aggregate items across all orders in the batch
  const aggregatedItems = useMemo(() => {
    if (!batch) return [];
    const map = new Map<number, { productId: number; name: string; unit: string; totalQty: number; totalPaidQty: number; totalFreeQty: number; price: number }>();
    batch.orders.forEach(bo => {
      bo.order.items.forEach(item => {
        const existing = map.get(item.productId);
        const paidQty = Math.abs(Number(item.quantity || 0));
        const freeQty = Math.abs(Number(item.freeQuantity || 0));
        const qty = paidQty + freeQty;
        if (existing) {
          existing.totalQty += qty;
          existing.totalPaidQty += paidQty;
          existing.totalFreeQty += freeQty;
        } else {
          map.set(item.productId, {
            productId: item.productId,
            name: item.product.name,
            unit: item.product.unit,
            totalQty: qty,
            totalPaidQty: paidQty,
            totalFreeQty: freeQty,
            price: Number(item.unitPrice || 0)
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [batch]);

  // Initialize return state from aggregated items
  useEffect(() => {
    if (batch && aggregatedItems.length > 0) {
      const initialState: Record<number, {
        returned: string;
        damaged: string;
        free: string;
      }> = {};
      aggregatedItems.forEach(item => {
        // Find aggregated batch item for this product
        const batchItem = (batch.items || []).find(bi => bi.productId === item.productId) as any;

        // Preferred source: Split fields from BatchItem (if already recalculated)
        if (batchItem && (batchItem.returnedPaidQty !== undefined || batchItem.returnedFreeQty !== undefined)) {
          initialState[item.productId] = {
            returned: String(batchItem.returnedPaidQty || 0),
            damaged: String(batchItem.damagedPaidQty || 0),
            free: String(batchItem.returnedFreeQty || 0)
          };
        } else {
          // Fallback: Aggregate split quantities from individual order items
          const productItems = batch.orders.flatMap(bo => bo.order.items).filter(i => i.productId === item.productId);
          const totalReturnedPaid = productItems.reduce((sum, i) => sum + Number(i.returnedPaidQuantity || 0), 0);
          const totalReturnedFree = productItems.reduce((sum, i) => sum + Number(i.returnedFreeQuantity || 0), 0);
          const totalDamagedPaid = productItems.reduce((sum, i) => sum + Number(i.damagedPaidQuantity || 0), 0);

          initialState[item.productId] = {
            returned: String(totalReturnedPaid),
            damaged: String(totalDamagedPaid),
            free: String(totalReturnedFree)
          };
        }
      });
      setBatchReturnState(initialState);
    }
  }, [batch, aggregatedItems]);

  // Compute dynamic orders in real-time based on current return state inputs
  const dynamicOrders = useMemo(() => {
    if (!batch) return [];

    const remRet: Record<number, number> = {};
    const remDam: Record<number, number> = {};
    const remFree: Record<number, number> = {};

    Object.entries(batchReturnState).forEach(([pid, s]) => {
      const id = Number(pid);
      remRet[id] = Number(s.returned || 0);
      remDam[id] = Number(s.damaged || 0);
      remFree[id] = Number(s.free || 0);
    });

    return batch.orders.map((bo) => {
      let itemSoldAmount = 0;

      const dynamicItems = bo.order.items.map((item) => {
        const productId = item.productId;
        const orderPaid = Number(item.quantity || 0);
        const orderFree = Number(item.freeQuantity || 0);

        const takeRet = Math.min(orderPaid, remRet[productId] || 0);
        remRet[productId] -= takeRet;

        const takeDam = Math.min(orderPaid - takeRet, remDam[productId] || 0);
        remDam[productId] -= takeDam;

        const takeFreeRet = Math.min(orderFree, remFree[productId] || 0);
        remFree[productId] -= takeFreeRet;

        const finalPaidDelivered = Math.max(0, orderPaid - takeRet - takeDam);
        const finalDeliveredFree = Math.max(0, orderFree - takeFreeRet);

        const unitPriceAfterItemDiscount = orderPaid > 0 ? Number(item.lineTotal || 0) / orderPaid : 0;
        itemSoldAmount += finalPaidDelivered * unitPriceAfterItemDiscount;

        return {
          ...item,
          deliveredPaidQuantity: finalPaidDelivered,
          deliveredFreeQuantity: finalDeliveredFree,
          returnedPaidQuantity: takeRet,
          returnedFreeQuantity: takeFreeRet,
          damagedPaidQuantity: takeDam,
        };
      });

      const subtotal = Number(bo.order.subtotal || 0);
      const invoiceDiscountApplied = subtotal > 0
        ? Number(bo.order.discountAmount || 0) * (itemSoldAmount / subtotal)
        : 0;

      const finalSoldAmount = Math.max(0, Number((itemSoldAmount - invoiceDiscountApplied).toFixed(2)));

      return {
        ...bo,
        finalSoldAmount,
        order: {
          ...bo.order,
          items: dynamicItems,
        },
      };
    });
  }, [batch, batchReturnState]);

  const isReturnDirty = useMemo(() => {
    if (!batch) return false;
    return aggregatedItems.some(item => {
      const state = batchReturnState[item.productId] || { returned: '0', damaged: '0', free: '0' };
      const batchItem = (batch.items || []).find(bi => bi.productId === item.productId) as any;
      const dbReturned = batchItem?.returnedPaidQty || 0;
      const dbDamaged = batchItem?.damagedPaidQty || 0;
      const dbFree = batchItem?.returnedFreeQty || 0;
      return (
        Number(state.returned || 0) !== dbReturned ||
        Number(state.damaged || 0) !== dbDamaged ||
        Number(state.free || 0) !== dbFree
      );
    });
  }, [batch, aggregatedItems, batchReturnState]);

  const finalMetrics = useMemo(() => {
    if (!batch || dynamicOrders.length === 0) return null;
    let totalQty = 0;
    let totalFree = 0;
    let returned = 0;
    let damaged = 0;
    let finalSold = 0;
    let finalAmount = 0;

    dynamicOrders.forEach(bo => {
      finalAmount += bo.finalSoldAmount;
      bo.order.items.forEach(item => {
        totalQty += Number(item.quantity || 0);
        totalFree += Number(item.deliveredFreeQuantity || 0);
        returned += Number(item.returnedPaidQuantity || 0);
        damaged += Number(item.damagedPaidQuantity || 0);
        finalSold += Number(item.deliveredPaidQuantity || 0);
      });
    });

    const totalDueDraft = Object.values(draftDues).reduce((sum, entries) => {
      const orderSum = entries ? entries.reduce((s, e) => s + Number(e.amount || 0), 0) : 0;
      return sum + orderSum;
    }, 0);
    const cashCollectable = Math.max(0, finalAmount - totalDueDraft);

    return {
      totalQty,
      totalFree,
      returned,
      damaged,
      finalSold,
      finalAmount,
      totalDueDraft,
      cashCollectable,
    };
  }, [dynamicOrders, draftDues]);

  // Reset states when batch ID changes to prevent stale data from previous batches
  useEffect(() => {
    setActualCashReceived('');
    setDraftDues({});
    setBatchReturnState({});
    cashManuallyEdited.current = false; // allow auto-fill for fresh batch
  }, [batchId]);

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

  useEffect(() => {
    const handleRefresh = (e: any) => {
      const detail = e.detail;
      if (detail && detail.data) {
        const matchesBatch = detail.data.id === batchId || 
                             detail.data.batchId === batchId ||
                             (detail.data.orders && detail.data.orders.some((o: any) => o.batchId === batchId));
        if (matchesBatch) {
          fetchBatch();
        }
      } else {
        fetchBatch();
      }
    };
    window.addEventListener('batch-refresh', handleRefresh);
    window.addEventListener('order-refresh', handleRefresh);
    return () => {
      window.removeEventListener('batch-refresh', handleRefresh);
      window.removeEventListener('order-refresh', handleRefresh);
    };
  }, [batchId]);

  // Auto-fill actual cash received ONCE when the batch first loads — never overwrites user-typed value
  useEffect(() => {
    if (finalMetrics && finalMetrics.cashCollectable > 0 && !cashManuallyEdited.current && actualCashReceived === '') {
      setActualCashReceived(String(finalMetrics.cashCollectable));
    }
  }, [finalMetrics?.cashCollectable]);

  const batchStatus = batch ? batchStatusConfig[batch.status] : null;
  const isBatchSettled = batch ? ['SETTLED', 'PARTIALLY_SETTLED'].includes(batch.status) : false;

  const getDueForProductRow = (batchOrder: DispatchBatchOrder, productId: number) => {
    if (isBatchSettled) {
      const orderDueAmount = Number(batchOrder.dueAmount || 0);
      if (orderDueAmount <= 0) return 0;
      
      const firstMatchingItem = batchOrder.order.items.find((item: any) => 
        batchOrder.order.items.some((i: any) => i.productId === item.productId)
      );
      if (firstMatchingItem && firstMatchingItem.productId === productId) {
        return orderDueAmount;
      }
      return 0;
    }

    const key = `${batchOrder.orderId}_${productId}`;
    const duesList = draftDues[key] || [];
    return duesList.reduce((sum, d) => sum + d.amount, 0);
  };

  const settledDuesTotal = useMemo(() => {
    if (!batch) return 0;
    return batch.orders.reduce((sum, bo) => sum + Number(bo.dueAmount || 0), 0);
  }, [batch]);

  const currentFinalAmount = useMemo(() => {
    if (isBatchSettled && batch) {
      return Number(batch.finalSoldValue || 0);
    }
    return Number(finalMetrics?.finalAmount || 0);
  }, [isBatchSettled, batch, finalMetrics]);

  const currentCustomerDue = useMemo(() => {
    if (isBatchSettled && batch) {
      return Number(batch.totalDueAmount || 0);
    }
    return Number(finalMetrics?.totalDueDraft || 0);
  }, [isBatchSettled, batch, finalMetrics]);

  const currentCashCollectable = useMemo(() => {
    if (isBatchSettled && batch) {
      return Number(batch.totalCollectedAmount || 0);
    }
    return Math.max(0, currentFinalAmount - currentCustomerDue);
  }, [isBatchSettled, batch, currentFinalAmount, currentCustomerDue]);

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

  const handlePrintFinalSettlement = () => {
    window.print();
  };

  const handleDispatch = async () => {
    setIsDispatching(true);
    try {
      await withLoading(() => markBatchDispatched(batchId), 'Dispatching to field...');
      showSuccessToast('Batch dispatched successfully');
      fetchBatch();
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to dispatch batch');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleDeleteClick = () => {
    if (!batch) return;
    const isSettled = batch.status === 'SETTLED' || batch.status === 'PARTIALLY_SETTLED';
    setBatchToDelete({ id: batchId, batchNo: batch.batchNo, isSettled });
  };

  const handleConfirmDelete = async () => {
    if (!batchToDelete) return;
    try {
      setIsDeleting(true);
      await withLoading(() => deleteDispatchBatch(batchToDelete.id), 'Deleting batch & restoring stock...');
      router.push('/delivery-ops');
      showSuccessToast('Batch deleted successfully');
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to delete batch');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveReturns = async () => {
    if (!batch) return;

    // Validation
    for (const item of aggregatedItems) {
      const state = batchReturnState[item.productId] || { returned: '0', damaged: '0', free: '0' };
      const r = Number(state.returned || 0);
      const d = Number(state.damaged || 0);
      const f = Number(state.free || 0);

      if (r + d > item.totalPaidQty) {
        showErrorToast(`Total return/damage for ${item.name} exceeds dispatched qty (${item.totalPaidQty})`);
        return;
      }
      if (f > item.totalFreeQty) {
        showErrorToast(`Free return for ${item.name} exceeds dispatched free qty (${item.totalFreeQty})`);
        return;
      }
    }

    // Distribute returns to individual orders
    const remRet: Record<number, number> = {};
    const remDam: Record<number, number> = {};
    const remFree: Record<number, number> = {};

    Object.entries(batchReturnState).forEach(([pid, s]) => {
      const id = Number(pid);
      remRet[id] = Number(s.returned || 0);
      remDam[id] = Number(s.damaged || 0);
      remFree[id] = Number(s.free || 0);
    });

    const ordersToUpdate = batch.orders.map((bo) => {
      return {
        orderId: bo.orderId,
        items: bo.order.items.map((item) => {
          const productId = item.productId;
          const orderPaid = Number(item.quantity || 0);
          const orderFree = Number(item.freeQuantity || 0);

          // Return distribution
          const takeRet = Math.min(orderPaid, remRet[productId] || 0);
          remRet[productId] -= takeRet;

          // Damage distribution (from remaining paid)
          const takeDam = Math.min(orderPaid - takeRet, remDam[productId] || 0);
          remDam[productId] -= takeDam;

          // Free Return distribution
          const takeFreeRet = Math.min(orderFree, remFree[productId] || 0);
          remFree[productId] -= takeFreeRet;
          const takeFreeDelivered = orderFree - takeFreeRet;

          return {
            productId,
            returnedPaidQuantity: takeRet,
            returnedFreeQuantity: takeFreeRet,
            damagedPaidQuantity: takeDam,
            damagedFreeQuantity: 0,
          };
        }),
      };
    });

    try {
      setIsSavingReturns(true);
      await withLoading(() => recordBatchReturns(batchId, { orders: ordersToUpdate }), 'Saving returns...');
      showSuccessToast('Returns recorded successfully');
      fetchBatch();
      // Keep on entry tab to allow further edits until final settlement
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

      const collections = dynamicOrders.map((batchOrder) => {
        let orderDraftDue = 0;
        Object.entries(draftDues).forEach(([key, list]) => {
          if (key.startsWith(`${batchOrder.orderId}_`)) {
            orderDraftDue += list.reduce((sum, d) => sum + d.amount, 0);
          }
        });
        const finalAmount = Number(batchOrder.finalSoldAmount || 0);
        const advance = Number(batchOrder.order?.advancePaid || 0);
        const explicitCollected = Number(batchOrder.collectedAmount || 0);

        return {
          orderId: Number(batchOrder.orderId),
          collectedAmount: explicitCollected > 0
            ? Number(explicitCollected)
            : Number(Math.max(0, finalAmount - advance - orderDraftDue)),
          paymentMode: 'CASH',
          note: batchOrder.deliveryNote || undefined,
        };
      });

      const dueEntries: any[] = [];
      Object.entries(draftDues).forEach(([key, list]) => {
        const parts = key.split('_');
        const orderId = Number(parts[0]);
        const productId = Number(parts[1]);
        if (list && list.length > 0) {
          list.forEach(d => {
            if (d.amount > 0) {
              dueEntries.push({
                orderId,
                amount: d.amount,
                shopId: d.shopId,
                productId,
                note: d.note || 'Added during batch settlement'
              });
            }
          });
        }
      });

      // Complete Settlement
      await withLoading(() => settleDispatchBatch(batchId, {
        collections,
        dueEntries: dueEntries.length > 0 ? dueEntries : undefined,
        actualCashReceived: actualCashReceived ? Number(actualCashReceived) : undefined
      }), 'Settling batch...');

      showSuccessToast('Batch marked as settled and dues recorded');
      setDraftDues({});
      setActualCashReceived('');
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
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm !important;
          }

          .no-print {
            display: none !important;
          }
          
          body * {
            visibility: hidden;
          }

          .final-settlement-print,
          .final-settlement-print * {
            visibility: visible;
          }

          .final-settlement-print {
            display: flex !important;
            flex-direction: column !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
            background: white;
            color: black;
            overflow: hidden;
            height: auto !important;
            min-height: 262mm !important;
            max-height: none !important;
            page-break-inside: avoid;
          }
          
          table { 
            page-break-inside: auto; 
          }
          tr { 
            page-break-inside: avoid; 
            page-break-after: auto; 
          }
          
          /* Table spacing overrides */
          .final-settlement-print table th, 
          .final-settlement-print table td { 
            padding: 4px 6px !important; 
            font-size: 10px !important;
            line-height: 1.15 !important;
          }
          
          /* Spacing cleanups for print */
          .final-settlement-print .mb-8 { margin-bottom: 8px !important; }
          .final-settlement-print .pb-4 { padding-bottom: 4px !important; }
          .final-settlement-print .mb-10 { margin-bottom: 10px !important; }
          .final-settlement-print .gap-8 { gap: 8px !important; }
          .final-settlement-print .mt-12 { margin-top: 10px !important; }
          .final-settlement-print .gap-12 { gap: 12px !important; }
          .final-settlement-print .signature-grid {
            margin-top: auto !important;
            padding-top: 20px !important;
          }
          
          .pb-24 { padding-bottom: 0 !important; }
          .min-h-screen { min-height: 0 !important; }
        }

        .final-settlement-print {
          display: none;
        }
      `}} />
      <div className="no-print space-y-6">
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
              {formatDate(batch.dispatchDate)} · {batch.assignedDeliveryMan?.name || batch.deliveryPerson?.name} · {batch.route.name}
            </p>
            {isBatchSettled && (
              <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                <ShieldAlert className="h-3 w-3" />
                Locked after settlement
              </div>
            )}
          </div>
        </div>

        {['DISPATCHED', 'RETURN_PENDING', 'PARTIALLY_SETTLED', 'SETTLED'].includes(batch.status) && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePrintFinalSettlement}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-900 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Print Final Settlement
            </button>
            <button
              onClick={handleDeleteClick}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-600 px-5 py-3 text-sm font-bold shadow-sm transition hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete Batch
            </button>
          </div>
        )}

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
              disabled={isDispatching}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-amber-200 transition hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDispatching ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Dispatch to Field
                </>
              )}
            </button>
            <button
              onClick={handleDeleteClick}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-600 px-5 py-3 text-sm font-bold shadow-sm transition hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete Batch
            </button>
          </div>
        )}
      </div>

      <div className="flex space-x-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${activeTab === tab.id
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
                    <th className="px-6 py-4 text-center w-20">Free</th>
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
                          {formatNumber(item.totalPaidQty)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-black text-emerald-600">
                          {formatNumber(item.totalFreeQty)}
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
                disabled={isSavingReturns || isBatchSettled || !['DISPATCHED', 'RETURN_PENDING'].includes(batch.status)}
                className="rounded-2xl bg-cyan-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-200 disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none"
              >
                <span className="inline-flex items-center gap-2">
                  {isSavingReturns ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isBatchSettled ? 'Locked' : 'Save Returns'}
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
                  <th className="px-6 py-4 text-center w-24">Paid Qty</th>
                  <th className="px-6 py-4 text-center w-24" title="Total free items dispatched for this product">Free Sent</th>
                  <th className="px-6 py-4 text-center w-32">Return (Paid)</th>
                  <th className="px-6 py-4 text-center w-32">Return (Free)</th>
                  <th className="px-6 py-4 text-center w-32">Damage</th>
                  <th className="px-6 py-4 text-center w-24">Final Sold</th>
                  <th className="px-6 py-4 text-center w-24">Due</th>
                  <th className="px-6 py-4 text-center w-24">Cash</th>
                  <th className="px-6 py-4 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {aggregatedItems.map((item, index) => {
                  const state = batchReturnState[item.productId] || {
                    returned: '0',
                    damaged: '0',
                    free: '0'
                  };

                  const r = Number(state.returned || 0);
                  const d = Number(state.damaged || 0);

                  const sold = Math.max(0, item.totalPaidQty - r - d);
                  const itemCashValue = sold * item.price;
                  const itemDraftDue = isBatchSettled
                    ? batch.orders
                      .reduce((sum, bo) => sum + getDueForProductRow(bo, item.productId), 0)
                    : batch.orders
                      .reduce((sum, bo) => sum + getDueForProductRow(bo, item.productId), 0);

                  return (
                    <tr
                      key={item.productId}
                      className={`hover:bg-slate-50/30 transition-colors ${item.totalFreeQty > 0 ? 'bg-emerald-50/40 border-l-2 border-emerald-400' : ''
                        }`}
                    >
                      <td className="px-6 py-4 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {item.name}
                        {item.totalFreeQty > 0 && (
                          <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 rounded px-1.5 py-0.5">
                            +{formatNumber(item.totalFreeQty)} free
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center font-black text-slate-700">
                        {formatNumber(item.totalPaidQty)}
                      </td>
                      {/* FREE SENT — read-only dispatched free qty so user knows which product has free items */}
                      <td className="px-6 py-4 text-center">
                        {item.totalFreeQty > 0 ? (
                          <span className="rounded-lg bg-emerald-100 px-3 py-1.5 font-black text-emerald-700 text-sm">
                            {formatNumber(item.totalFreeQty)}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>
                      {/* RETURN (PAID) */}
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.totalPaidQty}
                          value={state.returned}
                          disabled={isBatchSettled}
                          onChange={(e) => setBatchReturnState(prev => ({
                            ...prev,
                            [item.productId]: { ...state, returned: e.target.value }
                          }))}
                          className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center font-black text-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/10 outline-none"
                        />
                      </td>
                      {/* RETURN (FREE) */}
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.totalFreeQty}
                          value={state.free}
                          disabled={isBatchSettled || item.totalFreeQty === 0}
                          onChange={(e) => setBatchReturnState(prev => ({
                            ...prev,
                            [item.productId]: { ...state, free: e.target.value }
                          }))}
                          className={`w-20 rounded-xl border px-2 py-2 text-center font-black outline-none ${item.totalFreeQty > 0
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 focus:bg-white focus:ring-2 focus:ring-emerald-500/10'
                              : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                            }`}
                          placeholder={item.totalFreeQty > 0 ? '0' : '—'}
                        />
                      </td>
                      {/* DAMAGE */}
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.totalPaidQty - r}
                          value={state.damaged}
                          disabled={isBatchSettled}
                          onChange={(e) => setBatchReturnState(prev => ({
                            ...prev,
                            [item.productId]: { ...state, damaged: e.target.value }
                          }))}
                          className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center font-black text-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-500/10 outline-none"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="bg-slate-900 rounded-xl px-2 py-2 font-black text-xs text-white">
                          {formatNumber(sold)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-black text-amber-600">
                            {formatCurrency(itemDraftDue)}
                          </span>
                          {!isBatchSettled && batch && batch.orders.map(bo => {
                            const key = `${bo.orderId}_${item.productId}`;
                            const orderDuesList = draftDues[key] || [];
                            return orderDuesList.map(d => (
                              <span key={d.shopId} className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded px-1 py-0.5 max-w-[120px] truncate">
                                {d.shopName}: {formatCurrency(d.amount)}
                              </span>
                            ));
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="font-black text-emerald-600">
                          {formatCurrency(Math.max(0, itemCashValue - itemDraftDue))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setDueModalProduct({ id: item.productId, name: item.name })}
                          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black uppercase text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          Due
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
              const state = batchReturnState[item.productId] || { returned: '0', damaged: '0', free: '0' };
              const q = item.totalPaidQty;
              const f = item.totalFreeQty;
              const r = Number(state.returned || 0);
              const d = Number(state.damaged || 0);

              const sold = Math.max(0, q - r - d);
              const itemCashValue = sold * item.price;
              const itemDraftDue = isBatchSettled
                ? batch.orders
                    .reduce((sum, bo) => sum + getDueForProductRow(bo, item.productId), 0)
                : batch.orders
                    .reduce((sum, bo) => sum + getDueForProductRow(bo, item.productId), 0);

              return (
                <div key={item.productId} className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <div className="bg-slate-100 rounded-lg px-2 py-1 text-[10px] font-black text-slate-500 uppercase">
                      P: {q} | F: {item.totalFreeQty}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-rose-500">Return (P)</label>
                      <input
                        type="number"
                        value={state.returned}
                        disabled={isBatchSettled}
                        onChange={(e) => setBatchReturnState(prev => ({
                          ...prev,
                          [item.productId]: { ...state, returned: e.target.value }
                        }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-black text-rose-600 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-amber-500">Damage</label>
                      <input
                        type="number"
                        value={state.damaged}
                        disabled={isBatchSettled}
                        onChange={(e) => setBatchReturnState(prev => ({
                          ...prev,
                          [item.productId]: { ...state, damaged: e.target.value }
                        }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-black text-amber-600 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-emerald-500">Return (F)</label>
                      <input
                        type="number"
                        value={state.free}
                        disabled={isBatchSettled}
                        onChange={(e) => setBatchReturnState(prev => ({
                          ...prev,
                          [item.productId]: { ...state, free: e.target.value }
                        }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-black text-emerald-600 outline-none"
                      />
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Final Sold (Paid)</p>
                      <p className="text-xl font-black text-white">{formatNumber(sold)}</p>
                    </div>
                    <div className="flex justify-between items-center border-t border-white/10 pt-3">
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Due</p>
                        <p className="text-sm font-black text-white">{formatCurrency(itemDraftDue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Cash</p>
                        <p className="text-sm font-black text-white">{formatCurrency(Math.max(0, itemCashValue - itemDraftDue))}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDueModalProduct({ id: item.productId, name: item.name })}
                      className="w-full py-3 rounded-xl bg-amber-500 text-xs font-black uppercase text-white shadow-lg"
                    >
                      Manage Due
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:hidden p-4 border-t border-slate-100">
            <button
              onClick={handleSaveReturns}
              disabled={isSavingReturns || isBatchSettled || !['DISPATCHED', 'RETURN_PENDING'].includes(batch.status)}
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
            <p className="text-xl lg:text-2xl font-black text-slate-900">{formatNumber(finalMetrics?.totalQty || 0)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 lg:mb-1">Delivered Free</p>
            <p className="text-xl lg:text-2xl font-black text-emerald-600">{formatNumber(finalMetrics?.totalFree || 0)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 lg:mb-1">Returned</p>
            <p className="text-xl lg:text-2xl font-black text-rose-600">{formatNumber(finalMetrics?.returned || 0)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 lg:mb-1">Damaged</p>
            <p className="text-xl lg:text-2xl font-black text-amber-600">{formatNumber(finalMetrics?.damaged || 0)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 lg:mb-1">Final Sold</p>
            <p className="text-xl lg:text-2xl font-black text-emerald-700">{formatNumber(finalMetrics?.finalSold || 0)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-slate-900 text-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 lg:mb-1">Final Amount</p>
            <p className="text-xl lg:text-2xl font-black truncate">{formatCurrency(currentFinalAmount)}</p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-white flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 lg:mb-1">Due/Baki</p>
            <p className="text-xl lg:text-2xl font-black text-amber-700">
              {formatCurrency(currentCustomerDue)}
            </p>
          </div>
          <div className="flex-1 p-4 lg:p-6 bg-emerald-950 text-white border-l-0 lg:border-l-4 border-emerald-500 flex justify-between lg:block items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300 lg:mb-1">Cash Collectable</p>
            <p className="text-xl lg:text-2xl font-black truncate text-emerald-400">
              {formatCurrency(currentCashCollectable)}
            </p>
          </div>
        </div>

        {!isBatchSettled && (
          <div className="mt-12 flex flex-col items-center justify-center space-y-8">
            <div className="w-full max-w-md space-y-4">
              <div className="text-center px-4 mb-4">
                <p className="text-sm font-black uppercase tracking-widest text-slate-900">Settlement Verification</p>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase">Enter actual cash received from delivery man</p>
              </div>

              <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 shadow-xl shadow-slate-100">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                    <span>Final Amount (Sold):</span>
                    <span className="text-slate-900">{formatCurrency(currentFinalAmount)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm font-bold text-slate-500 border-b border-slate-100 pb-2">
                    <span>Reported by Delivery Man:</span>
                    <span className="text-blue-600">{formatCurrency(currentCashCollectable)}</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actual Cash Received by Admin</label>
                    <input
                      type="number"
                      value={actualCashReceived}
                      onChange={(e) => {
                        // Store exactly what the user typed — no Number() conversion that would corrupt commas
                        cashManuallyEdited.current = true;
                        setActualCashReceived(e.target.value);
                      }}
                      placeholder="Enter amount..."
                      className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 text-2xl font-black text-slate-900 focus:border-slate-900 outline-none transition-all"
                    />
                  </div>

                  {/* Live Calculation: Remaining Due/Baki */}
                  <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Remaining Due/Baki</p>
                      <p className="text-xl font-black text-amber-700">
                        {formatCurrency(Math.max(0, currentFinalAmount - Number(actualCashReceived || 0)))}
                      </p>
                    </div>
                    <p className="mt-1 text-[8px] font-bold text-amber-500 uppercase leading-relaxed">
                      This amount will stay as customer due and stay assigned to the original SR and Shop.
                    </p>
                  </div>

                  {/* Mismatch Warning: Only if admin input differs from delivery man report */}
                  {actualCashReceived && Math.abs(Number(actualCashReceived) - currentCashCollectable) > 0.01 && (
                    <div className="rounded-2xl bg-rose-50 p-4 border border-rose-100 animate-pulse">
                      <div className="flex items-center gap-2 text-rose-600">
                        <ShieldAlert className="h-4 w-4" />
                        <p className="text-xs font-black uppercase tracking-tight">Cash Mismatch Warning</p>
                      </div>
                      <p className="mt-1 text-[10px] font-bold text-rose-500 uppercase leading-relaxed">
                        Delivery man reported {formatCurrency(currentCashCollectable)}, but you are settling with {formatCurrency(Number(actualCashReceived))}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isReturnDirty && (
              <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100 w-full sm:max-w-md text-center">
                <p className="text-xs font-bold text-amber-800 uppercase">Unsaved Return changes</p>
                <p className="text-[10px] text-amber-600 mt-1 uppercase leading-relaxed">
                  You have modified return quantities. Please click "Save Returns" in the Return Entry tab before settling.
                </p>
              </div>
            )}

            <button
              onClick={handleSettle}
              disabled={isSettling || isReturnDirty}
              className="w-full sm:max-w-md flex items-center justify-center gap-3 rounded-none border-4 border-slate-900 bg-slate-900 px-6 sm:px-12 py-4 text-base sm:text-lg font-black uppercase tracking-widest text-white transition hover:bg-white hover:text-slate-900 disabled:opacity-50 disabled:bg-slate-400 disabled:border-slate-400"
            >
              {isSettling ? <RefreshCw className="h-5 w-5 animate-spin" /> : <HandCoins className="h-5 w-5" />}
              {isSettling ? 'Processing...' : 'Confirm & Settle Batch'}
            </button>
          </div>
        )}

        {isBatchSettled && (
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

      <DueModal
        isOpen={!!dueModalProduct}
        onClose={() => setDueModalProduct(null)}
        productName={dueModalProduct?.name || ''}
        productId={dueModalProduct?.id || 0}
        batchOrders={dynamicOrders}
        draftDues={
          dueModalProduct
            ? Object.keys(draftDues)
                .filter(k => k.endsWith(`_${dueModalProduct.id}`))
                .reduce((obj, k) => {
                  const orderId = Number(k.split('_')[0]);
                  obj[orderId] = draftDues[k];
                  return obj;
                }, {} as Record<number, any[]>)
            : {}
        }
        route={batch.route}
        companyId={batch.companyId || batch.orders[0]?.order.companyId || 0}
        onAddDraftDue={(orderId, duesList) => {
          if (dueModalProduct) {
            const key = `${orderId}_${dueModalProduct.id}`;
            setDraftDues(prev => ({ ...prev, [key]: duesList }));
          }
        }}
        onSuccess={fetchBatch}
      />
      </div>

      {/* PRINT SECTION (HIDDEN ON SCREEN) */}
      <div className="final-settlement-print text-black bg-white">
        <div className="text-center mb-6 border-b-2 border-black pb-3">
          <h1 className="text-3xl font-black uppercase tracking-tight mb-1">KORIM TRADERS ERP</h1>
          <h2 className="text-xl font-bold uppercase tracking-widest text-slate-600">Final Batch Settlement</h2>
          <p className="text-[10px] font-bold mt-1 uppercase">Printed on {new Date().toLocaleString()}</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
          <div className="space-y-1.5 border-l-4 border-black pl-4">
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="font-bold text-slate-500">Batch ID:</span>
              <span className="font-black">#BT-{batch.id}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="font-bold text-slate-500">Dispatch Date:</span>
              <span className="font-black">{formatDate(batch.dispatchedAt || batch.createdAt)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="font-bold text-slate-500">Route:</span>
              <span className="font-black uppercase">{batch.route?.name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="font-bold text-slate-500">Delivery Man:</span>
              <span className="font-black uppercase">{batch.assignedDeliveryMan?.name || batch.deliveryPerson?.name}</span>
            </div>
          </div>
          <div className="space-y-1.5 border-l-4 border-emerald-500 pl-4">
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="font-bold text-slate-500">Settlement Status:</span>
              <span className="font-black text-emerald-600">FULLY SETTLED</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="font-bold text-slate-500">Settled At:</span>
              <span className="font-black">{formatDate(new Date())}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="font-bold text-slate-500">Market Area:</span>
              <span className="font-black uppercase">{batch.route?.area || 'N/A'}</span>
            </div>
          </div>
        </div>

        <table className="w-full border-2 border-black text-xs mb-4">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
              <th className="border-r border-black px-2 py-3 text-center">SL</th>
              <th className="border-r border-black px-2 py-3 text-left">Product Name</th>
              <th className="border-r border-black px-2 py-3 text-center">Paid Qty</th>
              <th className="border-r border-black px-2 py-3 text-center">Free Sent</th>
              <th className="border-r border-black px-2 py-3 text-center">Ret (Paid)</th>
              <th className="border-r border-black px-2 py-3 text-center">Ret (Free)</th>
              <th className="border-r border-black px-2 py-3 text-center">Dam (Paid)</th>
              <th className="border-r border-black px-2 py-3 text-center">Final Sold</th>
              <th className="border-r border-black px-2 py-3 text-center">Del. Free</th>
              <th className="border-r border-black px-2 py-3 text-center">Unit Price</th>
              <th className="border-r border-black px-2 py-3 text-right">Final Amount</th>
              <th className="px-2 py-3 text-right bg-rose-100 text-rose-800">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10">
            {aggregatedItems.map((item, idx) => {
              const state = batchReturnState[item.productId] || { returned: '0', damaged: '0', free: '0' };
              const rPaid = Number(state.returned || 0);
              const rFree = Number(state.free || 0);
              const dPaid = Number(state.damaged || 0);
              const finalSold = Math.max(0, item.totalPaidQty - rPaid - dPaid);
              const deliveredFree = Math.max(0, item.totalFreeQty - rFree);
              const lineTotal = finalSold * item.price;
              const itemDue = dynamicOrders
                .reduce((sum, bo) => {
                  return sum + getDueForProductRow(bo, item.productId);
                }, 0);

              return (
                <tr key={item.productId} className="font-bold">
                  <td className="border-r border-black px-2 py-2 text-center">{idx + 1}</td>
                  <td className="border-r border-black px-2 py-2">{item.name}</td>
                  <td className="border-r border-black px-2 py-2 text-center">{formatNumber(item.totalPaidQty)}</td>
                  <td className="border-r border-black px-2 py-2 text-center">{formatNumber(item.totalFreeQty)}</td>
                  <td className="border-r border-black px-2 py-2 text-center text-rose-600">{rPaid > 0 ? formatNumber(rPaid) : '—'}</td>
                  <td className="border-r border-black px-2 py-2 text-center text-rose-500">{rFree > 0 ? formatNumber(rFree) : '—'}</td>
                  <td className="border-r border-black px-2 py-2 text-center text-amber-600">{dPaid > 0 ? formatNumber(dPaid) : '—'}</td>
                  <td className="border-r border-black px-2 py-2 text-center text-blue-600">{formatNumber(finalSold)}</td>
                  <td className="border-r border-black px-2 py-2 text-center text-emerald-600">{formatNumber(deliveredFree)}</td>
                  <td className="border-r border-black px-2 py-2 text-center font-black text-slate-500">{formatCurrency(item.price)}</td>
                  <td className="border-r border-black px-2 py-2 text-right font-black">{formatCurrency(lineTotal)}</td>
                  <td className={`px-2 py-2 text-right font-black ${itemDue > 0 ? 'text-rose-700 bg-rose-50' : 'text-slate-300'}`}>
                    {itemDue > 0 ? formatCurrency(itemDue) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-black bg-slate-50 font-black uppercase text-sm">
            <tr>
              <td colSpan={7} className="border-r border-black px-4 py-3 text-right">Batch Grand Totals:</td>
              <td className="border-r border-black px-2 py-3 text-center text-blue-700">{formatNumber(finalMetrics?.finalSold || 0)}</td>
              <td className="border-r border-black px-2 py-3 text-center text-emerald-700">{formatNumber(finalMetrics?.totalFree || 0)}</td>
              <td className="border-r border-black px-2 py-3 text-center text-slate-400">—</td>
              <td className="border-r border-black px-2 py-3 text-right text-slate-900">{formatCurrency(currentFinalAmount)}</td>
              <td className="px-2 py-3 text-right text-rose-700 bg-rose-50">{currentCustomerDue > 0 ? formatCurrency(currentCustomerDue) : '—'}</td>
            </tr>
            <tr className="border-t-2 border-black bg-white text-black">
              <td colSpan={11} className="border-r border-black px-4 py-2.5 text-right font-black">Cash Collected:</td>
              <td className="px-2 py-2.5 text-right font-black text-black">{formatCurrency(isBatchSettled ? (batch.totalCollectedAmount || 0) : Number(actualCashReceived || currentCashCollectable))}</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-10 mt-10 signature-grid">
          <div className="text-center">
            <div className="border-t-2 border-black pt-2 font-black uppercase tracking-widest text-sm">Delivery Man Signature</div>
            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">{batch.assignedDeliveryMan?.name || batch.deliveryPerson?.name}</p>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-black pt-2 font-black uppercase tracking-widest text-sm">Authorized Admin Signature</div>
            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Korim Traders Warehouse</p>
          </div>
        </div>
      </div>


      {batchToDelete && (
        <DeleteBatchConfirmModal
          isOpen={!!batchToDelete}
          onClose={() => setBatchToDelete(null)}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
          batchNo={batchToDelete.batchNo}
          isSettled={batchToDelete.isSettled}
        />
      )}
    </div>
  );
}
