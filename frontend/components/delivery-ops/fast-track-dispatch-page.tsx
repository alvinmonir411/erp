'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Send, CheckCircle } from 'lucide-react';
import Link from 'next/link';

import { getCompanies } from '@/lib/api/companies';
import { getRoutes } from '@/lib/api/routes';
import { getShops } from '@/lib/api/shops';
import { getProducts } from '@/lib/api/products';
import { createDispatchBatch } from '@/lib/api/delivery-ops';
import { getDeliveryMen } from '@/lib/api/users';
import { getStockSummary } from '@/lib/api/stock';
import { createOrder } from '@/lib/api/orders';
import { PageCard } from '@/components/ui/page-card';
import { LoadingBlock } from '@/components/ui/loading-block';
import { useToast } from '@/components/ui/toast-provider';
import { formatCurrency, getTodayBD, formatBDDate, getTodayBDDate } from '@/lib/utils/format';
import type { Company, Route, Shop, Product, User } from '@/types/api';

interface OrderLine {
  productId: number;
  productName: string;
  quantity: number;
  freeQuantity: number;
  unitPrice: number;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number;
  lineTotal: number;
  companyId: number;
  companyName: string;
  // Search state
  searchText?: string;
  showResults?: boolean;
}

export function FastTrackDispatchPage() {
  const router = useRouter();
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Master Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [deliveryMen, setDeliveryMen] = useState<User[]>([]);
  const [stockMap, setStockMap] = useState<Record<number, number>>({});

  // Form Header
  const [orderDate, setOrderDate] = useState(() => getTodayBDDate());
  const [routeId, setRouteId] = useState<number | ''>('');
  const [shopId, setShopId] = useState<number | ''>('');
  const [assignedDeliveryManId, setAssignedDeliveryManId] = useState('');
  const [marketArea, setMarketArea] = useState('');
  const [note, setNote] = useState('');

  // Search visibility
  const [showRouteResults, setShowRouteResults] = useState(false);
  const [showShopResults, setShowShopResults] = useState(false);
  const [routeSearch, setRouteSearch] = useState('');
  const [shopSearch, setShopSearch] = useState('');

  // Refs for click outside
  const routeRef = useRef<HTMLDivElement>(null);
  const shopRef = useRef<HTMLDivElement>(null);

  // Lines
  const [lines, setLines] = useState<OrderLine[]>([]);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const [c, r, s, p, d] = await Promise.all([
          getCompanies(),
          getRoutes(),
          getShops(),
          getProducts(),
          getDeliveryMen(),
        ]);
        setCompanies(c);
        setRoutes(r);
        setShops(s);
        setAllProducts(p);
        setDeliveryMen(d);

        // Pre-load all stock for all companies involved in products
        // (Actually getProducts might already have stock info if the API supports it, 
        // but here we might need to call getStockSummary for each company if we want real-time)
        // For simplicity in Fast Track, we'll fetch stock summary for all companies.
        const stockPromises = c.map(comp => getStockSummary(comp.id));
        const stockResults = await Promise.all(stockPromises);
        const map: Record<number, number> = {};
        stockResults.forEach(data => {
          (data.currentStockList || []).forEach((item: any) => {
            map[item.id] = Number(item.currentStock || 0);
          });
        });
        setStockMap(map);

      } catch (e) {
        showErrorToast('Failed to load initial data');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (routeRef.current?.contains(event.target as Node) ||
          shopRef.current?.contains(event.target as Node)) {
        return;
      }
      const isProductClick = (event.target as HTMLElement).closest('.product-row-container');
      if (isProductClick) return;

      setShowRouteResults(false);
      setShowShopResults(false);
      setLines(prev => prev.map(l => ({ ...l, showResults: false })));
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredShops = useMemo(() => {
    if (!routeId) return [];
    return shops.filter(s => s.routeId === routeId);
  }, [shops, routeId]);

  const calculateLineTotal = (line: OrderLine) => {
    const gross = line.quantity * line.unitPrice;
    let disc = 0;
    if (line.discountType === 'PERCENT') {
      disc = gross * (line.discountValue / 100);
    } else {
      disc = line.discountValue;
    }
    return gross - disc;
  };

  const addLine = () => {
    setLines([...lines, {
      productId: 0,
      productName: '',
      quantity: 0,
      freeQuantity: 0,
      unitPrice: 0,
      discountType: 'FIXED',
      discountValue: 0,
      lineTotal: 0,
      companyId: 0,
      companyName: ''
    }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<OrderLine>) => {
    const newLines = [...lines];
    const line = { ...newLines[index], ...updates };
    
    if (updates.productId) {
      const prod = allProducts.find(p => p.id === updates.productId);
      if (prod) {
        line.productName = prod.name;
        line.unitPrice = prod.salePrice;
        line.companyId = prod.companyId;
        line.companyName = prod.company?.name || '';
      }
    }

    line.lineTotal = calculateLineTotal(line);
    newLines[index] = line;
    setLines(newLines);
  };

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const totalQty = lines.reduce((sum, l) => sum + Number(l.quantity), 0);
  const totalFreeQty = lines.reduce((sum, l) => sum + Number(l.freeQuantity), 0);

  const handleConfirmAndDispatch = async () => {
    if (!orderDate || !routeId || !assignedDeliveryManId) {
      showErrorToast('Please fill in Date, Route, and Delivery Man');
      return;
    }

    if (lines.length === 0) {
      showErrorToast('Please add at least one product');
      return;
    }

    if (lines.some(l => l.productId === 0)) {
      showErrorToast('Please select a product for all rows');
      return;
    }

    const insufficientStock = lines.find(l => {
      const stock = stockMap[l.productId] || 0;
      return (Number(l.quantity) + Number(l.freeQuantity)) > stock;
    });

    if (insufficientStock) {
      showErrorToast(`Insufficient stock for ${insufficientStock.productName}. Available: ${stockMap[insufficientStock.productId] || 0}`);
      return;
    }

    try {
      setIsSaving(true);
      
      // 1. Create exactly one order for all items
      const orderPayload: any = {
        orderDate,
        routeId: Number(routeId),
        shopId: shopId ? Number(shopId) : undefined,
        marketArea: marketArea || undefined,
        discountType: 'FIXED',
        discountValue: 0,
        note: note.trim() || undefined,
        items: lines.map(l => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          freeQuantity: Number(l.freeQuantity),
          unitPrice: Number(l.unitPrice),
          discountType: l.discountType,
          discountValue: Number(l.discountValue),
        }))
      };
      const order = await createOrder(orderPayload);

      // 2. Create dispatch batch for this single order
      const batchPayload = {
        dispatchDate: orderDate,
        companyId: undefined,
        routeId: Number(routeId),
        assignedDeliveryManId,
        marketArea: marketArea || undefined,
        note: note || undefined,
        orderIds: [order.id],
      };

      const batch = await createDispatchBatch(batchPayload);
      
      showSuccessToast('Order created and batch dispatched successfully!');
      router.push(`/delivery-ops/batches/${batch.id}`);
    } catch (e: any) {
      showErrorToast(e.message || 'Failed to complete fast-track dispatch');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingBlock label="Initializing Fast-Track Form..." />;

  return (
    <div className="space-y-6 pb-20">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white px-4 py-3 border-b border-slate-100 lg:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 font-bold text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-slate-900">Fast Track</h1>
        <div className="w-10" />
      </div>

      <div className="flex items-center gap-4 pt-12 lg:pt-0">
        <Link
          href="/delivery-ops"
          className="hidden lg:flex rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700">
            Delivery Operations
          </p>
          <h1 className="mt-1 text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
            Fast-Track Order & Dispatch
          </h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <PageCard title="Delivery Setup" description="Primary details for immediate dispatch.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Date
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={e => setOrderDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-cyan-500/10 outline-none transition"
                />
              </div>

              <div className="relative space-y-1.5" ref={routeRef}>
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Route
                </label>
                <input
                  type="text"
                  placeholder="Search Route..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-cyan-500/10 outline-none transition"
                  value={routeSearch}
                  onChange={e => { 
                    setRouteSearch(e.target.value); 
                    setRouteId(''); 
                    setShowRouteResults(true); 
                  }}
                  onFocus={() => setShowRouteResults(true)}
                />
                {showRouteResults && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl">
                    {routes.filter(r => r.name.toLowerCase().includes(routeSearch.toLowerCase())).map(r => (
                      <button 
                        key={r.id} 
                        type="button"
                        onClick={() => { 
                          setRouteId(r.id); 
                          setRouteSearch(r.name); 
                          setShowRouteResults(false); 
                          setShopId(''); 
                          setShopSearch(''); 
                        }} 
                        className="w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-slate-50 transition font-bold text-slate-700"
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Delivery Man
                </label>
                <select
                  value={assignedDeliveryManId}
                  onChange={e => setAssignedDeliveryManId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-cyan-500/10 outline-none transition appearance-none"
                >
                  <option value="">Select Personnel</option>
                  {deliveryMen.map(person => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </div>

              <div className="relative space-y-1.5" ref={shopRef}>
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Shop (Optional)
                </label>
                <input
                  type="text"
                  placeholder={routeId ? "Search Shop..." : "Select Route First..."}
                  className={`w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/10 outline-none transition ${!routeId ? 'bg-slate-100 cursor-not-allowed text-slate-400' : 'bg-slate-50 cursor-pointer focus:bg-white'}`}
                  value={shopSearch}
                  disabled={!routeId}
                  onChange={e => { 
                    setShopSearch(e.target.value); 
                    setShopId(''); 
                    setShowShopResults(true); 
                  }}
                  onFocus={() => routeId && setShowShopResults(true)}
                />
                {routeId && showShopResults && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl">
                    {filteredShops.filter(s => s.name.toLowerCase().includes(shopSearch.toLowerCase())).map(s => (
                      <button 
                        key={s.id} 
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShopId(s.id); 
                          setShopSearch(s.name); 
                          setShowShopResults(false); 
                        }} 
                        className="w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-slate-50 transition font-bold text-slate-700"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Market Area
                </label>
                <input
                  value={marketArea}
                  onChange={e => setMarketArea(e.target.value)}
                  placeholder="Optional area name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-cyan-500/10 outline-none transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Dispatch Note
                </label>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Any special instructions"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-cyan-500/10 outline-none transition"
                />
              </div>
            </div>
          </PageCard>

          <PageCard title="Order Items" description="Add products from any company." noPadding>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm text-left mb-20">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest">
                    <th className="px-6 py-4 font-black">Product & Company</th>
                    <th className="px-4 py-4 font-black w-24 text-center">Qty</th>
                    <th className="px-4 py-4 font-black w-24 text-center">Free</th>
                    <th className="px-4 py-4 font-black w-32 text-center">Price</th>
                    <th className="px-4 py-4 font-black w-44 text-center">Discount</th>
                    <th className="px-4 py-4 font-black w-32 text-right">Total</th>
                    <th className="px-6 py-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="align-top hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 relative min-w-[280px]">
                        <div className="relative product-row-container">
                          <input
                            type="text"
                            placeholder="Search product..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:ring-2 focus:ring-cyan-500/10 outline-none transition"
                            value={line.productId ? line.productName : line.searchText || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newLines = [...lines];
                              newLines[idx] = { ...newLines[idx], searchText: val, showResults: true, productId: 0 };
                              setLines(newLines);
                            }}
                            onFocus={() => {
                              const newLines = [...lines];
                              newLines[idx] = { ...newLines[idx], showResults: true };
                              setLines(newLines);
                            }}
                          />
                          {line.productId > 0 && (
                            <p className="mt-1 ml-1 text-[10px] font-bold text-cyan-600 uppercase tracking-widest truncate">
                              {line.companyName}
                            </p>
                          )}
                          {line.showResults && (
                            <div className="absolute left-0 top-full z-[9999] mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl">
                              {allProducts
                                .filter(p => 
                                  p.name.toLowerCase().includes((line.searchText || '').toLowerCase()) || 
                                  p.sku.toLowerCase().includes((line.searchText || '').toLowerCase())
                                )
                                .map(p => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      disabled={(stockMap[p.id] || 0) <= 0}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        if ((stockMap[p.id] || 0) <= 0) return;
                                        updateLine(idx, { 
                                          productId: p.id, 
                                          productName: p.name, 
                                          unitPrice: p.salePrice,
                                          showResults: false,
                                          searchText: p.name,
                                          companyId: p.companyId,
                                          companyName: p.company?.name || ''
                                        });
                                      }}
                                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition border-b border-slate-50 last:border-0 ${
                                        (stockMap[p.id] || 0) <= 0 ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'
                                      }`}
                                    >
                                    <div className="flex-1">
                                      <div className="font-bold text-slate-900">{p.name}</div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-black uppercase text-slate-400">{p.company?.name}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                          (stockMap[p.id] || 0) <= 0 ? 'bg-rose-50 text-rose-600' : 
                                          (stockMap[p.id] || 0) <= 10 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                        }`}>
                                          Stock: {stockMap[p.id] || 0}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-slate-900 font-black">{formatCurrency(p.salePrice)}</div>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <input 
                          type="number" 
                          value={line.quantity === 0 ? '' : line.quantity} 
                          onChange={e => updateLine(idx, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })} 
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center font-bold outline-none focus:bg-white" 
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <input 
                          type="number" 
                          value={line.freeQuantity === 0 ? '' : line.freeQuantity} 
                          onChange={e => updateLine(idx, { freeQuantity: e.target.value === '' ? 0 : Number(e.target.value) })} 
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center font-bold outline-none focus:bg-white" 
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <p className="font-bold text-slate-900">{formatCurrency(line.unitPrice)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1">
                           <input type="number" value={line.discountValue} onChange={e => updateLine(idx, { discountValue: Number(e.target.value) })} className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center font-bold outline-none" />
                           <select value={line.discountType} onChange={e => updateLine(idx, { discountType: e.target.value as 'FIXED' | 'PERCENT' })} className="rounded-xl bg-slate-100 px-1 font-black text-[10px]">
                              <option value="FIXED">৳</option>
                              <option value="PERCENT">%</option>
                           </select>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-slate-900">
                        {formatCurrency(line.lineTotal)}
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => removeLine(idx)} className="text-slate-300 hover:text-rose-600 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Product Card View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {lines.map((line, idx) => (
                <div key={idx} className="p-4 space-y-4">
                   <div className="relative product-row-container">
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Item #{idx + 1}</span>
                         <button onClick={() => removeLine(idx)} className="text-rose-400 p-1"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <input
                        type="text"
                        placeholder="Search product..."
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/10 outline-none transition"
                        value={line.productId ? line.productName : line.searchText || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newLines = [...lines];
                          newLines[idx] = { ...newLines[idx], searchText: val, showResults: true, productId: 0 };
                          setLines(newLines);
                        }}
                        onFocus={() => {
                          const newLines = [...lines];
                          newLines[idx] = { ...newLines[idx], showResults: true };
                          setLines(newLines);
                        }}
                      />
                      {line.productId > 0 && (
                        <div className="flex justify-between items-center mt-2 px-1">
                           <p className="text-[10px] font-black text-cyan-700 uppercase">{line.companyName}</p>
                           <p className="text-xs font-black text-slate-900">{formatCurrency(line.unitPrice)}</p>
                        </div>
                      )}
                      {line.showResults && (
                        <div className="absolute left-0 top-full z-[9999] mt-1 max-h-72 w-full overflow-y-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl">
                          {allProducts
                            .filter(p => 
                              p.name.toLowerCase().includes((line.searchText || '').toLowerCase()) || 
                              p.sku.toLowerCase().includes((line.searchText || '').toLowerCase())
                            )
                            .map(p => (
                                <button
                                  key={p.id}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    updateLine(idx, { 
                                      productId: p.id, 
                                      productName: p.name, 
                                      unitPrice: p.salePrice,
                                      showResults: false,
                                      searchText: p.name,
                                      companyId: p.companyId,
                                      companyName: p.company?.name || ''
                                    });
                                  }}
                                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left border-b border-slate-50 last:border-0 hover:bg-slate-50"
                                >
                                  <div className="flex-1">
                                    <p className="text-sm font-black text-slate-900">{p.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                       <span className="text-[10px] font-black uppercase text-slate-400">{p.company?.name}</span>
                                       <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded">Stock: {stockMap[p.id] || 0}</span>
                                    </div>
                                  </div>
                                  <p className="text-sm font-black text-slate-900">{formatCurrency(p.salePrice)}</p>
                                </button>
                            ))}
                        </div>
                      )}
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Quantity</label>
                         <input type="number" value={line.quantity || ''} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-black text-slate-900 text-center" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Free Qty</label>
                         <input type="number" value={line.freeQuantity || ''} onChange={e => updateLine(idx, { freeQuantity: Number(e.target.value) })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-black text-slate-900 text-center" />
                      </div>
                   </div>

                   <div className="flex items-center justify-between pt-2">
                      <div>
                         <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Row Total</p>
                         <p className="text-lg font-black text-slate-900">{formatCurrency(line.lineTotal)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                            <input type="number" value={line.discountValue} onChange={e => updateLine(idx, { discountValue: Number(e.target.value) })} className="w-16 py-2 px-2 text-center text-xs font-bold outline-none" />
                            <select value={line.discountType} onChange={e => updateLine(idx, { discountType: e.target.value as 'FIXED' | 'PERCENT' })} className="bg-slate-100 py-2 px-1 text-[10px] font-black">
                               <option value="FIXED">৳</option>
                               <option value="PERCENT">%</option>
                            </select>
                         </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>

            {lines.length === 0 && (
              <div className="py-20 text-center text-slate-400 font-bold">Add products to start dispatch.</div>
            )}
            
            <div className="p-4 lg:p-6 border-t border-slate-50">
               <button 
                onClick={addLine} 
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-sm font-black uppercase tracking-widest text-slate-400 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <Plus className="h-4 w-4" /> Add Product Row
              </button>
            </div>
          </PageCard>
        </div>

        <div className="space-y-6 pb-24">
          <div className="rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Immediate Dispatch Summary
            </p>
            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-400">Items Count</span>
                <span className="text-xl font-black">{lines.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-400">Total Quantity</span>
                <span className="text-xl font-black">
                  {totalQty}
                  {totalFreeQty > 0 && (
                    <span className="ml-1.5 text-xs text-emerald-400">
                      (+{totalFreeQty} Free)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-6">
                <span className="text-sm font-bold text-slate-400">Total Value</span>
                <span className="text-3xl font-black text-cyan-400 truncate">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              
              <button 
                onClick={handleConfirmAndDispatch} 
                disabled={isSaving}
                className="mt-8 hidden lg:flex w-full rounded-2xl bg-cyan-500 py-4 text-sm font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition disabled:opacity-50 items-center justify-center gap-3"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Confirm & Dispatch
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sticky Bottom Button for Mobile */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 lg:hidden z-40">
            <button 
              onClick={handleConfirmAndDispatch} 
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {isSaving ? 'Dispatching...' : `Dispatch ${formatCurrency(subtotal)}`}
            </button>
          </div>

          <PageCard title="Workflow Guide" className="hidden lg:block">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-black text-cyan-700">1</div>
                <p className="text-xs font-medium text-slate-500 leading-relaxed">Fill in route, personnel, and products from any company.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-black text-cyan-700">2</div>
                <p className="text-xs font-medium text-slate-500 leading-relaxed">System groups products by company and creates orders.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-black text-cyan-700">3</div>
                <p className="text-xs font-medium text-slate-500 leading-relaxed">A dispatch batch is created immediately for these orders.</p>
              </div>
            </div>
          </PageCard>
        </div>
      </div>
    </div>
  );
}

const RefreshCw = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);
