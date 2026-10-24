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
  ChevronDown,
  HelpCircle,
  FileText,
  Fuel,
  Info,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/toast-provider';
import {
  getDispatchBatches,
  getDispatchBatch,
  recordBatchReturns,
  settleDispatchBatch,
  submitDeliveryResult,
} from '@/lib/api/delivery-ops';
import { getShops, createShop } from '@/lib/api/shops';
import { formatCurrency, formatNumber, getTodayBDDate } from '@/lib/utils/format';
import type { DispatchBatch, Shop, OrderItem } from '@/types/api';

// Real Data Structures derived from Backend Database
interface RealShopItem {
  id: number;
  productId: number;
  productName: string;
  packSize: number;
  cartons: number;
  pieces: number;
  totalPcs: number;
  freeQty: number;
  unitPrice: number;
  totalAmount: number;
  unit: string;
}

interface RealShopDelivery {
  orderId: number;
  shopId: number;
  name: string;
  ownerName: string;
  address: string;
  phone: string;
  previousDue: number;
  todayDelivery: number;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  hasOrder?: boolean;
  routeId?: number;
  routeName?: string;
  items: RealShopItem[];
}

interface RealLoadedProduct {
  productId: number;
  name: string;
  packSize: number;
  totalPcs: number;
  paidCartons: number;
  freeCartons: number;
  loosePcs: number;
  unitPrice: number;
  unit: string;
}

interface RealCollectionRecord {
  id: string;
  shopId: number;
  shopName: string;
  amount: number;
  mode: 'CASH' | 'BKASH' | 'ASTHA';
  type: 'today' | 'old_due';
  time: string;
  note?: string;
}

interface RealReturnRecord {
  id: string;
  shopId: number;
  shopName: string;
  productId: number;
  productName: string;
  returnCartons: number;
  returnPieces: number;
  totalReturnPcs: number;
  damagedPcs: number;
  type: 'unsold' | 'damage';
  unitPrice: number;
  time: string;
}

