'use client';

import React from 'react';
import { 
  XCircle, 
  Printer, 
  CheckCircle2, 
  Building2, 
  Phone, 
  Calendar, 
  Receipt, 
  CreditCard,
  Copy,
  Check
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export interface MoneyReceiptData {
  receiptNo: string;
  date: string;
  shopName: string;
  ownerName?: string;
  phone?: string;
  routeName?: string;
  paymentMethod: 'CASH' | 'MFS' | 'BANK' | 'CHEQUE';
  paymentDetails?: {
    mfsProvider?: string;
    trxId?: string;
    senderPhone?: string;
    bankName?: string;
    accountRef?: string;
    chequeNo?: string;
    chequeDate?: string;
    maturityDate?: string;
  };
  invoices: Array<{
    orderId: number;
    allocatedAmount: number;
    remainingDue: number;
    originalDue: number;
  }>;
  totalCollected: number;
  advanceDeposit?: number;
  note?: string;
  collectedBy?: string;
}

interface MoneyReceiptModalProps {
  receipt: MoneyReceiptData;
  onClose: () => void;
}

export function MoneyReceiptModal({ receipt, onClose }: MoneyReceiptModalProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyReceiptNo = () => {
    navigator.clipboard.writeText(receipt.receiptNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'MFS':
        return { label: `MFS (${receipt.paymentDetails?.mfsProvider || 'bKash/Nagad'})`, cls: 'bg-pink-50 text-pink-700 border-pink-200' };
      case 'BANK':
        return { label: `Bank (${receipt.paymentDetails?.bankName || 'Transfer'})`, cls: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'CHEQUE':
        return { label: `Cheque (#${receipt.paymentDetails?.chequeNo || '—'})`, cls: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { label: 'Cash', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  };

  const methodBadge = getMethodBadge(receipt.paymentMethod);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 no-print">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-black text-slate-900">Official Money Receipt</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 printable-receipt">
          {/* Header */}
          <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Enterprise AR Subledger
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified Voucher
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">MONEY RECEIPT</h2>
              <p className="text-xs text-slate-500 font-medium">B2B Trade Collections & Due Settlement</p>
            </div>

            <div className="text-left sm:text-right">
              <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-slate-500">Receipt No:</span>
                <span className="text-xs font-black font-mono text-slate-900">{receipt.receiptNo}</span>
                <button
                  type="button"
                  onClick={handleCopyReceiptNo}
                  className="text-slate-400 hover:text-slate-600 transition-colors ml-1"
                  title="Copy Receipt Number"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1.5">
                Date: <span className="font-bold text-slate-700">{formatDate(receipt.date)}</span>
              </p>
            </div>
          </div>

          {/* Customer & Payment Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer / Shop</p>
              <p className="text-base font-black text-slate-900 mt-0.5">{receipt.shopName}</p>
              <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                {receipt.ownerName && <p>Owner: <span className="font-semibold text-slate-800">{receipt.ownerName}</span></p>}
                {receipt.phone && <p>Mobile: <span className="font-mono font-semibold text-slate-800">{receipt.phone}</span></p>}
                {receipt.routeName && <p>Route / Area: <span className="font-semibold text-slate-800">{receipt.routeName}</span></p>}
              </div>
            </div>

            <div className="sm:border-l sm:border-slate-200 sm:pl-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Payment Instrument</p>
              <div className="mt-1">
                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black border ${methodBadge.cls}`}>
                  {methodBadge.label}
                </span>
              </div>
              
              <div className="text-xs text-slate-600 mt-2 space-y-0.5">
                {receipt.paymentMethod === 'MFS' && (
                  <>
                    <p>Trx ID: <span className="font-mono font-bold text-slate-900">{receipt.paymentDetails?.trxId || '—'}</span></p>
                    {receipt.paymentDetails?.senderPhone && <p>Sender: <span className="font-mono text-slate-700">{receipt.paymentDetails?.senderPhone}</span></p>}
                  </>
                )}
                {receipt.paymentMethod === 'BANK' && (
                  <>
                    <p>Bank: <span className="font-bold text-slate-900">{receipt.paymentDetails?.bankName}</span></p>
                    <p>Ref / Slip: <span className="font-mono text-slate-700">{receipt.paymentDetails?.accountRef || '—'}</span></p>
                  </>
                )}
                {receipt.paymentMethod === 'CHEQUE' && (
                  <>
                    <p>Cheque #: <span className="font-mono font-bold text-slate-900">{receipt.paymentDetails?.chequeNo}</span></p>
                    <p>Bank: <span className="font-bold text-slate-800">{receipt.paymentDetails?.bankName || '—'}</span></p>
                    {receipt.paymentDetails?.maturityDate && <p>Maturity: <span className="font-semibold text-slate-800">{receipt.paymentDetails.maturityDate}</span></p>}
                  </>
                )}
                {receipt.collectedBy && <p>Collected By: <span className="font-semibold text-slate-800">{receipt.collectedBy}</span></p>}
              </div>
            </div>
          </div>

          {/* Allocation Table */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Invoice Settlement Allocation
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Order Invoice</th>
                    <th className="px-3.5 py-2.5 text-right">Original Due</th>
                    <th className="px-3.5 py-2.5 text-right">Payment Applied</th>
                    <th className="px-3.5 py-2.5 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipt.invoices.map((inv) => (
                    <tr key={inv.orderId} className="hover:bg-slate-50/50">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900">
                        Order #{inv.orderId}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-medium text-slate-600">
                        {formatCurrency(inv.originalDue)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-black text-emerald-600">
                        {formatCurrency(inv.allocatedAmount)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-slate-700">
                        {formatCurrency(Math.max(0, inv.remainingDue - inv.allocatedAmount))}
                      </td>
                    </tr>
                  ))}
                  {receipt.advanceDeposit && receipt.advanceDeposit > 0 ? (
                    <tr className="bg-indigo-50/50">
                      <td colSpan={2} className="px-3.5 py-2.5 font-black text-indigo-700">
                        Customer Advance Deposit
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-black text-indigo-700">
                        {formatCurrency(receipt.advanceDeposit)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-indigo-500 font-bold">—</td>
                    </tr>
                  ) : null}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <th colSpan={2} className="px-3.5 py-3 font-black text-slate-800 text-right uppercase text-[11px]">
                      Total Collected:
                    </th>
                    <th className="px-3.5 py-3 text-right font-black text-emerald-700 text-sm">
                      {formatCurrency(receipt.totalCollected)}
                    </th>
                    <th></th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes & Audit Memo */}
          {receipt.note && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              <span className="font-bold text-slate-800">Note: </span>
              {receipt.note}
            </div>
          )}

          {/* Verification Footer */}
          <div className="pt-4 border-t border-dashed border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <p>This is a computer-generated voucher pending final cashier ledger clearance.</p>
            <p className="font-mono">Verification: GATE3-AR-RECONCILED</p>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-md shadow-indigo-500/20"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
