'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState, Suspense } from 'react';
import { getCompanies } from '@/lib/api/companies';
import { getProducts } from '@/lib/api/products';
import { createPurchase, getCompanyPayments } from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, toNumber } from '@/lib/utils/format';
import type { Company, Product, PurchasePayment, Purchase } from '@/types/api';
import {
  Building2,
  Calendar,
  Package,
  Plus,
  ArrowLeft,
  Search,
  Trash2,
  Wallet,
  Truck,
  FileCheck,
  Hash,
  Layers,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Printer,
  X,
  FileText,
  Warehouse,
  UserCheck,
  HelpCircle,
} from 'lucide-react';

export type PurchaseRowItem = {
  id: string;
  productId: number | '';
  productName: string;
  sku?: string;
  orderedQty?: number | string;
  quantity: string;
  unitPrice: string;
  unit?: string;
  note?: string;
  searchText?: string;
  showResults?: boolean;
};

const initialRow = (): PurchaseRowItem => ({
  id: 'row-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
  productId: '',
  productName: '',
  sku: '',
  quantity: '1',
  unitPrice: '',
  unit: 'Pcs',
  note: '',
  searchText: '',
  showResults: false,
});

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const mins = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

export function CreatePurchasePage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading..." />}>
      <CreatePurchaseContent />
    </Suspense>
  );
}

function CreatePurchaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCompanyIdParam = searchParams.get('companyId');
  const initialPaymentIdParam = searchParams.get('paymentId');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [companyPayments, setCompanyPayments] = useState<PurchasePayment[]>([]);

  const [companyId, setCompanyId] = useState<string>(initialCompanyIdParam || '');
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(
    initialPaymentIdParam ? Number(initialPaymentIdParam) : null,
  );
  const [purchaseDate, setPurchaseDate] = useState(formatDateInput(new Date()));
  const [invoiceNo, setInvoiceNo] = useState(
    `CHL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Date.now().toString().slice(-4)}`,
  );
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [warehouseName, setWarehouseName] = useState('Main Godown');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [note, setNote] = useState('');
  const [confirmStockIn, setConfirmStockIn] = useState(true);
  const [paidAmountInput, setPaidAmountInput] = useState('');

  const [items, setItems] = useState<PurchaseRowItem[]>([initialRow()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [savedResult, setSavedResult] = useState<Purchase | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  useToastNotification({
    message: toastMessage,
    title: toastTone === 'success' ? 'Success' : 'Error',
    tone: toastTone,
  });

  // Load initial data (companies and products)
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const [compList, prodList] = await Promise.all([
          getCompanies().catch(() => []),
          getProducts().catch(() => []),
        ]);
        setCompanies(compList);
        const prods = Array.isArray(prodList) ? prodList : (prodList as any)?.data || [];
        setAllProducts(prods);

        if (!companyId && compList.length > 0) {
          setCompanyId(String(compList[0].id));
        }
      } catch (err: any) {
        setToastTone('error');
        setToastMessage(err.message || 'Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    }
    void init();
  }, []);

  // Fetch company payments whenever selected company changes
  useEffect(() => {
    if (!companyId) {
      setCompanyPayments([]);
      return;
    }
    async function loadPayments() {
      try {
        const pays = await getCompanyPayments({ companyId: Number(companyId) });
        const list = Array.isArray(pays) ? pays : [];
        setCompanyPayments(list);

        // Auto-select if requested in URL, OR if there is an active advance payment/order
        if (initialPaymentIdParam) {
          const match = list.find((p) => p.id === Number(initialPaymentIdParam));
          if (match) {
            applyPaymentBreakdown(match, allProducts);
            return;
          }
        }

        // If user already had a selected payment
        if (selectedPaymentId) {
          const match = list.find((p) => p.id === selectedPaymentId);
          if (match) {
            applyPaymentBreakdown(match, allProducts);
            return;
          }
        }

        // If exactly 1 payment/order exists for this company, auto-select it for convenience!
        if (list.length === 1) {
          applyPaymentBreakdown(list[0], allProducts);
        }
      } catch {
        setCompanyPayments([]);
      }
    }
    void loadPayments();
  }, [companyId, allProducts.length]);

  const selectedCompany = useMemo(
    () => companies.find((c) => String(c.id) === companyId),
    [companies, companyId],
  );

  const selectedPayment = useMemo(
    () => companyPayments.find((p) => p.id === selectedPaymentId),
    [companyPayments, selectedPaymentId],
  );

  // Filter products for the selected company if assigned
  const companyFilteredProducts = useMemo(() => {
    if (!companyId) return allProducts;
    const cid = Number(companyId);
    const matched = allProducts.filter((p) => p.companyId === cid);
    return matched.length > 0 ? matched : allProducts;
  }, [allProducts, companyId]);

  // Safely parse breakdown from array or JSON string
  const parseBreakdown = (payment: PurchasePayment): any[] => {
    if (Array.isArray(payment.productBreakdown)) {
      return payment.productBreakdown;
    }
    if (typeof payment.productBreakdown === 'string') {
      try {
        const parsed = JSON.parse(payment.productBreakdown);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
    return [];
  };

  // Auto populate rows when a payment / order is selected
  const applyPaymentBreakdown = (payment: PurchasePayment, productList = allProducts) => {
    setSelectedPaymentId(payment.id);
    setPaidAmountInput(String(payment.amount));

    if (payment.note && !note) {
      setNote(`Challan adjustment for Payment #${payment.id}: ${payment.note}`);
    }

    let breakdownList = parseBreakdown(payment);

    // Fallback: If breakdownList is empty, but payment has note with product info
    if (breakdownList.length === 0 && payment.note && productList.length > 0) {
      const matched = productList.filter((p) =>
        payment.note!.toLowerCase().includes(p.name.toLowerCase()),
      );
      if (matched.length > 0) {
        breakdownList = matched.map((p) => ({
          productId: p.id,
          productName: p.name,
          quantity: 1,
          unitPrice: p.buyPrice || 0,
          unit: p.unit || 'Pcs',
        }));
      }
    }

    if (breakdownList.length > 0) {
      const newRows: PurchaseRowItem[] = breakdownList.map((b: any, idx: number) => {
        const matchedProd = productList.find(
          (p) =>
            p.id === Number(b.productId) ||
            (b.productName && p.name.trim().toLowerCase() === String(b.productName).trim().toLowerCase()),
        );
        const price =
          b.unitPrice != null && b.unitPrice !== ''
            ? Number(b.unitPrice)
            : matchedProd ? matchedProd.buyPrice : 0;
        const qty = b.quantity != null && b.quantity !== '' ? Number(b.quantity) : 1;

        return {
          id: 'row-' + Date.now() + '-' + idx,
          productId: b.productId ? Number(b.productId) : matchedProd ? matchedProd.id : '',
          productName: b.productName || matchedProd?.name || '',
          sku: matchedProd?.sku || '',
          orderedQty: qty,
          quantity: String(qty), // default received = ordered qty
          unitPrice: price ? String(price) : '',
          unit: b.unit || matchedProd?.unit || 'Pcs',
          note: b.note || '',
          searchText: b.productName || matchedProd?.name || '',
          showResults: false,
        };
      });

      if (newRows.length > 0) {
        setItems(newRows);
        setToastTone('success');
        setToastMessage(`Loaded ${newRows.length} ordered items from Draft #${payment.id}!`);
        return;
      }
    }

    // If general payment without breakdown, provide a fresh clean row
    setItems([initialRow()]);
    setToastTone('success');
    setToastMessage(`Payment #${payment.id} (৳${payment.amount}) linked with invoice!`);
  };

  // Deselect payment
  const handleClearSelectedPayment = () => {
    setSelectedPaymentId(null);
    setPaidAmountInput('0');
    setToastTone('success');
    setToastMessage('Payment unlinked. Manual invoice entry mode active.');
  };

  // Row Manipulation
  const handleAddRow = () => {
    setItems((prev) => [...prev, initialRow()]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length === 1) {
      setItems([initialRow()]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectProduct = (index: number, product: Product) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: product.id,
        productName: product.name,
        sku: product.sku || '',
        searchText: product.name,
        unit: product.unit || 'Pcs',
        unitPrice: String(product.buyPrice || ''),
        showResults: false,
      };
      return next;
    });
  };

  const handleUpdateRow = (index: number, field: keyof PurchaseRowItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };

      if (field === 'searchText') {
        next[index].showResults = true;
        const val = String(value).trim().toLowerCase();
        if (val) {
          const matched = companyFilteredProducts.find(
            (p) =>
              p.name.toLowerCase() === val ||
              p.sku?.toLowerCase() === val ||
              p.name.toLowerCase().startsWith(val),
          );
          if (matched) {
            next[index].productId = matched.id;
            next[index].productName = matched.name;
            next[index].sku = matched.sku || '';
            next[index].unit = matched.unit || 'Pcs';
            if (!next[index].unitPrice && matched.buyPrice) {
              next[index].unitPrice = String(matched.buyPrice);
            }
          }
        }
      }

      return next;
    });
  };

  // Total invoice sum (Total Received Goods Value)
  const invoiceTotal = useMemo(() => {
    return items.reduce((sum, row) => {
      const q = parseFloat(row.quantity || '0');
      const p = parseFloat(row.unitPrice || '0');
      if (!isNaN(q) && !isNaN(p) && q > 0 && p >= 0) {
        return sum + q * p;
      }
      return sum;
    }, 0);
  }, [items]);

  // Total Ordered Goods Value from order breakdown
  const orderedTotal = useMemo(() => {
    return items.reduce((sum, row) => {
      const q = typeof row.orderedQty === 'number' ? row.orderedQty : parseFloat(String(row.orderedQty || '0'));
      const p = parseFloat(row.unitPrice || '0');
      if (!isNaN(q) && !isNaN(p) && q > 0 && p >= 0) {
        return sum + q * p;
      }
      return sum;
    }, 0);
  }, [items]);

  const totalOrderedQtyCount = useMemo(() => {
    return items.reduce((sum, row) => {
      const q = typeof row.orderedQty === 'number' ? row.orderedQty : parseFloat(String(row.orderedQty || '0'));
      return sum + (!isNaN(q) ? q : 0);
    }, 0);
  }, [items]);

  const totalReceivedQtyCount = useMemo(() => {
    return items.reduce((sum, row) => {
      const q = parseFloat(row.quantity || '0');
      return sum + (!isNaN(q) && q > 0 ? q : 0);
    }, 0);
  }, [items]);

  const totalShortQtyCount = Math.max(0, totalOrderedQtyCount - totalReceivedQtyCount);

  const effectivePaid = useMemo(() => {
    const val = parseFloat(paidAmountInput);
    if (!isNaN(val) && val >= 0) return val;
    if (selectedPaymentId) {
      const match = companyPayments.find((p) => p.id === selectedPaymentId);
      if (match) return toNumber(match.amount);
    }
    return 0;
  }, [paidAmountInput, selectedPaymentId, companyPayments]);

  const remainingDue = Math.max(0, invoiceTotal - effectivePaid);
  const remainingAdvance = Math.max(0, effectivePaid - invoiceTotal);
  const isExactMatch = Math.abs(invoiceTotal - effectivePaid) < 0.01;

  // Trigger confirmation dialog
  const handleInitiateSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!companyId) {
      setToastTone('error');
      setToastMessage('Please select a company');
      return;
    }

    const validItems = items.filter(
      (item) => item.productId && parseFloat(item.quantity) > 0 && parseFloat(item.unitPrice) >= 0,
    );

    if (validItems.length === 0) {
      setToastTone('error');
      setToastMessage('Please enter at least 1 valid product with received quantity and buy price');
      return;
    }

    setShowConfirmModal(true);
  };

  // Actual Save Execution
  const executeSavePurchase = async () => {
    const validItems = items.filter(
      (item) => item.productId && parseFloat(item.quantity) > 0 && parseFloat(item.unitPrice) >= 0,
    );

    try {
      setIsSaving(true);
      setShowConfirmModal(false);

      const payload = {
        companyId: Number(companyId),
        purchaseDate: new Date(purchaseDate).toISOString(),
        invoiceNo: invoiceNo.trim() || undefined,
        referenceNo: invoiceNo.trim() || undefined,
        supplierName: supplierName.trim() || undefined,
        supplierInvoiceNo: supplierInvoiceNo.trim() || undefined,
        warehouseName: warehouseName.trim() || undefined,
        vehicleNo: vehicleNo.trim() || undefined,
        driverName: driverName.trim() || undefined,
        note: note.trim() || undefined,
        paymentId: selectedPaymentId ?? undefined,
        paidAmount: effectivePaid,
        status: confirmStockIn ? ('CONFIRMED' as const) : ('DRAFT' as const),
        confirmStockIn: confirmStockIn,
        items: validItems.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          unitCost: Number(item.unitPrice),
        })),
      };

      const result = await createPurchase(payload);

      setSavedResult(result);
      setToastTone('success');
      setToastMessage(
        confirmStockIn
          ? `Invoice #${result.invoiceNo || result.id} created and stock received successfully!`
          : `Invoice #${result.invoiceNo || result.id} saved as draft!`,
      );
    } catch (err: any) {
      setToastTone('error');
      setToastMessage(err.message || 'Failed to save challan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 text-slate-800">
      {/* 🌟 1. Top Navigation & Page Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <Link
              href="/purchases"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-200 backdrop-blur-md mb-3 hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Invoices</span>
            </Link>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-lg bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                Step 2 • Goods In & Reconciliation
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
              Receive Challan & Stock In
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Select a supplier's previous bank draft or pre-order to automatically load ordered products, reconcile actual received quantities, and update warehouse stock.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => router.push('/purchases')}
              className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-bold text-white hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleInitiateSubmit}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              <FileCheck className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : '💾 Save Challan & Receive Stock'}</span>
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <LoadingBlock label="Loading challan and bank draft records..." />
        </div>
      ) : (
        <form onSubmit={handleInitiateSubmit} className="space-y-6">
          
          {/* 🏦 CARD 1: SELECT BANK DRAFT / PRE-ORDER */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    1. Select Bank Draft / Pre-Order
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select a previously issued bank draft to auto-populate ordered items
                  </p>
                </div>
              </div>

              {selectedPaymentId && (
                <button
                  type="button"
                  onClick={handleClearSelectedPayment}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors self-start sm:self-auto"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Unlink Payment (Direct Mode)</span>
                </button>
              )}
            </div>

            {/* Supplier / Company Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Select Supplier / Company <span className="text-rose-500">*</span>
                </label>
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setSelectedPaymentId(null);
                    setPaidAmountInput('');
                    setItems([initialRow()]);
                  }}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                >
                  <option value="">-- Select Company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(Code: ${c.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCompany && (
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{selectedCompany.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Code: <b>{selectedCompany.code || 'N/A'}</b> • Phone: {selectedCompany.phone || 'N/A'}
                      </p>
                    </div>
                    {companyPayments.length > 0 ? (
                      <span className="rounded-xl bg-indigo-100 text-indigo-800 px-3 py-1 text-xs font-bold">
                        {companyPayments.length} Draft / Payment Records Available
                      </span>
                    ) : (
                      <span className="rounded-xl bg-amber-100 text-amber-800 px-3 py-1 text-xs font-bold">
                        No draft records found
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Bank Draft Cards */}
            {companyPayments.length > 0 && (
              <div className="pt-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  Available Bank Drafts (Click to load):
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {companyPayments.map((pay) => {
                    const isSelected = selectedPaymentId === pay.id;
                    const breakdown = parseBreakdown(pay);
                    const hasBreakdown = breakdown.length > 0;

                    return (
                      <div
                        key={pay.id}
                        onClick={() => applyPaymentBreakdown(pay)}
                        className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/90 ring-2 ring-indigo-600/30 shadow-md scale-[1.01]'
                            : 'border-slate-200 bg-slate-50/70 hover:border-indigo-300 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded-lg px-2.5 py-0.5 text-xs font-black ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              Draft #{pay.id}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {pay.paymentDate ? formatDate(pay.paymentDate) : ''}
                            </span>
                          </div>
                          <span className="text-base font-black text-emerald-700">
                            {formatCurrency(pay.amount)}
                          </span>
                        </div>

                        {pay.transactionRef && (
                          <p className="mt-1.5 text-xs font-bold text-indigo-900 font-mono">
                            Ref: {pay.transactionRef}
                          </p>
                        )}

                        <p className="mt-1 text-xs text-slate-600 line-clamp-2 font-medium">
                          {pay.note || `Method: ${pay.paymentMethod}`}
                        </p>

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                          <span className="text-[11px] font-bold text-indigo-700">
                            {hasBreakdown
                              ? `📦 ${breakdown.length} Pre-Ordered Items`
                              : '💸 General Payment'}
                          </span>
                          <span
                            className={`font-bold text-xs ${
                              isSelected
                                ? 'text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full'
                                : 'text-slate-600 group-hover:text-indigo-600'
                            }`}
                          >
                            {isSelected ? '✓ Loaded' : '👉 Load'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 📋 CARD 2: PRE-ORDER SUMMARY CARD (Shown when draft is selected) */}
          {selectedPayment && (
            <div className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-indigo-50/40 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 text-indigo-900 font-black text-sm uppercase tracking-wider mb-3">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <span>2. Pre-Order & Draft Summary</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="rounded-xl bg-white p-3 border border-indigo-100">
                  <span className="text-slate-500 font-medium block">Draft No</span>
                  <b className="text-indigo-950 font-bold font-mono mt-0.5 block text-sm">
                    {selectedPayment.transactionRef || `#${selectedPayment.id}`}
                  </b>
                </div>

                <div className="rounded-xl bg-white p-3 border border-indigo-100">
                  <span className="text-slate-500 font-medium block">Supplier</span>
                  <b className="text-slate-900 font-bold mt-0.5 block truncate text-sm">
                    {selectedCompany?.name || 'Company'}
                  </b>
                </div>

                <div className="rounded-xl bg-white p-3 border border-indigo-100">
                  <span className="text-slate-500 font-medium block">Draft Paid</span>
                  <b className="text-emerald-700 font-black mt-0.5 block text-sm">
                    {formatCurrency(selectedPayment.amount)}
                  </b>
                </div>

                <div className="rounded-xl bg-white p-3 border border-indigo-100">
                  <span className="text-slate-500 font-medium block">Order Value</span>
                  <b className="text-indigo-900 font-black mt-0.5 block text-sm">
                    {formatCurrency(orderedTotal > 0 ? orderedTotal : selectedPayment.amount)}
                  </b>
                </div>

                <div className="rounded-xl bg-white p-3 border border-indigo-100">
                  <span className="text-slate-500 font-medium block">Order Qty</span>
                  <b className="text-slate-800 font-black mt-0.5 block text-sm">
                    {totalOrderedQtyCount} Items
                  </b>
                </div>

                <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200">
                  <span className="text-emerald-700 font-bold block">Current Status</span>
                  <b className="text-emerald-900 font-black mt-0.5 block text-sm">
                    {remainingAdvance > 0 ? `Advance: ৳${remainingAdvance}` : 'Ready to Reconcile'}
                  </b>
                </div>
              </div>
            </div>
          )}

          {/* 📄 CARD 3: CHALLAN INFORMATION */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <FileText className="h-4 w-4" />
              <span>3. Challan & Logistics Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Challan / Invoice No <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    required
                    placeholder="CHL-2026-..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Challan Date & Time <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="datetime-local"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Supplier Invoice / Memo No
                </label>
                <input
                  type="text"
                  value={supplierInvoiceNo}
                  onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                  placeholder="e.g. INV-88910"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Warehouse / Godown
                </label>
                <div className="relative">
                  <Warehouse className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Vehicle / Truck No (Optional)
                </label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="e.g. DHAKA METRO-TA-12-3456"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Driver / Delivery Person (Optional)
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Rafiqul Islam"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Challan Notes / Remarks
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Additional notes about this challan..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>

          {/* 📦 CARD 4: ORDERED VS RECEIVED TABLE (MAIN RECONCILIATION TABLE) */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-base">
                  <Layers className="h-5 w-5" />
                  <span>4. Product Items & Stock Receiving</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Match ordered quantities with actual received counts. Remaining quantity and total values calculate automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-all self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add Extra Item</span>
              </button>
            </div>

            {/* Desktop Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-3 rounded-2xl bg-slate-100/90 text-xs font-black uppercase tracking-wider text-slate-700">
              <div className="col-span-1 text-center w-8">SL</div>
              <div className="col-span-3">PRODUCT & SKU</div>
              <div className="col-span-2 text-center">ORDER QTY</div>
              <div className="col-span-2 text-center bg-indigo-100/70 text-indigo-900 rounded-lg py-0.5">
                RECEIVED QTY *
              </div>
              <div className="col-span-1 text-center">SHORTAGE</div>
              <div className="col-span-1 text-right">PRICE (৳) *</div>
              <div className="col-span-1 text-right">TOTAL (৳)</div>
              <div className="col-span-1 text-center">STATUS</div>
            </div>

            {/* Product Rows */}
            <div className="space-y-3">
              {items.map((row, idx) => {
                const q = parseFloat(row.quantity || '0');
                const p = parseFloat(row.unitPrice || '0');
                const lineTotal = !isNaN(q) && !isNaN(p) && q > 0 && p >= 0 ? q * p : 0;
                const ordQ =
                  row.orderedQty !== undefined && row.orderedQty !== null && row.orderedQty !== ''
                    ? typeof row.orderedQty === 'number'
                      ? row.orderedQty
                      : parseFloat(String(row.orderedQty))
                    : null;

                const diff = ordQ !== null ? q - ordQ : 0;
                const isShort = ordQ !== null && q < ordQ;
                const isExact = ordQ !== null && q === ordQ;
                const isExtra = ordQ !== null && q > ordQ;

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:bg-white hover:border-slate-300"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                      {/* Index */}
                      <div className="hidden lg:block lg:col-span-1 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </div>

                      {/* Product Selector / Search */}
                      <div className="lg:col-span-3 relative">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          Product & SKU
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={row.searchText || row.productName}
                            onChange={(e) => handleUpdateRow(idx, 'searchText', e.target.value)}
                            onFocus={() => handleUpdateRow(idx, 'showResults', true)}
                            placeholder="Product name or SKU..."
                            className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        </div>

                        {row.showResults && (
                          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                            {companyFilteredProducts
                              .filter(
                                (prod) =>
                                  !row.searchText ||
                                  prod.name.toLowerCase().includes(row.searchText.toLowerCase()) ||
                                  prod.sku?.toLowerCase().includes(row.searchText.toLowerCase()),
                              )
                              .map((prod) => (
                                <button
                                  type="button"
                                  key={prod.id}
                                  onClick={() => handleSelectProduct(idx, prod)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 border-b border-slate-100 flex items-center justify-between"
                                >
                                  <div>
                                    <p className="font-bold text-slate-800">{prod.name}</p>
                                    <p className="text-[10px] text-slate-400">
                                      SKU: {prod.sku || 'N/A'} • {prod.unit || 'Pcs'}
                                    </p>
                                  </div>
                                  <span className="font-bold text-indigo-600">
                                    ৳{prod.buyPrice?.toFixed(2) || '0.00'}
                                  </span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Order Quantity Display (READ-ONLY) */}
                      <div className="lg:col-span-2 text-left lg:text-center">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          Order Qty
                        </label>
                        {ordQ !== null ? (
                          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-200/80 px-3 py-1.5 text-xs font-black text-slate-800 border border-slate-300">
                            <span>📦 {ordQ}</span>
                            <span className="text-[11px] font-semibold text-slate-600">{row.unit || 'PCS'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">— (Direct Entry)</span>
                        )}
                      </div>

                      {/* Actually Received Quantity (EDITABLE Input) */}
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          Actual Received Qty *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={row.quantity}
                            onChange={(e) => handleUpdateRow(idx, 'quantity', e.target.value)}
                            className={`w-full rounded-xl border px-3 py-2 text-center text-xs font-black text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                              isShort
                                ? 'border-amber-400 bg-amber-50/90 focus:ring-amber-400/20'
                                : isExtra
                                ? 'border-indigo-400 bg-indigo-50/90 focus:ring-indigo-400/20'
                                : 'border-emerald-400 bg-emerald-50/50 focus:border-emerald-500 focus:ring-emerald-500/20'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Remaining / Short Qty */}
                      <div className="lg:col-span-1 text-left lg:text-center">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          Shortage / Balance
                        </label>
                        {ordQ !== null ? (
                          diff === 0 ? (
                            <span className="text-emerald-700 font-bold text-xs">0 (Full)</span>
                          ) : diff < 0 ? (
                            <span className="text-rose-600 font-black text-xs">{Math.abs(diff)} Short</span>
                          ) : (
                            <span className="text-indigo-600 font-bold text-xs">+{diff} Excess</span>
                          )
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </div>

                      {/* Buy Rate ৳ */}
                      <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          Purchase Price (৳) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={row.unitPrice}
                          onChange={(e) => handleUpdateRow(idx, 'unitPrice', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-right text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Line Total ৳ */}
                      <div className="lg:col-span-1 text-left lg:text-right">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden mb-1">
                          Received Total (৳)
                        </label>
                        <span className="text-xs font-black text-slate-900">
                          {formatCurrency(lineTotal)}
                        </span>
                      </div>

                      {/* Status Badge & Delete */}
                      <div className="lg:col-span-1 flex items-center justify-between lg:justify-center gap-2">
                        <label className="block text-xs font-bold text-slate-500 lg:hidden">
                          Status:
                        </label>
                        {ordQ !== null ? (
                          q >= ordQ ? (
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              🟢 Complete
                            </span>
                          ) : q > 0 ? (
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              🟡 Partial
                            </span>
                          ) : (
                            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                              🔴 Pending
                            </span>
                          )
                        ) : (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            Direct
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add More Items</span>
              </button>

              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="text-slate-600">
                  Total Ordered: <b className="text-slate-900">{totalOrderedQtyCount}</b>
                </span>
                <span className="text-indigo-700">
                  Total Received: <b className="text-indigo-950 font-black">{totalReceivedQtyCount}</b>
                </span>
                {totalShortQtyCount > 0 && (
                  <span className="text-rose-600 font-black bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                    Shortage: {totalShortQtyCount} items
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 💰 CARD 5: LIVE RECONCILIATION PANEL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span>5. Stock Receiving & Inventory Confirmation</span>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="confirmStockIn"
                  checked={confirmStockIn}
                  onChange={(e) => setConfirmStockIn(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="confirmStockIn" className="cursor-pointer text-xs">
                  <p className="font-black text-emerald-900">
                    📦 Add received goods to warehouse stock immediately (Auto Stock-In)
                  </p>
                  <p className="text-emerald-700 font-medium mt-0.5">
                    When checked, saving this invoice directly updates warehouse stock balances and purchase costs.
                  </p>
                </label>
              </div>

              <div className="space-y-2 text-xs text-slate-500">
                <p>• A stock movement record will be logged for every received product.</p>
                <p>• For partial deliveries under a bank draft, remaining items can be received in future challans.</p>
              </div>
            </div>

            {/* Reconciliation Box Panel */}
            <div className="lg:col-span-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-white shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
                  💰 Financial Reconciliation
                </span>
                <span className="text-xs font-bold text-slate-300">
                  {isExactMatch ? '✓ Fully Balanced' : 'Ongoing Reconciliation'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">1. Advance Paid:</span>
                  <span className="font-black text-indigo-300 text-sm">{formatCurrency(effectivePaid)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-300">2. Pre-Order Total Value:</span>
                  <span className="font-bold text-slate-200 text-sm">
                    {formatCurrency(orderedTotal > 0 ? orderedTotal : effectivePaid)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-slate-300">3. Received Goods Value:</span>
                  <span className="font-black text-emerald-400 text-base">{formatCurrency(invoiceTotal)}</span>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {remainingAdvance > 0
                      ? '💎 Remaining Advance Balance:'
                      : remainingDue > 0
                      ? '⚠️ Outstanding Due (Payable):'
                      : '4. Status:'}
                  </span>
                  <span
                    className={`text-xl font-black ${
                      remainingAdvance > 0
                        ? 'text-sky-300'
                        : remainingDue > 0
                        ? 'text-rose-400'
                        : 'text-emerald-300'
                    }`}
                  >
                    {remainingAdvance > 0
                      ? formatCurrency(remainingAdvance)
                      : remainingDue > 0
                      ? formatCurrency(remainingDue)
                      : 'Fully Paid (0.00)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ⚓ BOTTOM STICKY ACTION BAR */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 px-4 sm:px-8 shadow-2xl">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-4 sm:gap-6 text-xs flex-wrap">
                <div>
                  <span className="text-slate-500 font-medium block">Advance Draft:</span>
                  <b className="text-slate-900 font-black text-sm">{formatCurrency(effectivePaid)}</b>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Received Goods Value:</span>
                  <b className="text-indigo-900 font-black text-sm">{formatCurrency(invoiceTotal)}</b>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Remaining Advance / Due:</span>
                  <b
                    className={`font-black text-sm ${
                      remainingAdvance > 0 ? 'text-emerald-700' : remainingDue > 0 ? 'text-rose-600' : 'text-slate-800'
                    }`}
                  >
                    {remainingAdvance > 0
                      ? `+${formatCurrency(remainingAdvance)}`
                      : remainingDue > 0
                      ? `-${formatCurrency(remainingDue)}`
                      : '0.00 (Balanced)'}
                  </b>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => router.push('/purchases')}
                  className="rounded-2xl border border-slate-200 hover:bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  <FileCheck className="h-4 w-4" />
                  <span>{isSaving ? 'Saving...' : '💾 Save Challan & Receive Stock'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ⚠️ CONFIRMATION DIALOG MODAL (Before saving) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Confirm Challan & Stock Receiving
                </h3>
                <p className="text-xs text-slate-500">
                  Do you want to confirm this invoice and receive stock into the warehouse?
                </p>
              </div>
            </div>

            <div className="space-y-2.5 rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs my-4">
              <div className="flex justify-between text-slate-600">
                <span>Supplier:</span>
                <span className="font-bold text-slate-900">{selectedCompany?.name || 'Company'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Received Quantity:</span>
                <span className="font-black text-indigo-900">{totalReceivedQtyCount} Qty</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Received Value:</span>
                <span className="font-black text-slate-900">{formatCurrency(invoiceTotal)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold">
                <span>Remaining Advance Balance:</span>
                <span className="text-emerald-700 font-black">{formatCurrency(remainingAdvance)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={executeSavePurchase}
                disabled={isSaving}
                className="flex-1 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Yes, Receive Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 SUCCESS MODAL DIALOG (After successful stock in) */}
      {savedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 animate-scaleUp">
            {/* Header / Success Icon */}
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                {confirmStockIn
                  ? 'Invoice saved and stock received successfully!'
                  : 'Invoice draft saved successfully!'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Invoice No: <b className="text-indigo-900 font-mono font-bold">#{savedResult.invoiceNo || savedResult.id}</b>
              </p>
            </div>

            {/* Summary Breakdown */}
            <div className="my-6 space-y-3 rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Supplier / Company:</span>
                <span className="font-bold text-slate-900">{selectedCompany?.name || 'Company'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Received Goods Value:</span>
                <span className="font-black text-slate-900 text-sm">{formatCurrency(invoiceTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Amount Paid via Bank Draft:</span>
                <span className="font-black text-indigo-900 text-sm">{formatCurrency(effectivePaid)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold">
                <span>Remaining Advance Balance:</span>
                {remainingAdvance > 0 ? (
                  <span className="text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg font-black">
                    💎 {formatCurrency(remainingAdvance)}
                  </span>
                ) : remainingDue > 0 ? (
                  <span className="text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg font-black">
                    ⚠️ Due: {formatCurrency(remainingDue)}
                  </span>
                ) : (
                  <span className="text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg font-black">
                    ✅ Fully Settled (Zero Due)
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <Link
                href={`/purchases/${savedResult.id}/print-challan`}
                target="_blank"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-98"
              >
                <Printer className="h-4 w-4" />
                <span>🖨️ Print Challan Voucher</span>
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/purchases')}
                  className="flex-1 rounded-2xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-700 transition-colors text-center"
                >
                  📑 All Invoices
                </button>
                <button
                  type="button"
                  onClick={() => setSavedResult(null)}
                  className="flex-1 rounded-2xl border border-slate-200 hover:bg-slate-50 py-2.5 text-xs font-bold text-slate-600 transition-colors text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
