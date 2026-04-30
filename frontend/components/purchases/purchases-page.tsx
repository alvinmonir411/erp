'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getCompanies } from '@/lib/api/companies';
import {
  getCompanyWisePayableSummary,
  getPurchases,
} from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { Pagination } from '@/components/ui/pagination';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type {
  Company,
  CompanyWisePayableSummary,
  Purchase,
} from '@/types/api';
import {
  Plus,
  Search,
  Building2,
  Calendar,
  FilterX,
  FileText,
  DollarSign,
  Wallet,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  TrendingDown,
  ArrowUpRight
} from 'lucide-react';

const purchasesPageSize = 10;
const payableSummaryPageSize = 8;

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getFilterDateTime(value: string, boundary: 'start' | 'end') {
  const time = boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999';

  return new Date(`${value}${time}`).toISOString();
}

function getPurchaseReference(purchase: Purchase) {
  return purchase.referenceNo || `Purchase #${purchase.id}`;
}

export function PurchasesPage() {
  const summarySectionRef = useRef<HTMLDivElement | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payableSummary, setPayableSummary] = useState<
    CompanyWisePayableSummary[]
  >([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [purchasePage, setPurchasePage] = useState(1);
  const [payablePage, setPayablePage] = useState(1);
  const [isFilterLoading, setIsFilterLoading] = useState(true);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  useToastNotification({
    message: error,
    title: 'Could not load purchases',
    tone: 'error',
  });

  const purchaseQuery = useMemo(
    () => ({
      companyId: selectedCompanyId ?? undefined,
      fromDate: fromDate ? getFilterDateTime(fromDate, 'start') : undefined,
      toDate: toDate ? getFilterDateTime(toDate, 'end') : undefined,
      search: searchTerm.trim() || undefined,
    }),
    [fromDate, searchTerm, selectedCompanyId, toDate],
  );

  useEffect(() => {
    async function loadFilters() {
      try {
        setIsFilterLoading(true);
        setError(null);
        const companyData = await getCompanies();
        setCompanies(companyData);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load purchase filters.',
        );
      } finally {
        setIsFilterLoading(false);
      }
    }

    void loadFilters();
  }, []);

  useEffect(() => {
    async function loadWorkspace() {
      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;

      try {
        setIsWorkspaceLoading(true);
        setError(null);

        const [purchaseData, payableData] = await Promise.all([
          getPurchases(purchaseQuery),
          getCompanyWisePayableSummary(purchaseQuery),
        ]);

        if (requestId !== latestRequestRef.current) {
          return;
        }

        setPurchases(purchaseData);
        setPayableSummary(payableData);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load purchases workspace.',
        );
      } finally {
        if (requestId === latestRequestRef.current) {
          setIsWorkspaceLoading(false);
        }
      }
    }

    void loadWorkspace();
  }, [purchaseQuery]);

  const purchaseStats = useMemo(
    () => ({
      purchaseCount: purchases.length,
      totalAmount: purchases.reduce(
        (sum, purchase) => sum + purchase.totalAmount,
        0,
      ),
      totalPaid: purchases.reduce((sum, purchase) => sum + purchase.paidAmount, 0),
      totalPayable: purchases.reduce(
        (sum, purchase) => sum + purchase.payableAmount,
        0,
      ),
    }),
    [purchases],
  );

  const paginatedPurchases = useMemo(() => {
    const startIndex = (purchasePage - 1) * purchasesPageSize;
    return purchases.slice(startIndex, startIndex + purchasesPageSize);
  }, [purchasePage, purchases]);

  const paginatedPayableSummary = useMemo(() => {
    const startIndex = (payablePage - 1) * payableSummaryPageSize;
    return payableSummary.slice(startIndex, startIndex + payableSummaryPageSize);
  }, [payablePage, payableSummary]);

  function resetPages() {
    setPurchasePage(1);
    setPayablePage(1);
  }

  function applyTodayFilter() {
    const today = formatDateInput(new Date());
    setFromDate(today);
    setToDate(today);
    resetPages();
  }

  function applyThisMonthFilter() {
    const today = new Date();
    const firstDay = formatDateInput(
      new Date(today.getFullYear(), today.getMonth(), 1),
    );
    const lastDay = formatDateInput(
      new Date(today.getFullYear(), today.getMonth() + 1, 0),
    );

    setFromDate(firstDay);
    setToDate(lastDay);
    resetPages();
  }

  function clearFilters() {
    setSelectedCompanyId(null);
    setFromDate('');
    setToDate('');
    setSearchTerm('');
    resetPages();
  }

  function scrollToPayableSummary() {
    summarySectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  return (
    <div className="space-y-6 pb-12 text-slate-800">
      <PageCard
        title="Purchases Workspace"
        description="Filter and find specific purchases, track stock-in from supplier buying, and monitor company payable metrics."
        action={
          <Link
            href="/purchases/create"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            <Plus className="h-4 w-4" />
            <span>Create Purchase</span>
          </Link>
        }
      >
        <div className="border border-slate-200 rounded-xl bg-slate-50 p-4">
          <div className="flex flex-col gap-1 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Filter Records By
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => {
                  resetPages();
                  setSearchTerm(event.target.value);
                }}
                placeholder="Reference or Note..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Company Select */}
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={selectedCompanyId ?? ''}
                onChange={(event) => {
                  resetPages();
                  setSelectedCompanyId(
                    event.target.value ? Number(event.target.value) : null,
                  );
                }}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Start */}
            <div className="relative">
              <span className="absolute -top-2.5 left-2 bg-white px-1 text-[10px] font-medium text-slate-500 border border-slate-200 rounded">
                From Date
              </span>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  resetPages();
                  setFromDate(event.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Date Range End */}
            <div className="relative">
              <span className="absolute -top-2.5 left-2 bg-white px-1 text-[10px] font-medium text-slate-500 border border-slate-200 rounded">
                To Date
              </span>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={toDate}
                onChange={(event) => {
                  resetPages();
                  setToDate(event.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyTodayFilter}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Today
            </button>
            <button
              type="button"
              onClick={applyThisMonthFilter}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              This month
            </button>
            <div className="ml-auto">
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-transparent px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                title="Clear filters"
              >
                <FilterX className="h-3.5 w-3.5" />
                <span>Clear Filters</span>
              </button>
            </div>
          </div>
        </div>

        {isFilterLoading || isWorkspaceLoading ? (
          <div className="mt-6">
            <LoadingBlock label="Syncing data..." />
          </div>
        ) : null}
      </PageCard>

      {!isWorkspaceLoading && !error ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric
            title="Matching Purchases"
            value={String(purchaseStats.purchaseCount)}
            note="Filtered results"
            icon={<FileText className="h-5 w-5" />}
            colorClass="text-indigo-600 bg-indigo-50"
          />
          <SummaryMetric
            title="Purchased Amount"
            value={formatCurrency(purchaseStats.totalAmount)}
            note="Total order value"
            icon={<DollarSign className="h-5 w-5" />}
            colorClass="text-blue-600 bg-blue-50"
          />
          <SummaryMetric
            title="Settled Amount"
            value={formatCurrency(purchaseStats.totalPaid)}
            note="Paid to suppliers"
            icon={<Wallet className="h-5 w-5" />}
            colorClass="text-emerald-600 bg-emerald-50"
          />
          <button
            type="button"
            onClick={scrollToPayableSummary}
            className="group flex flex-col justify-between rounded-2xl border border-rose-200 bg-white p-5 shadow-sm transition-all hover:border-rose-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <div className="flex w-full items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Outstanding Payable</p>
              <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 text-left">
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(purchaseStats.totalPayable)}
              </p>
              <div className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600">
                <span>View payable summary</span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>
        </div>
      ) : null}

      <PageCard
        title="Purchase List"
        description="Detailed list of purchases and their current settlement status."
      >
        {isWorkspaceLoading ? <LoadingBlock label="Loading purchase list..." /> : null}
        {!isWorkspaceLoading && !error ? (
          <>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-3">Reference / ID</th>
                      <th className="px-6 py-3">Supplier Company</th>
                      <th className="px-6 py-3">Purchase Date</th>
                      <th className="px-6 py-3 text-right">Total Amount</th>
                      <th className="px-6 py-3 text-right">Paid</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedPurchases.map((purchase) => {
                      const isPayable = purchase.payableAmount > 0;
                      return (
                        <tr
                          key={purchase.id}
                          className="transition-colors hover:bg-slate-50/50"
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">
                              {getPurchaseReference(purchase)}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              #{purchase.id}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">
                              {purchase.company?.name ?? `Unknown`}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {purchase.company?.code ?? '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {formatDate(purchase.purchaseDate)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-900">
                            {formatCurrency(purchase.totalAmount)}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-600">
                            {formatCurrency(purchase.paidAmount)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isPayable ? (
                              <div className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                {formatCurrency(purchase.payableAmount)} due
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Settled
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Link
                                href={`/purchases/${purchase.id}`}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                              >
                                {isPayable ? 'Settle' : 'View'}
                              </Link>
                              <Link
                                href={`/purchases/companies/${purchase.companyId}`}
                                className="inline-flex text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Open Company Ledger"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {purchases.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <StateMessage
                  title="No purchases found"
                  description="Adjust your search, company, or date filters to find matching purchases."
                />
              </div>
            ) : null}

            <div className="mt-4">
              <Pagination
                currentPage={purchasePage}
                totalItems={purchases.length}
                pageSize={purchasesPageSize}
                onPageChange={setPurchasePage}
              />
            </div>
          </>
        ) : null}
      </PageCard>

      <div ref={summarySectionRef} className="scroll-mt-6">
        <PageCard
          title="Company By Payable Summary"
          description="A consolidated view of companies carrying outstanding balances."
        >
          {isWorkspaceLoading ? <LoadingBlock label="Loading playable summary..." /> : null}
          {!isWorkspaceLoading && !error ? (
            <>
              {payableSummary.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                  <PayableSummaryTable rows={paginatedPayableSummary} />
                </div>
              ) : null}
              
              {payableSummary.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <StateMessage
                    title="No Outstanding Payables"
                    description="Awesome! There are no companies with outstanding purchase payables matching your filters."
                  />
                </div>
              ) : null}
              
              {payableSummary.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={payablePage}
                    totalItems={payableSummary.length}
                    pageSize={payableSummaryPageSize}
                    onPageChange={setPayablePage}
                  />
                </div>
              )}
            </>
          ) : null}
        </PageCard>
      </div>
    </div>
  );
}

