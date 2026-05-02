'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { getCompanies } from '@/lib/api/companies';
import { getProducts } from '@/lib/api/products';
import { getRoutes } from '@/lib/api/routes';
import { createSale, getSale, updateSale } from '@/lib/api/sales';
import { createShop, getShops } from '@/lib/api/shops';
import { getStockSummary } from '@/lib/api/stock';
import { LoadingBlock } from '@/components/ui/loading-block';
import { useAuth } from '../auth/auth-provider';
import { canViewProfit, canSeeBuyPrice } from '@/lib/utils/permissions';
import { PageCard } from '@/components/ui/page-card';
import { useToast, useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatDate, formatNumber, toNumber } from '@/lib/utils/format';
import type { Company, CreateShopPayload, Product, Route, Sale, Shop } from '@/types/api';
import { TrendingUp } from 'lucide-react';

type SaleItemForm = {
  id: string;
  productId: string;
  productSearch: string;
  quantity: string;
  unitPrice: string;
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  freeQuantity: string;
};

type PaymentMode = 'full' | 'due';

type ShopForm = {
  name: string;
  ownerName: string;
  phone: string;
  address: string;
};

const initialItem = (): SaleItemForm => ({
  id: `${Date.now()}-${Math.random()}`,
  productId: '',
  productSearch: '',
  quantity: '1',
  unitPrice: '',
  discountType: 'percentage',
  discountValue: '',
  freeQuantity: '',
});

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function formatMoneyInput(value: number) {
  return roundCurrency(value).toFixed(2);
}

function normalizeProductSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function formatProductSearchLabel(product: Product) {
  return `${product.name} (${product.unit})`;
}

function getProductSearchScore(product: Product, keyword: string) {
  const normalizedKeyword = normalizeProductSearchValue(keyword);

  if (!normalizedKeyword) {
    return 1;
  }

  const name = normalizeProductSearchValue(product.name);
  const sku = normalizeProductSearchValue(product.sku);
  const unit = normalizeProductSearchValue(product.unit);
  const companyName = normalizeProductSearchValue(product.company?.name ?? '');
  const companyCode = normalizeProductSearchValue(product.company?.code ?? '');
  const searchParts = normalizedKeyword.split(/\s+/).filter(Boolean);

  let score = 0;

  if (sku === normalizedKeyword) score += 220;
  else if (sku.startsWith(normalizedKeyword)) score += 180;
  else if (sku.includes(normalizedKeyword)) score += 130;

  if (name === normalizedKeyword) score += 210;
  else if (name.startsWith(normalizedKeyword)) score += 170;
  else if (name.includes(normalizedKeyword)) score += 125;

  if (companyCode === normalizedKeyword) score += 120;
  else if (companyCode.startsWith(normalizedKeyword)) score += 90;
  else if (companyCode.includes(normalizedKeyword)) score += 60;

  if (companyName === normalizedKeyword) score += 110;
  else if (companyName.startsWith(normalizedKeyword)) score += 80;
  else if (companyName.includes(normalizedKeyword)) score += 55;

  if (unit === normalizedKeyword) score += 40;
  else if (unit.includes(normalizedKeyword)) score += 20;

  if (
    searchParts.length > 1 &&
    searchParts.every(
      (part) =>
        name.includes(part) ||
        sku.includes(part) ||
        companyName.includes(part) ||
        companyCode.includes(part),
    )
  ) {
    score += 70;
  }

  return score;
}

