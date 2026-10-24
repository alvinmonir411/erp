'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  ShoppingBag,
  Truck,
  Search,
  RefreshCw,
  Calendar,
  Store,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  X,
  Package,
  DollarSign,
  User,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  getRecycleBinItems,
  getRecycleBinStats,
  restoreRecycleBinItem,
  purgeRecycleBinItem,
  RecycleBinItem,
  RecycleBinStats,
} from '@/lib/api/recycle-bin';
import { formatCurrency } from '@/lib/utils/format';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useToast } from '@/components/ui/toast-provider';
import { useAuth } from '@/components/auth/auth-provider';
import { Role } from '@/types/api';

export function RecycleBinPage() {
  const { user } = useAuth();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const [activeTab, setActiveTab] = useState<'ALL' | 'ORDER' | 'DISPATCH_BATCH' | 'RESTORED'>('ALL');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [stats, setStats] = useState<RecycleBinStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [selectedItemForView, setSelectedItemForView] = useState<RecycleBinItem | null>(null);
  const [selectedItemForRestore, setSelectedItemForRestore] = useState<RecycleBinItem | null>(null);
  const [selectedItemForPurge, setSelectedItemForPurge] = useState<RecycleBinItem | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const isSuperAdmin = user?.role === Role.SUPER_ADMIN;

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const entityType =
        activeTab === 'ORDER'
          ? 'ORDER'
          : activeTab === 'DISPATCH_BATCH'
          ? 'DISPATCH_BATCH'
          : 'ALL';

      const status = activeTab === 'RESTORED' ? 'RESTORED' : activeTab === 'ALL' ? 'ALL' : 'DELETED';

      const [resItems, resStats] = await Promise.all([
        getRecycleBinItems({
          entityType,
          status,
          search: search.trim() || undefined,
          limit: 100,
        }),
        getRecycleBinStats(),
      ]);

      if (resItems) {
        setItems(resItems.items || []);
      }
      if (resStats) {
        setStats(resStats);
      }
    } catch (err: any) {
      showErrorToast(err.message || 'রিসাইকেল বিন লোড করতে ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, search, showErrorToast]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const handleConfirmRestore = async () => {
    if (!selectedItemForRestore) return;

    try {
      setIsActionLoading(true);
      const res = await restoreRecycleBinItem(selectedItemForRestore.id);
      showSuccessToast(res.message || 'রেকর্ড সফলভাবে পুনরুদ্ধার করা হয়েছে!');
      setSelectedItemForRestore(null);
      await fetchItems();
    } catch (err: any) {
      showErrorToast(err.message || 'পুনরুদ্ধার করতে ব্যর্থ হয়েছে');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmPurge = async () => {
    if (!selectedItemForPurge) return;

    try {
      setIsActionLoading(true);
      const res = await purgeRecycleBinItem(selectedItemForPurge.id);
      showSuccessToast(res.message || 'ট্র্যাশ রেকর্ড স্থায়ীভাবে মুছে ফেলা হয়েছে');
      setSelectedItemForPurge(null);
      await fetchItems();
    } catch (err: any) {
      showErrorToast(err.message || 'মুছতে ব্যর্থ হয়েছে');
    } finally {
      setIsActionLoading(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('bn-BD', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-[1600px] mx-auto">
      {/* Top Banner / Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 -mb-10 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold backdrop-blur-md">
              <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
              <span>Data Protection & Recovery</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              রিসাইকেল বিন (Recycle Bin)
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              ভুলবশত মুছে ফেলা যে কোনো অর্ডার, ডেলিভারি চালান বা বাকি (Due) রেকর্ড এক ক্লিকে সম্পূর্ণ ডাটা,
              ইনভেন্টরি স্টক ও ব্যালেন্সসহ আগের অবস্থায় ফিরিয়ে আনুন।
            </p>
          </div>

          <button
            onClick={() => void fetchItems()}
            disabled={isLoading}
            className="self-start md:self-auto inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-sm transition-all duration-200 active:scale-95 shadow-sm backdrop-blur-md disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>রিফ্রেশ করুন</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total in Trash */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-rose-100 p-4 sm:p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-slate-500">মোট ট্র্যাশ আইটেম</span>
            <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Trash2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats?.totalDeleted || 0}
            </div>
            <p className="text-xs text-rose-600 font-medium mt-0.5">পুনরুদ্ধারযোগ্য রেকর্ড</p>
          </div>
        </div>

        {/* Deleted Orders */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-indigo-100 p-4 sm:p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-slate-500">মুছে ফেলা অর্ডার</span>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {stats?.deletedOrders || 0}
            </div>
            <p className="text-xs text-indigo-600 font-medium mt-0.5">অর্ডার ভাউচার</p>
          </div>
        </div>

        {/* Recoverable Value */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100 p-4 sm:p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-slate-500">মোট ট্র্যাশ ভ্যালু</span>
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-amber-700">
              {formatCurrency(stats?.recoverableValue || 0)}
            </div>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              বাকি: {formatCurrency(stats?.recoverableDue || 0)}
            </p>
          </div>
        </div>

        {/* Restored Items */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100 p-4 sm:p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-slate-500">সফল পুনরুদ্ধার</span>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700">
              {stats?.totalRestored || 0}
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">সফলভাবে ফিরিয়ে আনা হয়েছে</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              সব ট্র্যাশ রেকর্ড ({stats?.totalDeleted || 0})
            </button>
            <button
              onClick={() => setActiveTab('ORDER')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
                activeTab === 'ORDER'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              অর্ডার ({stats?.deletedOrders || 0})
            </button>
            <button
              onClick={() => setActiveTab('DISPATCH_BATCH')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
                activeTab === 'DISPATCH_BATCH'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              চালান / ব্যাচ ({stats?.deletedBatches || 0})
            </button>
            <button
              onClick={() => setActiveTab('RESTORED')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
                activeTab === 'RESTORED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              পুনরুদ্ধারকৃত রেকর্ড ({stats?.totalRestored || 0})
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[260px] sm:min-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="অর্ডার #, দোকান বা চালানের নাম খুঁজুন..."
              className="w-full pl-9 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List Content */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-slate-600 font-medium text-sm">রিসাইকেল বিন চেক করা হচ্ছে...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center shadow-xs">
          <div className="h-16 w-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
            <Trash2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">কোনো রেকর্ড পাওয়া যায়নি</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mt-1">
            {search
              ? 'আপনার সার্চ অনুসারে কোনো ট্র্যাশ আইটেম পাওয়া যায়নি। ভিন্ন কীওয়ার্ড দিয়ে চেষ্টা করুন।'
              : 'রিসাইকেল বিন সম্পূর্ণ পরিষ্কার। মুছে ফেলা কোনো রেকর্ড জমা নেই।'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isOrder = item.entityType === 'ORDER';
            const isRestored = item.status === 'RESTORED';

            return (
              <div
                key={item.id}
                className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md ${
                  isRestored
                    ? 'bg-slate-50/60 border-slate-200/80 opacity-80 hover:opacity-100'
                    : 'bg-white border-slate-200/90'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Icon & Details */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border mt-0.5 ${
                        isRestored
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                          : isOrder
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                          : 'bg-blue-50 border-blue-200 text-blue-600'
                      }`}
                    >
                      {isRestored ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : isOrder ? (
                        <ShoppingBag className="h-6 w-6" />
                      ) : (
                        <Truck className="h-6 w-6" />
                      )}
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider border ${
                            isOrder
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {isOrder ? 'অর্ডার' : 'ডেলিভারি চালান'}
                        </span>

                        <span className="text-base sm:text-lg font-bold text-slate-900 truncate">
                          {item.title}
                        </span>

                        {isRestored ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            পুনরুদ্ধারকৃত (Restored)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                            <Trash2 className="h-3 w-3" />
                            মুছে ফেলা হয়েছে
                          </span>
                        )}
                      </div>

                      {/* Meta chips */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        {item.shopName && (
                          <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                            <Store className="h-3.5 w-3.5 text-slate-400" />
                            {item.shopName}
                          </span>
                        )}
                        {item.routeName && (
                          <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {item.routeName}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Package className="h-3.5 w-3.5 text-slate-400" />
                          {item.itemCount} টি পণ্য
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          ডিলিট করেছেন: <strong className="text-slate-700">{item.deletedByName || 'Admin'}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(item.createdAt)}
                        </span>
                      </div>

                      {isRestored && item.restoredAt && (
                        <div className="text-xs text-emerald-700 font-medium flex items-center gap-1 pt-0.5">
                          <span>
                            {item.restoredByName || 'Admin'} কর্তৃক {formatDate(item.restoredAt)} এ ফিরিয়ে আনা হয়েছে।
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Financial Amounts & Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-3 sm:gap-4 border-t lg:border-t-0 pt-3 lg:pt-0">
                    <div className="text-left sm:text-right space-y-0.5">
                      <div className="text-base sm:text-lg font-black text-slate-900">
                        {formatCurrency(item.totalAmount)}
                      </div>
                      {Number(item.dueAmount) > 0 ? (
                        <div className="text-xs font-semibold text-rose-600">
                          বাকি: {formatCurrency(item.dueAmount)}
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-emerald-600">নগদ পরিশোধ</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* View Details / Snapshot Button */}
                      <button
                        onClick={() => setSelectedItemForView(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition active:scale-95"
                      >
                        <Eye className="h-4 w-4" />
                        <span>স্ন্যাপশট</span>
                      </button>

                      {/* Restore Button */}
                      {!isRestored ? (
                        <button
                          onClick={() => setSelectedItemForRestore(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-xs sm:text-sm font-bold shadow-xs shadow-emerald-600/30 transition-all duration-200 active:scale-95"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>রিস্টোর করুন</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                          <CheckCircle2 className="h-4 w-4" />
                          সক্রিয় আছে
                        </span>
                      )}

                      {/* Permanent Purge Button (Super Admin Only) */}
                      {isSuperAdmin && (
                        <button
                          onClick={() => setSelectedItemForPurge(item)}
                          title="স্থায়ীভাবে মুছে ফেলুন (Permanent Purge)"
                          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Snapshot Details Modal */}
      {selectedItemForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  {selectedItemForView.entityType === 'ORDER' ? 'অর্ডার স্ন্যাপশট' : 'চালান স্ন্যাপশট'}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{selectedItemForView.title}</h3>
              </div>
              <button
                onClick={() => setSelectedItemForView(null)}
                className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">মোট মূল্য</span>
                <span className="text-sm font-bold text-slate-800">
                  {formatCurrency(selectedItemForView.totalAmount)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">বাকি (Due)</span>
                <span className="text-sm font-bold text-rose-600">
                  {formatCurrency(selectedItemForView.dueAmount)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">দোকান</span>
                <span className="text-sm font-bold text-slate-800 truncate block">
                  {selectedItemForView.shopName || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">রুট</span>
                <span className="text-sm font-bold text-slate-800 truncate block">
                  {selectedItemForView.routeName || 'N/A'}
                </span>
              </div>
            </div>

            {/* Item Breakdown Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                পণ্যের তালিকা ({selectedItemForView.snapshot?.items?.length || selectedItemForView.itemCount} টি)
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">পণ্য ID</th>
                      <th className="px-3 py-2 text-right">পরিমাণ</th>
                      <th className="px-3 py-2 text-right">ফ্রি</th>
                      <th className="px-3 py-2 text-right">দর</th>
                      <th className="px-3 py-2 text-right">মোট</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedItemForView.snapshot?.items || []).map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {it.product?.name || `Product #${it.productId}`}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-800">{it.quantity}</td>
                        <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{it.freeQuantity || 0}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(it.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-black text-slate-900">{formatCurrency(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dues breakdown if any */}
            {(selectedItemForView.snapshot?.dues || []).length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  বাকি রেকর্ড (Dues Snapshot)
                </h4>
                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 space-y-1.5 text-xs">
                  {selectedItemForView.snapshot.dues.map((d: any, dIdx: number) => (
                    <div key={dIdx} className="flex justify-between items-center text-rose-900">
                      <span>
                        দোকান #{d.shopId} ({d.srName || 'SR'}) - নোট: {d.note || 'কোনো নোট নেই'}
                      </span>
                      <strong className="font-bold text-rose-700">{formatCurrency(d.dueAmount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedItemForView(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(selectedItemForRestore)}
        onClose={() => setSelectedItemForRestore(null)}
        onConfirm={handleConfirmRestore}
        title="রেকর্ড পুনরুদ্ধার (Restore) নিশ্চিত করুন"
        description={`আপনি কি নিশ্চিতভাবে "${selectedItemForRestore?.title}" আগের অবস্থায় ফিরিয়ে আনতে চান?`}
        confirmText="হ্যাঁ, পুনরুদ্ধার করুন"
        cancelText="বাতিল"
        variant="success"
        isLoading={isActionLoading}
        warningNote="পুনরুদ্ধার করলে অর্ডারটি পুনরায় সক্রিয় হবে, প্রয়োজনীয় স্টক ইনভেন্টরি থেকে সমন্বয় হবে এবং দোকানের বাকি থাকলে তা আগের ব্যালেন্সে যোগ হবে।"
        details={[
          { label: 'রেকর্ডের ধরন', value: selectedItemForRestore?.entityType === 'ORDER' ? 'অর্ডার' : 'ডেলিভারি চালান' },
          { label: 'মোট পরিমাণ', value: formatCurrency(selectedItemForRestore?.totalAmount || 0) },
          { label: 'বাকি (Due)', value: formatCurrency(selectedItemForRestore?.dueAmount || 0) },
          { label: 'ডিলিট করেছিলেন', value: selectedItemForRestore?.deletedByName || 'Admin' },
        ]}
      />

      {/* Permanent Purge Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(selectedItemForPurge)}
        onClose={() => setSelectedItemForPurge(null)}
        onConfirm={handleConfirmPurge}
        title="স্থায়ীভাবে মুছে ফেলা নিশ্চিত করুন (Permanent Purge)"
        description={`সতর্কতা: "${selectedItemForPurge?.title}" ট্র্যাশ থেকে স্থায়ীভাবে মুছে ফেলা হবে।`}
        confirmText="হ্যাঁ, চিরতরে মুছুন"
        cancelText="বাতিল"
        variant="danger"
        isLoading={isActionLoading}
        warningNote="একবার মুছে ফেললে এই ডাটা আর কখনোই রিস্টোর করা সম্ভব হবে না!"
      />
    </div>
  );
}
