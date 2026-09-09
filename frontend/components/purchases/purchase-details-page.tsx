'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { getPurchase, receivePurchasePayment } from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  toNumber,
} from '@/lib/utils/format';
import type { Purchase, PurchasePayment } from '@/types/api';
import {
  Building2,
  Calendar,
  Package,
  Wallet,
  ArrowLeft,
  Printer,
  FileText,
  Truck,
  Warehouse,
  CheckCircle2,
  AlertCircle,
  Clock,
  Landmark,
  ShieldCheck,
  TrendingDown,
  Sparkles,
} from 'lucide-react';

export function PurchaseDetailsPage({ purchaseId }: { purchaseId: number }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settlement Form State
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 16));
  const [paymentNote, setPaymentNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  useToastNotification({
    message: toastMessage,
    title: toastTone === 'success' ? 'Success' : 'Error',
    tone: toastTone,
  });

  const loadPurchase = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getPurchase(purchaseId);
      setPurchase(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoice details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPurchase();
  }, [purchaseId]);

  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchase) return;

    try {
      setIsSubmittingPayment(true);
      const updated = await receivePurchasePayment(purchase.id, {
        amount: Number(paymentAmount),
        paymentDate: new Date(paymentDate).toISOString(),
        note: paymentNote.trim() || undefined,
      });

      setPurchase(updated);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().slice(0, 16));
      setPaymentNote('');
      setToastTone('success');
      setToastMessage('Payment saved successfully!');
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'Failed to save payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Calculations
  const primaryPayment: PurchasePayment | undefined =
    purchase?.payments && purchase.payments.length > 0 ? purchase.payments[0] : (purchase?.payment as any);

  const totalReceivedValue = purchase ? toNumber(purchase.totalAmount) : 0;
  const totalPaidAmount = purchase ? toNumber(purchase.paidAmount) : 0;
  const advanceRemaining = Math.max(0, totalPaidAmount - totalReceivedValue);
  const dueRemaining = Math.max(0, totalReceivedValue - totalPaidAmount);
  const isFullySettled = purchase ? Math.abs(totalReceivedValue - totalPaidAmount) < 0.01 : false;

  const parseBreakdown = (payment?: PurchasePayment): any[] => {
    if (!payment) return [];
    if (Array.isArray(payment.productBreakdown)) return payment.productBreakdown;
    if (typeof payment.productBreakdown === 'string') {
      try {
        const parsed = JSON.parse(payment.productBreakdown);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
    return [];
  };

  const preOrderBreakdownList = useMemo(() => {
    return parseBreakdown(primaryPayment);
  }, [primaryPayment]);

  if (isLoading) {
    return <LoadingBlock label="Loading invoice details..." />;
  }

  if (error || !purchase) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-white rounded-3xl shadow-sm border border-slate-200">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Invoice Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">{error || 'No details found.'}</p>
        <Link
          href="/purchases"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Invoices</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-slate-800">
      {/* 🌟 Header Section with Actions */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Link
                href="/purchases"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Invoice List</span>
              </Link>
              <span className="rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-bold text-indigo-300">
                #{purchase.invoiceNo || purchase.referenceNo || `PUR-${purchase.id}`}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                purchase.status === 'CONFIRMED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {purchase.status === 'CONFIRMED' ? '✅ Stock Received' : 'Draft Invoice'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Invoice & Bank Draft Details
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
              Supplier: <b className="text-white">{purchase.company?.name || purchase.supplierName}</b> • Date:{' '}
              <b className="text-white">{formatDate(purchase.purchaseDate)}</b>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap shrink-0">
            {/* Primary Action Button: Print A4 Voucher */}
            <Link
              href={`/purchases/${purchase.id}/print-challan`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-xs sm:text-sm font-black text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>🖨️ Print Challan & Draft Voucher</span>
            </Link>

            <Link
              href={`/purchases/companies/${purchase.companyId}`}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white/10 hover:bg-white/20 px-4 py-3 text-xs sm:text-sm font-bold text-white border border-white/10 transition-colors"
            >
              <Building2 className="h-4 w-4 text-indigo-400" />
              <span>Company Ledger</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 🏢 Core 4 Grid Cards: Supplier, Payment, Goods, Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Supplier Info */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 mb-2 text-xs font-bold uppercase tracking-wider">
            <Building2 className="h-4 w-4" />
            <span>Supplier Company</span>
          </div>
          <p className="text-lg font-black text-slate-900">{purchase.company?.name || purchase.supplierName}</p>
          <div className="mt-2 text-xs text-slate-500 space-y-0.5">
            <p>ID: #{purchase.companyId}</p>
            {purchase.company?.phone && <p>📞 {purchase.company.phone}</p>}
            {purchase.company?.address && <p className="truncate">📍 {purchase.company.address}</p>}
          </div>
        </div>

        {/* Payment / Draft Info */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 mb-2 text-xs font-bold uppercase tracking-wider">
            <Wallet className="h-4 w-4" />
            <span>Bank Draft / Payment</span>
          </div>
          <p className="text-lg font-black text-emerald-600">{formatCurrency(totalPaidAmount)}</p>
          <div className="mt-2 text-xs text-slate-500 space-y-0.5">
            <p>Method: <b className="text-slate-800">{primaryPayment?.paymentMethod || 'BANK DRAFT'}</b></p>
            {primaryPayment?.transactionRef && (
              <p>Reference: <b className="font-mono text-indigo-900">{primaryPayment.transactionRef}</b></p>
            )}
            {primaryPayment?.bankName && <p>Bank: {primaryPayment.bankName}</p>}
          </div>
        </div>

        {/* Goods Value */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 mb-2 text-xs font-bold uppercase tracking-wider">
            <Package className="h-4 w-4" />
            <span>Received Goods Value</span>
          </div>
          <p className="text-lg font-black text-slate-900">{formatCurrency(totalReceivedValue)}</p>
          <div className="mt-2 text-xs text-slate-500 space-y-0.5">
            <p>Total Items: <b className="text-slate-800">{(purchase.items ?? []).length} Items</b></p>
            <p>Warehouse: <b className="text-slate-800">{purchase.warehouseName || 'Main Godown'}</b></p>
          </div>
        </div>

        {/* Financial Balance */}
        <div className={`rounded-3xl border p-5 shadow-sm ${
          advanceRemaining > 0
            ? 'border-sky-200 bg-sky-50/50'
            : dueRemaining > 0
            ? 'border-rose-200 bg-rose-50/50'
            : 'border-emerald-200 bg-emerald-50/50'
        }`}>
          <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4 text-slate-700" />
            <span>Reconciliation Status</span>
          </div>
          {advanceRemaining > 0 ? (
            <>
              <p className="text-lg font-black text-sky-700">{formatCurrency(advanceRemaining)}</p>
              <p className="mt-2 text-xs text-sky-800 font-medium">Advance credit balance remaining with supplier</p>
            </>
          ) : dueRemaining > 0 ? (
            <>
              <p className="text-lg font-black text-rose-600">{formatCurrency(dueRemaining)}</p>
              <p className="mt-2 text-xs text-rose-700 font-medium">Outstanding due balance payable to supplier</p>
            </>
          ) : (
            <>
              <p className="text-lg font-black text-emerald-700">৳0.00 (Balanced)</p>
              <p className="mt-2 text-xs text-emerald-800 font-medium">Draft and invoice are fully reconciled</p>
            </>
          )}
        </div>
      </div>

      {/* 📦 Ordered vs Received Products Reconciliation Table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Package className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-black text-slate-900">
                Product Reconciliation (Ordered vs Received Items)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparison between pre-ordered quantities and actual received quantities
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
            <thead className="bg-slate-50/80 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3 text-center w-10">#</th>
                <th className="py-3 px-4 text-left">Product & SKU</th>
                <th className="py-3 px-4 text-center">Ordered Qty</th>
                <th className="py-3 px-4 text-center bg-indigo-50 text-indigo-900">Received Qty</th>
                <th className="py-3 px-4 text-center">Variance / Shortage</th>
                <th className="py-3 px-4 text-right">Buy Rate (৳)</th>
                <th className="py-3 px-4 text-right">Total Received (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(purchase.items ?? []).map((item, idx) => {
                const rcvQty = toNumber(item.quantity);
                const unitPrice = toNumber(item.unitCost ?? item.unitPrice);
                const lineTotal = toNumber(item.lineTotal);
                const unit = item.product?.unit || item.unit || 'Pcs';

                // Try to match pre-order quantity
                const preOrderMatch = preOrderBreakdownList.find(
                  (b: any) =>
                    b.productId === item.productId ||
                    (b.productName && item.product?.name && b.productName.trim().toLowerCase() === item.product.name.trim().toLowerCase()),
                );
                const ordQty = preOrderMatch && preOrderMatch.quantity ? toNumber(preOrderMatch.quantity) : rcvQty;
                const diff = rcvQty - ordQty;

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.product?.name || item.productName || `Product #${item.productId}`}</div>
                      {item.product?.sku && <div className="text-[10px] text-slate-400 font-mono">SKU: {item.product.sku}</div>}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-600">
                      {formatNumber(ordQty)} {unit}
                    </td>
                    <td className="py-3 px-4 text-center font-black text-indigo-950 bg-indigo-50/30">
                      {formatNumber(rcvQty)} {unit}
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      {diff === 0 ? (
                        <span className="text-emerald-600 text-xs">✓ Full</span>
                      ) : diff < 0 ? (
                        <span className="text-rose-600 font-black">{diff} {unit} (Short)</span>
                      ) : (
                        <span className="text-indigo-600 font-bold">+{diff} {unit}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-700">{formatCurrency(unitPrice)}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ⚖️ Multi-Challan Receiving Logs & Financial Reconciliation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Multi-Challan Receiving History */}
        <div className="lg:col-span-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900">
              Receiving History
            </h3>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
              <div>
                <span className="font-mono font-black text-indigo-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
                  #{purchase.invoiceNo || `CH-${purchase.id}`}
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  Date: {formatDate(purchase.purchaseDate)} • Warehouse: {purchase.warehouseName || 'Main Godown'}
                </p>
                {purchase.driverName && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Driver: {purchase.driverName} {purchase.vehicleNo ? `(${purchase.vehicleNo})` : ''}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Received Total</span>
                <p className="text-base font-black text-slate-900">{formatCurrency(totalReceivedValue)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Financial Reconciliation Box */}
        <div className="lg:col-span-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-white shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
              💰 Financial Reconciliation
            </span>
            <span className="text-xs font-bold text-slate-300">
              {isFullySettled ? '✓ Fully Balanced' : 'Current Balance'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">1. Bank Draft Paid:</span>
              <span className="font-black text-indigo-300 text-sm">{formatCurrency(totalPaidAmount)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-300">2. Received Goods Value:</span>
              <span className="font-bold text-slate-200 text-sm">{formatCurrency(totalReceivedValue)}</span>
            </div>

            <div className="border-t border-white/10 pt-2.5 mt-2 flex justify-between items-center">
              <span className="font-bold text-white text-sm">
                {advanceRemaining > 0 ? '3. Advance Credit Remaining:' : '3. Outstanding Due Payable:'}
              </span>
              <span className={`text-base font-black ${advanceRemaining > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {advanceRemaining > 0 ? formatCurrency(advanceRemaining) : formatCurrency(dueRemaining)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
