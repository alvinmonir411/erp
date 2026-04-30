'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  List,
  CheckCircle,
  Users,
  Package,
  Box,
  BarChart3,
  Settings,
  Map,
  Store,
  Building2,
  X,
  FileText
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  {
    title: 'Main',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    title: 'Orders',
    items: [
      { href: '/orders/new', label: 'New Order', icon: PlusCircle },
      { href: '/orders', label: 'Manage Order', icon: List },
    ]
  },
  {
    title: 'Delivery',
    items: [
      { href: '/delivery-ops', label: 'Delivery Report', icon: FileText },
      { href: '/delivery-ops/personnel', label: 'Delivery Person', icon: Users },
    ]
  },
  {
    title: 'Inventory',
    items: [
      { href: '/products', label: 'Products', icon: Box },
      { href: '/stock', label: 'Stock', icon: BarChart3 },
    ]
  },

  {
    title: 'Setup',
    items: [
      { href: '/routes', label: 'Routes', icon: Map },
      { href: '/shops', label: 'Shops', icon: Store },
      { href: '/companies', label: 'Companies', icon: Building2 },
    ]
  }
];

export function Sidebar({ isOpen, onToggle, onClose }: { isOpen: boolean, onToggle: () => void, onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-white transition-transform duration-300 ease-in-out lg:static lg:block lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-border`}>
        <div className="flex h-16 items-center border-b border-border px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <Package className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-primary">Dealer ERP</span>
          </div>
        </div>

        <nav className="h-[calc(100vh-64px)] overflow-y-auto p-4 scrollbar-thin">
          {navigation.map((group) => (
            <div key={group.title} className="mb-6">
              <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onClose()}
                      className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted hover:bg-secondary hover:text-foreground'
                        }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-muted'}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

