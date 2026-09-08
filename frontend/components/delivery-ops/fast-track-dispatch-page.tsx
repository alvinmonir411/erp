'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  CheckCircle,
  Zap,
  Calendar,
  MapPin,
  User,
  Store,
  FileText,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Layers,
  ChevronDown,
  Search,
  X,
  PackageOpen,
  ShoppingCart,
  Truck,
  Building2,
  ShieldCheck,
  Check,
} from 'lucide-react';

import { getCompanies } from '@/lib/api/companies';
import { getRoutes } from '@/lib/api/routes';
import { getShops } from '@/lib/api/shops';
import { getProducts } from '@/lib/api/products';
import { createDispatchBatch } from '@/lib/api/delivery-ops';
import { getDeliveryMen } from '@/lib/api/users';
import { getStockSummary } from '@/lib/api/stock';
import { createOrder } from '@/lib/api/orders';
import { LoadingBlock } from '@/components/ui/loading-block';
import { useToast } from '@/components/ui/toast-provider';
import { formatCurrency, getTodayBDDate } from '@/lib/utils/format';
import type { Company, Route, Shop, Product, User as UserType } from '@/types/api';

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
  const [deliveryMen, setDeliveryMen] = useState<UserType[]>([]);
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

        // Pre-load all stock for all companies
        const stockPromises = c.map((comp) => getStockSummary(comp.id));
        const stockResults = await Promise.all(stockPromises);
        const map: Record<number, number> = {};
        stockResults.forEach((data) => {
          (data.currentStockList || []).forEach((item: any) => {
            map[item.id] = Number(item.currentStock || 0);
          });
        });
        setStockMap(map);
      } catch (e) {
        showErrorToast('ডাটা লোড হতে সমস্যা হয়েছে');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        routeRef.current?.contains(event.target as Node) ||
        shopRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      const isProductClick = (event.target as HTMLElement).closest('.product-row-container');
      if (isProductClick) return;

      setShowRouteResults(false);
      setShowShopResults(false);
      setLines((prev) => prev.map((l) => ({ ...l, showResults: false })));
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredShops = useMemo(() => {
    if (!routeId) return [];
    return shops.filter((s) => s.routeId === routeId);
  }, [shops, routeId]);

  const calculateLineTotal = (line: OrderLine) => {
    const gross = line.quantity * line.unitPrice;
    let disc = 0;
    if (line.discountType === 'PERCENT') {
      disc = gross * (line.discountValue / 100);
    } else {
      disc = line.discountValue;
    }
    return Math.max(0, gross - disc);
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        productId: 0,
        productName: '',
        quantity: 1,
        freeQuantity: 0,
        unitPrice: 0,
        discountType: 'FIXED',
        discountValue: 0,
        lineTotal: 0,
        companyId: 0,
        companyName: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<OrderLine>) => {
    const newLines = [...lines];
    const line = { ...newLines[index], ...updates };

    if (updates.productId) {
      const prod = allProducts.find((p) => p.id === updates.productId);
      if (prod) {
        line.productName = prod.name;
        line.unitPrice = prod.salePrice;
        line.companyId = prod.companyId;
        line.companyName = prod.company?.name || '';
      }
    }

    // Limit quantity and freeQuantity to available stock
    if (line.productId) {
      const stock = stockMap[line.productId] || 0;

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

  const isFormValid = !!orderDate && !!routeId && !!assignedDeliveryManId && lines.length > 0 && lines.every(l => l.productId > 0);

  const handleConfirmAndDispatch = async () => {
    if (!orderDate || !routeId || !assignedDeliveryManId) {
      showErrorToast('তারিখ, রুট এবং ডেলিভারিম্যান নির্বাচন করুন');
      return;
    }

    if (lines.length === 0) {
      showErrorToast('অনুগ্রহ করে অন্তত একটি পণ্য যোগ করুন');
      return;
    }

    if (lines.some((l) => l.productId === 0)) {
      showErrorToast('সকল সারিতে সঠিক পণ্য সিলেক্ট করুন');
      return;
    }

    const insufficientStock = lines.find((l) => {
      const stock = stockMap[l.productId] || 0;
      return Number(l.quantity) + Number(l.freeQuantity) > stock;
    });

    if (insufficientStock) {
      showErrorToast(
        `${insufficientStock.productName} এর পর্যাপ্ত স্টক নেই। গুদামে মজুদ আছে: ${
          stockMap[insufficientStock.productId] || 0
        }`,
      );
      return;
    }

    try {
      setIsSaving(true);

      // 1. Create order for all items
      const orderPayload: any = {
        orderDate,
        routeId: Number(routeId),
        shopId: shopId ? Number(shopId) : undefined,
        marketArea: marketArea.trim() || undefined,
        discountType: 'FIXED',
        discountValue: 0,
        note: note.trim() || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          freeQuantity: Number(l.freeQuantity),
          unitPrice: Number(l.unitPrice),
          discountType: l.discountType,
          discountValue: Number(l.discountValue),
        })),
      };
      const order = await createOrder(orderPayload);

      // 2. Create dispatch batch for this order
      const batchPayload = {
        dispatchDate: orderDate,
        companyId: undefined,
        routeId: Number(routeId),
        assignedDeliveryManId,
        marketArea: marketArea.trim() || undefined,
        note: note.trim() || undefined,
        orderIds: [order.id],
      };

      const batch = await createDispatchBatch(batchPayload);

      showSuccessToast('অর্ডার ও তাৎক্ষণিক ডেলিভারি চালান সফলভাবে তৈরি হয়েছে!');
      router.push(`/delivery-ops/batches/${batch.id}`);
    } catch (e: any) {
      showErrorToast(e.message || 'ডেলিভারি চালান তৈরিতে সমস্যা হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingBlock label="ফাস্ট-ট্র্যাক ফর্ম লোড হচ্ছে..." />;

  return (
    <div className="space-y-6 pb-24 max-w-[1600px] mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3.5">
          <Link
            href="/delivery-ops"
            className="h-11 w-11 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 shadow-xs transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-50 border border-cyan-200 text-cyan-700 text-[10px] font-black uppercase tracking-wider">
                <Zap className="h-3 w-3 fill-cyan-500 text-cyan-500" /> Fast-Track Dispatch
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold">
                ⚡ তাৎক্ষণিক চালান
              </span>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              ইনস্ট্যান্ট অর্ডার ও ডেলিভারি চালান
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">আজকের তারিখ</p>
              <p className="text-xs font-black text-slate-800">{orderDate}</p>
            </div>
            <div className="h-8 w-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_430px]">
        {/* Main Left Section */}
        <div className="space-y-6">
          
          {/* 1. Delivery Setup Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    ১. ডেলিভারি সেটআপ (Delivery Setup)
                  </h2>
                  <p className="text-xs text-slate-500">
                    ডেলিভারির তারিখ, নির্দিষ্ট রুট ও দায়িত্বপ্রাপ্ত ডেলিভারিম্যান নির্বাচন করুন
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-cyan-600" />
                  <span>চালানের তারিখ</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition shadow-2xs"
                />
              </div>

              {/* Route Input */}
              <div className="relative space-y-1.5" ref={routeRef}>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                  <span>ডেলিভারি রুট</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="রুট খুঁজুন বা সিলেক্ট করুন..."
                    className={`w-full rounded-2xl border px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition shadow-2xs pr-8 ${
                      routeId ? 'border-cyan-300 bg-cyan-50/30 text-cyan-900' : 'border-slate-200 bg-slate-50/70 text-slate-800 focus:bg-white'
                    }`}
                    value={routeSearch}
                    onChange={(e) => {
                      setRouteSearch(e.target.value);
                      setRouteId('');
                      setShowRouteResults(true);
                    }}
                    onFocus={() => setShowRouteResults(true)}
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {showRouteResults && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-in fade-in slide-in-from-top-1">
                    {routes.filter((r) => r.name.toLowerCase().includes(routeSearch.toLowerCase())).length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400 font-bold">কোনো রুট পাওয়া যায়নি</div>
                    ) : (
                      routes
                        .filter((r) => r.name.toLowerCase().includes(routeSearch.toLowerCase()))
                        .map((r) => (
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
                            className={`w-full rounded-xl px-3.5 py-2.5 text-left text-xs transition flex items-center justify-between font-bold ${
                              routeId === r.id ? 'bg-cyan-50 text-cyan-900' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                              {r.name}
                            </span>
                            {routeId === r.id && <Check className="w-4 h-4 text-cyan-600" />}
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>

              {/* Delivery Personnel Select */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <User className="w-3.5 h-3.5 text-cyan-600" />
                  <span>ডেলিভারিম্যান</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <select
                    value={assignedDeliveryManId}
                    onChange={(e) => setAssignedDeliveryManId(e.target.value)}
                    className={`w-full rounded-2xl border px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition appearance-none cursor-pointer shadow-2xs ${
                      assignedDeliveryManId ? 'border-cyan-300 bg-cyan-50/30 text-cyan-900' : 'border-slate-200 bg-slate-50/70 text-slate-800 focus:bg-white'
                    }`}
                  >
                    <option value="">ডেলিভারিম্যান সিলেক্ট করুন</option>
                    {deliveryMen.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} ({person.phone || 'ডেলিভারি'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Shop Select (Optional) */}
              <div className="relative space-y-1.5" ref={shopRef}>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Store className="w-3.5 h-3.5 text-cyan-600" />
                  <span>নির্দিষ্ট দোকান (ঐচ্ছিক)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={routeId ? 'দোকান সার্চ করুন...' : 'আগে রুট সিলেক্ট করুন'}
                    className={`w-full rounded-2xl border px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition shadow-2xs pr-8 ${
                      !routeId
                        ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200'
                        : shopId
                        ? 'border-cyan-300 bg-cyan-50/30 text-cyan-900'
                        : 'bg-slate-50/70 text-slate-800 border-slate-200 focus:bg-white'
                    }`}
                    value={shopSearch}
                    disabled={!routeId}
                    onChange={(e) => {
                      setShopSearch(e.target.value);
                      setShopId('');
                      setShowShopResults(true);
                    }}
                    onFocus={() => routeId && setShowShopResults(true)}
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {routeId && showShopResults && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-in fade-in slide-in-from-top-1">
                    {filteredShops.filter((s) => s.name.toLowerCase().includes(shopSearch.toLowerCase())).length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400 font-bold">এই রুটে কোনো দোকান পাওয়া যায়নি</div>
                    ) : (
                      filteredShops
                        .filter((s) => s.name.toLowerCase().includes(shopSearch.toLowerCase()))
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setShopId(s.id);
                              setShopSearch(s.name);
                              setShowShopResults(false);
                            }}
                            className={`w-full rounded-xl px-3.5 py-2.5 text-left text-xs transition flex items-center justify-between font-bold ${
                              shopId === s.id ? 'bg-cyan-50 text-cyan-900' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Store className="w-3.5 h-3.5 text-cyan-600" />
                              {s.name}
                            </span>
                            {shopId === s.id && <Check className="w-4 h-4 text-cyan-600" />}
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Market Area & Dispatch Note */}
            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>মার্কেট বা এলাকা (Market Area)</span>
                </label>
                <input
                  value={marketArea}
                  onChange={(e) => setMarketArea(e.target.value)}
                  placeholder="যেমন: চকবাজার, সদরঘাট..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>চালানের বিশেষ নোট (Dispatch Note)</span>
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="জরুরি কোনো নির্দেশ থাকলে লিখুন..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* 2. Order Items Card */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="p-5 sm:p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    ২. চালানের পণ্যসমূহ (Dispatch Items)
                  </h2>
                  <p className="text-xs text-slate-500">
                    যেকোনো কোম্পানির পণ্য যুক্ত করে চালানের জন্য প্রস্তুত করুন
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all self-start sm:self-center cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>পণ্য যোগ করুন</span>
              </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-3.5 min-w-[280px]">পণ্য ও কোম্পানি (Product)</th>
                    <th className="px-3 py-3.5 w-24 text-center">পরিমাণ (Qty)</th>
                    <th className="px-3 py-3.5 w-24 text-center">ফ্রি (Free)</th>
                    <th className="px-3 py-3.5 w-32 text-right">বিক্রয় দর (Price)</th>
                    <th className="px-3 py-3.5 w-40 text-center">ছাড় (Discount)</th>
                    <th className="px-4 py-3.5 w-36 text-right">মোট টাকা (Total)</th>
                    <th className="px-4 py-3.5 w-12 text-center">মুছুন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      {/* Product Search & Select */}
                      <td className="px-6 py-3 relative">
                        <div className="relative product-row-container">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="পণ্য খুঁজুন বা সিলেক্ট করুন..."
                              className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition shadow-2xs"
                              value={line.productId ? line.productName : line.searchText || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const newLines = [...lines];
                                newLines[idx] = {
                                  ...newLines[idx],
                                  searchText: val,
                                  showResults: true,
                                  productId: 0,
                                };
                                setLines(newLines);
                              }}
                              onFocus={() => {
                                const newLines = [...lines];
                                newLines[idx] = { ...newLines[idx], showResults: true };
                                setLines(newLines);
                              }}
                            />
                          </div>

                          {line.productId > 0 && (
                            <div className="flex items-center gap-2 mt-1 px-1">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">
                                {line.companyName}
                              </span>
                              <span className="text-[10px] text-slate-400">•</span>
                              <span className="text-[10px] font-bold text-slate-500">
                                মজুদ: <strong className="text-emerald-600">{stockMap[line.productId] || 0}</strong>
                              </span>
                            </div>
                          )}

                          {line.showResults && (
                            <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-in fade-in slide-in-from-top-1">
                              {allProducts.filter(
                                (p) =>
                                  p.name.toLowerCase().includes((line.searchText || '').toLowerCase()) ||
                                  p.sku?.toLowerCase().includes((line.searchText || '').toLowerCase()) ||
                                  p.company?.name.toLowerCase().includes((line.searchText || '').toLowerCase()),
                              ).length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400 font-bold">কোনো পণ্য পাওয়া যায়নি</div>
                              ) : (
                                allProducts
                                  .filter(
                                    (p) =>
                                      p.name.toLowerCase().includes((line.searchText || '').toLowerCase()) ||
                                      p.sku?.toLowerCase().includes((line.searchText || '').toLowerCase()) ||
                                      p.company?.name.toLowerCase().includes((line.searchText || '').toLowerCase()),
                                  )
                                  .map((p) => {
                                    const stock = stockMap[p.id] || 0;
                                    const isOutOfStock = stock <= 0;
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        disabled={isOutOfStock}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          if (isOutOfStock) return;
                                          updateLine(idx, {
                                            productId: p.id,
                                            productName: p.name,
                                            unitPrice: p.salePrice,
                                            showResults: false,
                                            searchText: p.name,
                                            companyId: p.companyId,
                                            companyName: p.company?.name || '',
                                          });
                                        }}
                                        className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs transition border-b border-slate-50 last:border-0 ${
                                          isOutOfStock
                                            ? 'opacity-40 cursor-not-allowed bg-slate-50'
                                            : 'hover:bg-indigo-50/50 cursor-pointer'
                                        }`}
                                      >
                                        <div className="flex-1 pr-2">
                                          <div className="font-bold text-slate-900">{p.name}</div>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-black uppercase text-slate-400">
                                              {p.company?.name}
                                            </span>
                                            <span
                                              className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                                                isOutOfStock
                                                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                                  : stock <= 10
                                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                              }`}
                                            >
                                              স্টক: {stock}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-black text-slate-900">{formatCurrency(p.salePrice)}</p>
                                        </div>
                                      </button>
                                    );
                                  })
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={line.quantity === 0 ? '' : line.quantity}
                          onChange={(e) =>
                            updateLine(idx, {
                              quantity: e.target.value === '' ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                        />
                      </td>

                      {/* Free Quantity */}
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={line.freeQuantity === 0 ? '' : line.freeQuantity}
                          onChange={(e) =>
                            updateLine(idx, {
                              freeQuantity: e.target.value === '' ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center font-bold text-emerald-700 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
                        />
                      </td>

                      {/* Unit Price */}
                      <td className="px-3 py-3 text-right">
                        <p className="font-bold text-slate-700">{formatCurrency(line.unitPrice)}</p>
                      </td>

                      {/* Discount */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={line.discountValue === 0 ? '' : line.discountValue}
                            placeholder="0"
                            onChange={(e) =>
                              updateLine(idx, {
                                discountValue: e.target.value === '' ? 0 : Number(e.target.value),
                              })
                            }
                            className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <select
                            value={line.discountType}
                            onChange={(e) =>
                              updateLine(idx, {
                                discountType: e.target.value as 'FIXED' | 'PERCENT',
                              })
                            }
                            className="rounded-xl bg-slate-100 px-2 py-2 font-black text-xs border border-slate-200 text-slate-700 cursor-pointer"
                          >
                            <option value="FIXED">৳</option>
                            <option value="PERCENT">%</option>
                          </select>
                        </div>
                      </td>

                      {/* Line Total */}
                      <td className="px-4 py-3 text-right font-black text-slate-900 text-sm">
                        {formatCurrency(line.lineTotal)}
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="h-8 w-8 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-90"
                          title="সারি মুছুন"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {lines.map((line, idx) => (
                <div key={idx} className="p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      আইটেম #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="relative product-row-container">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="পণ্য খুঁজুন..."
                        className="w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                        value={line.productId ? line.productName : line.searchText || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newLines = [...lines];
                          newLines[idx] = {
                            ...newLines[idx],
                            searchText: val,
                            showResults: true,
                            productId: 0,
                          };
                          setLines(newLines);
                        }}
                        onFocus={() => {
                          const newLines = [...lines];
                          newLines[idx] = { ...newLines[idx], showResults: true };
                          setLines(newLines);
                        }}
                      />
                    </div>

                    {line.productId > 0 && (
                      <div className="flex justify-between items-center mt-1.5 px-1">
                        <p className="text-[10px] font-black text-indigo-700 uppercase">{line.companyName}</p>
                        <p className="text-xs font-black text-slate-900">{formatCurrency(line.unitPrice)}</p>
                      </div>
                    )}

                    {line.showResults && (
                      <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                        {allProducts.filter(
                          (p) =>
                            p.name.toLowerCase().includes((line.searchText || '').toLowerCase()) ||
                            p.company?.name.toLowerCase().includes((line.searchText || '').toLowerCase()),
                        ).map((p) => {
                          const stock = stockMap[p.id] || 0;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={stock <= 0}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (stock <= 0) return;
                                updateLine(idx, {
                                  productId: p.id,
                                  productName: p.name,
                                  unitPrice: p.salePrice,
                                  showResults: false,
                                  searchText: p.name,
                                  companyId: p.companyId,
                                  companyName: p.company?.name || '',
                                });
                              }}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left border-b border-slate-50 last:border-0 hover:bg-slate-50"
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-900">{p.name}</p>
                                <p className="text-[10px] text-slate-400">{p.company?.name} • স্টক: {stock}</p>
                              </div>
                              <p className="text-xs font-black text-slate-900">{formatCurrency(p.salePrice)}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">পরিমাণ (Qty)</label>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity || ''}
                        onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                        className="w-full mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-center font-black text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-600">ফ্রি পরিমাণ (Free)</label>
                      <input
                        type="number"
                        min="0"
                        value={line.freeQuantity || ''}
                        onChange={(e) => updateLine(idx, { freeQuantity: Number(e.target.value) })}
                        className="w-full mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-center font-black text-emerald-700 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold">মোট টাকা</p>
                      <p className="text-sm font-black text-indigo-700">{formatCurrency(line.lineTotal)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="ছাড়"
                        value={line.discountValue || ''}
                        onChange={(e) => updateLine(idx, { discountValue: Number(e.target.value) })}
                        className="w-16 rounded-xl border border-slate-200 p-1.5 text-center text-xs font-bold"
                      />
                      <select
                        value={line.discountType}
                        onChange={(e) => updateLine(idx, { discountType: e.target.value as any })}
                        className="rounded-xl bg-slate-100 p-1.5 text-xs font-bold"
                      >
                        <option value="FIXED">৳</option>
                        <option value="PERCENT">%</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {lines.length === 0 && (
              <div className="py-16 text-center space-y-3 bg-slate-50/50">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-500 mx-auto flex items-center justify-center border border-indigo-100">
                  <PackageOpen className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-700">চালানে এখনো কোনো পণ্য যোগ করা হয়নি</p>
                  <p className="text-xs text-slate-400">নিচের বাটনে ক্লিক করে পণ্য যোগ করা শুরু করুন</p>
                </div>
              </div>
            )}

            {/* Add Line Bottom Button */}
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/40">
              <button
                type="button"
                onClick={addLine}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 py-3.5 text-xs font-black text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all active:scale-99 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>+ নতুন পণ্য সারি যোগ করুন (Add Product Row)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Summary & Actions */}
        <div className="space-y-6">
          
          {/* Summary Card */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-7 text-white shadow-xl border border-slate-800 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black tracking-wide text-cyan-300 uppercase">
                    Immediate Dispatch Summary
                  </p>
                  <p className="text-[11px] text-slate-400">চালানের সারসংক্ষেপ</p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-xs font-bold text-slate-300">মোট আইটেম সংখ্যা</span>
                <span className="text-base font-black text-white">{lines.length} টি</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-xs font-bold text-slate-300">মোট বিক্রি পরিমাণ</span>
                <span className="text-base font-black text-white">
                  {totalQty} পিস
                  {totalFreeQty > 0 && (
                    <span className="ml-1.5 text-xs text-emerald-400 font-bold">
                      (+{totalFreeQty} ফ্রি)
                    </span>
                  )}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white/10 border border-white/10 space-y-1 mt-2">
                <span className="text-xs font-bold text-slate-300">সর্বমোট চালানের মূল্য</span>
                <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 truncate">
                  {formatCurrency(subtotal)}
                </div>
              </div>

              {/* Status Validation Checklist */}
              <div className="space-y-2 pt-2 text-[11px]">
                <div className="flex items-center gap-2">
                  {routeId ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span className={routeId ? 'text-slate-300 font-semibold' : 'text-amber-300/90 font-bold'}>
                    {routeId ? 'রুট সিলেক্ট করা হয়েছে' : 'রুট নির্বাচন বাকি আছে'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {assignedDeliveryManId ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span className={assignedDeliveryManId ? 'text-slate-300 font-semibold' : 'text-amber-300/90 font-bold'}>
                    {assignedDeliveryManId ? 'ডেলিভারিম্যান সিলেক্ট করা হয়েছে' : 'ডেলিভারিম্যান নির্বাচন বাকি আছে'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {lines.length > 0 && lines.every(l => l.productId > 0) ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span className={lines.length > 0 && lines.every(l => l.productId > 0) ? 'text-slate-300 font-semibold' : 'text-amber-300/90 font-bold'}>
                    {lines.length > 0 && lines.every(l => l.productId > 0) ? `${lines.length}টি পণ্য প্রস্তুত` : 'পণ্য নির্বাচন করুন'}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleConfirmAndDispatch}
                disabled={isSaving || !isFormValid}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 p-4 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-500/25 hover:opacity-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                    <span>চালান তৈরি হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-slate-950" />
                    <span>কনফার্ম ও ডেলিভারি চালান তৈরি</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Workflow Guide Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                সহজ কার্যপ্রণালী নির্দেশিকা (Workflow Guide)
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-xs font-black text-cyan-800">
                  ১
                </div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  তারিখ, ডেলিভারি রুট এবং দায়িত্বপ্রাপ্ত ডেলিভারিম্যান নির্বাচন করুন।
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xs font-black text-indigo-800">
                  ২
                </div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  পণ্য অনুসন্ধান করে পরিমাণ, ফ্রি ও ছাড় বসান (স্টক অনুযায়ী স্বয়ংক্রিয় যাচাই হবে)।
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-800">
                  ৩
                </div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  কনফার্ম বাটনে চাপলে স্বয়ংক্রিয়ভাবে অর্ডার এবং ডেলিভারি চালান জেনারেট হয়ে যাবে।
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Floating Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 lg:hidden z-40 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-500">মোট চালানের মূল্য</p>
            <p className="text-base font-black text-slate-900">{formatCurrency(subtotal)}</p>
          </div>
          <button
            type="button"
            onClick={handleConfirmAndDispatch}
            disabled={isSaving || !isFormValid}
            className="flex-1 max-w-[220px] py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md disabled:opacity-40"
          >
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>{isSaving ? 'প্রসেসিং...' : 'চালান কনফার্ম করুন'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
