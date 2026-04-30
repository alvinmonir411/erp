'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getRoutes } from '@/lib/api/routes';
import { createShop, deleteShop, getShops, updateShop } from '@/lib/api/shops';
import { LoadingBlock } from '@/components/ui/loading-block';
import { Pagination } from '@/components/ui/pagination';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency } from '@/lib/utils/format';
import type { Route, Shop } from '@/types/api';

const PAGE_SIZE = 12;
const initialForm = { routeId: '', name: '', ownerName: '', phone: '', address: '', isActive: true };
type FilterStatus = 'all' | 'active' | 'inactive';

export function ShopsPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [deletingShop, setDeletingShop] = useState<Shop | null>(null);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [filterRouteId, setFilterRouteId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingId, setIsTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useToastNotification({ message: error, title: 'Load error', tone: 'error' });
  useToastNotification({ message: formError, title: 'Save error', tone: 'error' });
  useToastNotification({ message: deleteError, title: 'Delete error', tone: 'error' });
  useToastNotification({ message: success, title: 'Done', tone: 'success' });

  async function load() {
    try {
      setIsLoading(true);
      setError(null);
      const [routeData, shopData] = await Promise.all([getRoutes(), getShops(undefined, undefined)]);
      setRoutes(routeData);
      setShops(shopData);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load.'); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    setForm(editingShop
      ? { routeId: String(editingShop.routeId), name: editingShop.name, ownerName: editingShop.ownerName ?? '', phone: editingShop.phone ?? '', address: editingShop.address ?? '', isActive: editingShop.isActive }
      : { ...initialForm, routeId: filterRouteId ? String(filterRouteId) : '' });
  }, [editingShop, filterRouteId]);

  const filtered = useMemo(() => {
    let list = shops.filter((s) => {
      const q = search.toLowerCase();
      if (q && !s.name.toLowerCase().includes(q) && !(s.ownerName ?? '').toLowerCase().includes(q) && !(s.phone ?? '').includes(q)) return false;
      if (filterRouteId && s.routeId !== filterRouteId) return false;
      if (filterStatus === 'active' && !s.isActive) return false;
      if (filterStatus === 'inactive' && s.isActive) return false;
      return true;
    });
    return list;
  }, [shops, search, filterRouteId, filterStatus]);

  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const totalOrders = filtered.reduce((s, sh) => s + (sh.totalOrders ?? 0), 0);
  const totalDue = filtered.reduce((s, sh) => s + (sh.totalDue ?? 0), 0);
  const activeCount = shops.filter((s) => s.isActive).length;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.routeId || !form.name.trim()) { setFormError('Route and shop name are required.'); return; }
    setFormError(null);
    try {
      setIsSaving(true);
      const payload = { routeId: Number(form.routeId), name: form.name.trim(), ownerName: form.ownerName || undefined, phone: form.phone || undefined, address: form.address || undefined, isActive: form.isActive };
      if (editingShop) {
        await updateShop(editingShop.id, payload);
        setSuccess(`"${payload.name}" updated.`);
        setEditingShop(null);
      } else {
        await createShop(payload);
        setSuccess(`"${payload.name}" added.`);
        setForm({ ...initialForm, routeId: form.routeId });
      }
      await load();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed to save.'); }
    finally { setIsSaving(false); }
  }

  async function handleToggleStatus(shop: Shop) {
    setIsTogglingId(shop.id);
    try {
      await updateShop(shop.id, { isActive: !shop.isActive });
      setSuccess(`"${shop.name}" ${!shop.isActive ? 'activated' : 'deactivated'}.`);
      await load();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed to update.'); }
    finally { setIsTogglingId(null); }
  }

  async function handleDelete() {
    if (!deletingShop) return;
    setDeleteError(null);
    try {
      setIsDeleting(true);
      await deleteShop(deletingShop.id);
      setSuccess(`"${deletingShop.name}" deleted.`);
      if (editingShop?.id === deletingShop.id) setEditingShop(null);
      setDeletingShop(null);
      await load();
    } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Failed to delete.'); setDeletingShop(null); }
    finally { setIsDeleting(false); }
  }

  return (
    <>
      {/* Delete Modal */}
      {deletingShop ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" onClick={() => setDeletingShop(null)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-xl">🗑️</div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete Shop</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Delete <span className="font-semibold text-slate-800">{deletingShop.name}</span>? Shops with sales history cannot be deleted.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingShop(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void handleDelete()} disabled={isDeleting} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {isDeleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-5">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#0c1e38_100%)] p-6 shadow-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_60%,rgba(14,165,233,0.15),transparent_55%)]" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/15 px-3 py-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-300">Shop Management</p>
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Shops</h1>
                <p className="mt-1.5 text-sm text-slate-400">Manage shops across routes, track orders and outstanding dues.</p>
              </div>
              <button type="button" onClick={() => { setEditingShop(null); setForm({ ...initialForm, routeId: filterRouteId ? String(filterRouteId) : '' }); }}
                className="self-start rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                + Add Shop
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Total Shops</p>
                <p className="mt-2 text-2xl font-bold text-white">{shops.length}</p>
                <p className="mt-1 text-xs text-slate-500">{activeCount} active</p>
              </div>
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-400">Routes</p>
                <p className="mt-2 text-2xl font-bold text-white">{routes.length}</p>
                <p className="mt-1 text-xs text-slate-500">Across all areas</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400">Showing Orders</p>
                <p className="mt-2 text-2xl font-bold text-white">{totalOrders}</p>
                <p className="mt-1 text-xs text-slate-500">Filtered view</p>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/15 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400">Total Due</p>
                <p className="mt-2 truncate text-2xl font-bold text-amber-100">{formatCurrency(totalDue)}</p>
                <p className="mt-1 text-xs text-slate-500">Filtered view</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          {/* ── Left: List ── */}
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search shop name, owner, phone..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100" />
                <select value={filterRouteId ?? ''} onChange={(e) => { setPage(1); setFilterRouteId(e.target.value ? Number(e.target.value) : null); }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-300">
                  <option value="">All routes</option>
                  {routes.map((r) => <option key={r.id} value={r.id}>{r.name}{r.area ? ` — ${r.area}` : ''}</option>)}
                </select>
                <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(['all', 'active', 'inactive'] as FilterStatus[]).map((s) => (
                    <button key={s} type="button" onClick={() => setFilterStatus(s)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${filterStatus === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {(search || filterRouteId || filterStatus !== 'all') && (
                <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                  Showing {filtered.length} of {shops.length} shops
                  <button type="button" onClick={() => { setSearch(''); setFilterRouteId(null); setFilterStatus('all'); }} className="ml-3 font-semibold text-rose-600 hover:underline">Clear filters</button>
                </div>
              )}
            </div>

            {isLoading ? <LoadingBlock label="Loading shops..." /> : null}
            {!isLoading && filtered.length === 0 ? <StateMessage title="No shops found" description="Try adjusting your filters or add a new shop." /> : null}

            <div className="space-y-3">
              {paginated.map((shop) => {
                const isEditing = editingShop?.id === shop.id;
                const isToggling = isTogglingId === shop.id;
                const hasDue = (shop.totalDue ?? 0) > 0;

                return (
                  <div key={shop.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${isEditing ? 'border-cyan-300 ring-2 ring-cyan-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-bold text-slate-900">{shop.name}</p>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${shop.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {shop.isActive ? '● Active' : '○ Inactive'}
                            </span>
                            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              {shop.route?.name ?? `Route #${shop.routeId}`}
                            </span>
                            {isEditing && <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-700">Editing</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
                            {shop.ownerName ? <span>👤 {shop.ownerName}</span> : null}
                            {shop.phone ? <span>📞 {shop.phone}</span> : null}
                            {shop.address ? <span>📍 {shop.address}</span> : null}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          <Link href={`/sales/shops/${shop.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white">
                            Ledger
                          </Link>
                          <button type="button" onClick={() => void handleToggleStatus(shop)} disabled={isToggling}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${shop.isActive ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                            {isToggling ? '…' : shop.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" onClick={() => setEditingShop(isEditing ? null : shop)}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${isEditing ? 'border-cyan-300 bg-cyan-100 text-cyan-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}>
                            {isEditing ? '✕' : '✏️'}
                          </button>
                          <button type="button" onClick={() => setDeletingShop(shop)}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
                        <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-center">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Orders</p>
                          <p className="mt-0.5 text-xl font-bold text-slate-900">{shop.totalOrders ?? 0}</p>
                        </div>
                        <div className={`rounded-xl px-4 py-2.5 text-center ${hasDue ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider ${hasDue ? 'text-amber-500' : 'text-emerald-500'}`}>Due</p>
                          <p className={`mt-0.5 text-xl font-bold ${hasDue ? 'text-amber-800' : 'text-emerald-800'}`}>{formatCurrency(shop.totalDue ?? 0)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>

          {/* ── Right: Form ── */}
          <div className="sticky top-4 h-fit">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">{editingShop ? 'Edit Shop' : 'Add Shop'}</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">{editingShop ? editingShop.name : 'New Shop'}</h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Route <span className="text-rose-500">*</span></span>
                    <select value={form.routeId} onChange={(e) => setForm((c) => ({ ...c, routeId: e.target.value }))} required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100">
                      <option value="">Select route</option>
                      {routes.map((r) => <option key={r.id} value={r.id}>{r.name}{r.area ? ` — ${r.area}` : ''}</option>)}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Shop Name <span className="text-rose-500">*</span></span>
                    <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      placeholder="e.g. City Corner Store" />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Owner Name</span>
                    <input value={form.ownerName} onChange={(e) => setForm((c) => ({ ...c, ownerName: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      placeholder="Optional" />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Phone</span>
                    <input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      placeholder="Optional" />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Address</span>
                    <textarea value={form.address} onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))} rows={2}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      placeholder="Optional" />
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))} className="h-4 w-4 accent-slate-900" />
                    <span className="text-sm font-medium text-slate-700">Shop is active</span>
                  </label>

                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs text-cyan-800">
                    💡 Route stays selected after each save — great for bulk shop entry.
                  </div>

                  <div className="flex gap-3 border-t border-slate-100 pt-4">
                    <button type="submit" disabled={isSaving} className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60">
                      {isSaving ? 'Saving...' : editingShop ? 'Save changes' : 'Add shop'}
                    </button>
                    {editingShop ? (
                      <button type="button" onClick={() => setEditingShop(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
