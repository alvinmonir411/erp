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
  HelpCircle,
  MapPin
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
    address?: string;
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
        const dateA = a.dueDate || a.order?.orderDate || a.createdAt || '';
        const dateB = b.dueDate || b.order?.orderDate || b.createdAt || '';
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        
        {/* Mobile Pull Indicator */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-200 flex items-start justify-between bg-slate-50/80 gap-2 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  Collect Payment
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  FIFO Settlement
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-1">
                <p className="text-xs text-slate-700 font-bold truncate">
                  Customer: <span className="text-slate-900 font-black">{shop.name}</span>
                  {shop.route?.name && <span className="text-slate-500 font-normal"> · Route: {shop.route.name}</span>}
                </p>
                {shop.address && (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                    <span className="truncate">{shop.address}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="h-8 w-8 rounded-full bg-slate-200/70 hover:bg-slate-300 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors shrink-0"
            title="Close"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          
          {/* Hero Received Amount Card */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Received Amount *</span>
              </label>
              {customerAdvance > 0 ? (
                <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded-md">
                  +{formatCurrency(customerAdvance)} Advance
                </span>
              ) : (
                <span className="text-[11px] text-slate-300">
                  Total Due: <strong className="text-rose-400 font-black">{formatCurrency(totalOutstanding)}</strong>
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl sm:text-2xl font-black text-indigo-300">
                ৳
              </span>
              <input
                type="number"
                step="0.01"
                required
                value={totalAmount}
                onChange={(e) => {
                  setTotalAmount(e.target.value);
                  setManualOverride(false);
                }}
                className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 text-2xl sm:text-3xl font-black rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white/15 tracking-tight"
                placeholder="0.00"
                autoFocus
              />
            </div>

            {/* Quick Preset Buttons */}
            {totalOutstanding > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Quick:</span>
                <button
                  type="button"
                  onClick={handleFillFull}
                  className="px-2.5 py-1 text-xs font-black bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400/40 text-indigo-100 rounded-lg transition-all"
                >
                  ⚡ Pay Full Due ({formatCurrency(totalOutstanding)})
                </button>
                {totalOutstanding > 2000 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTotalAmount(String(Math.round(totalOutstanding / 2)));
                      setManualOverride(false);
                    }}
                    className="px-2.5 py-1 text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 rounded-lg transition-all"
                  >
                    50%
                  </button>
                )}
                {totalOutstanding > 1000 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTotalAmount('1000');
                      setManualOverride(false);
                    }}
                    className="px-2.5 py-1 text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 rounded-lg transition-all"
                  >
                    ৳ 1,000
                  </button>
                )}
                {totalOutstanding > 5000 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTotalAmount('5000');
                      setManualOverride(false);
                    }}
                    className="px-2.5 py-1 text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 rounded-lg transition-all"
                  >
                    ৳ 5,000
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Collection Date Row */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
              <span>Collection Date *</span>
              <span className="text-[11px] text-slate-400 font-normal">Defaults to today</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                required
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800 shadow-2xs"
              />
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
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-black transition-all ${
                  paymentMethod === 'CASH'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('MFS')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-black transition-all ${
                  paymentMethod === 'MFS'
                    ? 'border-pink-500 bg-pink-50 text-pink-800 shadow-xs ring-1 ring-pink-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Smartphone className="w-4 h-4 text-pink-600" />
                <span>MFS Mobile</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('BANK')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-black transition-all ${
                  paymentMethod === 'BANK'
                    ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Landmark className="w-4 h-4 text-blue-600" />
                <span>Bank</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CHEQUE')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-black transition-all ${
                  paymentMethod === 'CHEQUE'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-xs ring-1 ring-amber-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <FileCheck2 className="w-4 h-4 text-amber-600" />
                <span>Cheque</span>
              </button>
            </div>
          </div>

          {/* Dynamic Method Details */}
          {paymentMethod === 'MFS' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 bg-pink-50/50 rounded-2xl border border-pink-200 animate-in fade-in">
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
                <label className="text-[11px] font-bold text-slate-700">TrxID *</label>
                <input
                  type="text"
                  required
                  value={mfsTrxId}
                  onChange={(e) => setMfsTrxId(e.target.value)}
                  placeholder="e.g. 9J2K8L9M"
                  className="w-full px-3 py-2 text-xs border border-pink-300 rounded-xl bg-white font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Sender Phone (Optional)</label>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 bg-blue-50/50 rounded-2xl border border-blue-200 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Dutch-Bangla Bank"
                  className="w-full px-3 py-2 text-xs border border-blue-300 rounded-xl bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Slip / Ref # (Optional)</label>
                <input
                  type="text"
                  value={bankAccountRef}
                  onChange={(e) => setBankAccountRef(e.target.value)}
                  placeholder="e.g. SLIP-98421"
                  className="w-full px-3 py-2 text-xs border border-blue-300 rounded-xl bg-white font-mono"
                />
              </div>
            </div>
          )}

          {paymentMethod === 'CHEQUE' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Cheque # *</label>
                <input
                  type="text"
                  required
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  placeholder="e.g. CHQ-55019"
                  className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl bg-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Bank Name</label>
                <input
                  type="text"
                  value={chequeBank}
                  onChange={(e) => setChequeBank(e.target.value)}
                  placeholder="e.g. Islami Bank"
                  className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Maturity Date</label>
                <input
                  type="date"
                  value={chequeMaturityDate}
                  onChange={(e) => setChequeMaturityDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl bg-white"
                />
              </div>
            </div>
          )}

          {/* Allocation Breakdown Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Invoice Allocation Breakdown
                </label>
                {manualOverride ? (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                    Manual Custom
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                    Automated FIFO
                  </span>
                )}
              </div>

              {manualOverride && (
                <button
                  type="button"
                  onClick={handleResetToFifo}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset to FIFO</span>
                </button>
              )}
            </div>

            {/* Mobile View: Clean Card List (Solves Table Overflow) */}
            <div className="sm:hidden space-y-2">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1" />
                  <p className="text-xs font-bold">Loading invoices...</p>
                </div>
              ) : openDues.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-slate-200">
                  No outstanding dues found for this customer.
                </div>
              ) : (
                openDues.map((d: any) => {
                  const allocated = calculatedAllocations[d.orderId] || 0;
                  const isFull = allocated >= Number(d.remainingDue);
                  const isPartial = allocated > 0 && !isFull;
                  return (
                    <div 
                      key={d.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        allocated > 0 
                          ? 'bg-indigo-50/40 border-indigo-300 shadow-2xs' 
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-900 text-xs">Order #{d.orderId}</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {formatDate(d.dueDate || d.order?.orderDate || d.createdAt)}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Orig: {formatCurrency(d.dueAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Due Balance</span>
                          <span className="font-black text-rose-600 text-xs">
                            {formatCurrency(d.remainingDue)}
                          </span>
                        </div>
                      </div>

                      {/* Pay Input & Badge */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-600">Allocate:</span>
                          {isFull && (
                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                              Full Settle
                            </span>
                          )}
                          {isPartial && (
                            <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                              Partial
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                            <input
                              type="number"
                              step="0.01"
                              max={Number(d.remainingDue)}
                              value={allocated || ''}
                              onChange={(e) => handleCustomAllocationChange(d.orderId, e.target.value)}
                              placeholder="0.00"
                              className={`w-28 pl-6 pr-2 py-1 text-right text-xs font-black border rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                allocated > 0
                                  ? 'border-indigo-400 bg-white text-indigo-900 font-black'
                                  : 'border-slate-200 bg-slate-50 text-slate-500'
                              }`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCustomAllocationChange(d.orderId, String(d.remainingDue))}
                            className="px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shrink-0"
                          >
                            Full
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {customerAdvance > 0 && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-black text-emerald-900 text-xs flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Advance Credit Deposit
                    </span>
                    <p className="text-[10px] text-emerald-700 mt-0.5">
                      Surplus tagged as customer advance
                    </p>
                  </div>
                  <span className="font-black text-emerald-700 text-xs shrink-0">
                    +{formatCurrency(customerAdvance)}
                  </span>
                </div>
              )}
            </div>

            {/* Desktop View: High-density Table */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200">
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
                              {formatDate(d.dueDate || d.order?.orderDate || d.createdAt)}
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
                        <span className="font-black text-emerald-800 text-xs flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
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

          {/* Notes / Audit Remarks */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Notes / Audit Remarks (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Cleared via market visit by SR"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
            />
          </div>
        </form>

        {/* Sticky Bottom Actions Bar (Guaranteed visibility on mobile) */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shadow-lg shrink-0">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
              Total Settle
            </span>
            <p className="text-sm sm:text-lg font-black text-slate-900 leading-tight">
              {formatCurrency(totalAllocated + customerAdvance)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 sm:px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit as any}
              disabled={isSubmitting || (totalAllocated <= 0 && customerAdvance <= 0)}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black transition-all shadow-md shadow-indigo-500/25 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">{submitProgress || 'Processing...'}</span>
                  <span className="sm:hidden">Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Receipt</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
