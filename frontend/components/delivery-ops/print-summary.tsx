'use client';

import { formatCurrency, formatNumber } from '@/lib/utils/format';

interface PrintSummaryProps {
  report: any;
  mode: 'morning' | 'final' | 'field';
  draftDues?: Record<number, number>;
}

export function PrintSummary({ report, mode, draftDues = {} }: PrintSummaryProps) {
  if (!report) return null;

  const getTitle = () => {
    switch (mode) {
      case 'morning': return 'Morning Delivery Summary';
      case 'field': return 'Delivery Field Summary Sheet';
      case 'final': return 'Final Delivery Settlement';
      default: return 'Delivery Report';
    }
  };

  return (
    <div className="mx-auto bg-white p-2 sm:p-4 text-[13px] text-black printable-report max-w-full md:max-w-[210mm]">
      <style dangerouslySetInnerHTML={{
        __html: `
        .printable-report table { border-collapse: collapse; width: 100%; }
        .printable-report th, .printable-report td { border: 1px solid #000; padding: 5px 7px; }
        
        @media print {
          @page { 
            size: A4 portrait; 
            margin: 6mm 8mm 6mm 8mm !important; 
          }
          body { 
            -webkit-print-color-adjust: exact !important; 
            background: white !important;
            color: black !important;
            font-size: 11px !important;
          }
          html, body {
            height: auto !important;
            min-height: 0 !important;
          }
          .min-h-screen {
            min-height: 0 !important;
          }
          .printable-report { 
            padding: 0 !important; 
            max-width: none !important; 
            font-size: 11px !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 262mm !important;
          }
          .printable-report > div,
          .printable-report > div > div {
            display: flex !important;
            flex-direction: column !important;
            flex-grow: 1 !important;
          }
          .printable-report .signature-grid {
            margin-top: auto !important;
            padding-top: 20px !important;
          }
          
          /* Table spacing overrides */
          .printable-report table th, 
          .printable-report table td { 
            padding: 3px 5px !important; 
            font-size: 9px !important;
            line-height: 1.15 !important;
            border: 1px solid #000000 !important;
          }
          
          /* Spacing cleanups */
          .mb-6 { margin-bottom: 8px !important; }
          .mb-4 { margin-bottom: 6px !important; }
          .mt-8 { margin-top: 10px !important; }
          .mt-12 { margin-top: 12px !important; }
          .mt-20 { margin-top: 24px !important; }
          
          /* Morning summary breakdown grid */
          .order-breakdown-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }
          .order-breakdown-card {
            padding: 6px !important;
            border-width: 1px !important;
            font-size: 9px !important;
          }
          
          /* Field Summary Sheet Table height adjustments */
          .field-sheet-table tr {
            height: auto !important;
          }
          .field-sheet-table td {
            padding: 4px 6px !important;
          }
          .empty-row {
            height: 22px !important; /* Make empty rows much smaller in print */
          }
          .empty-row td {
            padding: 2px 4px !important;
          }
        }
      `}} />

      {/* Header Section */}
      <div className="text-center mb-6">
        <div className="text-3xl font-black uppercase mb-1 tracking-widest">MS KARIM TRADERS</div>
        <div className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-tighter">
          {report.company?.name && report.company?.name !== 'MS KARIM TRADERS' ? report.company?.name : 'Authorized Distributor'}
        </div>
        <h1 className="text-sm uppercase tracking-[0.2em] font-medium border-b border-black pb-4 inline-block px-4 sm:px-10">
          {getTitle()}
        </h1>

        {/* Info Row 1 */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between text-left font-medium gap-2 sm:gap-0">
          <div className="flex-1">
            <span className="font-bold">Batch Number:</span> {report.batchNo}
          </div>
          <div className="flex-1 sm:text-center">
            <span className="font-bold">Delivery Date:</span> {new Date(report.dispatchDate).toLocaleDateString()}
          </div>
          <div className="flex-1 sm:text-right">
            <span className="font-bold">Route:</span> {report.route.name}
          </div>
        </div>

        {/* Info Row 2 */}
        <div className="mt-2 flex flex-col sm:flex-row justify-between text-left font-medium border-b border-black/10 pb-4 gap-2 sm:gap-0">
          <div className="flex-1">
            <span className="font-bold">Delivery Man:</span> {report.assignedDeliveryMan?.name || report.deliveryPerson?.name}
          </div>
          <div className="flex-1 sm:text-right text-xs text-slate-500">
            <span className="font-bold">Print Date & Time:</span> {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        {mode === 'morning' && <MorningLayout report={report} />}
        {mode === 'field' && <FieldLayout report={report} />}
        {mode === 'final' && <FinalSettlementLayout report={report} draftDues={draftDues} />}
      </div>
    </div>
  );
}

function FinalSettlementLayout({ report, draftDues }: { report: any, draftDues: Record<number, number> }) {
  const products = report.productSummary || [];
  const sortedProducts = [...products].sort((a, b) => a.productName.localeCompare(b.productName));

  return (
    <div className="mt-2 min-w-[700px]">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 uppercase font-bold text-[10px]">
            <th className="w-8 text-center">SL</th>
            <th className="text-left">Product Name</th>
            <th className="w-14 text-center">Qty</th>
            <th className="w-14 text-center">Return</th>
            <th className="w-14 text-center">Damage</th>
            <th className="w-14 text-center">Sold</th>
            <th className="w-20 text-center">Price</th>
            <th className="w-24 text-right">Total</th>
            <th className="w-20 text-right">Due/Baki</th>
            <th className="w-20 text-right">Cash</th>
            <th className="text-left min-w-[80px]">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {sortedProducts.map((item, index) => {
            const soldQty = Number(item.deliveredPaid ?? item.delivered ?? 0);
            const totalAmount = Number(item.finalSoldAmount || 0);
            const unitPrice = soldQty > 0 ? totalAmount / soldQty : 0;

            const productDue = report.orders
              .filter((order: any) => order.items.some((i: any) => i.productName === item.productName))
              .reduce((sum: number, order: any) => {
                if (draftDues[order.orderId] !== undefined) {
                  return sum + draftDues[order.orderId];
                }
                return sum + Number(order.dueAmount || 0);
              }, 0);

            const cash = Math.max(0, totalAmount - productDue);

            return (
              <tr key={item.productName}>
                <td className="text-center text-slate-400">{index + 1}</td>
                <td className="font-medium">
                  {item.productName}
                  {Number(item.freeDelivered || 0) > 0 && (
                    <span className="ml-1 text-[9px] text-emerald-600 font-bold">(+{item.freeDelivered} free)</span>
                  )}
                </td>
                <td className="text-center">{formatNumber(item.dispatched)}</td>
                <td className="text-center">{formatNumber(item.returned)}</td>
                <td className="text-center">{formatNumber(item.damaged)}</td>
                <td className="text-center font-bold text-emerald-600 italic">
                  {formatNumber(soldQty)}
                </td>
                <td className="text-center text-slate-600">
                  {formatCurrency(unitPrice)}
                </td>
                <td className="text-right font-bold bg-slate-50/50">
                  {formatCurrency(totalAmount)}
                </td>
                <td className="text-right font-bold text-amber-600">
                  {formatCurrency(productDue)}
                </td>
                <td className="text-right font-bold text-emerald-600">
                  {formatCurrency(cash)}
                </td>
                <td></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-8 flex justify-end">
        <div className="w-64 space-y-2 border-t border-black pt-4">
          <div className="flex justify-between text-xs font-medium">
            <span>Total Quantity:</span>
            <span>{formatNumber(report.summary.totalDispatchedQty || products.reduce((s, i) => s + Number(i.dispatched), 0))}</span>
          </div>
          <div className="flex justify-between text-xs font-medium">
            <span>Returned:</span>
            <span>{formatNumber(products.reduce((s, i) => s + Number(i.returned), 0))}</span>
          </div>
          <div className="flex justify-between text-xs font-medium">
            <span>Damaged:</span>
            <span>{formatNumber(products.reduce((s, i) => s + Number(i.damaged), 0))}</span>
          </div>
          <div className="flex justify-between text-xs font-bold border-b border-black pb-2">
            <span>Sold (Paid):</span>
            <span>{formatNumber(products.reduce((s, i: any) => s + Number(i.deliveredPaid ?? i.delivered ?? 0), 0))}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-1">
            <span>GRAND TOTAL:</span>
            <span>{formatCurrency(report.summary.finalSoldValue)}</span>
          </div>

          {(() => {
            const totalDue = report.orders.reduce((sum: number, order: any) => {
              if (draftDues[order.orderId] !== undefined) {
                return sum + draftDues[order.orderId];
              }
              return sum + Number(order.dueAmount || 0);
            }, 0);
            const cashCollectable = Math.max(0, Number(report.summary.finalSoldValue || 0) - totalDue);

            return (
              <>
                <div className="flex justify-between text-sm font-bold pt-1 text-amber-700">
                  <span>Total Due/Baki:</span>
                  <span>{formatCurrency(totalDue)}</span>
                </div>
                <div className="flex justify-between text-lg font-black pt-2 border-t-2 border-black text-emerald-700">
                  <span>CASH COLLECTABLE:</span>
                  <span>{formatCurrency(cashCollectable)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1">
                  <span>Cash Received:</span>
                  <span>{formatCurrency(report.summary.totalCollectedAmount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1">
                  <span>Cash Expected:</span>
                  <span>{formatCurrency(report.summary.totalCashExpected || cashCollectable)}</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Signature block for Final Settlement Sheet */}
      <div className="mt-12 signature-grid grid grid-cols-2 gap-10">
        <div className="border-t-2 border-slate-900 pt-3 text-center">
          <p className="text-xs font-black uppercase tracking-widest">Delivery Man Signature</p>
        </div>
        <div className="border-t-2 border-slate-900 pt-3 text-center">
          <p className="text-xs font-black uppercase tracking-widest">Authorized Signature</p>
        </div>
      </div>
    </div>
  );
}

function FieldLayout({ report }: { report: any }) {
  const items = report.itemWiseTotals || [];
  const sortedItems = [...items].sort((a, b) => a.productName.localeCompare(b.productName));

  return (
    <div className="mt-4 min-w-[700px]">
      <table className="w-full border-2 border-slate-900 border-collapse field-sheet-table">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest">
            <th className="border-2 border-slate-900 px-2 py-3 text-center w-10">SL</th>
            <th className="border-2 border-slate-900 px-3 py-3 text-left min-w-[180px]">Product Name</th>
            <th className="border-2 border-slate-900 px-2 py-3 text-center w-20">Qty</th>
            <th className="border-2 border-slate-900 px-2 py-3 text-center w-20 text-rose-600">Return</th>
            <th className="border-2 border-slate-900 px-2 py-3 text-center w-20 text-emerald-600">Sales</th>
            <th className="border-2 border-slate-900 px-2 py-3 text-center w-24">Price</th>
            <th className="border-2 border-slate-900 px-2 py-3 text-center w-28">Total</th>
            <th className="border-2 border-slate-900 px-3 py-3 text-left">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, index) => {
            const unitPrice = Number(item.quantity) > 0 ? Number(item.estimatedAmount) / Number(item.quantity) : 0;
            return (
              <tr key={item.productName} className="font-bold">
                <td className="border-2 border-slate-900 px-2 py-3 text-center text-slate-400 font-medium">
                  {index + 1}
                </td>
                <td className="border-2 border-slate-900 px-3 py-3 text-left text-slate-900 text-sm">
                  {item.productName}
                </td>
                <td className="border-2 border-slate-900 px-2 py-3 text-center text-base bg-slate-50">
                  {formatNumber(item.quantity)}
                </td>
                <td className="border-2 border-slate-900 px-2 py-3"></td>
                <td className="border-2 border-slate-900 px-2 py-3"></td>
                <td className="border-2 border-slate-900 px-2 py-3 text-center text-xs text-slate-500">
                  {formatCurrency(unitPrice)}
                </td>
                <td className="border-2 border-slate-900 px-2 py-3 text-center text-sm">
                  {formatCurrency(item.estimatedAmount)}
                </td>
                <td className="border-2 border-slate-900 px-3 py-3"></td>
              </tr>
            );
          })}
          {sortedItems.length < 12 && Array.from({ length: Math.max(0, 12 - sortedItems.length) }).map((_, i) => (
            <tr key={`empty-${i}`} className="h-8 empty-row">
              <td className="border-2 border-slate-900 px-2 py-1.5"></td>
              <td className="border-2 border-slate-900 px-3 py-1.5"></td>
              <td className="border-2 border-slate-900 px-2 py-1.5"></td>
              <td className="border-2 border-slate-900 px-2 py-1.5"></td>
              <td className="border-2 border-slate-900 px-2 py-1.5"></td>
              <td className="border-2 border-slate-900 px-2 py-1.5"></td>
              <td className="border-2 border-slate-900 px-2 py-1.5"></td>
              <td className="border-2 border-slate-900 px-3 py-1.5"></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="border-2 border-slate-900 px-6 py-3 bg-slate-50">
          <p className="text-lg font-black">
            TOTAL AMOUNT: {formatCurrency(report.estimatedTotalAmount)}
          </p>
        </div>
      </div>

      <div className="mt-8 signature-grid grid grid-cols-2 gap-10">
        <div className="border-t-2 border-slate-900 pt-3 text-center">
          <p className="text-xs font-black uppercase tracking-widest">Delivery Man Signature</p>
        </div>
        <div className="border-t-2 border-slate-900 pt-3 text-center">
          <p className="text-xs font-black uppercase tracking-widest">Authorized Signature</p>
        </div>
      </div>
    </div>
  );
}

function MorningLayout({ report }: { report: any }) {
  return (
    <div className="mt-8 space-y-10 min-w-[600px]">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest border-l-4 border-slate-900 pl-3 mb-4">
          Item-wise Loading Sheet
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <th className="py-3 text-left">Product Name</th>
              <th className="py-3 text-center">Total Quantity</th>
              <th className="py-3 text-right">Est. Unit Price</th>
              <th className="py-3 text-right">Est. Total Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.itemWiseTotals.map((item: any) => (
              <tr key={item.productName} className="font-medium">
                <td className="py-3 font-bold text-slate-900">{item.productName}</td>
                <td className="py-3 text-center font-black">{formatNumber(item.quantity)}</td>
                <td className="py-3 text-right text-slate-500">{formatCurrency(Number(item.estimatedAmount) / Number(item.quantity))}</td>
                <td className="py-3 text-right font-bold">{formatCurrency(item.estimatedAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900">
              <td colSpan={3} className="py-4 text-right text-xs font-black uppercase tracking-widest text-slate-500">
                Total Estimated Value
              </td>
              <td className="py-4 text-right text-xl font-black">
                {formatCurrency(report.estimatedTotalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div>
        <h2 className="text-sm font-black uppercase tracking-widest border-l-4 border-slate-900 pl-3 mb-4">
          Order Breakdown
        </h2>
        <div className="grid gap-4 grid-cols-2 order-breakdown-grid">
          {report.selectedOrders.map((order: any) => (
            <div key={order.orderId} className="rounded-xl border-2 border-slate-100 p-4 break-inside-avoid order-breakdown-card">
              <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-2">
                <div>
                  <p className="font-black">Order #{String(order.orderId).padStart(6, '0')}</p>
                  <p className="text-xs text-slate-500 font-bold">{order.shopName}</p>
                </div>
                <p className="text-xs font-black">{formatCurrency(order.estimatedAmount)}</p>
              </div>
              <div className="space-y-1">
                {order.items.map((item: any) => (
                  <div key={item.productName} className="flex justify-between text-[11px]">
                    <span className="text-slate-600 font-medium">{item.productName}</span>
                    <span className="font-bold">{formatNumber(item.dispatchedQuantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
