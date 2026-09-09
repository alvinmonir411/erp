'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getPurchase } from '@/lib/api/purchases';
import { formatCurrency, formatNumber, formatDate, formatDateTime, toNumber } from '@/lib/utils/format';
import type { Purchase, PurchasePayment } from '@/types/api';
import { Printer, ArrowLeft, Building2, Package, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';

export default function PrintChallanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const data = await getPurchase(Number(id));
        setPurchase(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load challan data');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-600">Loading challan and reconciliation voucher...</p>
        </div>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-white rounded-3xl shadow-sm border border-slate-200">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Challan Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">{error || 'Please select a valid challan ID.'}</p>
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

  const primaryPayment: PurchasePayment | undefined =
    purchase.payments && purchase.payments.length > 0 ? purchase.payments[0] : (purchase.payment as any);

  const totalReceivedValue = toNumber(purchase.totalAmount);
  const totalPaid = toNumber(purchase.paidAmount);
  const advanceRemaining = Math.max(0, totalPaid - totalReceivedValue);
  const dueRemaining = Math.max(0, totalReceivedValue - totalPaid);
  const isFullyReceived = Math.abs(totalReceivedValue - totalPaid) < 0.01 && totalReceivedValue > 0;

  // Extract ordered quantity from payment breakdown if available
  const getOrderedQty = (item: any): number => {
    if (primaryPayment?.productBreakdown) {
      const breakdown = Array.isArray(primaryPayment.productBreakdown)
        ? primaryPayment.productBreakdown
        : typeof primaryPayment.productBreakdown === 'string'
        ? JSON.parse(primaryPayment.productBreakdown || '[]')
        : [];

      const matched = breakdown.find(
        (b: any) =>
          b.productId === item.productId ||
          (b.productName && item.product?.name && b.productName.trim().toLowerCase() === item.product.name.trim().toLowerCase())
      );
      if (matched && matched.quantity) {
        return toNumber(matched.quantity);
      }
    }
    return toNumber(item.quantity);
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 sm:px-6 print:bg-white print:p-0 print:m-0 text-slate-900 font-sans">
      {/* 🎛️ Action Bar (Hidden when printing) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link
          href="/purchases"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Invoices</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/purchases/${purchase.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-300 transition-colors"
          >
            <span>Invoice Details</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
          >
            <Printer className="h-4 w-4" />
            <span>🖨️ Print Voucher (A4)</span>
          </button>
        </div>
      </div>

      {/* 📄 Standard A4 Printable Voucher Container */}
      <div className="printable-voucher max-w-4xl mx-auto bg-white rounded-3xl p-8 sm:p-10 shadow-lg border border-slate-200 print:shadow-none print:border-0 print:p-0 print:rounded-none">
        
        {/* Company Header */}
        <div className="text-center border-b-2 border-slate-900 pb-5 mb-6">
          <div className="inline-flex items-center gap-2 font-black text-xl text-indigo-950 uppercase tracking-wider mb-1">
            <Building2 className="h-6 w-6 text-indigo-700" />
            <span>Dealership ERP Enterprise</span>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            Head Office & Central Godown • Phone: 01XXXXXXXXX • Email: erp@dealership.com
          </p>
          <div className="mt-3 inline-block rounded-xl bg-slate-900 text-white px-6 py-1 text-sm font-black tracking-wide">
            Challan & Bank Draft Reconciliation Voucher
          </div>
        </div>

        {/* Voucher Meta & Supplier/Draft Details */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
          {/* Supplier Info */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Supplier / Company:</p>
            <p className="text-base font-black text-slate-900">
              {purchase.company?.name || purchase.supplierName || 'Company'}
            </p>
            {purchase.company?.code && <p className="text-slate-600 font-mono">Code: {purchase.company.code}</p>}
            {purchase.company?.phone && <p className="text-slate-600">Phone: {purchase.company.phone}</p>}
            {purchase.company?.address && <p className="text-slate-500">{purchase.company.address}</p>}
          </div>

          {/* Bank Draft & Voucher Info */}
          <div className="space-y-1 text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Voucher No:</p>
            <p className="text-base font-black text-indigo-950 font-mono">
              #{purchase.invoiceNo || purchase.referenceNo || purchase.id}
            </p>
            <p className="text-slate-600">Date: <b className="text-slate-900">{formatDate(purchase.purchaseDate)}</b></p>
            
            {primaryPayment && (
              <div className="pt-1 mt-1 border-t border-slate-200">
                <p className="text-slate-700">Bank Draft: <b className="font-mono text-indigo-900">{primaryPayment.transactionRef || `BD-${primaryPayment.id}`}</b></p>
                <p className="text-slate-600">Bank: <b>{primaryPayment.bankName || 'Sonali Bank'}</b> • Branch: <b>{primaryPayment.branchName || 'Gazipur Branch'}</b></p>
              </div>
            )}
          </div>
        </div>

        {/* 📦 Product Reconciliation Table */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200">
          <div className="bg-slate-900 px-4 py-2 text-white flex items-center justify-between text-xs font-bold uppercase tracking-wider">
            <span>PRODUCT RECONCILIATION STATEMENT</span>
            <span>Items: {(purchase.items ?? []).length}</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3 text-center w-8">#</th>
                <th className="py-2.5 px-3">Product Name & Description</th>
                <th className="py-2.5 px-3 text-center">Order Qty</th>
                <th className="py-2.5 px-3 text-center bg-indigo-50 text-indigo-900">Received Qty</th>
                <th className="py-2.5 px-3 text-center">Short / Excess</th>
                <th className="py-2.5 px-3 text-right">Buy Rate (৳)</th>
                <th className="py-2.5 px-3 text-right">Total Value (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(purchase.items ?? []).map((item, idx) => {
                const rcvQty = toNumber(item.quantity);
                const ordQty = getOrderedQty(item);
                const diff = rcvQty - ordQty;
                const unitPrice = toNumber(item.unitCost ?? item.unitPrice);
                const lineTotal = toNumber(item.lineTotal);
                const unit = item.product?.unit || item.unit || 'Pcs';

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-900 text-xs">{item.product?.name || item.productName || `Product #${item.productId}`}</p>
                      {item.product?.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.product.sku}</p>}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                      {formatNumber(ordQty)} {unit}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-indigo-950 bg-indigo-50/40">
                      {formatNumber(rcvQty)} {unit}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      {diff === 0 ? (
                        <span className="text-emerald-700">0 (Exact)</span>
                      ) : diff < 0 ? (
                        <span className="text-rose-600 font-black">{Math.abs(diff)} (Short)</span>
                      ) : (
                        <span className="text-indigo-600 font-bold">+{diff} (Excess)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                      {formatCurrency(unitPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                      {formatCurrency(lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 💰 Financial Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
          {/* Notes & Status */}
          <div className="space-y-2 rounded-2xl bg-slate-50 p-4 border border-slate-200">
            <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Receiving Status & Notes:</p>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Invoice Status:</span>
              <span className="font-black text-indigo-900">
                {isFullyReceived ? '🟢 Fully Received' : advanceRemaining > 0 ? '🟡 Partially Received' : 'Stock In Complete'}
              </span>
            </div>
            <p className="text-slate-500 italic mt-1 leading-relaxed">
              {purchase.note || 'Goods received and stocked into godown against bank draft.'}
            </p>
          </div>

          {/* Financial Totals */}
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Advance Paid (Bank Draft):</span>
              <span className="font-black text-indigo-950 text-sm">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Pre-Order Total Value:</span>
              <span className="font-bold text-slate-800 text-sm">{formatCurrency(totalPaid > 0 ? totalPaid : totalReceivedValue)}</span>
            </div>
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
              <span>Received Goods Value:</span>
              <span className="font-black text-slate-900 text-sm">{formatCurrency(totalReceivedValue)}</span>
            </div>
            <div className="flex justify-between items-center text-emerald-800 bg-emerald-100/70 p-2 rounded-xl font-bold border border-emerald-200 mt-1">
              <span>Remaining Advance Balance:</span>
              <span className="font-black text-base">{formatCurrency(advanceRemaining)}</span>
            </div>
          </div>
        </div>

        {/* ✍️ Signature Blocks (Prepared By, Received By, Authorized By) */}
        <div className="grid grid-cols-3 gap-6 pt-16 border-t border-dashed border-slate-300 text-center text-xs text-slate-700">
          <div>
            <div className="border-t-2 border-slate-700 pt-2 font-black text-slate-900">
              Prepared By
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Signature & Date</p>
          </div>

          <div>
            <div className="border-t-2 border-slate-700 pt-2 font-black text-slate-900">
              Received By (Godown Incharge)
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Signature & Date</p>
          </div>

          <div>
            <div className="border-t-2 border-slate-700 pt-2 font-black text-slate-900">
              Authorized By
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Signature & Date</p>
          </div>
        </div>

        {/* Print CSS Rules */}
        <style dangerouslySetInnerHTML={{__html: `
          @page {
            size: A4;
            margin: 12mm;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
            .printable-voucher { box-shadow: none !important; border: 0 !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
            nav, aside, header, footer, button, a[href] { display: none !important; }
          }
        `}} />
      </div>
    </div>
  );
}
