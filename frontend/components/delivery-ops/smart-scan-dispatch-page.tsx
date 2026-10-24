'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  Truck,
  Scan,
  Package,
  Gift,
  Camera,
  Keyboard,
  Info,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Volume2,
  X,
  Plus,
  Minus,
  Trash2,
  Printer,
  RefreshCw,
  Zap,
  ZapOff,
  ChevronDown,
  ArrowRight,
  FileText,
  Boxes,
  Send,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { getRoutes } from '@/lib/api/routes';
import { getProducts, scanCarton } from '@/lib/api/products';
import { getDeliveryMen } from '@/lib/api/users';
import { getStockSummary } from '@/lib/api/stock';
import { createOrder } from '@/lib/api/orders';
import { createDispatchBatch } from '@/lib/api/delivery-ops';
import { LoadingBlock } from '@/components/ui/loading-block';
import { useToast } from '@/components/ui/toast-provider';
import { formatCurrency, formatNumber, getTodayBDDate } from '@/lib/utils/format';
import { Route, Product, User as UserType, Role } from '@/types/api';

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
  freePieces: number; // Total free pieces
  freeSchemeBuyQty: number;
  freeSchemeFreeQty: number;
  unitPrice: number;
  scannedCartonCodes: string[];
  scannedFreeCartonCodes: string[];
  lastScannedAt?: string;
  lastScannedMode?: 'REGULAR' | 'FREE';
}

interface LastScanSuccessData {
  productName: string;
  sku: string;
  packSize: number;
  serialCode: string;
  mode: 'REGULAR' | 'FREE';
  cartonCount: number;
  piecesFromCarton: number;
  totalPiecesSoFar: number;
}

const DRAFT_STORAGE_KEY = 'morning_loading_scan_draft_v4';

