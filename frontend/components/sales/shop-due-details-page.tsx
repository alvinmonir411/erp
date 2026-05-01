import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DollarSign, History, Loader2, XCircle } from 'lucide-react';
import { getShopDues } from '@/lib/api/dues';
import { getShop } from '@/lib/api/shops';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';

export function ShopDueDetailsPage({ shopId }: { shopId: number }) {
  const [shop, setShop] = useState<any>(null);
  const [dues, setDues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDue, setSelectedDue] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const refreshDetails = useCallback(
    async (showLoader: boolean) => {
      try {
        if (showLoader) {
          setIsLoading(true);
        }

        setError(null);
        const [shopData, duesData] = await Promise.all([
          getShop(shopId),
          getShopDues(shopId)
        ]);
        setShop(shopData);
        setDues(duesData);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load shop due details.',
        );
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [shopId],
  );

  useEffect(() => {
    void refreshDetails(true);
  }, [refreshDetails]);

  const totalDueAmount = dues.reduce((sum, d) => sum + Number(d.remainingDue), 0);
  const totalPaidAmount = dues.reduce((sum, d) => sum + Number(d.paidAmount), 0);

  return (
    <div className="space-y-6">
      <PageCard
        title="Shop Due Details"
        description="Review outstanding due for this shop, including order details and SR information."
        action={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/shops"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            >
              Back to shops
            </Link>
          </div>
        }
      >
        {isLoading ? <LoadingBlock label="Loading shop ledger..." /> : null}

        {!isLoading && !error && shop ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Shop" value={shop.name} />
            <InfoCard
              label="Route"
              value={shop.route?.name ?? `Route #${shop.routeId}`}
            />
            <InfoCard
              label="Total Paid"
              value={formatCurrency(totalPaidAmount)}
            />
            <InfoCard
              label="Outstanding Due"
              value={formatCurrency(totalDueAmount)}
            />
          </div>
        ) : null}
      </PageCard>

      <PageCard
        title="Outstanding Orders"
        description="List of orders with remaining due balance."
      >
        {isLoading ? <LoadingBlock label="Loading dues..." /> : null}
        {!isLoading && !error && dues ? (
          dues.length > 0 ? (
            <div className="space-y-4">
              {dues.map((due) => (
                <div
                  key={due.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-lg font-black text-slate-900 uppercase">
                        Order #{due.orderId}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-500 uppercase">
                         SR: {due.srName} • {formatDate(due.order?.orderDate || due.createdAt)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${
                            due.status === 'DUE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {due.status}
                        </span>
                        <span className="text-xs font-bold text-slate-500 uppercase">
                          {due.remainingDue > 0 ? `${formatCurrency(due.remainingDue)} still due` : 'Paid'}
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <SummaryPill label="Total Due" value={formatCurrency(due.dueAmount)} />
                      <SummaryPill label="Paid" value={formatCurrency(due.paidAmount)} />
                      <SummaryPill label="Remaining" value={formatCurrency(due.remainingDue)} tone="amber" />
                      <div className="flex items-center justify-center">
                         <button
                            onClick={() => {
                              setSelectedDue(due);
                              setIsHistoryModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                          >
                            <History className="w-4 h-4" />
                            History
                          </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StateMessage
              title="No due remaining"
              description="This shop does not have any outstanding dues right now."
            />
          )
        ) : null}
      </PageCard>

      {isHistoryModalOpen && selectedDue && (
        <HistoryModal 
          due={selectedDue} 
          onClose={() => setIsHistoryModalOpen(false)} 
        />
      )}
    </div>
  );
}

function HistoryModal({ due, onClose }: { due: any, onClose: () => void }) {
  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['order-collections', due.orderId],
    queryFn: () => apiRequest<any[]>(`/dues/order/${due.orderId}/collections`, { method: 'GET' }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-border animate-in slide-in-from-bottom sm:zoom-in duration-200 text-left">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-lg font-bold text-foreground leading-none">Collection History</h3>
            <p className="text-xs font-bold text-muted uppercase mt-1">Shop: {due.shop?.name} · Order #{due.orderId}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-muted" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
             <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                <p className="text-[10px] font-black uppercase text-muted">Original Due</p>
                <p className="text-lg font-bold text-zinc-900">{formatCurrency(due.dueAmount)}</p>
             </div>
             <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                <p className="text-[10px] font-black uppercase text-emerald-600">Total Paid</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(due.paidAmount)}</p>
             </div>
             <div className="rounded-xl bg-rose-50 p-3 border border-rose-100">
                <p className="text-[10px] font-black uppercase text-rose-600">Remaining</p>
                <p className="text-lg font-bold text-rose-700">{formatCurrency(due.remainingDue)}</p>
             </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="bg-zinc-50/50 text-[10px] font-black uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">SR Name</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    </td>
                  </tr>
                ) : collections.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">No history found.</td>
                  </tr>
                ) : (
                  collections.map((c: any) => (
                    <tr key={c.id} className="hover:bg-zinc-50/30">
                      <td className="px-4 py-3 text-xs font-bold text-zinc-600">{new Date(c.collectionDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs font-medium text-zinc-700">{c.srName}</td>
                      <td className="px-4 py-3 text-right font-black text-primary">{formatCurrency(c.collectedAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black border ${
                          c.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          c.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-zinc-50/50 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'amber';
}) {
  const className =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-900'
      : 'bg-white text-slate-900';

  return (
    <div className={`rounded-2xl px-4 py-3 text-sm ${className}`}>
      <p className="text-current/70">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
