'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Truck,
  MapPin,
  Calendar,
  User,
  Package,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Receipt,
  DollarSign,
  Fuel,
  Store,
  ChevronDown,
  ChevronRight,
  X,
  RefreshCw,
  Search,
  Check,
  Send,
  Boxes,
  Gift,
  ArrowRight,
  ShieldCheck,
  Clock,
  Trash2,
  FileText,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/toast-provider';
import {
  getDispatchBatches,
  getDispatchBatch,
  recordBatchReturns,
  settleDispatchBatch,
} from '@/lib/api/delivery-ops';
import { getShops, createShop } from '@/lib/api/shops';
import { formatCurrency, formatNumber, getTodayBDDate } from '@/lib/utils/format';
import type { DispatchBatch, Shop } from '@/types/api';

interface ReturnRecord {
  id: string;
  shopId: number;
  shopName: string;
  productId: number;
  productName: string;
  returnedPaidQty: number;
  damagedPaidQty: number;
  unitPrice: number;
  reason: string;
  time: string;
}

interface NewDueRecord {
  id: string;
  shopId: number;
  shopName: string;
  dueAmount: number;
  note: string;
  time: string;
}

interface OldDueCollectionRecord {
  id: string;
  shopId: number;
  shopName: string;
  collectedAmount: number;
  paymentMode: 'CASH' | 'BKASH' | 'OTHER';
  note: string;
  time: string;
}

interface ExpenseRecord {
  id: string;
  category: 'VAN_RENT' | 'FUEL' | 'OTHER';
  amount: number;
  note: string;
  time: string;
}

