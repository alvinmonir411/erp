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
        setError(err.message || 'চালানের তথ্য লোড করা যায়নি');
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
          <p className="text-sm font-semibold text-slate-600">চালান ও সমন্বয় ভাউচার লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-white rounded-3xl shadow-sm border border-slate-200">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">চালান পাওয়া যায়নি</h2>
        <p className="text-sm text-slate-500 mt-1">{error || 'অনুগ্রহ করে সঠিক চালান আইডি সিলেক্ট করুন।'}</p>
        <Link
          href="/purchases"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>চালান তালিকায় ফিরে যান</span>
        </Link>
      </div>
    );
  }

  const primaryPayment: PurchasePayment | undefined = purchase.payments && purchase.payments.length > 0 ? purchase.payments[0] : undefined;

  const totalReceivedValue = toNumber(purchase.totalAmount);
  const totalPaid = toNumber(purchase.paidAmount);
  const advanceRemaining = Math.max(0, totalPaid - totalReceivedValue);
  const dueRemaining = Math.max(0, totalReceivedValue - totalPaid);

  // Extract ordered quantity from payment breakdown if available
  const getOrderedQty = (item: any): number => {
    if (primaryPayment?.productBreakdown && Array.isArray(primaryPayment.productBreakdown)) {
      const matched = primaryPayment.productBreakdown.find(
        (b: any) =>
          b.productId === item.productId ||
          (b.productName && item.product?.name && b.productName.trim().toLowerCase() === item.product.name.trim().toLowerCase())
      );
      if (matched && matched.quantity) {
        return toNumber(matched.quantity);
      }
    }
    // Default fallback to received qty if no separate pre-order breakdown was specified
    return toNumber(item.quantity);
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 sm:px-6 print:bg-white print:p-0 print:m-0 text-slate-900">
      {/* 🎛️ Action Bar (Hidden when printing) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link
          href="/purchases"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>চালান তালিকায় ফিরুন</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/purchases/${purchase.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-300 transition-colors"
          >
            <span>চালান বিস্তারিত</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
          >
            <Printer className="h-4 w-4" />
            <span>🖨️ ভাউচার প্রিন্ট করুন</span>
          </button>
        </div>
      </div>

      {/* 📄 Standard A4 Printable Voucher Container */}
      <div className="printable-voucher max-w-4xl mx-auto bg-white rounded-3xl p-8 sm:p-10 shadow-lg border border-slate-200 print:shadow-none print:border-0 print:p-0 print:rounded-none">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-6 mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-lg bg-indigo-900 text-white px-2.5 py-1 text-xs font-black tracking-wider uppercase">
                Stock In Voucher
              </span>
              <span className="rounded-lg bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold">
                {purchase.status === 'CONFIRMED' ? '✅ স্টক ইন সম্পন্ন' : 'খসড়া চালান'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              চালান প্রাপ্তি ও ব্যাংক ড্রাফট সমন্বয় ভাউচার
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              ডিলার এন্টারপ্রাইজ ম্যানেজমেন্ট সিস্টেম • ইনওয়ার্ড চালান ও পেমেন্ট রিকনসিলিয়েশন
            </p>
          </div>

          <div className="text-left sm:text-right shrink-0 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-slate-100">
            <p className="text-xs uppercase tracking-wider font-bold text-slate-500">চালান / ইনভয়েস নং</p>
            <p className="text-xl font-black text-indigo-900 mt-0.5">#{purchase.invoiceNo || purchase.referenceNo || purchase.id}</p>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              তারিখ: <b className="text-slate-800">{formatDate(purchase.purchaseDate)}</b>
            </p>
            <p className="text-[11px] text-slate-400">
              এন্ট্রি সময়: {formatDateTime(purchase.createdAt)}
            </p>
          </div>
        </div>

        {/* 🏢 Company & Bank Draft Information 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Supplier / Company Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-indigo-800 mb-2 font-bold text-xs uppercase tracking-wider">
              <Building2 className="h-4 w-4 text-indigo-600" />
              <span>সাপ্লাইয়ার / কোম্পানির বিবরণ</span>
            </div>
            <h3 className="text-lg font-black text-slate-900">
              {purchase.company?.name || purchase.supplierName || 'কোম্পানি সরবরাহকারী'}
            </h3>
            {purchase.company?.code && (
              <p className="text-xs text-indigo-700 font-bold mt-0.5">কোড: {purchase.company.code}</p>
            )}
            {purchase.company?.phone && (
              <p className="text-xs text-slate-600 mt-1">ফোন: {purchase.company.phone}</p>
            )}
            {purchase.company?.address && (
              <p className="text-xs text-slate-500 mt-0.5">{purchase.company.address}</p>
            )}
            {purchase.supplierName && purchase.company?.name !== purchase.supplierName && (
              <p className="text-xs text-slate-600 mt-1">সরবরাহকারী প্রতিনিধি: {purchase.supplierName}</p>
            )}
          </div>

          {/* Linked Bank Draft / Payment Card */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 text-emerald-800 mb-2 font-bold text-xs uppercase tracking-wider">
              <Wallet className="h-4 w-4 text-emerald-600" />
              <span>সংশ্লিষ্ট ব্যাংক ড্রাফট ও পেমেন্ট বিবরণ</span>
            </div>
            {primaryPayment ? (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">পেমেন্ট মেথড:</span>
                  <span className="font-bold text-slate-800 uppercase">{primaryPayment.paymentMethod || 'BANK DRAFT'}</span>
                </div>
                {primaryPayment.transactionRef && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">ড্রাফট / চেক / ট্রানজেকশন নং:</span>
                    <span className="font-black text-indigo-900 font-mono">{primaryPayment.transactionRef}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">ড্রাফট প্রদানের তারিখ:</span>
                  <span className="font-bold text-slate-800">{formatDate(primaryPayment.paymentDate)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-emerald-200/60 mt-1">
                  <span className="font-bold text-slate-700">ড্রাফটে পরিশোধিত টাকা:</span>
                  <span className="font-black text-emerald-800 text-sm">{formatCurrency(primaryPayment.amount)}</span>
                </div>
              </div>
            ) : totalPaid > 0 ? (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">পরিশোধের স্থিতি:</span>
                  <span className="font-bold text-emerald-700">অগ্রিম পরিশোধিত</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-emerald-200 mt-1">
                  <span className="font-bold text-slate-700">পরিশোধিত মোট টাকা:</span>
                  <span className="font-black text-emerald-800 text-sm">{formatCurrency(totalPaid)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic mt-2">
                সরাসরি চালান এন্ট্রি (কোন পূর্ব ব্যাংক ড্রাফট লিংক করা নেই)
              </p>
            )}
          </div>
        </div>

        {/* 📦 Product Reconciliation Table */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200">
          <div className="bg-slate-900 px-4 py-2.5 text-white flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-indigo-400" />
              <span>চালানের পণ্যের তালিকা ও হিসাব (Item Breakdown & Reconciliation)</span>
            </span>
            <span className="text-xs font-bold text-slate-300">
              মোট আইটেম: {(purchase.items ?? []).length} টি
            </span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                <th className="py-2.5 px-3 text-center w-10">#</th>
                <th className="py-2.5 px-3">পণ্যের বিবরণ (Product Details)</th>
                <th className="py-2.5 px-3 text-center">অর্ডার ছিল (Order Qty)</th>
                <th className="py-2.5 px-3 text-center bg-indigo-50 text-indigo-900">প্রাপ্তি (Received Qty)</th>
                <th className="py-2.5 px-3 text-center">পার্থক্য (Diff)</th>
                <th className="py-2.5 px-3 text-right">ক্রয় দর (Rate)</th>
                <th className="py-2.5 px-3 text-right">গৃহীত মোট মূল্য (৳)</th>
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
                    <td className="py-3 px-3 text-center text-slate-400 font-mono font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900 text-xs">{item.product?.name || item.productName || `Product #${item.productId}`}</p>
                      {item.product?.sku && (
                        <p className="text-[10px] text-slate-400 font-mono">SKU: {item.product.sku}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-600">
                      {formatNumber(ordQty)} {unit}
                    </td>
                    <td className="py-3 px-3 text-center font-black text-indigo-950 bg-indigo-50/40">
                      {formatNumber(rcvQty)} {unit}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      {diff === 0 ? (
                        <span className="text-emerald-600 text-[11px]">✓ সম্পূর্ণ</span>
                      ) : diff < 0 ? (
                        <span className="text-rose-600 font-black">{diff} {unit} (শর্ট)</span>
                      ) : (
                        <span className="text-indigo-600 font-bold">+{diff} {unit}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-700">
                      {formatCurrency(unitPrice)}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      {formatCurrency(lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ⚖️ Financial Summary Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t-2 border-slate-200 mb-8">
          {/* Notes and instructions */}
          <div className="space-y-2 text-xs text-slate-600">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">চালান ও সমন্বয় নোট:</h4>
            <p className="bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
              {purchase.note || 'কোম্পানি প্রেরিত মাল ও সংশ্লিষ্ট ব্যাংক ড্রাফটের সাথে মিল রেখে পণ্য গোডাউনে স্টক ইন করা হয়েছে।'}
            </p>
          </div>

          {/* Right Totals Calculation */}
          <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex justify-between text-slate-600">
              <span>মোট গৃহীত মালের মূল্য (Received Goods Value):</span>
              <span className="font-black text-slate-900 text-sm">{formatCurrency(totalReceivedValue)}</span>
            </div>

            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
              <span>ব্যাংক ড্রাফটে পরিশোধিত টাকা (Bank Draft Paid):</span>
              <span className="font-black text-indigo-900 text-sm">{formatCurrency(totalPaid)}</span>
            </div>

            {/* Reconciliation Balance Outcome */}
            {advanceRemaining > 0 ? (
              <div className="flex justify-between items-center text-emerald-800 bg-emerald-100/80 p-2.5 rounded-xl font-bold mt-2 border border-emerald-200">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  <span>কোম্পানিতে আমাদের অগ্রিম জমা অবশিষ্ট:</span>
                </span>
                <span className="font-black text-base">{formatCurrency(advanceRemaining)}</span>
              </div>
            ) : dueRemaining > 0 ? (
              <div className="flex justify-between items-center text-rose-800 bg-rose-100/80 p-2.5 rounded-xl font-bold mt-2 border border-rose-200">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-rose-700" />
                  <span>কোম্পানির অতিরিক্ত পাওনা (Due):</span>
                </span>
                <span className="font-black text-base">{formatCurrency(dueRemaining)}</span>
              </div>
            ) : (
              <div className="flex justify-between items-center text-indigo-800 bg-indigo-100/80 p-2.5 rounded-xl font-bold mt-2 border border-indigo-200">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-indigo-700" />
                  <span>হিসাব স্থিতি:</span>
                </span>
                <span className="font-black text-sm">সম্পূর্ণ সমন্বিত (০ বকেয়া)</span>
              </div>
            )}
          </div>
        </div>

        {/* ✍️ Signature Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-12 border-t border-dashed border-slate-300 text-center text-xs text-slate-600">
          <div>
            <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
              প্রস্তুতকারীর স্বাক্ষর
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Prepared By</p>
          </div>

          <div>
            <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
              গোডাউন ইনচার্জ
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Warehouse Store Incharge</p>
          </div>

          <div>
            <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
              কোম্পানি চালক / প্রতিনিধি
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Driver / Delivery Agent</p>
          </div>

          <div>
            <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
              অনুমোদনকারী স্বাক্ষর
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Authorized Signature</p>
          </div>
        </div>

        {/* Print styling */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
            .printable-voucher { box-shadow: none !important; border: 0 !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
            nav, aside, header, footer { display: none !important; }
          }
        `}} />
      </div>
    </div>
  );
}
