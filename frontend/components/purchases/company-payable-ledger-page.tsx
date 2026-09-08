'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  getCompanyPayableLedger,
  recordCompanyPayment,
  confirmPurchase,
} from '@/lib/api/purchases';
import { getProducts } from '@/lib/api/products';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, formatDateTime, toNumber } from '@/lib/utils/format';
import type { CompanyPayableLedger, ProductSupplySummary, Purchase, CompanyPayableHistoryEntry, Product } from '@/types/api';
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
  Search,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Trash2,
} from 'lucide-react';

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type ProductPaymentRow = {
  productId: number | '';
  productName?: string;
  unitPrice?: string;
  unit?: string;
  quantity?: string;
  amount: string;
  note?: string;
  searchText?: string;
  showResults?: boolean;
};

export function CompanyPayableLedgerPage({ companyId }: { companyId: number }) {
  const [details, setDetails] = useState<CompanyPayableLedger | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
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
  const [isProductBreakdownMode, setIsProductBreakdownMode] = useState(false);
  const [productPaymentRows, setProductPaymentRows] = useState<ProductPaymentRow[]>([]);
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
        const [nextDetails, prods] = await Promise.all([
          getCompanyPayableLedger(companyId),
          getProducts().catch(() => getProducts({ companyId }).catch(() => [])),
        ]);
        setDetails(nextDetails);
        setAllProducts(Array.isArray(prods) ? prods : prods?.data || []);
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
    setIsProductBreakdownMode(true);
    setProductPaymentRows([
      { productId: '', unitPrice: '', quantity: '1', amount: '', note: '', searchText: '', showResults: false }
    ]);
    setIsPaymentModalOpen(true);
  };

  const calculateRowAmount = (unitPriceStr?: string, quantityStr?: string): string => {
    const price = parseFloat(unitPriceStr || '0');
    const qty = parseFloat(quantityStr || '0');
    if (!isNaN(price) && !isNaN(qty) && price >= 0 && qty > 0) {
      const total = price * qty;
      return total % 1 === 0 ? total.toString() : total.toFixed(2);
    }
    return '';
  };

  const handleAddProductRow = () => {
    setIsProductBreakdownMode(true);
    setProductPaymentRows((prev) => [
      ...prev,
      { productId: '', unitPrice: '', quantity: '1', amount: '', note: '', searchText: '', showResults: false },
    ]);
  };

  const handleSelectProduct = (index: number, product: Product) => {
    setProductPaymentRows((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };
      target.productId = product.id;
      target.productName = product.name;
      target.unit = product.unit || 'Pcs';
      target.searchText = product.name;
      target.showResults = false;
      target.unitPrice = product.buyPrice !== undefined && product.buyPrice !== null ? String(toNumber(product.buyPrice)) : target.unitPrice || '';

      if (!target.quantity || target.quantity === '0') {
        target.quantity = '1';
      }

      const calc = calculateRowAmount(target.unitPrice, target.quantity);
      if (calc) {
        target.amount = calc;
      }

      updated[index] = target;

      const totalRowAmount = updated.reduce(
        (sum, row) => sum + (parseFloat(row.amount) || 0),
        0,
      );
      if (totalRowAmount > 0) {
        setPaymentAmount(totalRowAmount % 1 === 0 ? totalRowAmount.toString() : totalRowAmount.toFixed(2));
      }

      return updated;
    });
  };

  const handleUpdateProductRow = (
    index: number,
    field: keyof ProductPaymentRow,
    value: any,
  ) => {
    setProductPaymentRows((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      if (field === 'searchText') {
        target.searchText = value;
        target.showResults = true;
        if (value && typeof value === 'string') {
          const trimmed = value.trim().toLowerCase();
          if (trimmed.length > 0) {
            const matched = allProducts.find(
              (p) =>
                (p.companyId ? p.companyId === companyId : true) &&
                (p.name?.toLowerCase().trim() === trimmed ||
                  p.sku?.toLowerCase().trim() === trimmed ||
                  p.name?.toLowerCase().trim().startsWith(trimmed) ||
                  (trimmed.length >= 3 && p.name?.toLowerCase().includes(trimmed))),
            );
            if (matched) {
              target.productId = matched.id;
              target.productName = matched.name;
              target.unit = matched.unit || 'Pcs';
              if (matched.buyPrice !== undefined && matched.buyPrice !== null) {
                target.unitPrice = String(toNumber(matched.buyPrice));
              }
              const calc = calculateRowAmount(target.unitPrice, target.quantity);
              if (calc) target.amount = calc;
            }
          }
        }
      } else if (field === 'unitPrice') {
        target.unitPrice = value;
        const calc = calculateRowAmount(value, target.quantity);
        if (calc) {
          target.amount = calc;
        }
      } else if (field === 'quantity') {
        target.quantity = value;
        let rate = target.unitPrice;
        if (!rate && target.productId) {
          const prod = allProducts.find((p) => p.id === Number(target.productId));
          if (prod && prod.buyPrice) {
            rate = String(toNumber(prod.buyPrice));
            target.unitPrice = rate;
          }
        }
        const calc = calculateRowAmount(rate, value);
        if (calc) {
          target.amount = calc;
        }
      } else if (field === 'amount') {
        target.amount = value;
      }

      updated[index] = target;

      const totalRowAmount = updated.reduce(
        (sum, row) => sum + (parseFloat(row.amount) || 0),
        0,
      );
      if (totalRowAmount > 0) {
        setPaymentAmount(totalRowAmount % 1 === 0 ? totalRowAmount.toString() : totalRowAmount.toFixed(2));
      }

      return updated;
    });
  };

  const handleRemoveProductRow = (index: number) => {
    setProductPaymentRows((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      const totalRowAmount = updated.reduce(
        (sum, row) => sum + (parseFloat(row.amount) || 0),
        0,
      );
      if (totalRowAmount > 0) {
        setPaymentAmount(totalRowAmount % 1 === 0 ? totalRowAmount.toString() : totalRowAmount.toFixed(2));
      } else if (updated.length === 0) {
        setIsProductBreakdownMode(false);
      }
      return updated;
    });
  };

  const handleSavePayment = async (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setToastTone('error');
      setToastMessage('সঠিক টাকার অংক লিখুন');
      return;
    }

    const validBreakdown = productPaymentRows
      .filter((row) => row.productId || parseFloat(row.amount) > 0 || row.searchText)
      .map((row) => {
        let prod = allProducts.find((p) => p.id === Number(row.productId));
        if (!prod && row.searchText) {
          prod = allProducts.find((p) => p.name.toLowerCase().trim() === (row.searchText || '').toLowerCase().trim());
        }
        return {
          productId: prod?.id || (row.productId ? Number(row.productId) : undefined),
          productName: prod?.name || row.productName || row.searchText || undefined,
          unitPrice: row.unitPrice ? parseFloat(row.unitPrice) : prod?.buyPrice ? Number(prod.buyPrice) : undefined,
          unit: prod?.unit || row.unit || 'Pcs',
          quantity: row.quantity ? Number(row.quantity) : undefined,
          amount: parseFloat(row.amount) || 0,
          note: row.note?.trim() || undefined,
        };
      });

    try {
      setIsSubmittingPayment(true);
      await recordCompanyPayment(companyId, {
        amount: amt,
        paymentDate,
        paymentMethod,
        transactionRef: transactionRef.trim() || undefined,
        note: paymentNote.trim() || undefined,
        purchaseId: selectedPurchaseId,
        productBreakdown: validBreakdown.length > 0 ? validBreakdown : undefined,
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
        <LoadingBlock
          label="কোম্পানি খতিয়ান লোড হচ্ছে..."
          subLabel="অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন, লেনদেন ও পেমেন্ট হিস্ট্রি প্রস্তুত করা হচ্ছে..."
        />
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
  const advanceBalance = toNumber(summary.advanceBalance ?? summary.advanceAmount);
  const isAdvance = advanceBalance > 0;
  const hasDue = currentPayable > 0;

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

        {isAdvance ? (
          <div className="rounded-2xl border border-sky-300 bg-sky-50/70 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                💎 আমাদের অগ্রিম জমা (আমরা পাব)
              </span>
              <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-sky-700">
              {formatCurrency(advanceBalance)}
            </p>
            <p className="mt-1 text-xs text-sky-700 font-medium">
              কোম্পানি আমাদের <b>{formatCurrency(advanceBalance)}</b> টাকার মাল দিবে বা টাকা ফেরত দিবে
            </p>
          </div>
        ) : hasDue ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                ⚠️ কোম্পানির পাওনা (আমাদের দিতে হবে)
              </span>
              <div className="rounded-xl bg-rose-100 p-2.5 text-rose-600">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-rose-600">
              {formatCurrency(currentPayable)}
            </p>
            <p className="mt-1 text-xs text-rose-600/80 font-medium">
              কোম্পানি আমাদের কাছে বকেয়া বাবদ এখনো টাকা পাবে
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                ✅ হিসাব সম্পূর্ণ পরিশোধ
              </span>
              <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-emerald-700">
              ৳০
            </p>
            <p className="mt-1 text-xs text-emerald-600 font-medium">
              কোনো বকেয়া পাওনা বা অগ্রিম নেই
            </p>
          </div>
        )}

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
                    <th className="px-5 py-3.5 text-center">অ্যাকশন</th>
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
                      <td className="px-5 py-3.5 text-center">
                        <Link
                          href={`/purchases/create?companyId=${companyId}&paymentId=${pay.id}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 text-xs font-bold transition-all"
                          title="এই পেমেন্টের মাল রিসিভ ও চালান স্টক ইন করুন"
                        >
                          <Package className="h-3.5 w-3.5" />
                          <span>চালান ইন</span>
                        </Link>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="relative w-full max-w-4xl lg:max-w-5xl my-4 sm:my-6 rounded-3xl bg-white p-5 sm:p-7 shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{company.name} কে টাকা পরিশোধ</h3>
                  <p className="text-xs text-slate-500">সাধারণ বা একাধিক প্রোডাক্টের জন্য টাকা দেওয়ার হিসাব সেভ করুন</p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="mt-5 space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Balance Banner */}
              {isAdvance ? (
                <div className="rounded-xl bg-sky-50 p-3 border border-sky-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-800">💎 আমাদের অগ্রিম জমা আছে:</span>
                  <span className="text-sm font-black text-sky-700">{formatCurrency(advanceBalance)}</span>
                </div>
              ) : hasDue ? (
                <div className="rounded-xl bg-rose-50 p-3 border border-rose-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-700">⚠️ কোম্পানির বর্তমান মোট পাওনা:</span>
                  <span className="text-sm font-black text-rose-700">{formatCurrency(currentPayable)}</span>
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700">✅ হিসাব পরিশোধিত (কোন বাকি বা অগ্রিম নেই)</span>
                </div>
              )}

              {/* 📦 MULTI-PRODUCT ALLOCATION (PERMANENTLY OPEN & DIRECT) */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">
                      কোন কোন প্রোডাক্টের জন্য কত টাকা দেওয়া হচ্ছে:
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProductRow}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ প্রোডাক্ট যোগ করুন</span>
                  </button>
                </div>

                {/* Column Headers for desktop */}
                {productPaymentRows.length > 0 && (
                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 pb-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <div className="sm:col-span-4">প্রোডাক্ট সিলেক্ট / সার্চ</div>
                    <div className="sm:col-span-2">ক্রয় দর (৳)</div>
                    <div className="sm:col-span-2">পরিমাণ</div>
                    <div className="sm:col-span-2 text-emerald-700">মোট টাকা (৳) *</div>
                    <div className="sm:col-span-2">নোট (ঐচ্ছিক)</div>
                  </div>
                )}

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {productPaymentRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:grid sm:grid-cols-12 items-stretch sm:items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm hover:border-indigo-200 transition-colors"
                    >
                      {/* Searchable Product Input */}
                      <div className="relative sm:col-span-4 w-full">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="প্রোডাক্ট খুঁজুন বা নাম লিখুন..."
                            value={
                              row.searchText !== undefined
                                ? row.searchText
                                : row.productName
                                ? `${row.productName}${row.unit ? ` (${row.unit})` : ''}`
                                : ''
                            }
                            onFocus={() => {
                              handleUpdateProductRow(idx, 'showResults', true);
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setProductPaymentRows((prev) => {
                                  const updated = [...prev];
                                  if (updated[idx]) {
                                    updated[idx] = { ...updated[idx], showResults: false };
                                  }
                                  return updated;
                                });
                              }, 250);
                            }}
                            onChange={(e) => {
                              handleUpdateProductRow(idx, 'searchText', e.target.value);
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                          />
                          {(row.searchText || row.productId || row.productName) && (
                            <button
                              type="button"
                              onClick={() => {
                                setProductPaymentRows((prev) => {
                                  const updated = [...prev];
                                  updated[idx] = {
                                    ...updated[idx],
                                    productId: '',
                                    productName: '',
                                    unitPrice: '',
                                    searchText: '',
                                    showResults: false,
                                    amount: '',
                                  };
                                  return updated;
                                });
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                              title="মুছুন"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Dropdown Options Panel */}
                        {row.showResults && (
                          <div className="absolute left-0 top-full z-[9999] mt-1 max-h-56 w-full min-w-[280px] sm:min-w-[340px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl ring-1 ring-black/5 animate-fadeIn">
                            {(() => {
                              const query = (row.searchText ?? row.productName ?? '').toLowerCase().trim();
                              const filtered = allProducts.filter((p) => {
                                if (p.companyId && p.companyId !== companyId) return false;
                                if (!query) return true;
                                const matchName = p.name?.toLowerCase().includes(query);
                                const matchSku = p.sku?.toLowerCase().includes(query);
                                return matchName || matchSku;
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-3 text-center text-xs text-slate-400 font-medium">
                                    কোনো প্রোডাক্ট খুঁজে পাওয়া যায়নি
                                  </div>
                                );
                              }

                              return filtered.map((p) => {
                                const isSelected = row.productId === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSelectProduct(idx, p);
                                    }}
                                    className={`w-full flex items-center justify-between gap-2 rounded-lg p-2 text-left text-xs transition-colors ${
                                      isSelected
                                        ? 'bg-indigo-50 text-indigo-900 font-bold'
                                        : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="font-bold text-slate-900 truncate">
                                        {p.name}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                        {p.buyPrice ? (
                                          <span className="text-emerald-700 font-medium">
                                            ক্রয়: ৳{p.buyPrice}
                                          </span>
                                        ) : null}
                                        {p.currentStock !== undefined && (
                                          <span className="text-slate-400">
                                            স্টক: {p.currentStock} {p.unit || 'Pcs'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="inline-block rounded-md bg-indigo-50 hover:bg-indigo-600 hover:text-white px-2 py-1 text-[11px] font-bold text-indigo-700">
                                        সিলেক্ট
                                      </span>
                                    </div>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Unit Buy Rate (ক্রয় দর ৳) */}
                      <div className="sm:col-span-2 w-full">
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={row.unitPrice ?? ''}
                            onChange={(e) => handleUpdateProductRow(idx, 'unitPrice', e.target.value)}
                            placeholder="দর (৳)"
                            title="একক ক্রয় দর (প্রতি পিস / ইউনিট)"
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Quantity (পরিমাণ) */}
                      <div className="sm:col-span-2 w-full">
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={row.quantity || ''}
                            onChange={(e) => handleUpdateProductRow(idx, 'quantity', e.target.value)}
                            placeholder="পরিমাণ"
                            title="পরিমাণ / Quantity"
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Total Amount (মোট টাকা ৳) */}
                      <div className="sm:col-span-2 w-full">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amount}
                            onChange={(e) => handleUpdateProductRow(idx, 'amount', e.target.value)}
                            placeholder="টাকা (BDT) *"
                            title="মোট টাকা (দর × পরিমাণ)"
                            className="w-full rounded-lg border border-emerald-300 bg-emerald-50/60 py-1.5 px-2 text-xs font-black text-emerald-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Note & Delete button */}
                      <div className="sm:col-span-2 flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={row.note || ''}
                          onChange={(e) => handleUpdateProductRow(idx, 'note', e.target.value)}
                          placeholder="নোট (ঐচ্ছিক)"
                          className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs text-slate-600 focus:border-indigo-500 focus:bg-white focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveProductRow(idx)}
                          className="shrink-0 rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                          title="প্রোডাক্ট সারি মুছুন"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {productPaymentRows.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                      কোনো নির্দিষ্ট প্রোডাক্ট সিলেক্ট করা নেই। প্রোডাক্ট সিলেক্ট করতে উপরে <b className="text-indigo-600">+ প্রোডাক্ট যোগ করুন</b> চাপুন।
                    </div>
                  )}
                </div>

                {productPaymentRows.length > 0 && (
                  <div className="mt-2.5 flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 border border-emerald-200/60">
                    <div className="flex items-center gap-3">
                      <span>
                        মোট প্রোডাক্ট: <b className="text-sm font-black">{productPaymentRows.filter((r) => r.productId || r.amount || r.searchText).length}</b> টি
                      </span>
                      {productPaymentRows.some((r) => r.quantity && parseFloat(r.quantity) > 0) && (
                        <span className="text-emerald-700">
                          মোট কোয়ান্টিটি: <b className="text-sm font-black">{productPaymentRows.reduce((sum, r) => sum + (parseFloat(r.quantity || '0') || 0), 0)}</b>
                        </span>
                      )}
                    </div>
                    <span>
                      প্রোডাক্টের মোট যোগফল:{' '}
                      <b className="text-sm font-black text-emerald-900">
                        {formatCurrency(
                          productPaymentRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
                        )}
                      </b>
                    </span>
                  </div>
                )}
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    মোট পরিশোধের পরিমাণ (BDT) *
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
                  {isProductBreakdownMode && (
                    <p className="mt-1 text-[11px] text-indigo-600 font-medium">
                      প্রোডাক্টের টাকার যোগফল স্বয়ংক্রিয়ভাবে এখানে হিসাব হচ্ছে।
                    </p>
                  )}
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
                  নোট / অতিরিক্ত বিবরণ
                </label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={2}
                  placeholder="যেমন: সানলাইট কয়েল ও অন্যান্য পণ্য বাবদ ক্যাশ পরিশোধ..."
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
