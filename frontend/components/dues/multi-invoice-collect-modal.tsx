'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  XCircle, 
  DollarSign, 
  Store, 
  Smartphone, 
  Landmark, 
  FileCheck2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { getShopDues, collectDue } from '@/lib/api/dues';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { useToast } from '@/components/ui/toast-provider';
import { useAuth } from '../auth/auth-provider';
import { MoneyReceiptData, MoneyReceiptModal } from './money-receipt-modal';

interface MultiInvoiceCollectModalProps {
  shop: {
    id: number;
    name: string;
    ownerName?: string;
    phone?: string;
    route?: { name: string };
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function MultiInvoiceCollectModal({ shop, onClose, onSuccess }: MultiInvoiceCollectModalProps) {
  const { user } = useAuth();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const [totalAmount, setTotalAmount] = useState<string>('');
  const [collectionDate, setCollectionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MFS' | 'BANK' | 'CHEQUE'>('CASH');
  
  // Method specifics
  const [mfsProvider, setMfsProvider] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [mfsTrxId, setMfsTrxId] = useState('');
  const [mfsSenderPhone, setMfsSenderPhone] = useState('');
  
  const [bankName, setBankName] = useState('');
  const [bankAccountRef, setBankAccountRef] = useState('');
  
  const [chequeNo, setChequeNo] = useState('');
  const [chequeBank, setChequeBank] = useState('');
  const [chequeMaturityDate, setChequeMaturityDate] = useState('');

  const [note, setNote] = useState('');
  const [manualOverride, setManualOverride] = useState(false);
  const [customAllocations, setCustomAllocations] = useState<Record<number, number>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string>('');
  const [generatedReceipt, setGeneratedReceipt] = useState<MoneyReceiptData | null>(null);

  // Fetch all open dues for this shop
  const { data: rawDues = [], isLoading } = useQuery({
    queryKey: ['shop-dues', shop.id],
    queryFn: () => getShopDues(shop.id),
  });

  // Filter and sort open dues (oldest invoices first for FIFO)
  const openDues = useMemo(() => {
    return rawDues
      .filter((d: any) => Number(d.remainingDue) > 0)
      .sort((a: any, b: any) => {
        const dateA = a.order?.orderDate || a.createdAt || '';
        const dateB = b.order?.orderDate || b.createdAt || '';
        return dateA.localeCompare(dateB);
      });
  }, [rawDues]);

  const totalOutstanding = useMemo(() => {
    return openDues.reduce((sum: number, d: any) => sum + Number(d.remainingDue || 0), 0);
  }, [openDues]);

  // FIFO auto-allocation calculation
  const calculatedAllocations = useMemo(() => {
    const entered = parseFloat(totalAmount) || 0;
    if (manualOverride) {
      return customAllocations;
    }

    let remainingToAllocate = entered;
    const allocs: Record<number, number> = {};

    for (const due of openDues) {
      const maxCanTake = Number(due.remainingDue);
      if (remainingToAllocate <= 0) {
        allocs[due.orderId] = 0;
      } else if (remainingToAllocate >= maxCanTake) {
        allocs[due.orderId] = maxCanTake;
        remainingToAllocate -= maxCanTake;
      } else {
        allocs[due.orderId] = Math.round(remainingToAllocate * 100) / 100;
        remainingToAllocate = 0;
      }
    }

    return allocs;
  }, [totalAmount, openDues, manualOverride, customAllocations]);

  // Total allocated across invoices
  const totalAllocated = useMemo(() => {
    return Object.values(calculatedAllocations).reduce((sum, val) => sum + (val || 0), 0);
  }, [calculatedAllocations]);

  // Surplus / Customer advance deposit
  const customerAdvance = useMemo(() => {
    const entered = parseFloat(totalAmount) || 0;
    if (entered > totalOutstanding) {
      return Math.round((entered - totalOutstanding) * 100) / 100;
    }
    return 0;
  }, [totalAmount, totalOutstanding]);

  // Pre-fill amount with total outstanding if clicked
  const handleFillFull = () => {
    setTotalAmount(totalOutstanding.toString());
    setManualOverride(false);
  };

  const handleCustomAllocationChange = (orderId: number, val: string) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setManualOverride(true);
    setCustomAllocations(prev => {
      const updated = { ...prev, [orderId]: num };
      // Also update totalAmount
      const sum = Object.values(updated).reduce((s, v) => s + v, 0);
      setTotalAmount(sum.toString());
      return updated;
    });
  };

  const handleResetToFifo = () => {
    setManualOverride(false);
    setCustomAllocations({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredAmount = parseFloat(totalAmount) || 0;

    if (enteredAmount <= 0) {
      showErrorToast('Please enter a valid collection amount.');
      return;
    }

    // Method validations
    if (paymentMethod === 'MFS' && !mfsTrxId.trim()) {
      showErrorToast('MFS Transaction ID (TrxID) is required.');
      return;
    }
    if (paymentMethod === 'CHEQUE' && !chequeNo.trim()) {
      showErrorToast('Cheque number is mandatory.');
      return;
    }
    if (paymentMethod === 'BANK' && !bankName.trim()) {
      showErrorToast('Bank name is required.');
      return;
    }

    const invoicesToSettle = openDues
      .map((d: any) => ({
        due: d,
        orderId: d.orderId,
        amount: calculatedAllocations[d.orderId] || 0,
        originalDue: Number(d.dueAmount),
        remainingDue: Number(d.remainingDue),
      }))
      .filter(item => item.amount > 0);

    if (invoicesToSettle.length === 0 && customerAdvance <= 0) {
      showErrorToast('No invoice allocation calculated. Please check the amount.');
      return;
    }

    // Generate Money Receipt Number
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = Math.floor(100000 + Math.random() * 900000);
    const receiptNo = `MR-${yearMonth}-${seq}`;

    // Format payment info string for audit trace
    let methodDetailStr: string = paymentMethod;
    if (paymentMethod === 'MFS') {
      methodDetailStr = `MFS: ${mfsProvider} (TrxID: ${mfsTrxId}${mfsSenderPhone ? `, From: ${mfsSenderPhone}` : ''})`;
    } else if (paymentMethod === 'BANK') {
      methodDetailStr = `BANK: ${bankName}${bankAccountRef ? ` (Ref: ${bankAccountRef})` : ''}`;
    } else if (paymentMethod === 'CHEQUE') {
      methodDetailStr = `CHEQUE: #${chequeNo} [${chequeBank || 'Bank'}]${chequeMaturityDate ? ` (Maturity: ${chequeMaturityDate})` : ''}`;
    }

    try {
      setIsSubmitting(true);
      setSubmitProgress(`Starting collection for ${invoicesToSettle.length} invoices...`);

      // Execute each allocated invoice collection
      for (let i = 0; i < invoicesToSettle.length; i++) {
        const item = invoicesToSettle[i];
        setSubmitProgress(`Settling Order #${item.orderId} (${i + 1}/${invoicesToSettle.length})...`);
        
        let structuredNote = `[MR: ${receiptNo}] [Rail: ${methodDetailStr}]`;
        if (i === invoicesToSettle.length - 1 && customerAdvance > 0) {
          structuredNote += ` [Customer Advance: BDT ${customerAdvance}]`;
        }
        if (note.trim()) {
          structuredNote += ` Note: ${note.trim()}`;
        }

        await collectDue({
          orderId: item.orderId,
          amount: item.amount,
          note: structuredNote,
          collectionDate: collectionDate,
        });
      }

      showSuccessToast(`Successfully submitted collection of ${formatCurrency(enteredAmount)}!`);
      
      // Prepare receipt data
      const receiptData: MoneyReceiptData = {
        receiptNo,
        date: collectionDate,
        shopName: shop.name,
        ownerName: shop.ownerName,
        phone: shop.phone,
        routeName: shop.route?.name,
        paymentMethod,
        paymentDetails: {
          mfsProvider: paymentMethod === 'MFS' ? mfsProvider : undefined,
          trxId: paymentMethod === 'MFS' ? mfsTrxId : undefined,
          senderPhone: paymentMethod === 'MFS' ? mfsSenderPhone : undefined,
          bankName: paymentMethod === 'BANK' ? bankName : (paymentMethod === 'CHEQUE' ? chequeBank : undefined),
          accountRef: paymentMethod === 'BANK' ? bankAccountRef : undefined,
          chequeNo: paymentMethod === 'CHEQUE' ? chequeNo : undefined,
          maturityDate: paymentMethod === 'CHEQUE' ? chequeMaturityDate : undefined,
        },
        invoices: invoicesToSettle.map(item => ({
          orderId: item.orderId,
          allocatedAmount: item.amount,
          remainingDue: item.remainingDue,
          originalDue: item.originalDue,
        })),
        totalCollected: enteredAmount,
        advanceDeposit: customerAdvance,
        note: note.trim() || undefined,
        collectedBy: user?.name || user?.username,
      };

      setGeneratedReceipt(receiptData);
      onSuccess();
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to submit multi-invoice collection.');
    } finally {
      setIsSubmitting(false);
      setSubmitProgress('');
    }
  };

  if (generatedReceipt) {
    return (
      <MoneyReceiptModal
        receipt={generatedReceipt}
        onClose={() => {
          setGeneratedReceipt(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Multi-Invoice AR Collection
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  FIFO Settlement
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Customer: <span className="font-bold text-slate-800">{shop.name}</span>
                {shop.route?.name ? ` · Route: ${shop.route.name}` : ''}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Shop Summary & Total Outstanding Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Outstanding Balance</p>
              <p className="text-xl font-black text-rose-600 mt-0.5">
                {isLoading ? '...' : formatCurrency(totalOutstanding)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Open Due Invoices</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {isLoading ? '...' : `${openDues.length} Invoices`}
              </p>
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleFillFull}
                disabled={totalOutstanding <= 0 || isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Fill Full Balance ({formatCurrency(totalOutstanding)})
              </button>
            </div>
          </div>

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>Received Amount *</span>
                {customerAdvance > 0 && (
                  <span className="text-[11px] font-black text-emerald-600">
                    +{formatCurrency(customerAdvance)} Advance!
                  </span>
                )}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={totalAmount}
                  onChange={(e) => {
                    setTotalAmount(e.target.value);
                    setManualOverride(false);
                  }}
                  className="w-full pl-9 pr-4 py-2.5 text-sm sm:text-base font-black border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-900"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Collection Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  required
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Payment Method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  paymentMethod === 'CASH'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Cash
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('MFS')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  paymentMethod === 'MFS'
                    ? 'border-pink-500 bg-pink-50 text-pink-800 shadow-sm ring-1 ring-pink-500'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <Smartphone className="w-4 h-4 text-pink-600" />
                MFS (Mobile Money)
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('BANK')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  paymentMethod === 'BANK'
                    ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <Landmark className="w-4 h-4 text-blue-600" />
                Bank Transfer
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CHEQUE')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  paymentMethod === 'CHEQUE'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm ring-1 ring-amber-500'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <FileCheck2 className="w-4 h-4 text-amber-600" />
                Cheque
              </button>
            </div>
          </div>

          {/* Dynamic Method Fields */}
          {paymentMethod === 'MFS' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-pink-50/40 rounded-2xl border border-pink-200 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">MFS Provider</label>
                <select
                  value={mfsProvider}
                  onChange={(e: any) => setMfsProvider(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-pink-300 rounded-xl bg-white font-bold"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">TrxID (Transaction ID) *</label>
                <input
                  type="text"
                  required
                  value={mfsTrxId}
                  onChange={(e) => setMfsTrxId(e.target.value)}
                  placeholder="e.g., 9J2K8L9M"
                  className="w-full px-3 py-2 text-xs border border-pink-300 rounded-xl bg-white font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Sender Mobile (Optional)</label>
                <input
                  type="text"
                  value={mfsSenderPhone}
                  onChange={(e) => setMfsSenderPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 text-xs border border-pink-300 rounded-xl bg-white font-mono"
                />
              </div>
            </div>
          )}

          {paymentMethod === 'BANK' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-blue-50/40 rounded-2xl border border-blue-200 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., Dutch-Bangla Bank, City Bank"
                  className="w-full px-3 py-2 text-xs border border-blue-300 rounded-xl bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Deposit Slip / Ref # (Optional)</label>
                <input
                  type="text"
                  value={bankAccountRef}
                  onChange={(e) => setBankAccountRef(e.target.value)}
                  placeholder="e.g., SLIP-98421"
                  className="w-full px-3 py-2 text-xs border border-blue-300 rounded-xl bg-white font-mono"
                />
              </div>
            </div>
          )}

          {paymentMethod === 'CHEQUE' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-amber-50/40 rounded-2xl border border-amber-200 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Cheque Number *</label>
                <input
                  type="text"
                  required
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  placeholder="e.g., CHQ-55019"
                  className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl bg-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Bank Name</label>
                <input
                  type="text"
                  value={chequeBank}
                  onChange={(e) => setChequeBank(e.target.value)}
                  placeholder="e.g., Islami Bank"
                  className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Clearing / Maturity Date</label>
                <input
                  type="date"
                  value={chequeMaturityDate}
                  onChange={(e) => setChequeMaturityDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl bg-white"
                />
              </div>
            </div>
          )}

          {/* Allocation Breakdown Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <span>Invoice Allocation Breakdown</span>
                {manualOverride ? (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                    Custom Manual Allocation
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                    Automated FIFO (Oldest First)
                  </span>
                )}
              </label>
              {manualOverride && (
                <button
                  type="button"
                  onClick={handleResetToFifo}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset to FIFO
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Order # / Date</th>
                    <th className="px-3.5 py-2.5 text-right">Original Due</th>
                    <th className="px-3.5 py-2.5 text-right">Remaining Due</th>
                    <th className="px-3.5 py-2.5 text-right w-44">Allocated Settle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1" />
                        Loading invoices...
                      </td>
                    </tr>
                  ) : openDues.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 font-bold">
                        No outstanding dues found for this customer.
                      </td>
                    </tr>
                  ) : (
                    openDues.map((d: any) => {
                      const allocated = calculatedAllocations[d.orderId] || 0;
                      return (
                        <tr 
                          key={d.id} 
                          className={`transition-colors ${allocated > 0 ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}
                        >
                          <td className="px-3.5 py-2.5">
                            <span className="font-black text-slate-900 block">Order #{d.orderId}</span>
                            <span className="text-[10px] text-slate-400">
                              {formatDate(d.order?.orderDate || d.createdAt)}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-medium text-slate-600">
                            {formatCurrency(d.dueAmount)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-black text-rose-600">
                            {formatCurrency(d.remainingDue)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <input
                              type="number"
                              step="0.01"
                              max={Number(d.remainingDue)}
                              value={allocated || ''}
                              onChange={(e) => handleCustomAllocationChange(d.orderId, e.target.value)}
                              placeholder="0.00"
                              className={`w-32 px-2.5 py-1 text-right text-xs font-black border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                allocated > 0
                                  ? 'border-indigo-400 bg-white text-indigo-900'
                                  : 'border-slate-200 bg-slate-50 text-slate-400'
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {customerAdvance > 0 && (
                    <tr className="bg-emerald-50/60 border-t border-emerald-200">
                      <td colSpan={3} className="px-3.5 py-2.5">
                        <span className="font-black text-emerald-800 text-xs">
                          Customer Advance Deposit
                        </span>
                        <p className="text-[10px] text-emerald-600">
                          Surplus payment will be tagged as credit advance for future deliveries
                        </p>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-black text-emerald-700 text-sm">
                        {formatCurrency(customerAdvance)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <th colSpan={3} className="px-3.5 py-2.5 text-right uppercase text-[10px] font-black text-slate-600">
                      Total Allocated:
                    </th>
                    <th className="px-3.5 py-2.5 text-right font-black text-slate-900 text-sm">
                      {formatCurrency(totalAllocated + customerAdvance)}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Notes / Audit Remarks
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Cleared via market visit by SR"
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Actions & Submit */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || (totalAllocated <= 0 && customerAdvance <= 0)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{submitProgress || 'Processing...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Settlement & Issue Receipt</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
