'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoute, deleteRoute, getRoutes, updateRoute } from '@/lib/api/routes';
import { getShops } from '@/lib/api/shops';
import { LoadingBlock } from '@/components/ui/loading-block';
import { Pagination } from '@/components/ui/pagination';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import type { Route, Shop } from '@/types/api';

const PAGE_SIZE = 10;
const initialForm = { name: '', area: '', isActive: true };
type FilterStatus = 'all' | 'active' | 'inactive';

export function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [summary, setSummary] = useState<any>(null);
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

  const fetchRoutes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getRoutes({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        isActive: filterStatus === 'active' ? true : filterStatus === 'inactive' ? false : undefined,
      });
      setRoutes(data.items || []);
      setTotalItems(data.total || 0);
      setSummary(data.summary || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load routes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, [page, search, filterStatus]);

  useEffect(() => {
    setForm(editingRoute
      ? { name: editingRoute.name, area: editingRoute.area ?? '', isActive: editingRoute.isActive }
      : initialForm);
  }, [editingRoute]);

  const shopCountForRoute = (id: number) => {
    const route = routes.find((r) => r.id === id);
    return route ? Number((route as any).shopCount || 0) : 0;
  };
  const activeShopsForRoute = (id: number) => {
    const route = routes.find((r) => r.id === id);
    return route ? Number((route as any).activeShopCount || 0) : 0;
  };

  const paginated = routes;
  const activeCount = summary ? summary.activeRoutes : 0;
  const totalShops = summary ? summary.totalShops : 0;
  const activeShops = summary ? summary.activeShops : 0;
  const uniqueAreas = summary ? summary.uniqueAreas : 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Route name is required.'); return; }
    setFormError(null);
    try {
      setIsSaving(true);
      const payload = { name: form.name.trim(), area: form.area.trim() || undefined, isActive: form.isActive };
      if (editingRoute) {
        await updateRoute(editingRoute.id, payload);
        setSuccess(`"${payload.name}" updated.`);
        setEditingRoute(null);
      } else {
        await createRoute(payload);
        setSuccess(`"${payload.name}" created.`);
        setForm(initialForm);
      }
      setPage(1);
      await fetchRoutes();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed to save.'); }
    finally { setIsSaving(false); }
  }

  async function handleToggleStatus(route: Route) {
    setIsTogglingId(route.id);
    try {
      await updateRoute(route.id, { isActive: !route.isActive });
      setSuccess(`"${route.name}" ${!route.isActive ? 'activated' : 'deactivated'}.`);
      await fetchRoutes();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed to update.'); }
    finally { setIsTogglingId(null); }
  }

  async function handleDelete() {
    if (!deletingRoute) return;
    setDeleteError(null);
    try {
      setIsDeleting(true);
      await deleteRoute(deletingRoute.id);
      setSuccess(`"${deletingRoute.name}" deleted.`);
      if (editingRoute?.id === deletingRoute.id) setEditingRoute(null);
      setDeletingRoute(null);
      setPage(1);
      await fetchRoutes();
    } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Failed to delete.'); setDeletingRoute(null); }
    finally { setIsDeleting(false); }
  }

  return (
    <>
      {/* Delete Modal */}
      {deletingRoute ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" onClick={() => setDeletingRoute(null)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-xl">🗑️</div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete Route</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Delete <span className="font-semibold text-slate-800">{deletingRoute.name}</span>?
                  {Number((deletingRoute as any).shopCount || 0) > 0
                    ? <span className="mt-1 block font-semibold text-amber-700">⚠️ This route has {Number((deletingRoute as any).shopCount || 0)} shop(s) — deletion will be blocked.</span>
                    : ' This route has no shops and can be safely deleted.'}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingRoute(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-300">Route Management</p>
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Routes</h1>
                <p className="mt-1.5 text-sm text-slate-400">Manage delivery routes and areas. Each route holds multiple shops for route-based sales.</p>
              </div>
              <button type="button" onClick={() => setEditingRoute(null)} className="self-start rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                + Add Route
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Total Routes</p>
                <p className="mt-2 text-2xl font-bold text-white">{summary?.totalRoutes || 0}</p>
                <p className="mt-1 text-xs text-slate-500">{activeCount} active</p>
              </div>
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-400">Areas</p>
                <p className="mt-2 text-2xl font-bold text-white">{uniqueAreas}</p>
                <p className="mt-1 text-xs text-slate-500">Unique areas</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400">Total Shops</p>
                <p className="mt-2 text-2xl font-bold text-white">{totalShops}</p>
                <p className="mt-1 text-xs text-slate-500">{activeShops} active</p>
              </div>
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-400">Avg Shops</p>
                <p className="mt-2 text-2xl font-bold text-white">{summary?.totalRoutes > 0 ? (totalShops / summary.totalRoutes).toFixed(1) : '0'}</p>
                <p className="mt-1 text-xs text-slate-500">Per route</p>
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
                <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search route name or area..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100" />
                <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(['all', 'active', 'inactive'] as FilterStatus[]).map((s) => (
                    <button key={s} type="button" onClick={() => { setPage(1); setFilterStatus(s); }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${filterStatus === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {(search || filterStatus !== 'all') && (
                <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                  Showing {totalItems} routes
                  <button type="button" onClick={() => { setSearch(''); setFilterStatus('all'); setPage(1); }} className="ml-3 font-semibold text-rose-600 hover:underline">Clear</button>
                </div>
              )}
            </div>

            {isLoading ? <LoadingBlock label="Loading routes..." /> : null}
            {!isLoading && totalItems === 0 ? <StateMessage title="No routes found" description="Adjust your search or add a new route." /> : null}

            <div className="space-y-3">
              {paginated.map((route) => {
                const isEditing = editingRoute?.id === route.id;
                const isToggling = isTogglingId === route.id;
                const shopCount = shopCountForRoute(route.id);
                const activeShopCount = activeShopsForRoute(route.id);

                return (
                  <div key={route.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${isEditing ? 'border-cyan-300 ring-2 ring-cyan-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-bold text-slate-900">{route.name}</p>
                            {route.area ? (
                              <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">📍 {route.area}</span>
                            ) : null}
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${route.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {route.isActive ? '● Active' : '○ Inactive'}
                            </span>
                            {isEditing && <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-700">Editing</span>}
                          </div>
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          <button type="button" onClick={() => void handleToggleStatus(route)} disabled={isToggling}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${route.isActive ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                            {isToggling ? '…' : route.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" onClick={() => setEditingRoute(isEditing ? null : route)}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${isEditing ? 'border-cyan-300 bg-cyan-100 text-cyan-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}>
                            {isEditing ? '✕' : '✏️'}
                          </button>
                          <button type="button" onClick={() => setDeletingRoute(route)}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Shop count stats */}
                      <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
                        <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-center">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Shops</p>
                          <p className="mt-0.5 text-xl font-bold text-slate-900">{shopCount}</p>
                        </div>
                        <div className={`rounded-xl px-4 py-2.5 text-center ${activeShopCount > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider ${activeShopCount > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>Active Shops</p>
                          <p className={`mt-0.5 text-xl font-bold ${activeShopCount > 0 ? 'text-emerald-900' : 'text-slate-400'}`}>{activeShopCount}</p>
                        </div>
                        {shopCount > activeShopCount ? (
                          <div className="rounded-xl bg-amber-50 px-4 py-2.5 text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">Inactive</p>
                            <p className="mt-0.5 text-xl font-bold text-amber-800">{shopCount - activeShopCount}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination currentPage={page} totalItems={totalItems} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>

          {/* ── Right: Form ── */}
          <div className="sticky top-4 h-fit">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">{editingRoute ? 'Edit Route' : 'Add Route'}</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">{editingRoute ? editingRoute.name : 'New Route'}</h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Route Name <span className="text-rose-500">*</span></span>
                    <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      placeholder="e.g. North Zone Route" />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Area</span>
                    <input value={form.area} onChange={(e) => setForm((c) => ({ ...c, area: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      placeholder="e.g. Mirpur, Dhanmondi (optional)" />
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))} className="h-4 w-4 accent-slate-900" />
                    <span className="text-sm font-medium text-slate-700">Route is active</span>
                  </label>

                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs text-cyan-800">
                    💡 Form resets after each save — great for entering multiple routes in a row.
                  </div>

                  <div className="flex gap-3 border-t border-slate-100 pt-4">
                    <button type="submit" disabled={isSaving} className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60">
                      {isSaving ? 'Saving...' : editingRoute ? 'Save changes' : 'Add route'}
                    </button>
                    {editingRoute ? (
                      <button type="button" onClick={() => setEditingRoute(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
