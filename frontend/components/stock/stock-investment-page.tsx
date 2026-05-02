'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getCompanies } from '@/lib/api/companies';
import { getStockInvestmentSummary } from '@/lib/api/stock';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatNumber, toNumber } from '@/lib/utils/format';
import type { Company, StockInvestmentSummary, StockSummaryItem } from '@/types/api';

export function StockInvestmentPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState<StockInvestmentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useToastNotification({
    message: error,
    title: 'Could not load investment summary',
    tone: 'error',
  });

  useEffect(() => {
    async function loadCompaniesAndSummary() {
      try {
        setIsLoading(true);
        setError(null);

        const companyData = await getCompanies();
        setCompanies(companyData);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load companies.',
        );
      }
    }

    void loadCompaniesAndSummary();
  }, []);

  useEffect(() => {
    async function loadInvestmentSummary() {
      try {
        setIsLoading(true);
        setError(null);

        const nextSummary = await getStockInvestmentSummary(
          selectedCompanyId ?? undefined,
          searchTerm.trim() || undefined,
        );
        setSummary(nextSummary);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load inventory investment summary.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadInvestmentSummary();
  }, [searchTerm, selectedCompanyId]);

  const topCompanies = useMemo(
    () => summary?.companies.slice(0, 4) ?? [],
    [summary],
  );
  const unitRows = useMemo(() => summary?.units ?? [], [summary]);
  const productRows = useMemo(() => summary?.items ?? [], [summary]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[36px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.14),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.16),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fafc_40%,#ecfeff_72%,#fffbeb_100%)] p-6 shadow-[0_36px_90px_-56px_rgba(15,23,42,0.45)]">
        <div className="absolute -right-10 top-4 h-44 w-44 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-sky-100/70 blur-3xl" />

        <div className="relative space-y-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/85 px-4 py-2 shadow-sm backdrop-blur">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-800">
                  Inventory investment
                </p>
              </div>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-[2.8rem]">
                Stock value details
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Review how much money is currently sitting in stock, which companies carry the most value, and how that value spreads across units like KG, LITER, PACK, and PCS.
              </p>
            </div>

            <Link
              href="/stock"
              className="inline-flex rounded-full border border-white/80 bg-white/85 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            >
              Back to stock
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <InvestmentHeroCard
              label="Total stock investment"
              value={formatCurrency(summary?.totalInvestment ?? 0)}
              detail="Calculated from current stock x buy price"
              toneClassName="bg-[linear-gradient(135deg,#0f172a_0%,#111827_52%,#0f766e_100%)] text-white"
            />
            <InvestmentHeroCard
              label="Companies in view"
              value={String(summary?.companyCount ?? 0)}
              detail="Companies contributing to the current inventory value"
              toneClassName="bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_60%,#eef2ff_100%)] text-slate-900"
            />
            <InvestmentHeroCard
              label="Products with stock"
              value={String(summary?.inStockProducts ?? 0)}
              detail={`${summary?.totalProducts ?? 0} products in the current view`}
              toneClassName="bg-[linear-gradient(135deg,#ecfdf5_0%,#f0fdf4_100%)] text-emerald-950"
            />
            <InvestmentHeroCard
              label="Low / zero stock"
              value={`${summary?.lowStockProducts ?? 0} / ${summary?.zeroStockProducts ?? 0}`}
              detail="Quick view of risk against current investment"
              toneClassName="bg-[linear-gradient(135deg,#fff8eb_0%,#fff1f2_100%)] text-slate-950"
            />
          </div>
        </div>
      </section>

      <PageCard
        title="Investment Filters"
        description="Filter the investment breakdown by company or product keyword."
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Keyword search</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by product name, SKU, unit, or company"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Company</span>
            <select
              value={selectedCompanyId ?? ''}
              onChange={(event) =>
                setSelectedCompanyId(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white"
            >
              <option value="">All companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </PageCard>

      {isLoading ? <LoadingBlock label="Loading investment summary..." /> : null}

      {!isLoading && !error ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <PageCard
              title="Company-wise Investment"
              description="See which companies hold the biggest share of your current stock value."
            >
              {summary && summary.companies.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {topCompanies.map((company) => (
                    <div
                      key={company.companyId}
                      className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_60%,#ecfeff_100%)] p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            {company.companyCode || 'Company'}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {company.companyName}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {company.inStockProductCount} in stock
                        </span>
                      </div>

                      <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
                        {formatCurrency(company.investmentValue)}
                      </p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <InvestmentMiniMetric
                          label="Products"
                          value={String(company.productCount)}
                        />
                        <InvestmentMiniMetric
                          label="Quantity"
                          value={formatNumber(company.totalQuantity)}
                        />
                        <InvestmentMiniMetric
                          label="Low stock"
                          value={String(company.lowStockProductCount)}
                        />
                        <InvestmentMiniMetric
                          label="Zero stock"
                          value={String(company.zeroStockProductCount)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <StateMessage
                  title="No company investment data"
                  description="Stock value appears here as soon as matching products and stock are available."
                />
              )}
            </PageCard>

            <PageCard
              title="Unit Totals"
              description="Unit-wise stock quantity and investment totals."
            >
              {unitRows.length > 0 ? (
                <div className="grid gap-3">
                  {unitRows.map((unit) => (
                    <div
                      key={unit.unit}
                      className="flex flex-col gap-4 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          {unit.unit}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">
                          {formatNumber(unit.totalQuantity)} {unit.unit}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {unit.inStockProductCount} stocked product(s) across {unit.productCount} total item(s)
                        </p>
                      </div>
                      <p className="text-xl font-semibold text-emerald-900">
                        {formatCurrency(unit.investmentValue)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <StateMessage
                  title="No unit totals to show"
                  description="Try widening the filters to see KG, LITER, PACK, PCS, and other unit totals."
                />
              )}
            </PageCard>
          </div>

          <PageCard
            title="Investment Detail Table"
            description="Product-level stock value based on the current stock balance and buy price."
          >
            {productRows.length > 0 ? (
              <InvestmentDetailTable items={productRows} />
            ) : (
              <StateMessage
                title="No investment detail rows"
                description="No matching products were found for the current filters."
              />
            )}
          </PageCard>
        </>
      ) : null}
    </div>
  );
}

function InvestmentHeroCard({
  label,
  value,
  detail,
  toneClassName,
}: {
  label: string;
  value: string;
  detail: string;
  toneClassName: string;
}) {
  return (
    <div className={`rounded-[28px] p-5 shadow-sm ${toneClassName}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-75">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-3 text-sm leading-6 opacity-80">{detail}</p>
    </div>
  );
}

function InvestmentMiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function InvestmentDetailTable({ items }: { items: StockSummaryItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="px-3 py-3 font-medium">Product</th>
            <th className="px-3 py-3 font-medium">Company</th>
            <th className="px-3 py-3 font-medium">Unit</th>
            <th className="px-3 py-3 font-medium">Current stock</th>
            <th className="px-3 py-3 font-medium">Buy price</th>
            <th className="px-3 py-3 font-medium">Investment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.productId}>
              <td className="px-3 py-4">
                <div className="font-medium text-slate-900">{item.productName}</div>
                <div className="text-xs text-slate-500">{item.sku}</div>
              </td>
              <td className="px-3 py-4">
                <div className="font-medium text-slate-900">
                  {item.company?.name ?? `Company #${item.companyId}`}
                </div>
                <div className="text-xs text-slate-500">
                  {item.company?.code ?? 'No code'}
                </div>
              </td>
              <td className="px-3 py-4 text-slate-700">{item.unit}</td>
              <td className="px-3 py-4 text-slate-700">
                {formatNumber(Math.max(toNumber(item.currentStock), 0))}
              </td>
              <td className="px-3 py-4 text-slate-700">
                {formatCurrency(item.buyPrice)}
              </td>
              <td className="px-3 py-4 font-semibold text-emerald-800">
                {formatCurrency(item.investmentValue ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
