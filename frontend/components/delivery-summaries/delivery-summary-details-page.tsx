'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Save, Printer, RefreshCw, 
  Package, ShoppingCart, RotateCcw, Building2, 
  MapPin, Calendar, FileText
} from 'lucide-react';
import { PageCard } from '@/components/ui/page-card';
import { useToast } from '@/components/ui/toast-provider';
import { formatCurrency, formatNumber, formatDate, formatUnitPrice } from '@/lib/utils/format';
import { 
  getDeliverySummary, updateDeliveryReturns, markDeliveryAsPrinted 
} from '@/lib/api/delivery-summaries';
import Link from 'next/link';

export function DeliverySummaryDetailsPage({ id }: { id: string }) {
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [returns, setReturns] = useState<Record<number, string>>({});

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      const data = await getDeliverySummary(Number(id));
      setSummary(data);
      
      const returnsMap: Record<number, string> = {};
      data.items.forEach((item: any) => {
        returnsMap[item.productId] = item.returnedQuantity.toString();
      });
      setReturns(returnsMap);
    } catch (e) {
      showErrorToast('Failed to load summary');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [id]);

  const handleReturnChange = (productId: number, value: string) => {
    setReturns(prev => ({ ...prev, [productId]: value }));
  };

  const handleSaveReturns = async () => {
    try {
      setIsSaving(true);
      const items = Object.entries(returns).map(([productId, qty]) => ({
        productId: Number(productId),
        returnedQuantity: Number(qty || 0),
      }));
      
      await updateDeliveryReturns(Number(id), items);
      showSuccessToast('Returns updated and stock adjusted');
      fetchSummary();
    } catch (e) {
      showErrorToast('Failed to save returns');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async (mode: 'morning' | 'final') => {
    try {
      await markDeliveryAsPrinted(Number(id), mode);
      window.print();
      fetchSummary();
    } catch (e) {
      console.error('Failed to mark as printed');
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400 font-medium animate-pulse">Loading summary...</div>;
  if (!summary) return <div className="p-8 text-center text-slate-400 font-medium">Summary not found.</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/delivery-summaries" className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Summary #{summary.id.toString().padStart(4, '0')}</h1>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(summary.deliveryDate)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {summary.company.name}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {summary.route.name}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handlePrint('morning')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Printer className="h-4 w-4" /> Morning Print
          </button>
          <button
            onClick={() => handlePrint('final')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Printer className="h-4 w-4" /> Final Print
          </button>
          <button
            onClick={handleSaveReturns}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 
            Save Returns
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <PageCard noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-6 py-5">Product Name</th>
                    <th className="px-6 py-5 text-center">Ordered Qty</th>
                    <th className="px-6 py-5 text-center">Returned Qty</th>
                    <th className="px-6 py-5 text-center">Sold Qty</th>
                    <th className="px-6 py-5 text-right">Price</th>
                    <th className="px-6 py-5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {summary.items.map((item: any) => {
                    const currentReturn = Number(returns[item.productId] || 0);
                    const currentSold = item.orderedQuantity - currentReturn;
                    const currentTotal =
                      Math.round(currentSold * Number(item.unitPrice || 0) * 100) / 100;

                    return (
                      <tr key={item.id} className="group hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{item.product.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.product.unit}</p>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-700">
                          {formatNumber(item.orderedQuantity)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="number"
                            min="0"
                            max={item.orderedQuantity}
                            value={returns[item.productId] || '0'}
                            onChange={e => handleReturnChange(item.productId, e.target.value)}
                            className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-black text-rose-600 focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                          />
                        </td>
                        <td className="px-6 py-4 text-center font-black text-emerald-600">
                          {formatNumber(currentSold)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-500">
                          {formatUnitPrice(item.unitPrice)}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">
                          {formatCurrency(currentTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PageCard>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-xl shadow-slate-200">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Final Summary</p>
            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/10 p-2"><Package className="h-4 w-4" /></div>
                  <span className="text-sm font-bold opacity-60">Total Ordered</span>
                </div>
                <span className="text-lg font-black">{formatNumber(summary.items.reduce((s: number, i: any) => s + Number(i.orderedQuantity), 0))}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="rounded-xl bg-rose-400/10 p-2"><RotateCcw className="h-4 w-4" /></div>
                  <span className="text-sm font-bold">Total Returned</span>
                </div>
                <span className="text-lg font-black text-rose-400">
                  {formatNumber(Object.values(returns).reduce((s, v) => s + Number(v || 0), 0))}
                </span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-emerald-400">
                  <div className="rounded-xl bg-emerald-400/10 p-2"><ShoppingCart className="h-4 w-4" /></div>
                  <span className="text-sm font-bold">Total Sold</span>
                </div>
                <span className="text-lg font-black text-emerald-400">
                   {formatNumber(summary.items.reduce((s: number, i: any) => s + Number(i.orderedQuantity), 0) - Object.values(returns).reduce((s, v) => s + Number(v || 0), 0))}
                </span>
              </div>
              <div className="mt-10 pt-10 border-t border-white/10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Grand Total Amount</p>
                <p className="mt-2 text-4xl font-black text-indigo-400">{formatCurrency(summary.totalAmount)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
             <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" /> Print Settings
             </h3>
             <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                   <span className="text-slate-500 font-medium">Morning Summary</span>
                   {summary.morningPrinted ? 
                      <span className="text-emerald-600 font-black flex items-center gap-1">DONE</span> : 
                      <span className="text-slate-300 font-black uppercase tracking-tighter">PENDING</span>
                   }
                </div>
                <div className="flex items-center justify-between text-xs">
                   <span className="text-slate-500 font-medium">Final Delivery</span>
                   {summary.finalPrinted ? 
                      <span className="text-emerald-600 font-black flex items-center gap-1">DONE</span> : 
                      <span className="text-slate-300 font-black uppercase tracking-tighter">PENDING</span>
                   }
                </div>
             </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { -webkit-print-color-adjust: exact; }
          nav, aside, header, .pb-20, button, .rounded-2xl { display: none !important; }
          .lg\\:col-span-3 { width: 100% !important; grid-column: span 4 / span 4 !important; }
          .lg\\:grid-cols-4 { display: block !important; }
          .space-y-6 { margin: 0 !important; }
          .PageCard { border: none !important; box-shadow: none !important; padding: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border-bottom: 1px solid #e2e8f0 !important; }
          .printable-only { display: block !important; }
          @page { margin: 1.5cm; }
        }
      `}} />
    </div>
  );
}
