'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState, Suspense } from 'react';
import { getCompanies } from '@/lib/api/companies';
import { getProducts } from '@/lib/api/products';
import { createPurchase, getCompanyPayments } from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, toNumber } from '@/lib/utils/format';
import type { Company, Product, PurchasePayment } from '@/types/api';
import {
  Building2,
  Calendar,
  Package,
  Plus,
  ArrowLeft,
  Search,
  Trash2,
  Wallet,
  Truck,
  FileCheck,
  Hash,
  Layers,
} from 'lucide-react';

export type PurchaseRowItem = {
  id: string;
  productId: number | '';
  productName: string;
  orderedQty?: number | string;
  quantity: string;
  unitPrice: string;
  unit?: string;
  note?: string;
  searchText?: string;
  showResults?: boolean;
};

const initialRow = (): PurchaseRowItem => ({
  id: 'row-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
  productId: '',
  productName: '',
  quantity: '1',
  unitPrice: '',
  unit: 'Pcs',
  note: '',
  searchText: '',
  showResults: false,
});

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const mins = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

export function CreatePurchasePage() {
  return (
    <Suspense fallback={<LoadingBlock label="লোড হচ্ছে..." />}>
      <CreatePurchaseContent />
    </Suspense>
  );
}

function CreatePurchaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCompanyIdParam = searchParams.get('companyId');
  const initialPaymentIdParam = searchParams.get('paymentId');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [companyPayments, setCompanyPayments] = useState<PurchasePayment[]>([]);

  const [companyId, setCompanyId] = useState<string>(initialCompanyIdParam || '');
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(
    initialPaymentIdParam ? Number(initialPaymentIdParam) : null,
  );
  const [purchaseDate, setPurchaseDate] = useState(formatDateInput(new Date()));
  const [invoiceNo, setInvoiceNo] = useState(
    `CHL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Date.now().toString().slice(-4)}`,
  );
  const [supplierName, setSupplierName] = useState('');
  const [note, setNote] = useState('');
  const [confirmStockIn, setConfirmStockIn] = useState(true);
  const [paidAmountInput, setPaidAmountInput] = useState('');

  const [items, setItems] = useState<PurchaseRowItem[]>([initialRow()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  useToastNotification({
    message: toastMessage,
    title: toastTone === 'success' ? 'সফল হয়েছে' : 'ত্রুটি',
    tone: toastTone,
  });

  // Load initial data
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const [compList, prodList] = await Promise.all([
          getCompanies().catch(() => []),
          getProducts().catch(() => []),
        ]);
        setCompanies(compList);
        const prods = Array.isArray(prodList) ? prodList : (prodList as any)?.data || [];
        setAllProducts(prods);

        if (!companyId && compList.length > 0) {
          setCompanyId(String(compList[0].id));
        }
      } catch (err: any) {
        setToastTone('error');
        setToastMessage(err.message || 'ফর্ম ডেটা লোড করা যায়নি');
      } finally {
        setIsLoading(false);
      }
    }
    void init();
  }, []);

  // Fetch company payments whenever selected company changes
  useEffect(() => {
    if (!companyId) {
      setCompanyPayments([]);
      return;
    }
    async function loadPayments() {
      try {
        const pays = await getCompanyPayments({ companyId: Number(companyId) });
        setCompanyPayments(Array.isArray(pays) ? pays : []);
      } catch {
        setCompanyPayments([]);
      }
    }
    void loadPayments();
  }, [companyId]);

  // Handle preselected payment if query param exists or changes
  useEffect(() => {
    if (selectedPaymentId && companyPayments.length > 0) {
      const match = companyPayments.find((p) => p.id === selectedPaymentId);
      if (match) {
        applyPaymentBreakdown(match);
      }
    }
  }, [selectedPaymentId, companyPayments]);

  const selectedCompany = useMemo(
    () => companies.find((c) => String(c.id) === companyId),
    [companies, companyId],
  );

  // Filter products for the selected company if assigned
  const companyFilteredProducts = useMemo(() => {
    if (!companyId) return allProducts;
    const cid = Number(companyId);
    const matched = allProducts.filter((p) => p.companyId === cid);
    return matched.length > 0 ? matched : allProducts;
  }, [allProducts, companyId]);

  // Auto populate rows when a payment with productBreakdown is selected
  const applyPaymentBreakdown = (payment: PurchasePayment) => {
    setSelectedPaymentId(payment.id);
    setPaidAmountInput(String(payment.amount));

    if (payment.note && !note) {
      setNote(`পেমেন্ট #${payment.id} এর চালান সমন্বয়: ${payment.note}`);
    }

    if (Array.isArray(payment.productBreakdown) && payment.productBreakdown.length > 0) {
      const newRows: PurchaseRowItem[] = payment.productBreakdown.map((b, idx) => {
        const matchedProd = allProducts.find((p) => p.id === Number(b.productId));
        const price = b.unitPrice ?? (matchedProd ? matchedProd.buyPrice : '');
        const qty = b.quantity ? String(b.quantity) : '1';

        return {
          id: 'row-' + Date.now() + '-' + idx,
          productId: b.productId ? Number(b.productId) : (matchedProd ? matchedProd.id : ''),
          productName: b.productName || matchedProd?.name || '',
          orderedQty: b.quantity ? Number(b.quantity) : undefined,
          quantity: qty,
          unitPrice: price ? String(price) : '',
          unit: b.unit || matchedProd?.unit || 'Pcs',
          note: b.note || '',
          searchText: b.productName || matchedProd?.name || '',
          showResults: false,
        };
      });

      if (newRows.length > 0) {
        setItems(newRows);
        setToastTone('success');
        setToastMessage(`পেমেন্ট #${payment.id} থেকে ${newRows.length} টি অর্ডারকৃত পণ্য লোড হয়েছে!`);
        return;
      }
    }

    setToastTone('success');
    setToastMessage(`পেমেন্ট #${payment.id} (৳${payment.amount}) চালানের সাথে যুক্ত করা হয়েছে!`);
  };

  // Row Manipulation
  const handleAddRow = () => {
    setItems((prev) => [...prev, initialRow()]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length === 1) {
      setItems([initialRow()]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectProduct = (index: number, product: Product) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: product.id,
        productName: product.name,
        searchText: product.name,
        unit: product.unit || 'Pcs',
        unitPrice: String(product.buyPrice || ''),
        showResults: false,
      };
      return next;
    });
  };

  const handleUpdateRow = (index: number, field: keyof PurchaseRowItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };

      if (field === 'searchText') {
        next[index].showResults = true;
        const val = String(value).trim().toLowerCase();
        if (val) {
          const matched = companyFilteredProducts.find(
            (p) =>
              p.name.toLowerCase() === val ||
              p.sku?.toLowerCase() === val ||
              p.name.toLowerCase().startsWith(val),
          );
          if (matched) {
            next[index].productId = matched.id;
            next[index].productName = matched.name;
            next[index].unit = matched.unit || 'Pcs';
            if (!next[index].unitPrice && matched.buyPrice) {
              next[index].unitPrice = String(matched.buyPrice);
            }
          }
        }
      }

      return next;
    });
  };

  // Total invoice sum
  const invoiceTotal = useMemo(() => {
    return items.reduce((sum, row) => {
      const q = parseFloat(row.quantity || '0');
      const p = parseFloat(row.unitPrice || '0');
      if (!isNaN(q) && !isNaN(p) && q > 0 && p >= 0) {
        return sum + q * p;
      }
      return sum;
    }, 0);
  }, [items]);

  const effectivePaid = useMemo(() => {
    const val = parseFloat(paidAmountInput);
    if (!isNaN(val) && val >= 0) return val;
    if (selectedPaymentId) {
      const match = companyPayments.find((p) => p.id === selectedPaymentId);
      if (match) return toNumber(match.amount);
    }
    return 0;
  }, [paidAmountInput, selectedPaymentId, companyPayments]);

  const remainingDue = Math.max(0, invoiceTotal - effectivePaid);
  const remainingAdvance = Math.max(0, effectivePaid - invoiceTotal);

  // Submit Handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!companyId) {
      setToastTone('error');
      setToastMessage('অনুগ্রহ করে কোম্পানি নির্বাচন করুন');
      return;
    }

    const validItems = items.filter(
      (item) => item.productId && parseFloat(item.quantity) > 0 && parseFloat(item.unitPrice) >= 0,
    );

    if (validItems.length === 0) {
      setToastTone('error');
      setToastMessage('কমপক্ষে ১টি সঠিক পণ্য, প্রাপ্ত পরিমাণ এবং ক্রয় দর ইনপুট দিন');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        companyId: Number(companyId),
        purchaseDate: new Date(purchaseDate).toISOString(),
        invoiceNo: invoiceNo.trim() || undefined,
        referenceNo: invoiceNo.trim() || undefined,
        supplierName: supplierName.trim() || undefined,
        note: note.trim() || undefined,
        paymentId: selectedPaymentId ?? undefined,
        paidAmount: effectivePaid,
        status: confirmStockIn ? ('CONFIRMED' as const) : ('DRAFT' as const),
        confirmStockIn: confirmStockIn,
        items: validItems.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitCost: Number(item.unitPrice),
        })),
      };

      const result = await createPurchase(payload);

      setToastTone('success');
      setToastMessage(
        confirmStockIn
          ? `চালান #${result.invoiceNo || result.id} সফলভাবে তৈরি ও গোডাউনে স্টক ইন সম্পন্ন হয়েছে!`
          : `চালান #${result.invoiceNo || result.id} খসড়া হিসেবে সংরক্ষিত হয়েছে!`,
      );

      setTimeout(() => {
        router.push('/purchases');
      }, 1200);
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'চালান সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 text-slate-800">
      {/* 🌟 Top Navigation Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <Link
              href="/purchases"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-200 backdrop-blur-md mb-3 hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>পারচেজ ড্যাশবোর্ডে ফিরে যান</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Package className="h-8 w-8 text-indigo-400" />
              <span>নতুন চালান ও গোডাউনে স্টক ইন</span>
            </h1>
            <p className="mt-1.5 text-sm text-slate-300 max-w-2xl">
              কোম্পানি থেকে আগত মালের চালান এন্ট্রি করুন। পূর্বের অগ্রিম পেমেন্ট সিলেক্ট করে এক ক্লিকে অর্ডারকৃত পণ্য ও প্রাপ্ত পরিমাণ মিলিয়ে গোডাউনে স্টক ইন সম্পন্ন করুন।
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/purchases"
              className="rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition-all"
            >
              বাতিল
            </Link>
            <button
              onClick={handleSubmit}
              disabled={isSaving || isLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <FileCheck className="h-4 w-4" />
              <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : '✅ চালান ও স্টক ইন সম্পন্ন করুন'}</span>
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingBlock label="ফর্ম ডেটা লোড হচ্ছে..." />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 🏢 1. Company & Advance Payment Selector Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-4">
              <Building2 className="h-4 w-4" />
              <span>কোম্পানি ও পেমেন্ট সংযোগ (Company & Paid Order Selection)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  কোম্পানি নির্বাচন করুন <span className="text-rose-500">*</span>
                </label>
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setSelectedPaymentId(null);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                >
                  <option value="">কোম্পানি বাছাই করুন</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(কোড: ${c.code})` : ''}
                    </option>
                  ))}
                </select>
                {selectedCompany && (
                  <p className="mt-1.5 text-xs text-slate-500 font-medium">
                    ফোন: {selectedCompany.phone || 'N/A'} {selectedCompany.address ? `• ঠিকানা: ${selectedCompany.address}` : ''}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  চালান / ইনভয়েস নং <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="CHL-2026-..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  চালানের তারিখ ও সময়
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="datetime-local"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 💳 Available Paid Payments / Advance Orders List for this Company */}
            {companyPayments.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      এই কোম্পানির পূর্বের পরিশোধিত পেমেন্ট / অগ্রিম অর্ডারসমূহ ({companyPayments.length} টি পাওয়া গেছে)
                    </span>
                  </div>
                  {selectedPaymentId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPaymentId(null);
                        setPaidAmountInput('0');
                      }}
                      className="text-xs font-bold text-rose-500 hover:underline"
                    >
                      পেমেন্ট সংযোগ বাতিল করুন
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {companyPayments.map((pay) => {
                    const isSelected = selectedPaymentId === pay.id;
                    const hasBreakdown =
                      Array.isArray(pay.productBreakdown) && pay.productBreakdown.length > 0;

                    return (
                      <div
                        key={pay.id}
                        onClick={() => applyPaymentBreakdown(pay)}
                        className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/30 shadow-md'
                            : 'border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800">
                              পেমেন্ট #{pay.id}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {pay.paymentDate ? formatDate(pay.paymentDate) : ''}
                            </span>
                          </div>
                          <span className="text-sm font-black text-emerald-700">
                            {formatCurrency(pay.amount)}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-600 line-clamp-2 font-medium">
                          {pay.note || `Method: ${pay.paymentMethod}`}
                        </p>

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                          <span className="text-[11px] font-bold text-indigo-600">
                            {hasBreakdown
                              ? `📦 ${pay.productBreakdown.length} টি প্রোডাক্টের অর্ডার ছিল`
                              : '💸 সাধারণ পেমেন্ট'}
                          </span>
                          <span className="font-bold text-emerald-600 flex items-center gap-1">
                            {isSelected ? '✓ সিলেক্টেড' : '+ অর্ডার লোড করুন'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 📦 2. Reconcile Products (Order Qty vs Actually Received Qty) */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                  <Layers className="h-4 w-4" />
                  <span>চালানের পণ্যের তালিকা ও গোডাউনে স্টক ইন (Product Reconciliation Table)</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  অর্ডারকৃত পণ্যের সাথে বাস্তবের প্রাপ্ত পরিমাণ (Actually Received Qty) মিলিয়ে ইনপুট দিন।
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-all self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ নতুন পণ্য যোগ করুন</span>
              </button>
            </div>

            {/* Product Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
              <div className="col-span-4">পণ্য নির্বাচন (Product)</div>
              <div className="col-span-2 text-center">অর্ডার ছিল (Order Qty)</div>
              <div className="col-span-2 text-center">প্রাপ্ত পরিমাণ (Received) *</div>
              <div className="col-span-2 text-right">ক্রয় দর (Rate ৳) *</div>
              <div className="col-span-1 text-right">মোট টাকা (৳)</div>
              <div className="col-span-1 text-center">অ্যাকশন</div>
            </div>

            {/* Product Rows */}
            <div className="space-y-3">
              {items.map((row, idx) => {
                const q = parseFloat(row.quantity || '0');
                const p = parseFloat(row.unitPrice || '0');
                const lineTotal = !isNaN(q) && !isNaN(p) && q > 0 && p >= 0 ? q * p : 0;
                const ordQ = row.orderedQty !== undefined ? Number(row.orderedQty) : null;
                const isShort = ordQ !== null && q < ordQ;
                const isExtra = ordQ !== null && q > ordQ;

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 lg:p-3"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                      {/* Product Selector with Interactive Search Dropdown */}
                      <div className="lg:col-span-4 relative">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          পণ্য নির্বাচন (Product)
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={row.searchText ?? row.productName ?? ''}
                            onChange={(e) => handleUpdateRow(idx, 'searchText', e.target.value)}
                            onFocus={() => handleUpdateRow(idx, 'showResults', true)}
                            placeholder="প্রোডাক্ট নাম বা কোড লিখুন..."
                            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>

                        {/* Search Results Dropdown */}
                        {row.showResults && (
                          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-2xl">
                            {companyFilteredProducts
                              .filter((p) => {
                                const term = (row.searchText || '').toLowerCase();
                                if (!term) return true;
                                return (
                                  p.name.toLowerCase().includes(term) ||
                                  p.sku?.toLowerCase().includes(term)
                                );
                              })
                              .slice(0, 15)
                              .map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectProduct(idx, p)}
                                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-all flex items-center justify-between"
                                >
                                  <div>
                                    <p className="font-bold text-slate-900">{p.name}</p>
                                    <p className="text-[10px] text-slate-500">
                                      কোড: {p.sku || 'N/A'} • ইউনিট: {p.unit || 'Pcs'}
                                    </p>
                                  </div>
                                  <span className="font-mono text-xs font-bold text-emerald-600">
                                    ৳{p.buyPrice || '0'}
                                  </span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Order Quantity Display */}
                      <div className="lg:col-span-2 text-center">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          অর্ডার পরিমাণ (Order Qty)
                        </label>
                        {ordQ !== null ? (
                          <div className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">
                            <span>{ordQ}</span>
                            <span className="text-[11px] font-medium">{row.unit || 'টি'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">— (সরাসরি)</span>
                        )}
                      </div>

                      {/* Actually Received Quantity (Stock In Qty) */}
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          প্রকৃত প্রাপ্ত পরিমাণ (Actually Received) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={row.quantity}
                            onChange={(e) => handleUpdateRow(idx, 'quantity', e.target.value)}
                            className={`w-full rounded-xl border px-3 py-2 text-center text-xs font-black text-slate-900 focus:outline-none focus:ring-2 ${
                              isShort
                                ? 'border-amber-400 bg-amber-50 focus:ring-amber-400/20'
                                : isExtra
                                ? 'border-indigo-400 bg-indigo-50 focus:ring-indigo-400/20'
                                : 'border-slate-200 bg-white focus:border-indigo-500 focus:ring-indigo-500/20'
                            }`}
                          />
                        </div>
                        {isShort && (
                          <p className="mt-1 text-[10px] font-bold text-amber-600 text-center">
                            ⚠️ {ordQ - q} টি কম এসেছে
                          </p>
                        )}
                        {isExtra && (
                          <p className="mt-1 text-[10px] font-bold text-indigo-600 text-center">
                            ✨ {q - ordQ} টি বেশি এসেছে
                          </p>
                        )}
                      </div>

                      {/* Buy Rate ৳ */}
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          ক্রয় দর (Rate ৳) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">৳</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={row.unitPrice}
                            onChange={(e) => handleUpdateRow(idx, 'unitPrice', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white pl-6 pr-3 py-2 text-right text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Line Total ৳ */}
                      <div className="lg:col-span-1 text-right">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          মোট টাকা (৳)
                        </label>
                        <span className="text-xs font-black text-slate-900">
                          ৳{lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Delete Action */}
                      <div className="lg:col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ আরও পণ্য যোগ করুন</span>
              </button>

              <div className="text-right">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mr-2">
                  মোট মালের মূল্য:
                </span>
                <span className="text-lg font-black text-indigo-900">
                  {formatCurrency(invoiceTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* 🚚 3. Additional Details & Financial Reconciliation Box */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                <Truck className="h-4 w-4" />
                <span>চালানের বিবরণ ও পরিবহন নোট (Invoice Details & Note)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    সাপ্লায়ার / ড্রাইভার / প্রতিনিধি
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="নাম / পরিবহন রেফারেন্স..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    সমন্বয়কৃত পরিশোধের পরিমাণ (Paid / Adjusted ৳)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  অতিরিক্ত মন্তব্য / চালান নোট
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="চালান সংক্রান্ত প্রয়োজনীয় মন্তব্য লিখুন..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Stock In Checkbox */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="confirmStockIn"
                  checked={confirmStockIn}
                  onChange={(e) => setConfirmStockIn(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="confirmStockIn" className="cursor-pointer text-xs">
                  <p className="font-black text-emerald-900">
                    📦 সরাসরি গোডাউনে স্টক ইন করুন (Auto Stock-In to Warehouse)
                  </p>
                  <p className="text-emerald-700 font-medium mt-0.5">
                    টিক চিহ্ন দেওয়া থাকলে চালান সেভ করার সাথে সাথে প্রাপ্ত প্রতিটি পণ্যের গোডাউন স্টক তাৎক্ষণিক বৃদ্ধি পাবে এবং ক্রয় দর আপডেট হবে।
                  </p>
                </label>
              </div>
            </div>

            {/* 📊 Financial Breakdown Card */}
            <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-white shadow-lg space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                আর্থিক সমন্বয় হিসাব (Financial Settlement Summary)
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">মোট চালানের মূল্য:</span>
                  <span className="font-bold text-white text-base">{formatCurrency(invoiceTotal)}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">সমন্বয়কৃত পরিশোধ / অগ্রিম:</span>
                  <span className="font-bold text-emerald-400 text-base">
                    - {formatCurrency(effectivePaid)}
                  </span>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-sm font-bold text-white">
                    {remainingDue > 0
                      ? 'চালান বাবদ কোম্পানির পাওনা (Due):'
                      : remainingAdvance > 0
                      ? 'কোম্পানির কাছে অবশিষ্ট অগ্রিম (Advance):'
                      : 'ব্যালেন্স স্ট্যাটাস:'}
                  </span>
                  <span
                    className={`text-xl font-black ${
                      remainingDue > 0
                        ? 'text-rose-400'
                        : remainingAdvance > 0
                        ? 'text-sky-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {remainingDue > 0
                      ? formatCurrency(remainingDue)
                      : remainingAdvance > 0
                      ? formatCurrency(remainingAdvance)
                      : 'পরিশোধিত (0.00)'}
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FileCheck className="h-5 w-5" />
                  <span>{isSaving ? 'সংরক্ষণ ও স্টক ইন হচ্ছে...' : 'চালান ও স্টক ইন সাবমিট করুন'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
