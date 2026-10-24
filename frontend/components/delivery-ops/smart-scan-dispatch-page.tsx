'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Barcode,
  Scan,
  Truck,
  Calendar,
  MapPin,
  User,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Camera,
  RefreshCw,
  Printer,
  ArrowLeft,
  Package,
  Layers,
  Sparkles,
  ShieldAlert,
  FileText,
  X,
  Gift,
  HelpCircle,
  ChevronDown,
  Info,
} from 'lucide-react';

import { getRoutes } from '@/lib/api/routes';
import { getProducts, scanCarton } from '@/lib/api/products';
import { getDeliveryMen } from '@/lib/api/users';
import { getStockSummary } from '@/lib/api/stock';
import { createOrder } from '@/lib/api/orders';
import { createDispatchBatch } from '@/lib/api/delivery-ops';
import { LoadingBlock } from '@/components/ui/loading-block';
import { useToast } from '@/components/ui/toast-provider';
import { formatCurrency, formatNumber, getTodayBDDate } from '@/lib/utils/format';
import type { Route, Product, User as UserType } from '@/types/api';

interface ScannedItemRow {
  productId: number;
  productName: string;
  sku: string;
  companyName: string;
  companyId: number;
  unit: string;
  currentStock: number;
  packSize: number;
  cartonCount: number; // Regular paid cartons
  loosePieces: number; // Regular paid loose pieces
  freeCartons: number; // Free cartons scanned in Free Mode
  freePieces: number;  // Total free pieces
  freeSchemeBuyQty: number;
  freeSchemeFreeQty: number;
  unitPrice: number;
  scannedCartonCodes: string[];
  scannedFreeCartonCodes: string[];
  lastScannedAt?: string;
  lastScannedMode?: 'REGULAR' | 'FREE';
}

const DRAFT_STORAGE_KEY = 'morning_loading_scan_draft_v3';

function playBeep(type: 'success' | 'free_success' | 'warning' | 'error' = 'success') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'free_success') {
      // Cheerful two-tone chime for FREE item
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
      osc.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // AudioContext blocked before gesture
  }
}

