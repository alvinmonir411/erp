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
  FileText,
  DollarSign,
  Truck
} from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { Role } from '@/types/api';

const navigation = [
  {
    title: 'Main',
    roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR],
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [Role.SUPER_ADMIN, Role.ADMIN] },
      { href: '/manager-dashboard', label: 'Manager Dashboard', icon: LayoutDashboard, roles: [Role.MANAGER] },
      { href: '/sr-dashboard', label: 'SR Dashboard', icon: LayoutDashboard, roles: [Role.SR] },
    ]
  },
  {
    title: 'Orders',
    roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR],
    items: [
      { href: '/orders/new', label: 'New Order', icon: PlusCircle },
      { href: '/orders', label: 'Manage Order', icon: List },
    ]
  },
  {
    title: 'Finance',
    roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR],
    items: [
      { href: '/dues', label: 'Due', icon: DollarSign },
    ]
  },
  {
    title: 'Delivery',
    roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
    items: [
      { href: '/delivery-ops', label: 'Delivery Report', icon: FileText },
    ]
  },
  {
    title: 'Inventory',
    roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
    items: [
      { href: '/products', label: 'Products', icon: Box },
      { href: '/stock', label: 'Stock', icon: BarChart3 },
    ]
  },
  {
    title: 'Setup',
    roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR],
    items: [
      { href: '/routes', label: 'Routes', icon: Map, roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER] },
      { href: '/shops', label: 'Shops', icon: Store, roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SR] },
      { href: '/companies', label: 'Companies', icon: Building2, roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER] },
    ]
  },
  {
    title: 'System',
    roles: [Role.SUPER_ADMIN, Role.ADMIN],
    items: [
      { href: '/users', label: 'User Management', icon: Users },
      { href: '/settings', label: 'Settings', icon: Settings, roles: [Role.SUPER_ADMIN] },
    ]
  },
  {
    title: 'Field Operations',
    roles: [Role.DELIVERY_MAN],
    items: [
      { href: '/my-deliveries', label: 'My Deliveries', icon: Truck },
      { href: '/my-deliveries/assigned', label: 'Assigned Orders', icon: List },
      { href: '/my-deliveries/completed', label: 'Completed Deliveries', icon: CheckCircle },
    ]
  }
];

export function Sidebar({ isOpen, onToggle, onClose }: { isOpen: boolean, onToggle: () => void, onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const filteredNavigation = navigation
    .filter(group => !group.roles || (user && group.roles.includes(user.role)))
    .map(group => ({
      ...group,
      items: group.items.filter((item: any) => !item.roles || (user && item.roles.includes(user.role)))
    }))
    .filter(group => group.items.length > 0);

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
            <span className="text-xl font-bold tracking-tight text-primary">MS Karim traders</span>
          </div>
        </div>

        <nav className="h-[calc(100vh-128px)] overflow-y-auto p-4 scrollbar-thin">
          {filteredNavigation.map((group) => (
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

        <div className="border-t border-border p-4">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-red-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

