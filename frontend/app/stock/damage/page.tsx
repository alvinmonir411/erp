'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCompanies } from '@/lib/api/companies';
import { getProducts } from '@/lib/api/products';
import { addDamage, getStockSummary } from '@/lib/api/stock';
import { PageCard } from '@/components/ui/page-card';
import { useToastNotification } from '@/components/ui/toast-provider';
import type { Company, Product } from '@/types/api';

export default function DamageEntryPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockSummary, setStockSummary] = useState<Record<number, number>>({});
  
  const [companyId, setCompanyId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useToastNotification({ message: error, title: 'Error', tone: 'error' });
  useToastNotification({ message: successMessage, title: 'Success', tone: 'success' });

  useEffect(() => {
    getCompanies().then(setCompanies).catch(console.error);
  }, []);

  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      setStockSummary({});
      return;
    }
    
    Promise.all([
      getProducts(Number(companyId)),
      getStockSummary(Number(companyId))
    ]).then(([productData, stockData]) => {
      setProducts(productData);
      const stockMap: Record<number, number> = {};
      for(const item of stockData) {
          stockMap[item.productId] = item.currentStock;
      }
      setStockSummary(stockMap);
    }).catch(console.error);
  }, [companyId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const qty = Number(quantity);
    const prodId = Number(productId);
    const compId = Number(companyId);

    if (!compId || !prodId || qty <= 0) {
      setError('Please fill in all required fields properly.');
      return;
    }

    const currentStock = stockSummary[prodId] || 0;
    if (qty > currentStock) {
      setError(`Cannot record damage larger than current stock (${currentStock}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      await addDamage({
        companyId: compId,
        productId: prodId,
        quantity: qty,
        note: note.trim() || undefined,
        movementDate: new Date().toISOString()
      });
      setSuccessMessage('Damage recorded successfully.');
      setQuantity('');
      setNote('');
      setProductId('');
      
      // Update local stock map for fast consecutive entries
      setStockSummary(prev => ({
        ...prev,
        [prodId]: prev[prodId] - qty
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to record damage.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedProduct = products.find(p => p.id === Number(productId));
  const maxStock = selectedProduct ? (stockSummary[selectedProduct.id] || 0) : 0;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <PageCard
        title="Damage Entry"
        description="Record damaged stock. Damaged items will be deducted from your available inventory."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Company</span>
              <select
                required
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <option value="">Select a company</option>
                {companies.filter(c => c.isActive).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Product</span>
              <select
                required
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                disabled={!companyId}
              >
                <option value="">Select a product</option>
                {products.filter(p => p.isActive).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} (Stock: {stockSummary[product.id] || 0} {product.unit})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Quantity Damaged</span>
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                max={maxStock}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                placeholder="Number of damaged items"
                disabled={!productId}
              />
              {selectedProduct && maxStock > 0 && (
                <p className="text-xs text-slate-500">
                  Maximum available to deduct: {maxStock} {selectedProduct.unit}
                </p>
              )}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                placeholder="Reason for damage, who reported it, etc."
                required
              />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !productId || maxStock <= 0}
              className="rounded-2xl bg-rose-600 px-6 py-3 text-sm font-bold text-white hover:bg-rose-700 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Record Damage'}
            </button>
            <button
                type="button"
                onClick={() => router.back()}
                className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700"
            >
                Cancel
            </button>
          </div>
        </form>
      </PageCard>
    </div>
  );
}