export function MyDeliveriesPage({ filterStatus }: { filterStatus?: string } = {}) {
  const { user } = useAuth();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batches, setBatches] = useState<DispatchBatch[]>([]);
  const [activeBatch, setActiveBatch] = useState<DispatchBatch | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);

  // Navigation tab for the delivery man
  const [activeTab, setActiveTab] = useState<'van' | 'actions' | 'settlement'>('actions');

  // Recorded exceptions on the road (persisted per batch in localStorage)
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [newDueRecords, setNewDueRecords] = useState<NewDueRecord[]>([]);
  const [oldDueRecords, setOldDueRecords] = useState<OldDueCollectionRecord[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);

  // Actual cash handed over to father
  const [actualCashHandedOver, setActualCashHandedOver] = useState<string>('');

  // Modals state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isDueModalOpen, setIsDueModalOpen] = useState(false);
  const [isOldDueModalOpen, setIsOldDueModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isNewShopModalOpen, setIsNewShopModalOpen] = useState(false);
  const [isConfirmSubmitModalOpen, setIsConfirmSubmitModalOpen] = useState(false);

  // Return modal form state
  const [returnShopId, setReturnShopId] = useState<number | ''>('');
  const [returnProductId, setReturnProductId] = useState<number | ''>('');
  const [returnPaidQty, setReturnPaidQty] = useState<number>(0);
  const [returnDamagedQty, setReturnDamagedQty] = useState<number>(0);
  const [returnReason, setReturnReason] = useState<string>('দোকান নেয়নি / অবিক্রীত');

  // New Due modal form state
  const [dueShopId, setDueShopId] = useState<number | ''>('');
  const [dueAmountInput, setDueAmountInput] = useState<string>('');
  const [dueNote, setDueNote] = useState<string>('');

  // Old Due modal form state
  const [oldDueShopId, setOldDueShopId] = useState<number | ''>('');
  const [oldDueAmountInput, setOldDueAmountInput] = useState<string>('');
  const [oldDuePaymentMode, setOldDuePaymentMode] = useState<'CASH' | 'BKASH' | 'OTHER'>('CASH');
  const [oldDueNote, setOldDueNote] = useState<string>('');

  // Expense modal form state
  const [expenseCategory, setExpenseCategory] = useState<'VAN_RENT' | 'FUEL' | 'OTHER'>('VAN_RENT');
  const [expenseAmountInput, setExpenseAmountInput] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');

  // Quick Add Shop modal form state
  const [newShopName, setNewShopName] = useState('');
  const [newShopOwner, setNewShopOwner] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [isCreatingShop, setIsCreatingShop] = useState(false);

  // Storage key for active batch road records
  const storageKey = useMemo(() => {
    return activeBatch ? `dm_road_records_batch_${activeBatch.id}` : '';
  }, [activeBatch]);

  // 1. Fetch Assigned Batches and Master Shops
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [batchesRes, shopsRes] = await Promise.all([
        getDispatchBatches().catch(() => []),
        getShops({ limit: 1000 }).catch(() => []),
      ]);

      const batchList: DispatchBatch[] = Array.isArray(batchesRes)
        ? batchesRes
        : batchesRes.items || [];
      setBatches(batchList);

      const shopList: Shop[] = Array.isArray(shopsRes) ? shopsRes : shopsRes.items || [];
      setShops(shopList);

      // Auto-select today's active batch assigned to this delivery man
      if (batchList.length > 0) {
        // Prefer un-settled batches first
        const active =
          batchList.find(
            (b) =>
              b.status !== 'SETTLED' &&
              (b.assignedDeliveryManId === user?.id || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'),
          ) || batchList[0];

        // Fetch full batch with loaded items and orders
        try {
          const fullBatch = await getDispatchBatch(active.id);
          setActiveBatch(fullBatch);
        } catch {
          setActiveBatch(active);
        }
      }
    } catch (err: any) {
      showErrorToast(err.message || 'ডাটা লোড করতে ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
    }
  }, [user, showErrorToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 2. Load and persist road records from localStorage
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.returnRecords)) setReturnRecords(parsed.returnRecords);
        if (Array.isArray(parsed.newDueRecords)) setNewDueRecords(parsed.newDueRecords);
        if (Array.isArray(parsed.oldDueRecords)) setOldDueRecords(parsed.oldDueRecords);
        if (Array.isArray(parsed.expenseRecords)) setExpenseRecords(parsed.expenseRecords);
        if (parsed.actualCashHandedOver) setActualCashHandedOver(parsed.actualCashHandedOver);
      }
    } catch {
      // Local storage unavailable
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const dataToSave = {
        returnRecords,
        newDueRecords,
        oldDueRecords,
        expenseRecords,
        actualCashHandedOver,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    } catch {
      // Local storage full or blocked
    }
  }, [storageKey, returnRecords, newDueRecords, oldDueRecords, expenseRecords, actualCashHandedOver]);

  // Extract products loaded in this specific morning summary batch
  const loadedBatchProducts = useMemo(() => {
    if (!activeBatch) return [];
    // If batch has items relation
    if (activeBatch.items && activeBatch.items.length > 0) {
      return activeBatch.items.map((it) => ({
        productId: it.productId,
        name: it.product?.name || `পণ্য #${it.productId}`,
        sku: it.product?.sku || '',
        packSize: Number(it.product?.defaultCartonSize || 1),
        unitPrice: Number(it.unitPrice || it.product?.salePrice || 0),
        loadedQty: Number(it.totalDispatchedQty || 0),
        unit: it.product?.unit || 'PCS',
      }));
    }
    // Fallback: extract from orders
    const map = new Map<number, any>();
    activeBatch.orders?.forEach((bo) => {
      bo.order?.items?.forEach((item) => {
        if (!map.has(item.productId)) {
          map.set(item.productId, {
            productId: item.productId,
            name: item.product?.name || `পণ্য #${item.productId}`,
            sku: item.product?.sku || '',
            packSize: Number(item.product?.defaultCartonSize || 1),
            unitPrice: Number(item.unitPrice || 0),
            loadedQty: Number(item.quantity || 0) + Number(item.freeQuantity || 0),
            unit: item.product?.unit || 'PCS',
          });
        }
      });
    });
    return Array.from(map.values());
  }, [activeBatch]);

  // 3. Mathematical Live Reconciliation
  const metrics = useMemo(() => {
    const grossLoadedValue = Number(activeBatch?.grossDispatchedValue || 0);

    // Sum of returned goods value
    const totalReturnsValue = returnRecords.reduce(
      (sum, r) => sum + (r.returnedPaidQty + r.damagedPaidQty) * r.unitPrice,
      0,
    );

    // Actual sold value
    const netSoldValue = Math.max(0, grossLoadedValue - totalReturnsValue);

    // Sum of new dues left at shops
    const totalNewDues = newDueRecords.reduce((sum, d) => sum + d.dueAmount, 0);

    // Sum of old dues collected
    const totalOldDues = oldDueRecords.reduce((sum, o) => sum + o.collectedAmount, 0);

    // Sum of expenses
    const totalExpenses = expenseRecords.reduce((sum, e) => sum + e.amount, 0);

    // Expected cash delivery man must hand over to father
    const expectedCashToHandOver = Math.max(
      0,
      netSoldValue - totalNewDues + totalOldDues - totalExpenses,
    );

    // Actual cash entered by delivery man
    const actualCashNumber = parseFloat(actualCashHandedOver) || 0;
    const discrepancy = actualCashNumber - expectedCashToHandOver;

    return {
      grossLoadedValue,
      totalReturnsValue,
      netSoldValue,
      totalNewDues,
      totalOldDues,
      totalExpenses,
      expectedCashToHandOver,
      actualCashNumber,
      discrepancy,
      isShortage: discrepancy < -1,
      isSurplus: discrepancy > 1,
      isBalanced: Math.abs(discrepancy) <= 1,
    };
  }, [activeBatch, returnRecords, newDueRecords, oldDueRecords, expenseRecords, actualCashHandedOver]);

  // 4. Quick Add Shop on the road
  const handleCreateNewShop = async () => {
    if (!newShopName.trim()) {
      showErrorToast('দোকানের নাম দেওয়া আবশ্যক');
      return;
    }
    if (!activeBatch?.routeId) {
      showErrorToast('রুট শনাক্ত করা যায়নি');
      return;
    }

    try {
      setIsCreatingShop(true);
      const newShop = await createShop({
        name: newShopName.trim(),
        ownerName: newShopOwner.trim() || undefined,
        phone: newShopPhone.trim() || undefined,
        address: newShopAddress.trim() || undefined,
        routeId: activeBatch.routeId,
        companyId: activeBatch.companyId || (activeBatch.company?.id ?? 1),
        isActive: true,
      });

      setShops((prev) => [newShop, ...prev]);
      showSuccessToast(`"${newShop.name}" সফলভাবে যুক্ত হয়েছে!`);

      // If called from due modal, select it automatically
      if (isDueModalOpen) setDueShopId(newShop.id);
      if (isReturnModalOpen) setReturnShopId(newShop.id);
      if (isOldDueModalOpen) setOldDueShopId(newShop.id);

      setNewShopName('');
      setNewShopOwner('');
      setNewShopPhone('');
      setNewShopAddress('');
      setIsNewShopModalOpen(false);
    } catch (err: any) {
      showErrorToast(err.message || 'নতুন দোকান তৈরি করতে সমস্যা হয়েছে');
    } finally {
      setIsCreatingShop(false);
    }
  };

  // 5. Add Return Record
  const handleAddReturn = () => {
    if (!returnShopId) {
      showErrorToast('দয়া করে দোকান নির্বাচন করুন');
      return;
    }
    if (!returnProductId) {
      showErrorToast('দয়া করে পণ্য নির্বাচন করুন');
      return;
    }
    if (returnPaidQty <= 0 && returnDamagedQty <= 0) {
      showErrorToast('কমপক্ষে ১ পিস ফেরত বা ড্যামেজ উল্লেখ করুন');
      return;
    }

    const shop = shops.find((s) => s.id === Number(returnShopId));
    const prod = loadedBatchProducts.find((p) => p.productId === Number(returnProductId));

    const record: ReturnRecord = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shopId: Number(returnShopId),
      shopName: shop?.name || `দোকান #${returnShopId}`,
      productId: Number(returnProductId),
      productName: prod?.name || `পণ্য #${returnProductId}`,
      returnedPaidQty: returnPaidQty,
      damagedPaidQty: returnDamagedQty,
      unitPrice: prod?.unitPrice || 0,
      reason: returnReason,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setReturnRecords((prev) => [record, ...prev]);
    showSuccessToast(`ফেরত রেকর্ড যোগ হয়েছে: ${prod?.name}`);

    // Reset & close
    setReturnPaidQty(0);
    setReturnDamagedQty(0);
    setIsReturnModalOpen(false);
  };

  // 6. Add New Due Record
  const handleAddNewDue = () => {
    if (!dueShopId) {
      showErrorToast('দয়া করে দোকান নির্বাচন করুন');
      return;
    }
    const amt = parseFloat(dueAmountInput);
    if (!amt || amt <= 0) {
      showErrorToast('বকেয়া টাকার সঠিক পরিমাণ লিখুন');
      return;
    }

    const shop = shops.find((s) => s.id === Number(dueShopId));

    const record: NewDueRecord = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shopId: Number(dueShopId),
      shopName: shop?.name || `দোকান #${dueShopId}`,
      dueAmount: amt,
      note: dueNote.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setNewDueRecords((prev) => [record, ...prev]);
    showSuccessToast(`নতুন বাকি যোগ হয়েছে: ${formatCurrency(amt)}`);

    // Reset & close
    setDueAmountInput('');
    setDueNote('');
    setIsDueModalOpen(false);
  };

  // 7. Add Old Due Collection Record
  const handleAddOldDueCollection = () => {
    if (!oldDueShopId) {
      showErrorToast('দয়া করে দোকান নির্বাচন করুন');
      return;
    }
    const amt = parseFloat(oldDueAmountInput);
    if (!amt || amt <= 0) {
      showErrorToast('আদায়কৃত টাকার সঠিক পরিমাণ লিখুন');
      return;
    }

    const shop = shops.find((s) => s.id === Number(oldDueShopId));

    const record: OldDueCollectionRecord = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shopId: Number(oldDueShopId),
      shopName: shop?.name || `দোকান #${oldDueShopId}`,
      collectedAmount: amt,
      paymentMode: oldDuePaymentMode,
      note: oldDueNote.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setOldDueRecords((prev) => [record, ...prev]);
    showSuccessToast(`পুরোনো বাকি আদায় যোগ হয়েছে: ${formatCurrency(amt)}`);

    // Reset & close
    setOldDueAmountInput('');
    setOldDueNote('');
    setIsOldDueModalOpen(false);
  };

  // 8. Add Expense Record
  const handleAddExpense = () => {
    const amt = parseFloat(expenseAmountInput);
    if (!amt || amt <= 0) {
      showErrorToast('খরচের টাকার সঠিক পরিমাণ লিখুন');
      return;
    }

    const record: ExpenseRecord = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category: expenseCategory,
      amount: amt,
      note: expenseNote.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setExpenseRecords((prev) => [record, ...prev]);
    showSuccessToast(`খরচ যোগ হয়েছে: ${formatCurrency(amt)}`);

    // Reset & close
    setExpenseAmountInput('');
    setExpenseNote('');
    setIsExpenseModalOpen(false);
  };

  // 9. Submit Final Settlement to Father / Super Admin
  const handleFinalSubmit = async () => {
    if (!activeBatch) return;

    try {
      setIsSubmitting(true);

      // 1. If any returns exist, post returns payload
      if (returnRecords.length > 0 && activeBatch.orders && activeBatch.orders.length > 0) {
        const orderId = activeBatch.orders[0].orderId;
        const itemsPayload = returnRecords.map((r) => ({
          productId: r.productId,
          returnedPaidQuantity: r.returnedPaidQty,
          returnedFreeQuantity: 0,
          damagedPaidQuantity: r.damagedPaidQty,
          damagedFreeQuantity: 0,
          reason: r.reason,
          note: `দোকান: ${r.shopName}`,
        }));

        await recordBatchReturns(activeBatch.id, {
          note: 'ডেলিভারি ম্যান রোড রিটার্ন',
          orders: [
            {
              orderId,
              returnReason: 'দোকানদার নেয়নি বা ড্যামেজ',
              items: itemsPayload,
            },
          ],
        });
      }

      // 2. Post final settlement payload
      const customExpenses = expenseRecords.map((e) => ({
        expenseType: e.category,
        name: e.category === 'VAN_RENT' ? 'ভ্যান ভাড়া' : e.category === 'FUEL' ? 'জ্বালানি' : 'অন্যান্য খরচ',
        amount: e.amount,
        note: e.note,
      }));

      const dueEntries = newDueRecords.map((d) => ({
        orderId: activeBatch.orders?.[0]?.orderId || 0,
        amount: d.dueAmount,
        note: `দোকান: ${d.shopName} - ${d.note}`,
        shopId: d.shopId,
      }));

      await settleDispatchBatch(activeBatch.id, {
        note: `ডেলিভারি ম্যান মোবাইল সেটেলমেন্ট সাবমিট। ক্যাশ হস্তান্তর: ৳ ${metrics.actualCashNumber}`,
        settlementDate: getTodayBDDate(),
        oldDueCollectedAmount: metrics.totalOldDues,
        vanRent: expenseRecords.filter((e) => e.category === 'VAN_RENT').reduce((s, e) => s + e.amount, 0),
        customExpenses,
        dueEntries,
        actualCashReceived: metrics.actualCashNumber,
        collections: [
          {
            orderId: activeBatch.orders?.[0]?.orderId || 0,
            collectedAmount: metrics.actualCashNumber,
            paymentMode: 'CASH',
            note: 'ডেলিভারি ম্যান ক্যাশ জমা',
          },
        ],
      });

      // Clear local records
      if (storageKey) localStorage.removeItem(storageKey);

      showSuccessToast('দিনের হিসাব সফলভাবে বাবার কাছে জমা দেওয়া হয়েছে!');
      setIsConfirmSubmitModalOpen(false);
      void loadData();
    } catch (err: any) {
      showErrorToast(err.message || 'হিসাব জমা দিতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
        <div className="text-sm font-bold text-slate-700">ভ্যান লোডিং চালান লোড হচ্ছে...</div>
      </div>
    );
  }

  // If no batch is assigned yet
  if (!activeBatch) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-3xl bg-blue-50 text-blue-600 border border-blue-200">
          <Truck className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-black text-slate-900">আজকের জন্য কোনো ভ্যান চালান পাওয়া যায়নি</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
          বাবা সকালে কার্টুন স্ক্যান করে ভ্যান লোডিং চালান কনফার্ম করলেই আপনার ফোনে স্বয়ংক্রিয়ভাবে
          আজকের ভ্যানের সব মাল ও হিসাব চলে আসবে।
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
          >
            <RefreshCw className="h-4 w-4" />
            <span>চালান রিফ্রেশ করুন</span>
          </button>
          <Link
            href="/delivery-ops/scan-dispatch"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <Boxes className="h-4 w-4 text-blue-600" />
            <span>সকালের কার্টুন স্ক্যানার</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-36 font-sans text-slate-800">
      {/* ── TOP BLUE APP BAR ── */}
      <div className="sticky top-0 z-40 bg-[#0260e8] px-4 py-3.5 text-white shadow-md">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight leading-snug">
                  ডেলিভারি ম্যান প্যানেল
                </h1>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-400/30">
                  {activeBatch.status === 'SETTLED' ? 'সেটেলমেন্ট সম্পন্ন' : 'ভ্যান অন-রোড'}
                </span>
              </div>
              <p className="text-[11px] font-medium text-blue-100 opacity-90 truncate max-w-[220px]">
                {user?.name || user?.username} • চালান #{activeBatch.batchNo}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 active:scale-95 transition"
            title="রিফ্রেশ"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-3 sm:px-4 pt-3 space-y-3">
        {/* ── ASSIGNED VAN & ROUTE SUMMARY CARD ── */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">তারিখ</span>
                <span className="font-bold text-slate-800">
                  {new Date(activeBatch.dispatchDate).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold block">নির্ধারিত রুট</span>
                <span className="font-bold text-slate-800 truncate block">
                  {activeBatch.route?.name || 'বাজার রুট'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold block">ভ্যান নম্বর</span>
                <span className="font-bold text-slate-800 truncate block">
                  {activeBatch.marketArea || activeBatch.note || 'ঢাকা মেট্রো-ন ১২-৩৪৫৬'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">ভ্যানের মোট মাল</span>
                <span className="font-black text-blue-700">
                  {formatCurrency(metrics.grossLoadedValue)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3 NAVIGATION TABS ── */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('actions')}
            className={`py-2 text-xs font-black rounded-xl transition ${
              activeTab === 'actions'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            অ্যাকশন ও কালেকশন
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('van')}
            className={`py-2 text-xs font-black rounded-xl transition ${
              activeTab === 'van'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ভ্যানের মালামাল ({loadedBatchProducts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settlement')}
            className={`py-2 text-xs font-black rounded-xl transition ${
              activeTab === 'settlement'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            হিসাব মিলানো
          </button>
        </div>

        {/* ══════════ TAB 1: ACTIONS & COLLECTIONS ══════════ */}
        {activeTab === 'actions' && (
          <div className="space-y-3 animate-in fade-in">
            {/* 4 Core Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Button 1: ফেরত ও ড্যামেজ */}
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(true)}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 active:scale-98 transition text-center shadow-2xs group cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 group-hover:scale-105 transition mb-1.5">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <span className="text-xs font-black text-rose-900">ফেরত ও ড্যামেজ</span>
                <span className="text-[10px] text-rose-600 font-bold mt-0.5">
                  {returnRecords.length} টি রেকর্ড
                </span>
              </button>

              {/* Button 2: নতুন বাকি */}
              <button
                type="button"
                onClick={() => setIsDueModalOpen(true)}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 active:scale-98 transition text-center shadow-2xs group cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 group-hover:scale-105 transition mb-1.5">
                  <Receipt className="h-5 w-5" />
                </div>
                <span className="text-xs font-black text-amber-900">আজকের নতুন বাকি</span>
                <span className="text-[10px] text-amber-700 font-bold mt-0.5">
                  {formatCurrency(metrics.totalNewDues)}
                </span>
              </button>

              {/* Button 3: পুরোনো বাকি আদায় */}
              <button
                type="button"
                onClick={() => setIsOldDueModalOpen(true)}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 active:scale-98 transition text-center shadow-2xs group cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 group-hover:scale-105 transition mb-1.5">
                  <DollarSign className="h-5 w-5" />
                </div>
                <span className="text-xs font-black text-emerald-900">পুরোনো বাকি আদায়</span>
                <span className="text-[10px] text-emerald-700 font-bold mt-0.5">
                  {formatCurrency(metrics.totalOldDues)}
                </span>
              </button>

              {/* Button 4: ভ্যান খরচ */}
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(true)}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 active:scale-98 transition text-center shadow-2xs group cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 group-hover:scale-105 transition mb-1.5">
                  <Fuel className="h-5 w-5" />
                </div>
                <span className="text-xs font-black text-indigo-900">ভ্যান ভাড়া ও খরচ</span>
                <span className="text-[10px] text-indigo-700 font-bold mt-0.5">
                  {formatCurrency(metrics.totalExpenses)}
                </span>
              </button>
            </div>

            {/* Quick Live Summary of Today's Recorded Actions */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-800 pb-1.5 border-b border-slate-100">
                <span>আজকের লাইভ হিসাব স্ট্যাটাস</span>
                <span className="text-[11px] text-blue-600 font-bold">
                  ক্যাশ জমা: {formatCurrency(metrics.expectedCashToHandOver)}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {/* Returns list */}
                {returnRecords.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-rose-600 block uppercase">
                      ফেরত পণ্য ({returnRecords.length} টি)
                    </span>
                    {returnRecords.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between bg-rose-50/50 rounded-xl px-2.5 py-1.5 text-slate-700 text-[11px]"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900">{r.shopName}</span>: {r.productName} (
                          {r.returnedPaidQty + r.damagedPaidQty} পিস)
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold text-rose-700">
                            -{formatCurrency((r.returnedPaidQty + r.damagedPaidQty) * r.unitPrice)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReturnRecords((p) => p.filter((x) => x.id !== r.id))}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* New Dues list */}
                {newDueRecords.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-amber-700 block uppercase">
                      আজকের নতুন বাকি ({newDueRecords.length} টি)
                    </span>
                    {newDueRecords.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between bg-amber-50/50 rounded-xl px-2.5 py-1.5 text-slate-700 text-[11px]"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900">{d.shopName}</span>
                          {d.note && <span className="text-slate-400 text-[10px] ml-1">({d.note})</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold text-amber-800">+{formatCurrency(d.dueAmount)} বাকি</span>
                          <button
                            type="button"
                            onClick={() => setNewDueRecords((p) => p.filter((x) => x.id !== d.id))}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Old dues list */}
                {oldDueRecords.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-emerald-700 block uppercase">
                      পুরোনো বাকি আদায় ({oldDueRecords.length} টি)
                    </span>
                    {oldDueRecords.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between bg-emerald-50/50 rounded-xl px-2.5 py-1.5 text-slate-700 text-[11px]"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900">{o.shopName}</span> ({o.paymentMode})
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold text-emerald-800">+{formatCurrency(o.collectedAmount)}</span>
                          <button
                            type="button"
                            onClick={() => setOldDueRecords((p) => p.filter((x) => x.id !== o.id))}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expenses list */}
                {expenseRecords.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-indigo-700 block uppercase">
                      ভ্যান খরচ ({expenseRecords.length} টি)
                    </span>
                    {expenseRecords.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between bg-indigo-50/50 rounded-xl px-2.5 py-1.5 text-slate-700 text-[11px]"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900">
                            {e.category === 'VAN_RENT' ? 'ভ্যান ভাড়া' : e.category === 'FUEL' ? 'তেল' : 'অন্যান্য'}
                          </span>
                          {e.note && <span className="text-slate-400 text-[10px] ml-1">({e.note})</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold text-indigo-800">-{formatCurrency(e.amount)}</span>
                          <button
                            type="button"
                            onClick={() => setExpenseRecords((p) => p.filter((x) => x.id !== e.id))}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {returnRecords.length === 0 &&
                  newDueRecords.length === 0 &&
                  oldDueRecords.length === 0 &&
                  expenseRecords.length === 0 && (
                    <div className="py-4 text-center text-xs text-slate-400 font-bold">
                      আজকের কোনো ব্যতিক্রমী এন্ট্রি (বাকি/ফেরত) এখনো যোগ করা হয়নি
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ TAB 2: VAN LOADED STOCK ══════════ */}
        {activeTab === 'van' && (
          <div className="space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-black text-slate-800">
              <span>সকালে ভ্যানে তোলা মালামালের তালিকা</span>
              <span className="text-blue-700 font-bold">{loadedBatchProducts.length} টি পণ্য</span>
            </div>

            {loadedBatchProducts.map((p) => (
              <div
                key={p.productId}
                className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-900 text-xs truncate">{p.name}</h4>
                    <div className="text-[10px] text-slate-400 font-mono">
                      <span>{p.sku}</span> • <span>১ কার্টুন = {p.packSize} {p.unit}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-black text-slate-900 text-sm">
                    {p.loadedQty} <span className="text-[10px] text-slate-400 font-normal">{p.unit}</span>
                  </div>
                  <div className="text-[10px] font-bold text-blue-600">
                    {formatCurrency(p.unitPrice)} / পিস
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════ TAB 3: EVENING SETTLEMENT & RECONCILIATION ══════════ */}
        {activeTab === 'settlement' && (
          <div className="space-y-3 animate-in fade-in">
            {/* Live Accounting Summary Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                দিনের শেষে ক্যাশ হিসাব সারাংশ
              </h3>

              <div className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">ভ্যানে লোডকৃত মোট মাল:</span>
                  <span className="text-slate-900 font-black">
                    {formatCurrency(metrics.grossLoadedValue)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">(-) অবিক্রীত বা ফেরত মাল:</span>
                  <span className="text-rose-600 font-black">
                    -{formatCurrency(metrics.totalReturnsValue)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 bg-blue-50/40 px-2 rounded-lg">
                  <span className="text-blue-900 font-black">(=) আজকের প্রকৃত নেট বিক্রি:</span>
                  <span className="text-blue-900 font-black">
                    {formatCurrency(metrics.netSoldValue)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">(-) আজকের নতুন বাকি:</span>
                  <span className="text-amber-700 font-black">
                    -{formatCurrency(metrics.totalNewDues)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">(+) পুরোনো বাকি আদায়:</span>
                  <span className="text-emerald-700 font-black">
                    +{formatCurrency(metrics.totalOldDues)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">(-) অনুমোদিত ভ্যান খরচ:</span>
                  <span className="text-indigo-700 font-black">
                    -{formatCurrency(metrics.totalExpenses)}
                  </span>
                </div>
              </div>

              {/* Black Highlighted Expected Cash Pill */}
              <div className="rounded-2xl bg-slate-900 text-white p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    বাবার কাছে জমা দিতে হবে (ক্যাশ)
                  </div>
                  <div className="text-xl font-black text-white mt-0.5">
                    {formatCurrency(metrics.expectedCashToHandOver)}
                  </div>
                </div>
                <ShieldCheck className="h-7 w-7 text-emerald-400 opacity-80" />
              </div>

              {/* Actual Cash Handed Over Input */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-black text-slate-800">
                  বাবার হাতে প্রকৃত কত ক্যাশ জমা দিচ্ছেন? (৳) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 16500"
                    value={actualCashHandedOver}
                    onChange={(e) => setActualCashHandedOver(e.target.value)}
                    className="w-full rounded-2xl border-2 border-blue-400 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-100"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                    BDT (৳)
                  </span>
                </div>
              </div>

              {/* Discrepancy Card: Shortage / Balanced / Surplus */}
              {actualCashHandedOver !== '' && (
                <div
                  className={`rounded-xl p-3 text-xs font-bold border transition ${
                    metrics.isBalanced
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : metrics.isShortage
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-blue-50 border-blue-300 text-blue-900'
                  }`}
                >
                  {metrics.isBalanced && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span>হিসাব সম্পূর্ণ মিলেছে! কোনো ঘাটতি নেই।</span>
                    </div>
                  )}
                  {metrics.isShortage && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-black text-rose-800">
                          ⚠️ ঘাটতি: {formatCurrency(Math.abs(metrics.discrepancy))}
                        </div>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          বাবার কাছে জমা দেওয়া ক্যাশের পরিমাণ প্রত্যাশিত হিসাবের চেয়ে কম রয়েছে।
                        </p>
                      </div>
                    </div>
                  )}
                  {metrics.isSurplus && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                      <div>
                        <div className="font-black text-blue-800">
                          উদ্বৃত্ত: +{formatCurrency(metrics.discrepancy)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Final Settlement Button */}
              <button
                type="button"
                onClick={() => setIsConfirmSubmitModalOpen(true)}
                disabled={isSubmitting || actualCashHandedOver === ''}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0260e8] hover:bg-blue-700 py-3.5 text-sm font-black text-white shadow-md active:scale-98 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>দিনের হিসাব জমা দিন (Submit Settlement)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── STICKY BOTTOM SUMMARY BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-2.5 shadow-lg">
        <div className="mx-auto max-w-lg flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="truncate">
            <span className="text-slate-400">নেট বিক্রি: </span>
            <strong className="text-blue-700">{formatCurrency(metrics.netSoldValue)}</strong>
            <span className="text-slate-300 mx-1.5">|</span>
            <span className="text-slate-400">জমা ক্যাশ: </span>
            <strong className="text-slate-900">{formatCurrency(metrics.expectedCashToHandOver)}</strong>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('settlement')}
            className="shrink-0 flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-black transition active:scale-95"
          >
            <span>হিসাব মিলান</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ══════════ MODAL 1: RETURN & DAMAGE ENTRY ══════════ */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">ফেরত ও ড্যামেজ এন্ট্রি</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shop select with + New Shop */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">কোন দোকান ফেরত দিল?</label>
                <button
                  type="button"
                  onClick={() => setIsNewShopModalOpen(true)}
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" />
                  নতুন দোকান
                </button>
              </div>
              <select
                value={returnShopId}
                onChange={(e) => setReturnShopId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">দোকান নির্বাচন করুন</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone || 'ফোন নেই'})
                  </option>
                ))}
              </select>
            </div>

            {/* Product select (strictly from batch products) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">কোন পণ্য ফেরত এসেছে?</label>
              <select
                value={returnProductId}
                onChange={(e) => setReturnProductId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">ভ্যানে থাকা পণ্য নির্বাচন করুন</option>
                {loadedBatchProducts.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name} (লোড: {p.loadedQty} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Returned vs Damaged Pieces */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">ভালো ফেরত (পিস)</label>
                <input
                  type="number"
                  min="0"
                  value={returnPaidQty}
                  onChange={(e) => setReturnPaidQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">নষ্ট / ড্যামেজ (পিস)</label>
                <input
                  type="number"
                  min="0"
                  value={returnDamagedQty}
                  onChange={(e) => setReturnDamagedQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-rose-700 outline-none text-center"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">ফেরতের কারণ</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="দোকান নেয়নি / অবিক্রীত">দোকানদার নেয়নি / অবিক্রীত</option>
                <option value="লিক / ড্যামেজ পণ্য">লিক / ড্যামেজ পণ্য</option>
                <option value="মেয়াদোত্তীর্ণ বা ডেট ওভার">মেয়াদোত্তীর্ণ বা ডেট ওভার</option>
                <option value="ভুল পণ্য পাঠানো হয়েছে">ভুল পণ্য পাঠানো হয়েছে</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleAddReturn}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition active:scale-95"
            >
              ফেরত সংরক্ষণ করুন
            </button>
          </div>
        </div>
      )}

      {/* ══════════ MODAL 2: NEW DUE ENTRY ══════════ */}
      {isDueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Receipt className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">আজকের নতুন বাকি এন্ট্রি</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDueModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shop select with + New Shop */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">কোন দোকান বাকি রাখল?</label>
                <button
                  type="button"
                  onClick={() => setIsNewShopModalOpen(true)}
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" />
                  নতুন দোকান
                </button>
              </div>
              <select
                value={dueShopId}
                onChange={(e) => setDueShopId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">দোকান নির্বাচন করুন</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone || 'ফোন নেই'})
                  </option>
                ))}
              </select>
            </div>

            {/* Due amount input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">বাকি টাকার পরিমাণ (৳)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 500"
                value={dueAmountInput}
                onChange={(e) => setDueAmountInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-black text-slate-900 outline-none"
                autoFocus
              />
            </div>

            {/* Note */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">মন্তব্য বা মেমো নম্বর (ঐচ্ছিক)</label>
              <input
                type="text"
                placeholder="e.g. মেমো #১২৩, আগামীকাল দেবে"
                value={dueNote}
                onChange={(e) => setDueNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleAddNewDue}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition active:scale-95"
            >
              বাকি সংরক্ষণ করুন
            </button>
          </div>
        </div>
      )}

      {/* ══════════ MODAL 3: OLD DUE COLLECTION ══════════ */}
      {isOldDueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <DollarSign className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">পুরোনো বাকি আদায়</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOldDueModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shop select */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">কোন দোকান পুরোনো বাকি দিল?</label>
              <select
                value={oldDueShopId}
                onChange={(e) => setOldDueShopId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">দোকান নির্বাচন করুন</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone || 'ফোন নেই'})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">আদায়কৃত টাকার পরিমাণ (৳)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 1000"
                value={oldDueAmountInput}
                onChange={(e) => setOldDueAmountInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-black text-slate-900 outline-none"
                autoFocus
              />
            </div>

            {/* Payment method pills */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">টাকা কীভাবে দিল?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOldDuePaymentMode('CASH')}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    oldDuePaymentMode === 'CASH'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  💵 নগদ (Cash)
                </button>
                <button
                  type="button"
                  onClick={() => setOldDuePaymentMode('BKASH')}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    oldDuePaymentMode === 'BKASH'
                      ? 'bg-pink-600 text-white border-pink-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  📱 বিকাশ (bKash)
                </button>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">বিবরণ / রসিদ নোট</label>
              <input
                type="text"
                placeholder="e.g. গত সপ্তাহের বাকি পরিশোধ"
                value={oldDueNote}
                onChange={(e) => setOldDueNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleAddOldDueCollection}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition active:scale-95"
            >
              আদায় জমা দিন
            </button>
          </div>
        </div>
      )}

      {/* ══════════ MODAL 4: VAN EXPENSES ══════════ */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <Fuel className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">ভ্যান ভাড়া ও খরচ এন্ট্রি</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Category pills */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">খরচের ধরন</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setExpenseCategory('VAN_RENT')}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    expenseCategory === 'VAN_RENT'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  ভ্যান ভাড়া
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseCategory('FUEL')}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    expenseCategory === 'FUEL'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  জ্বালানি/তেল
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseCategory('OTHER')}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    expenseCategory === 'OTHER'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  অন্যান্য
                </button>
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">খরচের পরিমাণ (৳)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 500"
                value={expenseAmountInput}
                onChange={(e) => setExpenseAmountInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-black text-slate-900 outline-none"
                autoFocus
              />
            </div>

            {/* Note */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">রসিদ / খরচের নোট</label>
              <input
                type="text"
                placeholder="e.g. ভ্যান ভাড়া ও টোল"
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleAddExpense}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition active:scale-95"
            >
              খরচ সংরক্ষণ করুন
            </button>
          </div>
        </div>
      )}

      {/* ══════════ MODAL 5: QUICK ADD SHOP ON THE ROAD ══════════ */}
      {isNewShopModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Store className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">নতুন দোকান যুক্ত করুন</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewShopModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  দোকানের নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. ভাই ভাই স্টোর"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">দোকানদারের নাম</label>
                <input
                  type="text"
                  placeholder="e.g. মোঃ করিম"
                  value={newShopOwner}
                  onChange={(e) => setNewShopOwner(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                <input
                  type="text"
                  placeholder="e.g. 017..."
                  value={newShopPhone}
                  onChange={(e) => setNewShopPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ঠিকানা / বাজার</label>
                <input
                  type="text"
                  placeholder="e.g. পূর্ব বাজার রোড"
                  value={newShopAddress}
                  onChange={(e) => setNewShopAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateNewShop}
              disabled={isCreatingShop}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50"
            >
              {isCreatingShop ? 'তৈরি হচ্ছে...' : 'দোকান সেভ করুন'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════ MODAL 6: CONFIRM FINAL SETTLEMENT ══════════ */}
      {isConfirmSubmitModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Send className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black">দিনের হিসাব সাবমিট নিশ্চিতকরণ</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              আপনি কি নিশ্চিত যে আজকের হিসাব বাবার কাছে সাবমিট করতে চান?
            </p>

            <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1.5 font-bold text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400">মোট ক্যাশ জমা:</span>
                <span className="text-slate-900 font-black">{formatCurrency(metrics.actualCashNumber)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">নতুন বাকি:</span>
                <span className="text-amber-800 font-black">{formatCurrency(metrics.totalNewDues)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ফেরত পণ্যের সংখ্যা:</span>
                <span className="text-rose-700 font-black">{returnRecords.length} টি</span>
              </div>
              {metrics.isShortage && (
                <div className="flex justify-between text-rose-700">
                  <span>ঘাটতি:</span>
                  <span className="font-black">-{formatCurrency(Math.abs(metrics.discrepancy))}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmSubmitModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? 'সাবমিট হচ্ছে...' : 'কনফার্ম ও সাবমিট'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
