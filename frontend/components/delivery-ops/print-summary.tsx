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
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; }
          .printable-report { p-0 !important; max-width: none !important; }
        }
        .printable-report table { border-collapse: collapse; width: 100%; min-width: 600px; }
        .printable-report th, .printable-report td { border: 1px solid #000; padding: 6px 8px; }
      `}} />

      {/* Header Section */}
      <div className="text-center mb-6">
        <div className="text-2xl font-bold uppercase mb-1">{report.company?.name || 'Ka'}</div>
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
            <span className="font-bold">Delivery Personnel:</span> {report.deliveryPerson.name}
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
            const soldQty = Number(item.delivered || 0);
            const unitPrice = soldQty > 0 ? Number(item.finalSoldAmount) / soldQty : 0;
            const totalAmount = Number(item.finalSoldAmount || 0);
            
            // Calculate due for this product row
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
                <td className="font-medium">{item.productName}</td>
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

      {/* Summary Aligned Rows */}
      <div className="mt-8 flex justify-end">
        <div className="w-64 space-y-2 border-t border-black pt-4">
          <div className="flex justify-between text-xs font-medium">
            <span>Total Quantity:</span>
            <span>{formatNumber(report.summary.totalDispatchedQty || products.reduce((s,i) => s+Number(i.dispatched),0))}</span>
          </div>
          <div className="flex justify-between text-xs font-medium">
            <span>Returned:</span>
            <span>{formatNumber(products.reduce((s,i) => s+Number(i.returned),0))}</span>
          </div>
          <div className="flex justify-between text-xs font-medium">
            <span>Damaged:</span>
            <span>{formatNumber(products.reduce((s,i) => s+Number(i.damaged),0))}</span>
          </div>
          <div className="flex justify-between text-xs font-bold border-b border-black pb-2">
            <span>Sold:</span>
            <span>{formatNumber(products.reduce((s,i) => s+Number(i.delivered),0))}</span>
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
              </>
            );
          })()}
        </div>
      </div>

      {(() => {
        const ordersWithDue = report.orders.filter((order: any) => {
          const due = draftDues[order.orderId] !== undefined ? draftDues[order.orderId] : Number(order.dueAmount || 0);
          return due > 0;
        });

        if (ordersWithDue.length === 0) return null;

        return (
          <div className="mt-12 break-inside-avoid">
            <h2 className="text-sm font-black uppercase tracking-widest border-b border-black mb-4 inline-block">Due / Baki Details</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 uppercase font-bold text-[10px]">
                  <th className="w-8 text-center border border-black p-2">SL</th>
                  <th className="text-left border border-black p-2">Shop</th>
                  <th className="text-left border border-black p-2">Order</th>
                  <th className="text-left border border-black p-2">SR</th>
                  <th className="text-left border border-black p-2">Product</th>
                  <th className="text-right border border-black p-2">Due Amount</th>
                  <th className="text-left border border-black p-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {ordersWithDue.map((order: any, idx: number) => {
                  const due = draftDues[order.orderId] !== undefined ? draftDues[order.orderId] : Number(order.dueAmount || 0);
                  const productNames = order.items.map((i: any) => i.productName).join(', ');
                  return (
                    <tr key={order.orderId}>
                      <td className="text-center border border-black p-2">{idx + 1}</td>
                      <td className="border border-black p-2 font-bold">{order.shopName}</td>
                      <td className="border border-black p-2">#{order.orderId}</td>
                      <td className="border border-black p-2">{report.deliveryPerson?.name}</td>
                      <td className="border border-black p-2 text-slate-600">{productNames}</td>
                      <td className="border border-black p-2 text-right font-bold text-amber-600">{formatCurrency(due)}</td>
                      <td className="border border-black p-2"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      <div className="mt-20 grid grid-cols-3 gap-10">
        <div className="border-t border-black pt-2 text-center text-[10px] font-bold uppercase tracking-widest">
          Delivery Man Signature
        </div>
        <div className="border-t border-black pt-2 text-center text-[10px] font-bold uppercase tracking-widest">
          Authorized Signature
        </div>
        <div className="border-t border-black pt-2 text-center text-[10px] font-bold uppercase tracking-widest">
          Cash Received By
        </div>
      </div>
    </div>
  );
}

function FieldLayout({ report }: { report: any }) {
  // Aggregate items across all orders (though morning report usually already has itemWiseTotals)
  const items = report.itemWiseTotals || [];
  
  // Sort alphabetically
  const sortedItems = [...items].sort((a, b) => a.productName.localeCompare(b.productName));

  return (
    <div className="mt-8 min-w-[700px]">
      <table className="w-full border-2 border-slate-900 border-collapse">
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
          {/* Empty rows for manual entry if needed */}
          {sortedItems.length < 15 && Array.from({ length: Math.max(0, 15 - sortedItems.length) }).map((_, i) => (
            <tr key={`empty-${i}`} className="h-10">
              <td className="border-2 border-slate-900 px-2 py-3"></td>
              <td className="border-2 border-slate-900 px-3 py-3"></td>
              <td className="border-2 border-slate-900 px-2 py-3"></td>
              <td className="border-2 border-slate-900 px-2 py-3"></td>
              <td className="border-2 border-slate-900 px-2 py-3"></td>
              <td className="border-2 border-slate-900 px-2 py-3"></td>
              <td className="border-2 border-slate-900 px-2 py-3"></td>
              <td className="border-2 border-slate-900 px-3 py-3"></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bottom Summary */}
      <div className="mt-6 flex justify-end">
        <div className="border-2 border-slate-900 px-6 py-3 bg-slate-50">
          <p className="text-lg font-black">
            TOTAL AMOUNT: {formatCurrency(report.estimatedTotalAmount)}
          </p>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-20">
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
      {/* Item Summary Table */}
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

      {/* Order Breakdown */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest border-l-4 border-slate-900 pl-3 mb-4">
          Order Breakdown
        </h2>
        <div className="grid gap-4 grid-cols-2">
          {report.selectedOrders.map((order: any) => (
            <div key={order.orderId} className="rounded-xl border-2 border-slate-100 p-4 break-inside-avoid">
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


