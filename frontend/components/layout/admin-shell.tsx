'use client';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { ToastProvider } from '@/components/ui/toast-provider';
import { useAuth } from '../auth/auth-provider';
import { useState } from 'react';

import { MobileBottomNav } from './mobile-bottom-nav';

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <ToastProvider>
      {isAuthPage ? (
        children
      ) : (
        <div className="min-h-screen bg-background print:min-h-0 print:bg-white print:p-0">
          <div className="flex w-full flex-col lg:flex-row print:block">
            {/* Sidebar container */}
            <div className="sticky top-0 z-40 h-auto w-full lg:h-screen lg:w-72 lg:flex-shrink-0 print:hidden">
              <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} onClose={closeSidebar} />
            </div>

            {/* Main content area */}
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center border-b border-border bg-background/80 px-3 sm:px-4 backdrop-blur-md print:hidden md:px-8">
                <Topbar onMenuClick={toggleSidebar} />
              </header>
              <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 pb-24 sm:pb-28 lg:pb-8 print:p-0">
                <div className="w-full max-w-full overflow-x-hidden">
                  {children}
                </div>
              </main>

              {/* Mobile Bottom Navigation */}
              <MobileBottomNav onOpenSidebar={openSidebar} />
            </div>
          </div>
        </div>
      )}
    </ToastProvider>
  );
}

