'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  Store,
  DollarSign,
  RotateCcw,
  Receipt,
  Truck,
  MapPin,
  Calendar,
  User,
  Phone,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Package,
  Plus,
  Minus,
  X,
  Camera,
  RefreshCw,
  Send,
  Boxes,
  Gift,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  FileText,
  Fuel,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/toast-provider';
import {
  getDispatchBatches,
  getDispatchBatch,
  recordBatchReturns,
  settleDispatchBatch,
} from '@/lib/api/delivery-ops';
import { getShops, createShop } from '@/lib/api/shops';
import { formatCurrency, formatNumber, getTodayBDDate } from '@/lib/utils/format';
import type { DispatchBatch, Shop } from '@/types/api';

// Realistic FMCG Demo Data matching the 10-screen master reference
interface DemoShopItem {
  id: number;
  productId: number;
  productName: string;
  packSize: number;
  cartons: number;
  pieces: number;
  totalPcs: number;
  unitPrice: number;
  totalAmount: number;
  unit: string;
}

interface DemoShop {
  id: number;
  name: string;
  address: string;
  phone: string;
  previousDue: number;
  todayDelivery: number;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  items: DemoShopItem[];
}

const INITIAL_DEMO_SHOPS: DemoShop[] = [
  {
    id: 1,
    name: 'শাহিন স্টোর',
    address: 'বাজার রোড, সদর',
    phone: '০১৭২২-৩৪৫৬৭৮',
    previousDue: 3600,
    todayDelivery: 6000,
    status: 'COMPLETED',
    items: [
      { id: 1, productId: 101, productName: 'Nectar Cooking Oil', packSize: 6, cartons: 2, pieces: 0, totalPcs: 12, unitPrice: 100, totalAmount: 1200, unit: 'Ltr' },
      { id: 2, productId: 102, productName: 'Rin Detergent', packSize: 24, cartons: 1, pieces: 0, totalPcs: 24, unitPrice: 40, totalAmount: 960, unit: 'Pcs' },
      { id: 3, productId: 103, productName: 'Lux Soap', packSize: 72, cartons: 1, pieces: 0, totalPcs: 72, unitPrice: 20, totalAmount: 1440, unit: 'Pcs' },
    ],
  },
  {
    id: 2,
    name: 'আলম ট্রেডার্স',
    address: 'স্টেশন রোড, সদর',
    phone: '০১৭১১-২২৩৩৪৪',
    previousDue: 2200,
    todayDelivery: 4500,
    status: 'PARTIAL',
    items: [
      { id: 4, productId: 101, productName: 'Nectar Cooking Oil', packSize: 6, cartons: 1, pieces: 0, totalPcs: 6, unitPrice: 100, totalAmount: 600, unit: 'Ltr' },
      { id: 5, productId: 104, productName: 'Wheel Washing Powder', packSize: 24, cartons: 2, pieces: 0, totalPcs: 48, unitPrice: 35, totalAmount: 1680, unit: 'Pcs' },
    ],
  },
  {
    id: 3,
    name: 'রহমান স্টোর',
    address: 'কলেজ রোড, সদর',
    phone: '০১৭৯৮-১১২২৩৩',
    previousDue: 1000,
    todayDelivery: 3200,
    status: 'PENDING',
    items: [
      { id: 6, productId: 102, productName: 'Rin Detergent', packSize: 24, cartons: 1, pieces: 12, totalPcs: 36, unitPrice: 40, totalAmount: 1440, unit: 'Pcs' },
      { id: 7, productId: 103, productName: 'Lux Soap', packSize: 72, cartons: 0, pieces: 36, totalPcs: 36, unitPrice: 20, totalAmount: 720, unit: 'Pcs' },
    ],
  },
  {
    id: 4,
    name: 'ইসলামিয়া স্টোর',
    address: 'মেইন রোড, সদর',
    phone: '০১৭১৫-৮৮৮৮৮৮',
    previousDue: 4500,
    todayDelivery: 5000,
    status: 'PENDING',
    items: [
      { id: 8, productId: 101, productName: 'Nectar Cooking Oil', packSize: 6, cartons: 2, pieces: 0, totalPcs: 12, unitPrice: 100, totalAmount: 1200, unit: 'Ltr' },
      { id: 9, productId: 105, productName: 'Fresh Flour (আটা)', packSize: 10, cartons: 2, pieces: 0, totalPcs: 20, unitPrice: 65, totalAmount: 1300, unit: 'Kg' },
    ],
  },
  {
    id: 5,
    name: 'সুমন ভ্যারাইটি স্টোর',
    address: 'বাজার রোড, সদর',
    phone: '০১৭২২-৭৭৭৭৭৭',
    previousDue: 800,
    todayDelivery: 2000,
    status: 'COMPLETED',
    items: [
      { id: 10, productId: 103, productName: 'Lux Soap', packSize: 72, cartons: 1, pieces: 0, totalPcs: 72, unitPrice: 20, totalAmount: 1440, unit: 'Pcs' },
    ],
  },
  {
    id: 6,
    name: 'মায়ের দোয়া এন্টারপ্রাইজ',
    address: 'হাইওয়ে রোড, সদর',
    phone: '০১৮১২-৯৯৯০০১',
    previousDue: 0,
    todayDelivery: 3500,
    status: 'PENDING',
    items: [
      { id: 11, productId: 101, productName: 'Nectar Cooking Oil', packSize: 6, cartons: 3, pieces: 0, totalPcs: 18, unitPrice: 100, totalAmount: 1800, unit: 'Ltr' },
    ],
  },
  {
    id: 7,
    name: 'জনতা স্টোর',
    address: 'নতুন বাজার, সদর',
    phone: '০১৭৩৪-৫৬৭৮৯০',
    previousDue: 1500,
    todayDelivery: 4000,
    status: 'COMPLETED',
    items: [
      { id: 12, productId: 102, productName: 'Rin Detergent', packSize: 24, cartons: 2, pieces: 0, totalPcs: 48, unitPrice: 40, totalAmount: 1920, unit: 'Pcs' },
    ],
  },
  {
    id: 8,
    name: 'বিসমিল্লাহ ট্রেডার্স',
    address: 'পুরাতন বাজার',
    phone: '০১৯১১-২২৩৩৪৪',
    previousDue: 2800,
    todayDelivery: 6200,
    status: 'COMPLETED',
    items: [
      { id: 13, productId: 101, productName: 'Nectar Cooking Oil', packSize: 6, cartons: 4, pieces: 0, totalPcs: 24, unitPrice: 100, totalAmount: 2400, unit: 'Ltr' },
    ],
  },
  {
    id: 9,
    name: 'সততা স্টোর',
    address: 'স্কুল মোড়',
    phone: '০১৭৫৫-৬৬৭৭৮৮',
    previousDue: 900,
    todayDelivery: 1800,
    status: 'PENDING',
    items: [
      { id: 14, productId: 103, productName: 'Lux Soap', packSize: 72, cartons: 1, pieces: 0, totalPcs: 72, unitPrice: 20, totalAmount: 1440, unit: 'Pcs' },
    ],
  },
  {
    id: 10,
    name: 'নিউ ভাই ভাই স্টোর',
    address: 'হাসপাতাল মোড়',
    phone: '০১৭১২-৩৪৫৬৭৮',
    previousDue: 3200,
    todayDelivery: 4200,
    status: 'COMPLETED',
    items: [
      { id: 15, productId: 104, productName: 'Wheel Washing Powder', packSize: 24, cartons: 2, pieces: 0, totalPcs: 48, unitPrice: 35, totalAmount: 1680, unit: 'Pcs' },
    ],
  },
  {
    id: 11,
    name: 'কাশেম ভ্যারাইটিজ',
    address: 'রেলগেট মোড়',
    phone: '০১৮২৩-৪৫৬৭৮৯',
    previousDue: 0,
    todayDelivery: 2700,
    status: 'COMPLETED',
    items: [
      { id: 16, productId: 102, productName: 'Rin Detergent', packSize: 24, cartons: 1, pieces: 0, totalPcs: 24, unitPrice: 40, totalAmount: 960, unit: 'Pcs' },
    ],
  },
  {
    id: 12,
    name: 'মদিনা ট্রেডার্স',
    address: 'চকবাজার মোড়',
    phone: '০১৭৬৬-৭৭৮৮৯৯',
    previousDue: 5000,
    todayDelivery: 7500,
    status: 'PENDING',
    items: [
      { id: 17, productId: 101, productName: 'Nectar Cooking Oil', packSize: 6, cartons: 5, pieces: 0, totalPcs: 30, unitPrice: 100, totalAmount: 3000, unit: 'Ltr' },
    ],
  },
];

