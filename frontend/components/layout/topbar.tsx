'use client';

import { useAuth } from '../auth/auth-provider';
import { usePathname } from 'next/navigation';
import { LogOut, User, Bell, Menu, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isSubPage = pathname.split('/').filter(Boolean).length > 1;
  
  const getTitle = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Dashboard';
    
    const first = parts[0];
    if (first === 'orders') return 'Order Management';
    if (first === 'delivery-ops') return 'Delivery Operations';
    if (first === 'products') return 'Product Catalog';
    if (first === 'stock') return 'Inventory Stock';
    if (first === 'routes') return 'Route Management';
    if (first === 'shops') return 'Shop Directory';
    if (first === 'companies') return 'Partner Companies';
    
    return first.charAt(0).toUpperCase() + first.slice(1).replace(/-/g, ' ');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-3">
        {isSubPage ? (
          <button
            onClick={handleBack}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={onMenuClick}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="text-lg font-black tracking-tight text-foreground md:text-xl">
            {getTitle()}
          </h1>
          <p className="hidden text-[10px] font-bold uppercase tracking-wider text-muted md:block">
            {new Date().toLocaleDateString('en-US', { 
              timeZone: 'Asia/Dhaka', 
              weekday: 'short', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-secondary hover:text-foreground">
          <Bell className="h-5 w-5" />
        </button>

        <div className="h-8 w-[1px] bg-border mx-1 hidden md:block" />

        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold text-foreground leading-none">{user?.name || 'User'}</p>
            <p className="mt-1 text-xs font-medium text-muted capitalize leading-none">{user?.role?.toLowerCase() || 'Admin'}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary border border-border">
            <User className="h-5 w-5" />
          </div>
        </div>
        
        <button 
          onClick={logout}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600 transition-colors md:h-auto md:w-auto md:px-3 md:py-2 md:text-sm md:font-medium"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
          <span className="hidden md:ml-2 md:inline">Logout</span>
        </button>
      </div>
    </div>
  );
}

