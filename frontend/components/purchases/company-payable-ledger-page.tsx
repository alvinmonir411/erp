'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  getCompanyPayableLedger,
  recordCompanyPayment,
  confirmPurchase,
} from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, formatDateTime, toNumber } from '@/lib/utils/format';
import type { CompanyPayableLedger, ProductSupplySummary, Purchase, CompanyPayableHistoryEntry } from '@/types/api';
import {
  Building2,
  Calendar,
  Wallet,
  CheckCircle,
  TrendingDown,
  Package,
  FileText,
  Plus,
  ArrowLeft,
  X,
  ChevronDown,
  ChevronUp,
  CreditCard,
} from 'lucide-react';

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CompanyPayableLedgerPage({ companyId }: { companyId: number }) {
  const [details, setDetails] = useState<CompanyPayableLedger | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  const [activeTab, setActiveTab] = useState<'products' | 'invoices' | 'payments'>('products');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(formatDateInput(new Date()));
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | undefined>(undefined);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  useToastNotification({
    message: toastMessage,
    title: toastTone === 'success' ? 'সফল হয়েছে' : 'ত্রুটি',
    tone: toastTone,
  });

  const refreshDetails = useCallback(
    async (showLoader: boolean) => {
      try {
        if (showLoader) setIsLoading(true);
        setError(null);
        const nextDetails = await getCompanyPayableLedger(companyId);
        setDetails(nextDetails);
      } catch (loadError: any) {
        setError(loadError.message || 'কোম্পানি লেজার লোড করা যায়নি');
      } finally {
        if (showLoader) setIsLoading(false);
      }
    },
    [companyId],
  );

  useEffect(() => {
    void refreshDetails(true);
  }, [refreshDetails]);

  const openPaymentModal = (purchaseId?: number, suggestedAmount?: number) => {
    setSelectedPurchaseId(purchaseId);
    if (suggestedAmount) {
      setPaymentAmount(String(suggestedAmount));
    } else if (details) {
      const payable = toNumber(details.summary.currentPayable ?? details.summary.totalPayable);
      if (payable > 0) setPaymentAmount(String(payable));
      else setPaymentAmount('');
    } else {
      setPaymentAmount('');
    }

    setPaymentDate(formatDateInput(new Date()));
    setPaymentMethod('CASH');
    setTransactionRef('');
    setPaymentNote(purchaseId ? `Invoice #${purchaseId} settlement` : '');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setToastTone('error');
      setToastMessage('সঠিক টাকার অংক লিখুন');
      return;
    }

    try {
      setIsSubmittingPayment(true);
      await recordCompanyPayment(companyId, {
        amount: amt,
        paymentDate,
        paymentMethod,
        transactionRef: transactionRef.trim() || undefined,
        note: paymentNote.trim() || undefined,
        purchaseId: selectedPurchaseId,
      });

      setToastTone('success');
      setToastMessage('কোম্পানিকে টাকা পরিশোধের এন্ট্রি সফলভাবে সম্পন্ন হয়েছে!');
      setIsPaymentModalOpen(false);
      await refreshDetails(false);
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'পেমেন্ট সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleConfirmPurchase = async (purchaseId: number) => {
    try {
      setConfirmingId(purchaseId);
      await confirmPurchase(purchaseId);
      setToastTone('success');
      setToastMessage('চালানটি স্টক ইন ও নিশ্চিত করা হয়েছে!');
      await refreshDetails(false);
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'চালান নিশ্চিত করতে সমস্যা হয়েছে');
    } finally {
      setConfirmingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingBlock label="কোম্পানি খতিয়ান লোড হচ্ছে..." />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="space-y-4 p-6">
        <Link
          href="/purchases"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>কোম্পানি তালিকায় ফিরে যান</span>
        </Link>
        <StateMessage
          title="কোম্পানি লেজার লোড করা যায়নি"
          description={error || 'কোম্পানি খুঁজে পাওয়া যায়নি।'}
        />
      </div>
    );
  }

  const { company, summary, payablePurchases, paymentHistory, productSummary = [] } = details;
  const totalPurchases = toNumber(summary.totalPurchases);
  const totalPaid = toNumber(summary.totalPaid);
  const currentPayable = toNumber(summary.currentPayable ?? summary.totalPayable);

  return (
    <div className="space-y-6 pb-16 text-slate-800">
      {/* 🌟 Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <Link
              href="/purchases"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md mb-3 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>কোম্পানি তালিকায় ফিরুন</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-500/30 p-3 text-white">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {company.name}
                </h1>
                <p className="mt-0.5 text-xs text-indigo-200">
                  {company.phone ? `ফোন: ${company.phone} • ` : ''}
                  {company.address ? `ঠিকানা: ${company.address} • ` : ''}
                  কোড: {company.code || company.id}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => openPaymentModal()}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <Wallet className="h-4 w-4" />
              <span>💸 টাকা পরিশোধ করুন</span>
            </button>
            <Link
              href="/purchases/create"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>+ নতুন চালান এন্ট্রি</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 📊 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              মোট প্রাপ্ত মাল (Total Goods In)
            </span>
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">
            {formatCurrency(totalPurchases)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            উক্ত কোম্পানি থেকে মোট আসা মালের মূল্য
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              মোট পরিশোধিত টাকা (Total Paid)
            </span>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600">
            {formatCurrency(totalPaid)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            কোম্পানিকে এ পর্যন্ত মোট প্রদান করা হয়েছে
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              কোম্পানির বর্তমান পাওনা (Due)
            </span>
            <div className="rounded-xl bg-rose-100 p-2.5 text-rose-600">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-rose-600">
            {formatCurrency(currentPayable)}
          </p>
          <p className="mt-1 text-xs text-rose-600/80 font-medium">
            {currentPayable > 0 ? 'কোম্পানি এখনো টাকা পাবে' : 'সম্পূর্ণ পরিশোধিত'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              মোট প্রোডাক্ট ও চালান
            </span>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{productSummary.length}</span>
            <span className="text-xs font-semibold text-slate-500">টি প্রোডাক্ট</span>
            <span className="text-slate-300">•</span>
            <span className="text-lg font-bold text-indigo-600">{payablePurchases.length}</span>
            <span className="text-xs font-semibold text-slate-500">টি চালান</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            পেমেন্ট ট্রানজেকশন: {paymentHistory.length} টি
          </p>
        </div>
      </div>

      {/* 🧭 Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'products'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>📦 কোন কোন প্রোডাক্ট কত টাকার দিয়েছে ({productSummary.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'invoices'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>📑 চালানের তালিকা ও আইটেম ({payablePurchases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'payments'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>💳 টাকা পরিশোধের খতিয়ান ও রিসিট ({paymentHistory.length})</span>
        </button>
      </div>

      {/* TAB 1: PRODUCT SUPPLY BREAKDOWN */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5 text-left">প্রোডাক্টের নাম</th>
                    <th className="px-5 py-3.5 text-right">মোট প্রাপ্ত সংখ্যা</th>
                    <th className="px-5 py-3.5 text-right">মোট মালের মূল্য (টাকা)</th>
                    <th className="px-5 py-3.5 text-right">গড় ক্রয় রেট</th>
                    <th className="px-5 py-3.5 text-right">বর্তমান স্টক</th>
                    <th className="px-5 py-3.5 text-center">চালান সংখ্যা</th>
                    <th className="px-5 py-3.5 text-center">শেষ আসার তারিখ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {productSummary.map((p) => (
                    <tr key={p.productId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{p.productName}</div>
                        <div className="text-xs text-slate-500">#{p.productId} • একক: {p.unit || 'Pcs'}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-slate-900">
                        {p.totalQuantity} {p.unit || 'Pcs'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-indigo-700">
                        {formatCurrency(p.totalCost)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-slate-600">
                        ৳{p.avgUnitCost || p.latestBuyPrice || 0}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                        {p.currentStock || 0} {p.unit || 'Pcs'}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-700">
                          {p.purchaseCount} বার
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-xs text-slate-500">
                        {p.lastPurchaseDate ? formatDate(p.lastPurchaseDate) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {productSummary.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <StateMessage
                title="কোন প্রোডাক্টের সরবরাহ নেই"
                description="এই কোম্পানির কোনো চালানের রেকর্ড এখনো পাওয়া যায়নি।"
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVOICES LIST */}
      {activeTab === 'invoices' && (
        <div className="space-y-3">
          {payablePurchases.map((purchase: any) => {
            const isPayable = toNumber(purchase.payableAmount) > 0;
            const isExpanded = expandedInvoiceId === purchase.id;
            const isConfirmed = purchase.status === 'CONFIRMED';

            return (
              <div
                key={purchase.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all"
              >
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => setExpandedInvoiceId(isExpanded ? null : purchase.id)}
                      className="mt-1 rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-base">
                          #{purchase.invoiceNo || `PUR-${purchase.id}`}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isConfirmed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isConfirmed ? '✅ স্টক ইন সম্পন্ন' : '⏳ ড্রাফট (Draft)'}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isPayable ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isPayable ? `বাকি: ${formatCurrency(purchase.payableAmount)}` : 'পরিশোধিত'}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        তারিখ: {formatDate(purchase.purchaseDate)}
                        {purchase.supplierName ? ` • সরবরাহকারী: ${purchase.supplierName}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 lg:justify-end">
                    <div className="text-left lg:text-right">
                      <span className="text-xs text-slate-500 font-medium">চালানের মোট মূল্য</span>
                      <p className="text-base font-black text-slate-900">
                        {formatCurrency(purchase.totalAmount)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isConfirmed && (
                        <button
                          onClick={() => handleConfirmPurchase(purchase.id)}
                          disabled={confirmingId === purchase.id}
                          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                        >
                          {confirmingId === purchase.id ? 'স্টক ইন হচ্ছে...' : 'স্টক ইন নিশ্চিত করুন'}
                        </button>
                      )}

                      {isPayable && (
                        <button
                          onClick={() => openPaymentModal(purchase.id, toNumber(purchase.payableAmount))}
                          className="rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3.5 py-2 text-xs font-bold transition-all"
                        >
                          টাকা দিন
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable Items Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      চালানে থাকা প্রোডাক্টের তালিকা:
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold">
                          <tr>
                            <th className="px-4 py-2 text-left">প্রোডাক্ট</th>
                            <th className="px-4 py-2 text-right">পরিমাণ</th>
                            <th className="px-4 py-2 text-right">ক্রয় রেট</th>
                            <th className="px-4 py-2 text-right">মোট টাকা</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(purchase.items || []).map((item: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 font-medium text-slate-900">
                                {item.productName || item.product?.name || `Product #${item.productId}`}
                              </td>
                              <td className="px-4 py-2 text-right font-bold text-slate-800">
                                {item.quantity} {item.unit || 'Pcs'}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-600">
                                {formatCurrency(item.unitCost)}
                              </td>
                              <td className="px-4 py-2 text-right font-black text-indigo-600">
                                {formatCurrency(item.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {purchase.note && (
                      <p className="mt-2 text-xs text-slate-500 italic">নোট: {purchase.note}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {payablePurchases.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <StateMessage
                title="কোন চালানের রেকর্ড নেই"
                description="এই কোম্পানির কোনো চালানের এন্ট্রি পাওয়া যায়নি।"
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENT RECEIPTS & HISTORY */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5 text-left">পরিশোধের তারিখ</th>
                    <th className="px-5 py-3.5 text-right">পরিশোধিত টাকা</th>
                    <th className="px-5 py-3.5 text-center">পেমেন্ট মেথড</th>
                    <th className="px-5 py-3.5 text-left">চেক / স্লিপ রেফারেন্স</th>
                    <th className="px-5 py-3.5 text-left">নোট / বিবরণ</th>
                    <th className="px-5 py-3.5 text-center">এন্ট্রি কারী</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paymentHistory.map((pay: any) => (
                    <tr key={pay.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {formatDate(pay.paymentDate)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-emerald-600">
                        {formatCurrency(pay.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {pay.paymentMethod || 'CASH'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs font-mono">
                        {pay.transactionRef || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 text-xs max-w-xs">
                        {pay.note || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-center text-xs text-slate-500">
                        {pay.createdByName || 'Admin'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {paymentHistory.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <StateMessage
                title="কোন পেমেন্টের হিসাব নেই"
                description="কোম্পানিকে টাকা দেওয়া হলে উপরের 'টাকা পরিশোধ করুন' বাটনে চাপ দিয়ে এন্ট্রি করুন।"
              />
            </div>
          )}
        </div>
      )}

      {/* 💳 RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{company.name} কে টাকা পরিশোধ</h3>
                  <p className="text-xs text-slate-500">টাকা দেওয়ার হিসাব সেভ করুন</p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="mt-5 space-y-4">
              {currentPayable > 0 && (
                <div className="rounded-xl bg-rose-50 p-3 border border-rose-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-700">কোম্পানির বর্তমান মোট পাওনা:</span>
                  <span className="text-sm font-black text-rose-700">{formatCurrency(currentPayable)}</span>
                </div>
              )}

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    টাকার পরিমাণ (BDT) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    placeholder="যেমন: 50000"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    পরিশোধের তারিখ *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Method & Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    পেমেন্ট মেথড
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
                  >
                    <option value="CASH">নগদ (Cash)</option>
                    <option value="BANK">ব্যাংক ট্রান্সফার (Bank)</option>
                    <option value="BKASH">বিকাশ (bKash)</option>
                    <option value="NAGAD">নগদ (Nagad)</option>
                    <option value="CHEQUE">চেক (Cheque)</option>
                    <option value="OTHER">অন্যান্য (Other)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    চেক বা স্লিপ নম্বর
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="যেমন: CHQ-9981 / TrxID"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Note / Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  নোট / কোন প্রোডাক্ট বা চালানের জন্য দেওয়া হলো
                </label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={2}
                  placeholder="যেমন: সানলাইট কয়েল ৫০০ পিস চালান বাবদ ক্যাশ পরিশোধ..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {isSubmittingPayment ? 'সংরক্ষণ হচ্ছে...' : 'পেমেন্ট নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
