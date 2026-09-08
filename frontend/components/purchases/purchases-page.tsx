'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getCompanies } from '@/lib/api/companies';
import { getProducts } from '@/lib/api/products';
import {
  getCompanyWisePayableSummary,
  getPurchases,
  getProductSupplySummary,
  getCompanyPayments,
  recordCompanyPayment,
  confirmPurchase,
  deletePurchase,
  deleteCompanyPayment,
  resetPurchasesDemoData,
} from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { Pagination } from '@/components/ui/pagination';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, formatDateTime, toNumber } from '@/lib/utils/format';
import type {
  Company,
  CompanyWisePayableSummary,
  Product,
  ProductSupplySummary,
  Purchase,
  PurchasePayment,
} from '@/types/api';
import {
  Plus,
  Search,
  Building2,
  Calendar,
  FilterX,
  FileText,
  DollarSign,
  Wallet,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  TrendingDown,
  ArrowUpRight,
  Package,
  Layers,
  CreditCard,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';

const pageSize = 12;

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

export function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<'companies' | 'products' | 'invoices' | 'payments'>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payableSummary, setPayableSummary] = useState<CompanyWisePayableSummary[]>([]);
  const [productSupplies, setProductSupplies] = useState<ProductSupplySummary[]>([]);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState<'all' | 'payable' | 'advance' | 'settled'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCompanyId, setPaymentCompanyId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(formatDateInput(new Date()));
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isProductBreakdownMode, setIsProductBreakdownMode] = useState(false);
  const [productPaymentRows, setProductPaymentRows] = useState<ProductPaymentRow[]>([]);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Expanded Invoice Row state
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  useToastNotification({
    message: toastMessage,
    title: toastTone === 'success' ? 'সফল হয়েছে' : 'ত্রুটি',
    tone: toastTone,
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [compList, prods, purchaseList, summaryList, prodList, payList] = await Promise.all([
        getCompanies().catch(() => []),
        getProducts().catch(() => []),
        getPurchases({
          companyId: selectedCompanyId ?? undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          search: searchTerm.trim() || undefined,
        }).catch(() => []),
        getCompanyWisePayableSummary({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        }).catch(() => []),
        getProductSupplySummary(selectedCompanyId ?? undefined).catch(() => []),
        getCompanyPayments({
          companyId: selectedCompanyId ?? undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        }).catch(() => []),
      ]);

      setCompanies(compList);
      setAllProducts(Array.isArray(prods) ? prods : prods?.data || []);
      setPurchases(purchaseList);
      setPayableSummary(summaryList);
      setProductSupplies(prodList);
      setPayments(payList);
    } catch (err: any) {
      setError(err.message || 'ডেটা লোড করতে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCompanyId, fromDate, toDate, searchTerm]);

  // Overall Aggregate KPI Stats
  const kpiStats = useMemo(() => {
    const totalPurchases = payableSummary.reduce(
      (sum, c) => sum + toNumber(c.totalPurchaseAmount ?? c.totalAmount),
      0,
    );
    const totalPaid = payableSummary.reduce(
      (sum, c) => sum + toNumber(c.totalPaidAmount ?? c.totalPaid),
      0,
    );
    const totalPayable = payableSummary.reduce(
      (sum, c) => sum + toNumber(c.totalPayableAmount ?? c.totalPayable),
      0,
    );
    const totalAdvance = payableSummary.reduce(
      (sum, c) => sum + toNumber(c.advanceAmount ?? c.advanceBalance),
      0,
    );
    const totalInvoices = purchases.length;

    return {
      totalPurchases,
      totalPaid,
      totalPayable,
      totalAdvance,
      totalInvoices,
      totalCompanies: payableSummary.length,
    };
  }, [payableSummary, purchases]);

  // Filtered Company Summaries
  const filteredCompanySummaries = useMemo(() => {
    return payableSummary.filter((c) => {
      if (selectedCompanyId && c.companyId !== selectedCompanyId) return false;
      const payable = toNumber(c.totalPayableAmount ?? c.totalPayable);
      const advance = toNumber(c.advanceAmount ?? c.advanceBalance);

      if (companyStatusFilter === 'payable' && payable <= 0) return false;
      if (companyStatusFilter === 'advance' && advance <= 0) return false;
      if (companyStatusFilter === 'settled' && (payable > 0 || advance > 0)) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          c.companyName?.toLowerCase().includes(term) ||
          c.companyCode?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [payableSummary, selectedCompanyId, searchTerm, companyStatusFilter]);

  // Filtered Product Supplies
  const filteredProductSupplies = useMemo(() => {
    return productSupplies.filter((p) => {
      if (selectedCompanyId && p.companyId !== selectedCompanyId) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          p.productName?.toLowerCase().includes(term) ||
          p.companyName?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [productSupplies, selectedCompanyId, searchTerm]);

  // Filtered Invoices
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (selectedCompanyId && p.companyId !== selectedCompanyId) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          p.invoiceNo?.toLowerCase().includes(term) ||
          p.referenceNo?.toLowerCase().includes(term) ||
          p.supplierName?.toLowerCase().includes(term) ||
          p.company?.name?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [purchases, selectedCompanyId, searchTerm]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((pay) => {
      if (selectedCompanyId && pay.companyId !== selectedCompanyId) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          pay.company?.name?.toLowerCase().includes(term) ||
          pay.transactionRef?.toLowerCase().includes(term) ||
          pay.note?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [payments, selectedCompanyId, searchTerm]);

  // Pagination Helper
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    if (activeTab === 'companies') return filteredCompanySummaries.slice(start, start + pageSize);
    if (activeTab === 'products') return filteredProductSupplies.slice(start, start + pageSize);
    if (activeTab === 'invoices') return filteredPurchases.slice(start, start + pageSize);
    return filteredPayments.slice(start, start + pageSize);
  }, [
    activeTab,
    currentPage,
    filteredCompanySummaries,
    filteredProductSupplies,
    filteredPurchases,
    filteredPayments,
  ]);

  const totalCurrentTabItems = useMemo(() => {
    if (activeTab === 'companies') return filteredCompanySummaries.length;
    if (activeTab === 'products') return filteredProductSupplies.length;
    if (activeTab === 'invoices') return filteredPurchases.length;
    return filteredPayments.length;
  }, [
    activeTab,
    filteredCompanySummaries,
    filteredProductSupplies,
    filteredPurchases,
    filteredPayments,
  ]);

  const openPaymentModal = (companyId?: number) => {
    const cId = companyId || selectedCompanyId || null;
    setPaymentCompanyId(cId);

    // If company selected, auto suggest its payable due
    if (cId) {
      const match = payableSummary.find((s) => s.companyId === cId);
      if (match && toNumber(match.totalPayableAmount ?? match.totalPayable) > 0) {
        setPaymentAmount(String(toNumber(match.totalPayableAmount ?? match.totalPayable)));
      } else {
        setPaymentAmount('');
      }
    } else {
      setPaymentAmount('');
    }

    setPaymentDate(formatDateInput(new Date()));
    setPaymentMethod('CASH');
    setTransactionRef('');
    setPaymentNote('');
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
    // Auto-select this product's company
    const compId = product.companyId || (product as any).company?.id;
    if (compId) {
      setPaymentCompanyId(Number(compId));
    }

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
                p.name?.toLowerCase().trim() === trimmed ||
                p.sku?.toLowerCase().trim() === trimmed ||
                p.name?.toLowerCase().trim().startsWith(trimmed) ||
                (trimmed.length >= 3 && p.name?.toLowerCase().includes(trimmed)),
            );
            if (matched) {
              target.productId = matched.id;
              target.productName = matched.name;
              target.unit = matched.unit || 'Pcs';
              if (matched.buyPrice !== undefined && matched.buyPrice !== null) {
                target.unitPrice = String(toNumber(matched.buyPrice));
              }
              const compId = matched.companyId || (matched as any).company?.id;
              if (compId) {
                setPaymentCompanyId(Number(compId));
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

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCompanyId) {
      setToastTone('error');
      setToastMessage('অনুগ্রহ করে কোম্পানি সিলেক্ট করুন');
      return;
    }
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
      await recordCompanyPayment(paymentCompanyId, {
        amount: amt,
        paymentDate,
        paymentMethod,
        transactionRef: transactionRef.trim() || undefined,
        note: paymentNote.trim() || undefined,
        productBreakdown: validBreakdown.length > 0 ? validBreakdown : undefined,
      });

      setToastTone('success');
      setToastMessage('কোম্পানিকে টাকা পরিশোধের হিসাব সফলভাবে সংরক্ষণ করা হয়েছে!');
      setIsPaymentModalOpen(false);
      await loadData();
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'পেমেন্ট সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleConfirmPurchase = async (id: number) => {
    try {
      setConfirmingId(id);
      await confirmPurchase(id);
      setToastTone('success');
      setToastMessage('চালানটি সফলভাবে নিশ্চিত ও গোডাউনে স্টক ইন করা হয়েছে!');
      await loadData();
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'চালান নিশ্চিত করতে সমস্যা হয়েছে');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDeletePurchase = async (id: number) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই চালানটি মুছে ফেলতে চান?')) return;
    try {
      setIsLoading(true);
      await deletePurchase(id);
      setToastTone('success');
      setToastMessage('চালানটি সফলভাবে মুছে ফেলা হয়েছে');
      await loadData();
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'চালান মুছতে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই পেমেন্ট রেকর্ডটি মুছে ফেলতে চান?')) return;
    try {
      setIsLoading(true);
      await deleteCompanyPayment(paymentId);
      setToastTone('success');
      setToastMessage('পেমেন্ট রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে');
      await loadData();
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'পেমেন্ট মুছতে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetDemoData = async () => {
    const ok = window.confirm('⚠️ সতর্কতা: আপনি কি নিশ্চিত যে সমস্ত টেস্ট/ডেমো চালান ও কোম্পানির পেমেন্ট মুছে সব ব্যালেন্স ০ করতে চান?');
    if (!ok) return;
    try {
      setIsLoading(true);
      await resetPurchasesDemoData();
      setToastTone('success');
      setToastMessage('সমস্ত ডেমো চালান ও পেমেন্ট সফলভাবে মুছে ফেলা হয়েছে! সব কোম্পানির ব্যালেন্স এখন ফ্রেশ ও ০।');
      await loadData();
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'ডেমো ডেটা মুছতে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCompanyObj = companies.find((c) => c.id === paymentCompanyId);
  const selectedCompanySummary = payableSummary.find((s) => s.companyId === paymentCompanyId);

  return (
    <div className="space-y-6 pb-16 text-slate-800">
      {/* 🌟 Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md mb-2">
              <Building2 className="h-3.5 w-3.5" />
              <span>কোম্পানি সাপ্লাইয়ার ও পারচেজ লেজার</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              কোম্পানির মাল ও টাকা পরিশোধের হিসাব
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-2xl">
              কোম্পানি কোন কোন প্রোডাক্ট কত টাকার পাঠিয়েছে এবং কোম্পানিকে কত টাকা কোন পণ্যের জন্য দেওয়া হয়েছে তার পূর্ণাঙ্গ খতিয়ান ও ব্যালেন্স শিট।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => openPaymentModal()}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <Wallet className="h-4 w-4" />
              <span>💸 কোম্পানিকে টাকা দিন</span>
            </button>
            <Link
              href="/purchases/create"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>+ নতুন চালান / স্টক ইন</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 📊 Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              মোট প্রাপ্ত মাল (Goods In)
            </span>
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">
            {formatCurrency(kpiStats.totalPurchases)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            সকল চালান মিলিয়ে মোট মালের মূল্য
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              মোট পরিশোধিত টাকা (Total Paid)
            </span>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600">
            {formatCurrency(kpiStats.totalPaid)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            কোম্পানিগুলোকে এ পর্যন্ত মোট পরিশোধ
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              কোম্পানির পাওনা (Payable)
            </span>
            <div className="rounded-xl bg-rose-100 p-2.5 text-rose-600">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-rose-600">
            {formatCurrency(kpiStats.totalPayable)}
          </p>
          <p className="mt-1 text-xs text-rose-600/80 font-medium">
            কোম্পানি আমাদের কাছে এখনো পাবে
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
              আমাদের অগ্রিম জমা (Advance)
            </span>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-600">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-sky-700">
            {formatCurrency(kpiStats.totalAdvance)}
          </p>
          <p className="mt-1 text-xs text-sky-700/80 font-medium">
            কোম্পানি আমাদের পণ্য/টাকা ফেরত দেবে
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              মোট চালান ও কোম্পানি
            </span>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{kpiStats.totalInvoices}</span>
            <span className="text-xs font-semibold text-slate-500">টি চালান</span>
            <span className="text-slate-300">•</span>
            <span className="text-lg font-bold text-indigo-600">{kpiStats.totalCompanies}</span>
            <span className="text-xs font-semibold text-slate-500">টি কোম্পানি</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            সর্বমোট এন্ট্রি সংখ্যা
          </p>
        </div>
      </div>

      {/* 🔍 Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="সার্চ (কোম্পানি, প্রোডাক্ট, ইনভয়েস)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Company Dropdown */}
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={selectedCompanyId ?? ''}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value ? Number(e.target.value) : null);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              <option value="">🏢 সকল কোম্পানি (All Companies)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* To Date & Clear */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
            {(selectedCompanyId || fromDate || toDate || searchTerm || companyStatusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSelectedCompanyId(null);
                  setFromDate('');
                  setToDate('');
                  setSearchTerm('');
                  setCompanyStatusFilter('all');
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-600 hover:bg-rose-100 transition-colors"
                title="ফিল্টার ক্লিয়ার করুন"
              >
                <FilterX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🧭 Interactive 4 Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => {
            setActiveTab('companies');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'companies'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>🏢 কোম্পানিভিত্তিক খতিয়ান ও বাকি ({filteredCompanySummaries.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('products');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'products'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>📦 কোন প্রোডাক্ট কত টাকার এসেছে ({filteredProductSupplies.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('invoices');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'invoices'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>📑 সকল চালানের তালিকা ({filteredPurchases.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('payments');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'payments'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>💳 কোম্পানিকে দেওয়া টাকার হিসাব ({filteredPayments.length})</span>
        </button>
      </div>

      {isLoading ? (
        <LoadingBlock label="কোম্পানি ও সাপ্লাই ডেটা লোড হচ্ছে..." />
      ) : (
        <>
          {/* TAB 1: 🏢 COMPANY BALANCES & PAYABLES */}
          {activeTab === 'companies' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => { setCompanyStatusFilter('all'); setCurrentPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${companyStatusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  সব কোম্পানি ({payableSummary.length})
                </button>
                <button
                  onClick={() => { setCompanyStatusFilter('payable'); setCurrentPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${companyStatusFilter === 'payable' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'}`}
                >
                  ⚠️ কোম্পানির পাওনা বাকি ({payableSummary.filter((c) => toNumber(c.totalPayableAmount ?? c.totalPayable) > 0).length})
                </button>
                <button
                  onClick={() => { setCompanyStatusFilter('advance'); setCurrentPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${companyStatusFilter === 'advance' ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'}`}
                >
                  💎 আমাদের অগ্রিম জমা ({payableSummary.filter((c) => toNumber(c.advanceAmount ?? c.advanceBalance) > 0).length})
                </button>
                <button
                  onClick={() => { setCompanyStatusFilter('settled'); setCurrentPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${companyStatusFilter === 'settled' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
                >
                  ✅ সম্পূর্ণ পরিশোধ ({payableSummary.filter((c) => toNumber(c.totalPayableAmount ?? c.totalPayable) <= 0 && toNumber(c.advanceAmount ?? c.advanceBalance) <= 0).length})
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(paginatedData as CompanyWisePayableSummary[]).map((c) => {
                  const totalPurchases = toNumber(c.totalPurchaseAmount ?? c.totalAmount);
                  const totalPaid = toNumber(c.totalPaidAmount ?? c.totalPaid);
                  const payable = toNumber(c.totalPayableAmount ?? c.totalPayable);
                  const advance = toNumber(c.advanceAmount ?? c.advanceBalance);
                  const isAdvance = advance > 0;
                  const hasDue = payable > 0;

                  return (
                    <div
                      key={c.companyId}
                      className={`group flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${isAdvance ? 'border-sky-200 hover:border-sky-400' : hasDue ? 'border-rose-200 hover:border-rose-400' : 'border-slate-200 hover:border-emerald-300'}`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {c.companyName}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {c.phone || c.companyCode || 'সাপ্লাইয়ার কোম্পানি'}
                            </p>
                          </div>
                          {isAdvance ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
                              💎 অগ্রিম জমা আছে
                            </span>
                          ) : hasDue ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              ⚠️ পাওনা বাকি আছে
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✅ সম্পূর্ণ পরিশোধ
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                          <div>
                            <span className="text-[11px] font-medium text-slate-500">মোট মাল</span>
                            <p className="text-xs font-bold text-slate-900 mt-0.5">
                              {formatCurrency(totalPurchases)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[11px] font-medium text-emerald-600">পরিশোধ</span>
                            <p className="text-xs font-bold text-emerald-600 mt-0.5">
                              {formatCurrency(totalPaid)}
                            </p>
                          </div>
                          <div>
                            {isAdvance ? (
                              <>
                                <span className="text-[11px] font-bold text-sky-700">আমরা পাব</span>
                                <p className="text-xs font-black text-sky-700 mt-0.5">
                                  {formatCurrency(advance)}
                                </p>
                              </>
                            ) : (
                              <>
                                <span className="text-[11px] font-medium text-rose-600">কোম্পানি পাবে</span>
                                <p className="text-xs font-bold text-rose-600 mt-0.5">
                                  {formatCurrency(payable)}
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        {isAdvance && (
                          <div className="mt-2.5 rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 text-center">
                            কোম্পানি আমাদের <b>{formatCurrency(advance)}</b> টাকার মাল বা টাকা দেবে
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>মোট চালান: <b>{c.purchaseCount} টি</b></span>
                          {c.lastPurchaseDate && (
                            <span>শেষ চালান: {formatDate(c.lastPurchaseDate)}</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                        <button
                          onClick={() => openPaymentModal(c.companyId)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 text-xs font-bold transition-colors"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          <span>টাকা দিন</span>
                        </button>
                        <Link
                          href={`/purchases/companies/${c.companyId}`}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 text-xs font-bold transition-colors"
                        >
                          <span>খতিয়ান দেখুন</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredCompanySummaries.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <StateMessage
                    title="কোন কোম্পানি পাওয়া যায়নি"
                    description="সার্চ ফিল্টারের সাথে মিল রেখে কোনো রেকর্ড পাওয়া যায়নি।"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 📦 PRODUCT-WISE SUPPLIES BREAKDOWN */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-5 py-3.5 text-left">প্রোডাক্টের নাম</th>
                        <th className="px-5 py-3.5 text-left">কোম্পানি</th>
                        <th className="px-5 py-3.5 text-right">মোট প্রাপ্ত সংখ্যা</th>
                        <th className="px-5 py-3.5 text-right">মোট মালের মূল্য (টাকা)</th>
                        <th className="px-5 py-3.5 text-right">গড় ক্রয় রেট</th>
                        <th className="px-5 py-3.5 text-right">বর্তমান স্টক</th>
                        <th className="px-5 py-3.5 text-center">চালান সংখ্যা</th>
                        <th className="px-5 py-3.5 text-center">শেষ আসার তারিখ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(paginatedData as ProductSupplySummary[]).map((p) => (
                        <tr key={p.productId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900">{p.productName}</div>
                            <div className="text-xs text-slate-500">#{p.productId} • ইউনিট: {p.unit}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                              <Building2 className="h-3 w-3" />
                              {p.companyName}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-slate-900">
                            {p.totalQuantityReceived ?? p.totalQuantity} {p.unit}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-indigo-700">
                            {formatCurrency(p.totalCostValue ?? p.totalCost ?? 0)}
                          </td>
                          <td className="px-5 py-3.5 text-right text-slate-600 font-medium">
                            ৳{p.avgUnitCost || p.latestBuyPrice || 0}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                            {p.currentStock || 0} {p.unit}
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

              {filteredProductSupplies.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <StateMessage
                    title="কোন প্রোডাক্টের সাপ্লাই রেকর্ড নেই"
                    description="কোম্পানি থেকে চালানের মাধ্যমে মাল স্টক ইন করলে এখানে প্রোডাক্টভিত্তিক তালিকা দেখতে পাবেন।"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 📑 ALL PURCHASE INVOICES */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {(paginatedData as Purchase[]).map((purchase) => {
                  const isPayable = toNumber(purchase.payableAmount ?? purchase.dueAmount) > 0;
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
                                #{purchase.invoiceNo || purchase.referenceNo || `PUR-${purchase.id}`}
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
                                  isPayable
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isPayable ? `বাকি: ${formatCurrency(purchase.payableAmount ?? purchase.dueAmount)}` : 'পরিশোধিত'}
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              কোম্পানি: <b className="text-slate-800">{purchase.company?.name || 'Unknown'}</b> • তারিখ:{' '}
                              {formatDate(purchase.purchaseDate)}
                              {purchase.supplierName ? ` • সরবরাহকারী: ${purchase.supplierName}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 lg:justify-end">
                          <div className="text-left lg:text-right">
                            <span className="text-xs text-slate-500 font-medium">মোট চালানের মূল্য</span>
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
                                onClick={() => {
                                  setPaymentCompanyId(purchase.companyId);
                                  setPaymentAmount(String(toNumber(purchase.payableAmount ?? purchase.dueAmount)));
                                  setPaymentNote(`Payment for Invoice #${purchase.invoiceNo}`);
                                  setIsPaymentModalOpen(true);
                                }}
                                className="rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3.5 py-2 text-xs font-bold transition-all"
                              >
                                টাকা দিন
                              </button>
                            )}

                            <Link
                              href={`/purchases/companies/${purchase.companyId}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 p-2 text-xs font-bold transition-colors"
                              title="কোম্পানি লেজার দেখুন"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>

                            <button
                              onClick={() => handleDeletePurchase(purchase.id)}
                              className="rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 text-xs font-bold transition-colors"
                              title="চালানটি মুছুন"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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
                                {(purchase.items || []).map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="px-4 py-2 font-medium text-slate-900">
                                      {item.product?.name || item.productName || `Product #${item.productId}`}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-800">
                                      {item.quantity} {item.unit || item.product?.unit || 'Pcs'}
                                    </td>
                                    <td className="px-4 py-2 text-right text-slate-600">
                                      {formatCurrency(item.unitCost ?? item.unitPrice)}
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
                            <p className="mt-2 text-xs text-slate-500 italic">
                              নোট: {purchase.note}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredPurchases.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <StateMessage
                    title="কোন চালান পাওয়া যায়নি"
                    description="নতুন মাল পৌঁছালে উপরের '+ নতুন চালান' বাটনে ক্লিক করে এন্ট্রি দিন।"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 4: 💳 PAYMENT HISTORY */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-5 py-3.5 text-left">পরিশোধের তারিখ</th>
                        <th className="px-5 py-3.5 text-left">কোম্পানির নাম</th>
                        <th className="px-5 py-3.5 text-right">পরিশোধিত টাকা</th>
                        <th className="px-5 py-3.5 text-center">মেথড</th>
                        <th className="px-5 py-3.5 text-left">রেফারেন্স / স্লিপ</th>
                        <th className="px-5 py-3.5 text-left">নোট / পণ্যের বিবরণ</th>
                        <th className="px-5 py-3.5 text-center">এন্ট্রি কারী</th>
                        <th className="px-5 py-3.5 text-center">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(paginatedData as PurchasePayment[]).map((pay) => (
                        <tr key={pay.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-slate-900">
                            {formatDate(pay.paymentDate)}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900">
                              {pay.company?.name || `Company #${pay.companyId}`}
                            </div>
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
                            <button
                              onClick={() => handleDeletePayment(pay.id)}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                              title="পেমেন্ট হিস্ট্রি মুছুন"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredPayments.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <StateMessage
                    title="কোন পেমেন্টের হিসাব নেই"
                    description="কোম্পানিকে টাকা দেওয়ার পর 'কোম্পানিকে টাকা দিন' বাটনে চাপ দিয়ে হিসাব সেভ করুন।"
                  />
                </div>
              )}
            </div>
          )}

          {/* 📄 Pagination */}
          {totalCurrentTabItems > pageSize && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalItems={totalCurrentTabItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
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
                  <h3 className="text-lg font-bold text-slate-900">কোম্পানিকে টাকা পরিশোধ</h3>
                  <p className="text-xs text-slate-500">সাধারণ বা একাধিক প্রোডাক্টের জন্য টাকা পরিশোধের হিসাব সংরক্ষণ করুন</p>
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
              {/* Company Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  কোম্পানি সিলেক্ট করুন *
                </label>
                <select
                  value={paymentCompanyId ?? ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setPaymentCompanyId(id);
                    const match = payableSummary.find((s) => s.companyId === id);
                    if (match && toNumber(match.totalPayableAmount ?? match.totalPayable) > 0) {
                      setPaymentAmount(String(toNumber(match.totalPayableAmount ?? match.totalPayable)));
                    }
                  }}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold focus:border-indigo-500 focus:bg-white focus:outline-none"
                >
                  <option value="">-- কোম্পানি সিলেক্ট করুন --</option>
                  {companies.map((c) => {
                    const match = payableSummary.find((s) => s.companyId === c.id);
                    const due = toNumber(match?.totalPayableAmount ?? match?.totalPayable);
                    const adv = toNumber(match?.advanceAmount ?? match?.advanceBalance);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {adv > 0 ? `(💎 অগ্রিম জমা: ৳${adv})` : due > 0 ? `(⚠️ বাকি: ৳${due})` : '(বাকি নেই)'}
                      </option>
                    );
                  })}
                </select>
                {(() => {
                  const compSummary = payableSummary.find((s) => s.companyId === paymentCompanyId);
                  if (!compSummary) return null;
                  const due = toNumber(compSummary.totalPayableAmount ?? compSummary.totalPayable);
                  const adv = toNumber(compSummary.advanceAmount ?? compSummary.advanceBalance);
                  return (
                    <div className="mt-2 flex items-center gap-3 text-xs font-semibold">
                      {due > 0 ? (
                        <span className="text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                          ⚠️ বর্তমান বকেয়া পাওনা: {formatCurrency(due)}
                        </span>
                      ) : adv > 0 ? (
                        <span className="text-sky-700 font-bold bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">
                          💎 আমাদের অগ্রিম জমা: {formatCurrency(adv)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                          ✅ কোনো বাকি বা অগ্রিম নেই
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

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
                                if (!query) return true;
                                const matchName = p.name?.toLowerCase().includes(query);
                                const matchSku = p.sku?.toLowerCase().includes(query);
                                const comp = companies.find((c) => c.id === p.companyId);
                                const matchComp = comp?.name?.toLowerCase().includes(query);
                                return matchName || matchSku || matchComp;
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-3 text-center text-xs text-slate-400 font-medium">
                                    কোনো প্রোডাক্ট খুঁজে পাওয়া যায়নি
                                  </div>
                                );
                              }

                              return filtered.map((p) => {
                                const comp = companies.find((c) => c.id === p.companyId);
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
                                        {comp && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-[10px]">
                                            🏢 {comp.name}
                                          </span>
                                        )}
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
                    মোট পরিশোধের পরিমাণ (টাকা) *
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
                  placeholder="যেমন: সানলাইট কয়েল ও অন্যান্য পণ্য বাবদ চেক পরিশোধ..."
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
