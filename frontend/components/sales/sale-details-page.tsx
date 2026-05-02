'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { getSale, receiveSalePayment } from '@/lib/api/sales';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  toNumber,
} from '@/lib/utils/format';
import type { Sale } from '@/types/api';

export function SaleDetailsPage({ saleId }: { saleId: number }) {
  const [sale, setSale] = useState<Sale | null>(null);
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
    title: 'Could not load sale',
    tone: 'error',
  });
  useToastNotification({
    message: paymentError,
    title: 'Could not receive payment',
    tone: 'error',
  });
  useToastNotification({
    message: paymentSuccess,
    title: 'Payment saved',
    tone: 'success',
  });

  useEffect(() => {
    async function loadSale() {
      try {
        setIsLoading(true);
        setError(null);
        const saleData = await getSale(saleId);
        setSale(saleData);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load sale details.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadSale();
  }, [saleId]);

  async function handleReceivePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError(null);
    setPaymentSuccess(null);

    if (!sale) {
      return;
    }

    try {
      setIsSubmittingPayment(true);
      const updatedSale = await receiveSalePayment(sale.id, {
        amount: Number(paymentAmount),
        paymentDate: new Date(paymentDate).toISOString(),
        note: paymentNote.trim() || undefined,
      });

      setSale(updatedSale);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().slice(0, 16));
      setPaymentNote('');
      setPaymentSuccess('Due payment received successfully.');
    } catch (submitError) {
      setPaymentError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to receive payment.',
      );
    } finally {
      setIsSubmittingPayment(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageCard
        title="Sale Details"
        description="Inspect the full sale payload, including header information, due status, and all sold items."
        action={
          <div className="flex gap-3">
            <Link
              href={`/sales/${saleId}/invoice`}
              target="_blank"
              className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition"
            >
              Print Invoice
            </Link>
            <Link
              href="/sales"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Back to sales
            </Link>
          </div>
        }
      >
        {isLoading ? <LoadingBlock label="Loading sale details..." /> : null}

        {!isLoading && !error && sale ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <InfoCard label="Invoice no" value={sale.invoiceNo} />
              <InfoCard label="Sale date" value={formatDate(sale.saleDate)} />
              <InfoCard
                label="Company"
                value={sale.company?.name ?? `Company #${sale.companyId}`}
              />
              <InfoCard
                label="Route"
                value={sale.route?.name ?? `Route #${sale.routeId}`}
              />
              <InfoCard label="Shop" value={sale.shop?.name ?? 'No shop'} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-6">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg shadow-slate-900/20 text-white transition-transform hover:-translate-y-1">
                <div className="relative z-10">
                  <p className="text-sm font-medium opacity-90">Total amount</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight truncate">
                    {formatCurrency(sale.totalAmount)}
                  </p>
                </div>
                <div className="absolute -right-6 -top-6 z-0 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
              </div>

              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-400 to-indigo-600 p-6 shadow-lg shadow-indigo-500/20 text-white transition-transform hover:-translate-y-1">
                <div className="relative z-10">
                  <p className="text-sm font-medium opacity-90">Paid amount</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight truncate">
                    {formatCurrency(sale.paidAmount)}
                  </p>
                </div>
                <div className="absolute -right-6 -top-6 z-0 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
              </div>

              <div className={`relative overflow-hidden rounded-3xl p-6 shadow-lg transition-transform hover:-translate-y-1 ${toNumber(sale.dueAmount) > 0
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/20 text-white'
                : 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/20 text-white'
                }`}>
                <div className="relative z-10">
                  <p className="text-sm font-medium opacity-90">Due amount</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight truncate">
                    {formatCurrency(sale.dueAmount)}
                  </p>
                  {toNumber(sale.dueAmount) === 0 && (
                    <p className="mt-2 text-xs font-medium opacity-90">Fully paid</p>
                  )}
                </div>
                <div className="absolute -right-6 -top-6 z-0 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
              </div>

              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-6 shadow-lg shadow-emerald-500/20 text-white transition-transform hover:-translate-y-1">
                <div className="relative z-10">
                  <p className="text-sm font-medium opacity-90">Total profit</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight truncate">
                    {formatCurrency(sale.totalProfit ?? 0)}
                  </p>
                </div>
                <div className="absolute -right-6 -top-6 z-0 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm mt-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50/80">
                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3">Unit price</th>
                      <th className="px-4 py-3">Buy price</th>
                      <th className="px-4 py-3">Line total</th>
                      <th className="px-4 py-3">Line profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {sale.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900">
                            {item.product?.name ?? `Product #${item.productId}`}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {item.product?.sku ?? ''}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <span className="font-medium">{formatNumber(item.quantity)}</span> {item.product?.unit ?? ''}
                        </td>
                        <td className="px-4 py-4 text-slate-700 font-medium">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-4 py-4 text-slate-500">
                          {formatCurrency(item.buyPrice ?? 0)}
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-900">
                          {formatCurrency(item.lineTotal)}
                        </td>
                        <td className="px-4 py-4 font-bold text-emerald-600">
                          {formatCurrency(item.lineProfit ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-slate-200 mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Note</p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-800">
                {sale.note || 'No note provided.'}
              </p>
            </div>

            {sale.shopId ? (
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/sales/shops/${sale.shopId}`}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
                >
                  Open shop ledger
                </Link>
              </div>
            ) : null}

            <PageCard
              title="Receive Due Payment"
              description="Collect additional payment against this sale and keep the due balance updated."
            >
              {toNumber(sale.dueAmount) > 0 ? (
                <form onSubmit={handleReceivePayment} className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-3">
                    <label className="block space-y-2">
                      <span className="text-sm font-bold text-slate-700">
                        Payment amount
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={toNumber(sale.dueAmount)}
                          value={paymentAmount}
                          onChange={(event) => setPaymentAmount(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                          placeholder={`Max ${sale.dueAmount}`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(toNumber(sale.dueAmount).toFixed(2))}
                          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-all shadow-sm"
                        >
                          Full due
                        </button>
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-bold text-slate-700">
                        Payment date
                      </span>
                      <input
                        type="datetime-local"
                        value={paymentDate}
                        onChange={(event) => setPaymentDate(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        required
                      />
                    </label>

                    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 text-amber-900 shadow-sm">
                      <p className="text-sm font-bold">Outstanding due</p>
                      <p className="mt-2 text-2xl font-bold tracking-tight">
                        {formatCurrency(sale.dueAmount)}
                      </p>
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-slate-700">
                      Note
                    </span>
                    <textarea
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      placeholder="Optional payment note"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmittingPayment}
                    className="rounded-2xl bg-slate-900 px-6 py-4 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                  >
                    {isSubmittingPayment ? 'Saving payment...' : 'Receive payment'}
                  </button>
                </form>
              ) : (
                <StateMessage
                  title="No due remaining"
                  description="This sale is already fully paid."
                />
              )}
            </PageCard>

            <PageCard
              title="Payment History"
              description="Every payment collected for this sale is listed here."
            >
              {sale.payments && sale.payments.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50/80">
                      <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3">Payment Date</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {sale.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-4 py-4 text-slate-700">
                            {formatDateTime(payment.paymentDate)}
                          </td>
                          <td className="px-4 py-4 font-bold text-slate-900">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {payment.note || 'No note provided.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <StateMessage
                  title="No payments recorded"
                  description="Payments received for this sale will appear here."
                />
              )}
            </PageCard>

          </div>
        ) : null}
      </PageCard>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-slate-200">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1.5 text-base font-bold text-slate-900 truncate">{value}</p>
    </div>
  );
}
