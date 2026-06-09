'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileBarChart2, ArrowLeft, Filter, Calendar, Building2, MapPin, DollarSign, TrendingUp, Wallet, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageCard } from '@/components/ui/page-card';
import { useToast } from '@/components/ui/toast-provider';
import { useCompanies, useRoutes } from '@/hooks/use-common-queries';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { User } from '@/types/api';
import { Role } from '@/types/api';
import { getUsersByRole } from '@/lib/api/users';
import { StateMessage } from '../ui/state-message';
import { getDispatchReports, deleteDispatchBatch } from '@/lib/api/delivery-ops';
import { Trash2 } from 'lucide-react';
import { DeleteBatchConfirmModal } from './delivery-ops-dashboard-page';

export function DeliveryReportsPage() {
  const router = useRouter();
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [companyId, setCompanyId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [deliveryPersonId, setDeliveryPersonId] = useState('');
  const [report, setReport] = useState<any>(null);
  const [deliveryMen, setDeliveryMen] = useState<User[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<{ id: number; batchNo: string; isSettled: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/delivery-ops');
    }
  };

  const fetchReport = async () => {
    try {
      const [men, reportData] = await Promise.all([
        getUsersByRole(Role.DELIVERY_MAN),
        getDispatchReports({
          dispatchDate,
          companyId: companyId ? Number(companyId) : undefined,
          routeId: routeId ? Number(routeId) : undefined,
          deliveryPersonId: deliveryPersonId ? Number(deliveryPersonId) : undefined,
        }),
      ]);
      setDeliveryMen(men);
      setReport(reportData);
    } catch (error) {
      showErrorToast('Failed to load delivery reports');
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dispatchDate, companyId, routeId, deliveryPersonId]);

  const handleDeleteClick = (id: number, batchNo: string, status: string) => {
    const isSettled = status === 'SETTLED' || status === 'PARTIALLY_SETTLED';
    setBatchToDelete({ id, batchNo, isSettled });
  };

  const handleConfirmDelete = async () => {
    if (!batchToDelete) return;
    
    try {
      setIsDeleting(true);
      await deleteDispatchBatch(batchToDelete.id);
      showSuccessToast('Batch deleted successfully');
      setBatchToDelete(null);
      fetchReport();
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to delete batch');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white px-4 py-3 border-b border-slate-100 lg:hidden">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 font-bold text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-slate-900">Reports</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-xl transition-colors ${showFilters ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      <div className="hidden lg:block pt-4 lg:pt-0">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700">
          Delivery Reporting
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
          Dispatch, Return & Settlement Reports
        </h1>
      </div>

      <div className={`${showFilters ? 'block' : 'hidden'} lg:block pt-12 lg:pt-0`}>
        <PageCard>
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dispatch Date</label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(event) => setDispatchDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Company</label>
              <select
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Route</label>
              <select
                value={routeId}
                onChange={(event) => setRouteId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition"
              >
                <option value="">All Routes</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Staff</label>
              <select
                value={deliveryPersonId}
                onChange={(event) => setDeliveryPersonId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition"
              >
                <option value="">All Delivery Men</option>
                {deliveryMen.map((man) => (
                  <option key={man.id} value={man.id}>
                    {man.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </PageCard>
      </div>

      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-xl"><DollarSign className="h-4 w-4 text-slate-400" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Gross Dispatch</p>
              <h3 className="mt-1 text-lg font-black text-slate-900 truncate">{formatCurrency(report?.totals?.grossDispatchedValue || 0)}</h3>
            </div>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl"><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Final Sold</p>
              <h3 className="mt-1 text-lg font-black text-emerald-700 truncate">{formatCurrency(report?.totals?.finalSoldValue || 0)}</h3>
            </div>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-50 rounded-xl"><Wallet className="h-4 w-4 text-cyan-600" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Collected</p>
              <h3 className="mt-1 text-lg font-black text-cyan-700 truncate">{formatCurrency(report?.totals?.totalCollectedAmount || 0)}</h3>
            </div>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl"><AlertCircle className="h-4 w-4 text-amber-600" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Due</p>
              <h3 className="mt-1 text-lg font-black text-amber-700 truncate">{formatCurrency(report?.totals?.totalDueAmount || 0)}</h3>
            </div>
          </div>
        </div>
      </div>

      <PageCard noPadding title="Batch Reports" description="Detailed financial result of each batch." className="hidden lg:block">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Delivery Man</th>
                <th className="px-6 py-4 text-right">Gross</th>
                <th className="px-6 py-4 text-right">Final</th>
                <th className="px-6 py-4 text-right">Collected</th>
                <th className="px-6 py-4 text-right">Due</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(report?.rows || []).map((row: any) => (
                <tr key={row.id} className="transition hover:bg-slate-50/60">
                  <td className="px-6 py-4">
                    <Link href={`/delivery-ops/batches/${row.id}`} className="text-sm font-black text-slate-900 hover:text-cyan-700">
                      {row.batchNo}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{formatDate(row.dispatchDate)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{row.deliveryPerson}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{formatCurrency(row.grossDispatchedValue)}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-emerald-700">{formatCurrency(row.finalSoldValue)}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-cyan-700">{formatCurrency(row.totalCollectedAmount)}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-amber-700">{formatCurrency(row.totalDueAmount)}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(row.id, row.batchNo, row.status);
                      }}
                      className="text-red-500 hover:text-red-600 transition-colors"
                      title="Delete Batch"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>

      {/* Mobile Card List */}
      <div className="lg:hidden space-y-4">
        {(report?.rows || []).map((row: any) => (
          <div key={row.id} className="bg-white rounded-3xl border border-slate-100 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xs font-black">
                  #{row.batchNo.slice(-3)}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatDate(row.dispatchDate)}</p>
                  <Link href={`/delivery-ops/batches/${row.id}`} className="font-black text-slate-900 hover:text-cyan-600">{row.batchNo}</Link>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Staff</p>
                <p className="text-xs font-bold text-slate-600">{row.deliveryPerson}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gross</p>
                <p className="text-sm font-black text-slate-900">{formatCurrency(row.grossDispatchedValue)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Final Sold</p>
                <p className="text-sm font-black text-emerald-600">{formatCurrency(row.finalSoldValue)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Collected</p>
                <p className="text-sm font-black text-cyan-600">{formatCurrency(row.totalCollectedAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due Amt</p>
                <p className="text-sm font-black text-rose-600">{formatCurrency(row.totalDueAmount)}</p>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-slate-50">
               <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(row.id, row.batchNo, row.status);
                  }}
                  className="flex items-center gap-1.5 text-xs font-black text-red-500 hover:text-red-600 uppercase tracking-widest"
                >
                  <Trash2 className="h-4 w-4" /> Delete
               </button>
            </div>
          </div>
        ))}
        {!report?.rows?.length && (
          <div className="py-20 bg-white rounded-[2rem] border border-slate-100">
            <StateMessage
              title="No reports found"
              description="Try adjusting your filters."
              icon={<FileBarChart2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />}
            />
          </div>
        )}
      </div>
      {batchToDelete && (
        <DeleteBatchConfirmModal
          isOpen={!!batchToDelete}
          onClose={() => setBatchToDelete(null)}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
          batchNo={batchToDelete.batchNo}
          isSettled={batchToDelete.isSettled}
        />
      )}
    </div>
  );
}
