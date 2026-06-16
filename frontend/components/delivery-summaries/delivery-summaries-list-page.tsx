'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar, Search, Filter, Plus, 
  FileText, Printer, Trash2, Eye,
  Building2, MapPin, CheckCircle, Clock
} from 'lucide-react';
import { PageCard } from '@/components/ui/page-card';
import { useToast } from '@/components/ui/toast-provider';
import { Pagination } from '@/components/ui/pagination';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { getDeliverySummaries, deleteDeliverySummary, syncDeliverySummary } from '@/lib/api/delivery-summaries';
import { useCompanies, useRoutes } from '@/hooks/use-common-queries';
import Link from 'next/link';

export function DeliverySummariesListPage() {
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  
  const [summaries, setSummaries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter States
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [companyId, setCompanyId] = useState('');
  const [routeId, setRouteId] = useState('');

  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();

  const fetchSummaries = async () => {
    try {
      setIsLoading(true);
      const data = await getDeliverySummaries({
        startDate: date,
        endDate: date,
        companyId: companyId || undefined,
        routeId: routeId || undefined,
        page,
        limit: 15,
      });
      setSummaries(data.items || []);
      setTotalItems(data.totalItems || 0);
    } catch (e) {
      showErrorToast('Failed to fetch delivery summaries');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, [date, companyId, routeId, page]);

  const handleSync = async () => {
    if (!companyId || !routeId) {
      showErrorToast('Please select company and route to sync orders');
      return;
    }
    try {
      setIsSyncing(true);
      await syncDeliverySummary({ date, companyId: Number(companyId), routeId: Number(routeId) });
      showSuccessToast('Orders synced successfully');
      fetchSummaries();
    } catch (e: any) {
      showErrorToast(e.message || 'Failed to sync orders');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this summary?')) return;
    try {
      await deleteDeliverySummary(id);
      showSuccessToast('Summary deleted');
      fetchSummaries();
    } catch (e) {
      showErrorToast('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Delivery Summaries</h1>
          <p className="text-sm text-slate-500">Aggregate orders by date, company, and route.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/sales/print?date=${date}&companyId=${companyId}&routeId=${routeId}&scope=${companyId ? 'company' : 'all'}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Print Daily Summary
          </Link>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : <Plus className="h-4 w-4" />} Sync Orders
          </button>
        </div>
      </div>

      <PageCard>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Delivery Date</label>
            <input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setPage(1); }}
              className="w-full rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Company</label>
            <select
              value={companyId}
              onChange={e => { setCompanyId(e.target.value); setPage(1); }}
              className="w-full rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Select Company</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Route</label>
            <select
              value={routeId}
              onChange={e => { setRouteId(e.target.value); setPage(1); }}
              className="w-full rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Select Route</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
      </PageCard>

      <PageCard noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-5">Summary Info</th>
                <th className="px-6 py-5">Company / Route</th>
                <th className="px-6 py-5 text-right">Total Amount</th>
                <th className="px-6 py-5 text-center">Status</th>
                <th className="px-6 py-5 text-center">Prints</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-medium">Loading...</td>
                </tr>
              ) : summaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-medium">No summaries found for this date.</td>
                </tr>
              ) : (
                summaries.map((s) => (
                  <tr key={s.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-black text-slate-900">#{s.id.toString().padStart(4, '0')}</p>
                      <p className="text-xs font-medium text-slate-400">{formatDate(s.deliveryDate)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" /> {s.company.name}
                      </p>
                      <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" /> {s.route.name}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-base font-black text-slate-900">{formatCurrency(s.totalAmount)}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        s.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {s.status === 'COMPLETED' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${s.morningPrinted ? 'bg-emerald-500' : 'bg-slate-200'}`} title="Morning Printed" />
                        <span className={`h-2 w-2 rounded-full ${s.finalPrinted ? 'bg-emerald-500' : 'bg-slate-200'}`} title="Final Printed" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/delivery-summaries/${s.id}`}
                          className="rounded-xl bg-indigo-50 p-2 text-indigo-600 hover:bg-indigo-100 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="rounded-xl bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-white px-6 py-4">
          <Pagination
            currentPage={page}
            totalItems={totalItems}
            pageSize={15}
            onPageChange={setPage}
          />
        </div>
      </PageCard>
    </div>
  );
}
