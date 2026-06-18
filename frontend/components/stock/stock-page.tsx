'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Box, Search, Filter, Plus, ArrowDownLeft, ArrowUpRight, 
  AlertTriangle, RefreshCcw, History, TrendingUp, DollarSign,
  Package, ChevronDown, ChevronUp, MoreVertical, Layers, CheckCircle,
  XCircle, Clock, AlertCircle, Undo2, Gift
} from 'lucide-react';
import Link from 'next/link';
import { StatCard } from '@/components/ui/stat-card';
import { getCompanies } from '@/lib/api/companies';
import { getProducts } from '@/lib/api/products';
import { getStockSummary, getStockHistory, createStockMovement, StockMovementType } from '@/lib/api/stock';
import { LoadingBlock } from '@/components/ui/loading-block';
import { useToast } from '@/components/ui/toast-provider';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import type { Company, Product } from '@/types/api';

const MOVEMENT_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  OPENING: { label: 'Opening', color: 'bg-blue-100 text-blue-700', icon: Plus },
  STOCK_IN: { label: 'Stock In', color: 'bg-emerald-100 text-emerald-700', icon: ArrowDownLeft },
  STOCK_OUT: { label: 'Stock Out', color: 'bg-rose-100 text-rose-700', icon: ArrowUpRight },
  ADJUSTMENT: { label: 'Adjustment', color: 'bg-amber-100 text-amber-700', icon: RefreshCcw },
  RETURN_IN: { label: 'Return In', color: 'bg-cyan-100 text-cyan-700', icon: ArrowDownLeft },
  DAMAGE: { label: 'Damage', color: 'bg-rose-100 text-rose-700', icon: AlertTriangle },
  SALE: { label: 'Sale', color: 'bg-indigo-100 text-indigo-700', icon: DollarSign },
};

