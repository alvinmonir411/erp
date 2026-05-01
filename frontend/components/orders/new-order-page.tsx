'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCompanies } from '@/lib/api/companies';
import { getRoutes } from '@/lib/api/routes';
import { getShops } from '@/lib/api/shops';
import { getProducts } from '@/lib/api/products';
import { getDeliveryPeople } from '@/lib/api/delivery-ops';
import { getStockSummary } from '@/lib/api/stock';
import { createOrder, getOrder, updateOrder } from '@/lib/api/orders';
import { LoadingBlock } from '@/components/ui/loading-block';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, getTodayBD, formatBDDate } from '@/lib/utils/format';
import type { Company, Route, Shop, Product, DeliveryPerson } from '@/types/api';
import {
  Plus,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  Store,
  User,
  Building2,
  ShoppingCart,
  Receipt,
  CheckCircle,
  ArrowLeft,
  LogOut
} from 'lucide-react';

interface OrderLine {
  productId: number;
  productName: string;
  quantity: number;
  freeQuantity: number;
  unitPrice: number;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number;
  lineTotal: number;
  searchText?: string;
  showResults?: boolean;
}

export function NewOrderPage({ orderId }: { orderId?: number }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPerson[]>([]);
  const [stockMap, setStockMap] = useState<Record<number, number>>({});

  const [orderDate, setOrderDate] = useState(() => formatBDDate(getTodayBD()));
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [routeId, setRouteId] = useState<number | ''>('');
  const [shopId, setShopId] = useState<number | ''>('');
  const [deliveryPersonId, setDeliveryPersonId] = useState<number | ''>('');

  const [invDiscountType, setInvDiscountType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [invDiscountValue, setInvDiscountValue] = useState(0);
  const [note, setNote] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);

  const [lines, setLines] = useState<OrderLine[]>([]);

  const [showCompResults, setShowCompResults] = useState(false);
  const [showRouteResults, setShowRouteResults] = useState(false);
  const [showShopResults, setShowShopResults] = useState(false);
  const [compSearch, setCompSearch] = useState('');
  const [routeSearch, setRouteSearch] = useState('');
  const [shopSearch, setShopSearch] = useState('');

  const compRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<HTMLDivElement>(null);
  const shopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (compRef.current?.contains(event.target as Node) ||
        routeRef.current?.contains(event.target as Node) ||
        shopRef.current?.contains(event.target as Node)) {
        return;
      }
      const isProductClick = (event.target as HTMLElement).closest('.product-row-container');
      if (isProductClick) return;

      setShowCompResults(false);
      setShowRouteResults(false);
      setShowShopResults(false);
      setLines(prev => prev.map(l => ({ ...l, showResults: false })));
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useToastNotification({ message: error, title: 'Error', tone: 'error' });
  useToastNotification({ message: success, title: 'Success', tone: 'success' });

  useEffect(() => { if (error) { const t = setTimeout(() => setError(null), 100); return () => clearTimeout(t); } }, [error]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(null), 100); return () => clearTimeout(t); } }, [success]);

  const hasUnsavedChanges = useMemo(() => {
    // If it's a new order and there's more than 1 line, or the first line has data
    if (!orderId) {
      if (lines.length > 1) return true;
      if (lines.length === 1) {
        const l = lines[0];
        if (l.productId !== 0 || (l.searchText && l.searchText.trim() !== '')) return true;
      }
      if (note.trim() !== '' || invDiscountValue !== 0 || shopId !== '' || routeId !== '' || companyId !== '') return true;
    }
    // For edit mode, it's harder to track without storing initial state, 
    // but we can assume if they touched anything they might want to save.
    // For now, let's keep it simple for the user request.
    return false;
  }, [orderId, lines, note, invDiscountValue, shopId, routeId, companyId]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved order data. Are you sure you want to leave?')) {
        return;
      }
    }
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/orders');
    }
  };

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const [c, r, s, p, d] = await Promise.all([
          getCompanies(),
          getRoutes(),
          getShops(),
          getProducts(),
          getDeliveryPeople(),
        ]);
        setCompanies(c);
        setRoutes(r);
        setShops(s);
        setAllProducts(p);
        setDeliveryPeople(d);

        if (orderId) {
          const order = await getOrder(orderId);
          if (order) {
            setOrderDate(formatBDDate(new Date(order.orderDate)));
            setCompanyId(order.companyId || '');
            setCompSearch(order.company?.name || '');
            setRouteId(order.routeId || '');
            setRouteSearch(order.route?.name || '');
            setShopId(order.shopId || '');
            setShopSearch(order.shop?.name || '');
            setDeliveryPersonId(order.deliveryPersonId || '');
            setInvDiscountType(order.discountType || 'FIXED');
            setInvDiscountValue(order.discountValue || 0);
            setNote(order.note || '');
            setLines(order.items.map((item) => ({
              productId: item.productId,
              productName: item.product?.name || '',
              quantity: item.quantity,
              freeQuantity: item.freeQuantity,
              unitPrice: item.unitPrice,
              discountType: item.discountType,
              discountValue: item.discountValue,
              lineTotal: item.lineTotal,
              searchText: item.product?.name || ''
            })));
          }
        } else if (lines.length === 0) {
          addLine();
        }
      } catch (e) {
        setError('Failed to load initial data');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [orderId]);

  const filteredShops = useMemo(() => {
    if (!routeId) return [];
    return shops.filter(s => s.routeId === routeId);
  }, [shops, routeId]);

  useEffect(() => {
    async function loadStock() {
      if (!companyId) {
        setStockMap({});
        return;
      }
      try {
        const data = await getStockSummary(Number(companyId));
        const list = data.currentStockList || [];
        const map: Record<number, number> = {};
        list.forEach((item: any) => {
          map[item.id] = Number(item.currentStock || 0);
        });
        setStockMap(map);
      } catch (e) {
        console.error('Failed to load stock', e);
      }
    }
    void loadStock();
  }, [companyId]);

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
      lineTotal: 0
    }]);
  };

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines.length > 0 ? newLines : [{
      productId: 0,
      productName: '',
      quantity: 0,
      freeQuantity: 0,
      unitPrice: 0,
      discountType: 'FIXED',
      discountValue: 0,
      lineTotal: 0
    }]);
  };

  const updateLine = (index: number, updates: Partial<OrderLine>) => {
    const newLines = [...lines];
    const line = { ...newLines[index], ...updates };

    if (updates.productId) {
      const prod = allProducts.find(p => p.id === updates.productId);
      if (prod) {
        line.productName = prod.name;
        line.unitPrice = prod.salePrice;
      }
    }

    line.lineTotal = calculateLineTotal(line);
    newLines[index] = line;
    setLines(newLines);
  };

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const totalQty = lines.reduce((sum, l) => sum + Number(l.quantity), 0);
  const totalFreeQty = lines.reduce((sum, l) => sum + Number(l.freeQuantity), 0);

  const invoiceDiscountAmount = invDiscountType === 'PERCENT'
    ? subtotal * (invDiscountValue / 100)
    : invDiscountValue;

  const grandTotal = subtotal - invoiceDiscountAmount;

  const handleSave = async () => {
    if (!orderDate || !companyId || !routeId) {
      setError('Please fill in all required fields (Date, Company, Route)');
      return;
    }

    if (lines.length === 0 || lines.every(l => l.productId === 0)) {
      setError('Please add at least one product');
      return;
    }

    const validLines = lines.filter(l => l.productId !== 0);

    const insufficientStock = validLines.find(l => {
      const prod = allProducts.find(p => p.id === l.productId);
      const stockFromSummary = stockMap[l.productId];
      const stock = stockFromSummary !== undefined ? stockFromSummary : (prod?.currentStock || 0);
      return (Number(l.quantity) + Number(l.freeQuantity)) > stock;
    });

    if (insufficientStock) {
      const prod = allProducts.find(p => p.id === insufficientStock.productId);
      const stockFromSummary = stockMap[insufficientStock.productId];
      const stock = stockFromSummary !== undefined ? stockFromSummary : (prod?.currentStock || 0);
      setError(`Insufficient stock for ${insufficientStock.productName}. Available: ${stock} ${prod?.unit || ''}`);
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        orderDate,
        companyId: Number(companyId),
        routeId: Number(routeId),
        shopId: shopId ? Number(shopId) : undefined,
        deliveryPersonId: deliveryPersonId ? Number(deliveryPersonId) : undefined,
        discountType: invDiscountType,
        discountValue: invDiscountValue,
        note: note.trim() || undefined,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          freeQuantity: Number(l.freeQuantity),
          unitPrice: Number(l.unitPrice),
          discountType: l.discountType,
          discountValue: Number(l.discountValue),
        }))
      };

      if (orderId) {
        await updateOrder(orderId, payload);
        setSuccess('Order updated successfully');
      } else {
        await createOrder(payload);
        setSuccess('Order created successfully');
      }
      router.push('/orders');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save order');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingBlock label="Initializing Order Form..." />;

  return (
    <><div className="space-y-8 pb-32">

      <div className="lg:grid lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] lg:items-start lg:gap-8">
        {/* Main Form Area */}
        <div className="space-y-6">
          {/* Header Section */}
          <div className="modern-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Info className="h-4 w-4 text-accent" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Order Details</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Date
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={e => setOrderDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-accent/20 outline-none transition" />
              </div>

              {/* Company */}
              <div className="relative space-y-1.5" ref={compRef}>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Company
                </label>
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-accent/20 outline-none transition"
                  value={compSearch}
                  onChange={e => {
                    setCompSearch(e.target.value);
                    setCompanyId('');
                    setShowCompResults(true);
                  }}
                  onFocus={() => setShowCompResults(true)} />
                {showCompResults && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-xl">
                    {companies.filter(c => c.name.toLowerCase().includes(compSearch.toLowerCase())).map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCompanyId(c.id);
                          setCompSearch(c.name);
                          setShowCompResults(false);
                          setLines([]);
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary transition"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Route */}
              <div className="relative space-y-1.5" ref={routeRef}>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Route
                </label>
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-accent/20 outline-none transition"
                  value={routeSearch}
                  onChange={e => {
                    setRouteSearch(e.target.value);
                    setRouteId('');
                    setShowRouteResults(true);
                  }}
                  onFocus={() => setShowRouteResults(true)} />
                {showRouteResults && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-xl">
                    {routes.filter(r => r.name.toLowerCase().includes(routeSearch.toLowerCase())).map(r => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setRouteId(r.id);
                          setRouteSearch(r.name);
                          setShowRouteResults(false);
                          setShopId('');
                          setShopSearch('');
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary transition"
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Shop */}
              <div className="relative space-y-1.5" ref={shopRef}>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                  <Store className="h-3 w-3" /> Shop
                </label>
                <input
                  type="text"
                  placeholder={routeId ? "Search..." : "Select route first"}
                  disabled={!routeId}
                  className={`w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition ${!routeId ? 'bg-secondary/30 cursor-not-allowed opacity-50' : 'bg-secondary/50 focus:bg-white'}`}
                  value={shopSearch}
                  onChange={e => {
                    setShopSearch(e.target.value);
                    setShopId('');
                    setShowShopResults(true);
                  }}
                  onFocus={() => routeId && setShowShopResults(true)} />
                {routeId && showShopResults && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-xl">
                    {filteredShops.filter(s => s.name.toLowerCase().includes(shopSearch.toLowerCase())).map(s => (
                      <button
                        key={s.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShopId(s.id);
                          setShopSearch(s.name);
                          setShowShopResults(false);
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary transition"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="modern-card">
            <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-bold text-foreground">Order Items</h2>
              </div>
              <span className="text-xs font-medium text-muted">{lines.length} {lines.length === 1 ? 'item' : 'items'}</span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/10 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-border">
                    <th className="px-6 py-3 text-left">Product</th>
                    <th className="px-3 py-3 text-center w-24">Qty</th>
                    <th className="px-3 py-3 text-center w-24">Free</th>
                    <th className="px-3 py-3 text-center w-32">Price</th>
                    <th className="px-3 py-3 text-right w-32">Total</th>
                    <th className="px-4 py-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="group hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 min-w-[250px]">
                        <div className="relative product-row-container">
                          <input
                            type="text"
                            placeholder={companyId ? "Search product..." : "Select company first"}
                            disabled={!companyId}
                            className={`w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition ${!companyId ? 'bg-secondary/30 cursor-not-allowed opacity-50' : 'bg-white focus:bg-white'}`}
                            value={line.productId ? line.productName : line.searchText || ''}
                            onChange={(e) => {
                              updateLine(idx, { searchText: e.target.value, showResults: true, productId: 0 });
                            }}
                            onFocus={() => {
                              updateLine(idx, { showResults: true });
                            }} />
                          {line.showResults && (
                            <div className="absolute left-0 top-full z-[9999] mt-2 max-h-80 w-full min-w-[350px] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-2xl shadow-black/20 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                              {allProducts
                                .filter(p => !companyId || p.companyId === companyId)
                                .filter(p => p.name.toLowerCase().includes((line.searchText || '').toLowerCase()) ||
                                  p.sku.toLowerCase().includes((line.searchText || '').toLowerCase())
                                )
                                .map(p => {
                                  const stockFromSummary = stockMap[p.id];
                                  const availableStock = stockFromSummary !== undefined ? stockFromSummary : (p.currentStock || 0);
                                  const isOutOfStock = availableStock <= 0;

                                  return (
                                    <button
                                      key={p.id}
                                      disabled={isOutOfStock}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        if (isOutOfStock) return;
                                        if (!companyId) {
                                          setCompanyId(p.companyId);
                                          const comp = companies.find(c => c.id === p.companyId);
                                          if (comp) setCompSearch(comp.name);
                                        }
                                        updateLine(idx, {
                                          productId: p.id,
                                          productName: p.name,
                                          unitPrice: p.salePrice,
                                          showResults: false,
                                          searchText: p.name
                                        });
                                      }}
                                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${isOutOfStock ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-zinc-100'}`}
                                    >
                                      <div className="flex-1">
                                        <div className="font-bold text-foreground">{p.name}</div>
                                        <div className="flex items-center gap-2 text-[10px] text-muted font-bold">
                                          <span>{p.sku}</span>
                                          <span>•</span>
                                          <span className={availableStock <= 10 ? 'text-rose-500' : 'text-emerald-600'}>
                                            Stock: {availableStock} {p.unit}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="font-bold text-accent">{formatCurrency(p.salePrice)}</div>
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          value={line.quantity || ''}
                          onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-center text-sm focus:ring-2 focus:ring-accent/20 outline-none transition" />
                      </td>
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          value={line.freeQuantity || ''}
                          onChange={e => updateLine(idx, { freeQuantity: Number(e.target.value) })}
                          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-center text-sm focus:ring-2 focus:ring-accent/20 outline-none transition" />
                      </td>
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          value={line.unitPrice || ''}
                          onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-center text-sm focus:ring-2 focus:ring-accent/20 outline-none transition" />
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-foreground">
                        {formatCurrency(line.lineTotal)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => removeLine(idx)}
                          className="text-muted hover:text-rose-600 transition-colors p-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-border">
              {lines.map((line, idx) => (
                <div key={idx} className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 relative product-row-container">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1 block">Product</label>
                      <input
                        type="text"
                        placeholder={companyId ? "Search product..." : "Select company first"}
                        disabled={!companyId}
                        className={`w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition ${!companyId ? 'bg-secondary/30 cursor-not-allowed opacity-50' : 'bg-white focus:bg-white'}`}
                        value={line.productId ? line.productName : line.searchText || ''}
                        onChange={(e) => {
                          updateLine(idx, { searchText: e.target.value, showResults: true, productId: 0 });
                        }}
                        onFocus={() => {
                          updateLine(idx, { showResults: true });
                        }} />
                      {line.showResults && (
                        <div className="absolute left-0 top-full z-[9999] mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-2xl shadow-black/20 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                          {allProducts
                            .filter(p => !companyId || p.companyId === companyId)
                            .filter(p => p.name.toLowerCase().includes((line.searchText || '').toLowerCase()) ||
                              p.sku.toLowerCase().includes((line.searchText || '').toLowerCase())
                            )
                            .map(p => {
                              const stockFromSummary = stockMap[p.id];
                              const availableStock = stockFromSummary !== undefined ? stockFromSummary : (p.currentStock || 0);
                              const isOutOfStock = availableStock <= 0;

                              return (
                                <button
                                  key={p.id}
                                  disabled={isOutOfStock}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    if (isOutOfStock) return;
                                    if (!companyId) {
                                      setCompanyId(p.companyId);
                                      const comp = companies.find(c => c.id === p.companyId);
                                      if (comp) setCompSearch(comp.name);
                                    }
                                    updateLine(idx, {
                                      productId: p.id,
                                      productName: p.name,
                                      unitPrice: p.salePrice,
                                      showResults: false,
                                      searchText: p.name
                                    });
                                  }}
                                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${isOutOfStock ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-secondary'}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-foreground truncate">{p.name}</div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted font-bold mt-0.5">
                                      <span className="truncate max-w-[80px]">{p.sku}</span>
                                      <span>•</span>
                                      <span className={availableStock <= 10 ? 'text-rose-500' : 'text-emerald-600'}>
                                        Stock: {availableStock} {p.unit}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="font-bold text-accent whitespace-nowrap">{formatCurrency(p.salePrice)}</div>
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeLine(idx)}
                      className="mt-6 p-2 text-muted hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted block">Qty</label>
                      <input
                        type="number"
                        value={line.quantity || ''}
                        onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted block">Free</label>
                      <input
                        type="number"
                        value={line.freeQuantity || ''}
                        onChange={e => updateLine(idx, { freeQuantity: Number(e.target.value) })}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted block">Price</label>
                      <input
                        type="number"
                        value={line.unitPrice || ''}
                        onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition" />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Line Total</span>
                    <span className="font-bold text-foreground">{formatCurrency(line.lineTotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-secondary/10">
              <button
                onClick={addLine}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-bold text-muted hover:border-accent hover:text-accent hover:bg-accent/5 transition-all"
              >
                <Plus className="h-4 w-4" /> Add Product Row
              </button>
            </div>
          </div>

          {/* Additional Info Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="modern-card p-6">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowDiscount(!showDiscount)}
              >
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-accent" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Invoice Discount</h2>
                </div>
                {showDiscount ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
              </div>

              {showDiscount && (
                <div className="mt-6 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Value</label>
                    <input
                      type="number"
                      value={invDiscountValue || ''}
                      onChange={e => setInvDiscountValue(Number(e.target.value))}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition" />
                  </div>
                  <div className="w-32 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Type</label>
                    <select
                      value={invDiscountType}
                      onChange={e => setInvDiscountType(e.target.value as 'FIXED' | 'PERCENT')}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                    >
                      <option value="FIXED">Fixed (৳)</option>
                      <option value="PERCENT">Percent (%)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="modern-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Info className="h-4 w-4 text-accent" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Additional Note</h2>
              </div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Notes for this order..."
                className="w-full h-11 rounded-lg border border-border bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-accent/20 outline-none transition resize-none" />
            </div>
          </div>
        </div>

      </div>

      {/* Sticky Summary Area */}
      <div className="mt-8 lg:mt-0">
        <div className="sticky top-24 space-y-6">
          <div className="modern-card p-8 bg-primary text-white shadow-2xl">
            <h2 className="text-sm font-bold uppercase tracking-widest opacity-60 mb-8">Order Summary</h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="opacity-60">Items Total</span>
                <span className="font-bold">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="opacity-60">Total Quantity</span>
                <div className="text-right">
                  <p className="font-bold">{totalQty} Units</p>
                  {totalFreeQty > 0 && <p className="text-[10px] font-bold text-accent">+ {totalFreeQty} Free</p>}
                </div>
              </div>

              {invoiceDiscountAmount > 0 && (
                <div className="flex justify-between items-center text-sm text-accent">
                  <span className="font-medium">Discount</span>
                  <span className="font-bold">- {formatCurrency(invoiceDiscountAmount)}</span>
                </div>
              )}

              <div className="pt-6 mt-2 border-t border-white/10">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-60">Grand Total</span>
                  <span className="text-4xl font-black text-white">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="mt-8 w-full rounded-xl bg-accent py-4 text-white font-black shadow-lg shadow-accent/20 hover:bg-accent/90 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
            >
              {isSaving ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  {orderId ? 'Update Order' : 'Complete Order'}
                </>
              )}
            </button>
          </div>

          <div className="modern-card p-6 bg-white border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Assign Delivery</p>
                <select
                  value={deliveryPersonId}
                  onChange={e => setDeliveryPersonId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-transparent text-sm font-bold text-foreground outline-none cursor-pointer"
                >
                  <option value="">No Personnel Assigned</option>
                  {deliveryPeople.map(person => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
      <button
        onClick={addLine}
        className="fixed bottom-24 right-6 lg:hidden z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-2xl hover:scale-110 active:scale-95 transition-all"
      >
        <Plus className="h-5 w-5" />
      </button>

      {/* Quick Summary Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border px-6 py-4 flex items-center justify-between lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Grand Total</span>
          <span className="text-xl font-black text-primary">{formatCurrency(grandTotal)}</span>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-accent text-white px-8 py-3 rounded-xl font-black text-sm shadow-lg shadow-accent/20 active:scale-95 transition-all disabled:opacity-50"
        >
          {isSaving ? '...' : 'Complete Order'}
        </button>
      </div>
    </>
  );
}

