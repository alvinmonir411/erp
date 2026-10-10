'use client';

import React, { useState } from 'react';
import { 
  XCircle, 
  DollarSign, 
  Calendar, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Store,
  Layers
} from 'lucide-react';
import { editCollection } from '@/lib/api/dues';
import { formatCurrency } from '@/lib/utils/format';
import { useToast } from '@/components/ui/toast-provider';

interface EditCollectionModalProps {
  collection: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCollectionModal({ collection, onClose, onSuccess }: EditCollectionModalProps) {
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const [amount, setAmount] = useState<string>(collection.collectedAmount?.toString() || '');
  const [date, setDate] = useState<string>(
    collection.collectionDate
      ? new Date(collection.collectionDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [note, setNote] = useState<string>(collection.note || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isApproved = collection.status === 'APPROVED';
  const originalAmount = Number(collection.collectedAmount || 0);
  const newAmount = parseFloat(amount) || 0;
  const difference = newAmount - originalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newAmount <= 0) {
      showErrorToast('Collected amount must be greater than 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      await editCollection(collection.id, {
        collectedAmount: newAmount,
        collectionDate: date,
        note: note.trim() || undefined,
      });

      showSuccessToast('Collection updated successfully and balance adjusted.');
      onSuccess();
      onClose();
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to update collection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Edit Collection Record</h3>
              <p className="text-xs text-slate-500">
                Order #{collection.orderId} · {collection.shop?.name || 'Customer'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Warning banner if Approved */}
          {isApproved && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-black">Active Approved Voucher Adjustment</p>
                <p className="mt-0.5 text-amber-700">
                  Changing this amount will immediately adjust the Shop Due balance and Order settled amount.
                  {difference !== 0 && (
                    <span className="block mt-1 font-bold">
                      Difference: {difference > 0 ? `+${formatCurrency(difference)} (Extra paid)` : `${formatCurrency(difference)} (Deducted)`}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Amount Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Collected Amount *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm font-black border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          {/* Date Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Collection Date *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Notes Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Notes / Audit Remarks
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Mistakenly entered wrong amount, verified with bank slip"
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
