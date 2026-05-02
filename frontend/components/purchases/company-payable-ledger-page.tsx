'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  getCompanyPayableLedger,
  receivePurchasePayment,
} from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import type { CompanyPayableHistoryEntry, CompanyPayableLedger } from '@/types/api';

type PaymentFormState = {
  amount: string;
  paymentDate: string;
  note: string;
};

function createPaymentFormState(amount: number): PaymentFormState {
  return {
    amount: amount.toFixed(2),
    paymentDate: new Date().toISOString().slice(0, 16),
    note: '',
  };
}

function getPurchaseReference(referenceNo: string | null, purchaseId: number) {
  return referenceNo || `Purchase #${purchaseId}`;
}

function getOutstandingPurchaseStatus(
  purchase: CompanyPayableLedger['payablePurchases'][number],
) {
  if (Number(purchase.paidAmount) <= 0) {
    return {
      badge: 'Full payable purchase',
      description: 'No settlement has been recorded yet.',
      toneClassName: 'bg-rose-100 text-rose-700',
    };
  }

  return {
    badge: 'Partially settled',
    description: `${formatCurrency(purchase.paidAmount)} settled, ${formatCurrency(
      purchase.payableAmount,
    )} still payable.`,
    toneClassName: 'bg-amber-100 text-amber-700',
  };
}

function getPaymentEntryStatus(payment: CompanyPayableHistoryEntry) {
  return Number(payment.purchasePayableAmount) > 0
    ? {
        label: 'Payable remaining',
        toneClassName: 'bg-amber-100 text-amber-700',
      }
    : {
        label: 'Purchase settled',
        toneClassName: 'bg-emerald-100 text-emerald-700',
      };
}

