'use client';

import React, { useState } from 'react';
import { 
  Printer, X, FileText, CheckCircle2, 
  Store, Phone, MapPin, Calendar, 
  Building2, Sparkles, Plus, ArrowRight, 
  Copy, Check, UserCheck, ShieldCheck, DollarSign
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
      if (e.key === 'Escape') {
        onClose();
      }
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
    setTimeout(() => setCopied(false), 2000);
  };

  const items = order.items || [];
  const isManualDue = order.status === 'MANUAL_DUE' || items.length === 0;
  const totalQty = items.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0);
  const totalFree = items.reduce((sum: number, i: any) => sum + Number(i.freeQuantity || 0), 0);
  const grandTotal = Number(order.actualSoldAmount || order.grandTotal || 0);
  const subtotal = Number(order.subtotal || grandTotal);
  const discountAmount = Number(order.discountAmount || 0);
  const paidAmount = Number(order.advancePaid || order.collectedAmount || 0);
  const dueAmount = order.dueAmount !== undefined && order.dueAmount !== null
    ? Number(order.dueAmount)
    : (order.status === 'SETTLED' ? 0 : Math.max(0, grandTotal - paidAmount));
  const deliveryPersonName = order.assignedDeliveryMan?.name || order.deliveryPerson?.name;

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200 print:p-0 print:bg-white print:static">
      {/* Dynamic Print CSS */}
      <style>{`
        @media print {
          /* Hide EVERYTHING else on page */
          body * {
            visibility: hidden !important;
          }
          
          /* Only display our printable canvas */
          #order-print-canvas, #order-print-canvas * {
            visibility: visible !important;
          }
          
          #order-print-canvas {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${printLayout === 'THERMAL' ? '80mm' : '100%'} !important;
            margin: 0 !important;
            padding: ${printLayout === 'THERMAL' ? '4mm' : '6mm'} !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print {
            display: none !important;
          }

          @page {
            size: ${printLayout === 'THERMAL' ? '80mm auto' : 'portrait'};
            margin: ${printLayout === 'THERMAL' ? '2mm' : '6mm 8mm'};
          }
        }
      `}</style>

      {/* Main Modal Card */}
      <div className="w-full max-w-4xl bg-slate-100 sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col h-full sm:h-[94vh] max-h-screen print:max-h-none print:h-auto print:border-none print:shadow-none print:bg-white">
        
        {/* Top Control Bar (Screen Only - Always visible) */}
        <div className="no-print bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-2 shrink-0 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30 shrink-0">
              <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-base font-black tracking-tight truncate">
                  Sales Invoice & Cash Memo
                </h2>
                <button
                  type="button"
                  onClick={handleCopyInvoiceNumber}
                  className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold bg-white/10 hover:bg-white/20 text-indigo-200 px-2 py-0.5 rounded transition-colors"
                  title="Click to copy invoice ID"
                >
                  <span>#{order.id.toString().padStart(6, '0')}</span>
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-300" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {order.shop?.name || 'Direct Sale'} · {formatDate(order.orderDate || order.createdAt)}
              </p>
            </div>
          </div>

          {/* Controls: Layout Toggle, Print, Close */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Paper Type Toggle */}
            <div className="inline-flex p-0.5 rounded-xl bg-slate-800 text-[10px] sm:text-xs font-bold border border-slate-700">
              <button
                type="button"
                onClick={() => setPrintLayout('STANDARD')}
                className={`px-2 sm:px-3 py-1 rounded-lg transition-all ${
                  printLayout === 'STANDARD'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                A4 / A5 Memo
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('THERMAL')}
                className={`px-2 sm:px-3 py-1 rounded-lg transition-all ${
                  printLayout === 'THERMAL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                POS Slip (80mm)
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
              title="Close"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Success Banner if opened right after cutting an order */}
        {isSuccessModal && (
          <div className="no-print bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 text-emerald-900 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Order saved successfully! Ready for printing and distribution.</span>
            </div>
            {onNewOrder && (
              <button
                type="button"
                onClick={onNewOrder}
                className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-300 rounded-lg px-2.5 py-1 hover:bg-emerald-100 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Order</span>
              </button>
            )}
          </div>
        )}

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-6 bg-slate-200/80 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          
          {/* ========================================================================= */}
          {/* PRINTABLE CANVAS CONTAINER */}
          {/* ========================================================================= */}
          <div 
            id="order-print-canvas"
            className={`bg-white shadow-xl rounded-2xl text-slate-900 transition-all ${
              printLayout === 'THERMAL' 
                ? 'w-full max-w-[360px] p-3.5 text-xs' 
                : 'w-full max-w-3xl p-4 sm:p-8 text-xs sm:text-sm'
            }`}
          >
            
            {/* ── 1. COMPANY HEADER ── */}
            <div className="text-center border-b-2 border-slate-900 pb-3 mb-3">
              <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 leading-none">
                M/S KARIM TRADERS
              </h1>
              <p className="text-xs font-bold text-slate-700 tracking-wider mt-1 uppercase">
                Authorized Wholesale Distributor & Dealer
              </p>
              <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                Proprietor: Md. Karim · Mobile: 01763-088369 · Ghorashal / Borodarga
              </p>
              <div className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white rounded text-[11px] font-black uppercase tracking-widest">
                SALES INVOICE / CASH MEMO
              </div>
            </div>

            {/* ── 2. INVOICE META & CUSTOMER DETAILS ── */}
            <div className="border border-slate-800 rounded-xl overflow-hidden mb-3 text-xs bg-white">
              {/* Top Banner Row */}
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 flex items-center justify-between font-bold text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 uppercase text-[10px]">Invoice No:</span>
                  <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                    #{order.id.toString().padStart(6, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[10px]">Date:</span>
                  <span className="font-bold text-slate-800">
                    {formatDate(order.orderDate || order.createdAt)}
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Left: Customer Info */}
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Billed To (Customer Details):
                  </p>
                  <p className="font-black text-slate-900 text-sm">
                    {order.shop?.name || 'Walk-in Direct Customer'}
                  </p>
                  {order.shop?.ownerName && (
                    <p className="text-slate-700 text-[11px]">
                      Owner: <strong>{order.shop.ownerName}</strong>
                    </p>
                  )}
                  {order.shop?.phone && (
                    <p className="text-slate-700 text-[11px]">
                      Phone: <strong>{order.shop.phone}</strong>
                    </p>
                  )}
                  {order.shop?.address && (
                    <p className="text-slate-500 text-[10px] leading-tight">
                      Address: {order.shop.address}
                    </p>
                  )}
                </div>

                {/* Right: Logistics Info */}
                <div className="space-y-0.5 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Logistics & Order Info:
                  </p>
                  <p className="text-slate-800 text-[11px]">
                    Route: <strong>{order.route?.name || 'Direct Route'}</strong>
                  </p>
                  {order.company?.name && (
                    <p className="text-slate-800 text-[11px]">
                      Company: <strong>{order.company.name}</strong>
                    </p>
                  )}
                  <p className="text-slate-600 text-[10px]">
                    Sales Rep (SR): <strong>{order.createdBy || 'Office'}</strong>
                  </p>
                  {deliveryPersonName && (
                    <p className="text-slate-600 text-[10px]">
                      Delivery Staff: <strong>{deliveryPersonName}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── 3. PARTICULARS / PRODUCT ITEMS TABLE ── */}
            <div className="mb-4">
              <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-800 text-[10px] sm:text-[11px] font-black uppercase text-slate-800 tracking-wider">
                    <th className="py-2 px-1.5 text-center w-8 border-r border-slate-300">SL</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Item Description / Particulars</th>
                    <th className="py-2 px-2 text-right w-16 border-r border-slate-300">Rate</th>
                    <th className="py-2 px-2 text-center w-12 border-r border-slate-300">Qty</th>
                    <th className="py-2 px-1.5 text-center w-12 border-r border-slate-300">Free</th>
                    <th className="py-2 px-2.5 text-right w-24">Amount (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {isManualDue ? (
                    /* Clean official line item for Manual Due Record */
                    <tr className="bg-rose-50/20">
                      <td className="py-3 px-1.5 text-center font-bold text-slate-500 border-r border-slate-200">
                        1
                      </td>
                      <td className="py-3 px-2.5 border-r border-slate-200">
                        <p className="font-black text-slate-900 text-xs sm:text-sm">
                          Manual Due Settlement Record (Direct Due Entry)
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Direct Opening / Previous Due Balance Record (No physical goods attached)
                        </p>
                        {order.note && (
                          <div className="mt-1.5 p-1.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold leading-relaxed">
                            <strong>Remarks:</strong> {order.note}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-slate-700 border-r border-slate-200 font-mono">
                        {formatCurrency(grandTotal)}
                      </td>
                      <td className="py-3 px-2 text-center font-black text-slate-800 border-r border-slate-200">
                        1
                      </td>
                      <td className="py-3 px-1.5 text-center font-bold text-slate-400 border-r border-slate-200">
                        —
                      </td>
                      <td className="py-3 px-2.5 text-right font-black text-slate-900 text-sm font-mono">
                        {formatCurrency(grandTotal)}
                      </td>
                    </tr>
                  ) : (
                    /* Regular physical product items */
                    items.map((item: any, idx: number) => {
                      const price = Number(item.unitPrice || 0);
                      const qPaid = Number(item.quantity || 0);
                      const qFree = Number(item.freeQuantity || 0);
                      const lineTotal = Number(item.lineTotal || (qPaid * price));

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-1.5 text-center font-bold text-slate-500 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-bold text-slate-900 border-r border-slate-200">
                            <span>{item.product?.name || 'Product Item'}</span>
                            {item.product?.sku && (
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                ({item.product.sku})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-slate-700 border-r border-slate-200 font-mono">
                            {formatCurrency(price)}
                          </td>
                          <td className="py-2 px-2 text-center font-black text-slate-900 border-r border-slate-200 font-mono">
                            {qPaid}
                          </td>
                          <td className="py-2 px-1.5 text-center font-bold text-emerald-700 border-r border-slate-200 font-mono">
                            {qFree > 0 ? `+${qFree}` : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-black text-slate-900 border-slate-200 font-mono">
                            {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-800 bg-slate-50 font-black text-xs">
                    <td colSpan={3} className="py-2 px-2 text-right uppercase text-[10px] text-slate-600 border-r border-slate-300">
                      Total Quantity:
                    </td>
                    <td className="py-2 px-2 text-center font-black text-slate-900 border-r border-slate-300 font-mono">
                      {isManualDue ? '1' : totalQty}
                    </td>
                    <td className="py-2 px-1.5 text-center font-black text-emerald-700 border-r border-slate-300 font-mono">
                      {isManualDue ? '0' : (totalFree > 0 ? `+${totalFree}` : '0')}
                    </td>
                    <td className="py-2 px-2.5 text-right font-black text-slate-900 font-mono text-sm">
                      {formatCurrency(subtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Remarks box if normal order with note */}
            {!isManualDue && order.note && (
              <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <strong className="font-bold">Remarks: </strong>
                <span>{order.note}</span>
              </div>
            )}

            {/* ── 4. FINANCIAL LEDGER & SUMMARY ── */}
            <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-start gap-3 mb-4">
              {/* Payment Summary Box */}
              <div className="w-full sm:w-80 ml-auto border-2 border-slate-900 rounded-xl overflow-hidden text-xs bg-white shadow-2xs">
                <div className="bg-slate-900 text-white px-3 py-1.5 font-black uppercase text-[10px] tracking-wider text-center">
                  PAYMENT SUMMARY
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="whitespace-nowrap">Subtotal:</span>
                    <span className="font-bold font-mono text-slate-900">{formatCurrency(subtotal)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex items-center justify-between text-rose-600">
                      <span className="whitespace-nowrap">Discount:</span>
                      <span className="font-bold font-mono">-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between font-black text-slate-900 text-sm border-t border-slate-200 pt-1.5">
                    <span className="whitespace-nowrap">Net Invoice Total:</span>
                    <span className="font-mono">{formatCurrency(grandTotal)}</span>
                  </div>

                  <div className="flex items-center justify-between text-emerald-700 font-bold border-t border-slate-200 pt-1.5">
                    <span className="whitespace-nowrap">Cash Received (Paid):</span>
                    <span className="font-mono font-black">{formatCurrency(paidAmount)}</span>
                  </div>

                  <div className="flex items-center justify-between text-rose-700 font-black text-sm border-t-2 border-slate-900 pt-1.5 bg-rose-50 -mx-3 -mb-3 p-3">
                    <span className="whitespace-nowrap">Remaining Due Amount:</span>
                    <span className="font-mono text-base">{formatCurrency(dueAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 5. TERMS AND CONDITIONS (Full width underneath) ── */}
            <div className="mb-4 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[10px] text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-800">Terms & Conditions:</p>
              <p className="mt-0.5">1. Goods once sold will not be returned or exchanged.</p>
              <p>2. Please verify all quantities upon delivery. Outstanding dues must be settled promptly.</p>
            </div>

            {/* ── 6. SIGNATURE STRIP ── */}
            <div className={`grid ${printLayout === 'THERMAL' ? 'grid-cols-2 gap-4 pt-6 mt-4' : 'grid-cols-3 gap-4 pt-8 mt-4'} border-t border-dashed border-slate-300 text-center text-xs`}>
              <div>
                <div className="border-t border-slate-800 mx-auto w-24 sm:w-28 mb-1"></div>
                <p className="font-bold text-slate-800 text-[10px]">Customer Signature</p>
                <p className="text-[9px] text-slate-400">Received By</p>
              </div>
              {printLayout !== 'THERMAL' && (
                <div>
                  <div className="border-t border-slate-800 mx-auto w-24 sm:w-28 mb-1"></div>
                  <p className="font-bold text-slate-800 text-[10px]">Delivery Staff</p>
                  <p className="text-[9px] text-slate-400">Delivered By</p>
                </div>
              )}
              <div>
                <div className="border-t border-slate-800 mx-auto w-24 sm:w-28 mb-1"></div>
                <p className="font-bold text-slate-800 text-[10px]">Authorized Signature</p>
                <p className="text-[9px] text-slate-400">Management</p>
              </div>
            </div>

            {/* Micro footer */}
            <div className="mt-4 pt-2 border-t border-slate-100 text-center text-[9px] text-slate-400">
              Generated by ERP System · Thank you for doing business with M/S Karim Traders!
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar (Screen Only - Always Visible on Mobile) */}
        <div className="no-print bg-white px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="flex items-center gap-2">
            {onNewOrder && (
              <button
                type="button"
                onClick={onNewOrder}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Order</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice (Ctrl + P)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
