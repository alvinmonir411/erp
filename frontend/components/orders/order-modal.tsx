'use client';

import { 
  X, Printer, Info, Clock, CheckCircle, 
  MapPin, Store, Building2, DollarSign, 
  ShieldAlert, Package, Calendar
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface OrderModalProps {
  order: any;
  onClose: () => void;
}

export function OrderModal({ order, onClose }: OrderModalProps) {
  const isSettled = ['SETTLED', 'PARTIAL_DUE'].includes(order.status);
  
  // Calculate total units dispatched vs delivered
  const totalDispatched = order.items?.reduce((sum: number, item: any) => 
    sum + Number(item.quantity || 0) + Number(item.freeQuantity || 0), 0) || 0;
    
  const totalDelivered = order.items?.reduce((sum: number, item: any) => 
    sum + Number(item.deliveredPaidQuantity || 0) + Number(item.deliveredFreeQuantity || 0), 0) || 0;

  const totalReturned = order.items?.reduce((sum: number, item: any) => 
    sum + Number(item.returnedPaidQuantity || 0) + Number(item.returnedFreeQuantity || 0), 0) || 0;

  const totalDamaged = order.items?.reduce((sum: number, item: any) => 
    sum + Number(item.damagedPaidQuantity || 0) + Number(item.damagedFreeQuantity || 0), 0) || 0;

  return (
    <div className="order-modal-backdrop fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <style>{`
        .print-only-layout {
          display: none !important;
        }

        @media print {
          /* Backdrop reset to allow natural page height and margins */
          .order-modal-backdrop {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: transparent !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
          }
          
          #print-order-modal {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Hide all screen elements on the page */
          body * {
            visibility: hidden;
          }

          /* Make only the print container and its descendants visible */
          #print-order-modal, #print-order-modal * {
            visibility: visible;
          }

          .screen-only-layout {
            display: none !important;
          }

          .print-only-layout {
            display: block !important;
            width: 100% !important;
            color: #000000 !important;
            background-color: #ffffff !important;
          }

          /* Table print borders */
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .print-table th, .print-table td {
            border: 1px solid #475569 !important;
            padding: 5px 8px !important;
            font-size: 10px !important;
            color: #000000 !important;
            line-height: 1.25 !important;
          }

          .print-table th {
            background-color: #f1f5f9 !important;
            font-weight: 800 !important;
            text-align: center !important;
          }

          /* Page margins */
          @page {
            size: portrait;
            margin: 8mm 10mm 8mm 10mm;
          }
        }
      `}</style>
      
      <div id="print-order-modal" className="relative w-full max-w-3xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in duration-200">
        
        {/* Screen Only Layout */}
        <div className="screen-only-layout flex flex-col h-full w-full max-h-[90vh]">
          {/* Header */}
          <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Order #{order.id.toString().padStart(6, '0')} Details</h2>
              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-0.5">
                Created on {formatDate(order.createdAt)}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="rounded-full p-2 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Master Info Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <Store className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Shop Details</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{order.shop?.name || 'Direct Sale'}</p>
                  {order.shop ? (
                    <div className="text-[10px] text-slate-500 font-medium leading-normal mt-0.5 space-y-0.5">
                      {order.shop.ownerName && <p>Owner: <span className="font-bold text-slate-700">{order.shop.ownerName}</span></p>}
                      {order.shop.phone && <p>Phone: <span className="font-bold text-slate-700">{order.shop.phone}</span></p>}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">No Shop Linked</p>
                  )}
                  {order.shop?.address && (
                    <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">
                      <MapPin className="inline h-2.5 w-2.5 mr-0.5 -mt-0.5" />
                      {order.shop.address}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <Building2 className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Route & Company</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{order.route?.name || 'No Route'}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-wide">
                    {order.company?.name || 'No Company'}
                  </p>
                  {order.marketArea && (
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Area: {order.marketArea}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <Calendar className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Order Statuses</p>
                  <div className="mt-1 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Sales Rep:</span>
                      <span className="text-[10px] font-bold text-slate-800">{order.createdBy}</span>
                    </div>
                    {['OUT_FOR_DELIVERY', 'DELIVERED', 'PARTIAL_DUE', 'SETTLED'].includes(order.status) && (
                      <div className="pt-1.5 border-t border-slate-200/60 mt-1">
                        {order.assignedDeliveryMan?.name && (
                          <p className="text-[10px] text-slate-500 font-medium">
                            Delivery Man: <span className="font-bold text-slate-700">{order.assignedDeliveryMan.name}</span>
                          </p>
                        )}
                        {order.deliveryPerson?.name && (
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                            Personnel/Staff: <span className="font-bold text-slate-700">{order.deliveryPerson.name}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes section */}
            {(order.note || order.deliveryNote || order.settlementNote) && (
              <div className="rounded-2xl bg-amber-50/60 border border-amber-100/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-800">
                  <Info className="h-4 w-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Remarks & Notes</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3 text-xs leading-normal">
                  {order.note && (
                    <div>
                      <span className="font-bold text-amber-700 block">Order Note:</span>
                      <span className="text-amber-900 mt-0.5 block">{order.note}</span>
                    </div>
                  )}
                  {order.deliveryNote && (
                    <div>
                      <span className="font-bold text-amber-700 block">Delivery Note:</span>
                      <span className="text-amber-900 mt-0.5 block">{order.deliveryNote}</span>
                    </div>
                  )}
                  {order.settlementNote && (
                    <div>
                      <span className="font-bold text-amber-700 block">Settlement Note:</span>
                      <span className="text-amber-900 mt-0.5 block">{order.settlementNote}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Product Items Table */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Itemized Product Records
              </h3>
              
              {!order.items || order.items.length === 0 ? (
                <div className="text-slate-500 font-bold p-6 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs uppercase tracking-wider">
                  No itemized product records (Manual Due Record)
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left text-xs min-w-[600px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3 text-center">Price</th>
                        <th className="px-4 py-3 text-center">Dispatched (P/F)</th>
                        <th className="px-4 py-3 text-center">Returned (P/F)</th>
                        <th className="px-4 py-3 text-center">Damaged (P/F)</th>
                        <th className="px-4 py-3 text-center">Delivered (P/F)</th>
                        <th className="px-4 py-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium">
                      {order.items.map((item: any, idx: number) => {
                        const price = Number(item.unitPrice || 0);
                        
                        const qPaid = Number(item.quantity || 0);
                        const qFree = Number(item.freeQuantity || 0);
                        
                        const delPaid = Number(item.deliveredPaidQuantity !== undefined ? item.deliveredPaidQuantity : (isSettled ? 0 : qPaid));
                        const delFree = Number(item.deliveredFreeQuantity !== undefined ? item.deliveredFreeQuantity : (isSettled ? 0 : qFree));
                        
                        const retPaid = Number(item.returnedPaidQuantity || 0);
                        const retFree = Number(item.returnedFreeQuantity || 0);
                        
                        const dmgPaid = Number(item.damagedPaidQuantity || 0);
                        const dmgFree = Number(item.damagedFreeQuantity || 0);

                        const lineTotal = Number(item.lineTotal || (qPaid * price));

                        return (
                          <tr key={idx} className="hover:bg-slate-50/40">
                            <td className="px-4 py-3 font-bold text-slate-900">{item.product?.name || 'Unknown Product'}</td>
                            <td className="px-4 py-3 text-center text-slate-500 font-bold">{formatCurrency(price)}</td>
                            {/* DISPATCHED */}
                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-slate-700">{qPaid}</span>
                              {qFree > 0 && <span className="text-emerald-600 font-bold ml-1">+{qFree}f</span>}
                            </td>
                            {/* RETURNED */}
                            <td className="px-4 py-3 text-center">
                              {retPaid > 0 || retFree > 0 ? (
                                <>
                                  <span className="font-black text-rose-600">{retPaid}</span>
                                  {retFree > 0 && <span className="text-rose-500 font-black ml-1">+{retFree}f</span>}
                                </>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            {/* DAMAGED */}
                            <td className="px-4 py-3 text-center">
                              {dmgPaid > 0 || dmgFree > 0 ? (
                                <>
                                  <span className="font-black text-amber-600">{dmgPaid}</span>
                                  {dmgFree > 0 && <span className="text-amber-500 font-black ml-1">+{dmgFree}f</span>}
                                </>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            {/* DELIVERED */}
                            <td className="px-4 py-3 text-center">
                              <span className="font-black text-emerald-600">{delPaid}</span>
                              {delFree > 0 && <span className="text-emerald-500 font-black ml-1">+{delFree}f</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-slate-950">
                              {formatCurrency(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Ledger Breakdown Cards */}
            <div className={!order.items || order.items.length === 0 ? "w-full flex justify-center" : "grid gap-6 md:grid-cols-2"}>
              {/* Delivery Qty Summary Card */}
              {order.items && order.items.length > 0 && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Physical Inventory Summary</p>
                  
                  <div className="space-y-2 text-xs font-semibold text-slate-600">
                    <div className="flex justify-between">
                      <span>Total Items Dispatched:</span>
                      <span className="text-slate-800 font-bold">{totalDispatched} units</span>
                    </div>
                    {totalReturned > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Returned Items (P+F):</span>
                        <span className="font-black">-{totalReturned} units</span>
                      </div>
                    )}
                    {totalDamaged > 0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>Damaged Items (P+F):</span>
                        <span className="font-black">-{totalDamaged} units</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-emerald-600">
                      <span>Delivered Quantity:</span>
                      <span>{totalDelivered} units</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Ledger Card */}
              <div className={`rounded-2xl bg-slate-900 p-5 text-white space-y-3 ${(!order.items || order.items.length === 0) ? 'max-w-md w-full' : ''}`}>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Financial Ledger Summary</p>
                
                <div className="space-y-2 text-xs font-semibold text-slate-300">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-bold">{formatCurrency(Number(order.subtotal || 0))}</span>
                  </div>
                  {Number(order.discountAmount) > 0 && (
                    <div className="flex justify-between text-rose-400">
                      <span>Discount:</span>
                      <span className="font-bold">-{formatCurrency(Number(order.discountAmount || 0))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-400">
                    <span>Final Invoice Amount:</span>
                    <span className="font-black">{formatCurrency(Number(order.actualSoldAmount || order.grandTotal || 0))}</span>
                  </div>
                  
                  {Number(order.advancePaid) > 0 && (
                    <div className="flex justify-between text-cyan-400 border-t border-white/10 pt-2">
                      <span>Advance Payment Paid:</span>
                      <span className="font-bold">{formatCurrency(Number(order.advancePaid || 0))}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-emerald-400 border-t border-white/10 pt-2 font-black">
                    <span>Cash Received (Admin):</span>
                    <span>{formatCurrency(Number(order.collectedAmount || 0))}</span>
                  </div>
                  
                  <div className="flex justify-between text-amber-400 border-t border-white/10 pt-2 font-black">
                    <span>Remaining Due / Baki:</span>
                    <span>{formatCurrency(Number(order.dueAmount || 0))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
            <button 
              onClick={() => window.print()} 
              className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" /> Print Record
            </button>
            <button 
              onClick={onClose} 
              className="flex-1 rounded-xl bg-slate-900 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Dedicated Print Layout (Invoice/Cash Memo) */}
        <div className="print-only-layout hidden print:block w-full">
          {/* Company Header */}
          <div className="text-center border-b border-slate-400 pb-2 mb-4">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">M/S KARIM TRADERS</h1>
            <p className="text-[10px] font-bold text-slate-500 tracking-wider mt-0.5 uppercase">Dealer & Distributor</p>
            <p className="text-[9px] font-semibold text-slate-400 mt-0.5">Proprietor: Karim | Mobile: 01763-088369</p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-[11px] mb-4">
            {/* Shop Details */}
            <div className="border border-slate-300 rounded p-2 text-left">
              <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Customer / Shop Details</h3>
              <p className="font-bold text-slate-900 text-xs">{order.shop?.name || 'Direct Sale'}</p>
              {order.shop?.ownerName && (
                <p className="mt-0.5">Owner: <span className="font-semibold text-slate-700">{order.shop.ownerName}</span></p>
              )}
              {order.shop?.phone && (
                <p className="mt-0.5">Phone: <span className="font-semibold text-slate-700">{order.shop.phone}</span></p>
              )}
              {order.shop?.address && (
                <p className="mt-0.5 text-slate-500 leading-normal">Address: {order.shop.address}</p>
              )}
            </div>

            {/* Invoice / Order Details */}
            <div className="border border-slate-300 rounded p-2 text-right">
              <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-wider text-right mb-1">Invoice Details</h3>
              <p className="font-bold text-slate-900 text-xs text-right">Invoice #{order.id.toString().padStart(6, '0')}</p>
              <p className="mt-0.5">Date: <span className="font-semibold text-slate-700">{formatDate(order.createdAt)}</span></p>
              <p className="mt-0.5">Route: <span className="font-semibold text-slate-700">{order.route?.name || 'No Route'}</span></p>
              <p className="mt-0.5">Company: <span className="font-semibold text-slate-700">{order.company?.name || 'No Company'}</span></p>
              <div className="mt-1 pt-1 border-t border-slate-100 flex justify-between text-[10px]">
                <span className="font-bold text-slate-400 uppercase">Sales Rep:</span>
                <span className="font-bold text-slate-700">{order.createdBy}</span>
              </div>
              {order.assignedDeliveryMan?.name && (
                <div className="mt-0.5 flex justify-between text-[10px]">
                  <span className="font-bold text-slate-400 uppercase">Delivery Man:</span>
                  <span className="font-bold text-slate-700">{order.assignedDeliveryMan.name}</span>
                </div>
              )}
              <div className="mt-0.5 flex justify-between text-[10px]">
                <span className="font-bold text-slate-400 uppercase">Status:</span>
                <span className="font-bold uppercase text-slate-700">{order.status.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>

          {/* Remarks/Notes if exists */}
          {(order.note || order.deliveryNote || order.settlementNote) && (
            <div className="border border-slate-300 bg-slate-50/30 rounded p-2 mb-4 text-[10px]">
              <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Remarks & Notes</h4>
              <div className="grid grid-cols-3 gap-2 leading-relaxed">
                {order.note && (
                  <div>
                    <span className="font-bold text-slate-500 block">Order Note:</span>
                    <span className="text-slate-800">{order.note}</span>
                  </div>
                )}
                {order.deliveryNote && (
                  <div>
                    <span className="font-bold text-slate-500 block">Delivery Note:</span>
                    <span className="text-slate-800">{order.deliveryNote}</span>
                  </div>
                )}
                {order.settlementNote && (
                  <div>
                    <span className="font-bold text-slate-500 block">Settlement Note:</span>
                    <span className="text-slate-800">{order.settlementNote}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Product Items Table */}
          <div className="mb-4">
            {!order.items || order.items.length === 0 ? (
              <div className="border border-slate-300 rounded p-4 text-center font-bold text-slate-500 text-[10px] uppercase tracking-wider">
                No itemized product records (Manual Due Record)
              </div>
            ) : (
              <table className="print-table w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                    <th className="border border-slate-300 px-2 py-1 text-center w-8">SL.</th>
                    <th className="border border-slate-300 px-2 py-1">Product Name</th>
                    <th className="border border-slate-300 px-2 py-1 text-center w-16">Price</th>
                    <th className="border border-slate-300 px-2 py-1 text-center w-20">Dispatched (P/F)</th>
                    <th className="border border-slate-300 px-2 py-1 text-center w-16">Returned</th>
                    <th className="border border-slate-300 px-2 py-1 text-center w-16">Damaged</th>
                    <th className="border border-slate-300 px-2 py-1 text-center w-20">Delivered</th>
                    <th className="border border-slate-300 px-2 py-1 text-right w-20">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item: any, idx: number) => {
                    const price = Number(item.unitPrice || 0);
                    const qPaid = Number(item.quantity || 0);
                    const qFree = Number(item.freeQuantity || 0);
                    
                    const delPaid = Number(item.deliveredPaidQuantity !== undefined ? item.deliveredPaidQuantity : (isSettled ? 0 : qPaid));
                    const delFree = Number(item.deliveredFreeQuantity !== undefined ? item.deliveredFreeQuantity : (isSettled ? 0 : qFree));
                    
                    const retPaid = Number(item.returnedPaidQuantity || 0);
                    const retFree = Number(item.returnedFreeQuantity || 0);
                    
                    const dmgPaid = Number(item.damagedPaidQuantity || 0);
                    const dmgFree = Number(item.damagedFreeQuantity || 0);

                    const lineTotal = Number(item.lineTotal || (qPaid * price));

                    return (
                      <tr key={idx} className="font-medium text-slate-800">
                        <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 px-2 py-1 font-bold text-slate-900">{item.product?.name || 'Unknown Product'}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center">{formatCurrency(price)}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center">
                          <span>{qPaid}</span>
                          {qFree > 0 && <span className="text-emerald-700 ml-1">+{qFree}f</span>}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center text-rose-600">
                          {retPaid > 0 || retFree > 0 ? (
                            <span>{retPaid + retFree}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center text-amber-600">
                          {dmgPaid > 0 || dmgFree > 0 ? (
                            <span>{dmgPaid + dmgFree}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center text-emerald-700 font-bold">
                          <span>{delPaid}</span>
                          {delFree > 0 && <span className="font-semibold text-emerald-600 ml-1">+{delFree}f</span>}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-bold text-slate-900">
                          {formatCurrency(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Summaries & Financial Ledger */}
          <div className={!order.items || order.items.length === 0 ? "flex justify-center" : "grid grid-cols-2 gap-4 text-[10px] mb-6"}>
            {/* Physical Quantities */}
            {order.items && order.items.length > 0 && (
              <div className="border border-slate-300 rounded p-2 space-y-1">
                <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Physical Inventory Summary</h4>
                <div className="space-y-1 font-medium text-slate-700">
                  <div className="flex justify-between">
                    <span>Total Items Dispatched:</span>
                    <span className="font-bold text-slate-900">{totalDispatched} units</span>
                  </div>
                  {totalReturned > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Returned Items (P+F):</span>
                      <span className="font-bold text-rose-700">-{totalReturned} units</span>
                    </div>
                  )}
                  {totalDamaged > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Damaged Items (P+F):</span>
                      <span className="font-bold text-amber-700">-{totalDamaged} units</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-1 flex justify-between font-black text-emerald-700">
                    <span>Delivered Quantity:</span>
                    <span>{totalDelivered} units</span>
                  </div>
                </div>
              </div>
            )}

            {/* Financials */}
            <div className={`border border-slate-300 rounded p-2 space-y-1 ${(!order.items || order.items.length === 0) ? 'w-full max-w-xs' : ''}`}>
              <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Financial Ledger Summary</h4>
              <div className="space-y-1 font-medium text-slate-700">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(Number(order.subtotal || 0))}</span>
                </div>
                {Number(order.discountAmount) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span className="font-semibold">-{formatCurrency(Number(order.discountAmount || 0))}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-100 pt-0.5">
                  <span>Final Invoice Amount:</span>
                  <span>{formatCurrency(Number(order.actualSoldAmount || order.grandTotal || 0))}</span>
                </div>
                {Number(order.advancePaid) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Advance Payment:</span>
                    <span>{formatCurrency(Number(order.advancePaid || 0))}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-700 font-black border-t border-slate-200 pt-1">
                  <span>Cash Received (Admin):</span>
                  <span>{formatCurrency(Number(order.collectedAmount || 0))}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-black border-t border-slate-200 pt-1 text-xs">
                  <span>Remaining Due / Baki:</span>
                  <span>{formatCurrency(Number(order.dueAmount || 0))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Signature Area */}
          <div className="grid grid-cols-3 gap-8 text-center text-[10px] mt-8 pt-6">
            <div>
              <div className="border-t border-slate-400 mx-auto w-24 mb-1"></div>
              <p className="font-bold text-slate-400 uppercase text-[8px] tracking-wider">Customer Signature</p>
            </div>
            <div>
              <div className="border-t border-slate-400 mx-auto w-24 mb-1"></div>
              <p className="font-bold text-slate-400 uppercase text-[8px] tracking-wider">Delivery Man Signature</p>
            </div>
            <div>
              <div className="border-t border-slate-400 mx-auto w-24 mb-1"></div>
              <p className="font-bold text-slate-400 uppercase text-[8px] tracking-wider">Authorized Signature</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
