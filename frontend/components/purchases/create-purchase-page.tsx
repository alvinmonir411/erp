'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getCompanies } from '@/lib/api/companies';
import { getProducts } from '@/lib/api/products';
import { createPurchase } from '@/lib/api/purchases';
import { LoadingBlock } from '@/components/ui/loading-block';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToast, useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import type { Company, Product } from '@/types/api';

type PurchaseItemForm = {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
};

const initialItem = (): PurchaseItemForm => ({
  id: `${Date.now()}-${Math.random()}`,
  productId: '',
  quantity: '1',
  unitCost: '',
});

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function CreatePurchasePage() {
  const router = useRouter();
  const { success } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [referenceNo, setReferenceNo] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<PurchaseItemForm[]>([initialItem()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useToastNotification({
    message: error,
    title: 'Could not load purchase form',
    tone: 'error',
  });
  useToastNotification({
    message: formError,
    title: 'Could not create purchase',
    tone: 'error',
  });

  useEffect(() => {
    async function loadCompanies() {
      try {
        setIsLoading(true);
        setError(null);
        const companyData = await getCompanies();
        setCompanies(companyData);
        setCompanyId(String(companyData[0]?.id ?? ''));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load purchase form data.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadCompanies();
  }, []);

  useEffect(() => {
    async function loadAllProducts() {
      try {
        const productData = await getProducts();
        setProducts(productData);
      } catch (loadError) {
        setFormError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load products.',
        );
      }
    }

    void loadAllProducts();
  }, []);

  const selectedProducts = useMemo(
    () =>
      items.map(
        (item) =>
          products.find((product) => product.id === Number(item.productId)) ?? null,
      ),
    [items, products],
  );

  const totalAmount = useMemo(
    () =>
      roundCurrency(
        items.reduce((sum, item) => {
          const quantity = Number(item.quantity || 0);
          const unitCost = Number(item.unitCost || 0);

          return sum + quantity * unitCost;
        }, 0),
      ),
    [items],
  );

  function updateItem(
    itemId: string,
    updater: (item: PurchaseItemForm) => PurchaseItemForm,
  ) {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? updater(item) : item)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!companyId) {
      setFormError('Please select a company.');
      return;
    }

    if (
      items.some(
        (item) =>
          !item.productId ||
          Number(item.quantity) <= 0 ||
          Number(item.unitCost) <= 0,
      )
    ) {
      setFormError(
        'Each purchase item needs a product, quantity above zero, and unit cost above zero.',
      );
      return;
    }

    if (totalAmount <= 0) {
      setFormError('Add at least one valid purchase item.');
      return;
    }

    try {
      setIsSaving(true);
      const purchase = await createPurchase({
        companyId: Number(companyId),
        purchaseDate: new Date(purchaseDate).toISOString(),
        referenceNo: referenceNo.trim() || undefined,
        note: note.trim() || undefined,
        items: items.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitCost),
        })),
      });

      success('Purchase Recorded Successfully', `Purchase #${purchase.id} was created.`);
      router.push(`/purchases/${purchase.id}`);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to create purchase.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageCard
        title="Create Purchase"
        description="Record supplier buying for one company. Saving the purchase increases stock through stock-in movements and increases the company payable."
        action={
          <Link
            href="/purchases"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          >
            Back to purchases
          </Link>
        }
      >
        {isLoading ? <LoadingBlock label="Loading purchase form..." /> : null}

        {!isLoading && !error ? (
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Company</span>
                <select
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
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
                <span className="text-sm font-medium text-slate-700">
                  Purchase date
                </span>
                <input
                  type="datetime-local"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Reference / invoice no
                </span>
                <input
                  value={referenceNo}
                  onChange={(event) => setReferenceNo(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  placeholder="Optional reference number"
                />
              </label>

              <div className="rounded-2xl bg-amber-50 p-4 text-amber-900">
                <p className="text-sm">Payable created</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatCurrency(totalAmount)}
                </p>
                <p className="mt-2 text-xs font-medium text-amber-800/80">
                  The full purchase total starts as company payable.
                </p>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Note</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                placeholder="Optional purchase note"
              />
            </label>

            <PageCard
              title="Purchase Items"
              description="Each item increases stock by its quantity and contributes to the company payable total."
            >
              {products.length === 0 ? (
                <StateMessage
                  title="No products available"
                  description="Create products for the selected company before recording a purchase."
                />
              ) : (
                <div className="space-y-4">
                  {items.map((item, index) => {
                    const selectedProduct = selectedProducts[index];
                    const quantity = Number(item.quantity || 0);
                    const unitCost = Number(item.unitCost || 0);
                    const lineTotal = quantity * unitCost;

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <div className="grid gap-4 xl:grid-cols-[1.5fr_0.8fr_0.8fr_auto]">
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">
                              Product (Search)
                            </span>
                            <SearchableProductSelect
                              products={products}
                              value={item.productId}
                              onChange={(newId) => {
                                const nextProduct = products.find(
                                  (product) => product.id === Number(newId),
                                );

                                if (nextProduct && nextProduct.companyId) {
                                  setCompanyId(String(nextProduct.companyId));
                                }

                                updateItem(item.id, (currentItem) => ({
                                  ...currentItem,
                                  productId: newId,
                                  unitCost: nextProduct
                                    ? String(nextProduct.buyPrice)
                                    : currentItem.unitCost,
                                }));
                              }}
                            />
                          </label>

                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">
                              Quantity
                            </span>
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(item.id, (currentItem) => ({
                                  ...currentItem,
                                  quantity: event.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                            />
                          </label>

                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-slate-700">
                              Unit cost
                            </span>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(event) =>
                                updateItem(item.id, (currentItem) => ({
                                  ...currentItem,
                                  unitCost: event.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                            />
                          </label>

                          <div className="flex items-end">
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
                              className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-medium text-rose-700"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <InfoPill
                            label="Product details"
                            value={
                              selectedProduct
                                ? `${selectedProduct.sku} / ${selectedProduct.unit}`
                                : 'Select a product'
                            }
                          />
                          <InfoPill
                            label="Quantity"
                            value={
                              selectedProduct
                                ? `${formatNumber(quantity)} ${selectedProduct.unit}`
                                : formatNumber(quantity)
                            }
                          />
                          <InfoPill
                            label="Line total"
                            value={formatCurrency(lineTotal)}
                            tone="dark"
                          />
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setItems((current) => [...current, initialItem()])}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
                  >
                    Add another item
                  </button>
                </div>
              )}
            </PageCard>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-900 p-5 text-white">
                <p className="text-sm text-slate-300">Total purchase amount</p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="rounded-2xl bg-cyan-50 p-5 text-cyan-900">
                <p className="text-sm">Backend effect</p>
                <p className="mt-2 text-base font-semibold">
                  Stock goes up and payable goes up by the same purchase total.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving || products.length === 0}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {isSaving ? 'Saving purchase...' : 'Save purchase'}
            </button>
          </form>
        ) : null}
      </PageCard>
    </div>
  );
}

function InfoPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'dark';
}) {
  const className =
    tone === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900';

  return (
    <div className={`rounded-2xl px-4 py-3 text-sm ${className}`}>
      <p className="text-current/70">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function SearchableProductSelect({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === value),
    [products, value]
  );

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedProduct ? `${selectedProduct.name} / ${selectedProduct.sku}` : '');
    }
  }, [isOpen, selectedProduct]);

  const filteredProducts = query === '' 
    ? products 
    : products.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) || 
        p.sku.toLowerCase().includes(query.toLowerCase())
      );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
        placeholder="Type to search product..."
        value={isOpen ? query : (selectedProduct ? `${selectedProduct.name} / ${selectedProduct.sku}` : '')}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onClick={() => setIsOpen(true)}
        onFocus={() => setIsOpen(true)}
      />
      
      {isOpen && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
          {filteredProducts.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">No products found.</div>
          ) : (
            filteredProducts.map((product) => {
              const isSelected = String(product.id) === value;
              return (
                <button
                  key={product.id}
                  type="button"
                  className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                    isSelected ? 'bg-slate-50 text-slate-900 font-semibold' : 'text-slate-700'
                  }`}
                  onClick={() => {
                    onChange(String(product.id));
                    setIsOpen(false);
                  }}
                >
                  <span>{product.name}</span>
                  <span className="text-xs text-slate-400">{product.sku}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
