'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getDailySummaryReport, DailySummaryReport } from '@/lib/api/sales';
import { formatCurrency, formatNumber, formatUnitPrice } from '@/lib/utils/format';

function ReportContent() {
  const searchParams = useSearchParams();
  const [report, setReport] = useState<DailySummaryReport | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      const date = searchParams.get('date') || undefined;
      const scope = (searchParams.get('scope') as 'all' | 'company') || 'all';
      const companyId = searchParams.get('companyId') ? Number(searchParams.get('companyId')) : undefined;

      try {
        const data = await getDailySummaryReport({ date, scope, companyId });
        setReport(data);
        
        // Trigger print after rendering
        setTimeout(() => {
          window.print();
        }, 800);
      } catch (err: any) {
        console.error('Failed to load summary report:', err);
        setError(err.message || 'Failed to fetch report data');
      } finally {
        setIsReady(true);
      }
    }
    loadReport();
  }, [searchParams]);

  if (!isReady) return <div className="p-8 text-center text-slate-500 font-medium animate-pulse">Preparing report...</div>;
  
  if (error) {
      return (
          <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 text-rose-600 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Error Loading Report</h2>
              <p className="text-slate-500 max-w-md mx-auto">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                  Try Again
              </button>
          </div>
      );
  }

  if (!report || report.groups.length === 0) {
      return (
        <div className="bg-white p-12 text-center min-h-screen">
            <div className="max-w-2xl mx-auto border-2 border-dashed border-slate-200 rounded-3xl p-12">
                <p className="text-slate-400 text-lg mb-2">No sales data found for the selected criteria.</p>
                <p className="text-slate-300 text-sm">Please make sure you have entered sales for this date.</p>
            </div>
        </div>
      );
  }

  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto printable-report text-sm m-0 min-h-screen">
      <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
        <h1 className="text-3xl font-black uppercase tracking-widest text-slate-900">Daily Sales Summary</h1>
        <p className="mt-2 text-slate-600 font-medium">Date: {new Date(report.date).toLocaleDateString()}</p>
        <p className="text-slate-500 text-[10px] mt-1">Printed At: {new Date().toLocaleString()}</p>
        {report.scope === 'company' && report.groups.length > 0 && (
          <p className="mt-2 text-indigo-700 font-bold uppercase tracking-wider">{report.groups[0].companyName}</p>
        )}
      </div>

      <div className="space-y-8">
        {report.groups.map((group) => (
          <div key={group.companyId} className="page-break-inside-avoid">
            {report.scope === 'all' && (
              <h2 className="text-lg font-bold text-slate-800 bg-slate-50 px-3 py-2 border-l-4 border-slate-900 mb-4 uppercase tracking-wider">
                {group.companyName}
              </h2>
            )}
            <table className="w-full mb-2">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="py-2 px-2 text-left font-bold text-slate-900 w-12">SL</th>
                  <th className="py-2 px-2 text-left font-bold text-slate-900">Product Name</th>
                  <th className="py-2 px-2 text-right font-bold text-slate-900 w-28">Qty Sold</th>
                  <th className="py-2 px-2 text-right font-bold text-slate-900 w-28">Avg Rate</th>
                  <th className="py-2 px-2 text-right font-bold text-slate-900 w-32">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, index) => (
                  <tr key={item.productId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="py-2 px-2 text-slate-500">{index + 1}</td>
                    <td className="py-2 px-2 font-bold text-slate-900">{item.productName}</td>
                    <td className="py-2 px-2 text-right font-bold text-slate-800">{formatNumber(item.quantitySold)}</td>
                    <td className="py-2 px-2 text-right font-medium text-slate-600">{formatUnitPrice(item.unitPrice)}</td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900">{formatCurrency(item.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                    <td colSpan={2} className="py-3 px-2 font-bold text-slate-900 text-right">Subtotal:</td>
                    <td className="py-3 px-2 text-right font-black text-slate-900 border-t border-slate-200 bg-slate-50">{formatNumber(group.subtotalQuantity)}</td>
                    <td></td>
                    <td className="py-3 px-2 text-right font-black text-indigo-700 border-t border-slate-200 bg-slate-50">{formatCurrency(group.subtotalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-6 border-t-2 border-slate-900 page-break-inside-avoid">
          <div className="flex justify-between items-start">
              <div className="text-xs text-slate-400">
                  <p>Daily Summary Report</p>
                  <p>ERP System</p>
              </div>
              <div className="w-80 space-y-3">
                <div className="flex justify-between font-bold text-slate-800 text-lg border-b border-slate-100 pb-2">
                  <span className="uppercase tracking-tighter text-xs text-slate-500 mt-2">Grand Total Qty</span>
                  <span>{formatNumber(report.grandTotalQuantity)}</span>
                </div>
                <div className="flex justify-between font-black text-white bg-slate-900 p-4 rounded-xl shadow-lg">
                  <span className="uppercase tracking-tighter text-xs opacity-70 mt-1">Grand Total Sales</span>
                  <span className="text-2xl">{formatCurrency(report.grandTotalAmount)}</span>
                </div>
              </div>
          </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .printable-report { box-shadow: none; max-width: 100%; margin: 0; padding: 0; width: 100%; }
          nav, aside, header, footer, button { display: none !important; }
          .page-break-inside-avoid { page-break-inside: avoid; }
          @page { margin: 1cm; }
        }
      `}} />
    </div>
  );
}

export default function SalesPrintReportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Loading report...</div>}>
      <ReportContent />
    </Suspense>
  );
}