export function SmartScanDispatchPage() {
  const router = useRouter();
  const { error: showErrorToast, success: showSuccessToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Master Data
  const [routes, setRoutes] = useState<Route[]>([]);
  const [deliveryMen, setDeliveryMen] = useState<UserType[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<number, number>>({});

  // Dispatch Setup
  const [dispatchDate, setDispatchDate] = useState(() => getTodayBDDate());
  const [routeId, setRouteId] = useState<number | ''>('');
  const [routeSearch, setRouteSearch] = useState('');
  const [showRouteResults, setShowRouteResults] = useState(false);
  const [assignedDeliveryManId, setAssignedDeliveryManId] = useState('');
  const [vehicleNote, setVehicleNote] = useState('');

  // Scanning Mode: REGULAR vs FREE
  const [scanMode, setScanMode] = useState<'REGULAR' | 'FREE'>('REGULAR');

  // Scanning Input & Feedback
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [lastScanMessage, setLastScanMessage] = useState<{
    text: string;
    type: 'success' | 'free_success' | 'warning' | 'error';
    time: string;
  } | null>(null);

  // Scanned Rows
  const [items, setItems] = useState<ScannedItemRow[]>([]);
  const [recentlyScannedProductId, setRecentlyScannedProductId] = useState<number | null>(null);

  // Camera Scanner modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // Keystroke wedge buffer for hardware scanner guns
  const scanBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // 1. Load Master Data
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const [routesData, deliveryMenData, productsResp, stockData] = await Promise.all([
          getRoutes().catch(() => []),
          getDeliveryMen().catch(() => []),
          getProducts({ limit: 500, isActive: true }).catch(() => ({ items: [], total: 0 })),
          getStockSummary().catch(() => []),
        ]);

        setRoutes(Array.isArray(routesData) ? routesData : []);
        setDeliveryMen(Array.isArray(deliveryMenData) ? deliveryMenData : []);

        const productList: Product[] = Array.isArray(productsResp)
          ? productsResp
          : productsResp.items || [];
        setAllProducts(productList);

        const sMap: Record<number, number> = {};
        if (Array.isArray(stockData)) {
          stockData.forEach((s: any) => {
            sMap[Number(s.productId)] = Number(s.currentStock || 0);
          });
        }
        setStockMap(sMap);

        // Load saved draft
        try {
          const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
          if (savedDraft) {
            const parsed = JSON.parse(savedDraft);
            if (parsed.dispatchDate) setDispatchDate(parsed.dispatchDate);
            if (parsed.routeId) {
              setRouteId(parsed.routeId);
              const foundRoute = routesData.find((r: Route) => r.id === parsed.routeId);
              if (foundRoute) setRouteSearch(foundRoute.name);
            }
            if (parsed.assignedDeliveryManId) setAssignedDeliveryManId(parsed.assignedDeliveryManId);
            if (parsed.vehicleNote) setVehicleNote(parsed.vehicleNote);
            if (Array.isArray(parsed.items)) setItems(parsed.items);
            if (parsed.scanMode) setScanMode(parsed.scanMode);
          }
        } catch {
          // Ignore parse errors
        }
      } catch (err: any) {
        showErrorToast(err.message || 'মাস্টার ডাটা লোড করতে সমস্যা হয়েছে');
      } finally {
        setIsLoading(false);
      }
    }

    void init();
  }, []);

  // 2. Auto-save Draft
  useEffect(() => {
    if (isLoading) return;
    try {
      const draft = {
        dispatchDate,
        routeId,
        assignedDeliveryManId,
        vehicleNote,
        items,
        scanMode,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage unavailable
    }
  }, [dispatchDate, routeId, assignedDeliveryManId, vehicleNote, items, scanMode, isLoading]);

  // 3. Process Scanned Barcode / Carton Code
  const processBarcodeScan = useCallback(
    async (codeToProcess: string) => {
      const cleanCode = codeToProcess.trim();
      if (!cleanCode) return;

      setIsScanningActive(true);

      // Check for duplicate carton code across current loaded items
      const isDuplicateCarton = items.some((item) =>
        item.scannedCartonCodes.includes(cleanCode),
      );

      if (isDuplicateCarton) {
        playBeep('warning');
        setLastScanMessage({
          text: `সতর্কতা: "${cleanCode}" কার্টুনটি ইতিমধ্যে লোড করা হয়েছে! (Duplicate Scan Prevented)`,
          type: 'warning',
          time: new Date().toLocaleTimeString(),
        });
        setIsScanningActive(false);
        return;
      }

      try {
        const scanRes = await scanCarton(cleanCode);

        if (!scanRes.found || !scanRes.product) {
          playBeep('error');
          setLastScanMessage({
            text: `বারকোড "${cleanCode}" পাওয়া যায়নি! পণ্যের নাম বা কোড চেক করুন।`,
            type: 'error',
            time: new Date().toLocaleTimeString(),
          });
          setIsScanningActive(false);
          return;
        }

        const product = scanRes.product;
        const packSize = Number(scanRes.packSize || product.defaultCartonSize || 6);
        const buyQty = Number(product.freeSchemeBuyQty || 0);
        const freeQty = Number(product.freeSchemeFreeQty || 0);

        setRecentlyScannedProductId(product.id);
        setTimeout(() => setRecentlyScannedProductId(null), 1200);

        // FREE SCAN MODE LOGIC:
        if (scanMode === 'FREE') {
          playBeep('free_success');

          setItems((prevItems) => {
            const existingIndex = prevItems.findIndex((it) => it.productId === product.id);

            if (existingIndex >= 0) {
              const updated = [...prevItems];
              const existing = updated[existingIndex];
              const newFreeCartons = (existing.freeCartons || 0) + 1;
              const newFreePieces = existing.freePieces + packSize;

              updated[existingIndex] = {
                ...existing,
                freeCartons: newFreeCartons,
                freePieces: newFreePieces,
                scannedCartonCodes: [...existing.scannedCartonCodes, cleanCode],
                scannedFreeCartonCodes: [...(existing.scannedFreeCartonCodes || []), cleanCode],
                lastScannedAt: new Date().toLocaleTimeString(),
                lastScannedMode: 'FREE',
              };
              return updated;
            } else {
              const newRow: ScannedItemRow = {
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                companyName: product.company?.name || 'Unknown',
                companyId: product.companyId,
                unit: product.unit || 'PCS',
                currentStock: stockMap[product.id] || Number(product.currentStock || 0),
                packSize: packSize,
                cartonCount: 0,
                loosePieces: 0,
                freeCartons: 1,
                freePieces: packSize,
                freeSchemeBuyQty: buyQty,
                freeSchemeFreeQty: freeQty,
                unitPrice: Number(product.salePrice || 0),
                scannedCartonCodes: [cleanCode],
                scannedFreeCartonCodes: [cleanCode],
                lastScannedAt: new Date().toLocaleTimeString(),
                lastScannedMode: 'FREE',
              };
              return [newRow, ...prevItems];
            }
          });

          setLastScanMessage({
            text: `🎁 ফ্রি স্ক্যান সফল: ${product.name} (ফ্রি ঘরে +১ কার্টুন = ${packSize} পিস যোগ হয়েছে)`,
            type: 'free_success',
            time: new Date().toLocaleTimeString(),
          });
          setIsScanningActive(false);
          return;
        }

        // REGULAR PAID SCAN MODE LOGIC:
        playBeep('success');

        setItems((prevItems) => {
          const existingIndex = prevItems.findIndex((it) => it.productId === product.id);

          if (existingIndex >= 0) {
            const updated = [...prevItems];
            const existing = updated[existingIndex];
            const newCartonCount = existing.cartonCount + 1;

            updated[existingIndex] = {
              ...existing,
              cartonCount: newCartonCount,
              scannedCartonCodes: [...existing.scannedCartonCodes, cleanCode],
              lastScannedAt: new Date().toLocaleTimeString(),
              lastScannedMode: 'REGULAR',
            };
            return updated;
          } else {
            const newRow: ScannedItemRow = {
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              companyName: product.company?.name || 'Unknown',
              companyId: product.companyId,
              unit: product.unit || 'PCS',
              currentStock: stockMap[product.id] || Number(product.currentStock || 0),
              packSize: packSize,
              cartonCount: 1,
              loosePieces: 0,
              freeCartons: 0,
              freePieces: 0,
              freeSchemeBuyQty: buyQty,
              freeSchemeFreeQty: freeQty,
              unitPrice: Number(product.salePrice || 0),
              scannedCartonCodes: [cleanCode],
              scannedFreeCartonCodes: [],
              lastScannedAt: new Date().toLocaleTimeString(),
              lastScannedMode: 'REGULAR',
            };
            return [newRow, ...prevItems];
          }
        });

        setLastScanMessage({
          text: `📦 নিয়মিত স্ক্যান সফল: ${product.name} (+১ পেইড কার্টুন = ${packSize} পিস)`,
          type: 'success',
          time: new Date().toLocaleTimeString(),
        });
      } catch (err: any) {
        playBeep('error');
        setLastScanMessage({
          text: `স্ক্যান এরর: ${err.message || 'স্ক্যান সম্পন্ন করা যায়নি'}`,
          type: 'error',
          time: new Date().toLocaleTimeString(),
        });
      } finally {
        setIsScanningActive(false);
      }
    },
    [items, stockMap, scanMode],
  );

  // 4. Global Hardware Scanner Gun & F2 Shortcut Keydown Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 hotkey to toggle between Regular Scan and Free Scan
      if (e.key === 'F2') {
        e.preventDefault();
        setScanMode((prev) => (prev === 'REGULAR' ? 'FREE' : 'REGULAR'));
        return;
      }

      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';

      // If user is focused on the barcode input box and hits Enter
      if (activeEl === barcodeInputRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const code = barcodeInput.trim();
          setBarcodeInput('');
          if (code) void processBarcodeScan(code);
        }
        return;
      }

      if (isInput) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (scanBufferRef.current.length >= 3) {
          const barcode = scanBufferRef.current.trim();
          scanBufferRef.current = '';
          void processBarcodeScan(barcode);
        }
        scanBufferRef.current = '';
        return;
      }

      if (timeDiff > 100) {
        scanBufferRef.current = '';
      }

      if (e.key.length === 1) {
        scanBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeInput, processBarcodeScan]);

  // 5. Quantity & Free Adjustments
  const handleUpdateCartons = (productId: number, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const newCount = Math.max(0, item.cartonCount + delta);
        return {
          ...item,
          cartonCount: newCount,
        };
      }),
    );
  };

  const handleUpdateLoose = (productId: number, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const newLoose = Math.max(0, item.loosePieces + delta);
        return {
          ...item,
          loosePieces: newLoose,
        };
      }),
    );
  };

  const handleSetLoose = (productId: number, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        return {
          ...item,
          loosePieces: num,
        };
      }),
    );
  };

  const handleUpdateFreePieces = (productId: number, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const newFree = Math.max(0, item.freePieces + delta);
        return { ...item, freePieces: newFree };
      }),
    );
  };

  const handleSetFree = (productId: number, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        return { ...item, freePieces: num };
      }),
    );
  };

  const handleSetPrice = (productId: number, val: string) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        return { ...item, unitPrice: num };
      }),
    );
  };

  const handleDeleteRow = (productId: number) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  const handleClearAll = () => {
    if (window.confirm('আপনি কি নিশ্চিত যে সম্পূর্ণ লোডিং ড্রাফট মুছে নতুন করে শুরু করতে চান?')) {
      setItems([]);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setLastScanMessage(null);
      showSuccessToast('ড্রাফট সফলভাবে মুছে দেওয়া হয়েছে');
    }
  };

  // Add Product Manually by Dropdown
  const handleAddProductManually = (productId: number) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;

    const packSize = Number(product.defaultCartonSize || 6);

    setItems((prev) => {
      const existing = prev.find((it) => it.productId === productId);
      if (existing) {
        if (scanMode === 'FREE') {
          return prev.map((it) =>
            it.productId === productId
              ? {
                  ...it,
                  freeCartons: (it.freeCartons || 0) + 1,
                  freePieces: it.freePieces + packSize,
                }
              : it,
          );
        } else {
          return prev.map((it) =>
            it.productId === productId
              ? {
                  ...it,
                  cartonCount: it.cartonCount + 1,
                }
              : it,
          );
        }
      }

      const isFreeMode = scanMode === 'FREE';
      const newRow: ScannedItemRow = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        companyName: product.company?.name || 'Unknown',
        companyId: product.companyId,
        unit: product.unit || 'PCS',
        currentStock: stockMap[product.id] || Number(product.currentStock || 0),
        packSize: packSize,
        cartonCount: isFreeMode ? 0 : 1,
        loosePieces: 0,
        freeCartons: isFreeMode ? 1 : 0,
        freePieces: isFreeMode ? packSize : 0,
        freeSchemeBuyQty: Number(product.freeSchemeBuyQty || 0),
        freeSchemeFreeQty: Number(product.freeSchemeFreeQty || 0),
        unitPrice: Number(product.salePrice || 0),
        scannedCartonCodes: [],
        scannedFreeCartonCodes: [],
      };
      return [newRow, ...prev];
    });

    showSuccessToast(
      scanMode === 'FREE'
        ? `${product.name} ফ্রি হিসেবে যোগ করা হয়েছে (+${packSize} পিস)`
        : `${product.name} পেইড তালিকায় যোগ করা হয়েছে`,
    );
  };

  // 6. Camera Scanner Setup
  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      showErrorToast('ক্যামেরা চালু করা সম্ভব হয়নি। ক্যামেরা পারমিশন চেক করুন।');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  // 7. Computed Live Metrics
  const metrics = useMemo(() => {
    let totalPaidCartons = 0;
    let totalFreeCartons = 0;
    let totalLoosePaid = 0;
    let totalPaidPieces = 0;
    let totalFreePieces = 0;
    let totalVanPieces = 0;
    let totalAmount = 0;

    items.forEach((item) => {
      const paidPcs = item.cartonCount * item.packSize + item.loosePieces;
      const freePcs = Number(item.freePieces || 0);
      const lineTotal = paidPcs * item.unitPrice;

      totalPaidCartons += item.cartonCount;
      totalFreeCartons += Number(item.freeCartons || 0);
      totalLoosePaid += item.loosePieces;
      totalPaidPieces += paidPcs;
      totalFreePieces += freePcs;
      totalVanPieces += paidPcs + freePcs;
      totalAmount += lineTotal;
    });

    return {
      totalPaidCartons,
      totalFreeCartons,
      totalLoosePaid,
      totalPaidPieces,
      totalFreePieces,
      totalVanPieces,
      totalAmount,
      skuCount: items.length,
    };
  }, [items]);

  // 8. Confirm Dispatch & Generate Challan
  const handleConfirmDispatch = async () => {
    if (!dispatchDate) {
      showErrorToast('দয়া করে চালানের তারিখ নির্বাচন করুন');
      return;
    }
    if (!routeId) {
      showErrorToast('দয়া করে একটি রুট নির্বাচন করুন');
      return;
    }
    if (!assignedDeliveryManId) {
      showErrorToast('দয়া করে ডেলিভারি ম্যান নির্বাচন করুন');
      return;
    }
    if (items.length === 0) {
      showErrorToast('তালিকায় কোনো পণ্য স্ক্যান করা হয়নি');
      return;
    }

    // Check stock shortage
    const stockIssues = items.filter((it) => {
      const totalPcsInVan = it.cartonCount * it.packSize + it.loosePieces + Number(it.freePieces || 0);
      return totalPcsInVan > (it.currentStock || 0);
    });

    if (stockIssues.length > 0) {
      const names = stockIssues.map((s) => s.productName).join(', ');
      const proceed = window.confirm(
        `সতর্কতা: নিম্নলিখিত পণ্যের স্টক কম রয়েছে: ${names}। আপনি কি তবুও চালান কনফার্ম করতে চান?`,
      );
      if (!proceed) return;
    }

    try {
      setIsSaving(true);

      // 1. Create order: paid quantity goes to quantity, free quantity goes to freeQuantity
      const orderItems = items.map((it) => {
        const paidPcs = it.cartonCount * it.packSize + it.loosePieces;
        const freePcs = Number(it.freePieces || 0);
        return {
          productId: it.productId,
          quantity: paidPcs,
          freeQuantity: freePcs,
          unitPrice: it.unitPrice,
          discountType: 'FIXED' as const,
          discountValue: 0,
        };
      });

      const orderPayload: any = {
        orderDate: dispatchDate,
        routeId: Number(routeId),
        note: vehicleNote.trim() || undefined,
        discountType: 'FIXED',
        discountValue: 0,
        items: orderItems,
      };

      const order = await createOrder(orderPayload);

      // 2. Create dispatch batch for this order
      const batchPayload = {
        dispatchDate,
        routeId: Number(routeId),
        assignedDeliveryManId,
        note: vehicleNote.trim() || undefined,
        orderIds: [order.id],
      };

      const batch = await createDispatchBatch(batchPayload);

      // Clear draft
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      showSuccessToast('সকালের লোডিং গেটপাস চালান সফলভাবে তৈরি হয়েছে!');

      // Redirect to batch details
      router.push(`/delivery-ops/batches/${batch.id}`);
    } catch (err: any) {
      showErrorToast(err.message || 'চালান তৈরি করতে সমস্যা হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingBlock label="বারকোড লোডিং সিস্টেম চালু হচ্ছে..." />;

  return (
    <div className="space-y-6 pb-28 max-w-[1600px] mx-auto">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <Link
            href="/delivery-ops"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                <Sparkles className="h-3 w-3" />
                Smart Barcode Loading
              </span>
              <span className="text-xs text-slate-400 font-bold">• সকালের ভ্যান লোডিং</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              কার্টুন স্ক্যান ও সকালের লোডিং
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shadow-2xs"
            >
              <Trash2 className="h-4 w-4" />
              <span>রিসেট / ক্লিয়ার ড্রাফট</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirmDispatch}
            disabled={isSaving || items.length === 0}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm cursor-pointer"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            <span>কনফার্ম ও গেটপাস চালান প্রিন্ট</span>
          </button>
        </div>
      </div>

      {/* 1. Dispatch & Route Setup Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <Truck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900">
              ১. ভ্যান ও ডেলিভারি তথ্য
            </h2>
            <p className="text-xs text-slate-500">তারিখ, রুট এবং ডেলিভারি ম্যান নির্বাচন করুন</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Dispatch Date */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>লোডিং তারিখ</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <input
              type="date"
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
            />
          </div>

          {/* Route Select */}
          <div className="relative space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>রুট (Route)</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="রুট খুঁজুন..."
                className={`w-full rounded-2xl border px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition pr-8 ${
                  routeId
                    ? 'border-indigo-300 bg-indigo-50/30 text-indigo-900'
                    : 'border-slate-200 bg-slate-50/70 text-slate-800'
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
              <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-in fade-in slide-in-from-top-1">
                {routes.filter((r) => r.name.toLowerCase().includes(routeSearch.toLowerCase()))
                  .length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-bold">
                    কোনো রুট পাওয়া যায়নি
                  </div>
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
                        }}
                        className={`w-full rounded-xl px-3.5 py-2 text-left text-xs transition flex items-center justify-between font-bold ${
                          routeId === r.id
                            ? 'bg-indigo-50 text-indigo-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                          {r.name}
                        </span>
                        {routeId === r.id && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        )}
                      </button>
                    ))
                )}
              </div>
            )}
          </div>

          {/* Delivery Personnel Select */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>ডেলিভারি ম্যান</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <select
              value={assignedDeliveryManId}
              onChange={(e) => setAssignedDeliveryManId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
            >
              <option value="">ডেলিভারি ম্যান নির্বাচন করুন</option>
              {deliveryMen.map((dm) => (
                <option key={dm.id} value={dm.id}>
                  {dm.name || dm.username}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Note */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>ভ্যান নম্বর বা মন্তব্য</span>
            </label>
            <input
              type="text"
              placeholder="e.g. ঢাকা মেট্রো-ন ১২৩৪"
              value={vehicleNote}
              onChange={(e) => setVehicleNote(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* 2. High-Speed Barcode Scanning Hub with Free Scan Mode Toggle */}
      <div
        className={`rounded-3xl border-2 p-5 sm:p-6 shadow-sm space-y-4 transition-all duration-300 ${
          scanMode === 'FREE'
            ? 'border-amber-400 bg-gradient-to-br from-amber-500/10 via-amber-50/40 to-orange-50/20'
            : 'border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/40'
        }`}
      >
        {/* Mode Switch Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm transition-colors ${
                scanMode === 'FREE' ? 'bg-gradient-to-tr from-amber-500 to-orange-500' : 'bg-indigo-600'
              }`}
            >
              {scanMode === 'FREE' ? <Gift className="h-6 w-6" /> : <Scan className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {scanMode === 'FREE'
                    ? '🎁 ফ্রি পণ্য স্ক্যান মোড (Free Scan Active)'
                    : '📦 নিয়মিত পেইড স্ক্যান মোড (Regular Scan Active)'}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    scanMode === 'FREE'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      scanMode === 'FREE' ? 'bg-amber-600' : 'bg-emerald-500'
                    }`}
                  ></span>
                  {scanMode === 'FREE' ? 'Free Mode' : 'Paid Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                {scanMode === 'FREE'
                  ? 'এখন যে কোনো কার্টুন স্ক্যান করলে পণ্যটি সরাসরি ফ্রি কোটায় যোগ হবে (বিলের টাকা বাড়বে না)'
                  : 'স্বাভাবিক পেইড মাল স্ক্যান মোড। কীবোর্ডে F2 চেপে যে কোনো সময় ফ্রি মোড অন করুন।'}
              </p>
            </div>
          </div>

          {/* Mode Selector Segmented Toggle */}
          <div className="flex items-center gap-2 bg-white/90 p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setScanMode('REGULAR')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                scanMode === 'REGULAR'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>নিয়মিত স্ক্যান</span>
            </button>
            <button
              type="button"
              onClick={() => setScanMode('FREE')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                scanMode === 'FREE'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                  : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <Gift className="h-3.5 w-3.5" />
              <span>ফ্রি স্ক্যান মোড (F2)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isCameraOpen) stopCamera();
                else void startCamera();
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                isCameraOpen
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
              title="মোবাইল ক্যামেরা স্ক্যানার"
            >
              <Camera className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isCameraOpen ? 'ক্যামেরা বন্ধ' : 'ক্যামেরা'}</span>
            </button>
          </div>
        </div>

        {/* Camera stream view if open */}
        {isCameraOpen && (
          <div className="relative rounded-2xl overflow-hidden border border-slate-300 bg-black aspect-video max-w-md mx-auto">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-2 border-indigo-400/80 m-12 pointer-events-none rounded-xl flex items-center justify-center">
              <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-md font-bold">
                বারকোডটি ফ্রেমের ভেতরে রাখুন
              </span>
            </div>
            <button
              type="button"
              onClick={stopCamera}
              className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Barcode Input Box with Dynamic Glow according to Scan Mode */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Barcode
              className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 ${
                scanMode === 'FREE' ? 'text-amber-600' : 'text-indigo-500'
              }`}
            />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const code = barcodeInput.trim();
                  setBarcodeInput('');
                  if (code) void processBarcodeScan(code);
                }
              }}
              placeholder={
                scanMode === 'FREE'
                  ? '🎁 ফ্রি মালের বারকোড স্ক্যান করুন (সরাসরি ফ্রি কোটায় যোগ হবে)...'
                  : '📦 নিয়মিত পেইড মালের বারকোড স্ক্যান করুন অথবা কোড লিখে এন্টার চাপুন...'
              }
              className={`w-full rounded-2xl border-2 pl-11 pr-4 py-3.5 text-sm sm:text-base font-bold outline-none transition shadow-xs ${
                scanMode === 'FREE'
                  ? 'border-amber-400 bg-amber-50/50 text-amber-950 placeholder:text-amber-600/70 focus:border-amber-600 focus:ring-4 focus:ring-amber-200/50'
                  : 'border-indigo-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100'
              }`}
              autoFocus
            />
            {barcodeInput && (
              <button
                type="button"
                onClick={() => setBarcodeInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              const code = barcodeInput.trim();
              setBarcodeInput('');
              if (code) void processBarcodeScan(code);
            }}
            disabled={!barcodeInput.trim() || isScanningActive}
            className={`rounded-2xl px-6 py-3.5 text-sm font-black text-white disabled:opacity-50 transition flex items-center gap-2 shadow-sm cursor-pointer ${
              scanMode === 'FREE'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {isScanningActive ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : scanMode === 'FREE' ? (
              <Gift className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>{scanMode === 'FREE' ? 'ফ্রি স্ক্যান' : 'পেইড স্ক্যান'}</span>
          </button>
        </div>

        {/* Live Audio / Scan Status Alert */}
        {lastScanMessage && (
          <div
            className={`flex items-center justify-between rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold border animate-in fade-in slide-in-from-top-1 ${
              lastScanMessage.type === 'free_success'
                ? 'bg-amber-100/90 border-amber-300 text-amber-950 font-black shadow-xs'
                : lastScanMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : lastScanMessage.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {lastScanMessage.type === 'free_success' ? (
                <Gift className="h-5 w-5 text-amber-700 shrink-0" />
              ) : lastScanMessage.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : lastScanMessage.type === 'warning' ? (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
              )}
              <span>{lastScanMessage.text}</span>
            </div>
            <span className="text-[11px] opacity-75 shrink-0 font-mono">
              {lastScanMessage.time}
            </span>
          </div>
        )}

        {/* Quick Add Product Dropdown (Fallback if barcode unreadable) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="h-4 w-4 text-indigo-500" />
            <span>
              বারকোড স্টিকার ছাড়া সরাসরি যোগ করুন{' '}
              <strong className={scanMode === 'FREE' ? 'text-amber-700' : 'text-indigo-700'}>
                ({scanMode === 'FREE' ? 'ফ্রি পণ্য হিসেবে যোগ হবে' : 'পেইড পণ্য হিসেবে যোগ হবে'})
              </strong>
              :
            </span>
          </div>
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleAddProductManually(Number(e.target.value));
                e.target.value = '';
              }
            }}
            defaultValue=""
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="">+ তালিকা থেকে পণ্য নির্বাচন করুন</option>
            {allProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.company?.name || ''}) - {p.sku}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Live Metrics Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            পেইড কার্টুন (Paid)
          </div>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {formatNumber(metrics.totalPaidCartons)}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            ফ্রি কার্টুন (Free Ctn)
          </div>
          <div className="text-2xl font-black text-amber-800 mt-1">
            {formatNumber(metrics.totalFreeCartons)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            খোলা পেইড পিস (Loose)
          </div>
          <div className="text-2xl font-black text-slate-700 mt-1">
            {formatNumber(metrics.totalLoosePaid)}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            মোট ফ্রি পিস (Free Pcs)
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {formatNumber(metrics.totalFreePieces)}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            মোট ভ্যানে মাল (Total Pcs)
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-1">
            {formatNumber(metrics.totalVanPieces)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            আইটেম (SKUs)
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatNumber(metrics.skuCount)}
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
            মোট বিল মূল্য (Value)
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-950 mt-1 truncate">
            {formatCurrency(metrics.totalAmount)}
          </div>
        </div>
      </div>

      {/* 4. Loaded Items Table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                ৩. সকালের লোডিং সামারি তালিকা ({items.length} টি পণ্য)
              </h2>
              <p className="text-xs text-slate-500">
                পেইড কার্টুন, খোলা পিস এবং ফ্রি পিস আলাদাভাবে নিরীক্ষণ করুন
              </p>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-500">
              <Scan className="h-8 w-8 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-800">এখনো কোনো পণ্য স্ক্যান করা হয়নি</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              কার্টুনের গায়ে লাগানো বারকোড স্টিকার স্ক্যান করুন। ফ্রি মালের জন্য ওপরে{' '}
              <strong className="text-amber-600">ফ্রি স্ক্যান মোড (F2)</strong> চালু করুন।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-slate-100 text-left">
              <thead>
                <tr className="text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="px-3 py-3 rounded-l-xl">পণ্য ও কোম্পানি</th>
                  <th className="px-3 py-3 text-right">স্টক</th>
                  <th className="px-3 py-3 text-center">পেইড কার্টুন</th>
                  <th className="px-3 py-3 text-center">খোলা পিস</th>
                  <th className="px-3 py-3 text-center bg-amber-50/60 text-amber-900 border-x border-amber-100">
                    ফ্রি পিস (Free Qty)
                  </th>
                  <th className="px-3 py-3 text-center">মোট ভ্যানে</th>
                  <th className="px-3 py-3 text-right">পেইড মাল</th>
                  <th className="px-3 py-3 text-right">দর (৳)</th>
                  <th className="px-3 py-3 text-right">মোট বিল (৳)</th>
                  <th className="px-3 py-3 text-center rounded-r-xl">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {items.map((item) => {
                  const paidPcs = item.cartonCount * item.packSize + item.loosePieces;
                  const freePcs = Number(item.freePieces || 0);
                  const totalInVan = paidPcs + freePcs;
                  const lineTotal = paidPcs * item.unitPrice;
                  const isStockShortage = totalInVan > (item.currentStock || 0);
                  const isRecentlyScanned = recentlyScannedProductId === item.productId;

                  return (
                    <tr
                      key={item.productId}
                      className={`transition-colors ${
                        isRecentlyScanned
                          ? item.lastScannedMode === 'FREE'
                            ? 'bg-amber-100/90'
                            : 'bg-emerald-50/90'
                          : isStockShortage
                          ? 'bg-rose-50/30'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Product Name */}
                      <td className="px-3 py-3.5">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>{item.companyName}</span>
                          <span>•</span>
                          <span>{item.sku}</span>
                          <span>•</span>
                          <span className="text-indigo-600 font-bold">
                            ১ কার্টুন = {item.packSize} {item.unit}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {item.scannedCartonCodes.length > 0 && (
                            <span className="text-[10px] font-semibold text-slate-500">
                              {item.scannedCartonCodes.length} টি বারকোড
                            </span>
                          )}
                          {(item.freeCartons || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                              <Gift className="h-3 w-3" />
                              {item.freeCartons} ফ্রি কার্টুন
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Warehouse Stock */}
                      <td className="px-3 py-3.5 text-right font-bold">
                        <span
                          className={
                            isStockShortage
                              ? 'text-rose-600 font-black'
                              : (item.currentStock || 0) <= 10
                              ? 'text-amber-600'
                              : 'text-slate-700'
                          }
                        >
                          {formatNumber(item.currentStock || 0)}
                        </span>
                        {isStockShortage && (
                          <div className="text-[10px] text-rose-500 font-black flex items-center justify-end gap-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            স্টক কম
                          </div>
                        )}
                      </td>

                      {/* Paid Cartons Controls */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateCartons(item.productId, -1)}
                            className="h-6 w-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-8 text-center text-xs font-black text-indigo-700">
                            {item.cartonCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateCartons(item.productId, 1)}
                            className="h-6 w-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Loose Pieces Controls */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateLoose(item.productId, -1)}
                            className="h-6 w-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.loosePieces}
                            onChange={(e) => handleSetLoose(item.productId, e.target.value)}
                            className="w-10 text-center text-xs font-bold text-slate-800 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateLoose(item.productId, 1)}
                            className="h-6 w-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Free Pieces (Direct Input & Quick Controls) */}
                      <td className="px-3 py-3.5 text-center bg-amber-50/40 border-x border-amber-100">
                        <div className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-white p-1 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateFreePieces(item.productId, -1)}
                            className="h-6 w-6 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center font-bold"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.freePieces}
                            onChange={(e) => handleSetFree(item.productId, e.target.value)}
                            className="w-12 text-center text-xs font-black text-amber-900 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateFreePieces(item.productId, 1)}
                            className="h-6 w-6 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center font-bold"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        {(item.freeCartons || 0) > 0 && (
                          <div className="text-[10px] text-amber-700 font-bold mt-1">
                            {item.freeCartons} ফ্রি কার্টুন স্ক্যানকৃত
                          </div>
                        )}
                      </td>

                      {/* Total In Van */}
                      <td className="px-3 py-3.5 text-center font-black text-slate-900 text-sm">
                        {formatNumber(totalInVan)}
                        <span className="text-[10px] text-slate-400 font-normal ml-0.5">
                          {item.unit}
                        </span>
                      </td>

                      {/* Paid Pieces */}
                      <td className="px-3 py-3.5 text-right font-black text-indigo-950">
                        {formatNumber(paidPcs)}
                      </td>

                      {/* Unit Price */}
                      <td className="px-3 py-3.5 text-right">
                        <input
                          type="number"
                          step="any"
                          value={item.unitPrice}
                          onChange={(e) => handleSetPrice(item.productId, e.target.value)}
                          className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1 text-right font-bold text-slate-800 outline-none focus:border-indigo-500"
                        />
                      </td>

                      {/* Total Price */}
                      <td className="px-3 py-3.5 text-right font-black text-slate-900">
                        {formatCurrency(lineTotal)}
                      </td>

                      {/* Delete Action */}
                      <td className="px-3 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(item.productId)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-xl">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
            <div>
              <span>পেইড কার্টুন: </span>
              <span className="font-black text-indigo-700 text-sm">
                {formatNumber(metrics.totalPaidCartons)}
              </span>
            </div>
            <div>
              <span>ফ্রি কার্টুন: </span>
              <span className="font-black text-amber-700 text-sm">
                {formatNumber(metrics.totalFreeCartons)}
              </span>
            </div>
            <div>
              <span>মোট ফ্রি পিস: </span>
              <span className="font-black text-amber-700 text-sm">
                {formatNumber(metrics.totalFreePieces)}
              </span>
            </div>
            <div>
              <span>মোট ভ্যানে মাল: </span>
              <span className="font-black text-emerald-700 text-sm">
                {formatNumber(metrics.totalVanPieces)}
              </span>
            </div>
            <div>
              <span>মোট বিল মূল্য: </span>
              <span className="font-black text-slate-900 text-base">
                {formatCurrency(metrics.totalAmount)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleConfirmDispatch}
              disabled={isSaving || items.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-7 py-3 text-sm font-black text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition shadow-md cursor-pointer"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              <span>কনফার্ম লোডিং ও গেটপাস চালান প্রিন্ট</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
