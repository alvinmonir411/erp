'use client';

import { useQuery } from '@tanstack/react-query';
import { getDues } from '@/lib/api/dues';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { 
  AlertCircle, 
  Store, 
  Calendar, 
  ArrowRight,
  CheckCircle2,
  Clock
} from 'lucide-react';
import Link from 'next/link';

export function SRDuesList() {
  const { data: dues, isLoading } = useQuery({
    queryKey: ['dues', 'my-list'],
    queryFn: () => getDues(),
  });

  if (isLoading) {
    return <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!dues || dues.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-100 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-sm font-black text-slate-900 uppercase">All Cleared!</h3>
        <p className="mt-1 text-xs font-bold text-slate-400 uppercase">You have no outstanding dues to collect.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {dues.map((due: any) => (
        <div 
          key={due.id} 
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-500/5"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 line-clamp-1">{due.shop?.name || 'Missing Shop'}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{due.route?.name || 'No Route'}</p>
                </div>
              </div>
              <div className={`flex h-6 items-center rounded-full px-2 text-[8px] font-black uppercase tracking-widest ${due.remainingDue > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {due.remainingDue > 0 ? 'Pending' : 'Cleared'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-[8px] font-black uppercase text-slate-400">Due Amount</p>
                <p className="text-sm font-black text-slate-900">{formatCurrency(due.dueAmount)}</p>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase text-slate-400">Remaining</p>
                <p className="text-sm font-black text-rose-600">{formatCurrency(due.remainingDue)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
               <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="h-3 w-3" />
                  <span className="text-[9px] font-bold uppercase">{formatDate(due.createdAt)}</span>
               </div>
               <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span className="text-[9px] font-bold uppercase">Order #{due.orderId}</span>
               </div>
            </div>
          </div>

          <Link 
            href={`/sales/shops/${due.shopId}`}
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800"
          >
            Collect Now
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ))}
    </div>
  );
}
