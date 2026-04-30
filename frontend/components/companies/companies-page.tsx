'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createCompany, deleteCompany, getCompanies, updateCompany } from '@/lib/api/companies';
import type { Company } from '@/types/api';
import { LoadingBlock } from '@/components/ui/loading-block';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';

const initialForm = { name: '', code: '', address: '', phone: '', isActive: true };

function formatMoney(v: number) {
  return new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(v);
}

type FilterStatus = 'all' | 'active' | 'inactive';
type SortKey = 'name' | 'code' | 'newest';

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
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
      const data = await getCompanies();
      setCompanies(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    setForm(editingCompany
      ? { name: editingCompany.name, code: editingCompany.code, address: editingCompany.address, phone: editingCompany.phone, isActive: editingCompany.isActive }
      : initialForm);
  }, [editingCompany]);

  const activeCount = companies.filter((c) => c.isActive).length;
  const inactiveCount = companies.length - activeCount;

  const filtered = useMemo(() => {
    let list = companies.filter((c) => {
      const q = search.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q) && !c.address.toLowerCase().includes(q)) return false;
      if (filterStatus === 'active' && !c.isActive) return false;
      if (filterStatus === 'inactive' && c.isActive) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'code') return a.code.localeCompare(b.code);
      return b.id - a.id;
    });
    return list;
  }, [companies, search, filterStatus, sortKey]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) { setFormError('Name and code are required.'); return; }
    setFormError(null);
    try {
      setIsSaving(true);
      const payload = { name: form.name.trim(), code: form.code.trim(), address: form.address.trim(), phone: form.phone.trim(), isActive: form.isActive };
      if (editingCompany) {
        await updateCompany(editingCompany.id, payload);
        setSuccess(`"${payload.name}" updated.`);
        setEditingCompany(null);
      } else {
        await createCompany(payload);
        setSuccess(`"${payload.name}" created.`);
        setForm(initialForm);
      }
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleStatus(company: Company) {
    setIsTogglingId(company.id);
    try {
      await updateCompany(company.id, { isActive: !company.isActive });
      setSuccess(`"${company.name}" marked ${!company.isActive ? 'active' : 'inactive'}.`);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setIsTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deletingCompany) return;
    setDeleteError(null);
    try {
      setIsDeleting(true);
      await deleteCompany(deletingCompany.id);
      setSuccess(`"${deletingCompany.name}" deleted.`);
      if (editingCompany?.id === deletingCompany.id) setEditingCompany(null);
      setDeletingCompany(null);
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete.');
      setDeletingCompany(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      {/* Delete Modal */}
      {deletingCompany ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" onClick={() => setDeletingCompany(null)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-xl">🗑️</div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete Company</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Delete <span className="font-semibold text-slate-800">{deletingCompany.name}</span>? This cannot be undone.
                  Companies with products cannot be deleted.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingCompany(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void handleDelete()} disabled={isDeleting} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {isDeleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-5">
        {/* ── Dark Hero ── */}
        <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#0c1e38_100%)] p-6 shadow-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_60%,rgba(14,165,233,0.15),transparent_55%)]" />
          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/15 px-3 py-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-300">Company Management</p>
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Companies</h1>
                <p className="mt-1.5 text-sm text-slate-400">Manage your supplier companies and their basic profile information.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCompany(null)}
                className="self-start rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                + Add Company
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Total</p>
                <p className="mt-2 text-2xl font-bold text-white">{companies.length}</p>
                <p className="mt-1 text-xs text-slate-500">Companies</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400">Active</p>
                <p className="mt-2 text-2xl font-bold text-white">{activeCount}</p>
                <p className="mt-1 text-xs text-slate-500">{inactiveCount} inactive</p>
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
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, code, address..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                />
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    {(['all', 'active', 'inactive'] as FilterStatus[]).map((s) => (
                      <button key={s} type="button" onClick={() => setFilterStatus(s)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${filterStatus === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-300">
                    <option value="name">Sort: Name</option>
                    <option value="code">Sort: Code</option>
                    <option value="newest">Sort: Newest</option>
                  </select>
                </div>
              </div>
              {(search || filterStatus !== 'all') && (
                <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                  Showing {filtered.length} of {companies.length} companies
                  <button type="button" onClick={() => { setSearch(''); setFilterStatus('all'); }} className="ml-3 font-semibold text-rose-600 hover:underline">Clear filters</button>
                </div>
              )}
            </div>

            {isLoading ? <LoadingBlock label="Loading companies..." /> : null}
            {!isLoading && filtered.length === 0 ? (
              <StateMessage title="No companies found" description="Try adjusting your search or filters." />
            ) : null}

            <div className="space-y-3">
              {filtered.map((company) => {
                const isEditing = editingCompany?.id === company.id;
                const isToggling = isTogglingId === company.id;

                return (
                  <div key={company.id} className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition ${isEditing ? 'border-cyan-300 ring-2 ring-cyan-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold text-slate-900">{company.name}</span>
                            <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-500">{company.code}</span>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${company.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {company.isActive ? '● Active' : '○ Inactive'}
                            </span>
                            {isEditing && <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-700">Editing</span>}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-slate-400">
                            {company.address ? <span>📍 {company.address}</span> : null}
                            {company.phone ? <span>📞 {company.phone}</span> : null}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          <button type="button" onClick={() => void handleToggleStatus(company)} disabled={isToggling}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${company.isActive ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                            {isToggling ? '…' : company.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" onClick={() => setEditingCompany(isEditing ? null : company)}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${isEditing ? 'border-cyan-300 bg-cyan-100 text-cyan-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}>
                            {isEditing ? '✕' : '✏️'}
                          </button>
                          <button type="button" onClick={() => setDeletingCompany(company)}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
                            🗑️
                          </button>
                        </div>
                      </div>


                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right: Form ── */}
          <div className="sticky top-4 h-fit">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">{editingCompany ? 'Edit Company' : 'Add Company'}</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">{editingCompany ? editingCompany.name : 'New Company'}</h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Company Name <span className="text-rose-500">*</span></span>
                    <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      placeholder="e.g. Acme Corp" />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Company Code <span className="text-rose-500">*</span></span>
                    <input value={form.code} onChange={(e) => setForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))} required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      placeholder="e.g. ACME" />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Phone</span>
                    <input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      placeholder="+880 17..." />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Address</span>
                    <textarea value={form.address} onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))} rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                      placeholder="Company address" />
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))}
                      className="h-4 w-4 accent-slate-900" />
                    <span className="text-sm font-medium text-slate-700">Company is active</span>
                  </label>

                  <div className="flex gap-3 border-t border-slate-100 pt-4">
                    <button type="submit" disabled={isSaving}
                      className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60">
                      {isSaving ? 'Saving...' : editingCompany ? 'Save changes' : 'Add company'}
                    </button>
                    {editingCompany ? (
                      <button type="button" onClick={() => setEditingCompany(null)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