export function CompanyPayableLedgerPage({
  companyId,
}: {
  companyId: number;
}) {
  const [details, setDetails] = useState<CompanyPayableLedger | null>(null);
  const [paymentForms, setPaymentForms] = useState<
    Record<number, PaymentFormState>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingPurchaseId, setIsSubmittingPurchaseId] = useState<
    number | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useToastNotification({
    message: error,
    title: 'Could not load company payable ledger',
    tone: 'error',
  });
  useToastNotification({
    message: paymentError,
    title: 'Could not save settlement',
    tone: 'error',
  });
  useToastNotification({
    message: paymentSuccess,
    title: 'Settlement saved',
    tone: 'success',
  });

  const refreshDetails = useCallback(
    async (showLoader: boolean) => {
      try {
        if (showLoader) {
          setIsLoading(true);
        }

        setError(null);
        const nextDetails = await getCompanyPayableLedger(companyId);
        setDetails(nextDetails);
        setPaymentForms(
          Object.fromEntries(
            nextDetails.payablePurchases.map((purchase: any) => [
              purchase.id,
              createPaymentFormState(purchase.payableAmount),
            ]),
          ),
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load company payable ledger.',
        );
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [companyId],
  );

  useEffect(() => {
    void refreshDetails(true);
  }, [refreshDetails]);

  async function handleReceivePayment(
    event: FormEvent<HTMLFormElement>,
    purchaseId: number,
  ) {
    event.preventDefault();
    setPaymentError(null);
    setPaymentSuccess(null);

    const form = paymentForms[purchaseId];
    if (!form) {
      return;
    }

    try {
      setIsSubmittingPurchaseId(purchaseId);
      await receivePurchasePayment(purchaseId, {
        amount: Number(form.amount),
        paymentDate: new Date(form.paymentDate).toISOString(),
        note: form.note.trim() || undefined,
      });

      await refreshDetails(false);
      setPaymentSuccess('Purchase settlement saved successfully.');
    } catch (submitError) {
      setPaymentError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to save purchase settlement.',
      );
    } finally {
      setIsSubmittingPurchaseId(null);
    }
  }

  function updatePaymentForm(
    purchaseId: number,
    patch: Partial<PaymentFormState>,
  ) {
    setPaymentForms((current) => ({
      ...current,
      [purchaseId]: {
        ...current[purchaseId],
        ...patch,
      },
    }));
  }

  return (
    <div className="space-y-6">
      <PageCard
        title="Company Payable Ledger"
        description="Review one company's purchase payable position, settle open purchases, and inspect the full settlement history."
        action={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/purchases"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            >
              Back to purchases
            </Link>
            <Link
              href="/purchases/create"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            >
              Create purchase
            </Link>
          </div>
        }
      >
        {isLoading ? <LoadingBlock label="Loading company ledger..." /> : null}

        {!isLoading && !error && details ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <InfoCard label="Company" value={details.company.name} />
            <InfoCard label="Code" value={details.company.code} />
            <InfoCard
              label="Total purchases"
              value={String(details.summary.purchaseCount)}
            />
            <InfoCard
              label="Settled amount"
              value={formatCurrency(details.summary.totalPaid)}
            />
            <InfoCard
              label="Outstanding payable"
              value={formatCurrency(details.summary.totalPayable)}
            />
          </div>
        ) : null}
      </PageCard>

      <PageCard
        title="Open Payable Purchases"
        description="Use the inline settlement forms below to reduce company payable without leaving the ledger."
      >
        {isLoading ? <LoadingBlock label="Loading payable purchases..." /> : null}
        {!isLoading && !error && details ? (
          details.payablePurchases.length > 0 ? (
            <div className="space-y-4">
              {details.payablePurchases.map((purchase: any) => {
                const form =
                  paymentForms[purchase.id] ??
                  createPaymentFormState(purchase.payableAmount);
                const purchaseStatus = getOutstandingPurchaseStatus(purchase);

                return (
                  <div
                    key={purchase.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {getPurchaseReference(purchase.referenceNo, purchase.id)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {details.company.name} • {formatDate(purchase.purchaseDate)}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${purchaseStatus.toneClassName}`}
                          >
                            {purchaseStatus.badge}
                          </span>
                          <span className="text-xs text-slate-500">
                            {purchaseStatus.description}
                          </span>
                        </div>
                        {purchase.note ? (
                          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                            {purchase.note}
                          </p>
                        ) : null}
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <SummaryPill
                          label="Total"
                          value={formatCurrency(purchase.totalAmount)}
                        />
                        <SummaryPill
                          label="Settled"
                          value={formatCurrency(purchase.paidAmount)}
                        />
                        <SummaryPill
                          label="Payable"
                          value={formatCurrency(purchase.payableAmount)}
                          tone="amber"
                        />
                      </div>
                    </div>

                    <form
                      onSubmit={(event) =>
                        void handleReceivePayment(event, purchase.id)
                      }
                      className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_0.9fr_auto]"
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            Settlement amount
                          </span>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              max={Number(purchase.payableAmount)}
                              value={form.amount}
                              onChange={(event) =>
                                updatePaymentForm(purchase.id, {
                                  amount: event.target.value,
                                })
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updatePaymentForm(purchase.id, {
                                  amount: Number(purchase.payableAmount).toFixed(2),
                                })
                              }
                              className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium text-slate-700"
                            >
                              Full payable
                            </button>
                          </div>
                        </label>

                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            Settlement date
                          </span>
                          <input
                            type="datetime-local"
                            value={form.paymentDate}
                            onChange={(event) =>
                              updatePaymentForm(purchase.id, {
                                paymentDate: event.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          />
                        </label>
                      </div>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Note</span>
                        <textarea
                          value={form.note}
                          onChange={(event) =>
                            updatePaymentForm(purchase.id, {
                              note: event.target.value,
                            })
                          }
                          rows={3}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                          placeholder="Optional settlement note"
                        />
                      </label>

                      <div className="flex flex-col gap-2 xl:justify-end">
                        <button
                          type="submit"
                          disabled={isSubmittingPurchaseId === purchase.id}
                          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                        >
                          {isSubmittingPurchaseId === purchase.id
                            ? 'Saving settlement...'
                            : 'Save settlement'}
                        </button>
                        <Link
                          href={`/purchases/${purchase.id}`}
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700"
                        >
                          Open purchase
                        </Link>
                      </div>
                    </form>
                  </div>
                );
              })}
            </div>
          ) : (
            <StateMessage
              title="No payable purchases"
              description="This company does not have any outstanding purchase payable right now."
            />
          )
        ) : null}
      </PageCard>

      <PageCard
        title="Settlement History"
        description="Every payment saved against this company's purchases is listed here with the current purchase status."
      >
        {isLoading ? <LoadingBlock label="Loading settlement history..." /> : null}
        {!isLoading && !error && details ? (
          details.paymentHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-3 font-medium">Payment date</th>
                    <th className="px-3 py-3 font-medium">Reference</th>
                    <th className="px-3 py-3 font-medium">Amount</th>
                    <th className="px-3 py-3 font-medium">Purchase status</th>
                    <th className="px-3 py-3 font-medium">Current totals</th>
                    <th className="px-3 py-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {details.paymentHistory.map((payment: any) => {
                    const paymentStatus = getPaymentEntryStatus(payment);

                    return (
                      <tr key={payment.id}>
                        <td className="px-3 py-4 text-slate-700">
                          {formatDateTime(payment.paymentDate)}
                        </td>
                        <td className="px-3 py-4">
                          <Link
                            href={`/purchases/${payment.purchaseId}`}
                            className="font-medium text-slate-900 underline underline-offset-4"
                          >
                            {getPurchaseReference(
                              payment.referenceNo,
                              payment.purchaseId,
                            )}
                          </Link>
                        </td>
                        <td className="px-3 py-4 font-medium text-slate-900">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${paymentStatus.toneClassName}`}
                          >
                            {paymentStatus.label}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          <div>Total: {formatCurrency(payment.purchaseTotalAmount)}</div>
                          <div>Settled: {formatCurrency(payment.purchasePaidAmount)}</div>
                          <div>
                            Payable: {formatCurrency(payment.purchasePayableAmount)}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {payment.note || 'No note provided.'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <StateMessage
              title="No settlements recorded"
              description="Settlement entries will appear here after you record purchase payments."
            />
          )
        ) : null}
      </PageCard>
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
