'use client';

import React, { useState } from 'react';
import { 
  Printer, X, Copy, Check, Plus, Receipt, FileText
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface OrderPrintModalProps {
  order: any;
  onClose: () => void;
  onNewOrder?: () => void;
  isSuccessModal?: boolean;
  initialLayout?: 'POS' | 'A4';
}

export function OrderPrintModal({
  order,
  onClose,
  onNewOrder,
  isSuccessModal = false,
  initialLayout = 'POS',
}: OrderPrintModalProps) {
  // 2 Options: 'POS' (POS System) and 'A4' (A4 Page)
  const [printLayout, setPrintLayout] = useState<'POS' | 'A4'>(initialLayout);
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

  // Check if order has delivery returns or post-delivery settlement
  const hasDeliveryReturns = items.some(
    (i: any) => Number(i.returnedPaidQuantity || 0) > 0 || Number(i.damagedPaidQuantity || 0) > 0
  );
  const isDeliveredStatus = ['PARTIALLY_DELIVERED', 'DELIVERED', 'SETTLED', 'PARTIAL_DUE'].includes(order.status);
  const isDeliveredOrder = isDeliveredStatus || hasDeliveryReturns;

  // Map item rows to actual delivered quantities when delivery has occurred
  const allItemRows = items.map((item: any) => {
    const isItemSettled = isDeliveredOrder && item.deliveredPaidQuantity !== undefined && item.deliveredPaidQuantity !== null;
    const qPaid = isItemSettled ? Number(item.deliveredPaidQuantity || 0) : Number(item.quantity || 0);
    const qFree = isItemSettled ? Number(item.deliveredFreeQuantity || 0) : Number(item.freeQuantity || 0);
    const price = Number(item.unitPrice || 0);
    const lineTotal = Number(qPaid * price);

    return {
      ...item,
      qPaid,
      qFree,
      price,
      lineTotal,
    };
  });

  // Filter out items with 0 quantity so no unnecessary 0-quantity rows clutter the bill
  const visibleItemRows = allItemRows.filter((item: any) => item.qPaid > 0 || item.qFree > 0);

  const totalDeliveredQty = visibleItemRows.reduce((sum: number, i: any) => sum + i.qPaid, 0);
  const itemsDeliveredTotal = visibleItemRows.reduce((sum: number, i: any) => sum + i.lineTotal, 0);

  const grandTotal = Number(order.actualSoldAmount || order.grandTotal || itemsDeliveredTotal || 0);
  const subtotal = itemsDeliveredTotal > 0 ? itemsDeliveredTotal : grandTotal;
  const discountAmount = Number(order.discountAmount || 0);

  const paidAmount = Number(order.advancePaid || order.collectedAmount || 0);
  const dueAmount = order.dueAmount !== undefined && order.dueAmount !== null
    ? Number(order.dueAmount)
    : (order.status === 'SETTLED' ? 0 : Math.max(0, grandTotal - paidAmount));

  // Clean amount formatter using standard sans-serif with comma separation
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
      {/* Dynamic Print CSS for A4 Page vs POS System */}
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
            width: ${printLayout === 'POS' ? '72mm' : '100%'} !important;
            max-width: ${printLayout === 'POS' ? '72mm' : '190mm'} !important;
            margin: 0 auto !important;
            padding: ${printLayout === 'POS' ? '2mm 1mm' : '10mm 12mm'} !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            font-size: ${printLayout === 'POS' ? '10px' : '12px'} !important;
            line-height: ${printLayout === 'POS' ? '1.25' : '1.35'} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: ${printLayout === 'POS' ? '80mm auto' : 'A4 portrait'};
            margin: ${printLayout === 'POS' ? '1mm' : '10mm 12mm'};
          }
        }
      `}</style>

      {/* Main Modal Card */}
      <div className={`w-full ${printLayout === 'POS' ? 'max-w-sm' : 'max-w-2xl'} bg-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col max-h-[96vh] print:max-h-none print:h-auto print:border-none print:shadow-none print:bg-white transition-all duration-200`}>
        
        {/* Top Control Bar with 2 Clear Options: POS System & A4 Page */}
        <div className="no-print bg-slate-900 text-white px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-bold truncate">Print Preview</h2>
            <button
              type="button"
              onClick={handleCopyInvoiceNumber}
              className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/10 hover:bg-white/20 text-slate-200 px-2 py-0.5 rounded transition-colors tabular-nums"
              title="Copy invoice number"
            >
              <span>#{order.id.toString().padStart(6, '0')}</span>
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* The 2 Primary Options: POS System vs A4 Page */}
            <div className="inline-flex p-0.5 rounded-xl bg-slate-800 border border-slate-700 shadow-inner">
              <button
                type="button"
                onClick={() => setPrintLayout('POS')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  printLayout === 'POS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>POS System</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('A4')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  printLayout === 'A4'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>A4 Page</span>
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
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-200/80 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          
          {/* ========================================================================= */}
          {/* OPTION 1: POS SYSTEM (80mm Thermal Slip - Only Name, Qty, Price) */}
          {/* ========================================================================= */}
          {printLayout === 'POS' ? (
            <div 
              id="order-print-canvas"
              className="w-full max-w-[310px] bg-white shadow-md rounded-xl p-3.5 text-slate-900 text-[10.5px] leading-tight font-sans"
            >
              {/* POS Minimal Header */}
              <div className="text-center pb-2 mb-2 border-b border-dashed border-slate-400">
                <h1 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-tight">
                  M/S KARIM TRADERS
                </h1>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Ghorashal / Borodarga
                </p>
                <p className="text-[10px] text-slate-600 font-medium tabular-nums">
                  Mob: 01763-088369
                </p>
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-700 mt-1">
                  POS Sales Receipt
                </div>
              </div>

              {/* Minimal Customer & Invoice Info */}
              <div className="pb-2 mb-2 border-b border-dashed border-slate-400 text-[10px] space-y-1">
                <div className="flex items-center justify-between">
                  <span>Inv: <strong className="text-slate-900 font-bold tabular-nums">#{order.id.toString().padStart(6, '0')}</strong></span>
                  <span className="text-slate-600">{formatDate(order.orderDate || order.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="truncate">Customer: <strong className="text-slate-900 font-bold">{order.shop?.name || 'Walk-in'}</strong></span>
                  {order.shop?.phone && (
                    <span className="text-slate-600 tabular-nums text-[9.5px] shrink-0 ml-1">{order.shop.phone}</span>
                  )}
                </div>
              </div>

              {/* ONLY 3 COLUMNS: NAME | QTY | PRICE */}
              <table className="w-full text-left text-[10.5px] mb-2 border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-[9.5px] font-black uppercase text-slate-800">
                    <th className="py-1 pr-1 text-left">Name</th>
                    <th className="py-1 px-1 text-center w-12">Qty</th>
                    <th className="py-1 pl-1 text-right w-16">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {isManualDue ? (
                    <tr className="border-b border-slate-100">
                      <td className="py-1 pr-1 font-bold text-slate-900 leading-tight">
                        Due Settlement
                        {cleanedNote && (
                          <p className="text-[9px] text-slate-500 font-normal mt-0.5">{cleanedNote}</p>
                        )}
                      </td>
                      <td className="py-1 px-1 text-center font-bold tabular-nums">1</td>
                      <td className="py-1 pl-1 text-right tabular-nums font-bold text-slate-900">{formatAmount(grandTotal)}</td>
                    </tr>
                  ) : (
                    visibleItemRows.map((item: any, idx: number) => {
                      return (
                        <tr key={idx} className="border-b border-slate-100/60 last:border-none">
                          <td className="py-1 pr-1 font-semibold text-slate-900 leading-tight">
                            {item.product?.name || 'Item'}
                            {item.qFree > 0 && <span className="text-[8.5px] text-slate-500 font-bold ml-1">(+{item.qFree} free)</span>}
                          </td>
                          <td className="py-1 px-1 text-center tabular-nums font-semibold text-slate-800">
                            {formatAmount(item.qPaid)}
                          </td>
                          <td className="py-1 pl-1 text-right tabular-nums font-bold text-slate-900">
                            {formatAmount(item.lineTotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* POS Financial Summary */}
              <div className="border-t border-slate-400 pt-1.5 space-y-1 text-[10.5px]">
                <div className="flex justify-between text-slate-600">
                  <span>Total Qty:</span>
                  <span className="tabular-nums font-bold text-slate-900">
                    {isManualDue ? '1' : formatAmount(totalDeliveredQty)}
                  </span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>Discount:</span>
                    <span className="tabular-nums font-bold">-{formatAmount(discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 text-[11px]">
                  <span>Total Bill:</span>
                  <span className="tabular-nums font-black">{formatCurrency(grandTotal)}</span>
                </div>

                <div className="flex justify-between text-slate-700 font-medium">
                  <span>Paid:</span>
                  <span className="tabular-nums font-semibold">{formatCurrency(paidAmount)}</span>
                </div>

                <div className="flex justify-between font-black text-slate-900 border-t border-slate-400 pt-1 text-[11.5px]">
                  <span>Due Amount:</span>
                  <span className="tabular-nums">{formatCurrency(dueAmount)}</span>
                </div>
              </div>

              {/* POS Footer */}
              <div className="text-center text-[9px] text-slate-500 mt-2.5 pt-2 border-t border-dashed border-slate-300">
                Thank you! Please visit again.
              </div>
            </div>

          ) : (

            /* ========================================================================= */
            /* OPTION 2: A4 PAGE (Full Standard A4 Invoice / Cash Memo) - CLEAN & SINGLE COLOR */
            /* ========================================================================= */
            <div 
              id="order-print-canvas"
              className="w-full max-w-xl bg-white shadow-lg rounded-xl p-5 sm:p-7 text-slate-900 text-xs leading-normal font-sans"
            >
              {/* A4 Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                    M/S KARIM TRADERS
                  </h1>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    Authorized Wholesale Distributor & Dealer
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ghorashal / Borodarga · Phone: <strong className="tabular-nums text-slate-700">01763-088369</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-md">
                    Sales Invoice
                  </span>
                  <p className="tabular-nums font-bold text-sm text-slate-900 mt-1.5">
                    #{order.id.toString().padStart(6, '0')}
                  </p>
                  <p className="text-xs text-slate-500">
                    Date: {formatDate(order.orderDate || order.createdAt)}
                  </p>
                </div>
              </div>

              {/* A4 Customer & Order Details Card */}
              <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded-lg p-3 mb-4 bg-slate-50/50 text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Billed To</p>
                  <h3 className="font-black text-slate-900 text-sm">
                    {order.shop?.name || 'Direct Customer'}
                  </h3>
                  {order.shop?.phone && (
                    <p className="text-slate-600 tabular-nums mt-0.5">Phone: {order.shop.phone}</p>
                  )}
                  {order.shop?.address && (
                    <p className="text-slate-500 mt-0.5">{order.shop.address}</p>
                  )}
                </div>

                <div className="text-right border-l border-slate-200 pl-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Logistics & Order Info</p>
                  {order.route?.name && (
                    <p className="text-slate-700 font-medium">Route: <strong>{order.route.name}</strong></p>
                  )}
                  <p className="text-slate-600 mt-0.5">
                    Status: <strong className="text-slate-900">{order.status || 'Confirmed'}</strong>
                  </p>
                  {cleanedNote && (
                    <p className="text-slate-500 text-[11px] mt-1 italic">
                      Note: {cleanedNote}
                    </p>
                  )}
                </div>
              </div>

              {/* A4 Items Table: #, Description, Qty, Rate, Total */}
              <table className="w-full text-left text-xs border border-slate-300 border-collapse mb-4">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-black uppercase text-slate-700">
                    <th className="py-2 px-2 text-center w-8 border-r border-slate-300">#</th>
                    <th className="py-2 px-3 border-r border-slate-300">Description</th>
                    <th className="py-2 px-2 text-center w-16 border-r border-slate-300">Qty</th>
                    <th className="py-2 px-3 text-right w-24 border-r border-slate-300">Unit Rate</th>
                    <th className="py-2 px-3 text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {isManualDue ? (
                    <tr>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-400 border-r border-slate-200">1</td>
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <p className="font-bold text-slate-900">Direct Due Settlement Record</p>
                        {cleanedNote && (
                          <p className="text-[11px] text-slate-600 font-medium mt-0.5">Note: {cleanedNote}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold border-r border-slate-200 tabular-nums">1</td>
                      <td className="py-2.5 px-3 text-right tabular-nums border-r border-slate-200">{formatCurrency(grandTotal)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(grandTotal)}</td>
                    </tr>
                  ) : (
                    visibleItemRows.map((item: any, idx: number) => {
                      return (
                        <tr key={idx}>
                          <td className="py-2 px-2 text-center text-slate-400 border-r border-slate-200 tabular-nums">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200">
                            <span>{item.product?.name || 'Item'}</span>
                            {item.product?.sku && <span className="text-[10px] text-slate-400 font-normal ml-1.5">({item.product.sku})</span>}
                          </td>
                          <td className="py-2 px-2 text-center tabular-nums border-r border-slate-200">
                            <span className="font-bold text-slate-900">{formatAmount(item.qPaid)}</span>
                            {item.qFree > 0 && <span className="text-slate-500 font-bold ml-1">+{item.qFree}f</span>}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-600 border-r border-slate-200">{formatCurrency(item.price)}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(item.lineTotal)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-xs">
                    <td colSpan={2} className="py-2 px-3 text-right uppercase text-slate-600 border-r border-slate-300">
                      Total Quantity:
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums text-slate-900 border-r border-slate-300">
                      {isManualDue ? '1' : formatAmount(totalDeliveredQty)}
                    </td>
                    <td colSpan={2} className="py-2 px-3 text-right tabular-nums text-slate-900">
                      {formatCurrency(subtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* A4 Financial Summary - Clean, Single Color, No Fluff */}
              <div className="flex justify-end mb-8">
                <div className="w-72 border border-slate-300 rounded-lg overflow-hidden bg-white text-xs">
                  <div className="p-3 space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="tabular-nums font-bold text-slate-900">{formatCurrency(subtotal)}</span>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Discount:</span>
                        <span className="tabular-nums font-bold">-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5 text-sm">
                      <span>Net Total Bill:</span>
                      <span className="tabular-nums font-black">{formatCurrency(grandTotal)}</span>
                    </div>

                    <div className="flex justify-between text-slate-700 font-medium">
                      <span>Paid Amount:</span>
                      <span className="tabular-nums font-semibold">{formatCurrency(paidAmount)}</span>
                    </div>

                    <div className="flex justify-between text-slate-900 font-black border-t-2 border-slate-900 pt-1.5 text-sm bg-slate-50 -mx-3 -mb-3 p-2.5">
                      <span>Remaining Due:</span>
                      <span className="tabular-nums">{formatCurrency(dueAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* A4 Signatures */}
              <div className="grid grid-cols-2 gap-12 pt-10 text-center text-xs">
                <div>
                  <div className="border-t border-slate-800 mx-auto w-36 mb-1.5"></div>
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Customer Signature</p>
                </div>
                <div>
                  <div className="border-t border-slate-800 mx-auto w-36 mb-1.5"></div>
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Authorized Signature</p>
                </div>
              </div>
            </div>
          )}

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
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print {printLayout === 'POS' ? 'Slip' : 'Invoice'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
