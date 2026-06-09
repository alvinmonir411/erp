'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getCompanies } from '@/lib/api/companies';
import { createProduct, getProducts, updateProduct, deleteProduct, getProductsSummary } from '@/lib/api/products';
import { LoadingBlock } from '@/components/ui/loading-block';
import { Pagination } from '@/components/ui/pagination';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToastNotification } from '@/components/ui/toast-provider';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import type { Company, Product, ProductUnit } from '@/types/api';
import { AlertCircle } from 'lucide-react';

const unitOptions: ProductUnit[] = [
  'PCS',
  'KG',
  'LITER',
  'PACK',
  'DOZEN',
  'OTHER',
];
const productsPageSize = 12;

const initialFormState = {
  companyId: '',
  name: '',
  sku: '',
  unit: 'PCS' as ProductUnit,
  buyPrice: '',
  salePrice: '',
  isActive: true,
};

export function ProductsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formState, setFormState] = useState(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [stockLevelFilter, setStockLevelFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('active');

  useToastNotification({
    message: error,
    title: 'Could not load products',
    tone: 'error',
  });
  useToastNotification({
    message: formError,
    title: 'Could not save product',
    tone: 'error',
  });
  useToastNotification({
    message: successMessage,
    title: 'Saved',
    tone: 'success',
  });

  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        setError(null);
        const companyData = await getCompanies();
        setCompanies(companyData);
        setSelectedCompanyId(null); // Default to "All Companies" for better overview
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load initial data.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadInitialData();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      try {
        setIsLoading(true);
        setError(null);
        
        const [response, summaryData] = await Promise.all([
          getProducts({
            companyId: selectedCompanyId || undefined,
            search: searchTerm || undefined,
            stockLevel: stockLevelFilter !== 'all' ? (stockLevelFilter as any) : undefined,
            isActive: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
            page: currentPage,
            limit: productsPageSize,
          }),
          getProductsSummary(selectedCompanyId || undefined)
        ]);

        if (Array.isArray(response)) {
          setProducts(response);
          setTotalProducts(response.length);
        } else {
          setProducts(response.items || []);
          setTotalProducts(response.total || 0);
        }
        
        setSummary(summaryData);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load products.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadProducts();
  }, [selectedCompanyId, searchTerm, stockLevelFilter, activeFilter, currentPage]);

  useEffect(() => {
    if (editingProduct) {
      setFormState({
        companyId: String(editingProduct.companyId),
        name: editingProduct.name,
        sku: editingProduct.sku,
        unit: editingProduct.unit,
        buyPrice: String(editingProduct.buyPrice),
        salePrice: String(editingProduct.salePrice),
        isActive: editingProduct.isActive,
      });
      return;
    }

    setFormState({
      ...initialFormState,
      companyId: selectedCompanyId ? String(selectedCompanyId) : '',
    });
  }, [editingProduct, selectedCompanyId]);

  const paginatedProducts = products; // Already paginated from backend now

  async function refreshProducts() {
    const response = await getProducts({
      companyId: selectedCompanyId || undefined,
      search: searchTerm || undefined,
      stockLevel: stockLevelFilter !== 'all' ? (stockLevelFilter as any) : undefined,
      isActive: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
      page: currentPage,
      limit: productsPageSize,
    });
    
    if (Array.isArray(response)) {
      setProducts(response);
      setTotalProducts(response.length);
    } else {
      setProducts(response.items || []);
      setTotalProducts(response.total || 0);
    }

    const summaryData = await getProductsSummary(selectedCompanyId || undefined);
    setSummary(summaryData);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!formState.companyId) {
      setFormError('Please select a company.');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        companyId: Number(formState.companyId),
        name: formState.name,
        sku: formState.sku,
        unit: formState.unit,
        buyPrice: Number(formState.buyPrice),
        salePrice: Number(formState.salePrice),
        isActive: formState.isActive,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
        setSuccessMessage(`Product "${payload.name}" updated successfully.`);
      } else {
        await createProduct(payload);
        setSuccessMessage(`Product "${payload.name}" created successfully.`);
      }

      setEditingProduct(null);
      setFormState({
        ...initialFormState,
        companyId: formState.companyId,
      });
      setCurrentPage(1);
      await refreshProducts();
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : 'Failed to save product.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteClick(id: number, name: string) {
    setProductToDelete({ id, name });
  }

  async function handleConfirmDelete() {
    if (!productToDelete) return;
    
    try {
      setIsDeletingId(productToDelete.id);
      setFormError(null);
      await deleteProduct(productToDelete.id);
      setSuccessMessage(`Product "${productToDelete.name}" deleted successfully.`);
      setProductToDelete(null);
      await refreshProducts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete product.');
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Products</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(summary.totalProducts)}</div>
          </div>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
            <div className="text-xs font-medium text-emerald-700 uppercase tracking-wider">In Stock</div>
            <div className="mt-1 text-2xl font-bold text-emerald-800">{formatNumber(summary.inStockProducts)}</div>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Active</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{formatNumber(summary.activeProducts)}</div>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-rose-600 uppercase tracking-wider">Inactive</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{formatNumber(summary.inactiveProducts)}</div>
          </div>
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
            <div className="text-xs font-medium text-amber-700 uppercase tracking-wider">Low Stock</div>
            <div className="mt-1 text-2xl font-bold text-amber-800">{formatNumber(summary.lowStockProducts)}</div>
          </div>
          <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
            <div className="text-xs font-medium text-rose-700 uppercase tracking-wider">Out of Stock</div>
            <div className="mt-1 text-2xl font-bold text-rose-800">{formatNumber(summary.outOfStockProducts)}</div>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Stock Qty</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{formatNumber(summary.totalStockQuantity)}</div>
          </div>
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm col-span-2 md:col-span-4 xl:col-span-2">
            <div className="text-xs font-medium text-indigo-700 uppercase tracking-wider">Stock Value</div>
            <div className="mt-1 text-xl font-bold text-indigo-900">{formatCurrency(summary.totalStockValue)}</div>
          </div>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <PageCard
          title={selectedCompanyId ? `${companies.find(c => c.id === selectedCompanyId)?.name || ''} Product Catalog`.trim() : "Products"}
          description="View products by company and verify pricing, unit, and active status from the backend."
          action={
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setCurrentPage(1);
                    setSearchTerm(event.target.value);
                  }}
                  placeholder="Search name/SKU..."
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 min-w-[200px]"
                />
                <select
                  value={selectedCompanyId ?? ''}
                  onChange={(event) => {
                    setEditingProduct(null);
                    setCurrentPage(1);
                    const val = event.target.value;
                    setSelectedCompanyId(val === '' ? null : Number(val));
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900"
                >
                  <option value="">All Companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
                  <button 
                    onClick={() => { setCurrentPage(1); setActiveFilter('active'); }}
                    className={`px-4 py-1.5 text-sm font-bold rounded-xl transition ${activeFilter === 'active' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Active
                  </button>
                  <button 
                    onClick={() => { setCurrentPage(1); setActiveFilter('inactive'); }}
                    className={`px-4 py-1.5 text-sm font-bold rounded-xl transition ${activeFilter === 'inactive' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Inactive
                  </button>
                  <button 
                    onClick={() => { setCurrentPage(1); setActiveFilter('all'); }}
                    className={`px-4 py-1.5 text-sm font-bold rounded-xl transition ${activeFilter === 'all' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    All
                  </button>
                </div>
                <select
                  value={stockLevelFilter}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setStockLevelFilter(e.target.value);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900"
                >
                  <option value="all">All Stock Levels</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                  <option value="normal">Normal Stock</option>
                </select>
              </div>
            </div>
          }
        >
        {isLoading ? <LoadingBlock label="Loading products..." /> : null}
        {!isLoading && !error ? (
          <>
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">SKU</th>
                  <th className="px-3 py-3 font-medium text-right">Stock</th>
                  <th className="px-3 py-3 font-medium text-right">Buy Price</th>
                  <th className="px-3 py-3 font-medium text-right">Sale Price</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProducts.map((product) => (
                  <tr key={product.id} className="align-top text-slate-700">
                    <td className="px-3 py-4">
                      <div className="font-medium text-slate-900">{product.name}</div>
                      {!selectedCompanyId && product.company && (
                        <div className="text-xs text-slate-500">{product.company.name}</div>
                      )}
                    </td>
                    <td className="px-3 py-4 font-mono text-xs">{product.sku}</td>
                    <td className="px-3 py-4 text-right font-medium">
                      <span className={Number(product.currentStock || 0) <= 0 ? 'text-rose-600' : Number(product.currentStock || 0) <= 10 ? 'text-amber-600' : 'text-slate-900'}>
                        {formatNumber(product.currentStock)}
                      </span>
                      <span className="text-[10px] ml-1 text-slate-400">{product.unit}</span>
                    </td>
                    <td className="px-3 py-4 text-right">{formatCurrency(product.buyPrice)}</td>
                    <td className="px-3 py-4 text-right">{formatCurrency(product.salePrice)}</td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          product.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingProduct(product)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingId === product.id}
                                    onClick={() => handleDeleteClick(product.id, product.name)}
                                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-600 shadow-sm transition hover:bg-rose-100 flex-1 disabled:opacity-50"
                        >
                          {isDeletingId === product.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Mobile View */}
          <div className="lg:hidden divide-y divide-slate-100">
            {paginatedProducts.map((product) => (
              <div key={product.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{product.name}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{product.sku}</div>
                    {!selectedCompanyId && product.company && (
                      <div className="text-xs text-slate-500 mt-1">{product.company.name}</div>
                    )}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      product.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-3">
                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-400">Stock</div>
                    <div className="font-bold">
                      <span className={Number(product.currentStock || 0) <= 0 ? 'text-rose-600' : Number(product.currentStock || 0) <= 10 ? 'text-amber-600' : 'text-slate-900'}>
                        {formatNumber(product.currentStock)}
                      </span>
                      <span className="text-[10px] ml-1 text-slate-500">{product.unit}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-400">Buy</div>
                    <div className="font-bold text-slate-700">{formatCurrency(product.buyPrice)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-400">Sale</div>
                    <div className="font-bold text-slate-900">{formatCurrency(product.salePrice)}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(product)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingId === product.id}
                    onClick={() => handleDeleteClick(product.id, product.name)}
                    className="flex-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {isDeletingId === product.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>

            {products.length === 0 ? (
              <div className="pt-4">
                <StateMessage
                  title="No products found"
                  description="Create a product for the selected company to begin testing."
                />
              </div>
            ) : null}
             <Pagination
              currentPage={currentPage}
              totalItems={totalProducts}
              pageSize={productsPageSize}
              onPageChange={setCurrentPage}
            />
          </>
        ) : null}
      </PageCard>

      <PageCard
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        description="Use this form to create or update products for the selected company. Company stays selected for faster repeated product entry."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Company</span>
            <select
              value={formState.companyId}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  companyId: event.target.value,
                }))
              }
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
            <span className="text-sm font-medium text-slate-700">Product name</span>
            <input
              value={formState.name}
              onChange={(event) =>
                setFormState((current) => ({ ...current, name: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              placeholder="Company product name"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">SKU</span>
              <input
                value={formState.sku}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, sku: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                placeholder="SKU code"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Unit</span>
              <select
                value={formState.unit}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    unit: event.target.value as ProductUnit,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Buy price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.buyPrice}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    buyPrice: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Sale price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.salePrice}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    salePrice: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formState.isActive}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            Product is active
          </label>

          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
            For bulk product entry, select the company once and keep adding products. The company stays selected after each save.
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isSaving ? 'Saving...' : editingProduct ? 'Update product' : 'Add product'}
            </button>
            {editingProduct ? (
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </PageCard>
    </div>

    {/* 3. Company-wise Summary Table */}
      {!selectedCompanyId && summary?.companyWiseProducts && (
        <PageCard
          title="Company-wise Product Summary"
          description="Detailed breakdown of product counts, stock levels, and asset value per company."
          className="xl:col-span-2"
        >
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-medium">Company</th>
                  <th className="px-3 py-3 font-medium text-right">Total</th>
                  <th className="px-3 py-3 font-medium text-right text-emerald-600">In Stock</th>
                  <th className="px-3 py-3 font-medium text-right">Active</th>
                  <th className="px-3 py-3 font-medium text-right">Inactive</th>
                  <th className="px-3 py-3 font-medium text-right">Low Stock</th>
                  <th className="px-3 py-3 font-medium text-right text-rose-600">Out</th>
                  <th className="px-3 py-3 font-medium text-right">Stock Qty</th>
                  <th className="px-3 py-3 font-medium text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.companyWiseProducts.map((c: any) => (
                  <tr key={c.companyId} className="text-slate-700 hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-4 font-semibold text-slate-900">{c.companyName}</td>
                    <td className="px-3 py-4 text-right">{formatNumber(c.totalProducts)}</td>
                    <td className="px-3 py-4 text-right text-emerald-600 font-bold">{formatNumber(c.inStockProducts)}</td>
                    <td className="px-3 py-4 text-right text-emerald-600 font-medium">{formatNumber(c.activeProducts)}</td>
                    <td className="px-3 py-4 text-right text-slate-400">{formatNumber(c.inactiveProducts)}</td>
                    <td className="px-3 py-4 text-right text-amber-600 font-medium">{formatNumber(c.lowStockProducts)}</td>
                    <td className="px-3 py-4 text-right text-rose-600 font-bold">{formatNumber(c.outOfStockProducts)}</td>
                    <td className="px-3 py-4 text-right">{formatNumber(c.totalStockQuantity)}</td>
                    <td className="px-3 py-4 text-right font-medium text-indigo-700">{formatCurrency(c.totalStockValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden divide-y divide-slate-100">
            {summary.companyWiseProducts.map((c: any) => (
              <div key={c.companyId} className="p-4 space-y-3">
                <div className="font-bold text-slate-900 text-lg border-b border-slate-100 pb-2">{c.companyName}</div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Products</div>
                    <div className="text-xl font-black text-slate-900">{formatNumber(c.totalProducts)}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">In Stock</div>
                    <div className="text-xl font-black text-emerald-700">{formatNumber(c.inStockProducts)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs border-y border-slate-100 py-3">
                  <div>
                    <div className="font-bold text-slate-400 mb-1">Active</div>
                    <div className="font-black text-emerald-600">{formatNumber(c.activeProducts)}</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-400 mb-1">Inactive</div>
                    <div className="font-black text-slate-400">{formatNumber(c.inactiveProducts)}</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-400 mb-1">Low</div>
                    <div className="font-black text-amber-600">{formatNumber(c.lowStockProducts)}</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-400 mb-1">Out</div>
                    <div className="font-black text-rose-600">{formatNumber(c.outOfStockProducts)}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-indigo-50 rounded-xl p-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Stock Qty</div>
                    <div className="font-black text-indigo-700">{formatNumber(c.totalStockQuantity)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Value</div>
                    <div className="font-black text-indigo-900">{formatCurrency(c.totalStockValue)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PageCard>
      )}

      {productToDelete && (
        <DeleteProductConfirmModal
          isOpen={!!productToDelete}
          onClose={() => setProductToDelete(null)}
          onConfirm={handleConfirmDelete}
          isDeleting={!!isDeletingId}
          productName={productToDelete.name}
        />
      )}
    </div>
  );
}

interface DeleteProductConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  productName: string;
}

function DeleteProductConfirmModal({ isOpen, onClose, onConfirm, isDeleting, productName }: DeleteProductConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Delete {productName}</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed font-bold">
              Are you sure you want to delete this product? This cannot be undone and will fail if the product is linked to existing stock or orders.
            </p>
          </div>
          <div className="flex w-full gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-black text-white hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isDeleting ? (
                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Yes, Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
