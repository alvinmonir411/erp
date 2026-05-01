'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  User as UserIcon,
  Store,
  Loader2
} from 'lucide-react';
import { getCollections } from '@/lib/api/dues';
import { formatCurrency } from '@/lib/utils/format';
import { useAuth } from '../auth/auth-provider';
import { Role } from '@/types/api';


import Link from 'next/link';
import { DollarSign } from 'lucide-react';

export function CollectionsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['due-collections'],
    queryFn: getCollections,
  });

  const filteredCollections = collections.filter((c: any) =>
    c.shop?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.srName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PENDING': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-zinc-50 text-zinc-700 border-zinc-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Finance Hub</h2>
          <p className="text-sm text-muted">Manage dues, collections and approvals in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dues"
            className="inline-flex items-center gap-2 rounded-lg bg-white border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-zinc-50 transition-colors"
          >
            <DollarSign className="w-4 h-4 text-primary" />
            Due List
          </Link>
          <Link
            href="/dues/collections"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            <Clock className="w-4 h-4" />
            Collections
          </Link>
          {user?.role === Role.SUPER_ADMIN && (
            <Link
              href="/dues/approvals"
              className="inline-flex items-center gap-2 rounded-lg bg-white border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-zinc-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Approve Payments
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-zinc-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search collections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            />
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-6 py-4">Shop & Order</th>
                <th className="px-6 py-4">SR Name</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    <p className="mt-2 text-muted">Loading collections...</p>
                  </td>
                </tr>
              ) : filteredCollections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    No collections found.
                  </td>
                </tr>
              ) : (
                filteredCollections.map((c: any) => (
                  <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-foreground">{c.shop?.name}</p>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-tight">Order #{c.orderId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3 h-3 text-muted" />
                        <span className="font-medium">{c.srName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-primary">{formatCurrency(c.collectedAmount)}</td>
                    <td className="px-6 py-4 text-muted text-xs">
                      {new Date(c.collectionDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black border ${getStatusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted max-w-xs truncate">
                      {c.note || '-'}
                      {c.rejectedReason && (
                        <p className="text-rose-500 font-bold mt-1">Reason: {c.rejectedReason}</p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col divide-y divide-border">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-sm text-muted">Loading collections...</p>
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="p-12 text-center text-muted text-sm">
              No collections found.
            </div>
          ) : (
            filteredCollections.map((c: any) => (
              <div key={c.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-foreground text-sm">{c.shop?.name}</p>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-tight">Order #{c.orderId} • SR: {c.srName}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black border ${getStatusBadge(c.status)}`}>
                    {c.status}
                  </span>
                </div>
                
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                  <div>
                    <p className="text-[10px] font-bold text-muted uppercase">Amount Collected</p>
                    <p className="font-black text-primary text-base">{formatCurrency(c.collectedAmount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted uppercase">Date</p>
                    <p className="font-bold text-zinc-700 text-sm">{new Date(c.collectionDate).toLocaleDateString()}</p>
                  </div>
                </div>

                {(c.note || c.rejectedReason) && (
                  <div className="text-xs text-muted bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                    {c.note && <p><span className="font-bold">Note:</span> {c.note}</p>}
                    {c.rejectedReason && <p className="text-rose-500 font-bold mt-1">Reason: {c.rejectedReason}</p>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
