'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { History, Loader2, PlusCircle, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getShopDues } from '@/lib/api/dues';
import { addManualDue } from '@/lib/api/sales';
import { getShop } from '@/lib/api/shops';
import { apiRequest } from '@/lib/api/client';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import {
  useToast,
  useToastNotification,
} from '@/components/ui/toast-provider';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type {
  CreateManualDuePayload,
  Due,
  DueCollection,
} from '@/types/api';

export function ShopDueDetailsPage({ shopId }: { shopId: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedDue, setSelectedDue] = useState<Due | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isManualDueModalOpen, setIsManualDueModalOpen] = useState(false);

  const shopQuery = useQuery({
    queryKey: ['shops', 'detail', shopId],
    queryFn: () => getShop(shopId),
    staleTime: 60 * 1000,
  });

  const duesQuery = useQuery({
    queryKey: ['shop-due', shopId],
    queryFn: () => getShopDues(shopId),
    staleTime: 30 * 1000,
  });

  const dues = duesQuery.data ?? [];
  const shop = useMemo(
    () => dues.find((due) => due.shop)?.shop ?? shopQuery.data ?? null,
    [dues, shopQuery.data],
  );
  const loadError = duesQuery.error ?? (dues.length === 0 ? shopQuery.error : null);
  const loadErrorMessage = getErrorMessage(loadError);
  const isLoading = duesQuery.isLoading || (shopQuery.isLoading && dues.length === 0);

  useToastNotification({
    message: loadErrorMessage,
    title: 'Could not load shop ledger',
    tone: 'error',
  });

  const manualDueMutation = useMutation({
    mutationFn: addManualDue,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shop-due', shopId] }),
        queryClient.invalidateQueries({ queryKey: ['shops', 'detail', shopId] }),
        queryClient.invalidateQueries({ queryKey: ['shops'] }),
        queryClient.invalidateQueries({ queryKey: ['dues'] }),
        queryClient.invalidateQueries({ queryKey: ['due-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['sales', 'summary', 'due'] }),
        queryClient.invalidateQueries({ queryKey: ['sales', 'summary', 'due-shop'] }),
      ]);

      setIsManualDueModalOpen(false);
      toast.success('Manual due added', 'The shop ledger has been updated.');
    },
    onError: (error) => {
      toast.error('Manual due was not added', getErrorMessage(error));
    },
  });

  const totalDueAmount = dues.reduce(
    (sum, due) => sum + Number(due.remainingDue || 0),
    0,
  );
  const totalPaidAmount = dues.reduce(
    (sum, due) => sum + Number(due.paidAmount || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageCard
        title="Shop Due Details"
        description="Review outstanding due for this shop, including order details and SR information."
        action={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                manualDueMutation.reset();
                setIsManualDueModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2"
            >
              <PlusCircle className="h-4 w-4" />
              Add Manual Due
            </button>
            <Link
              href="/shops"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Back to shops
            </Link>
          </div>
        }
      >
        {isLoading ? <LoadingBlock label="Loading shop ledger..." /> : null}

        {!isLoading && loadErrorMessage ? (
          <StateMessage
            title="Could not load shop ledger"
            description={loadErrorMessage}
          />
        ) : null}

        {!isLoading && !loadErrorMessage && shop ? (
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

        {!isLoading && !loadErrorMessage ? (
          dues.length > 0 ? (
            <div className="space-y-4">
              {dues.map((due) => (
                <DueLedgerCard
                  key={due.id}
                  due={due}
                  onHistoryClick={() => {
                    setSelectedDue(due);
                    setIsHistoryModalOpen(true);
                  }}
                />
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

      {isHistoryModalOpen && selectedDue ? (
        <HistoryModal
          due={selectedDue}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      ) : null}

      {isManualDueModalOpen ? (
        <ManualDueModal
          shopId={shopId}
          shopName={shop?.name}
          isSubmitting={manualDueMutation.isPending}
          errorMessage={getErrorMessage(manualDueMutation.error)}
          onClose={() => {
            if (!manualDueMutation.isPending) {
              manualDueMutation.reset();
              setIsManualDueModalOpen(false);
            }
          }}
          onSubmit={(payload) => manualDueMutation.mutate(payload)}
        />
      ) : null}
    </div>
  );
}

function DueLedgerCard({
  due,
  onHistoryClick,
}: {
  due: Due;
  onHistoryClick: () => void;
}) {
  const isManualDue = due.order?.status === 'MANUAL_DUE';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-black uppercase text-slate-900">
            {isManualDue ? 'Manual Due' : 'Order'} #{due.orderId}
          </p>
          <p className="mt-1 text-sm font-bold uppercase text-slate-500">
            SR: {due.srName || 'Unknown'} -{' '}
            {formatDate(due.order?.orderDate || due.createdAt)}
          </p>
          {due.note ? (
            <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-6 text-slate-600">
              {due.note}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${getDueStatusClass(due.status)}`}
            >
              {due.status}
            </span>
            <span className="text-xs font-bold uppercase text-slate-500">
              {Number(due.remainingDue) > 0
                ? `${formatCurrency(due.remainingDue)} still due`
                : 'Paid'}
            </span>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryPill label="Total Due" value={formatCurrency(due.dueAmount)} />
          <SummaryPill label="Paid" value={formatCurrency(due.paidAmount)} />
          <SummaryPill
            label="Remaining"
            value={formatCurrency(due.remainingDue)}
            tone="amber"
          />
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={onHistoryClick}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            >
              <History className="h-4 w-4" />
              History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualDueModal({
  shopId,
  shopName,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: {
  shopId: number;
  shopName?: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateManualDuePayload) => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number(amount);
    const cleanReason = reason.trim();
    const cleanNote = note.trim();

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Due amount must be greater than 0.');
      return;
    }

    if (cleanReason.length < 3) {
      setFormError('Reason must be at least 3 characters.');
      return;
    }

    setFormError(null);
    onSubmit({
      shopId: String(shopId),
      amount: Number(parsedAmount.toFixed(2)),
      reason: cleanReason,
      note: cleanNote || undefined,
    });
  }

  const displayedError = formError || errorMessage;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-5">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              Add Manual Due
            </h3>
            <p className="mt-1 text-xs font-bold uppercase text-slate-500">
              {shopName ?? `Shop #${shopId}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-1 text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close manual due form"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">
              Due Amount
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isSubmitting}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">
              Reason
            </span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={200}
              disabled={isSubmitting}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">
              Notes
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              maxLength={2000}
              disabled={isSubmitting}
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>

          {displayedError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {displayedError}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add Due
          </button>
        </div>
      </form>
    </div>
  );
}

function HistoryModal({ due, onClose }: { due: Due; onClose: () => void }) {
  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['order-collections', due.orderId],
    queryFn: () =>
      apiRequest<DueCollection[]>(`/dues/order/${due.orderId}/collections`, {
        method: 'GET',
      }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-white text-left shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border bg-zinc-50/50 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold leading-none text-foreground">
              Collection History
            </h3>
            <p className="mt-1 text-xs font-bold uppercase text-muted">
              Shop: {due.shop?.name || 'Shop'} - Order #{due.orderId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-zinc-200"
          >
            <XCircle className="h-5 w-5 text-muted" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <p className="text-[10px] font-black uppercase text-muted">
                Original Due
              </p>
              <p className="text-lg font-bold text-zinc-900">
                {formatCurrency(due.dueAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-[10px] font-black uppercase text-emerald-600">
                Total Paid
              </p>
              <p className="text-lg font-bold text-emerald-700">
                {formatCurrency(due.paidAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
              <p className="text-[10px] font-black uppercase text-rose-600">
                Remaining
              </p>
              <p className="text-lg font-bold text-rose-700">
                {formatCurrency(due.remainingDue)}
              </p>
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
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                    </td>
                  </tr>
                ) : collections.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted"
                    >
                      No history found.
                    </td>
                  </tr>
                ) : (
                  collections.map((collection) => (
                    <tr key={collection.id} className="hover:bg-zinc-50/30">
                      <td className="px-4 py-3 text-xs font-bold text-zinc-600">
                        {new Date(collection.collectionDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-zinc-700">
                        {collection.srName || collection.collectedBy || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-primary">
                        {formatCurrency(collection.collectedAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded border px-2 py-0.5 text-[8px] font-black ${getCollectionStatusClass(collection.status)}`}
                        >
                          {collection.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end border-t border-border bg-zinc-50/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-6 py-2 text-xs font-bold uppercase tracking-widest text-white"
          >
            Close
          </button>
        </div>
      </div>
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

function getDueStatusClass(status: string) {
  if (status === 'DUE') {
    return 'bg-rose-100 text-rose-700';
  }

  if (status === 'PARTIAL') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-emerald-100 text-emerald-700';
}

function getCollectionStatusClass(status: string) {
  if (status === 'APPROVED') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  }

  if (status === 'PENDING') {
    return 'border-amber-100 bg-amber-50 text-amber-700';
  }

  return 'border-rose-100 bg-rose-50 text-rose-700';
}

function getErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}
