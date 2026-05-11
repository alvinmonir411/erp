'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  DollarSign,
  FileText,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Save,
  Store,
  Undo2,
  X,
} from 'lucide-react';
import { getOrder } from '@/lib/api/orders';
import { submitDeliveryResult, createShopForOrder } from '@/lib/api/delivery-ops';
import { useToast } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { LoadingBlock } from '@/components/ui/loading-block';

type DeliveryItemState = {
  productId: number;
  productName: string;
  unit: string;
  orderedQty: number;
  freeQty: number;
  dispatchedQty: number;
  unitPrice: number;
  lineTotal: number;
  deliveredQty: string;
  returnQty: string;
  damageQty: string;
  returnReason: string;
  damageReason: string;
};

function toNumber(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function DeliveryUpdatePage({ orderId }: { orderId: number }) {
  const router = useRouter();
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<DeliveryItemState[]>([]);
  const [cashCollected, setCashCollected] = useState('0');
  const [dueAmount, setDueAmount] = useState('0');
  const [deliveryNote, setDeliveryNote] = useState('');

  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [shopForm, setShopForm] = useState({ name: '', ownerName: '', phone: '', address: '' });
  const [isCreatingShop, setIsCreatingShop] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const data = await getOrder(orderId);
        setOrder(data);

        const mappedItems = (data.items || []).map((item: any) => {
          const orderedQty = toNumber(item.quantity);
          const freeQty = toNumber(item.freeQuantity);
          const dispatchedQty = orderedQty + freeQty;
          const returned = toNumber(item.returnedQuantity);
          const damaged = toNumber(item.damagedQuantity);
          const savedDelivered = toNumber(item.deliveredQuantity);
          const deliveredQty = savedDelivered > 0 || returned > 0 || damaged > 0
            ? savedDelivered
            : dispatchedQty;

          return {
            productId: item.productId,
            productName: item.product?.name || 'Unknown product',
            unit: item.product?.unit || '',
            orderedQty,
            freeQty,
            dispatchedQty,
            unitPrice: toNumber(item.unitPrice),
            lineTotal: toNumber(item.lineTotal),
            deliveredQty: String(deliveredQty),
            returnQty: String(returned),
            damageQty: String(damaged),
            returnReason: '',
            damageReason: '',
          };
        });

        setItems(mappedItems);
        setCashCollected(String(toNumber(data.collectedAmount)));
        setDueAmount(String(toNumber(data.dueAmount)));
        setDeliveryNote(data.deliveryNote || '');
      } catch (e: any) {
        console.error('Failed to load order:', e);
        showErrorToast(e.message || 'Failed to load order');
        router.push('/my-deliveries');
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [orderId]);

  const finalSoldAmount = useMemo(() => {
    if (!order) return 0;

    const itemSoldAmount = items.reduce((sum, item) => {
      const deliveredQty = toNumber(item.deliveredQty);
      if (item.dispatchedQty <= 0 || item.orderedQty <= 0) return sum;
      const chargeableDelivered = deliveredQty * (item.orderedQty / item.dispatchedQty);
      const unitPriceAfterItemDiscount = item.lineTotal / item.orderedQty;
      return sum + chargeableDelivered * unitPriceAfterItemDiscount;
    }, 0);

    const subtotal = toNumber(order.subtotal);
    const invoiceDiscount = subtotal > 0
      ? toNumber(order.discountAmount) * (itemSoldAmount / subtotal)
      : 0;

    return Math.max(0, Number((itemSoldAmount - invoiceDiscount).toFixed(2)));
  }, [items, order]);

  const cashExpected = Math.max(0, Number((finalSoldAmount - toNumber(order?.advancePaid)).toFixed(2)));
  const [isCashManuallyEdited, setIsCashManuallyEdited] = useState(false);

  useEffect(() => {
    if (!isCashManuallyEdited) {
      setCashCollected(String(cashExpected));
    }
  }, [cashExpected, isCashManuallyEdited]);

  const computedDue = Math.max(0, Number((cashExpected - toNumber(cashCollected)).toFixed(2)));
  const isLocked = ['SETTLED', 'PARTIAL_DUE'].includes(order?.status);

  useEffect(() => {
    setDueAmount(String(computedDue));
  }, [computedDue]);

  const isShopMissing = !order?.shopId && !order?.shop;
  const isDueWithNoShop = isShopMissing && toNumber(dueAmount) > 0;

  const updateItem = (index: number, patch: Partial<DeliveryItemState>) => {
    setItems((current) => current.map((item, idx) => {
      if (idx !== index) return item;
      const newItem = { ...item, ...patch };

      // Auto-balance: If return or damage changed, update delivered to match dispatched total
      if ('returnQty' in patch || 'damageQty' in patch) {
        const remaining = newItem.dispatchedQty - (toNumber(newItem.returnQty) + toNumber(newItem.damageQty));
        newItem.deliveredQty = String(Math.max(0, remaining));
      }

      return newItem;
    }));
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopForm.name.trim()) {
      showErrorToast('Shop name is required');
      return;
    }
    try {
      setIsCreatingShop(true);
      const updatedOrder = await createShopForOrder(orderId, shopForm);
      setOrder(updatedOrder);
      setIsShopModalOpen(false);
      showSuccessToast('Shop created and linked to order successfully');
    } catch(err: any) {
      showErrorToast(err.message || 'Failed to create shop');
    } finally {
      setIsCreatingShop(false);
    }
  };

  const validateForm = () => {
    for (const item of items) {
      const delivered = toNumber(item.deliveredQty);
      const returned = toNumber(item.returnQty);
      const damaged = toNumber(item.damageQty);
      if ([delivered, returned, damaged].some((qty) => qty < 0)) {
        return `${item.productName}: quantities cannot be negative`;
      }
      if (delivered + returned + damaged > item.dispatchedQty) {
        return `${item.productName}: delivered + return + damage cannot exceed ordered quantity`;
      }
    }

    if (toNumber(cashCollected) > cashExpected) {
      return 'Cash collected cannot exceed final payable amount';
    }

    if (Math.abs(toNumber(dueAmount) - computedDue) > 0.01) {
      return 'Due amount must match final payable minus cash collected';
    }

    return null;
  };

  const handleSubmit = async (status: 'DRAFT' | 'COMPLETED') => {
    const validationError = validateForm();
    if (validationError) {
      showErrorToast(validationError);
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        status,
        items: items.map((item) => ({
          productId: item.productId,
          deliveredQty: toNumber(item.deliveredQty),
          returnQty: toNumber(item.returnQty),
          damageQty: toNumber(item.damageQty),
          returnReason: item.returnReason || undefined,
          damageReason: item.damageReason || undefined,
        })),
        cashCollected: toNumber(cashCollected),
        dueAmount: toNumber(dueAmount),
        deliveryNote: deliveryNote || undefined,
      };

      console.log("[DeliverySubmit] Final Payload:", payload);
      await submitDeliveryResult(orderId, payload);

      showSuccessToast(status === 'COMPLETED' ? 'Delivery completed successfully' : 'Delivery draft saved');
      router.push('/my-deliveries');
    } catch (e: any) {
      showErrorToast(e.message || 'Failed to update delivery');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !order) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-32">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white transition-all hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-foreground">Order Delivery Result</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Order #{String(order.id).padStart(6, '0')} - {formatDate(order.orderDate)}
          </p>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
              <Store className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{order.shop?.name || 'Unknown shop'}</h2>
              <p className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-tight text-muted">
                <MapPin className="h-3 w-3" /> {order.marketArea || order.route?.name || 'No route'}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
            {order.status}
          </span>
        </div>

        <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Owner</p>
            <p className="mt-1 text-sm font-black text-slate-900">{order.shop?.ownerName || 'Unknown owner'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Phone</p>
            <p className="mt-1 text-sm font-black text-slate-900">{order.shop?.phone || 'No phone'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">SR</p>
            <p className="mt-1 text-sm font-black text-slate-900">{order.createdBy || 'Unknown SR'}</p>
          </div>
          <div className="sm:col-span-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Address</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{order.shop?.address || 'No address'}</p>
          </div>
          <div className="sm:col-span-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Order Note</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{order.note || 'No note added'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Previous Due</p>
            <p className="mt-1 text-base font-black text-rose-600">{formatCurrency(toNumber(order.shopTotalDue))}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Final Sold</p>
            <p className="mt-1 text-base font-black text-blue-700">{formatCurrency(finalSoldAmount)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Cash Expected</p>
            <p className="mt-1 text-base font-black text-emerald-700">{formatCurrency(cashExpected)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Due</p>
            <p className="mt-1 text-base font-black text-amber-700">{formatCurrency(computedDue)}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
            <Package className="h-4 w-4" /> Products
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <div key={item.productId} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{item.productName}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-muted">
                    Ordered {item.orderedQty} {item.unit} - Free {item.freeQty} - Unit {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <p className="text-xs font-black text-slate-700">{formatCurrency(item.lineTotal)}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <QuantityInput
                  label="Delivered"
                  value={item.deliveredQty}
                  icon={<CheckCircle className="h-3 w-3" />}
                  tone="emerald"
                  disabled={isLocked}
                  onChange={(value) => updateItem(index, { deliveredQty: value })}
                />
                <QuantityInput
                  label="Return"
                  value={item.returnQty}
                  icon={<Undo2 className="h-3 w-3" />}
                  tone="rose"
                  disabled={isLocked}
                  onChange={(value) => updateItem(index, { returnQty: value })}
                />
                <QuantityInput
                  label="Damage"
                  value={item.damageQty}
                  icon={<AlertTriangle className="h-3 w-3" />}
                  tone="amber"
                  disabled={isLocked}
                  onChange={(value) => updateItem(index, { damageQty: value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={item.returnReason}
                  disabled={isLocked}
                  onChange={(event) => updateItem(index, { returnReason: event.target.value })}
                  placeholder="Return reason"
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60"
                />
                <input
                  value={item.damageReason}
                  disabled={isLocked}
                  onChange={(event) => updateItem(index, { damageReason: event.target.value })}
                  placeholder="Damage reason"
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
          <DollarSign className="h-4 w-4" /> Cash And Due
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="ml-1 flex justify-between text-[10px] font-black uppercase tracking-widest text-emerald-600">
              Cash Collected <span>Max BDT {cashExpected}</span>
            </label>
            <input
              type="number"
              value={cashCollected}
              disabled={isLocked}
              onChange={(event) => {
                setIsCashManuallyEdited(true);
                setCashCollected(event.target.value);
              }}
              className="h-14 w-full rounded-2xl border-0 bg-emerald-50 px-4 text-lg font-black text-emerald-700 outline-none focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-amber-600">Due Amount</label>
            <input
              type="number"
              value={dueAmount}
              disabled={isLocked}
              onChange={(event) => setDueAmount(event.target.value)}
              className="h-14 w-full rounded-2xl border border-amber-100 bg-amber-50 px-4 text-lg font-black text-amber-700 outline-none focus:ring-4 focus:ring-amber-500/10 disabled:opacity-60"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery Note</label>
          <div className="relative">
            <FileText className="absolute left-4 top-4 h-4 w-4 text-slate-400" />
            <textarea
              value={deliveryNote}
              disabled={isLocked}
              onChange={(event) => setDeliveryNote(event.target.value)}
              className="h-24 w-full resize-none rounded-2xl border-0 bg-slate-50 p-4 pl-12 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
              placeholder="Customer feedback, promise date, or delivery notes"
            />
          </div>
        </div>
      </div>

      {isLocked && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          This delivery is settled and locked.
        </div>
      )}

      {isDueWithNoShop && !isLocked && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p>Shop is required to complete delivery with due/baki. Please link a shop.</p>
          </div>
          <button
            onClick={() => setIsShopModalOpen(true)}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-rose-600 px-4 py-2 text-white shadow-sm transition-all hover:bg-rose-700 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Create Shop
          </button>
        </div>
      )}

      {isShopModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="text-lg font-black text-slate-900">Create & Link Shop</h3>
              <button
                onClick={() => setIsShopModalOpen(false)}
                className="rounded-full p-2 hover:bg-slate-100"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreateShop} className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Shop Name *</label>
                <input
                  type="text"
                  required
                  value={shopForm.name}
                  onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Owner Name</label>
                <input
                  type="text"
                  value={shopForm.ownerName}
                  onChange={(e) => setShopForm({ ...shopForm, ownerName: e.target.value })}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Phone</label>
                <input
                  type="text"
                  value={shopForm.phone}
                  onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Address</label>
                <input
                  type="text"
                  value={shopForm.address}
                  onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isCreatingShop}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreatingShop ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Create Shop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 flex gap-4 border-t border-border bg-white p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <button
          disabled={isSaving || isLocked || isDueWithNoShop}
          onClick={() => handleSubmit('DRAFT')}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white text-sm font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Save Draft
        </button>
        <button
          disabled={isSaving || isLocked || isDueWithNoShop}
          onClick={() => handleSubmit('COMPLETED')}
          className="flex h-14 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
          Complete
        </button>
      </div>
    </div>
  );
}

function QuantityInput({
  label,
  value,
  icon,
  tone,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: 'emerald' | 'rose' | 'amber';
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const toneClass = {
    emerald: 'text-emerald-600 focus:ring-emerald-500/10',
    rose: 'text-rose-600 focus:ring-rose-500/10',
    amber: 'text-amber-600 focus:ring-amber-500/10',
  }[tone];

  return (
    <div className="space-y-1.5">
      <label className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${toneClass}`}>
        {icon} {label}
      </label>
      <input
        type="number"
        min="0"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`h-11 w-full rounded-xl border-0 bg-slate-100 px-4 text-sm font-black outline-none focus:ring-2 disabled:opacity-60 ${toneClass}`}
      />
    </div>
  );
}
