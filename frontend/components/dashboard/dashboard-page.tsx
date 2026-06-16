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
import { SRDuesList } from './sr-dues-list';
import { useAuth } from '../auth/auth-provider';
import { Role } from '@/types/api';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-secondary ${className ?? ''}`} />;
}

export function DashboardPage() {
  const { user } = useAuth();
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
  const deliveryRate = delivery.totalDispatch > 0 
    ? `${Math.round((delivery.delivered / delivery.totalDispatch) * 100)}%` 
    : '0%';

  return (
    <div className="space-y-8 pb-20">
      {/* Today's Summary Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-rose-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            {user?.role === Role.SR ? "Today's Activity" : "Today's Summary"}
          </h2>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            label="Today Orders"
            value={formatNumber(orders.todayOrdersCount)}
            description={`Value: ${formatCurrency(orders.todayOrderValue)}`}
            icon={ShoppingCart}
            colorTheme="cyan"
          />
          <StatCard
            label="Today Dispatch"
            value={formatNumber(delivery.todayDispatch)}
            description={delivery.todayDispatchAmount > 0 ? `Value: ${formatCurrency(delivery.todayDispatchAmount)}` : undefined}
            icon={Truck}
            colorTheme="amber"
          />
          <StatCard
            label="Today Dispatch Amount"
            value={formatCurrency(delivery.todayDispatchAmount || 0)}
            icon={DollarSign}
            colorTheme="indigo"
          />
          <StatCard
            label="Today Due"
            value={formatCurrency(money.todayDue || 0)}
            icon={AlertCircle}
            colorTheme="rose"
          />
          <StatCard
            label="Today Due Collection"
            value={formatCurrency(money.todayDueCollection || 0)}
            icon={CheckCircle}
            colorTheme="emerald"
          />
          <StatCard
            label="Total Due"
            value={formatCurrency(money.totalDue)}
            icon={Wallet}
            colorTheme="violet"
          />
        </div>
      </section>

      {/* Orders Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="h-5 w-5 text-indigo-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            {user?.role === Role.SR ? 'My Orders' : 'Orders Overview'}
          </h2>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Total Orders" value={formatNumber(orders.totalOrders)} icon={ShoppingCart} colorTheme="primary" />
          <StatCard label="Today Orders" value={formatNumber(orders.todayOrdersCount)} icon={ShoppingCart} colorTheme="emerald" />
          <StatCard label="Total Order Value" value={formatCurrency(orders.totalOrderValue)} icon={DollarSign} colorTheme="indigo" />
          <StatCard label="Today Order Value" value={formatCurrency(orders.todayOrderValue)} icon={TrendingUp} colorTheme="cyan" />
          <StatCard label="Cancelled Orders" value={formatNumber(orders.cancelledOrders)} icon={XCircle} colorTheme="rose" />
          <StatCard label="Today Cancelled" value={formatNumber(orders.todayCancelled)} icon={XCircle} colorTheme="violet" />
        </div>
      </section>

      {/* Delivery Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Truck className="h-5 w-5 text-amber-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            {user?.role === Role.SR ? 'My Deliveries' : 'Delivery Operations'}
          </h2>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Dispatch" value={formatNumber(delivery.totalDispatch)} icon={Truck} colorTheme="indigo" />
          <StatCard label="Today Dispatch" value={formatNumber(delivery.todayDispatch)} icon={Truck} colorTheme="emerald" />
          <StatCard label="Pending Dispatch" value={formatNumber(delivery.pendingDispatch)} icon={Clock} colorTheme="amber" />
          <StatCard label="Delivered" value={formatNumber(delivery.delivered)} icon={CheckCircle} colorTheme="primary" />
          <StatCard label="Delivery Completion" value={deliveryRate} icon={TrendingUp} colorTheme="cyan" />
        </div>
      </section>

      {/* Money Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5 text-emerald-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            {user?.role === Role.SR ? 'My Collections' : 'Financial Overview'}
          </h2>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Final Sold" value={formatCurrency(money.totalFinalSold)} icon={CheckCircle} colorTheme="indigo" />
          <StatCard label="Today Final Sold" value={formatCurrency(money.todayFinalSold)} icon={TrendingUp} colorTheme="emerald" />
          <StatCard label="Remaining Due" value={formatCurrency(money.totalDue)} icon={AlertCircle} colorTheme="rose" />
          
          {user?.role === Role.SR ? (
            <>
              <StatCard label="Pending Approval" value={formatCurrency(money.pendingCollected)} icon={Clock} colorTheme="amber" />
              <StatCard label="Approved Collection" value={formatCurrency(money.approvedCollected)} icon={CheckCircle} colorTheme="emerald" />
              <StatCard label="Rejected Collection" value={formatCurrency(money.rejectedCollected)} icon={XCircle} colorTheme="rose" />
            </>
          ) : (
            <>
              <StatCard label="Pending Collections" value={formatCurrency(money.pendingCollected)} icon={Clock} colorTheme="amber" />
              <StatCard label="Approved Collections" value={formatCurrency(money.approvedCollected)} icon={CheckCircle} colorTheme="emerald" />
              <StatCard label="Rejected Collections" value={formatCurrency(money.rejectedCollected)} icon={XCircle} colorTheme="rose" />
              {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER) && (
                <StatCard label="Total Profit" value={formatCurrency(money.totalProfit)} icon={TrendingUp} colorTheme="violet" />
              )}
            </>
          )}
        </div>
      </section>

      {/* SR Specific Due List */}
      {user?.role === Role.SR && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-rose-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
              My Outstanding Dues
            </h2>
          </div>
          <SRDuesList />
        </section>
      )}

      {/* Stock Section - Restricted for SR */}
      {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER || user?.role === Role.ADMIN) && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-cyan-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Inventory</h2>
          </div>
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            <StatCard label="Total Products" value={formatNumber(stock.totalProducts)} icon={Layers} colorTheme="indigo" />
            <StatCard label="Active Products" value={formatNumber(stock.activeProducts)} icon={Activity} colorTheme="cyan" />
            <StatCard label="Inactive Products" value={formatNumber(stock.inactiveProducts)} icon={Layers} colorTheme="slate" />
            <StatCard label="In Stock" value={formatNumber(stock.inStockProducts)} icon={CheckCircle} colorTheme="emerald" />
            <StatCard label="Low Stock" value={formatNumber(stock.lowStockProducts)} icon={AlertCircle} colorTheme="amber" />
            <StatCard label="Out of Stock" value={formatNumber(stock.outOfStockProducts)} icon={XCircle} colorTheme="rose" />
            {stock.stockValue > 0 ? (
              <StatCard label="Stock Value" value={formatCurrency(stock.stockValue)} icon={DollarSign} colorTheme="violet" />
            ) : (
              <div className="hidden xl:block" />
            )}
          </div>
        </section>
      )}

      {/* Company Wise Sales & Profit Section */}
      {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER || user?.role === Role.ADMIN) && d.companySummary && d.companySummary.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-indigo-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Company-wise Sales & Profit</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.companySummary.map((c: any) => (
              <div
                key={c.companyId}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 line-clamp-1">{c.companyName}</h4>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Company Wise Summary</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="text-[8px] font-black uppercase text-slate-400">Total Sales</p>
                      <p className="text-sm font-black text-emerald-600">{formatCurrency(c.sales)}</p>
                    </div>
                    {(user?.role === Role.SUPER_ADMIN || user?.role === Role.MANAGER) ? (
                      <div>
                        <p className="text-[8px] font-black uppercase text-slate-400">Total Profit</p>
                        <p className="text-sm font-black text-violet-600">{formatCurrency(c.profit)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[8px] font-black uppercase text-slate-400">Company ID</p>
                        <p className="text-sm font-black text-slate-500">#{c.companyId}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
              <div key={day.date} className="group relative flex flex-1 h-full flex-col items-center min-w-[30px]">
                <div className="invisible absolute -top-12 z-10 rounded-lg bg-primary px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[11px] font-bold text-white shadow-xl transition-all group-hover:visible whitespace-nowrap">
                  {formatCurrency(day.amount)}
                </div>
                <div className="flex-1 w-full flex items-end justify-center mb-2 sm:mb-3">
                  <div
                    className="w-full rounded-t-lg bg-accent/20 transition-all duration-300 group-hover:bg-accent"
                    style={{ height: `${Math.max(8, height)}%` }}
                  />
                </div>
                <span className="text-[8px] sm:text-[10px] font-bold text-muted uppercase tracking-tight whitespace-nowrap">{day.date.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
