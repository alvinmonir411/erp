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
import { formatCurrency, formatDate, formatNumber, formatUnitPrice } from '@/lib/utils/format';
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
  const [draftDues, setDraftDues] = useState<Record<string, Array<{ shopId: number; shopName: string; amount: number; note?: string; dueDate?: string }>>>({});
  const [dueModalProduct, setDueModalProduct] = useState<{ id: number; name: string } | null>(null);
  const [actualCashReceived, setActualCashReceived] = useState<string>('');
  const [oldDueCollected, setOldDueCollected] = useState<string>('');
  const [vanRent, setVanRent] = useState<string>('');
  const [salary, setSalary] = useState<string>('');
  const [customExpenses, setCustomExpenses] = useState<Array<{
    id: string;
    expenseType: string;
    name: string;
    amount: string;
    note: string;
  }>>([]);
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
        const batchItem = (batch.items || []).find(bi => Number(bi.productId) === Number(item.productId)) as any;

        // Preferred source: Split fields from BatchItem (if already recalculated)
        if (batchItem && (batchItem.returnedPaidQty !== undefined || batchItem.returnedFreeQty !== undefined)) {
          initialState[item.productId] = {
            returned: String(batchItem.returnedPaidQty || 0),
            damaged: String(batchItem.damagedPaidQty || 0),
            free: String(batchItem.returnedFreeQty || 0)
          };
        } else {
          // Fallback: Aggregate split quantities from individual order items
          const productItems = batch.orders.flatMap(bo => bo.order?.items || []).filter(i => Number(i.productId) === Number(item.productId));
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
    let grossDispatchedValue = 0;

    dynamicOrders.forEach(bo => {
      finalAmount += bo.finalSoldAmount;
      bo.order.items.forEach(item => {
        const orderPaid = Number(item.quantity || 0);
        totalQty += orderPaid;
        totalFree += Number(item.deliveredFreeQuantity || 0);
        returned += Number(item.returnedPaidQuantity || 0);
        damaged += Number(item.damagedPaidQuantity || 0);
        finalSold += Number(item.deliveredPaidQuantity || 0);
        grossDispatchedValue += Math.round(orderPaid * Number(item.unitPrice || 0) * 100) / 100;
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
      grossDispatchedValue,
      returnAdjustedValue: Math.max(0, grossDispatchedValue - finalAmount),
      totalDueDraft,
      cashCollectable,
    };
  }, [dynamicOrders, draftDues]);

  // Reset states when batch ID changes to prevent stale data from previous batches
  useEffect(() => {
    setActualCashReceived('');
    setBatchReturnState({});
    cashManuallyEdited.current = false; // allow auto-fill for fresh batch
    try {
      const savedDues = sessionStorage.getItem(`draft_dues_${batchId}`);
      if (savedDues) {
        setDraftDues(JSON.parse(savedDues));
      } else {
        setDraftDues({});
      }
    } catch (e) {
      setDraftDues({});
    }
  }, [batchId]);

  // Sync draft dues to sessionStorage so page refresh won't lose entered dues
  useEffect(() => {
    try {
      if (Object.keys(draftDues).length > 0) {
        sessionStorage.setItem(`draft_dues_${batchId}`, JSON.stringify(draftDues));
      } else {
        sessionStorage.removeItem(`draft_dues_${batchId}`);
      }
    } catch (e) {}
  }, [draftDues, batchId]);

  const fetchBatch = async () => {
    try {
      setIsLoading(true);
      const data = await getDispatchBatch(batchId);
      setBatch(data);
      if (data.vanRent) setVanRent(String(data.vanRent));
      if (data.salary) setSalary(String(data.salary));
      if (data.oldDueCollectedAmount !== undefined && data.oldDueCollectedAmount !== null) {
        setOldDueCollected(String(data.oldDueCollectedAmount));
      }
      if (data.expenses && Array.isArray(data.expenses)) {
        setCustomExpenses(
          data.expenses.map((e: any) => ({
            id: String(e.id || Math.random()),
            expenseType: e.expenseType || 'Other',
            name: e.name || '',
            amount: String(e.amount || ''),
            note: e.note || '',
          })),
        );
      }
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

  const batchStatus = batch ? batchStatusConfig[batch.status] : null;
  const isBatchSettled = batch ? ['SETTLED', 'PARTIALLY_SETTLED'].includes(batch.status) : false;

  const currentGrossDispatched = useMemo(() => {
    if (isBatchSettled && batch && Number(batch.grossDispatchedValue || 0) > 0) {
      return Number(batch.grossDispatchedValue);
    }
    return Number(finalMetrics?.grossDispatchedValue || 0);
  }, [isBatchSettled, batch, finalMetrics]);

  const currentFinalAmount = useMemo(() => {
    if (isBatchSettled && batch) {
      return Number(batch.finalSoldValue || 0);
    }
    return Number(finalMetrics?.finalAmount || 0);
  }, [isBatchSettled, batch, finalMetrics]);

  const currentReturnAdjusted = useMemo(() => {
    return Math.max(0, currentGrossDispatched - currentFinalAmount);
  }, [currentGrossDispatched, currentFinalAmount]);

  const currentCustomerDue = useMemo(() => {
    if (isBatchSettled && batch) {
      return Number(batch.totalDueAmount || 0);
    }
    return Number(finalMetrics?.totalDueDraft || 0);
  }, [isBatchSettled, batch, finalMetrics]);

  const currentCashCollectable = useMemo(() => {
    return Math.max(0, currentFinalAmount - currentCustomerDue);
  }, [currentFinalAmount, currentCustomerDue]);

  const vanRentVal = Math.max(0, Number(vanRent || 0));
  const salaryVal = Math.max(0, Number(salary || 0));
  const oldDueCollectedVal = Math.max(0, Number(oldDueCollected || 0));
  const customExpensesTotalVal = customExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpensesVal = vanRentVal + salaryVal + customExpensesTotalVal;
  const netExpectedCashFromDeliveryMan = Math.max(0, currentCashCollectable + oldDueCollectedVal - totalExpensesVal);

  // Auto-fill actual cash received dynamically whenever netExpectedCashFromDeliveryMan updates,
  // unless admin has explicitly typed a custom amount manually.
  useEffect(() => {
    if (!cashManuallyEdited.current && netExpectedCashFromDeliveryMan >= 0) {
      setActualCashReceived(String(netExpectedCashFromDeliveryMan));
    }
  }, [netExpectedCashFromDeliveryMan]);

  // When viewing an already settled batch, sync actualCashReceived from batch record
  useEffect(() => {
    if (isBatchSettled && batch && batch.totalCollectedAmount !== undefined && batch.totalCollectedAmount !== null) {
      setActualCashReceived(String(batch.totalCollectedAmount));
    }
  }, [isBatchSettled, batch]);

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
        items: (bo.order?.items || []).map((item) => {
          const productId = Number(item.productId);
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
            orderItemId: item.id,
            productId,
            returnedPaidQuantity: takeRet,
            returnedFreeQuantity: takeFreeRet,
            damagedPaidQuantity: takeDam,
            damagedFreeQuantity: 0,
          };
        }),
      };
    });

    console.log('[handleSaveReturns] batchReturnState:', batchReturnState);
    console.log('[handleSaveReturns] ordersToUpdate:', JSON.stringify(ordersToUpdate));

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
                dueDate: d.dueDate || batch.dispatchDate,
                note: d.note || 'Added during batch settlement'
              });
            }
          });
        }
      });

      if (actualCashReceived === '' || actualCashReceived === null || actualCashReceived === undefined || isNaN(Number(actualCashReceived))) {
        showErrorToast('Actual Cash Received by Admin constraint: Cash received field is required!');
        return;
      }

      const vanRentNum = Math.max(0, Number(vanRent || 0));
      const salaryNum = Math.max(0, Number(salary || 0));
      const validExpenses = customExpenses
        .filter((e) => e.name.trim() && Number(e.amount || 0) > 0)
        .map((e) => ({
          expenseType: e.expenseType || 'Other',
          name: e.name.trim(),
          amount: Number(e.amount),
          note: e.note.trim() || undefined,
        }));

      // Complete Settlement
      await withLoading(() => settleDispatchBatch(batchId, {
        collections,
        dueEntries: dueEntries.length > 0 ? dueEntries : undefined,
        vanRent: vanRentNum,
        salary: salaryNum,
        oldDueCollectedAmount: oldDueCollectedVal,
        customExpenses: validExpenses.length > 0 ? validExpenses : undefined,
        actualCashReceived: Number(actualCashReceived),
        settlementDate: batch.dispatchDate ? (typeof batch.dispatchDate === 'string' ? batch.dispatchDate.slice(0, 10) : new Date(batch.dispatchDate).toISOString().slice(0, 10)) : undefined
      }), 'Settling batch...');

      showSuccessToast('Batch marked as settled and dues recorded');
      try { sessionStorage.removeItem(`draft_dues_${batchId}`); } catch (e) {}
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
    { id: 'sheet', label: 'Field Sheet (View)' },
    { id: 'entry', label: 'Return & Damage (Edit)' },
  ] as const;

  return (
    <div className="space-y-6 pb-24">
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
          
          body * {
            visibility: hidden !important;
          }

          .final-settlement-print,
          .final-settlement-print * {
            visibility: visible !important;
          }

          .final-settlement-print {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 6mm 8mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 8.5px !important;
            line-height: 1.2 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          table { 
            page-break-inside: auto; 
            border-collapse: collapse;
            width: 100% !important;
          }
          tr { 
            page-break-inside: avoid; 
            page-break-after: auto; 
          }
          
          /* Table spacing overrides */
          .final-settlement-print table th, 
          .final-settlement-print table td { 
            padding: 2px 3px !important; 
            font-size: 8px !important;
            line-height: 1.15 !important;
            border-color: #000000 !important;
          }
          
          .final-settlement-print .signature-grid {
            margin-top: 6px !important;
            padding-top: 4px !important;
          }
          
          .pb-24 { padding-bottom: 0 !important; }
          .min-h-screen { min-height: 0 !important; }
        }

        .final-settlement-print {
          display: none;
        }
      `}} />
      <div className="no-print space-y-4 sm:space-y-6">
        {/* Mobile Header Bar */}
        <div className="flex items-center justify-between bg-white px-3.5 py-2.5 border border-slate-200/90 rounded-2xl shadow-xs lg:hidden">
          <Link
            href="/delivery-ops"
            className="flex items-center gap-1.5 font-bold text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">Back</span>
          </Link>
          <h1 className="text-xs font-black uppercase tracking-wider text-slate-900">{batch.batchNo}</h1>
          <StatusBadge {...batchStatus} />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs">
          <div className="flex items-start gap-3.5">
            <Link
              href="/delivery-ops"
              className="hidden lg:flex rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-600 shadow-xs transition hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
                  {batch.batchNo}
                </h1>
                <div className="hidden lg:block">
                  <StatusBadge {...batchStatus} />
                </div>
              </div>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">
                {formatDate(batch.dispatchDate)} · {batch.assignedDeliveryMan?.name || batch.deliveryPerson?.name} · {batch.route.name}
              </p>
              {isBatchSettled && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                  <ShieldAlert className="h-3 w-3" />
                  Locked after settlement
                </div>
              )}
            </div>
          </div>

          {['DISPATCHED', 'RETURN_PENDING', 'PARTIALLY_SETTLED', 'SETTLED'].includes(batch.status) && (
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
              <button
                onClick={handlePrintFinalSettlement}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-800 shadow-xs transition hover:bg-slate-100 active:scale-95"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Settlement</span>
              </button>
              <button
                onClick={handleDeleteClick}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 px-3.5 py-2 text-xs font-black shadow-xs transition hover:bg-rose-100 active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Batch</span>
              </button>
            </div>
          )}

          {batch.status === 'DRAFT' && (
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
              <button
                onClick={() => handlePrintMorning()}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-800 shadow-xs transition hover:bg-slate-100 active:scale-95"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Morning Sheet</span>
              </button>
              <button
                onClick={handleDispatch}
                disabled={isDispatching}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow-sm transition active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                {isDispatching ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>অনুমোদন হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>অনুমোদন ও ফাইনাল ডিসপ্যাচ</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDeleteClick}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 px-3.5 py-2 text-xs font-black shadow-xs transition hover:bg-rose-100 active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/70">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-xl py-2 px-3 text-xs sm:text-sm font-black transition-all active:scale-95 ${activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
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
                      <td className="px-6 py-4 text-center font-medium text-slate-400">{formatUnitPrice(item.price)}</td>
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
                    <p className="text-sm font-bold text-slate-600">{formatUnitPrice(item.price)}</p>
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
          title="Return & Damage Entry"
          description="Enter actual field returns and damages."
          action={
            <div className="flex items-center gap-2">
              {!isBatchSettled && ['DISPATCHED', 'RETURN_PENDING'].includes(batch.status) && (
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<number, { returned: string; damaged: string; free: string }> = {};
                    aggregatedItems.forEach(item => {
                      next[item.productId] = { returned: '0', damaged: '0', free: '0' };
                    });
                    setBatchReturnState(next);
                    showSuccessToast('All returns and damages set to 0');
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-100 transition active:scale-95"
                >
                  Zero All
                </button>
              )}
              <button
                onClick={handleSaveReturns}
                disabled={isSavingReturns || isBatchSettled || !['DISPATCHED', 'RETURN_PENDING'].includes(batch.status)}
                className="rounded-xl bg-cyan-700 px-3.5 sm:px-6 py-1.5 sm:py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-cyan-700/20 hover:bg-cyan-800 transition active:scale-95 disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none"
              >
                <span className="inline-flex items-center gap-1.5">
                  {isSavingReturns ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{isBatchSettled ? 'Locked' : 'Save Returns'}</span>
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
                  const itemCashValue = Math.round(sold * item.price * 100) / 100;
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
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== '' && Number(val) > item.totalPaidQty) {
                              showErrorToast(`Return (Paid) cannot exceed total paid quantity (${item.totalPaidQty})`);
                            }
                            const clamped = val === '' ? '' : String(Math.min(item.totalPaidQty, Math.max(0, Number(val))));
                            setBatchReturnState(prev => ({
                              ...prev,
                              [item.productId]: { ...state, returned: clamped }
                            }));
                          }}
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
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== '' && Number(val) > item.totalFreeQty) {
                              showErrorToast(`Return (Free) cannot exceed total free quantity (${item.totalFreeQty})`);
                            }
                            const clamped = val === '' ? '' : String(Math.min(item.totalFreeQty, Math.max(0, Number(val))));
                            setBatchReturnState(prev => ({
                              ...prev,
                              [item.productId]: { ...state, free: clamped }
                            }));
                          }}
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

          {/* Mobile Ergonomic Entry Form */}
          <div className="lg:hidden p-3 space-y-3 bg-slate-50/60">
            {aggregatedItems.map((item, index) => {
              const state = batchReturnState[item.productId] || { returned: '0', damaged: '0', free: '0' };
              const q = item.totalPaidQty;
              const f = item.totalFreeQty;
              const r = Number(state.returned || 0);
              const d = Number(state.damaged || 0);

              const sold = Math.max(0, q - r - d);
              const itemCashValue = Math.round(sold * item.price * 100) / 100;
              const itemDraftDue = isBatchSettled
                ? batch.orders
                    .reduce((sum, bo) => sum + getDueForProductRow(bo, item.productId), 0)
                : batch.orders
                    .reduce((sum, bo) => sum + getDueForProductRow(bo, item.productId), 0);

              return (
                <div key={item.productId} className="rounded-2xl border border-slate-200/90 bg-white p-3.5 space-y-3 shadow-xs">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">#{index + 1}</span>
                        <h3 className="text-sm font-black text-slate-900 leading-snug truncate">{item.name}</h3>
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 mt-1">
                        Rate: <span className="text-slate-800 font-black">{formatCurrency(item.price)}</span>
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-black border border-slate-200">
                        Paid: {formatNumber(q)}
                      </span>
                      {f > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200">
                          +{formatNumber(f)} Free
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3 Color-Coded Field Inputs */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Return (Paid) */}
                    <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-2 space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-rose-700 block truncate">
                        Return (Paid)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={item.totalPaidQty}
                        value={state.returned}
                        disabled={isBatchSettled}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== '' && Number(val) > item.totalPaidQty) {
                            showErrorToast(`Return (Paid) cannot exceed ${item.totalPaidQty}`);
                          }
                          const clamped = val === '' ? '' : String(Math.min(item.totalPaidQty, Math.max(0, Number(val))));
                          setBatchReturnState(prev => ({
                            ...prev,
                            [item.productId]: { ...state, returned: clamped }
                          }));
                        }}
                        placeholder="0"
                        className="w-full rounded-lg border border-rose-200 bg-white py-1.5 px-1 text-center text-sm font-black text-rose-700 outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                      <span className="text-[9px] font-bold text-rose-400 block text-center truncate">Max {q}</span>
                    </div>

                    {/* Damage */}
                    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-2 space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-amber-700 block truncate">
                        Damage
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={Math.max(0, item.totalPaidQty - r)}
                        value={state.damaged}
                        disabled={isBatchSettled}
                        onChange={(e) => {
                          const val = e.target.value;
                          const maxDam = Math.max(0, item.totalPaidQty - r);
                          if (val !== '' && Number(val) > maxDam) {
                            showErrorToast(`Damage cannot exceed remaining paid (${maxDam})`);
                          }
                          const clamped = val === '' ? '' : String(Math.min(maxDam, Math.max(0, Number(val))));
                          setBatchReturnState(prev => ({
                            ...prev,
                            [item.productId]: { ...state, damaged: clamped }
                          }));
                        }}
                        placeholder="0"
                        className="w-full rounded-lg border border-amber-200 bg-white py-1.5 px-1 text-center text-sm font-black text-amber-700 outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <span className="text-[9px] font-bold text-amber-400 block text-center truncate">Max {Math.max(0, q - r)}</span>
                    </div>

                    {/* Return (Free) */}
                    <div className={`rounded-xl border p-2 space-y-1 ${
                      f > 0 
                        ? 'border-emerald-100 bg-emerald-50/40' 
                        : 'border-slate-100 bg-slate-50/50 opacity-60'
                    }`}>
                      <label className={`text-[10px] font-black uppercase tracking-wider block truncate ${
                        f > 0 ? 'text-emerald-700' : 'text-slate-400'
                      }`}>
                        Return (Free)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={item.totalFreeQty}
                        value={state.free}
                        disabled={isBatchSettled || f === 0}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val !== '' && Number(val) > item.totalFreeQty) {
                            showErrorToast(`Free Return cannot exceed ${item.totalFreeQty}`);
                          }
                          const clamped = val === '' ? '' : String(Math.min(item.totalFreeQty, Math.max(0, Number(val))));
                          setBatchReturnState(prev => ({
                            ...prev,
                            [item.productId]: { ...state, free: clamped }
                          }));
                        }}
                        placeholder={f > 0 ? '0' : '—'}
                        className={`w-full rounded-lg border py-1.5 px-1 text-center text-sm font-black outline-none ${
                          f > 0 
                            ? 'border-emerald-200 bg-white text-emerald-700 focus:ring-2 focus:ring-emerald-500/20' 
                            : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      />
                      <span className="text-[9px] font-bold text-slate-400 block text-center truncate">
                        {f > 0 ? `Max ${f}` : 'No Free'}
                      </span>
                    </div>
                  </div>

                  {/* Clean Result Metric Bar */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 flex items-center justify-between gap-2">
                    <div className="text-left">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Sold</span>
                      <span className="text-xs sm:text-sm font-black text-slate-900">{formatNumber(sold)} pcs</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 block">Due</span>
                      <span className="text-xs sm:text-sm font-black text-amber-600">{formatCurrency(itemDraftDue)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500 block">Cash</span>
                      <span className="text-xs sm:text-sm font-black text-emerald-600">{formatCurrency(Math.max(0, itemCashValue - itemDraftDue))}</span>
                    </div>
                  </div>

                  {/* Manage Due Button */}
                  <button
                    type="button"
                    onClick={() => setDueModalProduct({ id: item.productId, name: item.name })}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-98 ${
                      itemDraftDue > 0
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <HandCoins className="h-3.5 w-3.5 text-amber-600" />
                    <span>{itemDraftDue > 0 ? `Manage Due (${formatCurrency(itemDraftDue)})` : 'Add / Manage Due'}</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="lg:hidden p-4 border-t border-slate-100">
            <button
              onClick={handleSaveReturns}
              disabled={isSavingReturns || isBatchSettled || !['DISPATCHED', 'RETURN_PENDING'].includes(batch.status)}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-cyan-700 py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-cyan-700/20 hover:bg-cyan-800 transition active:scale-95 disabled:opacity-50 disabled:bg-slate-300"
            >
              {isSavingReturns ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Field Records</span>
            </button>
          </div>
        </PageCard>
      )}

      {/* Floating Sticky Save Bar on Mobile */}
      {activeTab === 'entry' && !isBatchSettled && ['DISPATCHED', 'RETURN_PENDING'].includes(batch.status) && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 lg:hidden z-40 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Cash Value</p>
              <p className="text-base font-black text-emerald-600 truncate">
                {formatCurrency(finalMetrics?.cashCollectable || 0)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveReturns}
              disabled={isSavingReturns}
              className="flex-1 max-w-[200px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-cyan-600/20 active:scale-95 disabled:opacity-50"
            >
              {isSavingReturns ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{isSavingReturns ? 'Saving...' : 'Save Returns'}</span>
            </button>
          </div>
        </div>
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
                <div className="space-y-5">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                    <span>Gross Cash Collectable:</span>
                    <span className="text-slate-900 font-black">{formatCurrency(currentCashCollectable)}</span>
                  </div>

                  {/* Old Due Collected Section */}
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase tracking-wider text-blue-900">
                        আগের বাকি আদায় (Old Due Collected)
                      </label>
                      <span className="text-xs font-bold text-blue-700">{formatCurrency(oldDueCollectedVal)}</span>
                    </div>
                    <p className="text-[11px] text-blue-600">
                      দোকানদার যদি পূর্বের কোনো বকেয়া টাকা ডেলিভারি ম্যানের কাছে পরিশোধ করে থাকেন, তা এখানে লিখুন।
                    </p>
                    <input
                      type="number"
                      value={oldDueCollected}
                      onChange={(e) => setOldDueCollected(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-base font-bold text-slate-900 outline-none focus:border-blue-600 shadow-xs"
                    />
                  </div>

                  {/* Expense Entry Section */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <p className="text-xs font-black uppercase text-slate-900 tracking-wider">Delivery Daily Expenses</p>
                      <p className="text-xs font-black text-rose-600">Total: {formatCurrency(totalExpensesVal)}</p>
                    </div>

                    {/* Default Field: Van Rent */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Van Rent</label>
                      <input
                        type="number"
                        value={vanRent}
                        onChange={(e) => setVanRent(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base font-bold text-slate-900 outline-none focus:border-slate-900 shadow-xs"
                      />
                    </div>

                    {/* Custom Expenses List */}
                    {customExpenses.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-slate-200">
                        <p className="text-[10px] font-black uppercase text-slate-500">Additional Expenses</p>
                        {customExpenses.map((exp, idx) => (
                          <div key={exp.id || idx} className="bg-white p-3 rounded-2xl border border-slate-200 space-y-2 shadow-xs">
                            {/* Top row: Name Input & Remove Button */}
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                placeholder="Expense description (e.g. Labor, Fuel, Food)"
                                value={exp.name}
                                onChange={(e) => {
                                  const updated = [...customExpenses];
                                  updated[idx].name = e.target.value;
                                  setCustomExpenses(updated);
                                }}
                                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-900 outline-none focus:bg-white focus:border-slate-900"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomExpenses(customExpenses.filter((_, i) => i !== idx));
                                }}
                                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
                                title="Remove Field"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Bottom row: Price Input */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">
                                {exp.name.trim() ? `${exp.name.trim()} (Amount ৳)` : 'Amount (৳)'}
                              </label>
                              <input
                                type="number"
                                placeholder="0.00"
                                value={exp.amount}
                                onChange={(e) => {
                                  const updated = [...customExpenses];
                                  updated[idx].amount = e.target.value;
                                  setCustomExpenses(updated);
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-slate-900"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setCustomExpenses([
                          ...customExpenses,
                          { id: String(Date.now()), expenseType: 'Other', name: '', amount: '', note: '' }
                        ]);
                      }}
                      className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 bg-white text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
                    >
                      + Add Expense
                    </button>
                  </div>

                  {/* Settlement Formula Card */}
                  <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                      <span>Gross Order / Dispatch Amount</span>
                      <span>{formatCurrency(currentGrossDispatched)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-medium text-rose-400">
                      <span>(-) Total Return Amount</span>
                      <span>- {formatCurrency(currentReturnAdjusted)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-white border-t border-white/10 pt-1.5">
                      <span>= Gross Sold Amount</span>
                      <span>{formatCurrency(currentFinalAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-medium text-rose-400">
                      <span>(-) Total Customer Due</span>
                      <span>- {formatCurrency(currentCustomerDue)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-400 border-t border-white/10 pt-1.5">
                      <span>= Gross Cash Collectable</span>
                      <span>{formatCurrency(currentCashCollectable)}</span>
                    </div>
                    {oldDueCollectedVal > 0 && (
                      <div className="flex justify-between items-center text-xs font-medium text-blue-400">
                        <span>(+) Old Due Collected (পুরোনো বাকি আদায়)</span>
                        <span>+ {formatCurrency(oldDueCollectedVal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs font-medium text-rose-400">
                      <span>(-) Total Daily Expenses</span>
                      <span>- {formatCurrency(totalExpensesVal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-black text-emerald-400 border-t-2 border-white/20 pt-2">
                      <span>= প্রত্যাশিত জমার পরিমাণ (৳) / Net Expected Cash</span>
                      <span>{formatCurrency(netExpectedCashFromDeliveryMan)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center justify-between">
                      <span>বাস্তবে জমা দেওয়া ক্যাশ (৳) / Actual Cash Received <span className="text-rose-600 font-black">*</span></span>
                      <span className="text-rose-600 font-bold text-[9px] uppercase tracking-normal">(Required)</span>
                    </label>
                    <input
                      type="number"
                      value={actualCashReceived}
                      onChange={(e) => {
                        cashManuallyEdited.current = true;
                        setActualCashReceived(e.target.value);
                      }}
                      placeholder={String(netExpectedCashFromDeliveryMan)}
                      className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 text-2xl font-black text-slate-900 focus:border-slate-900 outline-none transition-all"
                    />
                  </div>

                  {/* Difference Card */}
                  {actualCashReceived !== '' && (
                    <div className={`rounded-2xl p-4 border ${
                      Math.abs(Number(actualCashReceived) - netExpectedCashFromDeliveryMan) < 0.01
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : Number(actualCashReceived) < netExpectedCashFromDeliveryMan
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}>
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase tracking-widest">
                          হিসাবের পার্থক্য (৳):{' '}
                          {Math.abs(Number(actualCashReceived) - netExpectedCashFromDeliveryMan) < 0.01
                            ? 'Balanced (হিসাব মিলেছে)'
                            : Number(actualCashReceived) < netExpectedCashFromDeliveryMan
                            ? 'Shortage (ঘাটতি)'
                            : 'Excess (উদ্বৃত্ত)'}
                        </p>
                        <p className="text-lg font-black">
                          {formatCurrency(Math.abs(Number(actualCashReceived) - netExpectedCashFromDeliveryMan))}
                        </p>
                      </div>
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
              className="w-full sm:max-w-md flex items-center justify-center gap-3 rounded-none border-4 border-slate-900 bg-slate-900 px-6 sm:px-12 py-4 text-base sm:text-lg font-black uppercase tracking-widest text-white transition hover:bg-white hover:text-slate-900 disabled:opacity-50 disabled:bg-slate-400 disabled:border-slate-400 cursor-pointer"
            >
              {isSettling ? <RefreshCw className="h-5 w-5 animate-spin" /> : <HandCoins className="h-5 w-5" />}
              {isSettling ? 'প্রক্রিয়াধীন...' : 'জমা নিশ্চিত করুন (Confirm & Settle Batch)'}
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
        defaultDueDate={batch.dispatchDate}
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
        {/* TOP HEADER: Store Name & Mobile Number */}
        <div className="text-center mb-1 pb-1 border-b border-black">
          <h1 className="text-base font-black uppercase tracking-tight text-black leading-tight">
            M/S KARIM TRADERS
          </h1>
          <p className="text-[9.5px] font-bold text-slate-700 tabular-nums">
            Mob: 01763-088369 · Pirgachha
          </p>
          <div className="text-[8.5px] font-black uppercase tracking-wider text-black mt-0.5">
            Final Batch Settlement
          </div>
        </div>

        {/* LOGISTICS ROW: Left Side (Route, Delivery Man) & Right Side (Batch ID, Date) - COMPACT */}
        <div className="grid grid-cols-2 gap-2 mb-1.5 text-[8.5px] border-b border-black pb-1 leading-tight">
          <div className="space-y-0.5">
            <div className="flex gap-1.5 items-center">
              <span className="font-bold text-slate-600 text-[8px] uppercase">Route:</span>
              <span className="font-black uppercase text-black">{batch.route?.name || 'N/A'}</span>
            </div>
            <div className="flex gap-1.5 items-center">
              <span className="font-bold text-slate-600 text-[8px] uppercase">Delivery Man:</span>
              <span className="font-black uppercase text-black">{batch.assignedDeliveryMan?.name || batch.deliveryPerson?.name || 'N/A'}</span>
            </div>
          </div>
          <div className="space-y-0.5 text-right">
            <div className="flex justify-end gap-1.5 items-center">
              <span className="font-bold text-slate-600 text-[8px] uppercase">Batch ID:</span>
              <span className="font-black tabular-nums text-black">#BT-{batch.id}</span>
            </div>
            <div className="flex justify-end gap-1.5 items-center">
              <span className="font-bold text-slate-600 text-[8px] uppercase">Date:</span>
              <span className="font-black tabular-nums text-black">{formatDate(batch.dispatchedAt || batch.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* 12-COLUMN ITEMS TABLE */}
        <table className="w-full border border-black text-[8px] mb-2 border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-black font-black uppercase text-[7.5px] leading-tight">
              <th className="border-r border-black px-1 py-1 text-center w-5">SL</th>
              <th className="border-r border-black px-1.5 py-1 text-left">Product Name</th>
              <th className="border-r border-black px-1 py-1 text-center w-10">Paid Qty</th>
              <th className="border-r border-black px-1 py-1 text-center w-10">Free Sent</th>
              <th className="border-r border-black px-1 py-1 text-center w-10">Ret (Paid)</th>
              <th className="border-r border-black px-1 py-1 text-center w-10">Ret (Free)</th>
              <th className="border-r border-black px-1 py-1 text-center w-10">Dam (Paid)</th>
              <th className="border-r border-black px-1 py-1 text-center w-10">Final Sold</th>
              <th className="border-r border-black px-1 py-1 text-center w-10">Del. Free</th>
              <th className="border-r border-black px-1 py-1 text-right w-14">Unit Price</th>
              <th className="border-r border-black px-1 py-1 text-right w-16">Final Amount</th>
              <th className="px-1 py-1 text-right w-12 bg-rose-50 text-rose-900">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {aggregatedItems.map((item, idx) => {
              const state = batchReturnState[item.productId] || { returned: '0', damaged: '0', free: '0' };
              const rPaid = Number(state.returned || 0);
              const rFree = Number(state.free || 0);
              const dPaid = Number(state.damaged || 0);
              const finalSold = Math.max(0, item.totalPaidQty - rPaid - dPaid);
              const deliveredFree = Math.max(0, item.totalFreeQty - rFree);

              const itemFinalSoldAmount = (() => {
                const batchItem = (batch.items || []).find((bi: any) => Number(bi.productId) === Number(item.productId)) as any;
                if (isBatchSettled && batchItem && Number(batchItem.finalSoldAmount || 0) > 0) {
                  return Number(batchItem.finalSoldAmount);
                }
                const calc = dynamicOrders.reduce((sum, bo) => {
                  const itemInOrder = bo.order.items.find((i: any) => Number(i.productId) === Number(item.productId));
                  if (!itemInOrder) return sum;
                  const finalPaidDelivered = Number(itemInOrder.deliveredPaidQuantity || 0);
                  const orderPaid = Number(itemInOrder.quantity || 0);
                  const unitPriceAfterItemDiscount = orderPaid > 0 ? Number(itemInOrder.lineTotal || 0) / orderPaid : 0;
                  const itemSold = finalPaidDelivered * unitPriceAfterItemDiscount;
                  const subtotal = Number(bo.order.subtotal || 0);
                  const invoiceDiscountApplied = subtotal > 0
                    ? Number(bo.order.discountAmount || 0) * (itemSold / subtotal)
                    : 0;
                  return sum + Math.max(0, itemSold - invoiceDiscountApplied);
                }, 0);
                return Math.round((calc > 0 ? calc : finalSold * item.price) * 100) / 100;
              })();

              const itemDue = dynamicOrders
                .reduce((sum, bo) => {
                  return sum + getDueForProductRow(bo, item.productId);
                }, 0);

              return (
                <tr key={item.productId} className="font-semibold text-[8px] leading-snug">
                  <td className="border-r border-black px-1 py-0.5 text-center text-slate-500 tabular-nums">{idx + 1}</td>
                  <td className="border-r border-black px-1.5 py-0.5 font-bold truncate max-w-[140px]">{item.name}</td>
                  <td className="border-r border-black px-1 py-0.5 text-center tabular-nums">{formatNumber(item.totalPaidQty)}</td>
                  <td className="border-r border-black px-1 py-0.5 text-center tabular-nums">{formatNumber(item.totalFreeQty)}</td>
                  <td className="border-r border-black px-1 py-0.5 text-center text-rose-600 tabular-nums">{rPaid > 0 ? formatNumber(rPaid) : '—'}</td>
                  <td className="border-r border-black px-1 py-0.5 text-center text-rose-500 tabular-nums">{rFree > 0 ? formatNumber(rFree) : '—'}</td>
                  <td className="border-r border-black px-1 py-0.5 text-center text-amber-600 tabular-nums">{dPaid > 0 ? formatNumber(dPaid) : '—'}</td>
                  <td className="border-r border-black px-1 py-0.5 text-center text-blue-700 font-bold tabular-nums">{formatNumber(finalSold)}</td>
                  <td className="border-r border-black px-1 py-0.5 text-center text-emerald-700 font-bold tabular-nums">{formatNumber(deliveredFree)}</td>
                  <td className="border-r border-black px-1 py-0.5 text-right font-bold text-slate-600 tabular-nums">{formatUnitPrice(item.price)}</td>
                  <td className="border-r border-black px-1 py-0.5 text-right font-black tabular-nums">{formatCurrency(itemFinalSoldAmount)}</td>
                  <td className={`px-1 py-0.5 text-right font-black tabular-nums ${itemDue > 0 ? 'text-rose-700 bg-rose-50/70' : 'text-slate-300'}`}>
                    {itemDue > 0 ? formatCurrency(itemDue) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-black bg-slate-50 font-black uppercase text-[8.5px]">
            <tr>
              <td colSpan={7} className="border-r border-black px-2 py-1 text-right">Batch Grand Totals:</td>
              <td className="border-r border-black px-1 py-1 text-center text-blue-700 tabular-nums">{formatNumber(finalMetrics?.finalSold || 0)}</td>
              <td className="border-r border-black px-1 py-1 text-center text-emerald-700 tabular-nums">{formatNumber(finalMetrics?.totalFree || 0)}</td>
              <td className="border-r border-black px-1 py-1 text-center text-slate-400">—</td>
              <td className="border-r border-black px-1 py-1 text-right text-slate-900 tabular-nums">{formatCurrency(currentFinalAmount)}</td>
              <td className="px-1 py-1 text-right text-rose-700 bg-rose-50 tabular-nums">{currentCustomerDue > 0 ? formatCurrency(currentCustomerDue) : '—'}</td>
            </tr>
            <tr className="border-t border-black bg-white text-black">
              <td colSpan={10} className="border-r border-black px-2 py-1 text-right font-black">Cash Collected:</td>
              <td colSpan={2} className="px-1 py-1 text-right font-black text-black tabular-nums">{formatCurrency(isBatchSettled ? (batch.totalCollectedAmount || 0) : Number(actualCashReceived || netExpectedCashFromDeliveryMan))}</td>
            </tr>
          </tfoot>
        </table>

        {/* Settlement Financial & Expense Reconciliation Table */}
        <div className="border border-black p-2 mb-2 bg-white text-[8px] leading-tight">
          <h3 className="font-black uppercase tracking-wider text-[8.5px] border-b border-black pb-1 mb-1.5">
            Settlement Reconciliation & Daily Expenses Breakdown
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Left Column: Expenses Itemization */}
            <div className="space-y-1 border-r border-slate-300 pr-3">
              <p className="font-black uppercase text-[8px] text-slate-700 border-b border-slate-200 pb-0.5">
                Delivery Daily Expenses:
              </p>

              <div className="flex justify-between font-semibold">
                <span>1. Van Rent:</span>
                <span className="tabular-nums">{formatCurrency(isBatchSettled ? Number(batch.vanRent || 0) : vanRentVal)}</span>
              </div>

              {Number(isBatchSettled ? (batch.salary || 0) : salaryVal) > 0 && (
                <div className="flex justify-between font-semibold">
                  <span>2. Salary / Labor:</span>
                  <span className="tabular-nums">{formatCurrency(isBatchSettled ? Number(batch.salary || 0) : salaryVal)}</span>
                </div>
              )}

              {/* Custom Expenses List */}
              {(isBatchSettled ? (batch.expenses || []) : customExpenses.filter(e => e.name.trim() && Number(e.amount || 0) > 0)).map((exp: any, i: number) => (
                <div key={exp.id || i} className="flex justify-between font-semibold text-slate-800">
                  <span>{i + (Number(isBatchSettled ? (batch.salary || 0) : salaryVal) > 0 ? 3 : 2)}. {exp.name}:</span>
                  <span className="tabular-nums">{formatCurrency(Number(exp.amount || 0))}</span>
                </div>
              ))}

              <div className="flex justify-between font-black text-rose-700 border-t border-black pt-1 mt-1 text-[8.5px]">
                <span>Total Expenses:</span>
                <span className="tabular-nums">- {formatCurrency(isBatchSettled ? Number(batch.totalExpenses || 0) : totalExpensesVal)}</span>
              </div>
            </div>

            {/* Right Column: Simplified Cash Reconciliation (Total Sale & Total Costing) */}
            <div className="space-y-1.5 font-semibold">
              <p className="font-black uppercase text-[8px] text-slate-700 border-b border-slate-200 pb-0.5">
                Cash Reconciliation:
              </p>

              <div className="flex justify-between font-bold text-slate-900">
                <span>Total Sale:</span>
                <span className="tabular-nums font-black">{formatCurrency(currentFinalAmount)}</span>
              </div>

              {currentCustomerDue > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>(-) Total Customer Due / Baki:</span>
                  <span className="tabular-nums font-bold">- {formatCurrency(currentCustomerDue)}</span>
                </div>
              )}

              <div className="flex justify-between text-rose-700 font-bold">
                <span>(-) Total Costing:</span>
                <span className="tabular-nums">- {formatCurrency(isBatchSettled ? Number(batch.totalExpenses || 0) : totalExpensesVal)}</span>
              </div>

              <div className="flex justify-between border-t border-black pt-1 font-black text-black text-[8.5px]">
                <span>= Net Cash (Collectable):</span>
                <span className="tabular-nums">{formatCurrency(netExpectedCashFromDeliveryMan)}</span>
              </div>

              <div className="flex justify-between bg-slate-100 p-1 font-black text-slate-900 border border-black text-[8.5px]">
                <span>Actual Cash Received:</span>
                <span className="tabular-nums">{formatCurrency(isBatchSettled ? Number(batch.totalCollectedAmount || 0) : Number(actualCashReceived || netExpectedCashFromDeliveryMan))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-2 signature-grid text-center text-[8.5px]">
          <div>
            <div className="border-t border-black mx-auto w-32 pt-1 font-black uppercase tracking-wider">Delivery Man Signature</div>
            <p className="text-[7.5px] font-bold text-slate-500 mt-0.5 uppercase">{batch.assignedDeliveryMan?.name || batch.deliveryPerson?.name}</p>
          </div>
          <div>
            <div className="border-t border-black mx-auto w-32 pt-1 font-black uppercase tracking-wider">Authorized Admin Signature</div>
            <p className="text-[7.5px] font-bold text-slate-500 mt-0.5 uppercase">Warehouse Management</p>
          </div>
        </div>

        {/* Page End Footer Disclaimer */}
        <div className="text-center pt-2.5 mt-2 border-t border-slate-300">
          <p className="text-[9px] font-bold text-slate-900 tracking-wide">
            * বিক্রিত পণ্য ফেরত নেওয়া হয় না *
          </p>
        </div>
      </div>


      {dueModalProduct && (
        <DueModal
          isOpen={!!dueModalProduct}
          onClose={() => setDueModalProduct(null)}
          productName={dueModalProduct.name}
          productId={dueModalProduct.id}
          batchOrders={dynamicOrders}
          draftDues={draftDues}
          route={batch.route}
          companyId={batch.companyId}
          defaultDueDate={batch.dispatchDate}
          onAddDraftDue={(orderId, dues) => {
            if (dueModalProduct) {
              const key = `${orderId}_${dueModalProduct.id}`;
              setDraftDues((prev) => ({
                ...prev,
                [key]: dues,
              }));
            }
          }}
          onSuccess={() => {
            fetchBatch();
          }}
        />
      )}

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
