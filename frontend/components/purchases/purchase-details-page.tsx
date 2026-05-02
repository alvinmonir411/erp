'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { getPurchase, receivePurchasePayment } from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from '@/lib/utils/format';
import type { Purchase } from '@/types/api';

function getPurchaseReference(purchase: Purchase) {
  return purchase.referenceNo || `Purchase #${purchase.id}`;
}

export function PurchaseDetailsPage({ purchaseId }: { purchaseId: number }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [paymentNote, setPaymentNote] = useState('');

  useToastNotification({
    message: error,
    title: 'Could not load purchase',
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

  useEffect(() => {
    async function loadPurchase() {
      try {
        setIsLoading(true);
        setError(null);
        const purchaseData = await getPurchase(purchaseId);
        setPurchase(purchaseData);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load purchase details.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPurchase();
  }, [purchaseId]);

  async function handleReceivePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError(null);
    setPaymentSuccess(null);

    if (!purchase) {
      return;
    }

    try {
      setIsSubmittingPayment(true);
      const updatedPurchase = await receivePurchasePayment(purchase.id, {
        amount: Number(paymentAmount),
        paymentDate: new Date(paymentDate).toISOString(),
        note: paymentNote.trim() || undefined,
      });

      setPurchase(updatedPurchase);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().slice(0, 16));
      setPaymentNote('');
      setPaymentSuccess('Purchase settlement saved successfully.');
    } catch (submitError) {
      setPaymentError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to save purchase settlement.',
      );
    } finally {
      setIsSubmittingPayment(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageCard
        title="Purchase Details"
        description="Inspect the purchase payload, item totals, settlement history, and the current outstanding payable."
        action={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/purchases"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            >
              Back to purchases
            </Link>
            {purchase ? (
              <Link
                href={`/purchases/companies/${purchase.companyId}`}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
              >
                Company ledger
              </Link>
            ) : null}
          </div>
        }
      >
        {isLoading ? <LoadingBlock label="Loading purchase details..." /> : null}

        {!isLoading && !error && purchase ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard label="Reference" value={getPurchaseReference(purchase)} />
              <InfoCard
                label="Purchase date"
                value={formatDate(purchase.purchaseDate)}
              />
              <InfoCard
                label="Company"
                value={purchase.company?.name ?? `Company #${purchase.companyId}`}
              />
              <InfoCard
                label="Total amount"
                value={formatCurrency(purchase.totalAmount)}
              />
              <InfoCard
                label="Settled amount"
                value={formatCurrency(purchase.paidAmount)}
              />
              <InfoCard
                label="Outstanding payable"
                value={formatCurrency(purchase.payableAmount)}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Note</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {purchase.note || 'No note provided.'}
              </p>
            </div>

            <PageCard
              title="Settle Purchase Payable"
              description="Record a payment against this purchase and keep the outstanding payable accurate over time."
            >
              {Number(purchase.payableAmount) > 0 ? (
                <form onSubmit={handleReceivePayment} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
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
                          value={paymentAmount}
                          onChange={(event) => setPaymentAmount(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                          placeholder={`Max ${purchase.payableAmount}`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentAmount(Number(purchase.payableAmount).toFixed(2))
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
                        value={paymentDate}
                        onChange={(event) => setPaymentDate(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                        required
                      />
                    </label>

                    <div className="rounded-2xl bg-amber-50 p-4 text-amber-900">
                      <p className="text-sm">Outstanding payable</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatCurrency(purchase.payableAmount)}
                      </p>
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Note</span>
                    <textarea
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                      placeholder="Optional settlement note"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmittingPayment}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {isSubmittingPayment
                      ? 'Saving settlement...'
                      : 'Save settlement'}
                  </button>
                </form>
              ) : (
                <StateMessage
                  title="No payable remaining"
                  description="This purchase is already fully settled."
                />
              )}
            </PageCard>

            <PageCard
              title="Settlement History"
              description="Every payment recorded against this purchase is listed here."
            >
              {purchase.payments && purchase.payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-3 font-medium">Payment Date</th>
                        <th className="px-3 py-3 font-medium">Amount</th>
                        <th className="px-3 py-3 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchase.payments.map((payment: any) => (
                        <tr key={payment.id}>
                          <td className="px-3 py-4 text-slate-700">
                            {formatDateTime(payment.paymentDate)}
                          </td>
                          <td className="px-3 py-4 font-medium text-slate-900">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-3 py-4 text-slate-700">
                            {payment.note || 'No note provided.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <StateMessage
                  title="No settlements recorded"
                  description="Purchase settlement entries will appear here after you record payments."
                />
              )}
            </PageCard>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-3 font-medium">Product</th>
                    <th className="px-3 py-3 font-medium">Quantity</th>
                    <th className="px-3 py-3 font-medium">Unit cost</th>
                    <th className="px-3 py-3 font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchase.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-3 py-4">
                        <div className="font-medium text-slate-900">
                          {item.product?.name ?? `Product #${item.productId}`}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.product?.sku ?? ''}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-slate-700">
                        {formatNumber(item.quantity)} {item.product?.unit ?? ''}
                      </td>
                      <td className="px-3 py-4 text-slate-700">
                        {formatCurrency(item.unitPrice || item.unitCost)}
                      </td>
                      <td className="px-3 py-4 font-medium text-slate-900">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