// Synthesize audio feedback via Web Audio API
function playSound(type: 'success' | 'free_success' | 'warning' | 'error' = 'success') {
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
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'success') {
      // Crisp high chime for Paid scan
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'warning') {
      // Double buzz for duplicate
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      // Low buzz for error / not found
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
  const { user } = useAuth();
  const isDeliveryMan = user?.role === Role.DELIVERY_MAN;
  const { error: showErrorToast, success: showSuccessToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'error'>('saved');

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

  // Scanning Mode: REGULAR (Paid) vs FREE
  const [scanMode, setScanMode] = useState<'REGULAR' | 'FREE'>('REGULAR');

  // Scanning Input & Feedback
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [lastScanMessage, setLastScanMessage] = useState<{
    text: string;
    type: 'success' | 'free_success' | 'warning' | 'error';
    time: string;
  } | null>(null);

  // Success Modal (Screen 3 matching reference)
  const [scanSuccessModal, setScanSuccessModal] = useState<LastScanSuccessData | null>(null);
  const successModalTimerRef = useRef<any>(null);

  // Confirm Dispatch Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Scanned Rows
  const [items, setItems] = useState<ScannedItemRow[]>([]);
  const [recentlyScannedProductId, setRecentlyScannedProductId] = useState<number | null>(null);

  // Camera Scanner Modal State (Screen 2 matching reference)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraHasTorch, setCameraHasTorch] = useState(false);
  const html5QrCodeRef = useRef<any>(null);

  // Barcode input ref for keyboard focus
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // Hardware Scanner Gun keystroke wedge buffer
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

        const routeList = Array.isArray(routesData) ? routesData : [];
        setRoutes(routeList);
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
              const foundRoute = routeList.find((r: Route) => r.id === parsed.routeId);
              if (foundRoute) setRouteSearch(foundRoute.name);
            }
            if (parsed.assignedDeliveryManId) setAssignedDeliveryManId(parsed.assignedDeliveryManId);
            if (parsed.vehicleNote) setVehicleNote(parsed.vehicleNote);
            if (Array.isArray(parsed.items)) setItems(parsed.items);
            if (parsed.scanMode) setScanMode(parsed.scanMode);
          }
        } catch {
          // Ignore draft parse errors
        }

        if (user?.role === Role.DELIVERY_MAN && user?.id) {
          setAssignedDeliveryManId(user.id);
        }
      } catch (err: any) {
        showErrorToast(err.message || 'মাস্টার ডাটা লোড করতে সমস্যা হয়েছে');
      } finally {
        setIsLoading(false);
      }
    }

    void init();
  }, [user]);

  // 2. Auto-save Draft
  useEffect(() => {
    if (isLoading) return;
    setDraftStatus('saving');
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
      setDraftStatus('saved');
    } catch {
      setDraftStatus('error');
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
        playSound('warning');
        setLastScanMessage({
          text: `এই কার্টুনটি ইতোমধ্যে স্ক্যান করা হয়েছে (${cleanCode})`,
          type: 'warning',
          time: new Date().toLocaleTimeString(),
        });
        showErrorToast(`এই কার্টুনটি ইতোমধ্যে স্ক্যান করা হয়েছে (${cleanCode})`);
        setIsScanningActive(false);
        return;
      }

      try {
        const scanRes = await scanCarton(cleanCode);

        if (!scanRes.found || !scanRes.product) {
          playSound('error');
          setLastScanMessage({
            text: `বারকোড পাওয়া যায়নি (${cleanCode})। আবার স্ক্যান করুন অথবা পণ্য নির্বাচন করুন।`,
            type: 'error',
            time: new Date().toLocaleTimeString(),
          });
          showErrorToast(`বারকোড "${cleanCode}" পাওয়া যায়নি`);
          setIsScanningActive(false);
          return;
        }

        const product = scanRes.product;
        const packSize = Number(scanRes.packSize || product.defaultCartonSize || 6);
        const buyQty = Number(product.freeSchemeBuyQty || 0);
        const freeQty = Number(product.freeSchemeFreeQty || 0);

        setRecentlyScannedProductId(product.id);
        setTimeout(() => setRecentlyScannedProductId(null), 1500);

        let updatedCartonCount = 1;
        let updatedTotalPieces = packSize;

        // FREE SCAN MODE LOGIC:
        if (scanMode === 'FREE') {
          playSound('free_success');

          setItems((prevItems) => {
            const existingIndex = prevItems.findIndex((it) => it.productId === product.id);

            if (existingIndex >= 0) {
              const updated = [...prevItems];
              const existing = updated[existingIndex];
              const newFreeCartons = (existing.freeCartons || 0) + 1;
              const newFreePieces = existing.freePieces + packSize;
              updatedCartonCount = newFreeCartons;
              updatedTotalPieces =
                existing.cartonCount * existing.packSize + existing.loosePieces + newFreePieces;

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
            text: `🎁 ফ্রি স্ক্যান সফল: ${product.name} (+১ ফ্রি কার্টুন = ${packSize} পিস)`,
            type: 'free_success',
            time: new Date().toLocaleTimeString(),
          });

          // Show Screen 3 Confirmation Dialog
          if (successModalTimerRef.current) clearTimeout(successModalTimerRef.current);
          setScanSuccessModal({
            productName: product.name,
            sku: product.sku,
            packSize: packSize,
            serialCode: cleanCode,
            mode: 'FREE',
            cartonCount: updatedCartonCount,
            piecesFromCarton: packSize,
            totalPiecesSoFar: updatedTotalPieces,
          });
          successModalTimerRef.current = setTimeout(() => {
            setScanSuccessModal(null);
          }, 2800);

          setIsScanningActive(false);
          return;
        }

        // REGULAR PAID SCAN MODE LOGIC:
        playSound('success');

        setItems((prevItems) => {
          const existingIndex = prevItems.findIndex((it) => it.productId === product.id);

          if (existingIndex >= 0) {
            const updated = [...prevItems];
            const existing = updated[existingIndex];
            const newCartonCount = existing.cartonCount + 1;
            updatedCartonCount = newCartonCount;
            updatedTotalPieces =
              newCartonCount * existing.packSize + existing.loosePieces + existing.freePieces;

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

        // Show Screen 3 Confirmation Dialog
        if (successModalTimerRef.current) clearTimeout(successModalTimerRef.current);
        setScanSuccessModal({
          productName: product.name,
          sku: product.sku,
          packSize: packSize,
          serialCode: cleanCode,
          mode: 'REGULAR',
          cartonCount: updatedCartonCount,
          piecesFromCarton: packSize,
          totalPiecesSoFar: updatedTotalPieces,
        });
        successModalTimerRef.current = setTimeout(() => {
          setScanSuccessModal(null);
        }, 2800);
      } catch (err: any) {
        playSound('error');
        setLastScanMessage({
          text: `স্ক্যান এরর: ${err.message || 'স্ক্যান সম্পন্ন করা যায়নি'}`,
          type: 'error',
          time: new Date().toLocaleTimeString(),
        });
      } finally {
        setIsScanningActive(false);
      }
    },
    [items, stockMap, scanMode, showErrorToast],
  );

  // 4. Global Hardware Scanner Gun & F2 Shortcut Keydown Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 hotkey to toggle between Regular Scan and Free Scan
      if (e.key === 'F2') {
        e.preventDefault();
        setScanMode((prev) => {
          const next = prev === 'REGULAR' ? 'FREE' : 'REGULAR';
          showSuccessToast(
            next === 'FREE'
              ? '🎁 ফ্রি স্ক্যান মোড চালু হয়েছে'
              : '📦 নিয়মিত পেইড স্ক্যান মোড চালু হয়েছে',
          );
          return next;
        });
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
  }, [barcodeInput, processBarcodeScan, showSuccessToast]);

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
      setScanSuccessModal(null);
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

  // 6. Camera Scanner Setup using html5-qrcode (Screen 2)
  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      // Wait for DOM element #reader-viewfinder to render
      setTimeout(async () => {
        try {
          const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
          const element = document.getElementById('reader-viewfinder');
          if (!element) return;

          const scanner = new Html5Qrcode('reader-viewfinder', {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.UPC_A,
            ],
            verbose: false,
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true,
            },
          });
          html5QrCodeRef.current = scanner;

          let lastScannedText = '';
          let lastScannedTime = 0;

          await scanner.start(
            { facingMode: 'environment' },
            {
              fps: 20,
              qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                const width = Math.max(260, Math.min(viewfinderWidth - 20, 380));
                const height = Math.max(150, Math.min(viewfinderHeight - 20, 240));
                return { width, height };
              },
            },
            (decodedText) => {
              const now = Date.now();
              const text = decodedText.trim();
              if (text && (text !== lastScannedText || now - lastScannedTime > 2500)) {
                lastScannedText = text;
                lastScannedTime = now;
                void processBarcodeScan(text);
              }
            },
            () => {
              // Frame decoding loop errors are normal and ignored
            },
          );

          // Check if torch/flashlight is supported
          try {
            const capabilities = scanner.getRunningTrackCapabilities?.();
            if (capabilities && 'torch' in capabilities) {
              setCameraHasTorch(true);
            }
          } catch {
            // Torch check ignored
          }
        } catch (err: any) {
          showErrorToast('ক্যামেরা চালু করা সম্ভব হয়নি। ক্যামেরা পারমিশন চেক করুন।');
          setIsCameraOpen(false);
        }
      }, 200);
    } catch {
      showErrorToast('ক্যামেরা চালু করতে সমস্যা হয়েছে');
      setIsCameraOpen(false);
    }
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current) return;
    try {
      const nextState = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch {
      showErrorToast('ফ্ল্যাশলাইট এই ডিভাইসে সাপোর্ট করে না');
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch {
        // Stop error ignored
      }
      html5QrCodeRef.current = null;
    }
    setIsTorchOn(false);
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

  // Selected route & delivery man display helpers
  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === Number(routeId)),
    [routes, routeId],
  );
  const selectedDeliveryMan = useMemo(
    () => deliveryMen.find((dm) => dm.id === assignedDeliveryManId),
    [deliveryMen, assignedDeliveryManId],
  );

  // Check if any product exceeds available stock
  const stockShortages = useMemo(() => {
    return items.filter((item) => {
      const totalInVan = item.cartonCount * item.packSize + item.loosePieces + item.freePieces;
      return totalInVan > (item.currentStock || 0);
    });
  }, [items]);

  // 8. Confirm Loading & Print Gate Pass Challan
  const handleConfirmDispatch = async () => {
    if (!routeId) {
      showErrorToast('অনুগ্রহ করে একটি ডেলিভারি রুট নির্বাচন করুন');
      return;
    }
    const effectiveDeliveryManId = isDeliveryMan ? (user?.id || assignedDeliveryManId) : assignedDeliveryManId;
    if (!effectiveDeliveryManId) {
      showErrorToast('অনুগ্রহ করে ডেলিভারি ম্যান নির্বাচন করুন');
      return;
    }
    if (items.length === 0) {
      showErrorToast('লোডিং তালিকায় কমপক্ষে একটি পণ্য স্ক্যান করুন');
      return;
    }

    setShowConfirmModal(true);
  };

  const executeDispatchConfirmation = async () => {
    try {
      setIsSaving(true);

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

      const effectiveDeliveryManId = isDeliveryMan ? (user?.id || assignedDeliveryManId) : assignedDeliveryManId;
      const orderPayload: any = {
        orderDate: dispatchDate,
        routeId: Number(routeId),
        note: isDeliveryMan
          ? (vehicleNote.trim() ? `${vehicleNote.trim()} [ডেলিভারিম্যানের লোডিং]` : '[ডেলিভারিম্যানের সকালের লোডিং]')
          : (vehicleNote.trim() || undefined),
        discountType: 'FIXED',
        discountValue: 0,
        items: orderItems,
      };

      const order = await createOrder(orderPayload);

      const batchPayload = {
        dispatchDate,
        routeId: Number(routeId),
        assignedDeliveryManId: effectiveDeliveryManId,
        note: isDeliveryMan
          ? (vehicleNote.trim() ? `${vehicleNote.trim()} [ডেলিভারিম্যানের লোডিং সাবমিশন]` : '[ডেলিভারিম্যানের লোডিং সাবমিশন - অনুমোদনের অপেক্ষায়]')
          : (vehicleNote.trim() || undefined),
        orderIds: [order.id],
      };

      const batch = await createDispatchBatch(batchPayload);

      // Clear local draft
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setShowConfirmModal(false);

      if (isDeliveryMan) {
        showSuccessToast('✅ সকালের ভ্যান লোডিং সাবমিট হয়েছে! এডমিন অনুমোদন (Approve) করলেই চূড়ান্ত ডিসপ্যাচ লাইভ হবে।');
        router.push('/my-deliveries');
      } else {
        showSuccessToast('সকালের লোডিং গেটপাস চালান সফলভাবে তৈরি হয়েছে!');
        router.push(`/delivery-ops/batches/${batch.id}`);
      }
    } catch (err: any) {
      showErrorToast(err.message || 'চালান তৈরি করতে সমস্যা হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingBlock label="বারকোড লোডিং সিস্টেম চালু হচ্ছে..." />;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-36 font-sans text-slate-800">
      {/* ── TOP APP BAR (Blue header matching Screen 1 & 4) ── */}
      <div className="sticky top-0 z-40 bg-[#0260e8] px-4 py-3.5 text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={isDeliveryMan ? "/my-deliveries" : "/delivery-ops"}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-xs transition hover:bg-white/25 active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                কার্টুন স্ক্যান ও সকালের লোডিং
              </h1>
              <p className="text-[11px] font-medium text-blue-100 opacity-90">
                {isDeliveryMan ? 'সকালের ভ্যান লোডিং স্ক্যান ও সাবমিশন' : 'Delivery Loading & Dispatch'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Indicator Pill */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-400/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>

            {/* Desktop Draft Reset */}
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-500/80 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>রিসেট</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-3 sm:px-4 pt-3 space-y-3">
        {/* ── 1. DELIVERY SETUP CARD (Matching Screen 1 & 4) ── */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
          <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
            {/* Date */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-slate-400">তারিখ</div>
                <input
                  type="date"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  className="w-full font-bold text-slate-800 bg-transparent outline-none text-xs"
                />
              </div>
            </div>

            {/* Route */}
            <div className="relative flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-slate-400">রুট</div>
                <button
                  type="button"
                  onClick={() => setShowRouteResults(!showRouteResults)}
                  className="flex w-full items-center justify-between font-bold text-slate-800 text-xs truncate"
                >
                  <span className="truncate">{selectedRoute ? selectedRoute.name : 'রুট নির্বাচন'}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 ml-1" />
                </button>
              </div>

              {showRouteResults && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  {routes.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setRouteId(r.id);
                        setShowRouteResults(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        routeId === r.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{r.name}</span>
                      {routeId === r.id && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery Man */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-slate-400">ডেলিভারি ম্যান</div>
                {isDeliveryMan ? (
                  <div className="text-xs font-black text-blue-900 truncate">
                    {user?.name || user?.username} <span className="text-[10px] font-bold text-blue-600">(আপনি)</span>
                  </div>
                ) : (
                  <select
                    value={assignedDeliveryManId}
                    onChange={(e) => setAssignedDeliveryManId(e.target.value)}
                    className="w-full font-bold text-slate-800 bg-transparent outline-none text-xs truncate"
                  >
                    <option value="">নির্বাচন করুন</option>
                    {deliveryMen.map((dm) => (
                      <option key={dm.id} value={dm.id}>
                        {dm.name || dm.username}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Van No */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Truck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-slate-400">ভ্যান নং</div>
                <input
                  type="text"
                  placeholder="ঢাকা মেট্রো-ন..."
                  value={vehicleNote}
                  onChange={(e) => setVehicleNote(e.target.value)}
                  className="w-full font-bold text-slate-800 bg-transparent outline-none text-xs placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. MODE SWITCHER (Segmented Buttons matching Screen 1 & 4) ── */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Regular Paid Scan Button */}
          <button
            type="button"
            onClick={() => {
              setScanMode('REGULAR');
              showSuccessToast('📦 নিয়মিত পেইড স্ক্যান মোড সক্রিয়');
            }}
            className={`flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs sm:text-sm font-black transition-all active:scale-98 cursor-pointer ${
              scanMode === 'REGULAR'
                ? 'bg-[#0260e8] text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="h-4 w-4 shrink-0" />
            <span>নিয়মিত স্ক্যান (পেইড)</span>
          </button>

          {/* Free Scan Button */}
          <button
            type="button"
            onClick={() => {
              setScanMode('FREE');
              showSuccessToast('🎁 ফ্রি স্ক্যান মোড সক্রিয়');
            }}
            className={`flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs sm:text-sm font-black transition-all active:scale-98 cursor-pointer ${
              scanMode === 'FREE'
                ? 'bg-[#f59e0b] text-white shadow-md'
                : 'bg-amber-50/70 border border-amber-200/80 text-amber-800 hover:bg-amber-100/60'
            }`}
          >
            <Gift className="h-4 w-4 shrink-0" />
            <span>ফ্রি স্ক্যান মোড (F2)</span>
          </button>
        </div>

        {/* ── FREE MODE ACTIVE BANNER (Matching Screen 4) ── */}
        {scanMode === 'FREE' && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900 shadow-2xs animate-in fade-in slide-in-from-top-1">
            <Gift className="h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <span className="font-black text-amber-800">ফ্রি স্ক্যান মোড সক্রিয়</span> — স্ক্যান
              করলে FREE পিস যোগ হবে, বিলের টাকা বাড়বে না।
            </div>
          </div>
        )}

        {/* ── 3. BARCODE SCANNER INPUT BAR (Matching Screen 1 & 4) ── */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            {/* Input with Barcode Icon */}
            <div className="relative flex flex-1 items-center rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2.5 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition">
              {/* Barcode Lines Icon */}
              <div className="flex items-center gap-0.5 mr-2 text-blue-600 shrink-0">
                <span className="h-5 w-[2px] bg-blue-600 rounded-full" />
                <span className="h-5 w-[3px] bg-blue-600 rounded-full" />
                <span className="h-5 w-[1px] bg-blue-600 rounded-full" />
                <span className="h-5 w-[4px] bg-blue-600 rounded-full" />
                <span className="h-5 w-[2px] bg-blue-600 rounded-full" />
                <span className="h-5 w-[1px] bg-blue-600 rounded-full" />
              </div>

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
                placeholder="বারকোড স্ক্যান করুন..."
                className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
                autoFocus
              />

              {barcodeInput && (
                <button
                  type="button"
                  onClick={() => setBarcodeInput('')}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Camera Button */}
            <button
              type="button"
              onClick={() => void startCamera()}
              className="flex flex-col items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700 hover:bg-blue-100 active:scale-95 transition cursor-pointer shrink-0"
              title="ক্যামেরা স্ক্যানার"
            >
              <Camera className="h-4 w-4" />
              <span className="text-[10px] font-black mt-0.5">ক্যামেরা</span>
            </button>

            {/* Manual Scan Submit / Menu Button */}
            <button
              type="button"
              onClick={() => {
                const code = barcodeInput.trim();
                setBarcodeInput('');
                if (code) void processBarcodeScan(code);
                else barcodeInputRef.current?.focus();
              }}
              disabled={isScanningActive}
              className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200 active:scale-95 transition cursor-pointer shrink-0"
              title="কীবোর্ড মেনু"
            >
              <Keyboard className="h-4 w-4" />
              <span className="text-[10px] font-black mt-0.5">মেনু</span>
            </button>
          </div>

          {/* Fallback Product Selection: "স্টিকার ছিঁড়ে গেলে পণ্য নির্বাচন করুন" */}
          <div className="pt-1.5 border-t border-slate-100 space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Info className="h-3 w-3 text-blue-500" />
              <span>স্টিকার ছিঁড়ে গেলে পণ্য নির্বাচন করুন</span>
            </div>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddProductManually(Number(e.target.value));
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition"
            >
              <option value="">পণ্য নির্বাচন করুন</option>
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — ১ কার্টুন = {p.defaultCartonSize || 6} {p.unit}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── SCAN STATUS ALERT (If any) ── */}
        {lastScanMessage && (
          <div
            className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs font-bold border animate-in fade-in slide-in-from-top-1 ${
              lastScanMessage.type === 'free_success'
                ? 'bg-amber-100/90 border-amber-300 text-amber-950 font-black'
                : lastScanMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : lastScanMessage.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {lastScanMessage.type === 'free_success' ? (
                <Gift className="h-4 w-4 text-amber-700 shrink-0" />
              ) : lastScanMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              )}
              <span>{lastScanMessage.text}</span>
            </div>
            <span className="text-[10px] opacity-75 font-mono">{lastScanMessage.time}</span>
          </div>
        )}

        {/* ── 4. LIVE SUMMARY (6 Colorful Cards in 3x2 Grid matching Reference) ── */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
            <Scan className="h-3.5 w-3.5 text-blue-600" />
            <span>লাইভ সামারি</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Box 1: পেইড কার্টুন (Blue) */}
            <div className="rounded-2xl border border-blue-200/90 bg-blue-50/40 p-2.5 text-center shadow-2xs">
              <div className="text-[10px] sm:text-xs font-bold text-blue-600">পেইড কার্টুন</div>
              <div className="text-xl sm:text-2xl font-black text-blue-700 mt-0.5">
                {formatNumber(metrics.totalPaidCartons)}
              </div>
            </div>

            {/* Box 2: ফ্রি কার্টুন (Amber) */}
            <div className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-2.5 text-center shadow-2xs">
              <div className="text-[10px] sm:text-xs font-bold text-amber-600">ফ্রি কার্টুন</div>
              <div className="text-xl sm:text-2xl font-black text-amber-700 mt-0.5">
                {formatNumber(metrics.totalFreeCartons)}
              </div>
            </div>

            {/* Box 3: খোলা পিস (Purple/Indigo) */}
            <div className="rounded-2xl border border-indigo-200/90 bg-indigo-50/40 p-2.5 text-center shadow-2xs">
              <div className="text-[10px] sm:text-xs font-bold text-indigo-600">খোলা পিস</div>
              <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-0.5">
                {formatNumber(metrics.totalLoosePaid)}
              </div>
            </div>

            {/* Box 4: মোট ফ্রি পিস (Emerald) */}
            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/40 p-2.5 text-center shadow-2xs">
              <div className="text-[10px] sm:text-xs font-bold text-emerald-600">মোট ফ্রি পিস</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">
                {formatNumber(metrics.totalFreePieces)}
              </div>
            </div>

            {/* Box 5: মোট ভ্যানে পিস (Cyan) */}
            <div className="rounded-2xl border border-cyan-200/90 bg-cyan-50/40 p-2.5 text-center shadow-2xs">
              <div className="text-[10px] sm:text-xs font-bold text-cyan-700">মোট ভ্যানে পিস</div>
              <div className="text-xl sm:text-2xl font-black text-cyan-800 mt-0.5">
                {formatNumber(metrics.totalVanPieces)}
              </div>
            </div>

            {/* Box 6: বিল (৳) (Rose) */}
            <div className="rounded-2xl border border-rose-200/90 bg-rose-50/40 p-2.5 text-center shadow-2xs">
              <div className="text-[10px] sm:text-xs font-bold text-rose-600">বিল (৳)</div>
              <div className="text-lg sm:text-2xl font-black text-rose-700 mt-0.5 truncate">
                {formatNumber(Math.round(metrics.totalAmount))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 5. SCANNED ITEMS: MOBILE PRODUCT CARDS (<768px) & DESKTOP TABLE (≥768px) ── */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
              <Boxes className="h-4 w-4 text-blue-600" />
              <span>লোডিং তালিকা ({items.length} টি পণ্য)</span>
            </div>
            {stockShortages.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-700">
                <AlertTriangle className="h-3 w-3" />
                {stockShortages.length} টিতে স্টক কম
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Scan className="h-6 w-6" />
              </div>
              <div className="text-sm font-bold text-slate-700">এখনো কোনো পণ্য স্ক্যান করা হয়নি</div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                কার্টুনের বারকোড স্ক্যান করুন অথবা ওপরের ড্রপডাউন থেকে পণ্য নির্বাচন করুন
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE PRODUCT CARDS (<768px) */}
              <div className="space-y-2.5 md:hidden">
                {items.map((item) => {
                  const paidPcs = item.cartonCount * item.packSize + item.loosePieces;
                  const freePcs = Number(item.freePieces || 0);
                  const totalInVan = paidPcs + freePcs;
                  const lineTotal = paidPcs * item.unitPrice;
                  const isShortage = totalInVan > (item.currentStock || 0);
                  const isRecent = recentlyScannedProductId === item.productId;

                  return (
                    <div
                      key={item.productId}
                      className={`rounded-2xl border bg-white p-3.5 shadow-2xs space-y-2.5 transition-all ${
                        isRecent
                          ? 'border-blue-400 ring-2 ring-blue-100'
                          : isShortage
                          ? 'border-rose-200 bg-rose-50/20'
                          : 'border-slate-200/90'
                      }`}
                    >
                      {/* Product Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-slate-900 text-xs sm:text-sm leading-tight">
                            {item.productName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>{item.sku}</span>
                            <span>•</span>
                            <span className="text-blue-600 font-bold">
                              ১ কার্টুন = {item.packSize} {item.unit}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteRow(item.productId)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Controls Row: Paid Cartons, Loose, Free */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {/* Paid Cartons */}
                        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-1.5 space-y-1">
                          <div className="text-[10px] font-bold text-blue-600">পেইড কার্টুন</div>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartons(item.productId, -1)}
                              className="h-6 w-6 rounded-lg bg-white border border-blue-200 text-blue-700 flex items-center justify-center font-bold"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="font-black text-blue-800 text-sm">
                              {item.cartonCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartons(item.productId, 1)}
                              className="h-6 w-6 rounded-lg bg-white border border-blue-200 text-blue-700 flex items-center justify-center font-bold"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Loose Pieces */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-1.5 space-y-1">
                          <div className="text-[10px] font-bold text-slate-500">খোলা পিস</div>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateLoose(item.productId, -1)}
                              className="h-6 w-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={item.loosePieces}
                              onChange={(e) => handleSetLoose(item.productId, e.target.value)}
                              className="w-8 text-center text-xs font-black text-slate-800 bg-transparent outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateLoose(item.productId, 1)}
                              className="h-6 w-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Free Pieces */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-1.5 space-y-1">
                          <div className="text-[10px] font-bold text-amber-700">ফ্রি পিস</div>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateFreePieces(item.productId, -1)}
                              className="h-6 w-6 rounded-lg bg-white border border-amber-300 text-amber-700 flex items-center justify-center font-bold"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={item.freePieces}
                              onChange={(e) => handleSetFree(item.productId, e.target.value)}
                              className="w-8 text-center text-xs font-black text-amber-900 bg-transparent outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateFreePieces(item.productId, 1)}
                              className="h-6 w-6 rounded-lg bg-white border border-amber-300 text-amber-700 flex items-center justify-center font-bold"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Footer Totals Row */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-500">ভ্যানে:</span>
                          <span className="font-black text-slate-900">{totalInVan} {item.unit}</span>
                          {isShortage && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                              স্টক {item.currentStock}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400">বিল: </span>
                          <span className="font-black text-blue-700">
                            {formatCurrency(lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE (≥768px) */}
              <div className="hidden md:block rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead className="bg-slate-50/80 text-[11px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="px-3.5 py-3">পণ্য ও SKU</th>
                      <th className="px-3 py-3 text-right">স্টক</th>
                      <th className="px-3 py-3 text-center">পেইড কার্টুন</th>
                      <th className="px-3 py-3 text-center">খোলা পিস</th>
                      <th className="px-3 py-3 text-center bg-amber-50/60 text-amber-900 border-x border-amber-100">
                        ফ্রি পিস (Free Qty)
                      </th>
                      <th className="px-3 py-3 text-center">মোট ভ্যানে</th>
                      <th className="px-3 py-3 text-right">দর (৳)</th>
                      <th className="px-3 py-3 text-right">মোট বিল (৳)</th>
                      <th className="px-3 py-3 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const paidPcs = item.cartonCount * item.packSize + item.loosePieces;
                      const freePcs = Number(item.freePieces || 0);
                      const totalInVan = paidPcs + freePcs;
                      const lineTotal = paidPcs * item.unitPrice;
                      const isShortage = totalInVan > (item.currentStock || 0);
                      const isRecent = recentlyScannedProductId === item.productId;

                      return (
                        <tr
                          key={item.productId}
                          className={`transition-colors ${
                            isRecent
                              ? 'bg-blue-50/60'
                              : isShortage
                              ? 'bg-rose-50/30'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-3.5 py-3">
                            <div className="font-bold text-slate-900">{item.productName}</div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                              <span>{item.sku}</span>
                              <span>•</span>
                              <span className="text-blue-600 font-bold">
                                ১ কার্টুন = {item.packSize} {item.unit}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3 text-right font-bold">
                            <span
                              className={isShortage ? 'text-rose-600 font-black' : 'text-slate-700'}
                            >
                              {formatNumber(item.currentStock || 0)}
                            </span>
                            {isShortage && (
                              <div className="text-[10px] text-rose-500 font-black">ঘাটতি!</div>
                            )}
                          </td>

                          {/* Paid Cartons */}
                          <td className="px-3 py-3 text-center">
                            <div className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50/40 p-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateCartons(item.productId, -1)}
                                className="h-5 w-5 rounded-md bg-white text-blue-700 flex items-center justify-center font-bold"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-6 text-center text-xs font-black text-blue-800">
                                {item.cartonCount}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCartons(item.productId, 1)}
                                className="h-5 w-5 rounded-md bg-white text-blue-700 flex items-center justify-center font-bold"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </td>

                          {/* Loose Pieces */}
                          <td className="px-3 py-3 text-center">
                            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateLoose(item.productId, -1)}
                                className="h-5 w-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={item.loosePieces}
                                onChange={(e) => handleSetLoose(item.productId, e.target.value)}
                                className="w-8 text-center text-xs font-bold text-slate-800 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateLoose(item.productId, 1)}
                                className="h-5 w-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </td>

                          {/* Free Pieces */}
                          <td className="px-3 py-3 text-center bg-amber-50/40 border-x border-amber-100">
                            <div className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-white p-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateFreePieces(item.productId, -1)}
                                className="h-5 w-5 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center font-bold"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={item.freePieces}
                                onChange={(e) => handleSetFree(item.productId, e.target.value)}
                                className="w-10 text-center text-xs font-black text-amber-900 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateFreePieces(item.productId, 1)}
                                className="h-5 w-5 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center font-bold"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            {(item.freeCartons || 0) > 0 && (
                              <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                                {item.freeCartons} ফ্রি কার্টুন
                              </div>
                            )}
                          </td>

                          {/* Total Van */}
                          <td className="px-3 py-3 text-center font-black text-slate-900">
                            {formatNumber(totalInVan)}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">
                              {item.unit}
                            </span>
                          </td>

                          {/* Unit Price */}
                          <td className="px-3 py-3 text-right">
                            <input
                              type="number"
                              step="any"
                              value={item.unitPrice}
                              onChange={(e) => handleSetPrice(item.productId, e.target.value)}
                              className="w-16 rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-right font-bold text-slate-800 outline-none"
                            />
                          </td>

                          {/* Total Line Bill */}
                          <td className="px-3 py-3 text-right font-black text-slate-900">
                            {formatCurrency(lineTotal)}
                          </td>

                          {/* Delete */}
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(item.productId)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 6. FIXED BOTTOM SUMMARY BAR (Matching Screen 1 & 4) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-2.5 shadow-lg">
        <div className="mx-auto max-w-5xl space-y-2">
          {/* Summary stats line */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <div className="flex items-center gap-2 sm:gap-4 truncate">
              <span>
                মোট কার্টুন: <strong className="text-blue-700">{metrics.totalPaidCartons + metrics.totalFreeCartons}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                ফ্রি পিস: <strong className="text-amber-700">{metrics.totalFreePieces}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                বিল:{' '}
                <strong className="text-slate-900">
                  {formatCurrency(metrics.totalAmount)}
                </strong>
              </span>
            </div>

            {/* Draft status */}
            <span className="hidden sm:inline-flex text-[10px] font-semibold text-slate-400">
              {draftStatus === 'saved' ? 'ড্রাফট সংরক্ষিত' : 'ড্রাফট সেভ হচ্ছে...'}
            </span>
          </div>

          {/* Full-width Confirm Gate Pass Button matching reference */}
          <button
            type="button"
            onClick={handleConfirmDispatch}
            disabled={isSaving || items.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0260e8] hover:bg-blue-700 active:scale-98 disabled:opacity-50 py-3 text-sm font-black text-white shadow-md transition cursor-pointer"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isDeliveryMan ? (
              <Send className="h-4 w-4" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            <span>
              {isDeliveryMan
                ? 'সকালের লোডিং সাবমিট করুন (এডমিন অনুমোদনের জন্য)'
                : 'কনফার্ম গেটপাস প্রিন্ট'}
            </span>
          </button>
        </div>
      </div>

      {/* ── 7. CAMERA SCANNER MODAL (Screen 2 matching reference) ── */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-xs text-white z-10">
            <button
              type="button"
              onClick={stopCamera}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="text-sm font-bold">ক্যামেরা দিয়ে স্ক্যান করুন</div>
            <button
              type="button"
              onClick={toggleTorch}
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                isTorchOn ? 'bg-amber-400 text-black' : 'bg-white/20 text-white'
              }`}
            >
              {isTorchOn ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </button>
          </div>

          {/* Camera Viewfinder with Green Corners & Animated Red Laser */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
            {/* html5-qrcode target div */}
            <div
              id="reader-viewfinder"
              className="w-full h-full max-w-md mx-auto flex items-center justify-center [&_#reader-viewfinder__scan_region]:border-none! [&_#reader-viewfinder__scan_region_img]:hidden! [&_video]:w-full! [&_video]:h-full! [&_video]:object-cover!"
            />

            {/* Overlay Targeting Frame with Neon Green Corners & Red Laser */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative h-48 w-80 sm:h-56 sm:w-96 rounded-3xl border-2 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.35)] flex items-center justify-center overflow-hidden">
                {/* 4 Neon corner accents */}
                <div className="absolute top-0 left-0 h-6 w-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
                <div className="absolute top-0 right-0 h-6 w-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />

                {/* Animated Horizontal Red Laser Beam */}
                <div className="absolute left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-[bounce_2s_infinite]" />
              </div>

              {/* Guidance text pill below frame */}
              <div className="mt-4 flex items-center gap-1.5 rounded-full bg-black/70 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-xs">
                <Scan className="h-3.5 w-3.5 text-emerald-400" />
                <span>কার্টুনের বারকোড বা QR কোড ফ্রেমের মধ্যে রাখুন</span>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Camera Status Pill */}
          <div className="p-4 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-black text-slate-800 shadow-lg">
              <Camera className="h-4 w-4 text-blue-600" />
              <span>ক্যামেরা স্ক্যান চলছে...</span>
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400 ml-1" />
            </div>
          </div>
        </div>
      )}

      {/* ── 8. SCAN SUCCESS CONFIRMATION MODAL (Screen 3 matching reference) ── */}
      {scanSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            {/* Green Circular Checkmark & Sound Icon */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="h-10 w-10" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-center">
              <h3 className="text-xl font-black text-slate-900">স্ক্যান সফল!</h3>
              <button
                type="button"
                onClick={() => playSound(scanSuccessModal.mode === 'FREE' ? 'free_success' : 'success')}
                className="text-slate-400 hover:text-blue-600"
                title="সাউন্ড শুনুন"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            </div>

            {/* Product Card Details */}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              {/* Product icon thumbnail */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200/80 text-amber-500 shadow-2xs">
                <Package className="h-7 w-7 text-amber-600" />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate">
                  {scanSuccessModal.productName}
                </h4>
                <div className="text-[11px] font-bold text-slate-500">
                  ১ কার্টুন = {scanSuccessModal.packSize} পিস
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  {scanSuccessModal.serialCode}
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-black ${
                      scanSuccessModal.mode === 'FREE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {scanSuccessModal.mode === 'FREE' ? 'Free Scan' : 'Paid Scan'}
                  </span>
                </div>
              </div>
            </div>

            {/* Breakdown Rows */}
            <div className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">কার্টুন সংখ্যা</span>
                <span className="font-black text-slate-900">{scanSuccessModal.cartonCount}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">এই কার্টুন থেকে পিস</span>
                <span className="font-black text-slate-900">{scanSuccessModal.piecesFromCarton}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">মোট পিস (এ পর্যন্ত)</span>
                <span className="font-black text-slate-900">{scanSuccessModal.totalPiecesSoFar}</span>
              </div>
            </div>

            {/* Status confirmation pill */}
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>পণ্যটি লোডিং তালিকায় যোগ হয়েছে</span>
            </div>

            {/* Action button */}
            <button
              type="button"
              onClick={() => {
                if (successModalTimerRef.current) clearTimeout(successModalTimerRef.current);
                setScanSuccessModal(null);
                barcodeInputRef.current?.focus();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0260e8] hover:bg-blue-700 py-3 text-sm font-black text-white shadow-md active:scale-98 transition cursor-pointer"
            >
              <span>পরবর্তী স্ক্যান</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── 9. CONFIRM DISPATCH & PRINT CHALLAN MODAL ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold">
                  {isDeliveryMan ? <Send className="h-5 w-5" /> : <Printer className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {isDeliveryMan ? 'সকালের লোডিং সাবমিট কনফার্মেশন' : 'গেটপাস চালান কনফার্মেশন'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isDeliveryMan ? 'এডমিন অনুমোদনের জন্য ভ্যান লোডিং সাবমিট করুন' : 'ভ্যান লোডিং তথ্য ও স্টক যাচাই'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary details */}
            <div className="space-y-2 rounded-2xl bg-slate-50 p-3.5 text-xs font-bold text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400">রুট:</span>
                <span className="text-slate-900">{selectedRoute?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ডেলিভারি ম্যান:</span>
                <span className="text-slate-900">
                  {selectedDeliveryMan?.name || selectedDeliveryMan?.username || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ভ্যান নম্বর:</span>
                <span className="text-slate-900">{vehicleNote || 'সাধারণ ভ্যান'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">তারিখ:</span>
                <span className="text-slate-900">{dispatchDate}</span>
              </div>
              <div className="border-t border-slate-200/80 pt-2 flex justify-between">
                <span className="text-slate-400">মোট পেইড কার্টুন:</span>
                <span className="text-blue-700 font-black">{metrics.totalPaidCartons}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">মোট ফ্রি পিস:</span>
                <span className="text-amber-700 font-black">{metrics.totalFreePieces}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">মোট ভ্যানে মাল:</span>
                <span className="text-emerald-700 font-black">
                  {metrics.totalVanPieces} পিস
                </span>
              </div>
              <div className="border-t border-slate-200/80 pt-2 flex justify-between text-sm">
                <span className="text-slate-700 font-black">মোট বিল মূল্য:</span>
                <span className="text-slate-900 font-black">
                  {formatCurrency(metrics.totalAmount)}
                </span>
              </div>
            </div>

            {/* Stock shortage warnings */}
            {stockShortages.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>স্টক ঘাটতি সতর্কতা ({stockShortages.length} টি পণ্য)</span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-0.5 text-[11px]">
                  {stockShortages.map((s) => {
                    const totalPcs = s.cartonCount * s.packSize + s.loosePieces + s.freePieces;
                    return (
                      <div key={s.productId} className="flex justify-between">
                        <span className="truncate">{s.productName}</span>
                        <span className="font-bold">
                          চাওয়া: {totalPcs} | স্টক: {s.currentStock}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={executeDispatchConfirmation}
                disabled={isSaving}
                className="flex-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0260e8] hover:bg-blue-700 py-2.5 text-xs font-black text-white shadow-md active:scale-98 transition disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : isDeliveryMan ? (
                  <Send className="h-4 w-4" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                <span>{isDeliveryMan ? 'হ্যাঁ, লোডিং সাবমিট করুন' : 'চালান কনফার্ম ও প্রিন্ট'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
