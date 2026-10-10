'use client';

import React, { useState } from 'react';
import {
  XCircle,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Store,
  DollarSign,
  Calendar
} from 'lucide-react';
import { revertCollection } from '@/lib/api/dues';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { useToast } from '@/components/ui/toast-provider';

interface RevertCollectionModalProps {
  collection: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function RevertCollectionModal({ collection, onClose, onSuccess }: RevertCollectionModalProps) {
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [reason, setReason] = useState('Mistakenly approved');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      await revertCollection(collection.id, reason.trim());
      showSuccessToast('Approval reverted successfully! Collection returned to PENDING state.');
      onSuccess();
      onClose();
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to revert approval.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-rose-50/80">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-rose-950">Revert / Recover Approval</h3>
              <p className="text-xs text-rose-700">Restore ledger and reset to PENDING</p>
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Customer / Shop:</span>
              <span className="font-bold text-slate-900">{collection.shop?.name || 'Direct Sale'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Order Reference:</span>
              <span className="font-bold text-indigo-600">Order #{collection.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Collected Amount:</span>
              <span className="font-black text-rose-600 text-sm">{formatCurrency(collection.collectedAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Collection Date:</span>
              <span className="font-medium text-slate-700">{formatDate(collection.collectionDate)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>Ledger Reversal Notice:</strong> Reverting will automatically subtract <strong>{formatCurrency(collection.collectedAmount)}</strong> from the shop&apos;s paid amount and restore the due on the order. The collection status will return to <strong>PENDING</strong> for editing or re-evaluation.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Reason for Reversal *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Mistakenly approved, incorrect amount or bounced cheque"
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 bg-white"
            />
          </div>

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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reverting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Confirm Revert & Recover
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
