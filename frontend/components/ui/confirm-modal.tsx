'use client';

import React from 'react';
import { Trash2, AlertTriangle, AlertCircle, RefreshCw, X, CheckCircle } from 'lucide-react';

export interface ConfirmModalDetail {
  label: string;
  value: React.ReactNode;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'success';
  isLoading?: boolean;
  details?: ConfirmModalDetail[];
  warningNote?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Yes, Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  details = [],
  warningNote,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: 'bg-rose-50 border-rose-200 text-rose-600',
      icon: <Trash2 className="h-7 w-7 text-rose-600" />,
      btnBg: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-600/30',
    },
    warning: {
      iconBg: 'bg-amber-50 border-amber-200 text-amber-600',
      icon: <AlertTriangle className="h-7 w-7 text-amber-600" />,
      btnBg: 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 shadow-amber-600/30',
    },
    primary: {
      iconBg: 'bg-indigo-50 border-indigo-200 text-indigo-600',
      icon: <AlertCircle className="h-7 w-7 text-indigo-600" />,
      btnBg: 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-600/30',
    },
    success: {
      iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
      icon: <CheckCircle className="h-7 w-7 text-emerald-600" />,
      btnBg: 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-emerald-600/30',
    },
  }[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 transition-all transform animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl border shadow-inner ${variantStyles.iconBg}`}>
            {variantStyles.icon}
          </div>
        </div>

        {/* Header Content */}
        <div className="mt-4 text-center">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="mt-2 text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Details Box */}
        {details.length > 0 && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 border border-slate-200/80 text-xs space-y-2">
            {details.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-slate-600">
                <span className="font-medium text-slate-500">{item.label}:</span>
                <span className="font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Warning Note */}
        {warningNote && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50/90 p-2.5 border border-amber-200/60 text-[11px] font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <span>{warningNote}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-3 text-xs sm:text-sm font-bold text-slate-700 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl ${variantStyles.btnBg} py-3 text-xs sm:text-sm font-black text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