function SummaryMetric({
  title,
  value,
  note,
  icon,
  colorClass,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <div className={`rounded-lg p-2 ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{note}</p>
      </div>
    </div>
  );
}

function PayableSummaryTable({
  rows,
}: {
  rows: CompanyWisePayableSummary[];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <th className="px-6 py-3">Company Name</th>
            <th className="px-6 py-3 text-center">Total Orders</th>
            <th className="px-6 py-3 text-center">Unsettled Orders</th>
            <th className="px-6 py-3 text-right">Total Value</th>
            <th className="px-6 py-3 text-right">Amount Paid</th>
            <th className="px-6 py-3 text-right">Outstanding</th>
            <th className="px-6 py-3">Last Purchase</th>
            <th className="px-6 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr key={row.companyId} className="transition-colors hover:bg-slate-50/50">
              <td className="px-6 py-4">
                <div className="font-medium text-slate-900">{row.companyName}</div>
                <div className="mt-0.5 text-xs text-slate-500">{row.companyCode}</div>
              </td>
              <td className="px-6 py-4 text-center text-slate-600">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-medium">
                  {row.purchaseCount}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-50 px-2 text-xs font-medium text-rose-700">
                  {row.payablePurchaseCount}
                </span>
              </td>
              <td className="px-6 py-4 text-right text-slate-600">
                {formatCurrency(row.totalAmount)}
              </td>
              <td className="px-6 py-4 text-right text-slate-600">
                {formatCurrency(row.totalPaid)}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="font-medium text-rose-600">
                  {formatCurrency(row.totalPayable)}
                </div>
              </td>
              <td className="px-6 py-4 text-slate-600">
                {row.lastPurchaseDate ? (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{formatDate(row.lastPurchaseDate)}</span>
                  </div>
                ) : (
                  <span className="text-slate-400">No purchase</span>
                )}
              </td>
              <td className="px-6 py-4 text-center">
                <Link
                  href={`/purchases/companies/${row.companyId}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <span>Ledger</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
