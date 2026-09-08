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
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, formatDateTime, formatNumber, toNumber } from '@/lib/utils/format';
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
  CheckCircle2,
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
  User,
  Printer,
  Eye,
  CheckCircle,
  Phone,
  MapPin,
  Landmark,
  ArrowRight,
  Clock,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

const pageSize = 12;

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type PreOrderProductRow = {
  productId: number | '';
  productName: string;
  sku: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  note?: string;
  searchText?: string;
  showResults?: boolean;
};

export function PurchasesPage() {
  // Main Navigation Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'preorders' | 'challans' | 'partial' | 'completed' | 'companies' | 'products'>('all');
  
  // Data Sources
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payableSummary, setPayableSummary] = useState<CompanyWisePayableSummary[]>([]);
  const [productSupplies, setProductSupplies] = useState<ProductSupplySummary[]>([]);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);

  // Search & Filters
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Loading & Notifications
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  // Expanded Invoices & Actions
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  // -------------------------------------------------------------
  // 🏦 BUTTON 1: BANK DRAFT / ADVANCE PAYMENT MODAL STATE
  // -------------------------------------------------------------
  const [isBankDraftModalOpen, setIsBankDraftModalOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Company | null>(null);

  // Section B: Payment Info
  const [paymentMethod, setPaymentMethod] = useState<'BANK' | 'CHEQUE' | 'TRANSFER' | 'CASH'>('BANK');
  const [draftRefNo, setDraftRefNo] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [draftDate, setDraftDate] = useState(formatDateInput(new Date()));
  const [draftAmount, setDraftAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // Section C: Pre-Order Products
  const [preOrderItems, setPreOrderItems] = useState<PreOrderProductRow[]>([]);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);

  // Post-Save Success Dialog State
  const [savedDraftResult, setSavedDraftResult] = useState<{
    id: number;
    draftNo: string;
    supplierName: string;
    amount: number;
    productCount: number;
  } | null>(null);

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

  // Overall Financial KPI Metrics
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
    const totalPreOrders = payments.filter((p) => p.productBreakdown && Array.isArray(p.productBreakdown) && p.productBreakdown.length > 0).length;

    return {
      totalPurchases,
      totalPaid,
      totalPayable,
      totalAdvance,
      totalInvoices,
      totalPreOrders,
      totalCompanies: payableSummary.length,
    };
  }, [payableSummary, purchases, payments]);

  // -------------------------------------------------------------
  // 🔍 MODAL LOGIC: BANK DRAFT & PRE-ORDER
  // -------------------------------------------------------------
  const openBankDraftModal = (company?: Company) => {
    if (company) {
      setSelectedSupplier(company);
      setSupplierSearch(company.name);
    } else if (selectedCompanyId) {
      const match = companies.find((c) => c.id === selectedCompanyId);
      if (match) {
        setSelectedSupplier(match);
        setSupplierSearch(match.name);
      } else {
        setSelectedSupplier(null);
        setSupplierSearch('');
      }
    } else {
      setSelectedSupplier(null);
      setSupplierSearch('');
    }

    setPaymentMethod('BANK');
    setDraftRefNo('');
    setBankName('Sonali Bank');
    setBranchName('');
    setDraftDate(formatDateInput(new Date()));
    setDraftAmount('');
    setPaymentNote('');
    setPreOrderItems([
      {
        productId: '',
        productName: '',
        sku: '',
        unit: 'Pcs',
        quantity: '1',
        unitPrice: '',
        amount: '',
        note: '',
        searchText: '',
        showResults: false,
      },
    ]);
    setShowSupplierDropdown(false);
    setSavedDraftResult(null);
    setIsBankDraftModalOpen(true);
  };

  const handleSelectSupplier = (comp: Company) => {
    setSelectedSupplier(comp);
    setSupplierSearch(comp.name);
    setShowSupplierDropdown(false);
  };

  const handleAddPreOrderRow = () => {
    setPreOrderItems((prev) => [
      ...prev,
      {
        productId: '',
        productName: '',
        sku: '',
        unit: 'Pcs',
        quantity: '1',
        unitPrice: '',
        amount: '',
        note: '',
        searchText: '',
        showResults: false,
      },
    ]);
  };

  const handleRemovePreOrderRow = (index: number) => {
    setPreOrderItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      recalculateDraftAmount(updated);
      return updated;
    });
  };

  const handleSelectPreOrderProduct = (index: number, product: Product) => {
    // If no supplier selected yet, auto-select product's supplier
    if (!selectedSupplier && product.companyId) {
      const comp = companies.find((c) => c.id === product.companyId);
      if (comp) {
        setSelectedSupplier(comp);
        setSupplierSearch(comp.name);
      }
    }

    setPreOrderItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };
      target.productId = product.id;
      target.productName = product.name;
      target.sku = product.sku || '';
      target.unit = product.unit || 'Pcs';
      target.searchText = product.name;
      target.showResults = false;
      target.unitPrice =
        product.buyPrice !== undefined && product.buyPrice !== null
          ? String(toNumber(product.buyPrice))
          : target.unitPrice || '';

      if (!target.quantity || target.quantity === '0') {
        target.quantity = '1';
      }

      const q = parseFloat(target.quantity || '0');
      const p = parseFloat(target.unitPrice || '0');
      if (!isNaN(q) && !isNaN(p) && q > 0 && p >= 0) {
        const total = q * p;
        target.amount = total % 1 === 0 ? total.toString() : total.toFixed(2);
      }

      updated[index] = target;
      recalculateDraftAmount(updated);
      return updated;
    });
  };

  const handleUpdatePreOrderRow = (
    index: number,
    field: keyof PreOrderProductRow,
    value: any,
  ) => {
    setPreOrderItems((prev) => {
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
                p.name?.toLowerCase().trim().startsWith(trimmed),
            );
            if (matched) {
              target.productId = matched.id;
              target.productName = matched.name;
              target.sku = matched.sku || '';
              target.unit = matched.unit || 'Pcs';
              if (matched.buyPrice !== undefined && matched.buyPrice !== null) {
                target.unitPrice = String(toNumber(matched.buyPrice));
              }
              const q = parseFloat(target.quantity || '1');
              const p = parseFloat(target.unitPrice || '0');
              if (!isNaN(q) && !isNaN(p) && q > 0 && p >= 0) {
                const total = q * p;
                target.amount = total % 1 === 0 ? total.toString() : total.toFixed(2);
              }
            }
          }
        }
      } else if (field === 'quantity' || field === 'unitPrice') {
        const q = parseFloat(field === 'quantity' ? value : target.quantity || '0');
        const p = parseFloat(field === 'unitPrice' ? value : target.unitPrice || '0');
        if (!isNaN(q) && !isNaN(p) && q > 0 && p >= 0) {
          const total = q * p;
          target.amount = total % 1 === 0 ? total.toString() : total.toFixed(2);
        } else {
          target.amount = '';
        }
      }

      updated[index] = target;
      recalculateDraftAmount(updated);
      return updated;
    });
  };

  const recalculateDraftAmount = (rows: PreOrderProductRow[]) => {
    const totalVal = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
    if (totalVal > 0) {
      setDraftAmount(totalVal % 1 === 0 ? totalVal.toString() : totalVal.toFixed(2));
    }
  };

  // Section C/D Totals
  const preOrderTotalAmount = useMemo(() => {
    return preOrderItems.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  }, [preOrderItems]);

  const preOrderTotalQuantity = useMemo(() => {
    return preOrderItems.reduce((sum, row) => sum + (parseFloat(row.quantity || '0') || 0), 0);
  }, [preOrderItems]);

  const effectiveDraftAmountNum = parseFloat(draftAmount || '0') || 0;
  const draftAdvanceBalance = Math.max(0, effectiveDraftAmountNum);

  // Submit Bank Draft / Pre-Order
  const handleSubmitBankDraft = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplier) {
      setToastTone('error');
      setToastMessage('অনুগ্রহ করে সরবরাহকারী / কোম্পানি নির্বাচন করুন');
      return;
    }

    const amt = parseFloat(draftAmount);
    if (isNaN(amt) || amt <= 0) {
      setToastTone('error');
      setToastMessage('সঠিক পরিশোধের টাকা লিখুন (১ বা তার বেশি)');
      return;
    }

    const validBreakdown = preOrderItems
      .filter((row) => (row.productId || row.productName || row.searchText) && parseFloat(row.quantity || '0') > 0)
      .map((row) => {
        const q = parseFloat(row.quantity || '1');
        const p = parseFloat(row.unitPrice || '0');
        const calculatedAmt = !isNaN(q) && !isNaN(p) && q > 0 && p >= 0 ? q * p : parseFloat(row.amount || '0') || 0;

        return {
          productId: row.productId ? Number(row.productId) : undefined,
          productName: row.productName || row.searchText || 'পণ্য',
          sku: row.sku || undefined,
          unit: row.unit || 'Pcs',
          quantity: q,
          unitPrice: p,
          amount: calculatedAmt,
          note: row.note?.trim() || undefined,
        };
      });

    if (validBreakdown.length === 0) {
      setToastTone('error');
      setToastMessage('প্রি-অর্ডারের জন্য কমপক্ষে ১টি পণ্য এবং সঠিক কোয়ান্টিটি যোগ করুন');
      return;
    }

    try {
      setIsSubmittingDraft(true);
      const res = await recordCompanyPayment(selectedSupplier.id, {
        amount: amt,
        paymentDate: draftDate,
        paymentMethod,
        bankName: paymentMethod === 'BANK' ? bankName.trim() : undefined,
        branchName: paymentMethod === 'BANK' ? branchName.trim() : undefined,
        transactionRef: draftRefNo.trim() || undefined,
        note: paymentNote.trim() || undefined,
        productBreakdown: validBreakdown,
      });

      setSavedDraftResult({
        id: res.id,
        draftNo: draftRefNo.trim() || `BD-${res.id}`,
        supplierName: selectedSupplier.name,
        amount: amt,
        productCount: validBreakdown.length,
      });

      setToastTone('success');
      setToastMessage('✅ ব্যাংক ড্রাফট ও প্রি-অর্ডার সফলভাবে সংরক্ষণ করা হয়েছে!');
      await loadData();
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'ব্যাংক ড্রাফট সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  // -------------------------------------------------------------
  // 📋 TAB DATA FILTERING
  // -------------------------------------------------------------
  const filteredPurchasesList = useMemo(() => {
    return purchases.filter((p) => {
      if (selectedCompanyId && p.companyId !== selectedCompanyId) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchInv = p.invoiceNo?.toLowerCase().includes(term);
        const matchRef = p.referenceNo?.toLowerCase().includes(term);
        const matchSup = p.supplierName?.toLowerCase().includes(term);
        const matchComp = p.company?.name?.toLowerCase().includes(term);
        if (!matchInv && !matchRef && !matchSup && !matchComp) return false;
      }

      const totalVal = toNumber(p.totalAmount);
      const paidVal = toNumber(p.paidAmount);

      if (activeTab === 'partial') {
        // Partially received or has due/advance difference
        return paidVal > totalVal || (paidVal > 0 && totalVal > paidVal);
      }
      if (activeTab === 'completed') {
        // Fully received and settled
        return p.status === 'CONFIRMED' || (totalVal > 0 && Math.abs(totalVal - paidVal) < 0.01);
      }
      return true;
    });
  }, [purchases, selectedCompanyId, searchTerm, activeTab]);

  const filteredPreOrdersList = useMemo(() => {
    return payments.filter((pay) => {
      if (selectedCompanyId && pay.companyId !== selectedCompanyId) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchComp = pay.company?.name?.toLowerCase().includes(term);
        const matchRef = pay.transactionRef?.toLowerCase().includes(term);
        const matchNote = pay.note?.toLowerCase().includes(term);
        if (!matchComp && !matchRef && !matchNote) return false;
      }
      return true;
    });
  }, [payments, selectedCompanyId, searchTerm]);

  // Delete Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'purchase' | 'payment';
    id: number;
    title: string;
    description: string;
    details: Array<{ label: string; value: React.ReactNode }>;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Trigger Delete Purchase Modal
  const promptDeletePurchase = (p: Purchase) => {
    setDeleteModal({
      isOpen: true,
      type: 'purchase',
      id: p.id,
      title: 'চালানটি কি নিশ্চিতভাবে মুছে ফেলতে চান?',
      description: 'এই চালানটি মুছে ফেললে সিস্টেমের ক্রয় তালিকা ও স্টক খতিয়ান থেকে এটি স্থায়ীভাবে সরানো হবে।',
      details: [
        { label: 'চালান নং / আইডি', value: `#${p.invoiceNo || p.referenceNo || p.id}` },
        { label: 'কোম্পানি / সরবরাহকারী', value: p.company?.name || p.supplierName || 'N/A' },
        { label: 'চালানের তারিখ', value: formatDate(p.purchaseDate) },
        { label: 'মোট মূল্য', value: formatCurrency(p.totalAmount) },
      ],
    });
  };

  // Trigger Delete Payment Modal
  const promptDeletePayment = (pay: PurchasePayment) => {
    setDeleteModal({
      isOpen: true,
      type: 'payment',
      id: pay.id,
      title: 'অগ্রিম পেমেন্ট / ড্রাফট রেকর্ড মুছে ফেলতে চান?',
      description: 'এই ব্যাংক ড্রাফট বা অগ্রিম পেমেন্টের রেকর্ডটি স্থায়ীভাবে মুছে ফেলা হবে।',
      details: [
        { label: 'ড্রাফট / ট্রানজেকশন নং', value: pay.transactionRef || `BD-${pay.id}` },
        { label: 'কোম্পানি', value: pay.company?.name || 'N/A' },
        { label: 'তারিখ', value: formatDate(pay.paymentDate) },
        { label: 'পেমেন্ট পরিমাণ', value: formatCurrency(pay.amount) },
      ],
    });
  };

  // Execute Deletion
  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    try {
      setIsDeleting(true);
      if (deleteModal.type === 'purchase') {
        await deletePurchase(deleteModal.id);
        setToastTone('success');
        setToastMessage('চালানটি সফলভাবে মুছে ফেলা হয়েছে');
      } else {
        await deleteCompanyPayment(deleteModal.id);
        setToastTone('success');
        setToastMessage('ড্রাফট রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে');
      }
      setDeleteModal(null);
      await loadData();
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'রেকর্ড মুছতে সমস্যা হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 text-slate-800">
      {/* ============================================================== */}
      {/* 2. PURCHASE PAGE HEADER                                         */}
      {/* ============================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md">
              <Building2 className="h-3.5 w-3.5" />
              <span>ক্রয় ও সাপ্লায়ার রিকনসিলিয়েশন সিস্টেম</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                <span>ক্রয় ব্যবস্থাপনা</span>
                <span className="text-lg sm:text-xl font-normal text-indigo-300 font-sans tracking-normal">(Purchase Management)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed font-medium">
                অগ্রিম পেমেন্ট, প্রি-অর্ডার, চালান গ্রহণ এবং স্টক ইন ব্যবস্থাপনা
              </p>
            </div>

            {/* Quick Metrics Badges */}
            <div className="flex items-center gap-2.5 pt-2 flex-wrap text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-slate-200 backdrop-blur-md border border-white/10">
                <FileText className="h-3.5 w-3.5 text-amber-400" />
                <span>মোট চালান: <b className="text-white">{kpiStats.totalInvoices} টি</b></span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-slate-200 backdrop-blur-md border border-white/10">
                <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                <span>প্রি-অর্ডার ড্রাফট: <b className="text-white">{kpiStats.totalPreOrders} টি</b></span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-slate-200 backdrop-blur-md border border-white/10">
                <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>কোম্পানি: <b className="text-white">{kpiStats.totalCompanies} টি</b></span>
              </span>
            </div>
          </div>

          {/* TWO PRIMARY ACTION BUTTONS (Distinct Visual Hierarchy) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Button 1: Money Goes to Supplier */}
            <button
              onClick={() => openBankDraftModal()}
              className="group relative inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-6 py-4 text-xs sm:text-sm font-black text-white shadow-xl shadow-emerald-950/40 transition-all hover:scale-[1.02] active:scale-95 border border-emerald-400/30"
            >
              <div className="rounded-xl bg-white/20 p-1.5">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-black text-white leading-tight">🏦 ব্যাংক ড্রাফট / টাকা পরিশোধ</div>
                <div className="text-[11px] font-semibold text-emerald-100">অগ্রিম অর্ডার ও পণ্যের বুকিং</div>
              </div>
            </button>

            {/* Button 2: Goods Come from Supplier */}
            <Link
              href="/purchases/create"
              className="group relative inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 px-6 py-4 text-xs sm:text-sm font-black text-white shadow-xl shadow-indigo-950/40 transition-all hover:scale-[1.02] active:scale-95 border border-indigo-400/30"
            >
              <div className="rounded-xl bg-white/20 p-1.5">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-black text-white leading-tight">📦 চালান ইন ও স্টক ইন</div>
                <div className="text-[11px] font-semibold text-indigo-100">ড্রাফট মিলিয়ে মাল গোডাউনে এন্ট্রি</div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📊 4 TOP FINANCIAL KPI CARDS                                   */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Goods Received */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              মোট প্রাপ্ত মাল (Goods Received)
            </span>
            <div className="rounded-2xl bg-indigo-50 p-2.5 text-indigo-600 shrink-0">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">
            {formatCurrency(kpiStats.totalPurchases)}
          </p>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            সকল চালান মিলিয়ে মোট ইনওয়ার্ড মালের মূল্য
          </p>
        </div>

        {/* Card 2: Total Advance / Paid */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              মোট পরিশোধিত ড্রাফট (Total Paid)
            </span>
            <div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-600 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600">
            {formatCurrency(kpiStats.totalPaid)}
          </p>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            কোম্পানিগুলোকে দেওয়া ব্যাংক ড্রাফট ও ক্যাশ
          </p>
        </div>

        {/* Card 3: Our Advance Balance */}
        <div className="rounded-3xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
              কোম্পানিতে আমাদের অগ্রিম (Advance)
            </span>
            <div className="rounded-2xl bg-sky-100 p-2.5 text-sky-600 shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-sky-700">
            {formatCurrency(kpiStats.totalAdvance)}
          </p>
          <p className="mt-1 text-xs text-sky-700/80 font-medium">
            কোম্পানি এই মূল্যের মাল বা টাকা ফেরত দেবে
          </p>
        </div>

        {/* Card 4: Supplier Payable */}
        <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              কোম্পানির বাকি পাওনা (Payable)
            </span>
            <div className="rounded-2xl bg-rose-100 p-2.5 text-rose-600 shrink-0">
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
      </div>

      {/* ============================================================== */}
      {/* 🔍 SEARCH & FILTERS BAR                                         */}
      {/* ============================================================== */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="সার্চ (কোম্পানি, ড্রাফট নং, চালান নং, পণ্য)..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs sm:text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
            />
          </div>

          {/* Supplier Dropdown */}
          <div className="sm:col-span-1 lg:col-span-4 relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={selectedCompanyId ?? ''}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value ? Number(e.target.value) : null);
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs sm:text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none transition-all truncate"
            >
              <option value="">🏢 সকল সরবরাহকারী / কোম্পানি</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="sm:col-span-1 lg:col-span-4 flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs sm:text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
              title="শুরুর তারিখ"
            />
            <span className="text-slate-400 text-xs font-bold">হতে</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs sm:text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
              title="শেষ তারিখ"
            />
            {(selectedCompanyId || fromDate || toDate || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedCompanyId(null);
                  setFromDate('');
                  setToDate('');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-rose-600 hover:bg-rose-100 transition-colors shrink-0"
                title="ফিল্টার ক্লিয়ার করুন"
              >
                <FilterX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 15. FILTER TABS (EXACT MATCH FOR USER PROMPT)                   */}
      {/* ============================================================== */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => {
            setActiveTab('all');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>সব (All)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('preorders');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'preorders'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wallet className="h-4 w-4 text-emerald-500" />
          <span>🏦 অগ্রিম অর্ডার ({filteredPreOrdersList.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('challans');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'challans'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="h-4 w-4 text-indigo-500" />
          <span>📦 চালান ({filteredPurchasesList.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('partial');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'partial'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
          <span>🟡 আংশিক প্রাপ্ত</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('completed');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'completed'
              ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
          <span>🟢 সম্পূর্ণ প্রাপ্ত</span>
        </button>

        <div className="h-6 w-px bg-slate-300 mx-1 shrink-0"></div>

        <button
          onClick={() => {
            setActiveTab('companies');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'companies'
              ? 'bg-slate-800 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="h-4 w-4 text-slate-500" />
          <span>🏢 কোম্পানি লেজার</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('products');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'products'
              ? 'bg-slate-800 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="h-4 w-4 text-slate-500" />
          <span>📊 পণ্যভিত্তিক সরবরাহ</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* 📑 MAIN DATA TABLES (EXACT REQUIREMENTS)                       */}
      {/* ============================================================== */}
      {isLoading ? (
        <LoadingBlock
          label="ক্রয় ও চালানের তথ্য লোড হচ্ছে..."
          subLabel="অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন, সকল খতিয়ান ও স্টক রিকনসিলিয়েশন প্রস্তুত হচ্ছে..."
        />
      ) : (
        <>
          {/* TAB 1: ALL / CHALLANS / PARTIAL / COMPLETED PURCHASES TABLE */}
          {(activeTab === 'all' || activeTab === 'challans' || activeTab === 'partial' || activeTab === 'completed') && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
                    <thead className="bg-slate-50/80 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3.5 px-4 text-left">তারিখ (Date)</th>
                        <th className="py-3.5 px-4 text-left">সরবরাহকারী (Supplier)</th>
                        <th className="py-3.5 px-4 text-left">ড্রাফট / চালান নং</th>
                        <th className="py-3.5 px-4 text-right">অর্ডার মূল্য (Order Value)</th>
                        <th className="py-3.5 px-4 text-right">প্রাপ্ত মূল্য (Received Value)</th>
                        <th className="py-3.5 px-4 text-right">অবশিষ্ট অগ্রিম (Advance Remaining)</th>
                        <th className="py-3.5 px-4 text-center">স্ট্যাটাস (Status)</th>
                        <th className="py-3.5 px-4 text-center">অ্যাকশন (Actions)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredPurchasesList.map((p) => {
                        const totalReceived = toNumber(p.totalAmount);
                        const totalPaid = toNumber(p.paidAmount);
                        const advanceRemaining = Math.max(0, totalPaid - totalReceived);
                        const dueRemaining = Math.max(0, totalReceived - totalPaid);
                        const isConfirmed = p.status === 'CONFIRMED';
                        const isFullyReceived = Math.abs(totalReceived - totalPaid) < 0.01 && totalReceived > 0;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Date */}
                            <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                              {formatDate(p.purchaseDate)}
                              <div className="text-[10px] text-slate-400 font-normal">
                                {formatDateTime(p.createdAt)}
                              </div>
                            </td>

                            {/* Supplier */}
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">
                                {p.company?.name || p.supplierName || 'কোম্পানি'}
                              </div>
                              {p.company?.phone && (
                                <div className="text-[11px] text-slate-400">
                                  📞 {p.company.phone}
                                </div>
                              )}
                            </td>

                            {/* Draft / Challan No */}
                            <td className="py-3.5 px-4">
                              <span className="font-mono font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md">
                                #{p.invoiceNo || p.referenceNo || p.id}
                              </span>
                              {p.supplierInvoiceNo && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  ইনভয়েস: {p.supplierInvoiceNo}
                                </div>
                              )}
                            </td>

                            {/* Order Value */}
                            <td className="py-3.5 px-4 text-right font-bold text-slate-700 whitespace-nowrap">
                              {formatCurrency(totalPaid > 0 ? totalPaid : totalReceived)}
                            </td>

                            {/* Received Value */}
                            <td className="py-3.5 px-4 text-right font-black text-indigo-950 whitespace-nowrap">
                              {formatCurrency(totalReceived)}
                            </td>

                            {/* Advance Remaining */}
                            <td className="py-3.5 px-4 text-right font-black whitespace-nowrap">
                              {advanceRemaining > 0 ? (
                                <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
                                  {formatCurrency(advanceRemaining)}
                                </span>
                              ) : dueRemaining > 0 ? (
                                <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                                  বাকি: {formatCurrency(dueRemaining)}
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-bold">৳০.০০</span>
                              )}
                            </td>

                            {/* Receiving Status */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {isFullyReceived || (isConfirmed && advanceRemaining === 0) ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                  <span>🟢 সম্পূর্ণ প্রাপ্ত</span>
                                </span>
                              ) : advanceRemaining > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                  <span>🟡 আংশিক প্রাপ্ত</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                                  <span>স্টক ইন সম্পন্ন</span>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <Link
                                  href={`/purchases/${p.id}`}
                                  className="inline-flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition-colors"
                                  title="চালানের বিবরণ দেখুন"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>👁️ দেখুন</span>
                                </Link>

                                <Link
                                  href={`/purchases/${p.id}/print-challan`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:scale-105"
                                  title="A4 চালান ভাউচার প্রিন্ট করুন"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  <span>🖨️ প্রিন্ট</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => promptDeletePurchase(p)}
                                  className="rounded-xl p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                  title="চালান মুছুন"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredPurchasesList.length === 0 && (
                  <div className="p-12 text-center">
                    <StateMessage
                      title="কোন চালান পাওয়া যায়নি"
                      description="উপরে '📦 চালান ইন ও স্টক ইন' বাটনে ক্লিক করে নতুন চালান যুক্ত করুন।"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: 🏦 PRE-ORDERS / BANK DRAFTS LIST */}
          {activeTab === 'preorders' && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
                    <thead className="bg-slate-50/80 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3.5 px-4 text-left">তারিখ (Date)</th>
                        <th className="py-3.5 px-4 text-left">কোম্পানি / সরবরাহকারী</th>
                        <th className="py-3.5 px-4 text-left">ড্রাফট নং ও মেথড</th>
                        <th className="py-3.5 px-4 text-left">ব্যাংক ও শাখা</th>
                        <th className="py-3.5 px-4 text-center">প্রি-অর্ডার পণ্য সংখ্যা</th>
                        <th className="py-3.5 px-4 text-right">পরিশোধিত টাকা (৳)</th>
                        <th className="py-3.5 px-4 text-center">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredPreOrdersList.map((pay) => {
                        const breakdown = Array.isArray(pay.productBreakdown)
                          ? pay.productBreakdown
                          : typeof pay.productBreakdown === 'string'
                          ? JSON.parse(pay.productBreakdown || '[]')
                          : [];

                        return (
                          <tr key={pay.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                              {formatDate(pay.paymentDate)}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{pay.company?.name || 'কোম্পানি'}</div>
                              {pay.company?.phone && (
                                <div className="text-[11px] text-slate-400">📞 {pay.company.phone}</div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-mono font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md">
                                {pay.transactionRef || `BD-${pay.id}`}
                              </span>
                              <div className="text-[10px] text-slate-500 mt-0.5 uppercase font-semibold">
                                {pay.paymentMethod || 'BANK DRAFT'}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-800">
                                {pay.bankName || 'সোনালী ব্যাংক / সাধারণ'}
                              </div>
                              {pay.branchName && (
                                <div className="text-[11px] text-slate-500">শাখা: {pay.branchName}</div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                                <Package className="h-3 w-3" />
                                <span>{breakdown.length > 0 ? `${breakdown.length} টি পণ্য` : 'জেনারেল ড্রাফট'}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-emerald-600 text-sm whitespace-nowrap">
                              {formatCurrency(pay.amount)}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                <Link
                                  href={`/purchases/create?paymentId=${pay.id}&companyId=${pay.companyId}`}
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:scale-105"
                                >
                                  <Package className="h-3.5 w-3.5" />
                                  <span>📦 চালান ইন করুন</span>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => promptDeletePayment(pay)}
                                  className="rounded-xl p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                  title="ড্রাফট মুছুন"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredPreOrdersList.length === 0 && (
                  <div className="p-12 text-center">
                    <StateMessage
                      title="কোন অগ্রিম ব্যাংক ড্রাফট বা প্রি-অর্ডার পাওয়া যায়নি"
                      description="উপরে '🏦 ব্যাংক ড্রাফট / টাকা পরিশোধ' বাটনে ক্লিক করে নতুন ড্রাফট তৈরি করুন।"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: 🏢 COMPANY LEDGER & PAYABLE SUMMARY */}
          {activeTab === 'companies' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {payableSummary.map((c) => {
                const payable = toNumber(c.totalPayableAmount ?? c.totalPayable);
                const advance = toNumber(c.advanceAmount ?? c.advanceBalance);
                const totalGoods = toNumber(c.totalPurchaseAmount ?? c.totalAmount);
                const totalPaid = toNumber(c.totalPaidAmount ?? c.totalPaid);

                return (
                  <div
                    key={c.companyId}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-black text-slate-900 text-base">{c.companyName}</h3>
                          <p className="text-xs text-slate-400 font-mono">আইডি: #{c.companyId} {c.companyCode ? `• কোড: ${c.companyCode}` : ''}</p>
                        </div>
                        {advance > 0 ? (
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 border border-sky-200">
                            অগ্রিম: {formatCurrency(advance)}
                          </span>
                        ) : payable > 0 ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                            পাওনা: {formatCurrency(payable)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            ✓ সমতা
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-400 font-medium">গৃহীত মোট মাল</span>
                          <p className="font-bold text-slate-800 text-sm mt-0.5">{formatCurrency(totalGoods)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">মোট পরিশোধ</span>
                          <p className="font-black text-emerald-600 text-sm mt-0.5">{formatCurrency(totalPaid)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => {
                          const comp = companies.find((x) => x.id === c.companyId);
                          openBankDraftModal(comp);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 text-xs font-bold transition-colors"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        <span>ড্রাফট দিন</span>
                      </button>

                      <Link
                        href={`/purchases/create?companyId=${c.companyId}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 text-xs font-bold transition-colors"
                      >
                        <Package className="h-3.5 w-3.5" />
                        <span>চালান ইন</span>
                      </Link>

                      <Link
                        href={`/purchases/companies/${c.companyId}`}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                        title="পূর্ণ লেজার দেখুন"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: 📊 PRODUCT-WISE SUPPLIES */}
          {activeTab === 'products' && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
                  <thead className="bg-slate-50/80 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-4 text-left">পণ্য ও কোড (Product)</th>
                      <th className="py-3.5 px-4 text-left">সরবরাহকারী কোম্পানি</th>
                      <th className="py-3.5 px-4 text-right">মোট প্রাপ্ত সংখ্যা</th>
                      <th className="py-3.5 px-4 text-right">মোট গৃহীত মূল্য (৳)</th>
                      <th className="py-3.5 px-4 text-right">গড় ক্রয় দর (৳)</th>
                      <th className="py-3.5 px-4 text-right">বর্তমান স্টক</th>
                      <th className="py-3.5 px-4 text-center">চালান সংখ্যা</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {productSupplies.map((p) => (
                      <tr key={p.productId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{p.productName}</div>
                          <div className="text-[11px] text-slate-400">#{p.productId} • {p.unit || 'Pcs'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            🏢 {p.companyName}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900">
                          {p.totalQuantityReceived ?? p.totalQuantity} {p.unit}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-indigo-950">
                          {formatCurrency(p.totalCostValue ?? p.totalCost ?? 0)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                          ৳{p.avgUnitCost || p.latestBuyPrice || 0}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-emerald-600">
                          {p.currentStock || 0} {p.unit}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {p.purchaseCount} বার
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================== */}
      {/* 3. BUTTON 1 MODAL: BANK DRAFT / ADVANCE PAYMENT & PRE-ORDER     */}
      {/* ============================================================== */}
      {isBankDraftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-4xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    🏦 ব্যাংক ড্রাফট / টাকা পরিশোধ (অগ্রিম অর্ডার)
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    কোম্পানিকে অগ্রিম ব্যাংক ড্রাফট প্রদান এবং পণ্যের প্রি-অর্ডার তালিকা সংরক্ষণ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBankDraftModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBankDraft} className="space-y-6">
              {/* SECTION A — Supplier Information (🏢 সরবরাহকারী তথ্য) */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <span>SECTION A: 🏢 সরবরাহকারী তথ্য (Supplier Information)</span>
                </div>

                <div className="relative">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    সরবরাহকারী / কোম্পানি নির্বাচন করুন *
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={supplierSearch}
                      onChange={(e) => {
                        setSupplierSearch(e.target.value);
                        setShowSupplierDropdown(true);
                      }}
                      onFocus={() => setShowSupplierDropdown(true)}
                      placeholder="কোম্পানি বা সরবরাহকারীর নাম লিখে খুঁজুন..."
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none shadow-sm"
                    />
                  </div>

                  {showSupplierDropdown && (
                    <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl ring-1 ring-black/5">
                      {companies
                        .filter((c) => !supplierSearch || c.name.toLowerCase().includes(supplierSearch.toLowerCase()))
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectSupplier(c)}
                            className="w-full flex items-center justify-between rounded-xl p-2.5 text-left text-xs sm:text-sm hover:bg-slate-50 transition-colors font-medium text-slate-800"
                          >
                            <div>
                              <div className="font-bold text-slate-900">{c.name}</div>
                              <div className="text-xs text-slate-400">আইডি: SUP-{c.id} • ফোন: {c.phone || 'N/A'}</div>
                            </div>
                            <span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-600">
                              সিলেক্ট
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Compact Supplier Summary Card */}
                {selectedSupplier && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-indigo-950 text-sm">{selectedSupplier.name}</span>
                        <span className="rounded-md bg-indigo-200/60 text-indigo-900 px-2 py-0.5 font-mono font-bold text-[11px]">
                          SUP-{selectedSupplier.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-600 flex-wrap">
                        {selectedSupplier.phone && <span>📞 {selectedSupplier.phone}</span>}
                        {selectedSupplier.address && <span>📍 {selectedSupplier.address}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSupplier(null);
                        setSupplierSearch('');
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold self-start sm:self-auto"
                    >
                      পরিবর্তন করুন
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION B — Payment Information (🏦 পেমেন্ট তথ্য) */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                  <Landmark className="h-4 w-4 text-indigo-600" />
                  <span>SECTION B: 🏦 পেমেন্ট তথ্য (Payment Information)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      পেমেন্ট মেথড *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e: any) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs sm:text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none shadow-sm"
                    >
                      <option value="BANK">🏦 Bank Draft (Default)</option>
                      <option value="CHEQUE">📝 Cheque</option>
                      <option value="TRANSFER">💳 Bank Transfer</option>
                      <option value="CASH">💵 Cash</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      ড্রাফট / রেফারেন্স নং *
                    </label>
                    <input
                      type="text"
                      value={draftRefNo}
                      onChange={(e) => setDraftRefNo(e.target.value)}
                      placeholder="যেমন: BD-10025"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs sm:text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none shadow-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      ব্যাংকের নাম
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="যেমন: Sonali Bank"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs sm:text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      শাখার নাম (Branch)
                    </label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="যেমন: Gazipur Branch"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs sm:text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      ড্রাফটের তারিখ *
                    </label>
                    <input
                      type="date"
                      value={draftDate}
                      onChange={(e) => setDraftDate(e.target.value)}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs sm:text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      ড্রাফটের মোট টাকা (Draft Amount ৳) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={draftAmount}
                      onChange={(e) => setDraftAmount(e.target.value)}
                      required
                      placeholder="যেমন: 100000"
                      className="w-full rounded-2xl border border-emerald-300 bg-emerald-50/60 p-3 text-sm font-black text-emerald-900 focus:border-emerald-500 focus:bg-white focus:outline-none shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION C — PRE-ORDER PRODUCTS (📦 প্রি-অর্ডার পণ্য) */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                    <Package className="h-4 w-4 text-indigo-600" />
                    <span>SECTION C: 📦 প্রি-অর্ডার পণ্য (Pre-Order Products)</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddPreOrderRow}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-bold shadow-md transition-all hover:scale-105 active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    <span>+ পণ্য যোগ করুন</span>
                  </button>
                </div>

                {/* Pre-Order Product Table */}
                <div className="space-y-3">
                  {preOrderItems.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm items-center"
                    >
                      {/* Product Search & Dropdown */}
                      <div className="relative sm:col-span-4">
                        <input
                          type="text"
                          placeholder="পণ্য সিলেক্ট বা নাম লিখুন..."
                          value={row.searchText !== undefined ? row.searchText : row.productName}
                          onFocus={() => handleUpdatePreOrderRow(idx, 'showResults', true)}
                          onChange={(e) => handleUpdatePreOrderRow(idx, 'searchText', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                        />

                        {row.showResults && (
                          <div className="absolute left-0 top-full z-50 mt-1 max-h-52 w-full min-w-[260px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl">
                            {allProducts
                              .filter((p) => {
                                const q = (row.searchText || '').toLowerCase();
                                return !q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
                              })
                              .map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectPreOrderProduct(idx, p);
                                  }}
                                  className="w-full flex items-center justify-between p-2 text-left text-xs hover:bg-slate-50 rounded-lg"
                                >
                                  <div>
                                    <div className="font-bold text-slate-900">{p.name}</div>
                                    <div className="text-[10px] text-slate-400">SKU: {p.sku || 'N/A'} • দর: ৳{p.buyPrice || 0}</div>
                                  </div>
                                  <span className="text-indigo-600 font-bold">সিলেক্ট</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* SKU (Readonly display) */}
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          readOnly
                          value={row.sku || '-'}
                          placeholder="SKU"
                          className="w-full rounded-xl border border-slate-100 bg-slate-100/60 p-2 text-xs font-mono text-slate-600 text-center"
                        />
                      </div>

                      {/* Order Quantity */}
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={row.quantity}
                          onChange={(e) => handleUpdatePreOrderRow(idx, 'quantity', e.target.value)}
                          placeholder="পরিমাণ"
                          title="অর্ডার সংখ্যা"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 text-center focus:border-indigo-500 focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Buy Rate */}
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={row.unitPrice}
                          onChange={(e) => handleUpdatePreOrderRow(idx, 'unitPrice', e.target.value)}
                          placeholder="ক্রয় দর (৳)"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 text-right focus:border-indigo-500 focus:bg-white focus:outline-none"
                        />
                      </div>

                      {/* Line Total & Remove */}
                      <div className="sm:col-span-2 flex items-center justify-between gap-2">
                        <span className="font-black text-emerald-800 text-xs truncate">
                          {formatCurrency(parseFloat(row.amount) || 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePreOrderRow(idx)}
                          className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors shrink-0"
                          title="সারি মুছুন"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION D — PAYMENT SUMMARY (Highlighted Summary Card) */}
              <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-emerald-50 p-5 text-slate-900 shadow-sm">
                <div className="flex items-center justify-between border-b border-indigo-200/60 pb-3 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-900">
                    SECTION D: 💰 পেমেন্ট সামারি (Payment Summary)
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    ● সম্পূর্ণ পরিশোধিত
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">প্রি-অর্ডার মোট পণ্য:</span>
                    <p className="text-base font-black text-slate-900 mt-0.5">{preOrderTotalQuantity} Pcs</p>
                  </div>
                  <div>
                    <span className="text-slate-500">প্রি-অর্ডার মোট মূল্য:</span>
                    <p className="text-base font-black text-indigo-950 mt-0.5">{formatCurrency(preOrderTotalAmount)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">ব্যাংক ড্রাফট টাকা:</span>
                    <p className="text-base font-black text-emerald-700 mt-0.5">{formatCurrency(effectiveDraftAmountNum)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">অগ্রিম ব্যালেন্স:</span>
                    <p className="text-base font-black text-sky-700 mt-0.5">{formatCurrency(draftAdvanceBalance)}</p>
                  </div>
                </div>
              </div>

              {/* SECTION E — SAVE BUTTONS */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBankDraftModalOpen(false)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDraft}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-7 py-3 text-xs sm:text-sm font-black text-white shadow-xl shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingDraft ? (
                    <span>সংরক্ষণ হচ্ছে...</span>
                  ) : (
                    <>
                      <span>💾 অগ্রিম পেমেন্ট ও প্রি-অর্ডার সংরক্ষণ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 14. SUCCESS DIALOG AFTER SAVING PRE-ORDER / BANK DRAFT         */}
      {/* ============================================================== */}
      {savedDraftResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 text-center space-y-5">
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="h-9 w-9" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">✅ প্রি-অর্ডার সফলভাবে সংরক্ষণ হয়েছে</h3>
              <p className="text-xs text-slate-500 mt-1">
                ব্যাংক ড্রাফট এবং প্রি-অর্ডারকৃত পণ্যের তালিকা সিস্টেমে রেকর্ড করা হয়েছে।
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Draft:</span>
                <span className="font-mono font-bold text-slate-900">{savedDraftResult.draftNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-bold text-slate-900">{savedDraftResult.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-black text-emerald-700 text-sm">{formatCurrency(savedDraftResult.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Products:</span>
                <span className="font-bold text-indigo-700">{savedDraftResult.productCount} টি</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Link
                href="/purchases/create"
                onClick={() => setSavedDraftResult(null)}
                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
              >
                📦 এখন চালান ইন করুন
              </Link>

              <button
                type="button"
                onClick={() => {
                  setSavedDraftResult(null);
                  setIsBankDraftModalOpen(false);
                  setActiveTab('challans');
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition-colors"
              >
                📑 সকল চালান দেখুন
              </button>

              <button
                type="button"
                onClick={() => {
                  setSavedDraftResult(null);
                  setIsBankDraftModalOpen(false);
                }}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 pt-1"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Confirmation Modal for Delete */}
      <ConfirmModal
        isOpen={Boolean(deleteModal?.isOpen)}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleConfirmDelete}
        title={deleteModal?.title || 'মুছে ফেলতে চান?'}
        description={deleteModal?.description}
        confirmText="হ্যাঁ, মুছে ফেলুন"
        cancelText="বাতিল করুন"
        variant="danger"
        isLoading={isDeleting}
        details={deleteModal?.details || []}
        warningNote="সতর্কতা: এটি মুছে ফেললে সম্পর্কিত খতিয়ান আপডেট হবে এবং তথ্য আর পুনরুদ্ধার করা যাবে না।"
      />
    </div>
  );
}