function getAdvancedProductMatches(products: Product[], keyword: string, limit = 8) {
  const rankedMatches = products
    .map((product, index) => ({
      product,
      index,
      score: getProductSearchScore(product, keyword),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.index - right.index ||
        left.product.name.localeCompare(right.product.name),
    );

  return {
    matches: rankedMatches.slice(0, limit).map((entry) => entry.product),
    total: rankedMatches.length,
  };
}

export function CreateSalePage({ saleId }: { saleId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { success: showSuccessToast } = useToast();
  const showProfit = canViewProfit(user);
  const showBuyPrice = canSeeBuyPrice(user);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockSummary, setStockSummary] = useState<Record<number, number>>({});
  const [companyId, setCompanyId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [shopId, setShopId] = useState('');
  const [isCreateShopOpen, setIsCreateShopOpen] = useState(false);
  const [isCreatingShop, setIsCreatingShop] = useState(false);
  const [shopFormError, setShopFormError] = useState<string | null>(null);
  const [shopSuccessMessage, setShopSuccessMessage] = useState<string | null>(null);
  const [shopForm, setShopForm] = useState<ShopForm>({
    name: '',
    ownerName: '',
    phone: '',
    address: '',
  });
  const [saleDate, setSaleDate] = useState('');
  useEffect(() => {
    if (!saleId) {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      setSaleDate(new Date(now.getTime() - offset).toISOString().slice(0, 16));
    }
  }, [saleId]);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState('');
  const [paidAmount, setPaidAmount] = useState('0.00');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<SaleItemForm[]>([]);
  
  useEffect(() => {
    setItems([initialItem()]);
  }, []);
  const [activeProductSearchId, setActiveProductSearchId] = useState<string | null>(null);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaleLoading, setIsSaleLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);

  useToastNotification({
    message: error,
    title: 'Could not load sale form',
    tone: 'error',
  });
  useToastNotification({
    message: formError,
    title: 'Error',
    tone: 'error',
  });
  useToastNotification({
    message: successMessage,
    title: 'Success',
    tone: 'success',
  });
  useToastNotification({
    message: shopFormError,
    title: 'Could not create shop',
    tone: 'error',
  });
  useToastNotification({
    message: shopSuccessMessage,
    title: 'Shop created',
    tone: 'success',
  });

  useEffect(() => {
    async function loadSale() {
      if (!saleId) return;
      setIsSaleLoading(true);
      try {
        const sale = await getSale(Number(saleId));
        setCompanyId(String(sale.companyId));
        setRouteId(String(sale.routeId));
        setShopId(String(sale.shopId || ''));
        
        const date = new Date(sale.saleDate);
        const offset = date.getTimezoneOffset() * 60000;
        setSaleDate(new Date(date.getTime() - offset).toISOString().slice(0, 16));
        
        setInvoiceNo(sale.invoiceNo);
        setInvoiceDiscountType(sale.invoiceDiscountType === 'percentage' ? 'percentage' : 'fixed');
        setInvoiceDiscountValue(String(sale.invoiceDiscountValue || ''));
        setPaymentMode(toNumber(sale.dueAmount) > 0 ? 'due' : 'full');
        setPaidAmount(String(sale.paidAmount));
        setNote(sale.note || '');

        setItems(
          sale.items?.length
            ? sale.items.map((item) => ({
                id: String(item.id),
                productId: String(item.productId),
                productSearch: item.product?.name || '',
                quantity: String(item.quantity),
                unitPrice: String(item.unitPrice),
                discountType: item.discountType === 'percentage' ? 'percentage' : 'fixed',
                discountValue: String(item.discountValue || ''),
                freeQuantity: String(item.freeQuantity || ''),
              }))
            : [initialItem()],
        );
      } catch (e) {
        setFormError('Failed to load sale data');
      } finally {
        setIsSaleLoading(false);
      }
    }
    void loadSale();
  }, [saleId]);

  useEffect(() => {
    async function loadReferenceData() {
      try {
        setIsLoading(true);
        setError(null);
        const [companyData, routeData, productData] = await Promise.all([
          getCompanies(),
          getRoutes(),
          getProducts(),
        ]);

        setCompanies(companyData);
        setRoutes(routeData);
        setAllProducts(productData);
        if (!saleId) {
          setCompanyId(String(companyData[0]?.id ?? ''));
          setRouteId(String(routeData[0]?.id ?? ''));
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load sale form data.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadReferenceData();
  }, [saleId]);

  useEffect(() => {
    async function loadCompanyProducts() {
      if (!companyId) {
        setProducts([]);
        setItems((current) =>
          current.map((item) => ({
            ...item,
            productId: '',
            productSearch: '',
            unitPrice: '',
            discountValue: '',
            freeQuantity: '',
          })),
        );
        return;
      }

      try {
        const [productData, stockData] = await Promise.all([
          getProducts(Number(companyId)),
          getStockSummary(Number(companyId))
        ]);

        const stockMap: Record<number, number> = {};
        for (const item of stockData) {
          stockMap[item.productId] = item.currentStock;
        }

        setStockSummary(stockMap);
        setProducts(productData);
        setItems((current) =>
          current.map((item) => {
            const selectedProduct = productData.find(
              (product) => product.id === Number(item.productId),
            );

            if (
              item.productId &&
              productData.some((product) => product.id === Number(item.productId))
            ) {
              return {
                ...item,
                productSearch: selectedProduct
                  ? formatProductSearchLabel(selectedProduct)
                  : '',
                unitPrice:
                  item.unitPrice ||
                  (selectedProduct ? String(selectedProduct.salePrice) : ''),
              };
            }

            return {
              ...item,
              productId: '',
              productSearch: '',
              unitPrice: '',
              discountValue: '',
              freeQuantity: '',
            };
          }),
        );
      } catch (loadError) {
        setFormError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load company products.',
        );
      }
    }

    void loadCompanyProducts();
  }, [companyId]);

  async function refreshRouteShops(nextRouteId: string, selectedShopId?: string) {
    if (!nextRouteId) {
      setShops([]);
      setShopId('');
      return;
    }

    const shopData = await getShops(Number(nextRouteId));
    setShops(shopData);

    const preferredShopId = selectedShopId ?? shopId;
    if (preferredShopId && shopData.some((shop) => shop.id === Number(preferredShopId))) {
      setShopId(preferredShopId);
      return;
    }

    if (preferredShopId) {
      setShopId('');
    }
  }

  useEffect(() => {
    async function loadRouteShops() {
      try {
        await refreshRouteShops(routeId);
      } catch (loadError) {
        setFormError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load route shops.',
        );
      }
    }

    void loadRouteShops();
  }, [routeId]);

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );

  const selectedProducts = useMemo(
    () =>
      items.map((item) =>
        allProducts.find((product) => product.id === Number(item.productId)) ??
        products.find((product) => product.id === Number(item.productId)) ??
        null,
      ),
    [allProducts, items, products],
  );

  const itemCalculations = useMemo(
    () =>
      items.map((item, index) => {
        const product = selectedProducts[index];
        const quantity = Number(item.quantity || 0);
        const freeQty = Number(item.freeQuantity || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const buyPrice = product?.buyPrice ?? 0;

        const subTotal = quantity * unitPrice;
        let discountAmount = 0;
        const distValue = Number(item.discountValue || 0);

        if (distValue > 0) {
          if (item.discountType === 'percentage') {
            discountAmount = (subTotal * distValue) / 100;
          } else {
            discountAmount = distValue;
          }
        }

        const lineTotal = subTotal - discountAmount;
        const totalCost = buyPrice * (quantity + freeQty);
        const lineProfit = Math.max(0, lineTotal - totalCost);

        return {
          buyPrice,
          lineTotal,
          lineProfit,
        };
      }),
    [items, selectedProducts],
  );

  const subTotalAmount = useMemo(
    () => itemCalculations.reduce((sum, item) => sum + item.lineTotal, 0),
    [itemCalculations],
  );

  const invoiceDiscountAmount = useMemo(() => {
    const value = Number(invoiceDiscountValue || 0);
    if (value <= 0) return 0;
    if (invoiceDiscountType === 'percentage') {
      return (subTotalAmount * value) / 100;
    }
    return value;
  }, [invoiceDiscountValue, invoiceDiscountType, subTotalAmount]);

  const totalAmount = useMemo(
    () => subTotalAmount - invoiceDiscountAmount,
    [subTotalAmount, invoiceDiscountAmount],
  );

  const totalProfit = useMemo(
    () => itemCalculations.reduce((sum, item) => sum + item.lineProfit, 0) - invoiceDiscountAmount,
    [itemCalculations, invoiceDiscountAmount],
  );
  const normalizedPaidAmount = useMemo(
    () => roundCurrency(Number(paidAmount || 0)),
    [paidAmount],
  );
  const dueAmount = useMemo(
    () => roundCurrency(totalAmount - normalizedPaidAmount),
    [normalizedPaidAmount, totalAmount],
  );

  useEffect(() => {
    if (paymentMode !== 'full') {
      return;
    }

    setPaidAmount(formatMoneyInput(totalAmount));
  }, [paymentMode, totalAmount]);

  function buildFreshItems() {
    return [initialItem()];
  }

  function updateSaleItem(itemId: string, updater: (item: SaleItemForm) => SaleItemForm) {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? updater(item) : item)),
    );
  }

  function autoSelectProductForSearch(itemId: string, keyword: string) {
    const normalizedKeyword = normalizeProductSearchValue(keyword);
    const autoSelectionPool = allProducts.length > 0 ? allProducts : products;
    const bestMatch =
      normalizedKeyword.length >= 3
        ? getAdvancedProductMatches(autoSelectionPool, keyword, 1).matches[0]
        : undefined;

    updateSaleItem(itemId, (item) => ({
      ...item,
      productId: bestMatch ? String(bestMatch.id) : '',
      productSearch: keyword,
      unitPrice: bestMatch ? String(bestMatch.salePrice) : '',
    }));

    if (bestMatch && String(bestMatch.companyId) !== companyId) {
      setCompanyId(String(bestMatch.companyId));
    }
  }

  function selectProductForItem(itemId: string, nextProduct: Product) {
    updateSaleItem(itemId, (item) => ({
      ...item,
      productId: String(nextProduct.id),
      productSearch: formatProductSearchLabel(nextProduct),
      unitPrice: String(nextProduct.salePrice),
    }));
    if (String(nextProduct.companyId) !== companyId) {
      setCompanyId(String(nextProduct.companyId));
    }
    setActiveProductSearchId(null);
    setHighlightedProductIndex(0);
  }

  function prepareNextOrder(createdSale: Sale) {
    setInvoiceNo('');
    setPaymentMode('full');
    setInvoiceDiscountValue('');
    setPaidAmount('0.00');
    setNote('');
    setShopId('');
    setIsCreateShopOpen(false);
    setItems(buildFreshItems());
    setSuccessMessage(
      `Sale ${createdSale.invoiceNo} created. You can now enter the next order.`,
    );
    setRecentSales((current) => [createdSale, ...current].slice(0, 6));
  }

  async function submitSale(mode: 'details' | 'next' | 'print') {
    setFormError(null);
    setSuccessMessage(null);

    if (!companyId || !routeId) {
      setFormError('Please select both company and route.');
      return;
    }

    if (items.some((item) => !item.productId || Number(item.quantity) <= 0)) {
      setFormError('Each sale item needs a product and a quantity above zero.');
      return;
    }

    if (toNumber(totalAmount) <= 0) {
      setFormError('Add at least one sale item with valid quantity and price.');
      return;
    }

    if (mode === 'print' && !shopId) {
      setFormError('Select a shop before generating the invoice.');
      return;
    }

    if (toNumber(dueAmount) > 0 && !shopId) {
      setFormError('Shop is required when due amount is greater than zero.');
      return;
    }

    if (toNumber(dueAmount) < 0) {
      setFormError('Paid amount cannot be greater than total amount.');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        companyId: Number(companyId),
        routeId: Number(routeId),
        shopId: shopId ? Number(shopId) : undefined,
        saleDate: new Date(saleDate).toISOString(),
        invoiceNo: invoiceNo.trim() || undefined,
        invoiceDiscountType: Number(invoiceDiscountValue) > 0 ? invoiceDiscountType : undefined,
        invoiceDiscountValue: Number(invoiceDiscountValue) > 0 ? Number(invoiceDiscountValue) : undefined,
        paidAmount:
          paymentMode === 'full'
            ? roundCurrency(totalAmount)
            : normalizedPaidAmount,
        note: note.trim() || undefined,
        items: items.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountType: Number(item.discountValue) > 0 ? item.discountType : undefined,
          discountValue: Number(item.discountValue) > 0 ? Number(item.discountValue) : undefined,
          freeQuantity: item.freeQuantity ? Number(item.freeQuantity) : undefined,
        })),
      };

      if (saleId) {
        await updateSale(Number(saleId), payload);
        showSuccessToast('Sale updated successfully');
        router.push(`/sales/${saleId}`);
        return;
      }

      const sale = await createSale(payload);

      if (mode === 'next') {
        prepareNextOrder(sale);
        return;
      }

      if (mode === 'details') {
        router.push(`/sales/${sale.id}`);
      } else if (mode === 'print') {
        window.open(`/sales/${sale.id}/invoice`, '_blank');
        prepareNextOrder(sale);
      }
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : 'Failed to create sale.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitSale('details');
  }

  async function handleCreateShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShopFormError(null);
    setShopSuccessMessage(null);

    if (!routeId) {
      setShopFormError('Select a route before creating a shop.');
      return;
    }

    if (!shopForm.name.trim()) {
      setShopFormError('Shop name is required.');
      return;
    }

    try {
      setIsCreatingShop(true);

      const payload: CreateShopPayload = {
        routeId: Number(routeId),
        name: shopForm.name.trim(),
        ownerName: shopForm.ownerName.trim() || undefined,
        phone: shopForm.phone.trim() || undefined,
        address: shopForm.address.trim() || undefined,
      };

      const createdShop = await createShop(payload);
      await refreshRouteShops(routeId, String(createdShop.id));
      setIsCreateShopOpen(false);
      setShopForm({
        name: '',
        ownerName: '',
        phone: '',
        address: '',
      });
      setShopSuccessMessage(`${createdShop.name} is ready and selected for this sale.`);
    } catch (createError) {
      setShopFormError(
        createError instanceof Error ? createError.message : 'Failed to create shop.',
      );
    } finally {
      setIsCreatingShop(false);
    }
  }

  function activateFullPaidMode() {
    setPaymentMode('full');
  }

  function activateDueMode() {
    setPaymentMode('due');
    setPaidAmount((current) => {
      const currentValue = roundCurrency(Number(current || 0));

      if (currentValue === roundCurrency(totalAmount)) {
        return '0.00';
      }

      return current;
    });
  }

  return (
    <div className="space-y-6">
      <PageCard
        title={saleId ? "Edit Order" : "New Order"}
        description="Quickly create a route-based order. Orders are automatically added to the daily Delivery Summary."
        action={
          <Link
            href="/sales"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          >
            Back to orders
          </Link>
        }
      >
        {isLoading || isSaleLoading ? (
          <LoadingBlock label={isSaleLoading ? "Loading order data..." : "Loading sale form..."} />
        ) : null}

        {!(isLoading || isSaleLoading) && !error ? (
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-bold text-slate-900">Payment Mode</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Use full paid for quick daily sales. Switch to due only when payment is not complete.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={activateFullPaidMode}
                    className={`rounded-2xl px-5 py-3 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${paymentMode === 'full'
                      ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-emerald-600'
                      }`}
                  >
                    Full paid order
                  </button>
                  <button
                    type="button"
                    onClick={activateDueMode}
                    className={`rounded-2xl px-5 py-3 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${paymentMode === 'due'
                      ? 'bg-amber-500 text-white shadow-amber-500/20'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-amber-600'
                      }`}
                  >
                    Due order
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-3xl border border-slate-100 bg-white p-6 md:p-8 shadow-sm transition-all hover:shadow-md">
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900">Order Details</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                      Orders are linked to the Delivery Summary for the same date and route automatically.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Company</span>
                        <select
                          value={companyId}
                          onChange={(event) => setCompanyId(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-inner px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all hover:border-slate-300"
                        >
                          <option value="">Select company</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Route</span>
                        <select
                          value={routeId}
                          onChange={(event) => setRouteId(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-inner px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all hover:border-slate-300"
                        >
                          <option value="">Select route</option>
                          {routes.map((route) => (
                            <option key={route.id} value={route.id}>
                              {route.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">
                          Shop {toNumber(dueAmount) > 0 ? '(required for due)' : '(optional)'}
                        </span>
                        <select
                          value={shopId}
                          onChange={(event) => setShopId(event.target.value)}
                          className={`w-full rounded-2xl border bg-slate-50 shadow-inner px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all hover:border-slate-300 ${toNumber(dueAmount) > 0 && !shopId
                            ? 'border-amber-300'
                            : 'border-slate-200'
                            }`}
                        >
                          <option value="">Optional shop</option>
                          {shops.map((shop) => (
                            <option key={shop.id} value={shop.id}>
                              {shop.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-slate-500">
                            {routeId
                              ? 'Create a new shop for the selected route without leaving this page.'
                              : 'Select a route first to load or create shops.'}
                          </span>
                          <button
                            type="button"
                            disabled={!routeId}
                            onClick={() => {
                              setShopFormError(null);
                              setShopSuccessMessage(null);
                              setIsCreateShopOpen((current) => !current);
                            }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isCreateShopOpen ? 'Cancel shop' : 'Create shop'}
                          </button>
                        </div>
                      </label>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Sale date</span>
                        <input
                          type="datetime-local"
                          value={saleDate}
                          onChange={(event) => setSaleDate(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-inner px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all hover:border-slate-300"
                        />
                      </label>
                    </div>

                    {isCreateShopOpen ? (
                      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-cyan-900">Create shop for this route</p>
                          <p className="mt-1 text-xs text-cyan-800">
                            The new shop will be added to the selected route and auto-selected for this sale.
                          </p>
                        </div>

                        <form onSubmit={(event) => void handleCreateShop(event)} className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block space-y-2">
                              <span className="text-sm font-medium text-slate-700">Shop name</span>
                              <input
                                value={shopForm.name}
                                onChange={(event) =>
                                  setShopForm((current) => ({ ...current, name: event.target.value }))
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:shadow-md hover:border-slate-300"
                                placeholder="Enter shop name"
                              />
                            </label>

                            <label className="block space-y-2">
                              <span className="text-sm font-medium text-slate-700">Owner name</span>
                              <input
                                value={shopForm.ownerName}
                                onChange={(event) =>
                                  setShopForm((current) => ({ ...current, ownerName: event.target.value }))
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:shadow-md hover:border-slate-300"
                                placeholder="Optional owner name"
                              />
                            </label>

                            <label className="block space-y-2">
                              <span className="text-sm font-medium text-slate-700">Phone</span>
                              <input
                                value={shopForm.phone}
                                onChange={(event) =>
                                  setShopForm((current) => ({ ...current, phone: event.target.value }))
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:shadow-md hover:border-slate-300"
                                placeholder="Optional phone"
                              />
                            </label>

                            <label className="block space-y-2 md:col-span-2">
                              <span className="text-sm font-medium text-slate-700">Address</span>
                              <textarea
                                value={shopForm.address}
                                onChange={(event) =>
                                  setShopForm((current) => ({ ...current, address: event.target.value }))
                                }
                                rows={3}
                                className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:shadow-md hover:border-slate-300"
                                placeholder="Optional address"
                              />
                            </label>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="submit"
                              disabled={isCreatingShop}
                              className="rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                            >
                              {isCreatingShop ? 'Creating shop...' : 'Create & select shop'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsCreateShopOpen(false)}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
                            >
                              Close
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Invoice no</span>
                        <input
                          value={invoiceNo}
                          onChange={(event) => setInvoiceNo(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-inner px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all hover:border-slate-300"
                          placeholder="Leave blank to let backend generate one"
                        />
                      </label>

                      <label className="block space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-700">Invoice Discount</span>
                          <select
                            value={invoiceDiscountType}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                              setInvoiceDiscountType(
                                event.target.value as 'percentage' | 'fixed',
                              )
                            }
                            className="text-xs bg-slate-100 border-none rounded px-2"
                          >
                            <option value="percentage">%</option>
                            <option value="fixed">Fixed</option>
                          </select>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={invoiceDiscountValue}
                          onChange={(event) => setInvoiceDiscountValue(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-inner px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all hover:border-slate-300"
                          placeholder={`Discount ${invoiceDiscountType === 'percentage' ? '%' : 'Amount'}`}
                        />
                      </label>

                      <label className="block space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-700">Paid amount</span>
                          {paymentMode === 'full' ? (
                            <span className="text-xs font-medium text-emerald-700">
                              Auto-filled from total
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPaidAmount(formatMoneyInput(totalAmount))}
                              className="text-xs font-medium text-slate-600 underline underline-offset-4"
                            >
                              Use full amount
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={paidAmount}
                          onChange={(event) => setPaidAmount(event.target.value)}
                          disabled={paymentMode === 'full'}
                          className={`w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-inner px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all hover:border-slate-300 ${paymentMode === 'full' ? 'cursor-not-allowed opacity-70' : ''
                            }`}
                        />
                      </label>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Note</span>
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-inner px-4 py-3 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all hover:border-slate-300"
                        placeholder="Optional sale note"
                      />
                    </label>
                  </div>
                </div>


                <div className="rounded-3xl border border-slate-100 bg-white p-5 md:p-6 shadow-sm transition-all hover:shadow-md">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">Sale Items</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Add one or more products. Unit price is editable, buy price comes from the product.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {items.map((item, index) => {
                      const product = selectedProducts[index];
                      const calculation = itemCalculations[index];
                      const selectedProductCompany = product
                        ? product.company ?? companyById.get(product.companyId)
                        : null;
                      const isGlobalProductSearch = item.productSearch.trim().length > 0;
                      const productSearchPool =
                        isGlobalProductSearch && allProducts.length > 0
                          ? allProducts
                          : products;
                      const { matches: matchedProducts, total: totalMatchedProducts } =
                        getAdvancedProductMatches(productSearchPool, item.productSearch);
                      const showProductMatches = activeProductSearchId === item.id;
                      const safeHighlightedProductIndex =
                        matchedProducts.length > 0
                          ? Math.min(
                            highlightedProductIndex,
                            matchedProducts.length - 1,
                          )
                          : -1;
                      const productSearchStatusLabel = item.productSearch.trim()
                        ? totalMatchedProducts > matchedProducts.length
                          ? `Showing ${matchedProducts.length} of ${totalMatchedProducts} matches across companies`
                          : `${totalMatchedProducts} match${totalMatchedProducts === 1 ? '' : 'es'
                          } across companies`
                        : `${products.length} products in selected company`;

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                        >
                          <div className="flex flex-col gap-5">
                            {/* Top Row: Product Search */}
                            <div className="w-full">
                              <label className="block space-y-2">
                                <span className="text-sm font-bold text-slate-700">
                                  Product
                                </span>
                                <div className="space-y-3">
                                  <div className="relative">
                                    <input
                                      value={item.productSearch}
                                      onFocus={() => {
                                        setActiveProductSearchId(item.id);
                                        setHighlightedProductIndex(0);
                                      }}
                                      onBlur={() => {
                                        window.setTimeout(() => {
                                          setActiveProductSearchId((current) =>
                                            current === item.id ? null : current,
                                          );
                                        }, 120);
                                      }}
                                      onChange={(event) => {
                                        const nextValue = event.target.value;
                                        autoSelectProductForSearch(item.id, nextValue);
                                        setActiveProductSearchId(item.id);
                                        setHighlightedProductIndex(0);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === 'ArrowDown') {
                                          event.preventDefault();
                                          setActiveProductSearchId(item.id);
                                          setHighlightedProductIndex((current) =>
                                            matchedProducts.length === 0
                                              ? 0
                                              : Math.min(
                                                current + 1,
                                                matchedProducts.length - 1,
                                              ),
                                          );
                                          return;
                                        }

                                        if (event.key === 'ArrowUp') {
                                          event.preventDefault();
                                          setHighlightedProductIndex((current) =>
                                            Math.max(current - 1, 0),
                                          );
                                          return;
                                        }

                                        if (event.key === 'Enter' && matchedProducts.length > 0) {
                                          event.preventDefault();
                                          selectProductForItem(
                                            item.id,
                                            matchedProducts[
                                            safeHighlightedProductIndex >= 0
                                              ? safeHighlightedProductIndex
                                              : 0
                                            ],
                                          );
                                          return;
                                        }

                                        if (event.key === 'Escape') {
                                          setActiveProductSearchId(null);
                                          setHighlightedProductIndex(0);
                                        }
                                      }}
                                      placeholder="Search by product name, SKU, or unit"
                                      className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:shadow-md hover:border-slate-300"
                                    />

                                    {showProductMatches ? (
                                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                                        {matchedProducts.length > 0 ? (
                                          <>
                                            <div className="border-b border-slate-100 px-4 py-3">
                                              <div className="flex items-center justify-between gap-3">
                                                <div>
                                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                    {item.productSearch.trim()
                                                      ? 'Best matches across companies'
                                                      : 'Browse products'}
                                                  </p>
                                                  <p className="mt-1 text-xs text-slate-400">
                                                    Type to narrow results. Press Enter to select.
                                                  </p>
                                                </div>
                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                                                  {productSearchStatusLabel}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="max-h-72 overflow-y-auto p-2">
                                              {matchedProducts.map((productOption, matchIndex) => {
                                                const isHighlighted =
                                                  matchIndex === safeHighlightedProductIndex;
                                                const isSelected =
                                                  productOption.id === Number(item.productId);
                                                const matchedCompany =
                                                  productOption.company ??
                                                  companyById.get(productOption.companyId);

                                                return (
                                                  <button
                                                    key={productOption.id}
                                                    type="button"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onMouseEnter={() =>
                                                      setHighlightedProductIndex(matchIndex)
                                                    }
                                                    onClick={() =>
                                                      selectProductForItem(item.id, productOption)
                                                    }
                                                    className={`flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition ${isHighlighted
                                                      ? 'bg-slate-900 text-white'
                                                      : isSelected
                                                        ? 'bg-cyan-50'
                                                        : 'hover:bg-slate-50'
                                                      }`}
                                                  >
                                                    <div>
                                                      <div className="flex items-center gap-2">
                                                        <p
                                                          className={`font-medium ${isHighlighted
                                                            ? 'text-white'
                                                            : 'text-slate-900'
                                                            }`}
                                                        >
                                                          {productOption.name}
                                                        </p>
                                                        {isSelected ? (
                                                          <span
                                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${isHighlighted
                                                              ? 'bg-white/15 text-white'
                                                              : 'bg-cyan-100 text-cyan-700'
                                                              }`}
                                                          >
                                                            Selected
                                                          </span>
                                                        ) : null}
                                                      </div>
                                                      <p
                                                        className={`mt-1 text-xs ${isHighlighted
                                                          ? 'text-slate-200'
                                                          : 'text-slate-500'
                                                          }`}
                                                      >
                                                        SKU {productOption.sku} / Unit {productOption.unit}
                                                      </p>
                                                      <p
                                                        className={`mt-1 text-xs font-semibold ${isHighlighted
                                                          ? 'text-cyan-200'
                                                          : 'text-emerald-600'
                                                          }`}
                                                      >
                                                        In Stock: {formatNumber(stockSummary[productOption.id] || 0)}
                                                      </p>
                                                      <p
                                                        className={`mt-1 text-xs ${isHighlighted
                                                          ? 'text-slate-300'
                                                          : 'text-slate-400'
                                                          }`}
                                                      >
                                                        Company {matchedCompany?.name || 'Unknown'} /{' '}
                                                        {matchedCompany?.code || 'N/A'}
                                                      </p>
                                                    </div>
                                                    <div className="text-right">
                                                      <span
                                                        className={`text-xs font-semibold ${isHighlighted
                                                          ? 'text-white'
                                                          : 'text-slate-600'
                                                          }`}
                                                      >
                                                        {formatCurrency(productOption.salePrice)}
                                                      </span>
                                                      {showBuyPrice && (
                                                        <p
                                                          className={`mt-1 text-[11px] ${isHighlighted
                                                            ? 'text-slate-300'
                                                            : 'text-slate-400'
                                                            }`}
                                                        >
                                                          Buy {formatCurrency(productOption.buyPrice)}
                                                        </p>
                                                      )}
                                                    </div>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </>
                                        ) : (
                                          <div className="px-4 py-4 text-sm text-slate-500">
                                            {isGlobalProductSearch
                                              ? 'No matching product found in any company.'
                                              : 'No products found for the selected company.'}
                                          </div>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                    <span className="min-w-0">{productSearchStatusLabel}</span>
                                    <span className="min-w-0 sm:text-right">
                                      {item.productSearch.trim().length >= 3
                                        ? 'Company + product auto-select is active'
                                        : 'Type 3+ letters or use Arrow + Enter'}
                                    </span>
                                  </div>

                                  {product ? (
                                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                                        Selected product
                                      </p>
                                      <p className="mt-2 font-semibold">{product.name}</p>
                                      <p className="mt-1 text-xs">
                                        SKU {product.sku} / Unit {product.unit} / Sale price{' '}
                                        {formatCurrency(product.salePrice)}
                                      </p>
                                      <p className="mt-1 text-xs font-bold text-emerald-600">
                                        Current Stock: {formatNumber(stockSummary[product.id] || 0)} {product.unit}
                                      </p>
                                      <p className="mt-1 text-xs text-cyan-700">
                                        Company {selectedProductCompany?.name || 'Unknown'} /{' '}
                                        {selectedProductCompany?.code || 'N/A'}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                                      Search and pick a product for this sale item.
                                    </div>
                                  )}
                                </div>
                              </label>
                            </div>

                            {/* Bottom Row: Numeric Inputs & Actions */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 items-end">
                              <label className="block min-w-0 space-y-2">
                                <span className="text-sm font-bold text-slate-700">
                                  Quantity
                                </span>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.quantity}
                                  onChange={(event) => {
                                    const val = event.target.value;
                                    const rounded = val === '' ? '' : String(Math.round(Number(val)));
                                    updateSaleItem(item.id, (currentItem) => ({
                                      ...currentItem,
                                      quantity: rounded,
                                    }));
                                  }}
                                  className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:shadow-md hover:border-slate-300"
                                />
                              </label>

                              <label className="block min-w-0 space-y-2">
                                <span className="text-sm font-bold text-slate-700">
                                  Unit price
                                </span>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(event) =>
                                    updateSaleItem(item.id, (currentItem) => ({
                                      ...currentItem,
                                      unitPrice: event.target.value,
                                    }))
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:shadow-md hover:border-slate-300"
                                />
                              </label>

                              <label className="block min-w-0 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-bold text-slate-700">Discount</span>
                                  <select
                                    value={item.discountType}
                                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                      updateSaleItem(item.id, (currentItem) => ({
                                        ...currentItem,
                                        discountType: event.target.value as
                                          | 'percentage'
                                          | 'fixed',
                                      }))
                                    }
                                    className="text-xs bg-slate-100 border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="percentage">%</option>
                                    <option value="fixed">Fix</option>
                                  </select>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.discountValue}
                                  onChange={(event) =>
                                    updateSaleItem(item.id, (currentItem) => ({
                                      ...currentItem,
                                      discountValue: event.target.value,
                                    }))
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:shadow-md hover:border-slate-300"
                                />
                              </label>

                              <label className="block min-w-0 space-y-2">
                                <span className="text-sm font-bold text-slate-700">Free Qty</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.freeQuantity}
                                  onChange={(event) => {
                                    const val = event.target.value;
                                    const rounded = val === '' ? '' : String(Math.round(Number(val)));
                                    updateSaleItem(item.id, (currentItem) => ({
                                      ...currentItem,
                                      freeQuantity: rounded,
                                    }));
                                  }}
                                  className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:shadow-md hover:border-slate-300"
                                />
                              </label>

                              {showBuyPrice && (
                                <div className="min-w-0 space-y-2">
                                  <span className="text-sm font-bold text-slate-700">Buy price</span>
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                    {formatCurrency(product?.buyPrice ?? 0)}
                                  </div>
                                </div>
                              )}

                              <div className="col-span-2 sm:col-span-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setItems((current) =>
                                      current.length === 1
                                        ? current
                                        : current.filter(
                                          (currentItem) => currentItem.id !== item.id,
                                        ),
                                    )
                                  }
                                  className="w-full rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 md:grid-cols-3">
                              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                                <p className="text-slate-500 font-medium">Product unit</p>
                                <p className="mt-0.5 font-bold text-slate-800">
                                  {product?.unit ?? 'Not selected'}
                                </p>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                                <p className="text-slate-500 font-medium">Line total</p>
                                <p className="mt-0.5 font-bold text-slate-800">
                                  {formatCurrency(calculation.lineTotal)}
                                </p>
                              </div>
                              {showProfit && (
                                <div className="rounded-xl border border-emerald-100/50 bg-emerald-50/50 px-3 py-2 text-xs">
                                  <p className="text-emerald-600/80 font-medium">Line profit</p>
                                  <p className="mt-0.5 font-bold text-emerald-700">
                                    {formatCurrency(calculation.lineProfit)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setItems((current) => [...current, initialItem()])}
                      className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-4 text-sm font-bold text-slate-600 transition-all hover:border-slate-400 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    >
                      + Add another item
                    </button>
                  </div>
                </div>
              </div>
                <div className="rounded-3xl border border-slate-100 bg-white p-6 md:p-8 shadow-sm transition-all hover:shadow-md">
                  <div className="mb-6">
                    <h3 className="text-xl font-black tracking-tight text-slate-900 uppercase tracking-widest text-[10px] text-slate-400">Order Summary</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                      <span className="text-sm font-medium text-slate-500">Sub Total</span>
                      <span className="text-sm font-bold text-slate-900">{formatCurrency(subTotalAmount)}</span>
                    </div>
                    {invoiceDiscountAmount > 0 && (
                      <div className="flex items-center justify-between py-2 border-b border-slate-50 text-emerald-600">
                        <span className="text-sm font-medium">Discount</span>
                        <span className="text-sm font-bold">-{formatCurrency(invoiceDiscountAmount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-4">
                      <span className="text-lg font-bold text-slate-900">Total Payable</span>
                      <span className="text-2xl font-black text-indigo-600">{formatCurrency(totalAmount)}</span>
                    </div>

                    <div className="pt-4 space-y-3">
                      <label className="block space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paid amount</span>
                          {paymentMode === 'full' ? (
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">Auto-filled</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPaidAmount(formatMoneyInput(totalAmount))}
                              className="text-[10px] font-bold text-indigo-600 uppercase hover:underline"
                            >
                              Use full
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={paidAmount}
                          onChange={(event) => setPaidAmount(event.target.value)}
                          disabled={paymentMode === 'full'}
                          className={`w-full rounded-2xl border border-slate-200 bg-slate-50 shadow-inner px-4 py-3 text-lg font-black text-slate-900 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all ${paymentMode === 'full' ? 'cursor-not-allowed opacity-70' : ''}`}
                        />
                      </label>

                      <div className={`p-4 rounded-2xl border ${toNumber(dueAmount) > 0 ? 'bg-amber-50 border-amber-100 text-amber-900' : 'bg-emerald-50 border-emerald-100 text-emerald-900'}`}>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Remaining Due</p>
                        <p className="text-xl font-black mt-1">{formatCurrency(dueAmount)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-3">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void submitSale('next')}
                      className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800 hover:-translate-y-0.5 disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save & Next Order'}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void submitSale('print')}
                      className="w-full rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:-translate-y-0.5 disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save & Print Invoice'}
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save & View Details'}
                    </button>
                  </div>
                </div>

                {showProfit && (
                  <div className="rounded-3xl bg-emerald-900 p-6 text-white shadow-xl overflow-hidden relative">
                    <div className="relative z-10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Estimated Profit</p>
                      <p className="text-3xl font-black mt-1">{formatCurrency(totalProfit)}</p>
                      <p className="text-xs text-emerald-300/80 mt-2">Margin: {toNumber(totalAmount) > 0 ? ((totalProfit / toNumber(totalAmount)) * 100).toFixed(1) : 0}%</p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <TrendingUp className="h-32 w-32" />
                    </div>
                  </div>
                )}
              </div>
          </form>
        ) : null}
      </PageCard>

      {recentSales.length > 0 ? (
        <PageCard
          title="Recently Created Orders"
          description="This helps you confirm several shop sales were created one after another without leaving the page."
        >
          <div className="space-y-3">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{sale.invoiceNo}</p>
                  <p className="text-sm text-slate-500">
                    {sale.shop?.name ?? 'No shop'} • {formatDate(sale.saleDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-slate-700">
                    {formatCurrency(sale.totalAmount)}
                  </p>
                  <Link
                    href={`/sales/${sale.id}`}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </PageCard>
      ) : null}
    </div>
  );
}
