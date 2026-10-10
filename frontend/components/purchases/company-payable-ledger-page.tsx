'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCompanyPayableLedger,
  recordCompanyPayment,
  confirmPurchase,
} from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, toNumber } from '@/lib/utils/format';
import type { CompanyPayableLedger, Purchase, CompanyPayableHistoryEntry } from '@/types/api';
import {
  Building2,
  Calendar,
  Wallet,
  CheckCircle,
  TrendingDown,
  Package,
  Plus,
  ArrowLeft,
  X,
  Search,
  Eye,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Phone,
  MapPin,
  FileText,
} from 'lucide-react';

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type UnifiedLedgerItem = {
  id: string;
  type: 'PURCHASE' | 'PAYMENT';
  date: string;
  timestamp: number;
  title: string;
  refNo?: string | null;
  method?: string | null;
  note?: string | null;
  productsReceived: number; // Value of goods delivered by company (+)
  moneyPaid: number;        // Money paid to company (-)
  runningBalance: number;   // Balance after this transaction (+ means due to company, - means advance)
  status?: string;
  purchaseData?: Purchase;
  paymentData?: CompanyPayableHistoryEntry;
};

export function CompanyPayableLedgerPage({ companyId }: { companyId: number }) {
  const [details, setDetails] = useState<CompanyPayableLedger | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PURCHASE' | 'PAYMENT'>('ALL');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(formatDateInput(new Date()));
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Invoice Inspection Modal
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [confirmingPurchaseId, setConfirmingPurchaseId] = useState<number | null>(null);

  useToastNotification({
    message: toastMessage,
    title: toastTone === 'success' ? 'Success' : 'Error',
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
        setError(loadError.message || 'Failed to load company ledger');
      } finally {
        if (showLoader) setIsLoading(false);
      }
    },
    [companyId],
  );

  useEffect(() => {
    void refreshDetails(true);
  }, [refreshDetails]);

  // Open Payment Modal
  const openPaymentModal = () => {
    if (details) {
      const payable = toNumber(details.summary.currentPayable ?? details.summary.totalPayable);
      setPaymentAmount(payable > 0 ? String(payable) : '');
    } else {
      setPaymentAmount('');
    }
    setPaymentDate(formatDateInput(new Date()));
    setPaymentMethod('CASH');
    setTransactionRef('');
    setPaymentNote('');
    setIsPaymentModalOpen(true);
  };

  // Save Simple Payment
  const handleSavePayment = async (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setToastTone('error');
      setToastMessage('Please enter a valid payment amount greater than 0.');
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
      });

      setToastTone('success');
      setToastMessage(`Payment of ${formatCurrency(amt)} recorded successfully.`);
      setIsPaymentModalOpen(false);
      await refreshDetails(false);
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Confirm Purchase Stock
  const handleConfirmStock = async (purchaseId: number) => {
    try {
      setConfirmingPurchaseId(purchaseId);
      await confirmPurchase(purchaseId);
      setToastTone('success');
      setToastMessage('Stock confirmed and received into inventory.');
      if (viewingPurchase && viewingPurchase.id === purchaseId) {
        setViewingPurchase((prev) => prev ? { ...prev, status: 'CONFIRMED' } : null);
      }
      await refreshDetails(false);
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'Failed to confirm stock');
    } finally {
      setConfirmingPurchaseId(null);
    }
  };

  // Build unified chronological ledger transactions
  const unifiedTransactions = useMemo(() => {
    if (!details) return [];

    const list: UnifiedLedgerItem[] = [];

    // 1. Add Purchases (Products Received)
    for (const p of details.payablePurchases || []) {
      const dateVal = p.purchaseDate || (p as any).createdAt || '';
      const timeVal = dateVal ? new Date(dateVal).getTime() : 0;
      list.push({
        id: `purchase-${p.id}`,
        type: 'PURCHASE',
        date: dateVal,
        timestamp: timeVal,
        title: `Products Received (Invoice #${p.invoiceNo || p.id})`,
        refNo: p.invoiceNo ? `#${p.invoiceNo}` : `#PUR-${p.id}`,
        note: p.note || null,
        productsReceived: toNumber(p.totalAmount),
        moneyPaid: 0,
        runningBalance: 0,
        status: p.status,
        purchaseData: p,
      });
    }

    // 2. Add Payments (Money Paid)
    for (const pay of details.paymentHistory || []) {
      const dateVal = pay.paymentDate || pay.createdAt || '';
      const timeVal = dateVal ? new Date(dateVal).getTime() : 0;
      list.push({
        id: `payment-${pay.id}`,
        type: 'PAYMENT',
        date: dateVal,
        timestamp: timeVal,
        title: `Money Paid (${pay.paymentMethod || 'CASH'})`,
        refNo: pay.transactionRef || pay.referenceNo || null,
        method: pay.paymentMethod || 'CASH',
        note: pay.note || null,
        productsReceived: 0,
        moneyPaid: toNumber(pay.amount),
        runningBalance: 0,
        paymentData: pay,
      });
    }

    // Sort chronologically ascending to calculate running balance
    list.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      // If same date/time, put purchases before payments
      return a.type === 'PURCHASE' ? -1 : 1;
    });

    let balance = 0;
    for (const item of list) {
      balance += item.productsReceived; // Goods received increases what we owe
      balance -= item.moneyPaid;        // Payments reduce what we owe
      item.runningBalance = balance;
    }

    // Return in requested display order
    if (sortOrder === 'DESC') {
      return [...list].reverse();
    }
    return list;
  }, [details, sortOrder]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return unifiedTransactions.filter((tx) => {
      if (filterType !== 'ALL' && tx.type !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchRef = tx.refNo ? tx.refNo.toLowerCase().includes(q) : false;
        const matchNote = tx.note ? tx.note.toLowerCase().includes(q) : false;
        const matchMethod = tx.method ? tx.method.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchRef && !matchNote && !matchMethod) {
          return false;
        }
      }
      return true;
    });
  }, [unifiedTransactions, filterType, searchQuery]);

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingBlock
          label="Loading Company Ledger..."
          subLabel="Fetching products received and payment records..."
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
          <span>Back to Company List</span>
        </Link>
        <StateMessage
          title="Company Ledger Unavailable"
          description={error || 'Company not found.'}
        />
      </div>
    );
  }

  const { company, summary } = details;
  const totalPurchases = toNumber(summary.totalPurchases);
  const totalPaid = toNumber(summary.totalPaid);
  const currentPayable = toNumber(summary.currentPayable ?? summary.totalPayable);
  const advanceBalance = toNumber(summary.advanceBalance ?? summary.advanceAmount);
  const isAdvance = advanceBalance > 0;
  const hasDue = currentPayable > 0;

  return (
    <div className="space-y-6 pb-20 text-slate-800">
      {/* 🌟 Top Header Strip */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <Link
              href="/purchases"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3.5 py-1 text-xs font-semibold text-white backdrop-blur-md mb-3 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Company List</span>
            </Link>
            <div className="flex items-center gap-3.5">
              <div className="rounded-2xl bg-indigo-500/25 p-3 text-white border border-white/10">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {company.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-indigo-200">
                  {company.code && (
                    <span className="font-mono bg-white/10 px-2 py-0.5 rounded">
                      Code: {company.code}
                    </span>
                  )}
                  {company.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {company.phone}
                    </span>
                  )}
                  {company.address && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {company.address}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={openPaymentModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95"
            >
              <Wallet className="h-4 w-4" />
              <span>Make Payment</span>
            </button>
            <Link
              href={`/purchases/create?companyId=${companyId}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Receive Products</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 🎯 3 CORE FINANCIAL CARDS (Products Received | Money Paid | Net Balance) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* 1. Products Received */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Products Received
            </span>
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <Package className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-slate-900 tracking-tight">
            {formatCurrency(totalPurchases)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Total value of products company gave to me ({summary.purchaseCount || 0} deliveries)
          </p>
        </div>

        {/* 2. Money Paid */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Money Paid
            </span>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-emerald-600 tracking-tight">
            {formatCurrency(totalPaid)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Total money I gave to this company ({summary.paymentCount || 0} payments)
          </p>
        </div>

        {/* 3. Net Balance */}
        {isAdvance ? (
          <div className="rounded-3xl border border-sky-300 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                Advance Balance (Company Owes Me)
              </span>
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-sky-700 tracking-tight">
              {formatCurrency(advanceBalance)}
            </p>
            <p className="mt-1 text-xs text-sky-700 font-medium">
              I paid extra; company owes me products or cash refund
            </p>
          </div>
        ) : hasDue ? (
          <div className="rounded-3xl border border-rose-300 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                Current Due (I Owe Company)
              </span>
              <div className="rounded-2xl bg-rose-100 p-3 text-rose-600">
                <TrendingDown className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-rose-600 tracking-tight">
              {formatCurrency(currentPayable)}
            </p>
            <p className="mt-1 text-xs text-rose-600/90 font-medium">
              Outstanding payable balance to pay to company
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Account Fully Settled
              </span>
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-emerald-700 tracking-tight">
              ৳0
            </p>
            <p className="mt-1 text-xs text-emerald-600 font-medium">
              All accounts balanced. No due or advance balance.
            </p>
          </div>
        )}
      </div>

      {/* 📜 UNIFIED CHRONOLOGICAL LEDGER STATEMENT */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Table Controls Strip */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Ledger Statement</h2>
            <p className="text-xs text-slate-500">
              Complete history of products received and payments made
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice, slip, note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Toggle Buttons */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
              <button
                onClick={() => setFilterType('ALL')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  filterType === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({unifiedTransactions.length})
              </button>
              <button
                onClick={() => setFilterType('PURCHASE')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  filterType === 'PURCHASE'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
              >
                Products Received ({details.payablePurchases?.length || 0})
              </button>
              <button
                onClick={() => setFilterType('PAYMENT')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  filterType === 'PAYMENT'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-emerald-600'
                }`}
              >
                Payments Made ({details.paymentHistory?.length || 0})
              </button>
            </div>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortOrder((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              title="Change sort order"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
              <span>{sortOrder === 'DESC' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>
        </div>

        {/* Desktop Statement Table (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-xs sm:text-sm">
            <thead className="bg-slate-50/75 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5 text-left">Date</th>
                <th className="py-3.5 px-4 text-left">Transaction Details</th>
                <th className="py-3.5 px-4 text-right text-indigo-700">Products Received (+)</th>
                <th className="py-3.5 px-4 text-right text-emerald-700">Money Paid (-)</th>
                <th className="py-3.5 px-5 text-right">Running Balance</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredTransactions.map((tx) => {
                const isPurchase = tx.type === 'PURCHASE';
                const isDue = tx.runningBalance > 0;
                const isAdv = tx.runningBalance < 0;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Date */}
                    <td className="py-4 px-5 font-medium text-slate-900 whitespace-nowrap">
                      <div>{tx.date ? formatDate(tx.date) : '-'}</div>
                      {tx.date && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>

                    {/* Transaction Details */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {isPurchase ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                            <Package className="h-3 w-3" />
                            <span>Product Received</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                            <Wallet className="h-3 w-3" />
                            <span>Payment Made</span>
                          </span>
                        )}

                        {tx.refNo && (
                          <span className="text-xs font-mono font-semibold text-slate-700">
                            {tx.refNo}
                          </span>
                        )}

                        {isPurchase && tx.status && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              tx.status === 'CONFIRMED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {tx.status === 'CONFIRMED' ? 'Received' : 'Draft'}
                          </span>
                        )}
                      </div>

                      {/* Note / Details */}
                      {tx.note && (
                        <p className="mt-1 text-xs text-slate-500 line-clamp-1 max-w-md">
                          {tx.note}
                        </p>
                      )}
                    </td>

                    {/* Products Received (+) */}
                    <td className="py-4 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                      {tx.productsReceived > 0 ? (
                        <span className="text-indigo-900 font-black">
                          +{formatCurrency(tx.productsReceived)}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Money Paid (-) */}
                    <td className="py-4 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                      {tx.moneyPaid > 0 ? (
                        <span>-{formatCurrency(tx.moneyPaid)}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Running Balance */}
                    <td className="py-4 px-5 text-right font-black whitespace-nowrap">
                      {isDue ? (
                        <span className="text-rose-600">
                          {formatCurrency(tx.runningBalance)}{' '}
                          <span className="text-[10px] font-bold text-rose-500 uppercase">Due</span>
                        </span>
                      ) : isAdv ? (
                        <span className="text-sky-600">
                          {formatCurrency(Math.abs(tx.runningBalance))}{' '}
                          <span className="text-[10px] font-bold text-sky-500 uppercase">Advance</span>
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-bold">Settled (৳0)</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {isPurchase && tx.purchaseData ? (
                        <button
                          onClick={() => setViewingPurchase(tx.purchaseData || null)}
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 px-3 py-1.5 text-xs font-bold transition-colors"
                          title="View Invoice Items"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Items</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">
                          {tx.method || 'CASH'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Clean Card List */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredTransactions.map((tx) => {
            const isPurchase = tx.type === 'PURCHASE';
            const isDue = tx.runningBalance > 0;
            const isAdv = tx.runningBalance < 0;

            return (
              <div key={tx.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isPurchase ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                        <Package className="h-3 w-3" />
                        <span>Product Received</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        <Wallet className="h-3 w-3" />
                        <span>Payment Made</span>
                      </span>
                    )}
                    {tx.refNo && <span className="text-xs font-mono font-bold text-slate-700">{tx.refNo}</span>}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {tx.date ? formatDate(tx.date) : '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      {isPurchase ? 'Product Value' : 'Money Paid'}
                    </span>
                    <span className={`text-base font-black ${isPurchase ? 'text-indigo-900' : 'text-emerald-600'}`}>
                      {isPurchase
                        ? `+${formatCurrency(tx.productsReceived)}`
                        : `-${formatCurrency(tx.moneyPaid)}`}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Balance</span>
                    <span className="text-sm font-black">
                      {isDue ? (
                        <span className="text-rose-600">
                          {formatCurrency(tx.runningBalance)} <span className="text-[10px]">Due</span>
                        </span>
                      ) : isAdv ? (
                        <span className="text-sky-600">
                          {formatCurrency(Math.abs(tx.runningBalance))} <span className="text-[10px]">Adv</span>
                        </span>
                      ) : (
                        <span className="text-emerald-600">৳0 Settled</span>
                      )}
                    </span>
                  </div>
                </div>

                {tx.note && <p className="text-xs text-slate-500 italic">{tx.note}</p>}

                {isPurchase && tx.purchaseData && (
                  <div className="pt-1">
                    <button
                      onClick={() => setViewingPurchase(tx.purchaseData || null)}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 py-2 text-xs font-bold transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Products in this Delivery</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredTransactions.length === 0 && (
          <div className="p-12 text-center">
            <StateMessage
              title="No transactions found"
              description={
                searchQuery
                  ? 'No records match your search query.'
                  : 'No products received or payments recorded yet.'
              }
            />
          </div>
        )}
      </div>

      {/* 💸 SIMPLE PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Make Payment</h3>
                  <p className="text-xs text-slate-500">Pay money to {company.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              {/* Current Balance Banner */}
              {hasDue && (
                <div className="rounded-2xl bg-rose-50 p-3.5 border border-rose-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-700">Current Due Amount:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-rose-700">{formatCurrency(currentPayable)}</span>
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(currentPayable))}
                      className="rounded-lg bg-rose-200/60 px-2 py-0.5 text-[11px] font-bold text-rose-800 hover:bg-rose-200"
                    >
                      Pay Full
                    </button>
                  </div>
                </div>
              )}

              {isAdvance && (
                <div className="rounded-2xl bg-sky-50 p-3.5 border border-sky-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-700">Existing Advance Balance:</span>
                  <span className="text-base font-black text-sky-700">{formatCurrency(advanceBalance)}</span>
                </div>
              )}

              {/* Payment Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Payment Amount (৳) *
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
                    placeholder="Enter amount..."
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-4 text-base font-black text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                  </select>
                </div>
              </div>

              {/* Cheque / Slip / Ref # */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Cheque / Slip / Ref # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chq #12345 or Bank Slip"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Note / Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Note / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly settlement or Advance payment"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {isSubmittingPayment ? 'Saving...' : 'Confirm & Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📦 LIGHTWEIGHT INVOICE ITEMS INSPECTION MODAL */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Products in Invoice #{viewingPurchase.invoiceNo || viewingPurchase.id}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Received on {viewingPurchase.purchaseDate ? formatDate(viewingPurchase.purchaseDate) : '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingPurchase(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Items List */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4 text-left">Product</th>
                      <th className="py-2.5 px-4 text-right">Quantity</th>
                      <th className="py-2.5 px-4 text-right">Purchase Price</th>
                      <th className="py-2.5 px-4 text-right">Total (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(viewingPurchase.items || []).map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {item.productName || item.product?.name || `Product #${item.productId}`}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-800">
                          {item.quantity} {item.unit || 'Pcs'}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600">
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-indigo-700">
                          {formatCurrency(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Invoice Summary */}
              <div className="rounded-2xl bg-slate-50 p-4 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Total Delivery Value:</span>
                <span className="text-base font-black text-indigo-900">
                  {formatCurrency(viewingPurchase.totalAmount)}
                </span>
              </div>

              {viewingPurchase.note && (
                <p className="text-xs text-slate-500 italic">
                  Note: {viewingPurchase.note}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              {viewingPurchase.status !== 'CONFIRMED' ? (
                <button
                  onClick={() => handleConfirmStock(viewingPurchase.id)}
                  disabled={confirmingPurchaseId === viewingPurchase.id}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {confirmingPurchaseId === viewingPurchase.id ? 'Confirming...' : 'Confirm Stock Received'}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>Stock Received & Added to Inventory</span>
                </span>
              )}

              <button
                onClick={() => setViewingPurchase(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
