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
  LogOut,
  Map,
  Phone,
  X,
  UserCircle,
  RefreshCw,
  Save
} from 'lucide-react';
import { createShop } from '@/lib/api/shops';

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

  // Quick Shop Create State
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [isCreatingShop, setIsCreatingShop] = useState(false);
  const [newShop, setNewShop] = useState({
    name: '',
    ownerName: '',
    phone: '',
    address: '',
    note: ''
  });

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

  useEffect(() => { if (error) { const t = setTimeout(() => setError(null), 3000); return () => clearTimeout(t); } }, [error]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); } }, [success]);

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
            setInvDiscountValue(Number(order.discountValue || 0));
            setNote(order.note || '');
            setLines(order.items.map((item) => ({
              productId: item.productId,
              productName: item.product?.name || '',
              quantity: Number(item.quantity),
              freeQuantity: Number(item.freeQuantity || 0),
              unitPrice: Number(item.unitPrice),
              discountType: item.discountType as 'FIXED' | 'PERCENT',
              discountValue: Number(item.discountValue || 0),
              lineTotal: Number(item.lineTotal),
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
        line.unitPrice = Number(prod.salePrice);
      }
    }

    // Limit quantity and freeQuantity to available stock
    if (line.productId) {
      const prod = allProducts.find(p => p.id === line.productId);
      const stockFromSummary = stockMap[line.productId];
      const stock = stockFromSummary !== undefined ? stockFromSummary : (prod?.currentStock || 0);

      if (updates.productId) {
        if (line.quantity + line.freeQuantity > stock) {
          if (line.quantity > stock) {
            line.quantity = stock;
            line.freeQuantity = 0;
          } else {
            line.freeQuantity = stock - line.quantity;
          }
        }
      } else {
        const qty = updates.quantity !== undefined ? updates.quantity : line.quantity;
        const free = updates.freeQuantity !== undefined ? updates.freeQuantity : line.freeQuantity;
        if (qty + free > stock) {
          if (updates.quantity !== undefined) {
            line.quantity = Math.max(0, stock - line.freeQuantity);
          } else if (updates.freeQuantity !== undefined) {
            line.freeQuantity = Math.max(0, stock - line.quantity);
          }
        }
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
    if (!orderDate || !routeId) {
      setError('Please fill in all required fields (Date, Route)');
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
        companyId: companyId ? Number(companyId) : undefined,
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
    <div className="min-h-screen bg-[#F9FAFB] pb-32">
      <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-600"
              title="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {orderId ? 'Edit Order' : 'New Order'}
              </h1>
              <p className="text-sm text-slate-500 font-medium">Create a new sales order for your customer</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:hidden">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Amount</p>
              <p className="text-lg font-black text-blue-600 leading-none">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Form Section */}
          <div className="lg:col-span-12 xl:col-span-9 space-y-6">
            
            {/* Order Header / Details */}
            <div className="modern-card p-5 md:p-6 shadow-sm border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <h2 className="text-[14px] font-semibold text-slate-800">Order Header</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Order Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      value={orderDate}
                      onChange={e => setOrderDate(e.target.value)}
                      className="w-full h-[42px] rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Company */}
                <div className="relative space-y-1.5" ref={compRef}>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Company (Optional)</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search company (optional)..."
                      className="w-full h-[42px] rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      value={compSearch}
                      onChange={e => {
                        setCompSearch(e.target.value);
                        setCompanyId('');
                        setShowCompResults(true);
                      }}
                      onFocus={() => setShowCompResults(true)}
                    />
                  </div>
                  {showCompResults && (
                    <div className="absolute z-[100] mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
                      {companies.filter(c => c.name.toLowerCase().includes(compSearch.toLowerCase())).map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setCompanyId(c.id);
                            setCompSearch(c.name);
                            setShowCompResults(false);
                            setLines([{
                              productId: 0,
                              productName: '',
                              quantity: 0,
                              freeQuantity: 0,
                              unitPrice: 0,
                              discountType: 'FIXED',
                              discountValue: 0,
                              lineTotal: 0
                            }]);
                          }}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center gap-2"
                        >
                          <Building2 className="h-4 w-4 opacity-40" />
                          {c.name}
                        </button>
                      ))}
                      {companies.filter(c => c.name.toLowerCase().includes(compSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-slate-400 font-medium">No companies found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Route */}
                <div className="relative space-y-1.5" ref={routeRef}>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Route</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search route..."
                      className="w-full h-[42px] rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      value={routeSearch}
                      onChange={e => {
                        setRouteSearch(e.target.value);
                        setRouteId('');
                        setShowRouteResults(true);
                      }}
                      onFocus={() => setShowRouteResults(true)}
                    />
                  </div>
                  {showRouteResults && (
                    <div className="absolute z-[100] mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
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
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center gap-2"
                        >
                          <MapPin className="h-4 w-4 opacity-40" />
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Shop */}
                <div className="relative space-y-1.5" ref={shopRef}>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Shop / Customer</label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={routeId ? "Search shop..." : "Select route first"}
                      disabled={!routeId}
                      className={`w-full h-[42px] rounded-lg border border-slate-200 px-3 pl-10 pr-3 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all ${!routeId ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'bg-slate-50 focus:bg-white focus:border-blue-500'}`}
                      value={shopSearch}
                      onChange={e => {
                        setShopSearch(e.target.value);
                        setShopId('');
                        setShowShopResults(true);
                      }}
                      onFocus={() => routeId && setShowShopResults(true)}
                    />
                  </div>
                  {routeId && showShopResults && (
                    <div className="absolute z-[100] mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIsShopModalOpen(true);
                          setShowShopResults(false);
                        }}
                        className="w-full mb-1 rounded-lg px-3 py-3 text-left text-xs font-black uppercase tracking-wider bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all flex items-center gap-2 border border-blue-100"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create New Shop
                      </button>
                      
                      {filteredShops.filter(s => s.name.toLowerCase().includes(shopSearch.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                          No shops found
                        </div>
                      ) : (
                        filteredShops.filter(s => s.name.toLowerCase().includes(shopSearch.toLowerCase())).map(s => (
                          <button
                            key={s.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setShopId(s.id);
                              setShopSearch(s.name);
                              setShowShopResults(false);
                            }}
                            className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-50 transition-all flex items-center gap-2"
                          >
                            <Store className="h-4 w-4 opacity-40" />
                            {s.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Order Items Table */}
            <div className="modern-card overflow-hidden shadow-sm border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <h2 className="text-[14px] font-semibold text-slate-800">Order Items</h2>
                </div>
                <div className="bg-white border border-slate-200 rounded-full px-3 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {lines.length} {lines.length === 1 ? 'Product' : 'Products'}
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-visible">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="px-6 py-4 text-left">Product / Description</th>
                      <th className="px-3 py-4 text-center w-24">Qty</th>
                      <th className="px-3 py-4 text-center w-24">Free</th>
                      <th className="px-3 py-4 text-center w-32">Unit Price</th>
                      <th className="px-3 py-4 text-right w-36">Line Total</th>
                      <th className="px-4 py-4 text-center w-14"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => (
                      <tr key={idx} className="group hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="relative product-row-container">
                            <input
                              type="text"
                              placeholder="Type to search..."
                              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                              value={line.productId ? line.productName : line.searchText || ''}
                              onChange={(e) => {
                                updateLine(idx, { searchText: e.target.value, showResults: true, productId: 0 });
                              }}
                              onFocus={() => {
                                updateLine(idx, { showResults: true });
                              }}
                            />
                            {line.showResults && (
                              <div className="absolute left-0 top-full z-[9999] mt-2 max-h-[600px] w-full min-w-[600px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_25px_70px_rgba(0,0,0,0.2)] ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-300">
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
                                          updateLine(idx, {
                                            productId: p.id,
                                            productName: p.name,
                                            unitPrice: Number(p.salePrice),
                                            showResults: false,
                                            searchText: p.name
                                          });
                                        }}
                                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${isOutOfStock ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 hover:text-blue-600'}`}
                                      >
                                        <div className="flex-1">
                                          <div className="font-black text-[15px] text-slate-900 group-hover:text-blue-700 transition-colors">{p.name}</div>
                                          <div className="flex items-center gap-3 mt-1 text-[11px] font-bold uppercase tracking-widest">
                                            <span className="text-slate-400">SKU: {p.sku}</span>
                                            <span className="text-slate-200">|</span>
                                            <span className={availableStock <= 10 ? 'text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded' : 'text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded'}>
                                              Stock: {availableStock} {p.unit}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="font-black text-slate-900">{formatCurrency(p.salePrice)}</div>
                                      </button>
                                    );
                                  })}
                                {allProducts.filter(p => (!companyId || p.companyId === companyId) && (p.name.toLowerCase().includes((line.searchText || '').toLowerCase()) || p.sku.toLowerCase().includes((line.searchText || '').toLowerCase()))).length === 0 && (
                                  <div className="px-4 py-8 text-center">
                                    <ShoppingCart className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 font-medium">No products found</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <input
                            type="number"
                            placeholder="0"
                            value={line.quantity || ''}
                            onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                          />
                        </td>
                        <td className="px-3 py-4">
                          <input
                            type="number"
                            placeholder="0"
                            value={line.freeQuantity || ''}
                            onChange={e => updateLine(idx, { freeQuantity: Number(e.target.value) })}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-bold text-emerald-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                          />
                        </td>
                        <td className="px-3 py-4">
                          <input
                            type="number"
                            placeholder="0.00"
                            value={line.unitPrice || ''}
                            onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                          />
                        </td>
                        <td className="px-3 py-4 text-right">
                          <span className="text-sm font-black text-slate-900">{formatCurrency(line.lineTotal)}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => removeLine(idx)}
                            className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="md:hidden divide-y divide-slate-100">
                {lines.map((line, idx) => (
                  <div key={idx} className="p-4 bg-white relative">
                    <div className="flex flex-col gap-4">
                      {/* Product Search */}
                      <div className="relative product-row-container">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product #{idx + 1}</label>
                          <button
                            onClick={() => removeLine(idx)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                         <input
                          type="text"
                          placeholder="Search product..."
                          className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                          value={line.productId ? line.productName : line.searchText || ''}
                          onChange={(e) => {
                            updateLine(idx, { searchText: e.target.value, showResults: true, productId: 0 });
                          }}
                          onFocus={() => {
                            updateLine(idx, { showResults: true });
                          }}
                        />
                        {line.showResults && (
                          <div className="absolute left-0 top-full z-[9999] mt-2 max-h-[500px] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_25px_70px_rgba(0,0,0,0.2)] ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1">
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
                                      updateLine(idx, {
                                        productId: p.id,
                                        productName: p.name,
                                        unitPrice: Number(p.salePrice),
                                        showResults: false,
                                        searchText: p.name
                                      });
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all ${isOutOfStock ? 'opacity-40' : 'active:bg-slate-50'}`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="font-bold text-slate-800 truncate">{p.name}</div>
                                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                        Stock: {availableStock} {p.unit}
                                      </div>
                                    </div>
                                    <div className="font-bold text-slate-900">{formatCurrency(p.salePrice)}</div>
                                  </button>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Inputs Grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={line.quantity || ''}
                            onChange={e => updateLine(idx, { quantity: Math.max(0, Number(e.target.value)) })}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-center text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Free</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={line.freeQuantity || ''}
                            onChange={e => updateLine(idx, { freeQuantity: Math.max(0, Number(e.target.value)) })}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-center text-sm font-bold text-emerald-600 focus:bg-white focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Price</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={line.unitPrice || ''}
                            onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                            className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-center text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Line Total */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Line Total</span>
                        <span className="text-base font-black text-slate-900">{formatCurrency(line.lineTotal)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Row Button */}
              <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100">
                <button
                  onClick={addLine}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-sm transition-all shadow-sm active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  Add New Product
                </button>
              </div>
            </div>

            {/* Note & Discount Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Note */}
              <div className="modern-card p-6 shadow-sm border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                  <h2 className="text-[14px] font-semibold text-slate-800">Order Note</h2>
                </div>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Type any additional instructions or notes here..."
                  className="w-full h-24 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none"
                />
              </div>

              {/* Discount Section */}
              <div className="modern-card p-6 shadow-sm border-slate-200">
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setShowDiscount(!showDiscount)}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <h2 className="text-[14px] font-semibold text-slate-800">Invoice Discount</h2>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors">
                    {showDiscount ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </div>
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${showDiscount ? 'max-h-40 mt-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Value</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={invDiscountValue || ''}
                        onChange={e => setInvDiscountValue(Number(e.target.value))}
                        className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Type</label>
                      <select
                        value={invDiscountType}
                        onChange={e => setInvDiscountType(e.target.value as 'FIXED' | 'PERCENT')}
                        className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer"
                      >
                        <option value="FIXED">Fixed Amount (৳)</option>
                        <option value="PERCENT">Percentage (%)</option>
                      </select>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-400 font-medium italic">
                    The discount will be applied to the subtotal amount of the invoice.
                  </p>
                </div>
                {!showDiscount && (
                  <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-xl bg-blue-50/50 border border-blue-100/50">
                    <span className="text-xs font-medium text-slate-500">Current Discount</span>
                    <span className="text-sm font-black text-blue-600">{invDiscountValue > 0 ? (invDiscountType === 'PERCENT' ? `${invDiscountValue}%` : `৳${invDiscountValue}`) : 'No discount applied'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Assignment */}
            <div className="modern-card p-5 md:p-6 shadow-sm border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Assign Delivery Personnel</p>
                  <select
                    value={deliveryPersonId}
                    onChange={e => setDeliveryPersonId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-transparent text-[15px] font-bold text-slate-800 outline-none cursor-pointer appearance-none"
                  >
                    <option value="">No Personnel Assigned</option>
                    {deliveryPeople.map(person => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Sidebar / Summary Section */}
          <div className="lg:col-span-12 xl:col-span-3 space-y-6">
            <div className="sticky top-24 space-y-6">
              {/* Desktop Summary Card */}
              <div className="modern-card overflow-hidden shadow-lg border-blue-100 bg-white">
                <div className="bg-blue-600 p-6 text-white">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80 mb-6">Order Summary</h2>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium opacity-80">Subtotal</span>
                      <span className="text-sm font-bold">{formatCurrency(subtotal)}</span>
                    </div>
                    {invoiceDiscountAmount > 0 && (
                      <div className="flex justify-between items-center text-blue-200">
                        <span className="text-sm font-medium">Discount</span>
                        <span className="text-sm font-bold">- {formatCurrency(invoiceDiscountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-blue-200">
                      <span className="text-sm font-medium">Total Quantity</span>
                      <span className="text-sm font-bold">{totalQty} Units</span>
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-blue-500/50">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80 mb-2">Grand Total</p>
                    <p className="text-4xl font-black">{formatCurrency(grandTotal)}</p>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>{orderId ? 'Update Order' : 'Complete Order'}</span>
                      </>
                    )}
                  </button>
                  <p className="mt-3 text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider">
                    Double check details before saving
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleBack}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-all group"
                >
                  <ArrowLeft className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
                  <span className="text-[10px] font-bold uppercase text-slate-500">Discard</span>
                </button>
                <button 
                  onClick={() => router.push('/orders')}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 transition-all group"
                >
                  <Receipt className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
                  <span className="text-[10px] font-bold uppercase text-slate-500">View All</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Add Button for Mobile */}
      <button
        onClick={addLine}
        className="fixed bottom-24 right-6 md:hidden z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-500/40 hover:scale-110 active:scale-95 transition-all"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white border-t border-slate-200 px-6 py-4 md:hidden shadow-[0_-8px_30px_rgb(0,0,0,0.08)] animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Grand Total</span>
            <span className="text-xl font-black text-slate-900">{formatCurrency(grandTotal)}</span>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? 'Saving...' : 'Complete Order'}
          </button>
        </div>
      </div>
      {/* Shop Creation Modal */}
      {isShopModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsShopModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider">Create New Shop</h2>
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Adding shop to {routes.find(r => r.id === routeId)?.name}</p>
              </div>
              <button onClick={() => setIsShopModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Shop Name *</label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      className="w-full h-11 rounded-xl bg-slate-50 border-0 px-3 pl-10 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={newShop.name}
                      onChange={e => setNewShop({ ...newShop, name: e.target.value })}
                      placeholder="e.g. Popular Store"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Owner Name</label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      className="w-full h-11 rounded-xl bg-slate-50 border-0 px-3 pl-10 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={newShop.ownerName}
                      onChange={e => setNewShop({ ...newShop, ownerName: e.target.value })}
                      placeholder="e.g. Mr. Rahim"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="tel"
                    className="w-full h-11 rounded-xl bg-slate-50 border-0 px-3 pl-10 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={newShop.phone}
                    onChange={e => setNewShop({ ...newShop, phone: e.target.value })}
                    placeholder="017xxxxxxxx"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Address</label>
                <div className="relative">
                  <Map className="absolute left-3 top-4 h-3.5 w-3.5 text-slate-400" />
                  <textarea
                    className="w-full rounded-xl bg-slate-50 border-0 p-3 pl-10 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none h-20 resize-none"
                    value={newShop.address}
                    onChange={e => setNewShop({ ...newShop, address: e.target.value })}
                    placeholder="Full shop address..."
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
              <button 
                onClick={() => setIsShopModalOpen(false)}
                className="flex-1 h-11 rounded-xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                disabled={isCreatingShop || !newShop.name || !newShop.phone}
                onClick={async () => {
                  try {
                    setIsCreatingShop(true);
                    const shop = await createShop({
                      ...newShop,
                      routeId: Number(routeId),
                      companyId: companyId ? Number(companyId) : undefined,
                    });
                    setShops(prev => [...prev, shop]);
                    setShopId(shop.id);
                    setShopSearch(shop.name);
                    setIsShopModalOpen(false);
                    setSuccess('Shop created and selected successfully');
                  } catch (e: any) {
                    setError(e.message || 'Failed to create shop');
                  } finally {
                    setIsCreatingShop(false);
                  }
                }}
                className="flex-[2] h-11 rounded-xl bg-blue-600 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isCreatingShop ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Shop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

