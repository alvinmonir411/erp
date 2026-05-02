'use client';

import { use, useEffect, useState } from 'react';
import { getSale } from '@/lib/api/sales';
import { formatCurrency, formatNumber, formatDate, toNumber } from '@/lib/utils/format';
import type { Sale } from '@/types/api';

export default function SaleInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [sale, setSale] = useState<Sale | null>(null);

  useEffect(() => {
    async function loadSale() {
      const saleData = await getSale(Number(id));
      setSale(saleData);
      
      // Auto-trigger print after a short delay for rendering
      setTimeout(() => {
          window.print();
      }, 500);
    }
    loadSale();
  }, [id]);

  if (!sale) return <div className="p-8 text-center">Loading invoice...</div>;

  const invoiceDiscountAmount = toNumber(sale.invoiceDiscountAmount);
  const subtotal = toNumber(sale.totalAmount) + invoiceDiscountAmount;
  const dueAmount = toNumber(sale.dueAmount);

  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto printable-invoice text-sm m-0 min-h-screen">
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-widest text-slate-900">{sale.company?.name || 'INVOICE'}</h1>
          <p className="mt-2 text-slate-600 font-medium">{sale.company?.code}</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-slate-800">INVOICE</h2>
          <p className="font-medium text-slate-600 mt-1">#{sale.invoiceNo}</p>
          <p className="text-slate-500 mt-2">Date: {formatDate(sale.saleDate)}</p>
        </div>
      </div>

      <div className="flex justify-between items-start mb-8">
        <div>
          <p className="font-semibold text-slate-500 uppercase text-xs tracking-wider mb-2">Billed To</p>
          <h3 className="text-xl font-bold text-slate-900">{sale.shop?.name || 'Walk-in Customer'}</h3>
          {sale.shop?.ownerName && <p className="text-slate-700">{sale.shop.ownerName}</p>}
          {sale.shop?.phone && <p className="text-slate-600">Tel: {sale.shop.phone}</p>}
          {sale.shop?.address && <p className="text-slate-600">{sale.shop.address}</p>}
          <p className="text-slate-600 mt-2 font-medium">Route: {sale.route?.name}</p>
        </div>
      </div>

      <table className="w-full mb-8">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="py-3 text-left font-bold text-slate-900">Item Description</th>
            <th className="py-3 text-right font-bold text-slate-900">Qty</th>
            <th className="py-3 text-right font-bold text-slate-900">Free</th>
            <th className="py-3 text-right font-bold text-slate-900">Rate</th>
            <th className="py-3 text-right font-bold text-slate-900">Discount</th>
            <th className="py-3 text-right font-bold text-slate-900">Total</th>
          </tr>
        </thead>
        <tbody>
          {(sale.items ?? []).map((item, index) => {
            const freeQuantity = toNumber(item.freeQuantity);
            const discountAmount = toNumber(item.discountAmount);

            return (
              <tr key={index} className="border-b border-slate-100 last:border-0">
                <td className="py-4">
                  <p className="font-bold text-slate-900">{item.product?.name}</p>
                  <p className="text-xs text-slate-500">SKU: {item.product?.sku}</p>
                </td>
                <td className="py-4 text-right font-medium text-slate-800">{formatNumber(item.quantity)} {item.product?.unit}</td>
                <td className="py-4 text-right font-medium text-slate-500">{freeQuantity > 0 ? `${formatNumber(freeQuantity)} ${item.product?.unit}` : '-'}</td>
                <td className="py-4 text-right font-medium text-slate-800">{formatCurrency(item.unitPrice)}</td>
                <td className="py-4 text-right font-medium text-slate-500">
                  {discountAmount > 0 ? formatCurrency(discountAmount) : '-'}
                </td>
                <td className="py-4 text-right font-bold text-slate-900">{formatCurrency(item.lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-end pt-4 border-t-2 border-slate-200">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-slate-700">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          
          {invoiceDiscountAmount > 0 ? (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Invoice Discount</span>
              <span>-{formatCurrency(invoiceDiscountAmount)}</span>
            </div>
          ) : null}

          <div className="flex justify-between text-xl font-bold text-slate-900 pt-3 border-t border-slate-200">
            <span>Total</span>
            <span>{formatCurrency(sale.totalAmount)}</span>
          </div>

          <div className="flex justify-between text-slate-700 pt-3">
            <span>Paid Amount</span>
            <span className="font-medium">{formatCurrency(sale.paidAmount)}</span>
          </div>

          {dueAmount > 0 && (
            <div className="flex justify-between text-rose-600 font-bold pt-1">
              <span>Due Balance</span>
              <span>{formatCurrency(dueAmount)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-slate-200 text-center text-sm text-slate-500">
        <p>Thank you for your business!</p>
        {sale.note && <p className="mt-2 italic">Note: {sale.note}</p>}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .printable-invoice { box-shadow: none; max-width: 100%; margin: 0; padding: 0; }
          nav, aside, header, footer { display: none !important; }
        }
      `}} />
    </div>
  );
}
