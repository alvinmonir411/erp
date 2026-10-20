'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Plus,
  DollarSign,
  Menu,
  Truck,
  Box,
} from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { Role } from '@/types/api';

interface MobileBottomNavProps {
  onOpenSidebar: () => void;
}

export function MobileBottomNav({ onOpenSidebar }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  // If user is delivery personnel, provide tailored field navigation
  const isDelivery = user?.role === Role.DELIVERY_MAN;

  // Determine dashboard link based on role
  const dashboardHref =
    user?.role === Role.MANAGER
      ? '/manager-dashboard'
      : user?.role === Role.SR
      ? '/sr-dashboard'
      : isDelivery
      ? '/my-deliveries'
      : '/dashboard';

  const isDashboardActive = pathname === dashboardHref || pathname === '/dashboard';
  const isOrdersActive = pathname.startsWith('/orders') && pathname !== '/orders/new';
  const isNewOrderActive = pathname === '/orders/new';
  const isDuesActive = pathname.startsWith('/dues');
  const isDeliveryActive = pathname.startsWith('/my-deliveries');
  const isStockActive = pathname.startsWith('/stock') || pathname.startsWith('/products');

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] print:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 items-center h-16 px-1 max-w-lg mx-auto">
        {/* 1. Dashboard / Deliveries */}
        <Link
          href={dashboardHref}
          className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 ${
            isDashboardActive
              ? 'text-indigo-600 font-black'
              : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          <div className="relative">
            {isDelivery ? <Truck className="h-5 w-5" /> : <LayoutDashboard className="h-5 w-5" />}
            {isDashboardActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 bg-indigo-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] tracking-tight truncate">
            {isDelivery ? 'Deliveries' : 'Home'}
          </span>
        </Link>

        {/* 2. Orders / Stock */}
        {isDelivery ? (
          <Link
            href="/my-deliveries/completed"
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 ${
              pathname === '/my-deliveries/completed'
                ? 'text-indigo-600 font-black'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <div className="relative">
              <Box className="h-5 w-5" />
            </div>
            <span className="text-[10px] tracking-tight truncate">History</span>
          </Link>
        ) : (
          <Link
            href="/orders"
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 ${
              isOrdersActive
                ? 'text-indigo-600 font-black'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              {isOrdersActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 bg-indigo-600 rounded-full" />
              )}
            </div>
            <span className="text-[10px] tracking-tight truncate">Orders</span>
          </Link>
        )}

        {/* 3. Center Vibrant Action Button: Create Order */}
        {!isDelivery ? (
          <Link
            href="/orders/new"
            aria-label="Create New Order"
            className="flex flex-col items-center justify-center -mt-5 transition-transform active:scale-90"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/40 border-2 border-white">
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black text-indigo-700 mt-0.5 tracking-tight">New Order</span>
          </Link>
        ) : (
          <div className="flex flex-col items-center justify-center -mt-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 border-2 border-white">
              <Truck className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-black text-indigo-700 mt-0.5 tracking-tight">DSR</span>
          </div>
        )}

        {/* 4. Dues / Collections */}
        <Link
          href="/dues"
          className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 ${
            isDuesActive
              ? 'text-indigo-600 font-black'
              : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          <div className="relative">
            <DollarSign className="h-5 w-5" />
            {isDuesActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 bg-indigo-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] tracking-tight truncate">Dues</span>
        </Link>

        {/* 5. Menu Drawer Toggle */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open Full Navigation Menu"
          className="flex flex-col items-center justify-center gap-1 py-1 text-slate-500 hover:text-slate-800 font-semibold transition-all active:scale-90"
        >
          <div className="flex h-5 w-5 items-center justify-center">
            <Menu className="h-5 w-5" />
          </div>
          <span className="text-[10px] tracking-tight truncate">Menu</span>
        </button>
      </div>
    </nav>
  );
}