const DEMO_VAN_PRODUCTS = [
  { productId: 101, name: 'Nectar Cooking Oil', packSize: 6, paidCartons: 15, freeCartons: 1, loosePcs: 4, totalPcs: 100, unitPrice: 100, unit: 'Ltr', status: 'যুক্ত' },
  { productId: 102, name: 'Rin Detergent', packSize: 24, paidCartons: 8, freeCartons: 0, loosePcs: 12, totalPcs: 204, unitPrice: 40, unit: 'Pcs', status: 'যুক্ত' },
  { productId: 103, name: 'Lux Soap', packSize: 72, paidCartons: 4, freeCartons: 1, loosePcs: 0, totalPcs: 360, unitPrice: 20, unit: 'Pcs', status: 'যুক্ত' },
  { productId: 104, name: 'Wheel Washing Powder', packSize: 24, paidCartons: 6, freeCartons: 0, loosePcs: 8, totalPcs: 152, unitPrice: 35, unit: 'Pcs', status: 'যুক্ত' },
  { productId: 105, name: 'Fresh Flour (আটা)', packSize: 10, paidCartons: 10, freeCartons: 0, loosePcs: 0, totalPcs: 100, unitPrice: 65, unit: 'Kg', status: 'যুক্ত' },
];

export function MyDeliveriesPage({ filterStatus }: { filterStatus?: string } = {}) {
  const { user } = useAuth();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Bottom Navigation Tab: 'home' | 'shops' | 'collection' | 'returns' | 'settlement'
  const [currentTab, setCurrentTab] = useState<'home' | 'shops' | 'collection' | 'returns' | 'settlement'>('home');

  // Shops State
  const [shops, setShops] = useState<DemoShop[]>(INITIAL_DEMO_SHOPS);
  const [shopFilter, setShopFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [shopSearch, setShopSearch] = useState('');
  const [selectedShopForDelivery, setSelectedShopForDelivery] = useState<DemoShop | null>(null);

  // Collection State (Screen 8)
  const [collectionSubTab, setCollectionSubTab] = useState<'today' | 'old_due'>('today');
  const [selectedCollectionShopId, setSelectedCollectionShopId] = useState<number>(1);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BKASH' | 'ASTHA'>('CASH');
  const [collectionAmount, setCollectionAmount] = useState<string>('2000');
  const [collectionNote, setCollectionNote] = useState<string>('নগদ কালেকশন');
  const [collectionHistory, setCollectionHistory] = useState<any[]>([
    { id: 1, shopName: 'শাহিন স্টোর', amount: 2000, mode: 'CASH', type: 'today', time: '10:30 AM' },
    { id: 2, shopName: 'সুমন ভ্যারাইটি স্টোর', amount: 2000, mode: 'CASH', type: 'today', time: '11:15 AM' },
    { id: 3, shopName: 'জনতা স্টোর', amount: 1500, mode: 'BKASH', type: 'old_due', time: '12:00 PM' },
  ]);

  // Returns State (Screen 9)
  const [returnsSubTab, setReturnsSubTab] = useState<'unsold' | 'damage'>('unsold');
  const [returnItems, setReturnItems] = useState(DEMO_VAN_PRODUCTS.map((p, idx) => ({
    ...p,
    returnCartons: idx === 0 ? 1 : 0,
    returnPieces: idx === 0 ? 6 : 0,
    status: idx === 2 ? 'প্রত্যাহার' : 'যুক্ত',
  })));

  // Final Settlement State (Screen 10)
  const [actualCashHandedOver, setActualCashHandedOver] = useState<string>('16500');

  // KPI Metrics
  const totalShopsCount = shops.length;
  const completedShopsCount = shops.filter((s) => s.status === 'COMPLETED').length;
  const pendingShopsCount = shops.filter((s) => s.status !== 'COMPLETED').length;

  const totalCollectedCash = collectionHistory.reduce((sum, c) => sum + c.amount, 0);
  const totalNewDues = 4000;
  const totalOldDueCollected = 3000;
  const totalVanExpenses = 1000;
  const grossNetSales = 20000;
  const expectedCashToHandOver = 17000; // 20000 - 5000 + 3000 - 1000 = 17000

  const actualCashNum = parseFloat(actualCashHandedOver) || 0;
  const cashDiscrepancy = actualCashNum - expectedCashToHandOver;

  // Filtered Shops List
  const filteredShops = useMemo(() => {
    return shops.filter((s) => {
      if (shopFilter === 'PENDING' && s.status === 'COMPLETED') return false;
      if (shopFilter === 'COMPLETED' && s.status !== 'COMPLETED') return false;
      if (shopSearch) {
        const query = shopSearch.toLowerCase();
        return (
          s.name.toLowerCase().includes(query) ||
          s.address.toLowerCase().includes(query) ||
          s.phone.includes(query)
        );
      }
      return true;
    });
  }, [shops, shopFilter, shopSearch]);

  // Handle Shop Delivery status action
  const handleUpdateShopDelivery = (status: 'COMPLETED' | 'PARTIAL' | 'PENDING') => {
    if (!selectedShopForDelivery) return;
    setShops((prev) =>
      prev.map((s) => (s.id === selectedShopForDelivery.id ? { ...s, status } : s)),
    );
    showSuccessToast(`"${selectedShopForDelivery.name}" ডেলিভারি স্ট্যাটাস: ${status === 'COMPLETED' ? 'সম্পন্ন' : status === 'PARTIAL' ? 'আংশিক' : 'পেন্ডিং'}`);
    setSelectedShopForDelivery(null);
  };

  // Handle Collection Submit
  const handleSaveCollection = () => {
    const amt = parseFloat(collectionAmount);
    if (!amt || amt <= 0) {
      showErrorToast('সঠিক টাকার পরিমাণ লিখুন');
      return;
    }
    const shop = shops.find((s) => s.id === selectedCollectionShopId);
    const newEntry = {
      id: Date.now(),
      shopName: shop?.name || 'দোকান',
      amount: amt,
      mode: paymentMode,
      type: collectionSubTab,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setCollectionHistory((prev) => [newEntry, ...prev]);
    showSuccessToast(`৳ ${amt} টাকা কালেকশন জমা হয়েছে (${shop?.name})`);
    setCollectionAmount('');
  };

  // Handle Settlement Submit
  const handleSubmitSettlement = () => {
    showSuccessToast('দিনের হিসাব সফলভাবে বাবার কাছে সাবমিট করা হয়েছে!');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-12 font-sans text-slate-800 antialiased">
      {/* ── TOP APP BAR (Blue Bar matching Reference Screen 1, 2, 3, 8, 9, 10) ── */}
      <div className="sticky top-0 lg:relative z-30 bg-[#0260e8] text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            {selectedShopForDelivery ? (
              <button
                type="button"
                onClick={() => setSelectedShopForDelivery(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white active:scale-95 transition"
              >
                <ArrowRight className="h-5 w-5 rotate-180" />
              </button>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
                <Truck className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                {selectedShopForDelivery
                  ? 'দোকান ডেলিভারি'
                  : currentTab === 'home'
                  ? 'ডেলিভারি ম্যান প্যানেল'
                  : currentTab === 'shops'
                  ? 'আজকের দোকান / Route'
                  : currentTab === 'collection'
                  ? 'টাকা আদায় (Collection)'
                  : currentTab === 'returns'
                  ? 'ফেরত ও ড্যামেজ'
                  : 'দিনের শেষে হিসাব জমা'}
              </h1>
              <p className="text-[11px] font-medium text-blue-100 opacity-90 truncate">
                {user?.name || 'Rahim Ahmed'} • ID: DM-001
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-400/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
        </div>

        {/* Desktop View Top Menu Tabs (Hidden on mobile) */}
        <div className="hidden md:flex mx-auto max-w-5xl border-t border-white/15 px-4">
          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('home'); }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-black border-b-2 transition ${
              currentTab === 'home' && !selectedShopForDelivery
                ? 'border-white text-white'
                : 'border-transparent text-blue-100 hover:text-white'
            }`}
          >
            <Home className="h-4 w-4" />
            <span>হোম ড্যাশবোর্ড</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('shops'); }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-black border-b-2 transition ${
              currentTab === 'shops'
                ? 'border-white text-white'
                : 'border-transparent text-blue-100 hover:text-white'
            }`}
          >
            <Store className="h-4 w-4" />
            <span>আজকের দোকান ({totalShopsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('collection'); }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-black border-b-2 transition ${
              currentTab === 'collection'
                ? 'border-white text-white'
                : 'border-transparent text-blue-100 hover:text-white'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            <span>টাকা আদায়</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('returns'); }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-black border-b-2 transition ${
              currentTab === 'returns'
                ? 'border-white text-white'
                : 'border-transparent text-blue-100 hover:text-white'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            <span>ফেরত ও ড্যামেজ</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('settlement'); }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-black border-b-2 transition ${
              currentTab === 'settlement'
                ? 'border-white text-white'
                : 'border-transparent text-blue-100 hover:text-white'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>হিসাব জমা</span>
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER (Full Width Responsive) ── */}
      <div className="mx-auto max-w-5xl px-3 sm:px-4 pt-3 space-y-3">
        {/* ══════════════════════════════════════════════════════════════
            SCREEN 3: INDIVIDUAL SHOP DELIVERY EXECUTION (দোকান ডেলিভারি)
           ══════════════════════════════════════════════════════════════ */}
        {selectedShopForDelivery ? (
          <div className="space-y-3 animate-in fade-in">
            {/* Shop Header Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Store className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      {selectedShopForDelivery.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedShopForDelivery.address}</p>
                    <a
                      href={`tel:${selectedShopForDelivery.phone}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline mt-0.5"
                    >
                      <Phone className="h-3 w-3" />
                      {selectedShopForDelivery.phone}
                    </a>
                  </div>
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    selectedShopForDelivery.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedShopForDelivery.status === 'PARTIAL'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {selectedShopForDelivery.status === 'COMPLETED'
                    ? '● সম্পন্ন'
                    : selectedShopForDelivery.status === 'PARTIAL'
                    ? '● আংশিক'
                    : '● পেন্ডিং'}
                </span>
              </div>

              {/* Due vs Today Delivery Balance Row */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block">আগের বাকি</span>
                  <span className="text-sm font-black text-slate-700">
                    {formatCurrency(selectedShopForDelivery.previousDue)}
                  </span>
                </div>
                <div className="rounded-xl bg-blue-50/60 p-2.5 text-center">
                  <span className="text-[10px] font-bold text-blue-600 block">আজকের ডেলিভারি</span>
                  <span className="text-sm font-black text-blue-700">
                    {formatCurrency(selectedShopForDelivery.todayDelivery)}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Items List */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                ডেলিভারি আইটেম ({selectedShopForDelivery.items.length} টি)
              </h4>

              <div className="divide-y divide-slate-100">
                {selectedShopForDelivery.items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/80 text-amber-500">
                        <Package className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-black text-slate-900 text-xs sm:text-sm truncate">
                          {item.productName}
                        </h5>
                        <p className="text-[11px] text-slate-400 font-medium">
                          ১ কার্টুন = {item.packSize} {item.unit}
                        </p>
                        <p className="text-xs font-bold text-blue-700">
                          {item.cartons} কার্টুন = {item.totalPcs} {item.unit}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-slate-900 text-sm">
                        {formatCurrency(item.totalAmount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons: ডেলিভারি সম্পন্ন / আংশিক / ফেল */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleUpdateShopDelivery('COMPLETED')}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#10b981] hover:bg-emerald-600 active:scale-98 text-white font-black py-3.5 text-sm shadow-md transition cursor-pointer"
              >
                <CheckCircle2 className="h-5 w-5" />
                <span>ডেলিভারি সম্পন্ন</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateShopDelivery('PARTIAL')}
                  className="rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 py-3 text-xs font-black text-amber-900 transition"
                >
                  আংশিক ডেলিভারি
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateShopDelivery('PENDING')}
                  className="rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 py-3 text-xs font-black text-rose-900 transition"
                >
                  ফেল / ফেরত
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════
                SCREEN 1: হোম ড্যাশবোর্ড (Home Dashboard)
               ══════════════════════════════════════════════════════════════ */}
            {currentTab === 'home' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Delivery Assignment Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
                  <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">আজকের তারিখ</div>
                        <div className="font-bold text-slate-800">২৪ Oct ২০২৬ (শনিবার)</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">রুট</div>
                        <div className="font-bold text-slate-800">বাজার রুট</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">ভ্যান নং</div>
                        <div className="font-bold text-slate-800">ঢাকা মেট্রো-ন ১২-৩৪৫৬</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Boxes className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">ভ্যানের মোট মাল</div>
                        <div className="font-black text-blue-700">৳ ২০,০০০</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6 KPI Cards in 3x2 Grid matching Screen 1 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-slate-800">
                    <span>আজকের সারাংশ</span>
                    <Link
                      href="/delivery-ops/scan-dispatch"
                      className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Boxes className="h-3.5 w-3.5" />
                      কার্টুন স্ক্যান ও লোডিং
                    </Link>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* 1. মোট দোকান */}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 text-center shadow-2xs">
                      <div className="text-[10px] sm:text-xs font-bold text-emerald-700">মোট দোকান</div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-0.5">
                        {totalShopsCount}
                      </div>
                    </div>

                    {/* 2. ডেলিভারি সম্পন্ন */}
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3 text-center shadow-2xs">
                      <div className="text-[10px] sm:text-xs font-bold text-blue-600">ডেলিভারি সম্পন্ন</div>
                      <div className="text-xl sm:text-2xl font-black text-blue-700 mt-0.5">
                        {completedShopsCount}
                      </div>
                    </div>

                    {/* 3. বাকি দোকান */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3 text-center shadow-2xs">
                      <div className="text-[10px] sm:text-xs font-bold text-amber-700">বাকি দোকান</div>
                      <div className="text-xl sm:text-2xl font-black text-amber-800 mt-0.5">
                        {pendingShopsCount}
                      </div>
                    </div>

                    {/* 4. আদায়কৃত নগদ */}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 text-center shadow-2xs">
                      <div className="text-[10px] sm:text-xs font-bold text-emerald-700">আদায়কৃত নগদ</div>
                      <div className="text-lg sm:text-xl font-black text-emerald-800 mt-0.5 truncate">
                        {formatCurrency(totalCollectedCash)}
                      </div>
                    </div>

                    {/* 5. নতুন বাকি */}
                    <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-3 text-center shadow-2xs">
                      <div className="text-[10px] sm:text-xs font-bold text-purple-700">নতুন বাকি</div>
                      <div className="text-lg sm:text-xl font-black text-purple-800 mt-0.5 truncate">
                        {formatCurrency(totalNewDues)}
                      </div>
                    </div>

                    {/* 6. পুরোনো বাকি আদায় */}
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-3 text-center shadow-2xs">
                      <div className="text-[10px] sm:text-xs font-bold text-cyan-700">পুরোনো বাকি আদায়</div>
                      <div className="text-lg sm:text-xl font-black text-cyan-800 mt-0.5 truncate">
                        {formatCurrency(totalOldDueCollected)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button: আজকের ডেলিভারি শুরু করুন */}
                <button
                  type="button"
                  onClick={() => setCurrentTab('shops')}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0260e8] hover:bg-blue-700 active:scale-98 text-white font-black py-3.5 text-sm sm:text-base shadow-md transition cursor-pointer"
                >
                  <span>আজকের ডেলিভারি শুরু করুন</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SCREEN 2: আজকের দোকান / ROUTE (Shops List)
               ══════════════════════════════════════════════════════════════ */}
            {currentTab === 'shops' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="দোকান নাম বা এলাকার নাম সার্চ করুন..."
                    value={shopSearch}
                    onChange={(e) => setShopSearch(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 shadow-2xs"
                  />
                  {shopSearch && (
                    <button
                      type="button"
                      onClick={() => setShopSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShopFilter('ALL')}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                      shopFilter === 'ALL'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    সব ({totalShopsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShopFilter('PENDING')}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                      shopFilter === 'PENDING'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    পেন্ডিং ({pendingShopsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShopFilter('COMPLETED')}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                      shopFilter === 'COMPLETED'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    সম্পন্ন ({completedShopsCount})
                  </button>
                </div>

                {/* Numbered Shop Cards */}
                <div className="space-y-2">
                  {filteredShops.map((shop, idx) => (
                    <button
                      key={shop.id}
                      type="button"
                      onClick={() => setSelectedShopForDelivery(shop)}
                      className="w-full rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs hover:border-blue-300 transition text-left flex items-center justify-between gap-3 active:scale-98 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Numbered Avatar */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-black text-sm">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate">
                            {shop.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate">{shop.address}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{shop.phone}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            shop.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : shop.status === 'PARTIAL'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {shop.status === 'COMPLETED'
                            ? 'সম্পন্ন'
                            : shop.status === 'PARTIAL'
                            ? 'আংশিক'
                            : 'পেন্ডিং'}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SCREEN 8: টাকা আদায় (Collection)
               ══════════════════════════════════════════════════════════════ */}
            {currentTab === 'collection' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Sub tabs: আজকের কালেকশন vs পুরোনো বাকি আদায় */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCollectionSubTab('today')}
                    className={`py-2.5 rounded-xl text-xs font-black transition ${
                      collectionSubTab === 'today'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    আজকের কালেকশন
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionSubTab('old_due')}
                    className={`py-2.5 rounded-xl text-xs font-black transition ${
                      collectionSubTab === 'old_due'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    পুরোনো বাকি আদায়
                  </button>
                </div>

                {/* Selected Shop Due Card matching Screen 8 */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 block">দোকান নির্বাচন করুন</label>
                  <select
                    value={selectedCollectionShopId}
                    onChange={(e) => setSelectedCollectionShopId(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 outline-none"
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatCurrency(collectionSubTab === 'today' ? s.todayDelivery : s.previousDue)} বকেয়া)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Method Pills */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2">
                  <label className="text-xs font-black text-slate-800 block">পেমেন্টের ধরন</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('CASH')}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        paymentMode === 'CASH'
                          ? 'bg-[#10b981] text-white border-emerald-500 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      নগদ
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('BKASH')}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        paymentMode === 'BKASH'
                          ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      বিকাশ
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('ASTHA')}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        paymentMode === 'ASTHA'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      নগদ (আস্থা)
                    </button>
                  </div>

                  {/* Amount input */}
                  <div className="pt-2 space-y-1">
                    <label className="text-xs font-black text-slate-800 block">টাকার পরিমাণ (৳)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={collectionAmount}
                        onChange={(e) => setCollectionAmount(e.target.value)}
                        placeholder="e.g. 2000"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-900 outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        BDT
                      </span>
                    </div>
                  </div>

                  {/* Note */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">নোট (ঐচ্ছিক)</label>
                    <input
                      type="text"
                      value={collectionNote}
                      onChange={(e) => setCollectionNote(e.target.value)}
                      placeholder="নোট: আংশিক বাকি পরিশোধ"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>

                  {/* Camera attach */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => showSuccessToast('ক্যামেরা চালু হয়েছে (ছবি সংযুক্ত)')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <Camera className="h-4 w-4 text-blue-600" />
                      <span>ছবি সংযুক্ত করুন</span>
                    </button>
                  </div>
                </div>

                {/* Submit Collection Button */}
                <button
                  type="button"
                  onClick={handleSaveCollection}
                  className="w-full py-3.5 rounded-2xl bg-[#0260e8] hover:bg-blue-700 active:scale-98 text-white font-black text-sm shadow-md transition cursor-pointer"
                >
                  জমা করুন
                </button>

                {/* Collection History list */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                    আজকের কালেকশন হিস্ট্রি ({collectionHistory.length} টি)
                  </div>
                  <div className="divide-y divide-slate-100 text-xs font-bold">
                    {collectionHistory.map((c) => (
                      <div key={c.id} className="py-2 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{c.shopName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {c.mode} • {c.time}
                          </div>
                        </div>
                        <span className="font-black text-emerald-700">+{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SCREEN 9: ফেরত ও ড্যামেজ (Returns & Damage)
               ══════════════════════════════════════════════════════════════ */}
            {currentTab === 'returns' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Sub tabs */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReturnsSubTab('unsold')}
                    className={`py-2.5 rounded-xl text-xs font-black transition ${
                      returnsSubTab === 'unsold'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    অবিক্রীত ফেরত
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnsSubTab('damage')}
                    className={`py-2.5 rounded-xl text-xs font-black transition ${
                      returnsSubTab === 'damage'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    ড্যামেজ / মেয়াদোত্তীর্ণ
                  </button>
                </div>

                {/* Return Items List matching Screen 9 */}
                <div className="space-y-2">
                  {returnItems.map((item, idx) => (
                    <div
                      key={item.productId}
                      className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/80 text-amber-500">
                          <Package className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate">
                            {item.name}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            ১ কার্টুন = {item.packSize} {item.unit}
                          </p>
                          <p className="text-xs font-bold text-slate-700">
                            কার্টুন {item.returnCartons} ({item.returnPieces} পিস)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            item.status === 'যুক্ত'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Summary */}
                <div className="rounded-2xl bg-slate-100 p-3.5 flex items-center justify-between font-black text-slate-800 text-sm">
                  <span>মোট ফেরত পণ্য:</span>
                  <span className="text-blue-700">৩০ পিস</span>
                </div>

                <button
                  type="button"
                  onClick={() => showSuccessToast('ফেরত মাল সফলভাবে জমা হয়েছে')}
                  className="w-full py-3.5 rounded-2xl bg-[#0260e8] hover:bg-blue-700 active:scale-98 text-white font-black text-sm shadow-md transition cursor-pointer"
                >
                  জমা করুন
                </button>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SCREEN 10: দিনের শেষে হিসাব জমা (Final Settlement)
               ══════════════════════════════════════════════════════════════ */}
            {currentTab === 'settlement' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Accounting breakdown card matching Screen 10 */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                    হিসাব সারাংশ
                  </h3>

                  <div className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">মোট নেট বিক্রি:</span>
                      <span className="text-slate-900 font-black">
                        {formatCurrency(grossNetSales)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">আজকের নতুন বাকি:</span>
                      <span className="text-slate-900 font-black">
                        {formatCurrency(totalNewDues)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">পুরোনো বাকি আদায়:</span>
                      <span className="text-slate-900 font-black">
                        {formatCurrency(totalOldDueCollected)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">ভ্যান ভাড়া ও অন্যান্য খরচ:</span>
                      <span className="text-slate-900 font-black">
                        {formatCurrency(totalVanExpenses)}
                      </span>
                    </div>
                  </div>

                  {/* Dark Highlighted Expected Cash Pill matching Screen 10 */}
                  <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between shadow-sm">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        মোট জমাযোগ্য ক্যাশ
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
                        {formatCurrency(expectedCashToHandOver)}
                      </div>
                    </div>
                    <ShieldCheck className="h-8 w-8 text-emerald-400 opacity-90" />
                  </div>

                  {/* Actual cash input matching Screen 10 */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-black text-slate-800">
                      প্রকৃত ক্যাশ জমা (৳)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={actualCashHandedOver}
                        onChange={(e) => setActualCashHandedOver(e.target.value)}
                        className="w-full rounded-2xl border-2 border-blue-400 bg-white px-4 py-3 text-base font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-100"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                        BDT
                      </span>
                    </div>
                  </div>

                  {/* Discrepancy Card: ঘাটতি / মিল matching Screen 10 */}
                  {actualCashHandedOver !== '' && (
                    <div
                      className={`rounded-2xl p-3.5 text-xs font-bold border transition ${
                        cashDiscrepancy < 0
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      }`}
                    >
                      {cashDiscrepancy < 0 ? (
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-black text-rose-800">
                              ⚠️ ঘাটতি: {formatCurrency(Math.abs(cashDiscrepancy))}
                            </div>
                            <p className="text-[11px] text-rose-700 mt-0.5">
                              বাবার কাছে জমা দেওয়া টাকার পরিমাণের চেয়ে কম রয়েছে।
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          <span className="font-black text-emerald-800">
                            হিসাব সম্পূর্ণ মিলেছে! (৳০)
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handleSubmitSettlement}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0260e8] hover:bg-blue-700 active:scale-98 text-white font-black py-3.5 text-sm shadow-md transition cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    <span>সাবমিট করুন</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 5 BOTTOM NAVIGATION BUTTONS (Exact Match to 10-screen master reference) ── */}
      <nav
        aria-label="Delivery Man Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1 max-w-lg mx-auto text-center">
          {/* 1. হোম */}
          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('home'); }}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 ${
              currentTab === 'home' && !selectedShopForDelivery
                ? 'text-[#0260e8] font-black'
                : 'text-slate-400 hover:text-slate-700 font-semibold'
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">হোম</span>
          </button>

          {/* 2. দোকান */}
          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('shops'); }}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 ${
              currentTab === 'shops' || selectedShopForDelivery
                ? 'text-[#0260e8] font-black'
                : 'text-slate-400 hover:text-slate-700 font-semibold'
            }`}
          >
            <Store className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">দোকান</span>
          </button>

          {/* 3. কালেকশন */}
          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('collection'); }}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 ${
              currentTab === 'collection'
                ? 'text-[#0260e8] font-black'
                : 'text-slate-400 hover:text-slate-700 font-semibold'
            }`}
          >
            <DollarSign className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">কালেকশন</span>
          </button>

          {/* 4. ফেরত */}
          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('returns'); }}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 ${
              currentTab === 'returns'
                ? 'text-[#0260e8] font-black'
                : 'text-slate-400 hover:text-slate-700 font-semibold'
            }`}
          >
            <RotateCcw className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">ফেরত</span>
          </button>

          {/* 5. হিসাব */}
          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('settlement'); }}
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 ${
              currentTab === 'settlement'
                ? 'text-[#0260e8] font-black'
                : 'text-slate-400 hover:text-slate-700 font-semibold'
            }`}
          >
            <Receipt className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">হিসাব</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
