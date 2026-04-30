'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardMetrics } from '@/lib/api/dashboard';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { StatCard } from '@/components/ui/stat-card';
import {
  TrendingUp,
  Package,
  AlertCircle,
  Truck,
  CheckCircle,
  DollarSign,
  Activity,
  ShoppingCart,
  XCircle,
  Undo2,
  Clock,
  Wallet,
  Building2,
  Layers,
  Gift
} from 'lucide-react';
import Link from 'next/link';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-secondary ${className ?? ''}`} />;
}

export function DashboardPage() {
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => getDashboardMetrics(),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (error || !d) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white p-12 text-center">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <h3 className="mt-4 text-lg font-bold text-foreground">Dashboard Unavailable</h3>
        <p className="mt-2 text-sm text-muted">We couldn't load the metrics. Please check your connection or try again later.</p>
      </div>
    );
  }

  const { orders, delivery, money, stock } = d.uiMetrics;

  return (
    <div className="space-y-8 pb-20">
      {/* Orders Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="h-5 w-5 text-indigo-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Orders</h2>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Orders" value={formatNumber(orders.totalOrders)} icon={ShoppingCart} colorTheme="primary" />
          <StatCard label="Today Orders" value={formatNumber(orders.todayOrdersCount)} icon={ShoppingCart} colorTheme="emerald" />
          <StatCard label="Total Order Value" value={formatCurrency(orders.totalOrderValue)} icon={DollarSign} colorTheme="primary" />
          <StatCard label="Today Order Value" value={formatCurrency(orders.todayOrderValue)} icon={TrendingUp} colorTheme="emerald" />
          <StatCard label="Waiting Orders" value={formatNumber(orders.waitingOrders)} icon={Clock} colorTheme="amber" />
          <StatCard label="Cancelled Orders" value={formatNumber(orders.cancelledOrders)} icon={XCircle} colorTheme="rose" />
          <StatCard label="Today Cancelled" value={formatNumber(orders.todayCancelled)} icon={XCircle} colorTheme="rose" />
        </div>
      </section>

      {/* Delivery Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Truck className="h-5 w-5 text-amber-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Delivery</h2>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Dispatch" value={formatNumber(delivery.totalDispatch)} icon={Truck} colorTheme="indigo" />
          <StatCard label="Today Dispatch" value={formatNumber(delivery.todayDispatch)} icon={Truck} colorTheme="emerald" />
          <StatCard label="Pending Dispatch" value={formatNumber(delivery.pendingDispatch)} icon={Clock} colorTheme="amber" />
          <StatCard label="Return Pending" value={formatNumber(delivery.returnPending)} icon={Undo2} colorTheme="amber" />
          <StatCard label="Settled Batches" value={formatNumber(delivery.settledBatches)} icon={CheckCircle} colorTheme="primary" />
          <StatCard label="Today Settled Batches" value={formatNumber(delivery.todaySettledBatches)} icon={CheckCircle} colorTheme="emerald" />
        </div>
      </section>

      {/* Money Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5 text-emerald-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Money</h2>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Gross Amount" value={formatCurrency(money.totalGrossAmount)} icon={DollarSign} colorTheme="primary" />
          <StatCard label="Today Gross Amount" value={formatCurrency(money.todayGrossAmount)} icon={TrendingUp} colorTheme="emerald" />
          <StatCard label="Total Final Sold" value={formatCurrency(money.totalFinalSold)} icon={CheckCircle} colorTheme="indigo" />
          <StatCard label="Today Final Sold" value={formatCurrency(money.todayFinalSold)} icon={TrendingUp} colorTheme="emerald" />
          <StatCard label="Total Collected" value={formatCurrency(money.totalCollected)} icon={Wallet} colorTheme="primary" />
          <StatCard label="Today Collected" value={formatCurrency(money.todayCollected)} icon={Wallet} colorTheme="emerald" />
          <StatCard label="Total Due" value={formatCurrency(money.totalDue)} icon={AlertCircle} colorTheme="rose" />
          <StatCard label="Today Due" value={formatCurrency(money.todayDue)} icon={AlertCircle} colorTheme="amber" />
          <StatCard label="Total Profit" value={formatCurrency(money.totalProfit)} icon={TrendingUp} colorTheme="emerald" />
          <StatCard label="Today Profit" value={formatCurrency(money.todayProfit)} icon={TrendingUp} colorTheme="emerald" />
        </div>
      </section>

      {/* Stock Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-cyan-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Stock</h2>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Products" value={formatNumber(stock.totalProducts)} icon={Layers} colorTheme="slate" />
          <StatCard label="Total Stock Qty" value={formatNumber(stock.totalStockQty)} icon={Package} colorTheme="primary" />
          <StatCard label="Stock Value" value={formatCurrency(stock.stockValue)} icon={DollarSign} colorTheme="indigo" />
          <StatCard label="Low Stock" value={formatNumber(stock.lowStock)} icon={AlertCircle} colorTheme="amber" />
          <StatCard label="Out of Stock" value={formatNumber(stock.outOfStock)} icon={AlertCircle} colorTheme="rose" />
          <StatCard label="Today Sold Qty" value={formatNumber(stock.todaySoldQty)} icon={TrendingUp} colorTheme="emerald" />
          <StatCard label="Total Sold Qty" value={formatNumber(stock.totalSoldQty)} icon={TrendingUp} colorTheme="primary" />
          <StatCard label="Today Return Qty" value={formatNumber(stock.todayReturnQty)} icon={Undo2} colorTheme="amber" />
          <StatCard label="Total Return Qty" value={formatNumber(stock.totalReturnQty)} icon={Undo2} colorTheme="rose" />
          <Link href="/reports/free-quantity" className="block transition-transform hover:scale-[1.02] active:scale-[0.98]">
            <StatCard label="Total Free Given" value={`${formatNumber(stock.totalFreeQty)} PCS`} icon={Gift} colorTheme="indigo" description="All time free quantity" />
          </Link>
          <Link href="/reports/free-quantity" className="block transition-transform hover:scale-[1.02] active:scale-[0.98]">
            <StatCard label="Today Free Given" value={`${formatNumber(stock.todayFreeQty)} PCS`} icon={Gift} colorTheme="amber" description="Free quantity today" />
          </Link>
        </div>
      </section>

      {/* Main Chart */}
      <section className="modern-card p-4 sm:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">7-Day Sales Trend</h3>
            <p className="text-xs sm:text-sm text-muted">Daily settlement value (BD Time)</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-accent" />
              <span className="text-[10px] sm:text-xs font-medium text-muted">Settlement</span>
            </div>
          </div>
        </div>

        <div className="flex h-56 sm:h-72 items-end gap-1 sm:gap-3 px-1 sm:px-2 overflow-x-auto pb-4">
          {d.charts.last7Days.map((day: any) => {
            const max = Math.max(...d.charts.last7Days.map((x: any) => x.amount), 1);
            const height = (day.amount / max) * 100;
            return (
              <div key={day.date} className="group relative flex flex-1 flex-col items-center gap-2 sm:gap-3 min-w-[30px]">
                <div className="invisible absolute -top-12 z-10 rounded-lg bg-primary px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[11px] font-bold text-white shadow-xl transition-all group-hover:visible whitespace-nowrap">
                  {formatCurrency(day.amount)}
                </div>
                <div
                  className="w-full rounded-t-lg bg-accent/20 transition-all duration-300 group-hover:bg-accent"
                  style={{ height: `${Math.max(8, height)}%` }}
                />
                <span className="text-[8px] sm:text-[10px] font-bold text-muted uppercase tracking-tight whitespace-nowrap">{day.date.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
