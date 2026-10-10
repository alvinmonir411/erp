'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getCompanies } from '@/lib/api/companies';
import {
  getCompanyWisePayableSummary,
  getPurchases,
  getCompanyPayments,
  recordCompanyPayment,
  deletePurchase,
  deleteCompanyPayment,
  uploadPurchaseInvoiceFile,
} from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { StateMessage } from '@/components/ui/state-message';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, toNumber } from '@/lib/utils/format';
import type {
  Company,
  CompanyWisePayableSummary,
  Purchase,
  PurchasePayment,
} from '@/types/api';
import {
  Plus,
  Search,
  Building2,
  Calendar,
  FilterX,
  Wallet,
  TrendingDown,
  ArrowUpRight,
  Package,
  X,
  Trash2,
  Printer,
  Eye,
  CheckCircle,
  Phone,
  FileText,
  Landmark,
  Camera,
  ExternalLink,
  UploadCloud,
} from 'lucide-react';

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function PurchasesPage() {
  // Main Navigation: 3 Simple Tabs (Invoices, Company Ledger, Payments)
  const [activeTab, setActiveTab] = useState<'invoices' | 'companies' | 'payments'>('invoices');

  // Data Sources
  const [companies, setCompanies] = useState<Company[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payableSummary, setPayableSummary] = useState<CompanyWisePayableSummary[]>([]);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FULLY_RECEIVED' | 'PARTIAL'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Loading & Notifications
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  // Simple "Pay Supplier / Bank Draft" Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payCompanyId, setPayCompanyId] = useState<number | ''>('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(formatDateInput(new Date()));
  const [payMethod, setPayMethod] = useState('BANK_DRAFT');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payInvoiceImageUrl, setPayInvoiceImageUrl] = useState<string | null>(null);
  const [payInvoicePublicId, setPayInvoicePublicId] = useState<string | null>(null);
  const [isUploadingPaySlip, setIsUploadingPaySlip] = useState(false);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Full-Screen Image Preview Modal
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'purchase' | 'payment';
    id: number;
    title: string;
    description: string;
    details: Array<{ label: string; value: React.ReactNode }>;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useToastNotification({
    message: toastMessage,
    title: toastTone === 'success' ? 'Success' : 'Error',
    tone: toastTone,
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [compList, purchaseList, summaryList, payList] = await Promise.all([
        getCompanies().catch(() => []),
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
        getCompanyPayments({
          companyId: selectedCompanyId ?? undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        }).catch(() => []),
      ]);

      setCompanies(compList);
      setPurchases(purchaseList);
      setPayableSummary(summaryList);
      setPayments(payList);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCompanyId, fromDate, toDate, searchTerm]);

  // Financial KPI Metrics (3 Core Numbers)
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

    return {
      totalPurchases,
      totalPaid,
      totalPayable,
      totalAdvance,
    };
  }, [payableSummary]);

  // Filtered Purchases List
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (selectedCompanyId && p.companyId !== selectedCompanyId) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchInv = p.invoiceNo?.toLowerCase().includes(q);
        const matchRef = p.referenceNo?.toLowerCase().includes(q);
        const matchSup = p.supplierName?.toLowerCase().includes(q);
        const matchComp = p.company?.name?.toLowerCase().includes(q);
        if (!matchInv && !matchRef && !matchSup && !matchComp) return false;
      }

      const totalVal = toNumber(p.totalAmount);
      const paidVal = toNumber(p.paidAmount);
      const isComplete = p.status === 'CONFIRMED' || Math.abs(totalVal - paidVal) < 0.01;

      if (statusFilter === 'FULLY_RECEIVED' && !isComplete) return false;
      if (statusFilter === 'PARTIAL' && isComplete) return false;

      return true;
    });
  }, [purchases, selectedCompanyId, searchTerm, statusFilter]);

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    return payments.filter((pay) => {
      if (selectedCompanyId && pay.companyId !== selectedCompanyId) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchComp = pay.company?.name?.toLowerCase().includes(q);
        const matchRef = pay.transactionRef?.toLowerCase().includes(q);
        const matchNote = pay.note?.toLowerCase().includes(q);
        if (!matchComp && !matchRef && !matchNote) return false;
      }
      return true;
    });
  }, [payments, selectedCompanyId, searchTerm]);

  // Filtered Companies Summary
  const filteredCompanies = useMemo(() => {
    return payableSummary.filter((c) => {
      if (selectedCompanyId && c.companyId !== selectedCompanyId) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = c.companyName?.toLowerCase().includes(q);
        const matchCode = c.companyCode?.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [payableSummary, selectedCompanyId, searchTerm]);

  // Open Simple Payment Modal
  const openPayModal = (companyId?: number, suggestedAmount?: number) => {
    setPayCompanyId(companyId || (companies[0]?.id ?? ''));
    if (suggestedAmount && suggestedAmount > 0) {
      setPayAmount(String(suggestedAmount));
    } else if (companyId) {
      const comp = payableSummary.find((c) => c.companyId === companyId);
      const due = toNumber(comp?.totalPayableAmount ?? comp?.totalPayable);
      setPayAmount(due > 0 ? String(due) : '');
    } else {
      setPayAmount('');
    }
    setPayDate(formatDateInput(new Date()));
    setPayMethod('BANK_DRAFT');
    setPayRef('');
    setPayNote('');
    setPayInvoiceImageUrl(null);
    setPayInvoicePublicId(null);
    setIsPayModalOpen(true);
  };

  const handleUploadPaySlip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPaySlip(true);
      const res = await uploadPurchaseInvoiceFile(file);
      setPayInvoiceImageUrl(res.url);
      setPayInvoicePublicId(res.publicId);
      setToastTone('success');
      setToastMessage('Bank slip photo uploaded to Cloudinary!');
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'Failed to upload bank slip');
    } finally {
      setIsUploadingPaySlip(false);
    }
  };

  // Submit Simple Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCompanyId) {
      setToastTone('error');
      setToastMessage('Please select a supplier company.');
      return;
    }
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setToastTone('error');
      setToastMessage('Please enter a valid payment amount greater than 0.');
      return;
    }

    try {
      setIsSubmittingPay(true);
      await recordCompanyPayment(Number(payCompanyId), {
        amount: amt,
        paymentDate: payDate,
        paymentMethod: payMethod,
        transactionRef: payRef.trim() || undefined,
        note: payNote.trim() || undefined,
        invoiceImageUrl: payInvoiceImageUrl || undefined,
        invoiceImagePublicId: payInvoicePublicId || undefined,
      });

      setToastTone('success');
      setToastMessage(`Bank draft / advance of ${formatCurrency(amt)} recorded successfully.`);
      setIsPayModalOpen(false);
      await loadData();
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Delete Prompt
  const promptDeletePurchase = (p: Purchase) => {
    setDeleteModal({
      isOpen: true,
      type: 'purchase',
      id: p.id,
      title: 'Delete this purchase invoice?',
      description: 'This invoice will be removed from purchase records.',
      details: [
        { label: 'Challan / Invoice No', value: `#${p.invoiceNo || p.referenceNo || p.id}` },
        { label: 'Supplier', value: p.company?.name || p.supplierName || 'N/A' },
        { label: 'Date', value: formatDate(p.purchaseDate) },
        { label: 'Total Amount', value: formatCurrency(p.totalAmount) },
      ],
    });
  };

  const promptDeletePayment = (pay: PurchasePayment) => {
    setDeleteModal({
      isOpen: true,
      type: 'payment',
      id: pay.id,
      title: 'Delete payment record?',
      description: 'This payment record will be permanently deleted.',
      details: [
        { label: 'Slip / Ref No', value: pay.transactionRef || `#PAY-${pay.id}` },
        { label: 'Supplier', value: pay.company?.name || 'N/A' },
        { label: 'Date', value: formatDate(pay.paymentDate) },
        { label: 'Payment Amount', value: formatCurrency(pay.amount) },
      ],
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    try {
      setIsDeleting(true);
      if (deleteModal.type === 'purchase') {
        await deletePurchase(deleteModal.id);
        setToastTone('success');
        setToastMessage('Purchase invoice deleted successfully.');
      } else {
        await deleteCompanyPayment(deleteModal.id);
        setToastTone('success');
        setToastMessage('Payment record deleted successfully.');
      }
      setDeleteModal(null);
      await loadData();
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(searchTerm || selectedCompanyId || statusFilter !== 'ALL' || fromDate || toDate);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCompanyId(null);
    setStatusFilter('ALL');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="space-y-6 pb-20 text-slate-800">
      {/* 🌟 1. CLEAN, MODERN HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Purchases & Suppliers
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage product deliveries, company bills, and payment records
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => openPayModal()}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all hover:scale-105 active:scale-95"
            title="Pay company first via bank draft before receiving product"
          >
            <Landmark className="h-4 w-4" />
            <span>Bank Draft / Pay Advance</span>
          </button>
          <Link
            href="/purchases/create"
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all hover:scale-105 active:scale-95"
            title="Receive product delivery against bank draft"
          >
            <Package className="h-4 w-4" />
            <span>Receive Products</span>
          </Link>
        </div>
      </div>

      {/* 📊 2. THE 3 CORE FINANCIAL CARDS (Products Received | Money Paid | Net Balance) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Products Received */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Products Received
            </span>
            <div className="rounded-2xl bg-indigo-50 p-2.5 text-indigo-600">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
            {formatCurrency(kpiStats.totalPurchases)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Total goods value delivered by suppliers
          </p>
        </div>

        {/* Card 2: Money Paid */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Money Paid
            </span>
            <div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-emerald-600">
            {formatCurrency(kpiStats.totalPaid)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Total money paid to suppliers to date
          </p>
        </div>

        {/* Card 3: Net Balance */}
        {kpiStats.totalAdvance > 0 ? (
          <div className="rounded-3xl border border-sky-300 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                Supplier Advance Balance
              </span>
              <div className="rounded-2xl bg-sky-100 p-2.5 text-sky-700">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-black text-sky-700">
              {formatCurrency(kpiStats.totalAdvance)}
            </p>
            <p className="mt-1 text-xs text-sky-700 font-medium">
              We paid extra; suppliers owe us products or refund
            </p>
          </div>
        ) : kpiStats.totalPayable > 0 ? (
          <div className="rounded-3xl border border-rose-300 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                Supplier Due (Payable)
              </span>
              <div className="rounded-2xl bg-rose-100 p-2.5 text-rose-600">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-black text-rose-600">
              {formatCurrency(kpiStats.totalPayable)}
            </p>
            <p className="mt-1 text-xs text-rose-600/90 font-medium">
              Outstanding payable balance to pay to suppliers
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                All Suppliers Settled
              </span>
              <div className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-black text-emerald-700">
              ৳0
            </p>
            <p className="mt-1 text-xs text-emerald-600 font-medium">
              No outstanding due or advance with any company
            </p>
          </div>
        )}
      </div>

      {/* 🧭 3. THREE SIMPLE TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'invoices'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Purchases & Invoices ({purchases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('companies')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'companies'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Company Ledger ({payableSummary.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'payments'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Payment History ({payments.length})</span>
        </button>
      </div>

      {/* 🔍 4. CLEAN, COMPACT FILTER BAR */}
      <div className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search supplier, challan no, note..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-xs sm:text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
            />
          </div>

          {/* Supplier Dropdown */}
          <div className="sm:col-span-1 lg:col-span-3 relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={selectedCompanyId ?? ''}
              onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs sm:text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none transition-all truncate"
            >
              <option value="">All Suppliers</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter (When on Invoices Tab) */}
          {activeTab === 'invoices' && (
            <div className="sm:col-span-1 lg:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs sm:text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="FULLY_RECEIVED">Fully Received</option>
                <option value="PARTIAL">Partially Received</option>
              </select>
            </div>
          )}

          {/* Date Range */}
          <div className={`sm:col-span-2 ${activeTab === 'invoices' ? 'lg:col-span-3' : 'lg:col-span-5'} flex items-center gap-1.5`}>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 px-2.5 text-xs font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
              title="Start Date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 px-2.5 text-xs font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
              title="End Date"
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 transition-colors shrink-0"
                title="Clear filters"
              >
                <FilterX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 📋 5. MAIN CONTENT AREA */}
      {isLoading ? (
        <LoadingBlock
          label="Loading Purchases..."
          subLabel="Fetching invoices and supplier records..."
        />
      ) : (
        <>
          {/* TAB 1: PURCHASES & INVOICES */}
          {activeTab === 'invoices' && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4 text-left">Date</th>
                      <th className="py-3 px-4 text-left">Supplier</th>
                      <th className="py-3 px-4 text-left">Challan / Invoice</th>
                      <th className="py-3 px-4 text-right text-indigo-900">Bill Amount</th>
                      <th className="py-3 px-4 text-right text-emerald-700">Paid Amount</th>
                      <th className="py-3 px-4 text-right">Balance</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredPurchases.map((p) => {
                      const totalBill = toNumber(p.totalAmount);
                      const paidAmt = toNumber(p.paidAmount);
                      const dueAmt = Math.max(0, totalBill - paidAmt);
                      const advanceAmt = Math.max(0, paidAmt - totalBill);
                      const isComplete = p.status === 'CONFIRMED' || Math.abs(totalBill - paidAmt) < 0.01;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Date */}
                          <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                            {formatDate(p.purchaseDate)}
                          </td>

                          {/* Supplier */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">
                              {p.company?.name || p.supplierName || 'Company'}
                            </div>
                            {p.company?.phone && (
                              <div className="text-[11px] text-slate-400">
                                {p.company.phone}
                              </div>
                            )}
                          </td>

                          {/* Challan No & Document Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-indigo-900">
                                #{p.invoiceNo || p.referenceNo || p.id}
                              </span>
                              {p.invoiceImageUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImageModal(p.invoiceImageUrl!)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                                  title="View uploaded company memo / invoice"
                                >
                                  <Camera className="h-3 w-3" />
                                  <span>Memo</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Bill Amount */}
                          <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                            {formatCurrency(totalBill)}
                          </td>

                          {/* Paid Amount */}
                          <td className="py-3.5 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                            {formatCurrency(paidAmt)}
                          </td>

                          {/* Balance */}
                          <td className="py-3.5 px-4 text-right font-black whitespace-nowrap">
                            {dueAmt > 0 ? (
                              <span className="text-rose-600">
                                Due: {formatCurrency(dueAmt)}
                              </span>
                            ) : advanceAmt > 0 ? (
                              <span className="text-sky-600">
                                Adv: {formatCurrency(advanceAmt)}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold">✓ Settled</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                <span>Fully Received</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
                                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                <span>Partially Received</span>
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {p.invoiceImageUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImageModal(p.invoiceImageUrl!)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 text-xs font-bold text-indigo-700 transition-colors"
                                  title="View company invoice photo"
                                >
                                  <Camera className="h-3.5 w-3.5" />
                                  <span>Memo</span>
                                </button>
                              )}

                              <Link
                                href={`/purchases/${p.id}`}
                                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition-colors"
                                title="View challan details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>View</span>
                              </Link>

                              <Link
                                href={`/purchases/${p.id}/print-challan`}
                                target="_blank"
                                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all"
                                title="Print Challan"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Print</span>
                              </Link>

                              <button
                                type="button"
                                onClick={() => promptDeletePurchase(p)}
                                className="rounded-xl p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                title="Delete invoice"
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

              {filteredPurchases.length === 0 && (
                <div className="p-12 text-center">
                  <StateMessage
                    title="No purchases found"
                    description="No invoices match your current search or filters."
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPANY LEDGER */}
          {activeTab === 'companies' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompanies.map((c) => {
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
                          <p className="text-xs text-slate-400 font-mono">
                            ID: #{c.companyId} {c.companyCode ? `• Code: ${c.companyCode}` : ''}
                          </p>
                        </div>
                        {advance > 0 ? (
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 border border-sky-200">
                            Advance: {formatCurrency(advance)}
                          </span>
                        ) : payable > 0 ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                            Due: {formatCurrency(payable)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            ✓ Settled
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-400 font-medium">Products Received</span>
                          <p className="font-bold text-slate-800 text-sm mt-0.5">{formatCurrency(totalGoods)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Money Paid</span>
                          <p className="font-black text-emerald-600 text-sm mt-0.5">{formatCurrency(totalPaid)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => openPayModal(c.companyId, payable)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 text-xs font-bold transition-colors"
                        title="Send money/draft to company"
                      >
                        <Landmark className="h-3.5 w-3.5" />
                        <span>Bank Draft</span>
                      </button>

                      <Link
                        href={`/purchases/create?companyId=${c.companyId}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 text-xs font-bold transition-colors"
                        title="Receive products against bank draft"
                      >
                        <Package className="h-3.5 w-3.5" />
                        <span>Receive Products</span>
                      </Link>

                      <Link
                        href={`/purchases/companies/${c.companyId}`}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                        title="View Full Ledger"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}

              {filteredCompanies.length === 0 && (
                <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200">
                  <StateMessage
                    title="No companies found"
                    description="No supplier company records match your search."
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PAYMENT HISTORY */}
          {activeTab === 'payments' && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4 text-left">Date</th>
                      <th className="py-3 px-4 text-left">Supplier</th>
                      <th className="py-3 px-4 text-right text-emerald-700">Draft / Paid Amount</th>
                      <th className="py-3 px-4 text-center">Method</th>
                      <th className="py-3 px-4 text-left">Slip / Ref No</th>
                      <th className="py-3 px-4 text-left">Note / Remarks</th>
                      <th className="py-3 px-4 text-center">Document</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredPayments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {formatDate(pay.paymentDate)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {pay.company?.name || 'Company'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                          {formatCurrency(pay.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`rounded-lg px-2 py-0.5 text-xs font-bold uppercase ${
                            pay.paymentMethod === 'BANK_DRAFT'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {pay.paymentMethod === 'BANK_DRAFT' ? '🏦 Bank Draft' : pay.paymentMethod || 'CASH'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                          {pay.transactionRef || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                          {pay.note || '-'}
                        </td>
                        {/* Slip / Document */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {pay.invoiceImageUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImageModal(pay.invoiceImageUrl!)}
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                              title="View slip photo"
                            >
                              <Camera className="h-3 w-3" />
                              <span>Slip</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/purchases/create?companyId=${pay.companyId}&paymentId=${pay.id}`}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-700 transition-colors"
                              title="Receive product delivery against this bank draft"
                            >
                              <Package className="h-3.5 w-3.5" />
                              <span>Receive Products</span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => promptDeletePayment(pay)}
                              className="rounded-xl p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Delete payment record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredPayments.length === 0 && (
                <div className="p-12 text-center">
                  <StateMessage
                    title="No payments found"
                    description="No payment records found for the selected filter."
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 💳 6. SIMPLE & FAST "BANK DRAFT / ADVANCE PAYMENT" MODAL */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Bank Draft / Advance</h3>
                  <p className="text-xs text-slate-500">Pay company first via bank draft before receiving products</p>
                </div>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              {/* Supplier Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Supplier Company *
                </label>
                <select
                  required
                  value={payCompanyId}
                  onChange={(e) => {
                    const cid = Number(e.target.value);
                    setPayCompanyId(cid);
                    const comp = payableSummary.find((c) => c.companyId === cid);
                    const due = toNumber(comp?.totalPayableAmount ?? comp?.totalPayable);
                    if (due > 0) setPayAmount(String(due));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select a supplier...</option>
                  {companies.map((c) => {
                    const sum = payableSummary.find((x) => x.companyId === c.id);
                    const due = toNumber(sum?.totalPayableAmount ?? sum?.totalPayable);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {due > 0 ? `(Due: ৳${due})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Draft / Payment Amount (৳) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="Enter amount (e.g. 100000)..."
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-4 text-base font-black text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Date & Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Payment Method *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="BANK_DRAFT">Bank Draft (Advance)</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                  </select>
                </div>
              </div>

              {/* Ref & Note */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Draft # / Ref No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Draft #98124 or Chq #55"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Note / Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Advance for product batch"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 📸 Cloudinary Bank Slip / Draft Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Bank Draft Slip / Deposit Receipt (Cloudinary)
                </label>
                {payInvoiceImageUrl ? (
                  <div className="flex items-center gap-3 p-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/50">
                    <img
                      src={payInvoiceImageUrl}
                      alt="Bank Draft Slip"
                      className="h-12 w-16 object-cover rounded-xl border border-emerald-200 bg-white shrink-0 cursor-pointer"
                      onClick={() => setPreviewImageModal(payInvoiceImageUrl)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-emerald-800 block">✓ Slip Attached</span>
                      <button
                        type="button"
                        onClick={() => setPreviewImageModal(payInvoiceImageUrl)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        Enlarge Preview
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPayInvoiceImageUrl(null);
                        setPayInvoicePublicId(null);
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 hover:bg-slate-100/80 hover:border-indigo-300 py-3 px-4 text-xs font-bold text-slate-700 cursor-pointer transition-colors">
                    <UploadCloud className="h-4 w-4 text-indigo-600" />
                    <span>{isUploadingPaySlip ? 'Uploading to Cloudinary...' : 'Upload Bank Draft Slip / Photo'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={isUploadingPaySlip}
                      onChange={handleUploadPaySlip}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {isSubmittingPay ? 'Saving...' : 'Confirm & Save Bank Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🗑️ 7. CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={Boolean(deleteModal?.isOpen)}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleConfirmDelete}
        title={deleteModal?.title || 'Confirm Delete?'}
        description={deleteModal?.description}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
        details={deleteModal?.details || []}
        warningNote="Warning: Deleting this will update ledger balances and cannot be undone."
      />

      {/* 🖼️ 8. FULL-SCREEN INVOICE DOCUMENT / SLIP PREVIEW MODAL */}
      {previewImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white">
              <span className="text-sm font-bold text-slate-800">
                Attached Document (Cloudinary)
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImageModal}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Full Size</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImageModal(null)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-900/5">
              <img
                src={previewImageModal}
                alt="Document Preview"
                className="max-h-[75vh] w-auto object-contain rounded-xl shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
