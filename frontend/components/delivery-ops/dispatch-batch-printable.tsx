'use client';

import { formatCurrency, formatNumber } from '@/lib/utils/format';

interface PrintableProps {
  report: any;
  mode: 'morning' | 'final';
}

export function DispatchBatchPrintable({ report, mode }: PrintableProps) {
  if (!report) return null;

  if (mode === 'morning') {
    return (
      <div className="mx-auto bg-white p-8 text-sm text-black printable-report">
        <div className="border-b-2 border-slate-900 pb-5 text-center">
          <div className="text-3xl font-black uppercase mb-1 tracking-widest">MS KARIM TRADERS</div>
          <h1 className="text-xl font-bold uppercase tracking-[0.25em] text-slate-500">Morning Delivery Summary</h1>
          <p className="mt-2 font-medium text-slate-600">
            Batch {report.batchNo} · {new Date(report.dispatchDate).toLocaleDateString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Delivery Man: {report.assignedDeliveryMan?.name || report.deliveryPerson?.name} · Route: {report.route.name}
          </p>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Item-wise Total Quantity</h2>
            <table className="mt-4 w-full">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="py-2 text-left">Product</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Est. Value</th>
                </tr>
              </thead>
              <tbody>
                {report.itemWiseTotals.map((item: any) => (
                  <tr key={item.productName} className="border-b border-slate-100">
                    <td className="py-2 font-bold">{item.productName}</td>
                    <td className="py-2 text-right font-bold">{formatNumber(item.quantity)}</td>
                    <td className="py-2 text-right font-bold">{formatCurrency(item.estimatedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Order Breakdown</h2>
            <div className="mt-4 space-y-3">
              {report.selectedOrders.map((order: any) => (
                <div key={order.orderId} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">Order #{String(order.orderId).padStart(6, '0')}</p>
                      <p className="text-xs text-slate-500">{order.shopName}</p>
                    </div>
                    <div className="text-right text-xs font-bold text-slate-500">
                      <p>{formatCurrency(order.estimatedAmount)}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    {order.items.map((item: any) => (
                      <p key={item.productName}>
                        {item.productName} · {formatNumber(item.dispatchedQuantity)}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-end border-t-2 border-slate-900 pt-5">
          <div className="w-80 rounded-2xl bg-slate-900 p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Estimated Total Amount</p>
            <p className="mt-2 text-3xl font-black">{formatCurrency(report.estimatedTotalAmount)}</p>
          </div>
        </div>
        <PrintStyles />
      </div>
    );
  }

  return (
    <div className="mx-auto bg-white p-8 text-sm text-black printable-report">
      <div className="border-b-2 border-slate-900 pb-5 text-center">
        <div className="text-3xl font-black uppercase mb-1 tracking-widest">MS KARIM TRADERS</div>
        <h1 className="text-xl font-bold uppercase tracking-[0.25em] text-slate-500">Final Delivery Settlement</h1>
        <p className="mt-2 font-medium text-slate-600">
          Batch {report.batchNo} · {new Date(report.dispatchDate).toLocaleDateString()}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Delivery Man: {report.assignedDeliveryMan?.name || report.deliveryPerson?.name} · Route: {report.route.name}
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Gross Dispatch', report.summary.grossDispatchedValue],
          ['Return Adjusted', report.summary.returnAdjustedValue],
          ['Final Sold', report.summary.finalSoldValue],
          ['Collected', report.summary.totalCollectedAmount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="mt-2 text-xl font-black">{formatCurrency(Number(value))}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Order Settlement Breakdown</h2>
        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b border-slate-300 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <th className="py-2 text-left">Order</th>
              <th className="py-2 text-right">Final Sold</th>
              <th className="py-2 text-right">Advance</th>
              <th className="py-2 text-right">Collected</th>
              <th className="py-2 text-right">Due</th>
            </tr>
          </thead>
          <tbody>
            {report.orders.map((order: any) => (
              <tr key={order.orderId} className="border-b border-slate-100">
                <td className="py-2">
                  <p className="font-black">#{String(order.orderId).padStart(6, '0')}</p>
                  <p className="text-xs text-slate-500">{order.shopName}</p>
                </td>
                <td className="py-2 text-right font-bold">{formatCurrency(order.calculations.finalSoldAmount)}</td>
                <td className="py-2 text-right font-bold">{formatCurrency(order.advancePaid || 0)}</td>
                <td className="py-2 text-right font-bold">{formatCurrency(order.collectedAmount || 0)}</td>
                <td className="py-2 text-right font-bold">{formatCurrency(order.dueAmount || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Product Reconciliation</h2>
        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b border-slate-300 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <th className="py-2 text-left">Product</th>
              <th className="py-2 text-right">Dispatched</th>
              <th className="py-2 text-right">Returned</th>
              <th className="py-2 text-right">Damaged</th>
              <th className="py-2 text-right">Delivered</th>
            </tr>
          </thead>
          <tbody>
            {report.productSummary.map((item: any) => (
              <tr key={item.productName} className="border-b border-slate-100">
                <td className="py-2 font-bold">{item.productName}</td>
                <td className="py-2 text-right font-bold">{formatNumber(item.dispatched)}</td>
                <td className="py-2 text-right font-bold">{formatNumber(item.returned)}</td>
                <td className="py-2 text-right font-bold">{formatNumber(item.damaged)}</td>
                <td className="py-2 text-right font-bold">{formatNumber(item.delivered)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PrintStyles />
    </div>
  );
}

function PrintStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @media print {
            /* Hide everything by default */
            body * { 
              visibility: hidden !important; 
            }
            
            /* Show only the print area and its contents */
            #print-area, #print-area * { 
              visibility: visible !important; 
            }
            
            /* Position the print area at the very top left */
            #print-area { 
              position: absolute !important; 
              left: 0 !important; 
              top: 0 !important; 
              width: 100% !important; 
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            
            /* Reset page margins */
            @page { 
              margin: 1.5cm;
              size: auto;
            }

            /* Ensure no background colors are stripped */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `,
      }}
    />
  );
}
