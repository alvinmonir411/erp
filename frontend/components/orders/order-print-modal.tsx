'use client';

import React, { useState } from 'react';
import { 
  Printer, X, Copy, Check, Plus
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface OrderPrintModalProps {
  order: any;
  onClose: () => void;
  onNewOrder?: () => void;
  isSuccessModal?: boolean;
}

export function OrderPrintModal({
  order,
  onClose,
  onNewOrder,
  isSuccessModal = false,
}: OrderPrintModalProps) {
  const [printLayout, setPrintLayout] = useState<'STANDARD' | 'THERMAL'>('STANDARD');
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyInvoiceNumber = () => {
    const invNo = `#${order.id.toString().padStart(6, '0')}`;
    navigator.clipboard.writeText(invNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const items = order.items || [];
  const isManualDue = order.status === 'MANUAL_DUE' || items.length === 0;
  const totalQty = items.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0);
  const grandTotal = Number(order.actualSoldAmount || order.grandTotal || 0);
  const subtotal = Number(order.subtotal || grandTotal);
  const discountAmount = Number(order.discountAmount || 0);
  const paidAmount = Number(order.advancePaid || order.collectedAmount || 0);
  const dueAmount = order.dueAmount !== undefined && order.dueAmount !== null
    ? Number(order.dueAmount)
    : (order.status === 'SETTLED' ? 0 : Math.max(0, grandTotal - paidAmount));

  // Compact amount formatter for table columns (e.g. "3,798")
  const formatAmount = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: Math.abs(num % 1) >= 0.01 ? 2 : 0,
      maximumFractionDigits: 2,
    });
  };

  const cleanedNote = order.note ? order.note.replace(/^Manual due:\s*/i, '').trim() : '';

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150 print:p-0 print:bg-white print:static">
      {/* Dynamic Print CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #order-print-canvas, #order-print-canvas * {
            visibility: visible !important;
          }
          #order-print-canvas {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${printLayout === 'THERMAL' ? '72mm' : '100%'} !important;
            max-width: ${printLayout === 'THERMAL' ? '72mm' : '130mm'} !important;
            margin: 0 auto !important;
            padding: 2mm 3mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: ${printLayout === 'THERMAL' ? '80mm auto' : 'auto'};
            margin: ${printLayout === 'THERMAL' ? '1mm' : '5mm 6mm'};
          }
        }
      `}</style>

      {/* Main Modal Card */}
      <div className="w-full max-w-sm sm:max-w-md bg-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col max-h-[96vh] print:max-h-none print:h-auto print:border-none print:shadow-none print:bg-white">
        
        {/* Top Control Bar */}
        <div className="no-print bg-slate-900 text-white px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-bold truncate">Cash Memo</h2>
            <button
              type="button"
              onClick={handleCopyInvoiceNumber}
              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-white/10 hover:bg-white/20 text-slate-200 px-2 py-0.5 rounded transition-colors"
              title="Copy invoice number"
            >
              <span>#{order.id.toString().padStart(6, '0')}</span>
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Paper Size Toggle */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-800 text-[10px] font-bold border border-slate-700">
              <button
                type="button"
                onClick={() => setPrintLayout('STANDARD')}
                className={`px-2 py-0.5 rounded transition-all ${
                  printLayout === 'STANDARD' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('THERMAL')}
                className={`px-2 py-0.5 rounded transition-all ${
                  printLayout === 'THERMAL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                POS (80mm)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Canvas Preview Area */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 bg-slate-200/80 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          
          {/* ========================================================================= */}
          {/* ULTRA-COMPACT & CLUTTER-FREE PRINT CANVAS */}
          {/* ========================================================================= */}
          <div 
            id="order-print-canvas"
            className="w-full max-w-[390px] bg-white shadow-md rounded-xl p-3 sm:p-4 text-slate-900 transition-all text-[11px] leading-tight"
          >
            
            {/* 1. COMPACT HEADER */}
            <div className="text-center border-b border-slate-800 pb-1.5 mb-2">
              <h1 className="text-base font-black uppercase tracking-wide text-slate-900 leading-tight">
                M/S KARIM TRADERS
              </h1>
              <p className="text-[10px] text-slate-500 font-medium">
                Ghorashal / Borodarga · Mob: 01763-088369
              </p>
              <span className="inline-block px-2 py-0.5 mt-1 bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider rounded">
                Cash Memo
              </span>
            </div>

            {/* 2. COMPACT CUSTOMER & INVOICE DETAILS */}
            <div className="border border-slate-300 rounded-md p-2 mb-2 text-[10.5px] leading-snug bg-slate-50/50 space-y-1">
              <div className="flex items-center justify-between">
                <span>Invoice: <strong className="font-mono text-slate-900 font-bold">#{order.id.toString().padStart(6, '0')}</strong></span>
                <span className="text-slate-600">Date: {formatDate(order.orderDate || order.createdAt)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 flex items-center justify-between">
                <span className="truncate">Customer: <strong className="text-slate-900 font-bold">{order.shop?.name || 'Direct Customer'}</strong></span>
                {order.shop?.phone && (
                  <span className="text-slate-600 font-mono text-[10px] shrink-0 ml-2">{order.shop.phone}</span>
                )}
              </div>
              {(order.route?.name || order.shop?.address) && (
                <div className="text-[10px] text-slate-500 truncate pt-0.5 border-t border-slate-100">
                  {order.route?.name && <span>Route: {order.route.name}</span>}
                  {order.route?.name && order.shop?.address && <span> · </span>}
                  {order.shop?.address && <span>{order.shop.address}</span>}
                </div>
              )}
            </div>

            {/* 3. COMPACT ITEMS TABLE */}
            <table className="w-full text-left text-[10.5px] border border-slate-400 border-collapse mb-2">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-400 text-[9.5px] font-black uppercase text-slate-700">
                  <th className="py-1 px-1 text-center w-6 border-r border-slate-300">#</th>
                  <th className="py-1 px-1.5 border-r border-slate-300">Description</th>
                  <th className="py-1 px-1 text-center w-10 border-r border-slate-300">Qty</th>
                  <th className="py-1 px-1 text-right w-12 border-r border-slate-300">Rate</th>
                  <th className="py-1 px-1 text-right w-14">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isManualDue ? (
                  /* Compact single line item for Manual Due Record */
                  <tr>
                    <td className="py-1 px-1 text-center font-bold text-slate-400 border-r border-slate-200">1</td>
                    <td className="py-1 px-1.5 border-r border-slate-200">
                      <p className="font-bold text-slate-900">Due Balance Settlement</p>
                      {cleanedNote && (
                        <p className="text-[9.5px] text-amber-900 font-medium leading-tight mt-0.5">
                          Note: {cleanedNote}
                        </p>
                      )}
                    </td>
                    <td className="py-1 px-1 text-center font-bold border-r border-slate-200">1</td>
                    <td className="py-1 px-1 text-right font-mono border-r border-slate-200">{formatAmount(grandTotal)}</td>
                    <td className="py-1 px-1 text-right font-mono font-bold text-slate-900">{formatAmount(grandTotal)}</td>
                  </tr>
                ) : (
                  items.map((item: any, idx: number) => {
                    const price = Number(item.unitPrice || 0);
                    const qPaid = Number(item.quantity || 0);
                    const qFree = Number(item.freeQuantity || 0);
                    const lineTotal = Number(item.lineTotal || (qPaid * price));

                    return (
                      <tr key={idx}>
                        <td className="py-1 px-1 text-center text-slate-400 border-r border-slate-200">{idx + 1}</td>
                        <td className="py-1 px-1.5 font-bold text-slate-900 border-r border-slate-200 truncate max-w-[140px]">
                          {item.product?.name || 'Item'}
                          {item.product?.sku && <span className="text-[9px] text-slate-400 font-normal ml-1">({item.product.sku})</span>}
                        </td>
                        <td className="py-1 px-1 text-center font-mono border-r border-slate-200">
                          {qPaid}{qFree > 0 && <span className="text-emerald-600 font-bold ml-0.5">+{qFree}f</span>}
                        </td>
                        <td className="py-1 px-1 text-right font-mono text-slate-600 border-r border-slate-200">{formatAmount(price)}</td>
                        <td className="py-1 px-1 text-right font-mono font-bold text-slate-900">{formatAmount(lineTotal)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-400 bg-slate-50 font-bold text-[9.5px]">
                  <td colSpan={2} className="py-1 px-1.5 text-right uppercase text-slate-500 border-r border-slate-300">
                    Total Qty:
                  </td>
                  <td className="py-1 px-1 text-center font-mono text-slate-900 border-r border-slate-300">
                    {isManualDue ? '1' : totalQty}
                  </td>
                  <td colSpan={2} className="py-1 px-1 text-right font-mono text-slate-900">
                    {formatCurrency(subtotal)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Note for regular orders (if any) */}
            {!isManualDue && cleanedNote && (
              <div className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded p-1 mb-2 leading-tight">
                <span className="font-bold text-slate-700">Note: </span>{cleanedNote}
              </div>
            )}

            {/* 4. COMPACT FINANCIAL SUMMARY */}
            <div className="border border-slate-300 rounded-md overflow-hidden mb-2 text-[10.5px] bg-white">
              <div className="p-2 space-y-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(subtotal)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-rose-600 font-medium">
                    <span>Discount:</span>
                    <span className="font-mono font-bold">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
                  <span>Net Total:</span>
                  <span className="font-mono">{formatCurrency(grandTotal)}</span>
                </div>

                <div className="flex items-center justify-between text-emerald-700 font-bold border-t border-slate-200 pt-1">
                  <span>Paid Amount:</span>
                  <span className="font-mono">{formatCurrency(paidAmount)}</span>
                </div>

                <div className="flex items-center justify-between text-rose-700 font-black border-t-2 border-slate-900 pt-1 bg-rose-50/80 -mx-2 -mb-2 p-1.5">
                  <span>Remaining Due:</span>
                  <span className="font-mono text-xs">{formatCurrency(dueAmount)}</span>
                </div>
              </div>
            </div>

            {/* 5. MINIMAL SIGNATURES */}
            <div className="grid grid-cols-2 gap-4 pt-5 pb-1 text-center text-[9.5px]">
              <div>
                <div className="border-t border-slate-700 mx-auto w-20 mb-1"></div>
                <p className="font-bold text-slate-600 uppercase tracking-wider">Customer Signature</p>
              </div>
              <div>
                <div className="border-t border-slate-700 mx-auto w-20 mb-1"></div>
                <p className="font-bold text-slate-600 uppercase tracking-wider">Authorized Signature</p>
              </div>
            </div>

            <div className="text-center text-[8.5px] text-slate-400 mt-2 font-medium">
              Thank you for your business!
            </div>

          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="no-print bg-white px-3 sm:px-4 py-2.5 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {onNewOrder && (
              <button
                type="button"
                onClick={onNewOrder}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>
        </div>

      </div>
    </div>
  );
}