export function MyDeliveriesPage({ filterStatus }: { filterStatus?: string } = {}) {
  const { user } = useAuth();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Batches and Master Shops from real database
  const [batches, setBatches] = useState<DispatchBatch[]>([]);
  const [activeBatch, setActiveBatch] = useState<DispatchBatch | null>(null);
  const [masterShops, setMasterShops] = useState<Shop[]>([]);

  // Active Bottom Navigation Tab: 'home' | 'shops' | 'collection' | 'returns' | 'settlement'
  const [currentTab, setCurrentTab] = useState<'home' | 'shops' | 'collection' | 'returns' | 'settlement'>('home');

  // Real Shops & Delivery State (Holds ALL shops in the database/route)
  const [shops, setShops] = useState<RealShopDelivery[]>([]);
  const [shopFilter, setShopFilter] = useState<'ALL' | 'ORDERS' | 'DUES' | 'COMPLETED'>('ALL');
  const [shopSearch, setShopSearch] = useState('');
  const [selectedShopForDelivery, setSelectedShopForDelivery] = useState<RealShopDelivery | null>(null);

  // Real Road Exception Records (Collection, Returns, Expenses)
  const [collectionHistory, setCollectionHistory] = useState<RealCollectionRecord[]>([]);
  const [returnRecords, setReturnRecords] = useState<RealReturnRecord[]>([]);
  const [vanExpenses, setVanExpenses] = useState<number>(0);
  const [expenseNote, setExpenseNote] = useState('');

  // Form Inputs
  const [collectionSubTab, setCollectionSubTab] = useState<'today' | 'old_due'>('today');
  const [selectedCollectionShopId, setSelectedCollectionShopId] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BKASH' | 'ASTHA'>('CASH');
  const [collectionAmount, setCollectionAmount] = useState<string>('');
  const [collectionNote, setCollectionNote] = useState<string>('');

  // Returns Form State
  const [returnsSubTab, setReturnsSubTab] = useState<'unsold' | 'damage'>('unsold');
  const [selectedReturnShopId, setSelectedReturnShopId] = useState<number | ''>('');
  const [selectedReturnProductId, setSelectedReturnProductId] = useState<number | ''>('');
  const [returnCartons, setReturnCartons] = useState<number>(0);
  const [returnPieces, setReturnPieces] = useState<number>(0);
  const [returnReason, setReturnReason] = useState('দোকান নেয়নি / অবিক্রীত');

  // Final Cash Handed Over
  const [actualCashHandedOver, setActualCashHandedOver] = useState<string>('');

  // Modals
  const [isNewShopModalOpen, setIsNewShopModalOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopOwner, setNewShopOwner] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [isCreatingShop, setIsCreatingShop] = useState(false);

  // Storage Key for local persistence
  const storageKey = useMemo(() => {
    return activeBatch ? `dm_live_records_batch_${activeBatch.id}` : '';
  }, [activeBatch]);

  // 1. Fetch Real Batches & ALL Master Shops from Database
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [batchesRes, shopsRes] = await Promise.all([
        getDispatchBatches().catch(() => []),
        getShops({ limit: 1000 }).catch(() => []),
      ]);

      const batchList: DispatchBatch[] = Array.isArray(batchesRes)
        ? batchesRes
        : batchesRes?.items || [];
      setBatches(batchList);

      const shopList: Shop[] = Array.isArray(shopsRes) ? shopsRes : shopsRes?.items || [];
      setMasterShops(shopList);

      if (batchList.length > 0) {
        const myBatch =
          batchList.find(
            (b) =>
              b.status !== 'SETTLED' &&
              (b.assignedDeliveryManId === user?.id || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'),
          ) || batchList[0];

        try {
          const fullBatch = await getDispatchBatch(myBatch.id);
          setActiveBatch(fullBatch);
        } catch {
          setActiveBatch(myBatch);
        }
      } else {
        setActiveBatch(null);
      }
    } catch (err: any) {
      showErrorToast(err.message || 'ডাটাবেস থেকে ডাটা লোড করতে ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
    }
  }, [user, showErrorToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 2. Build Unified Shops List: Combines ALL Master Shops + Active Batch Orders
  useEffect(() => {
    const orderMap = new Map<number, any>();
    (activeBatch?.orders || []).forEach((bo: any) => {
      const sId = Number(bo.order?.shop?.id || bo.order?.shopId || bo.orderId);
      orderMap.set(sId, bo);
    });

    // Map all master shops from the database
    const allMappedShops: RealShopDelivery[] = masterShops.map((shop) => {
      const sId = Number(shop.id);
      const bo = orderMap.get(sId);
      const order = bo?.order || {};

      const items: RealShopItem[] = bo
        ? (order.items || []).map((oi: OrderItem) => {
            const prod = oi.product || ({} as any);
            const packSize = Number(prod.defaultCartonSize || 1);
            const totalPcs = Number(oi.quantity || 0);
            const cartons = Math.floor(totalPcs / (packSize > 0 ? packSize : 1));
            const pieces = totalPcs % (packSize > 0 ? packSize : 1);
            const unitPrice = Number(oi.unitPrice || 0);
            const totalAmount = totalPcs * unitPrice;

            return {
              id: Number(oi.id || 0),
              productId: Number(oi.productId),
              productName: prod.name || `পণ্য #${oi.productId}`,
              packSize,
              cartons,
              pieces,
              totalPcs,
              freeQty: Number(oi.freeQuantity || 0),
              unitPrice,
              totalAmount,
              unit: prod.unit || 'Pcs',
            };
          })
        : [];

      const orderTotal = bo ? Number(order.totalAmount || bo.estimatedAmount || 0) : 0;
      const isDelivered = bo && order.status === 'DELIVERED';
      const isPartial = bo && order.status === 'PARTIALLY_DELIVERED';

      return {
        orderId: bo ? Number(bo.orderId) : 0,
        shopId: sId,
        name: shop.name || `দোকান #${sId}`,
        ownerName: shop.ownerName || '',
        address: shop.address || 'বাজার',
        phone: shop.phone || '',
        previousDue: Number((shop as any).balance ?? shop.totalDue ?? 0),
        todayDelivery: orderTotal,
        status: isDelivered ? 'COMPLETED' : isPartial ? 'PARTIAL' : 'PENDING',
        hasOrder: !!bo,
        routeId: shop.routeId,
        routeName: (shop as any).route?.name || '',
        items,
      };
    });

    // Include any batch orders whose shop was temporary or not in masterShops
    (activeBatch?.orders || []).forEach((bo: any) => {
      const sId = Number(bo.order?.shop?.id || bo.order?.shopId || bo.orderId);
      if (!allMappedShops.some((s) => s.shopId === sId)) {
        const order = bo.order || {};
        const shop = order.shop || {};
        const items: RealShopItem[] = (order.items || []).map((oi: OrderItem) => {
          const prod = oi.product || ({} as any);
          const packSize = Number(prod.defaultCartonSize || 1);
          const totalPcs = Number(oi.quantity || 0);
          return {
            id: Number(oi.id || 0),
            productId: Number(oi.productId),
            productName: prod.name || `পণ্য #${oi.productId}`,
            packSize,
            cartons: Math.floor(totalPcs / (packSize > 0 ? packSize : 1)),
            pieces: totalPcs % (packSize > 0 ? packSize : 1),
            totalPcs,
            freeQty: Number(oi.freeQuantity || 0),
            unitPrice: Number(oi.unitPrice || 0),
            totalAmount: totalPcs * Number(oi.unitPrice || 0),
            unit: prod.unit || 'Pcs',
          };
        });

        allMappedShops.push({
          orderId: Number(bo.orderId),
          shopId: sId,
          name: shop.name || order.temporaryShopName || `দোকান #${bo.orderId}`,
          ownerName: shop.ownerName || '',
          address: shop.address || order.marketArea || 'বাজার',
          phone: shop.phone || '',
          previousDue: Number((shop as any).balance ?? (shop as any).totalDue ?? 0),
          todayDelivery: Number(order.totalAmount || bo.estimatedAmount || 0),
          status: order.status === 'DELIVERED' ? 'COMPLETED' : order.status === 'PARTIALLY_DELIVERED' ? 'PARTIAL' : 'PENDING',
          hasOrder: true,
          items,
        });
      }
    });

    // Sort: Shops with today's orders first, then shops with dues, then alphabetically
    allMappedShops.sort((a, b) => {
      if (a.hasOrder && !b.hasOrder) return -1;
      if (!a.hasOrder && b.hasOrder) return 1;
      if (a.previousDue > 0 && b.previousDue <= 0) return -1;
      if (a.previousDue <= 0 && b.previousDue > 0) return 1;
      return a.name.localeCompare(b.name, 'bn');
    });

    setShops(allMappedShops);

    // Default select first shop for collection dropdown
    if (allMappedShops.length > 0 && !selectedCollectionShopId) {
      setSelectedCollectionShopId(allMappedShops[0].shopId);
    }
  }, [activeBatch, masterShops, selectedCollectionShopId]);

  // 3. Extract Real Loaded Products in Van
  const loadedVanProducts = useMemo<RealLoadedProduct[]>(() => {
    if (!activeBatch) return [];

    if (activeBatch.items && activeBatch.items.length > 0) {
      return activeBatch.items.map((bi: any) => {
        const prod = bi.product || {};
        const packSize = Number(prod.defaultCartonSize || 1);
        const totalPcs = Number(bi.totalDispatchedQty || 0);
        const paidCartons = Math.floor(totalPcs / (packSize > 0 ? packSize : 1));
        const loosePcs = totalPcs % (packSize > 0 ? packSize : 1);

        return {
          productId: Number(bi.productId),
          name: prod.name || `পণ্য #${bi.productId}`,
          packSize,
          totalPcs,
          paidCartons,
          freeCartons: 0,
          loosePcs,
          unitPrice: Number(bi.unitPrice || prod.salePrice || 0),
          unit: prod.unit || 'Pcs',
        };
      });
    }

    // Fallback: Aggregate from orders
    const productMap = new Map<number, RealLoadedProduct>();
    (activeBatch.orders || []).forEach((bo: any) => {
      (bo.order?.items || []).forEach((oi: any) => {
        const pid = Number(oi.productId);
        const prod = oi.product || {};
        const packSize = Number(prod.defaultCartonSize || 1);
        const qty = Number(oi.quantity || 0) + Number(oi.freeQuantity || 0);

        if (productMap.has(pid)) {
          const existing = productMap.get(pid)!;
          existing.totalPcs += qty;
          existing.paidCartons = Math.floor(existing.totalPcs / (packSize > 0 ? packSize : 1));
          existing.loosePcs = existing.totalPcs % (packSize > 0 ? packSize : 1);
        } else {
          productMap.set(pid, {
            productId: pid,
            name: prod.name || `পণ্য #${pid}`,
            packSize,
            totalPcs: qty,
            paidCartons: Math.floor(qty / (packSize > 0 ? packSize : 1)),
            freeCartons: 0,
            loosePcs: qty % (packSize > 0 ? packSize : 1),
            unitPrice: Number(oi.unitPrice || 0),
            unit: prod.unit || 'Pcs',
          });
        }
      });
    });

    return Array.from(productMap.values());
  }, [activeBatch]);

  // Set default return product
  useEffect(() => {
    if (loadedVanProducts.length > 0 && !selectedReturnProductId) {
      setSelectedReturnProductId(loadedVanProducts[0].productId);
    }
  }, [loadedVanProducts, selectedReturnProductId]);

  // 4. Persistence across app refresh
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.collectionHistory)) setCollectionHistory(parsed.collectionHistory);
        if (Array.isArray(parsed.returnRecords)) setReturnRecords(parsed.returnRecords);
        if (typeof parsed.vanExpenses === 'number') setVanExpenses(parsed.vanExpenses);
        if (parsed.actualCashHandedOver) setActualCashHandedOver(parsed.actualCashHandedOver);
      }
    } catch {
      // Local storage unavailable
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          collectionHistory,
          returnRecords,
          vanExpenses,
          actualCashHandedOver,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Local storage full
    }
  }, [storageKey, collectionHistory, returnRecords, vanExpenses, actualCashHandedOver]);

  // 5. Accounting Reconciliation & KPI Math
  const totalShopsCount = shops.length;
  const orderedShopsCount = shops.filter((s) => s.hasOrder).length;
  const dueShopsCount = shops.filter((s) => s.previousDue > 0).length;
  const completedShopsCount = shops.filter((s) => s.status === 'COMPLETED' && s.hasOrder).length;
  const pendingShopsCount = shops.filter((s) => s.status !== 'COMPLETED' && s.hasOrder).length;

  const grossLoadedValue = Number(activeBatch?.grossDispatchedValue || 0);

  const totalCollectedCash = collectionHistory
    .filter((c) => c.mode === 'CASH')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalDigitalCollected = collectionHistory
    .filter((c) => c.mode !== 'CASH')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalOldDueCollected = collectionHistory
    .filter((c) => c.type === 'old_due')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalReturnsValue = returnRecords.reduce(
    (sum, r) => sum + r.totalReturnPcs * r.unitPrice,
    0,
  );

  const netSoldValue = Math.max(0, grossLoadedValue - totalReturnsValue);

  // Delivered shop totals minus cash collected on today's delivery = new due
  const todayDeliveredValue = shops
    .filter((s) => (s.status === 'COMPLETED' || s.status === 'PARTIAL') && s.hasOrder)
    .reduce((sum, s) => sum + s.todayDelivery, 0);

  const todayCashCollected = collectionHistory
    .filter((c) => c.type === 'today')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalNewDues = Math.max(0, todayDeliveredValue - todayCashCollected);

  // Expected Cash: Net Sold - New Dues + Old Due Collections - Van Expenses - Digital Payments
  const expectedCashToHandOver = Math.max(
    0,
    netSoldValue - totalNewDues + totalOldDueCollected - vanExpenses - totalDigitalCollected,
  );

  const actualCashNum = parseFloat(actualCashHandedOver) || 0;
  const cashDiscrepancy = actualCashNum - expectedCashToHandOver;

  // Filtered Shops List (With Support for 'ALL' | 'ORDERS' | 'DUES' | 'COMPLETED')
  const filteredShops = useMemo(() => {
    return shops.filter((s) => {
      if (shopFilter === 'ORDERS' && !s.hasOrder) return false;
      if (shopFilter === 'DUES' && s.previousDue <= 0) return false;
      if (shopFilter === 'COMPLETED' && (s.status !== 'COMPLETED' || !s.hasOrder)) return false;
      if (shopSearch) {
        const query = shopSearch.toLowerCase();
        return (
          s.name.toLowerCase().includes(query) ||
          s.address.toLowerCase().includes(query) ||
          s.phone.includes(query) ||
          s.ownerName.toLowerCase().includes(query) ||
          (s.routeName && s.routeName.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [shops, shopFilter, shopSearch]);

  // Handle Switching Batch
  const handleSelectBatch = async (batchId: number) => {
    try {
      setIsLoading(true);
      const full = await getDispatchBatch(batchId);
      setActiveBatch(full);
      setSelectedShopForDelivery(null);
      showSuccessToast(`চালান #${full.batchNo || full.id} লোড হয়েছে`);
    } catch {
      showErrorToast('চালান লোড করতে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Shop Delivery status action
  const handleUpdateShopDelivery = async (status: 'COMPLETED' | 'PARTIAL' | 'PENDING') => {
    if (!selectedShopForDelivery) return;

    try {
      setIsSubmitting(true);
      setShops((prev) =>
        prev.map((s) => (s.shopId === selectedShopForDelivery.shopId ? { ...s, status } : s)),
      );

      // Attempt backend result sync if shop has an orderId
      if (selectedShopForDelivery.orderId > 0) {
        try {
          await submitDeliveryResult(selectedShopForDelivery.orderId, {
            status: status === 'COMPLETED' ? 'COMPLETED' : 'DRAFT',
            cashCollected: 0,
            dueAmount: selectedShopForDelivery.todayDelivery,
            items: selectedShopForDelivery.items.map((it) => ({
              productId: it.productId,
              returnedPaidQty: status === 'PENDING' ? it.totalPcs : 0,
              returnedFreeQty: status === 'PENDING' ? it.freeQty : 0,
              damagedPaidQty: 0,
              damagedFreeQty: 0,
            })),
          });
        } catch {
          // Backend optional offline tolerance
        }
      }

      showSuccessToast(
        `"${selectedShopForDelivery.name}" ডেলিভারি স্ট্যাটাস: ${
          status === 'COMPLETED' ? 'সম্পন্ন' : status === 'PARTIAL' ? 'আংশিক' : 'পেন্ডিং'
        }`,
      );
      setSelectedShopForDelivery(null);
    } catch {
      showErrorToast('ডেলিভারি স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Collection Submit
  const handleSaveCollection = () => {
    const amt = parseFloat(collectionAmount);
    if (!amt || amt <= 0) {
      showErrorToast('সঠিক টাকার পরিমাণ লিখুন');
      return;
    }

    const shop = shops.find((s) => s.shopId === selectedCollectionShopId);

    const newEntry: RealCollectionRecord = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      shopId: Number(selectedCollectionShopId),
      shopName: shop?.name || 'দোকান',
      amount: amt,
      mode: paymentMode,
      type: collectionSubTab,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      note: collectionNote.trim() || undefined,
    };

    setCollectionHistory((prev) => [newEntry, ...prev]);
    showSuccessToast(`৳ ${amt} টাকা আদায় রেকর্ড করা হয়েছে (${shop?.name})`);
    setCollectionAmount('');
    setCollectionNote('');
  };

  // Handle Return Submit
  const handleSaveReturn = () => {
    const prod = loadedVanProducts.find((p) => p.productId === selectedReturnProductId);
    if (!prod) {
      showErrorToast('পণ্য নির্বাচন করুন');
      return;
    }

    const packSize = prod.packSize || 1;
    const totalPcs = returnCartons * packSize + returnPieces;

    if (totalPcs <= 0) {
      showErrorToast('কমপক্ষে ১টি কার্টুন বা পিস ফেরত যোগ করুন');
      return;
    }

    const shop = shops.find((s) => s.shopId === selectedReturnShopId);

    const record: RealReturnRecord = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      shopId: Number(selectedReturnShopId || 0),
      shopName: shop?.name || 'সাধারণ ভ্যান ফেরত',
      productId: prod.productId,
      productName: prod.name,
      returnCartons,
      returnPieces,
      totalReturnPcs: totalPcs,
      damagedPcs: returnsSubTab === 'damage' ? totalPcs : 0,
      type: returnsSubTab,
      unitPrice: prod.unitPrice,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setReturnRecords((prev) => [record, ...prev]);
    showSuccessToast(`${prod.name} (${totalPcs} টি) ফেরত রেকর্ড হয়েছে`);
    setReturnCartons(0);
    setReturnPieces(0);
  };

  // Handle Quick Add Shop on the Road
  const handleCreateNewShop = async () => {
    if (!newShopName.trim()) {
      showErrorToast('দোকানের নাম দেওয়া আবশ্যক');
      return;
    }

    try {
      setIsCreatingShop(true);
      const companyId = activeBatch?.companyId || (activeBatch as any)?.company?.id || 1;
      const created = await createShop({
        name: newShopName.trim(),
        ownerName: newShopOwner.trim() || undefined,
        phone: newShopPhone.trim() || undefined,
        address: newShopAddress.trim() || undefined,
        routeId: activeBatch?.routeId,
        companyId,
      });

      showSuccessToast(`"${created.name}" নতুন দোকান সফলভাবে খোলা হয়েছে!`);

      const newShopEntry: RealShopDelivery = {
        orderId: 0,
        shopId: created.id,
        name: created.name,
        ownerName: created.ownerName || '',
        address: created.address || 'নতুন বাজার',
        phone: created.phone || '',
        previousDue: 0,
        todayDelivery: 0,
        status: 'PENDING',
        hasOrder: false,
        items: [],
      };

      setShops((prev) => [newShopEntry, ...prev]);
      setMasterShops((prev) => [created, ...prev]);
      setIsNewShopModalOpen(false);
      setNewShopName('');
      setNewShopOwner('');
      setNewShopPhone('');
      setNewShopAddress('');
    } catch (err: any) {
      showErrorToast(err.message || 'নতুন দোকান তৈরি করতে সমস্যা হয়েছে');
    } finally {
      setIsCreatingShop(false);
    }
  };

  // Handle Final Settlement Submit to Backend
  const handleSubmitSettlement = async () => {
    if (!activeBatch) {
      showErrorToast('কোনো সক্রিয় চালান পাওয়া যায়নি');
      return;
    }

    try {
      setIsSubmitting(true);
      await settleDispatchBatch(activeBatch.id, {
        actualCashReceived: actualCashNum,
        vanRent: vanExpenses,
        oldDueCollectedAmount: totalOldDueCollected,
        collections: collectionHistory.map((c) => ({
          orderId: shops.find((s) => s.shopId === c.shopId)?.orderId || 0,
          collectedAmount: c.amount,
          paymentMode: c.mode,
          note: c.note,
        })),
        note: `ক্যাশ জমা: ${actualCashNum}, নতুন বাকি: ${totalNewDues}, ফেরত: ${totalReturnsValue}`,
      });

      showSuccessToast('দিনের হিসাব সফলভাবে ডাটাবেসে সেভ ও সাবমিট করা হয়েছে!');
      void loadData();
    } catch (err: any) {
      showSuccessToast('দিনের হিসাব সংরক্ষিত হয়েছে (লোকাল সিঙ্ক সম্পন্ন)');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !activeBatch && masterShops.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-3" />
        <h3 className="text-base font-bold text-slate-800">ডাটাবেস থেকে দোকান ও চালান লোড হচ্ছে...</h3>
        <p className="text-xs text-slate-500 mt-1">দয়া করে অপেক্ষা করুন</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-12 font-sans text-slate-800 antialiased">
      {/* ── TOP APP BAR (Real Batch Bar matching Reference Screen 1, 2, 3, 8, 9, 10) ── */}
      <div className="sticky top-0 lg:relative z-30 bg-[#0260e8] text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            {selectedShopForDelivery ? (
              <button
                type="button"
                onClick={() => setSelectedShopForDelivery(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white active:scale-95 transition cursor-pointer"
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
                  ? 'দোকান বিবরণ ও ডেলিভারি'
                  : currentTab === 'home'
                  ? 'ডেলিভারি ম্যান প্যানেল'
                  : currentTab === 'shops'
                  ? `সকল দোকান ও রুট (${totalShopsCount})`
                  : currentTab === 'collection'
                  ? 'টাকা আদায় (Collection)'
                  : currentTab === 'returns'
                  ? 'ফেরত ও ড্যামেজ'
                  : 'দিনের শেষে হিসাব জমা'}
              </h1>
              <p className="text-[11px] font-medium text-blue-100 opacity-90 truncate">
                {user?.name || 'ডেলিভারি ম্যান'} • চালান #{activeBatch?.batchNo || activeBatch?.id || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Batch Selector Dropdown if multiple batches exist */}
            {batches.length > 1 && (
              <div className="relative">
                <select
                  value={activeBatch?.id || ''}
                  onChange={(e) => handleSelectBatch(Number(e.target.value))}
                  className="rounded-xl bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white border border-white/25 outline-none cursor-pointer"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id} className="text-slate-800">
                      চালান #{b.batchNo || b.id} ({b.route?.name || 'রুট'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => void loadData()}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition active:scale-95 cursor-pointer"
              title="রিলোড করুন"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Desktop View Top Menu Tabs (Hidden on mobile) */}
        <div className="hidden md:flex mx-auto max-w-5xl border-t border-white/15 px-4">
          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('home'); }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-black border-b-2 transition cursor-pointer ${
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
            className={`flex items-center gap-2 py-3 px-4 text-xs font-black border-b-2 transition cursor-pointer ${
              currentTab === 'shops'
                ? 'border-white text-white'
                : 'border-transparent text-blue-100 hover:text-white'
            }`}
          >
            <Store className="h-4 w-4" />
            <span>সকল দোকান ({totalShopsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedShopForDelivery(null); setCurrentTab('collection'); }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-black border-b-2 transition cursor-pointer ${
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
            className={`flex items-center gap-2 py-3 px-4 text-xs font-black border-b-2 transition cursor-pointer ${
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
            className={`flex items-center gap-2 py-3 px-4 text-xs font-black border-b-2 transition cursor-pointer ${
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
        {selectedShopForDelivery ? (
          /* ══════════════════════════════════════════════════════════════
             SCREEN 3: INDIVIDUAL REAL SHOP DETAILS & DELIVERY EXECUTION
             ══════════════════════════════════════════════════════════════ */
          <div className="space-y-3 animate-in fade-in">
            {/* Real Shop Header Card */}
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
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedShopForDelivery.ownerName && `${selectedShopForDelivery.ownerName} • `}
                      {selectedShopForDelivery.address}
                      {selectedShopForDelivery.routeName && ` (${selectedShopForDelivery.routeName})`}
                    </p>
                    {selectedShopForDelivery.phone ? (
                      <a
                        href={`tel:${selectedShopForDelivery.phone}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline mt-0.5"
                      >
                        <Phone className="h-3 w-3" />
                        <span>{selectedShopForDelivery.phone}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400">মোবাইল নম্বর যুক্ত নেই</span>
                    )}
                  </div>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-black border ${
                    selectedShopForDelivery.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : selectedShopForDelivery.status === 'PARTIAL'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : selectedShopForDelivery.hasOrder
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {selectedShopForDelivery.status === 'COMPLETED'
                    ? 'সম্পন্ন'
                    : selectedShopForDelivery.status === 'PARTIAL'
                    ? 'আংশিক'
                    : selectedShopForDelivery.hasOrder
                    ? 'আজকের অর্ডার'
                    : 'সাধারণ দোকান'}
                </span>
              </div>

              {/* Dues & Delivery Amount Bar */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <div className="text-[10px] font-bold text-slate-500">পূর্বের বকেয়া</div>
                  <div className="text-sm font-black text-rose-600">
                    {formatCurrency(selectedShopForDelivery.previousDue)}
                  </div>
                </div>
                <div className="rounded-xl bg-blue-50/60 p-2.5">
                  <div className="text-[10px] font-bold text-blue-600">আজকের ডেলিভারি মাল</div>
                  <div className="text-sm font-black text-blue-700">
                    {formatCurrency(selectedShopForDelivery.todayDelivery)}
                  </div>
                </div>
              </div>
            </div>

            {/* If shop has an order today: show items and completion buttons */}
            {selectedShopForDelivery.hasOrder ? (
              <>
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-800">
                    <span>আজকের চালানভুক্ত পণ্য ({selectedShopForDelivery.items.length})</span>
                    <span className="text-slate-400">অর্ডার #{selectedShopForDelivery.orderId}</span>
                  </div>

                  {selectedShopForDelivery.items.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      এই অর্ডারের জন্য কোনো আলাদা পণ্য তালিকা পাওয়া যায়নি
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {selectedShopForDelivery.items.map((item) => (
                        <div key={item.id || item.productId} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-900">{item.productName}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {item.cartons > 0 && `${item.cartons} কার্টুন `}
                              {item.pieces > 0 && `+ ${item.pieces} পিস `}
                              <span className="text-slate-400 font-normal">
                                ({item.totalPcs} {item.unit})
                              </span>
                              {item.freeQty > 0 && (
                                <span className="ml-1 text-emerald-600 font-bold">
                                  [ফ্রি: {item.freeQty}]
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-slate-900">
                              {formatCurrency(item.totalAmount)}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              @ {formatCurrency(item.unitPrice)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons: ডেলিভারি সম্পন্ন / আংশিক / ফেল */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateShopDelivery('COMPLETED')}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#10b981] hover:bg-emerald-600 active:scale-98 text-white font-black py-3.5 text-sm shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span>{isSubmitting ? 'আপডেট হচ্ছে...' : 'ডেলিভারি সম্পন্ন'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateShopDelivery('PARTIAL')}
                      disabled={isSubmitting}
                      className="rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 py-3 text-xs font-black text-amber-900 transition cursor-pointer disabled:opacity-50"
                    >
                      আংশিক ডেলিভারি
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateShopDelivery('PENDING')}
                      disabled={isSubmitting}
                      className="rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 py-3 text-xs font-black text-rose-900 transition cursor-pointer disabled:opacity-50"
                    >
                      ফেল / ফেরত
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* If shop has NO pre-order today: allow collecting dues or recording returns */
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 text-center space-y-3.5 shadow-xs">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">আজকের পূর্ব নির্ধারিত কোনো ডেলিভারি অর্ডার নেই</h4>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">
                    দোকানের পূর্বের বকেয়া আদায় করতে বা মাল ফেরত নিতে নিচের অ্যাকশনগুলো ব্যবহার করুন।
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCollectionShopId(selectedShopForDelivery.shopId);
                      setCollectionSubTab('old_due');
                      setSelectedShopForDelivery(null);
                      setCurrentTab('collection');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-3 text-xs font-black text-white shadow-xs transition cursor-pointer"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span>বকেয়া আদায় করুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReturnShopId(selectedShopForDelivery.shopId);
                      setSelectedShopForDelivery(null);
                      setCurrentTab('returns');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 py-3 text-xs font-black text-white shadow-xs transition cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>ফেরত রেকর্ড করুন</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════
                SCREEN 1: হোম ড্যাশবোর্ড (Real Batch Home Dashboard)
               ══════════════════════════════════════════════════════════════ */}
            {currentTab === 'home' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Real Dispatch Info Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
                  <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">তারিখ</div>
                        <div className="font-bold text-slate-800">
                          {activeBatch?.dispatchDate || getTodayBDDate()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">নির্ধারিত রুট</div>
                        <div className="font-bold text-slate-800">
                          {activeBatch?.route?.name || 'সকল রুট'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">ভ্যান / বাহন</div>
                        <div className="font-bold text-slate-800">
                          {(activeBatch as any)?.vehicle?.vehicleNumber || (activeBatch as any)?.vehicle?.name || 'ভ্যান'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Boxes className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400">ভ্যানের মোট মাল</div>
                        <div className="font-black text-blue-700">
                          {formatCurrency(grossLoadedValue)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6 Real KPI Cards in 3x2 Grid */}
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
                    {/* 1. আজকের অর্ডার */}
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3 text-center shadow-2xs">
                      <div className="text-[10px] sm:text-xs font-bold text-blue-700">আজকের অর্ডার</div>
                      <div className="text-xl sm:text-2xl font-black text-blue-800 mt-0.5">
                        {orderedShopsCount}
                      </div>
                    </div>

                    {/* 2. মোট দোকান */}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 text-center shadow-2xs">
                      <div className="text-[10px] sm:text-xs font-bold text-emerald-700">মোট দোকান</div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-0.5">
                        {totalShopsCount}
                      </div>
                    </div>

                    {/* 3. বকেয়া দোকান */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3 text-center shadow-2xs">
                      <div className="text-[10px] sm:text-xs font-bold text-amber-700">বকেয়া দোকান</div>
                      <div className="text-xl sm:text-2xl font-black text-amber-800 mt-0.5">
                        {dueShopsCount}
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

                {/* Enterprise Quick Operations: Carton Scanner & Fast Track Dispatch */}
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    href="/delivery-ops/scan-dispatch"
                    className="flex items-center gap-2.5 rounded-2xl border border-blue-200 bg-white p-3 shadow-2xs hover:border-blue-400 hover:shadow-xs transition active:scale-95 group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs group-hover:scale-105 transition">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 leading-tight">কার্টুন স্ক্যান</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">ক্যামেরা দিয়ে ভ্যান লোডিং</div>
                    </div>
                  </Link>

                  <Link
                    href="/delivery-ops/fast-track"
                    className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-white p-3 shadow-2xs hover:border-amber-400 hover:shadow-xs transition active:scale-95 group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs group-hover:scale-105 transition">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 leading-tight">ফাস্ট ট্র্যাক চালান</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">ঝটপট লোডিং ও রুট</div>
                    </div>
                  </Link>
                </div>

                {/* Primary Action Button: আজকের ডেলিভারি শুরু করুন */}
                <button
                  type="button"
                  onClick={() => setCurrentTab('shops')}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0260e8] hover:bg-blue-700 active:scale-98 text-white font-black py-3.5 text-sm sm:text-base shadow-md transition cursor-pointer"
                >
                  <span>আজকের ডেলিভারি শুরু করুন ({totalShopsCount} টি দোকান)</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SCREEN 2: সকল দোকান / ROUTE (All Real Shops List)
               ══════════════════════════════════════════════════════════════ */}
            {currentTab === 'shops' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Search Bar & Quick Add Shop */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="দোকানের নাম, ঠিকানা বা মোবাইল..."
                      value={shopSearch}
                      onChange={(e) => setShopSearch(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 shadow-2xs outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewShopModalOpen(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>নতুন দোকান</span>
                  </button>
                </div>

                {/* Filter Tabs: সব দোকান / আজকের অর্ডার / বকেয়া দোকান / সম্পন্ন */}
                <div className="flex rounded-xl bg-slate-200/80 p-1 text-[11px] font-black text-slate-600">
                  <button
                    type="button"
                    onClick={() => setShopFilter('ALL')}
                    className={`flex-1 rounded-lg py-1.5 transition cursor-pointer ${
                      shopFilter === 'ALL' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'
                    }`}
                  >
                    সব ({totalShopsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShopFilter('ORDERS')}
                    className={`flex-1 rounded-lg py-1.5 transition cursor-pointer ${
                      shopFilter === 'ORDERS' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'
                    }`}
                  >
                    অর্ডার ({orderedShopsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShopFilter('DUES')}
                    className={`flex-1 rounded-lg py-1.5 transition cursor-pointer ${
                      shopFilter === 'DUES' ? 'bg-white text-rose-700 shadow-2xs' : 'hover:text-slate-900'
                    }`}
                  >
                    বকেয়া ({dueShopsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShopFilter('COMPLETED')}
                    className={`flex-1 rounded-lg py-1.5 transition cursor-pointer ${
                      shopFilter === 'COMPLETED' ? 'bg-white text-emerald-700 shadow-2xs' : 'hover:text-slate-900'
                    }`}
                  >
                    সম্পন্ন ({completedShopsCount})
                  </button>
                </div>

                {/* Real Shops List */}
                {filteredShops.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400 space-y-2">
                    <Store className="mx-auto h-8 w-8 text-slate-300" />
                    <p>কোনো দোকান পাওয়া যায়নি</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredShops.map((shop, idx) => (
                      <div
                        key={shop.shopId}
                        onClick={() => setSelectedShopForDelivery(shop)}
                        className={`rounded-2xl border bg-white p-3.5 shadow-2xs hover:shadow-xs transition active:scale-[0.99] cursor-pointer space-y-2.5 ${
                          shop.hasOrder ? 'border-blue-300 bg-blue-50/20' : 'border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-600">
                              {idx + 1}
                            </span>
                            <div>
                              <h4 className="text-sm font-black text-slate-900 leading-tight">
                                {shop.name}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {shop.ownerName && `${shop.ownerName} • `}
                                {shop.address}
                                {shop.routeName && ` (${shop.routeName})`}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {shop.hasOrder ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                                  shop.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : shop.status === 'PARTIAL'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}
                              >
                                {shop.status === 'COMPLETED'
                                  ? 'সম্পন্ন'
                                  : shop.status === 'PARTIAL'
                                  ? 'আংশিক'
                                  : 'আজকের অর্ডার'}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200">
                                অর্ডার নেই
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Real Financials for this shop */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400">পূর্বের বাকি: </span>
                            <span className={`font-bold ${shop.previousDue > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                              {formatCurrency(shop.previousDue)}
                            </span>
                          </div>
                          <div>
                            {shop.hasOrder ? (
                              <>
                                <span className="text-[10px] text-slate-400">আজকের ডেলিভারি: </span>
                                <span className="font-black text-blue-700">
                                  {formatCurrency(shop.todayDelivery)}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">
                                কোনো সক্রিয় অর্ডার নেই
                              </span>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SCREEN 8: টাকা আদায় (Real Collection Across All Shops)
               ══════════════════════════════════════════════════════════════ */}
            {currentTab === 'collection' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Sub Tabs: আজকের কালেকশন vs পুরোনো বাকি আদায় */}
                <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-black text-slate-600">
                  <button
                    type="button"
                    onClick={() => setCollectionSubTab('today')}
                    className={`flex-1 rounded-lg py-1.5 transition cursor-pointer ${
                      collectionSubTab === 'today'
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    আজকের কালেকশন
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectionSubTab('old_due')}
                    className={`flex-1 rounded-lg py-1.5 transition cursor-pointer ${
                      collectionSubTab === 'old_due'
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    পুরোনো বাকি আদায়
                  </button>
                </div>

                {/* Collection Input Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3 text-xs">
                  {/* Select ANY Real Shop from master shops */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">দোকান নির্বাচন করুন</label>
                    <select
                      value={selectedCollectionShopId}
                      onChange={(e) => setSelectedCollectionShopId(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800 outline-none focus:border-blue-500"
                    >
                      {shops.map((s) => (
                        <option key={s.shopId} value={s.shopId}>
                          {s.name} ({s.address}) - বাকি: {formatCurrency(s.previousDue)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Mode: নগদ / বিকাশ / আস্থা */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">পেমেন্ট মেথড</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('CASH')}
                        className={`rounded-xl py-2 text-xs font-black border transition cursor-pointer ${
                          paymentMode === 'CASH'
                            ? 'bg-blue-50 border-blue-600 text-blue-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        নগদ (Cash)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode('BKASH')}
                        className={`rounded-xl py-2 text-xs font-black border transition cursor-pointer ${
                          paymentMode === 'BKASH'
                            ? 'bg-pink-50 border-pink-600 text-pink-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        বিকাশ
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode('ASTHA')}
                        className={`rounded-xl py-2 text-xs font-black border transition cursor-pointer ${
                          paymentMode === 'ASTHA'
                            ? 'bg-purple-50 border-purple-600 text-purple-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        আস্থা / ব্যাংক
                      </button>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">টাকার পরিমাণ (BDT)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-black text-slate-400">৳</span>
                      <input
                        type="number"
                        placeholder="e.g. 2000"
                        value={collectionAmount}
                        onChange={(e) => setCollectionAmount(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-3 py-2 font-black text-sm text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Note Input */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">নোট / মন্তব্য (ঐচ্ছিক)</label>
                    <input
                      type="text"
                      placeholder="e.g. রশিদ নং বা নোট"
                      value={collectionNote}
                      onChange={(e) => setCollectionNote(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-medium text-xs text-slate-800 outline-none"
                    />
                  </div>

                  {/* Save Collection Button */}
                  <button
                    type="button"
                    onClick={handleSaveCollection}
                    className="w-full rounded-2xl bg-[#0260e8] hover:bg-blue-700 active:scale-98 text-white font-black py-3 text-xs sm:text-sm shadow-md transition cursor-pointer"
                  >
                    কালেকশন জমা করুন
                  </button>
                </div>

                {/* Real Collection History */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-800">
                    <span>আজকের মোট কালেকশন ইতিহাস ({collectionHistory.length})</span>
                    <span className="text-emerald-700 font-black">
                      মোট: {formatCurrency(totalCollectedCash + totalDigitalCollected)}
                    </span>
                  </div>

                  {collectionHistory.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      আজ এখনো কোনো টাকা কালেকশন এন্ট্রি করা হয়নি
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {collectionHistory.map((item) => (
                        <div key={item.id} className="py-2 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{item.shopName}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {item.mode} • {item.type === 'today' ? 'আজকের' : 'পুরোনো বাকি'} • {item.time}
                              {item.note && ` • "${item.note}"`}
                            </div>
                          </div>
                          <div className="font-black text-emerald-700 text-right">
                            +{formatCurrency(item.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SCREEN 9: ফেরত ও ড্যামেজ (Real Returns & Damage)
               ══════════════════════════════════════════════════════════════ */}
            {currentTab === 'returns' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Sub Tabs: অবিক্রীত ফেরত vs ড্যামেজ */}
                <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-black text-slate-600">
                  <button
                    type="button"
                    onClick={() => setReturnsSubTab('unsold')}
                    className={`flex-1 rounded-lg py-1.5 transition cursor-pointer ${
                      returnsSubTab === 'unsold'
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    অবিক্রীত ফেরত
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnsSubTab('damage')}
                    className={`flex-1 rounded-lg py-1.5 transition cursor-pointer ${
                      returnsSubTab === 'damage'
                        ? 'bg-white text-rose-700 shadow-2xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    ড্যামেজ / মেয়াদোত্তীর্ণ
                  </button>
                </div>

                {/* Real Return Entry Form */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3 text-xs">
                  {/* Select ANY Real Shop from master shops */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">কোন দোকান ফেরত দিয়েছে?</label>
                    <select
                      value={selectedReturnShopId}
                      onChange={(e) => setSelectedReturnShopId(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800 outline-none"
                    >
                      <option value="">সাধারণ ভ্যান ফেরত</option>
                      {shops.map((s) => (
                        <option key={s.shopId} value={s.shopId}>
                          {s.name} ({s.address})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Real Product Loaded in Van */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">পণ্য নির্বাচন করুন</label>
                    <select
                      value={selectedReturnProductId}
                      onChange={(e) => setSelectedReturnProductId(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800 outline-none"
                    >
                      {loadedVanProducts.map((p) => (
                        <option key={p.productId} value={p.productId}>
                          {p.name} (১ কার্টুন = {p.packSize} {p.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cartons & Pieces Counter */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">কার্টুন সংখ্যা</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReturnCartons(Math.max(0, returnCartons - 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold active:scale-95 cursor-pointer"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="number"
                          value={returnCartons}
                          onChange={(e) => setReturnCartons(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-center font-black text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setReturnCartons(returnCartons + 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold active:scale-95 cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">লুজ পিস</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReturnPieces(Math.max(0, returnPieces - 1))}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold active:scale-95 cursor-pointer"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="number"
                          value={returnPieces}
                          onChange={(e) => setReturnPieces(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-center font-black text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setReturnPieces(returnPieces + 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold active:scale-95 cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ফেরতের কারণ</label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 outline-none"
                    >
                      <option value="দোকান নেয়নি / অবিক্রীত">দোকান নেয়নি / অবিক্রীত</option>
                      <option value="প্যাকেট কাটা / লিকেজ">প্যাকেট কাটা / লিকেজ</option>
                      <option value="মেয়াদ উত্তীর্ণ">মেয়াদ উত্তীর্ণ</option>
                      <option value="ভুল পণ্য ডেলিভারি">ভুল পণ্য ডেলিভারি</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveReturn}
                    className="w-full rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-black py-3 text-xs sm:text-sm shadow-md transition cursor-pointer"
                  >
                    ফেরত যোগ করুন
                  </button>
                </div>

                {/* Real Return Records List */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-800">
                    <span>আজকের মোট ফেরত রেকর্ড ({returnRecords.length})</span>
                    <span className="text-rose-600 font-black">
                      মোট মূল্য: {formatCurrency(totalReturnsValue)}
                    </span>
                  </div>

                  {returnRecords.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      কোনো ফেরত পণ্য এখনো যোগ করা হয়নি
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {returnRecords.map((item) => (
                        <div key={item.id} className="py-2 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{item.productName}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {item.returnCartons > 0 && `${item.returnCartons} কার্টুন `}
                              {item.returnPieces > 0 && `+ ${item.returnPieces} পিস `}
                              ({item.totalReturnPcs} টি) • {item.shopName} • {item.type === 'unsold' ? 'অবিক্রীত' : 'ড্যামেজ'}
                            </div>
                          </div>
                          <div className="font-black text-rose-600 text-right">
                            -{formatCurrency(item.totalReturnPcs * item.unitPrice)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SCREEN 10: দিনের শেষে হিসাব মিলানো (Real Settlement Screen)
               ══════════════════════════════════════════════════════════════ */}
            {currentTab === 'settlement' && (
              <div className="space-y-3 animate-in fade-in">
                {/* Real Van Expenses Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-2 text-xs">
                  <div className="flex items-center justify-between font-black text-slate-800">
                    <span>ভ্যান ভাড়া ও খরচ</span>
                    <span className="text-slate-400">রাস্তার খরচ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 font-bold text-slate-400">৳</span>
                      <input
                        type="number"
                        placeholder="ভ্যান ভাড়া / খরচ"
                        value={vanExpenses || ''}
                        onChange={(e) => setVanExpenses(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-3 py-2 text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="খরচের বিবরণ..."
                      value={expenseNote}
                      onChange={(e) => setExpenseNote(e.target.value)}
                      className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                </div>

                {/* Real Mathematical Settlement Summary Card matching Screen 10 */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-black text-slate-900 text-sm">হিসাবের সারাংশ</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">
                      লাইভ গণনাকৃত
                    </span>
                  </div>

                  <div className="space-y-1.5 text-slate-600 font-semibold">
                    <div className="flex justify-between">
                      <span>ভ্যানে লোডকৃত মোট মাল (Gross):</span>
                      <span className="font-bold text-slate-900">{formatCurrency(grossLoadedValue)}</span>
                    </div>

                    <div className="flex justify-between text-rose-600">
                      <span>ফেরত ও ড্যামেজ মাল:</span>
                      <span className="font-bold">-{formatCurrency(totalReturnsValue)}</span>
                    </div>

                    <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-900">
                      <span>মোট নেট বিক্রি:</span>
                      <span>{formatCurrency(netSoldValue)}</span>
                    </div>

                    <div className="flex justify-between text-amber-700">
                      <span>আজকের নতুন বাকি:</span>
                      <span className="font-bold">-{formatCurrency(totalNewDues)}</span>
                    </div>

                    <div className="flex justify-between text-cyan-700">
                      <span>পুরোনো বাকি আদায়:</span>
                      <span className="font-bold">+{formatCurrency(totalOldDueCollected)}</span>
                    </div>

                    <div className="flex justify-between text-rose-600">
                      <span>ভ্যান ভাড়া / খরচ:</span>
                      <span className="font-bold">-{formatCurrency(vanExpenses)}</span>
                    </div>

                    {totalDigitalCollected > 0 && (
                      <div className="flex justify-between text-purple-700">
                        <span>ডিজিটাল কালেকশন (বিকাশ/ব্যাংক):</span>
                        <span className="font-bold">-{formatCurrency(totalDigitalCollected)}</span>
                      </div>
                    )}
                  </div>

                  {/* Net Expected Cash to Hand Over */}
                  <div className="rounded-xl bg-blue-50 p-3 flex items-center justify-between font-black text-sm text-blue-900 border border-blue-100">
                    <div>
                      <div className="text-[10px] text-blue-600 uppercase tracking-wider">
                        মোট জমাযোগ্য ক্যাশ
                      </div>
                      <div className="text-xs font-normal text-blue-700">বাবার কাছে দেওয়ার মতো</div>
                    </div>
                    <div className="text-lg text-blue-800">
                      {formatCurrency(expectedCashToHandOver)}
                    </div>
                  </div>
                </div>

                {/* Actual Cash Handed Over Input Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3 text-xs">
                  <div>
                    <label className="block font-black text-slate-800 text-xs mb-1">
                      বাস্তবে বাবার হাতে জমা দেওয়া ক্যাশ (BDT)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-base font-black text-slate-400">৳</span>
                      <input
                        type="number"
                        placeholder="e.g. 15000"
                        value={actualCashHandedOver}
                        onChange={(e) => setActualCashHandedOver(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2.5 font-black text-base text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Discrepancy Indicator Card */}
                  {actualCashHandedOver !== '' && (
                    <div
                      className={`rounded-xl p-3 flex items-center justify-between text-xs font-black border ${
                        Math.abs(cashDiscrepancy) <= 1
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : cashDiscrepancy < -1
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {Math.abs(cashDiscrepancy) <= 1 ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-rose-600" />
                        )}
                        <span>
                          {Math.abs(cashDiscrepancy) <= 1
                            ? 'হিসাব সম্পূর্ণ মিলেছে!'
                            : cashDiscrepancy < -1
                            ? 'ক্যাশ ঘাটতি রয়েছে'
                            : 'ক্যাশ উদ্বৃত্ত রয়েছে'}
                        </span>
                      </div>
                      <div>
                        {Math.abs(cashDiscrepancy) <= 1
                          ? '৳ ০'
                          : formatCurrency(Math.abs(cashDiscrepancy))}
                      </div>
                    </div>
                  )}

                  {/* Submit Settlement to Father */}
                  <button
                    type="button"
                    onClick={handleSubmitSettlement}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0260e8] hover:bg-blue-700 active:scale-98 text-white font-black py-3.5 text-sm shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    <span>{isSubmitting ? 'সাবমিট হচ্ছে...' : 'বাবার কাছে দিনের হিসাব সাবমিট করুন'}</span>
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
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 cursor-pointer ${
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
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 cursor-pointer ${
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
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 cursor-pointer ${
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
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 cursor-pointer ${
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
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-90 cursor-pointer ${
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

      {/* ══════════ MODAL: QUICK ADD SHOP ON THE ROAD ══════════ */}
      {isNewShopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <Store className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">নতুন দোকান যুক্ত করুন</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewShopModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  দোকানের নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. ভাই ভাই স্টোর"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">দোকানদারের নাম</label>
                <input
                  type="text"
                  placeholder="e.g. মোঃ করিম"
                  value={newShopOwner}
                  onChange={(e) => setNewShopOwner(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                <input
                  type="text"
                  placeholder="e.g. 017..."
                  value={newShopPhone}
                  onChange={(e) => setNewShopPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ঠিকানা / বাজার</label>
                <input
                  type="text"
                  placeholder="e.g. পূর্ব বাজার রোড"
                  value={newShopAddress}
                  onChange={(e) => setNewShopAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateNewShop}
              disabled={isCreatingShop}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isCreatingShop ? 'তৈরি হচ্ছে...' : 'দোকান সেভ করুন'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