export function StockPage() {
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [stockList, setStockList] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // Filters
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Action Modal State
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<StockMovementType>('STOCK_IN');
  const [actionForm, setActionForm] = useState({
    productId: '',
    companyId: '',
    quantity: '',
    note: '',
  });
  const [productSearch, setProductSearch] = useState('');
  const [showProductList, setShowProductList] = useState(false);

  const loadInitial = async () => {
    try {
      setIsLoading(true);
      const [c, p] = await Promise.all([getCompanies(), getProducts()]);
      setCompanies(c);
      setProducts(p);
      await refreshData();
    } catch (e) {
      showErrorToast('Failed to load initial data');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      setIsRefreshing(true);
      const [sumData, histData] = await Promise.all([
        getStockSummary(selectedCompanyId || undefined, debouncedSearch || undefined),
        getStockHistory({
          companyId: selectedCompanyId || undefined,
          type: selectedType || undefined,
          search: debouncedSearch || undefined,
        }),
      ]);
      setSummary(sumData.summary);
      setStockList(sumData.currentStockList);
      setHistory(histData);
    } catch (e) {
      showErrorToast('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { refreshData(); }, [selectedCompanyId, selectedType, debouncedSearch]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!actionForm.productId) {
      showErrorToast('Please select a product from the list');
      return;
    }

    try {
      setIsSaving(true);
      await createStockMovement({
        productId: Number(actionForm.productId),
        companyId: Number(actionForm.companyId),
        type: actionType,
        quantity: actionType === 'DAMAGE' || actionType === 'STOCK_OUT' ? -Math.abs(Number(actionForm.quantity)) : Math.abs(Number(actionForm.quantity)),
        note: actionForm.note,
      });
      showSuccessToast('Stock updated successfully');
      setShowActionModal(false);
      setActionForm({ productId: '', companyId: '', quantity: '', note: '' });
      setProductSearch('');
      setShowProductList(false);
      await refreshData();
    } catch (e: any) {
      showErrorToast(e.message || 'Failed to perform action');
    } finally {
      setIsSaving(false);
    }
  };

  const openAction = (type: StockMovementType) => {
    setActionType(type);
    setProductSearch('');
    setShowProductList(false);
    setShowActionModal(true);
  };

  if (isLoading) return <LoadingBlock label="Initializing Stock Workspace..." />;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">Stock Management</h1>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Track inventory movements & stock levels</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => openAction('STOCK_IN')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Stock In
          </button>
          <button 
            onClick={() => openAction('STOCK_OUT')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-wider hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> Stock Out
          </button>
          <Link
            href="/reports/free-quantity"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Gift className="h-3.5 w-3.5" /> Free Qty Report
          </Link>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => openAction('STOCK_IN')} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/10 hover:scale-[1.02] transition-all">
          <Plus className="h-4 w-4" /> Add Stock In
        </button>
        <button onClick={() => openAction('ADJUSTMENT')} className="flex items-center gap-2 rounded-xl bg-white border border-border px-5 py-3 text-sm font-bold text-muted hover:bg-secondary transition-all">
          <RefreshCcw className="h-4 w-4" /> Adjustment
        </button>
      </div>

      {/* Main Content Area */}
      <div className="modern-card overflow-hidden">
        {/* Header & Tabs */}
        <div className="border-b border-border bg-white px-6">
          <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                { id: 'current', label: 'Current Inventory', icon: Package },
                { id: 'history', label: 'Movement History', icon: History }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`relative flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all ${
                    tab === t.id 
                      ? 'text-primary' 
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                  {tab === t.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                  showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-muted border-border hover:bg-secondary'
                }`}
              >
                <Filter className="h-4 w-4" /> Filters
              </button>
            </div>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="grid gap-6 border-t border-border py-6 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-top-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Company</label>
                <select
                  value={selectedCompanyId}
                  onChange={e => setSelectedCompanyId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm focus:bg-white outline-none transition"
                >
                  <option value="">All Companies</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Movement Type</label>
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm focus:bg-white outline-none transition"
                >
                  <option value="">All Types</option>
                  {Object.entries(MOVEMENT_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedCompanyId('');
                    setSelectedType('');
                  }}
                  className="w-full rounded-lg border border-border bg-white px-4 py-2 text-sm font-bold text-muted hover:bg-secondary transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by Product Name, SKU, or Category..."
                className="w-full rounded-xl border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="overflow-x-auto">
          {tab === 'current' ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-secondary/20 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-border">
                  <th className="px-6 py-4">Product Details</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4 text-center">Stock Level</th>
                  <th className="px-6 py-4 text-right">Value</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stockList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-muted text-sm font-bold">No products found in inventory.</td>
                  </tr>
                ) : (
                  stockList.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-foreground">{item.name}</p>
                        <p className="mt-1 text-[10px] font-bold text-muted uppercase tracking-tight">{item.sku}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-muted">
                        {item.company?.name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <p className="text-sm font-black text-foreground">{formatNumber(item.currentStock)} {item.unit}</p>
                          <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                item.currentStock <= 0 ? 'bg-rose-500 w-0' : 
                                item.currentStock <= 10 ? 'bg-amber-500 w-1/4' : 
                                'bg-emerald-500 w-full'
                              }`} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-foreground">
                        {formatCurrency(item.stockValue)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          item.currentStock <= 0 ? 'bg-rose-100 text-rose-700' : 
                          item.currentStock <= 10 ? 'bg-amber-100 text-amber-700' : 
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.currentStock <= 0 ? 'Out of Stock' : item.currentStock <= 10 ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-secondary/20 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-border">
                  <th className="px-6 py-4">Movement Info</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4 text-center">Type</th>
                  <th className="px-6 py-4 text-right">Quantity</th>
                  <th className="px-6 py-4">Note / User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-muted text-sm font-bold">No movement history available.</td>
                  </tr>
                ) : (
                  history.map((item, idx) => {
                    const cfg = MOVEMENT_CONFIG[item.type] || { label: item.type, color: 'bg-slate-100 text-slate-600', icon: Clock };
                    const Icon = cfg.icon;
                    return (
                      <tr key={idx} className="group hover:bg-secondary/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
                          <p className="mt-1 text-[10px] font-medium text-muted uppercase">{new Date(item.createdAt).toLocaleTimeString()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-foreground">{item.product?.name}</p>
                          <p className="mt-1 text-[10px] font-bold text-muted uppercase tracking-tight">{item.company?.name}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
                            <Icon className="h-3 w-3" /> {cfg.label}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right text-sm font-black ${Number(item.quantity) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {item.quantity > 0 ? '+' : ''}{item.quantity}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-medium text-foreground max-w-[200px] truncate" title={item.note}>{item.note || 'No note'}</p>
                          <p className="mt-1 text-[10px] font-bold text-muted uppercase tracking-tight">By {item.user || 'System'}</p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowActionModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-primary p-6 text-white flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">{actionType.replace('_', ' ')}</h2>
                <p className="text-xs font-bold opacity-60 uppercase tracking-widest mt-1">Manual Stock Adjustment</p>
              </div>
              <XCircle className="h-6 w-6 cursor-pointer hover:opacity-80" onClick={() => setShowActionModal(false)} />
            </div>
            
            <form onSubmit={handleAction} className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Company</label>
                <select 
                  required 
                  value={actionForm.companyId} 
                  onChange={e => setActionForm({...actionForm, companyId: e.target.value})} 
                  className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm focus:bg-white outline-none"
                >
                  <option value="">Select Company</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="relative space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Product</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    required
                    type="text"
                    placeholder="Search by SKU or Name..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductList(true);
                    }}
                    onFocus={() => setShowProductList(true)}
                    className="w-full rounded-xl border border-border bg-secondary/30 py-3 pl-10 pr-4 text-sm focus:bg-white outline-none"
                  />
                </div>
                {showProductList && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-2xl">
                    {products
                      .filter((p) => !actionForm.companyId || p.companyId === Number(actionForm.companyId))
                      .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setActionForm({ 
                              ...actionForm, 
                              productId: String(p.id),
                              companyId: String(p.companyId) 
                            });
                            setProductSearch(p.name);
                            setShowProductList(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary transition"
                        >
                          <div className="flex-1">
                            <p className="font-bold text-foreground">{p.name}</p>
                            <p className="text-[10px] font-medium text-muted">{p.sku}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Quantity</label>
                  <input 
                    required 
                    type="number" 
                    min="1" 
                    value={actionForm.quantity} 
                    onChange={e => setActionForm({...actionForm, quantity: e.target.value})} 
                    className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm focus:bg-white outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Movement</label>
                  <div className={`flex h-[46px] items-center justify-center rounded-xl font-black text-xs uppercase tracking-widest ${
                    actionType === 'STOCK_IN' || actionType === 'OPENING' || actionType === 'RETURN_IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {actionType === 'STOCK_IN' || actionType === 'OPENING' || actionType === 'RETURN_IN' ? 'Addition (+)' : 'Reduction (-)'}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Note / Reason</label>
                <textarea 
                  value={actionForm.note} 
                  onChange={e => setActionForm({...actionForm, note: e.target.value})} 
                  className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm focus:bg-white outline-none min-h-[80px]" 
                  placeholder="e.g. Purchase order #123, Damaged during shipping..." 
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  disabled={isSaving} 
                  onClick={() => setShowActionModal(false)} 
                  className="flex-1 rounded-xl border border-border py-4 text-sm font-bold text-muted hover:bg-secondary transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving || !actionForm.productId} 
                  className="flex-1 rounded-xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Processing...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


