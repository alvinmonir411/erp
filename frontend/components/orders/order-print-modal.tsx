'use client';

import React, { useState, useRef } from 'react';
import { 
  Printer, X, FileText, CheckCircle2, 
  Store, Phone, MapPin, Calendar, 
  Building2, Sparkles, Plus, ArrowRight, 
  Copy, Check, UserCheck, ShieldCheck
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
  const totalQty = items.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0);
  const totalFree = items.reduce((sum: number, i: any) => sum + Number(i.freeQuantity || 0), 0);
  const grandTotal = Number(order.actualSoldAmount || order.grandTotal || 0);
  const paidAmount = Number(order.advancePaid || order.collectedAmount || 0);
  const dueAmount = order.dueAmount !== undefined && order.dueAmount !== null
    ? Number(order.dueAmount)
    : Math.max(0, grandTotal - paidAmount);
  const deliveryPersonName = order.assignedDeliveryMan?.name || order.deliveryPerson?.name;

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 print:p-0 print:bg-white print:static">
      {/* Dynamic Print CSS */}
      <style>{`
        @media print {
          /* Hide EVERYTHING in normal page */
          body * {
            visibility: hidden !important;
          }
          
          /* Only show our print canvas */
          #order-print-canvas, #order-print-canvas * {
            visibility: visible !important;
          }
          
          #order-print-canvas {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${printLayout === 'THERMAL' ? '80mm' : '100%'} !important;
            margin: 0 !important;
            padding: ${printLayout === 'THERMAL' ? '4mm' : '8mm'} !important;
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
            margin: ${printLayout === 'THERMAL' ? '2mm' : '8mm 10mm'};
          }
        }
      `}</style>

      {/* Main Modal Card */}
      <div className="w-full max-w-4xl bg-slate-100 sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col h-full sm:h-auto max-h-screen sm:max-h-[94vh] print:max-h-none print:h-auto print:border-none print:shadow-none print:bg-white">
        
        {/* Top Control Bar (Screen Only) */}
        <div className="no-print bg-slate-900 text-white px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight">
                  Invoice & Cash Memo
                </h2>
                <button
                  type="button"
                  onClick={handleCopyInvoiceNumber}
                  className="inline-flex items-center gap-1 text-[11px] font-bold bg-white/10 hover:bg-white/20 text-indigo-200 px-2 py-0.5 rounded-md transition-colors"
                  title="Click to copy invoice ID"
                >
                  <span>#{order.id.toString().padStart(6, '0')}</span>
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-300" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                {order.shop?.name || 'Direct Sale'} · {formatDate(order.createdAt || order.orderDate)}
              </p>
            </div>
          </div>

          {/* Controls: Layout Toggle, Print, Close */}
          <div className="flex items-center gap-2">
            {/* Paper Type Toggle */}
            <div className="hidden sm:inline-flex p-0.5 rounded-xl bg-slate-800 text-xs font-bold border border-slate-700">
              <button
                type="button"
                onClick={() => setPrintLayout('STANDARD')}
                className={`px-3 py-1 rounded-lg transition-all ${
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
                className={`px-3 py-1 rounded-lg transition-all ${
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Banner if opened right after cutting an order */}
        {isSuccessModal && (
          <div className="no-print bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center justify-between gap-3 text-emerald-900 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Order placed successfully! Ready for printing and distribution.</span>
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
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/70 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          
          {/* ========================================================================= */}
          {/* PRINTABLE CANVAS CONTAINER */}
          {/* ========================================================================= */}
          <div 
            id="order-print-canvas"
            className={`bg-white shadow-xl rounded-2xl text-slate-900 transition-all ${
              printLayout === 'THERMAL' 
                ? 'w-full max-w-[340px] p-4 text-xs' 
                : 'w-full max-w-3xl p-6 sm:p-8 text-sm'
            }`}
          >
            
            {/* ── 1. COMPANY HEADER ── */}
            <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900">
                M/S KARIM TRADERS
              </h1>
              <p className="text-xs font-bold text-slate-700 tracking-wider mt-0.5">
                মেসার্স করিম ট্রেডার্স · Authorized Wholesale Distributor & Dealer
              </p>
              <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                Proprietor: Md. Karim · Mobile: 01763-088369 · Ghorashal / Borodarga
              </p>
              <div className="inline-block mt-2 px-3 py-0.5 bg-slate-900 text-white rounded text-[11px] font-black uppercase tracking-widest">
                Sales Invoice / Cash Memo (বিক্রয় চালান ও ক্যাশ মেমো)
              </div>
            </div>

            {/* ── 2. INVOICE META & CUSTOMER DETAILS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 border border-slate-300 rounded-xl p-3 bg-slate-50/50 text-xs">
              {/* Customer Info */}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Billed To / Customer (ক্রেতার বিবরণ)
                </span>
                <p className="font-black text-slate-900 text-sm">
                  {order.shop?.name || 'Walk-in Direct Customer'}
                </p>
                {order.shop?.ownerName && (
                  <p className="text-slate-700">
                    Proprietor: <strong>{order.shop.ownerName}</strong>
                  </p>
                )}
                {order.shop?.phone && (
                  <p className="text-slate-700">
                    Phone: <strong>{order.shop.phone}</strong>
                  </p>
                )}
                {order.shop?.address && (
                  <p className="text-slate-600">
                    Address: {order.shop.address}
                  </p>
                )}
              </div>

              {/* Order Logistics Info */}
              <div className="space-y-1 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Invoice Info & Logistics (চালান তথ্য)
                </span>
                <p className="font-black text-slate-900 text-sm">
                  Invoice: #{order.id.toString().padStart(6, '0')}
                </p>
                <p className="text-slate-700">
                  Date: <strong>{formatDate(order.orderDate || order.createdAt)}</strong>
                </p>
                <p className="text-slate-700">
                  Route: <strong>{order.route?.name || 'Direct Route'}</strong>
                </p>
                {order.company?.name && (
                  <p className="text-slate-700">
                    Company: <strong>{order.company.name}</strong>
                  </p>
                )}
                <p className="text-[11px] text-slate-600">
                  Sales Rep (SR): <strong>{order.createdBy || 'Office'}</strong>
                  {deliveryPersonName && ` · Delivery: ${deliveryPersonName}`}
                </p>
              </div>
            </div>

            {/* ── 3. REMARKS NOTE IF ANY ── */}
            {order.note && (
              <div className="mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <strong className="font-bold">Remarks: </strong>
                <span>{order.note}</span>
              </div>
            )}

            {/* ── 4. ITEM TABLE ── */}
            <div className="mb-4">
              {!items || items.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 bg-slate-50 font-bold">
                  Manual Due Record / বকেয়া সমন্বয় চালান (No itemized physical products)
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-y-2 border-slate-800 text-[10px] font-black uppercase text-slate-800 tracking-wider">
                      <th className="py-2 px-2 text-center w-8 border-r border-slate-300">SL</th>
                      <th className="py-2 px-2.5">Item Description (পণ্যের বিবরণ)</th>
                      <th className="py-2 px-2 text-right border-l border-slate-300">Rate</th>
                      <th className="py-2 px-2 text-center border-l border-slate-300">Qty</th>
                      <th className="py-2 px-2 text-center border-l border-slate-300">Free</th>
                      <th className="py-2 px-2.5 text-right border-l border-slate-300">Amount (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item: any, idx: number) => {
                      const price = Number(item.unitPrice || 0);
                      const qPaid = Number(item.quantity || 0);
                      const qFree = Number(item.freeQuantity || 0);
                      const lineTotal = Number(item.lineTotal || (qPaid * price));

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-2 text-center font-bold text-slate-500 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-bold text-slate-900">
                            {item.product?.name || 'Product Item'}
                            {item.product?.sku && (
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                ({item.product.sku})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-slate-700 border-l border-slate-200">
                            {formatCurrency(price)}
                          </td>
                          <td className="py-2 px-2 text-center font-black text-slate-900 border-l border-slate-200">
                            {qPaid}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-emerald-700 border-l border-slate-200">
                            {qFree > 0 ? `+${qFree}` : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-black text-slate-900 border-l border-slate-200">
                            {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-800 bg-slate-50 font-black text-xs">
                      <td colSpan={3} className="py-2 px-2 text-right uppercase text-[10px] text-slate-600">
                        Total Quantity:
                      </td>
                      <td className="py-2 px-2 text-center font-black text-slate-900 border-l border-slate-300">
                        {totalQty}
                      </td>
                      <td className="py-2 px-2 text-center font-black text-emerald-700 border-l border-slate-300">
                        {totalFree > 0 ? `+${totalFree}` : '0'}
                      </td>
                      <td className="py-2 px-2.5 text-right font-black text-slate-900 border-l border-slate-300">
                        {formatCurrency(Number(order.subtotal || grandTotal))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* ── 5. FINANCIAL LEDGER & SUMMARY ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
              {/* Words/Terms Note */}
              <div className="w-full sm:flex-1 space-y-2 text-xs">
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] text-slate-600">
                  <p className="font-bold text-slate-800">শর্তাবলী / Terms:</p>
                  <p className="mt-0.5">১. বিক্রিত মাল ফেরত নেওয়া হয় না।</p>
                  <p>২. চালানের পণ্য বুঝিয়া গ্রহণ করার পর কোনো অভিযোগ গ্রহণযোগ্য হইবে না।</p>
                </div>
              </div>

              {/* Financial Box */}
              <div className="w-full sm:w-72 border-2 border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 font-black uppercase text-[10px] text-slate-700 text-center tracking-wider">
                  Payment Summary (হিসাব বিবরণী)
                </div>
                <div className="p-2.5 space-y-1.5 bg-white">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal (উপ-মোট):</span>
                    <span className="font-bold">{formatCurrency(Number(order.subtotal || grandTotal))}</span>
                  </div>

                  {Number(order.discountAmount) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount (ছাড়):</span>
                      <span className="font-bold">-{formatCurrency(Number(order.discountAmount))}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-black text-slate-900 text-sm border-t border-slate-200 pt-1">
                    <span>Net Total (মোট বিল):</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>

                  <div className="flex justify-between text-emerald-700 font-black border-t border-slate-200 pt-1">
                    <span>Cash Paid (নগদ গ্রহণ):</span>
                    <span>{formatCurrency(paidAmount)}</span>
                  </div>

                  <div className="flex justify-between text-rose-600 font-black text-sm border-t-2 border-slate-800 pt-1 bg-rose-50/50 -mx-2.5 -mb-2.5 p-2.5">
                    <span>Due Amount (বকেয়া):</span>
                    <span>{formatCurrency(dueAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 6. SIGNATURE STRIP ── */}
            <div className={`grid ${printLayout === 'THERMAL' ? 'grid-cols-2 gap-4 pt-6 mt-4' : 'grid-cols-3 gap-6 pt-10 mt-6'} border-t border-dashed border-slate-300 text-center text-xs`}>
              <div>
                <div className={`border-t border-slate-800 mx-auto ${printLayout === 'THERMAL' ? 'w-20' : 'w-28'} mb-1`}></div>
                <p className="font-bold text-slate-700 text-[10px]">ক্রেতার স্বাক্ষর</p>
                <p className="text-[9px] text-slate-400">Customer Signature</p>
              </div>
              {printLayout !== 'THERMAL' && (
                <div>
                  <div className="border-t border-slate-800 mx-auto w-28 mb-1"></div>
                  <p className="font-bold text-slate-700 text-[10px]">ডেলিভারি ম্যানের স্বাক্ষর</p>
                  <p className="text-[9px] text-slate-400">Delivery Staff</p>
                </div>
              )}
              <div>
                <div className={`border-t border-slate-800 mx-auto ${printLayout === 'THERMAL' ? 'w-20' : 'w-28'} mb-1`}></div>
                <p className="font-bold text-slate-700 text-[10px]">কর্তৃপক্ষের স্বাক্ষর</p>
                <p className="text-[9px] text-slate-400">Authorized Signature</p>
              </div>
            </div>

            {/* Micro footer */}
            <div className="mt-6 pt-2 border-t border-slate-100 text-center text-[9px] text-slate-400">
              Generated by ERP System · Thank you for doing business with M/S Karim Traders!
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar (Screen Only) */}
        <div className="no-print bg-white px-5 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {onNewOrder && (
              <button
                type="button"
                onClick={onNewOrder}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <Plus className="w-4 h-4" />
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
              <span>Print Now (Ctrl + P)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
