'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  DollarSign, 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ArrowRight,
  Filter,
  MoreVertical,
  Calendar,
  User as UserIcon,
  Store,
  FileText,
  Loader2,
  History,
  Plus
} from 'lucide-react';
import { getDues, collectDue, getDueStats } from '@/lib/api/dues';
import { apiRequest } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/format';
import { useAuth } from '../auth/auth-provider';
import { useToast } from '@/components/ui/toast-provider';
import { Role } from '@/types/api';
import { useCompanies, useRoutes } from '@/hooks/use-common-queries';
import { getUsers } from '@/lib/api/users';

import Link from 'next/link';
import { getOrder } from '@/lib/api/orders';
import { OrderModal } from '@/components/orders/order-modal';
import { addManualDue } from '@/lib/api/sales';
import { getShops } from '@/lib/api/shops';

export function DuesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeliveryMan, setSelectedDeliveryMan] = useState('');
  const [selectedSR, setSelectedSR] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedDue, setSelectedDue] = useState<any>(null);

  // Order Details Modal State
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [isViewingOrderLoading, setIsViewingOrderLoading] = useState(false);

  // Manual Due Modal State
  const [isManualDueModalOpen, setIsManualDueModalOpen] = useState(false);

  const { data: dues = [], isLoading } = useQuery({
    queryKey: ['dues'],
    queryFn: getDues,
  });

  const { data: stats } = useQuery({
    queryKey: ['due-stats'],
    queryFn: getDueStats,
  });

  const { success: showSuccessToast, error: showErrorToast } = useToast();

  // Fetch companies, routes and users for complete filter options
  const { data: companies = [] } = useCompanies();
  const { data: routes = [] } = useRoutes();
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const uniqueDeliveryMen = useMemo(() => {
    return Array.from(new Set(
      users.filter((u: any) => u.role === Role.DELIVERY_MAN).map((u: any) => u.name)
    )) as string[];
  }, [users]);

  const uniqueSRs = useMemo(() => {
    return Array.from(new Set(
      users.filter((u: any) => u.role === Role.SR || u.role === Role.ADMIN || u.role === Role.SUPER_ADMIN).map((u: any) => u.name)
    )) as string[];
  }, [users]);

  const uniqueCompanies = useMemo(() => {
    return Array.from(new Set(companies.map((c: any) => c.name))) as string[];
  }, [companies]);

  const uniqueRoutes = useMemo(() => {
    return Array.from(new Set(routes.map((r: any) => r.name))) as string[];
  }, [routes]);

  const handleViewOrder = async (orderId: number) => {
    try {
      setIsViewingOrderLoading(true);
      const orderData = await getOrder(orderId);
      setViewingOrder(orderData);
    } catch (err: any) {
      showErrorToast(err.message || 'অর্ডার তথ্য লোড হতে ব্যর্থ হয়েছে');
    } finally {
      setIsViewingOrderLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedDeliveryMan('');
    setSelectedSR('');
    setSelectedCompany('');
    setSelectedRoute('');
    setSelectedDate('');
  };

  const filteredDues = useMemo(() => {
    return dues.filter((due: any) => {
      // 1. Search Term filter
      const matchesSearch = !searchTerm ? true : (
        due.shop?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        due.shop?.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        due.shop?.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        due.deliveryManName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        due.orderId.toString().includes(searchTerm)
      );

      if (!matchesSearch) return false;

      // 2. Delivery Man filter
      if (selectedDeliveryMan && due.deliveryManName !== selectedDeliveryMan) {
        return false;
      }

      // 3. SR Name filter
      if (selectedSR && due.srName !== selectedSR) {
        return false;
      }

      // 4. Company filter
      if (selectedCompany) {
        const orderCompany = due.order?.company?.name;
        const shopCompany = due.shop?.company?.name;
        if (orderCompany !== selectedCompany && shopCompany !== selectedCompany) {
          return false;
        }
      }

      // 5. Route filter
      if (selectedRoute && due.route?.name !== selectedRoute) {
        return false;
      }

      // 6. Date filter
      if (selectedDate) {
        const orderDateStr = due.order?.orderDate;
        const createdAtDateStr = due.createdAt ? new Date(due.createdAt).toISOString().split('T')[0] : '';
        if (orderDateStr !== selectedDate && createdAtDateStr !== selectedDate) {
          return false;
        }
      }

      return true;
    });
  }, [dues, searchTerm, selectedDeliveryMan, selectedSR, selectedCompany, selectedRoute, selectedDate]);

  const filteredDuesTotalRemaining = useMemo(() => {
    return filteredDues.reduce((sum: number, due: any) => sum + Number(due.remainingDue || 0), 0);
  }, [filteredDues]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return { label: 'পরিশোধিত', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'PARTIAL':
        return { label: 'আংশিক বাকি', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { label: 'বাকি আছে', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs in Natural Bangla */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">বকেয়া ও কালেকশন ব্যবস্থাপনা</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">দোকানের বাকি পাওনা, নগদ আদায় ও পেমেন্ট অনুমোদন</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dues"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-500/20"
          >
            <DollarSign className="w-4 h-4" />
            বকেয়া তালিকা
          </Link>
          <Link
            href="/dues/collections"
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Clock className="w-4 h-4 text-amber-500" />
            আদায় হিস্ট্রি
          </Link>
          {user?.role === Role.SUPER_ADMIN && (
            <>
              <Link
                href="/dues/approvals"
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                পেমেন্ট অনুমোদন
              </Link>
              <button
                onClick={() => setIsManualDueModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                নতুন বাকি এন্ট্রি
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 no-print">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">মার্কেটে মোট বাকি পাওনা</p>
              <p className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5">
                {formatCurrency(stats?.totalRemaining ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">মোট নগদ আদায়</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">
                {formatCurrency(stats?.totalPaid ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">অনুমোদনের অপেক্ষায় জমা</p>
              <p className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">
                {formatCurrency(stats?.pendingApproval ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">চলতি বকেয়া চালান</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                {dues.filter((d: any) => d.remainingDue > 0).length} টি
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Table Container */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden no-print">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="relative col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="দোকানের নাম, মালিকের নাম, মোবাইল নম্বর..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
              />
            </div>

            {/* Delivery Man Select */}
            <div>
              <select
                value={selectedDeliveryMan}
                onChange={(e) => setSelectedDeliveryMan(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700 font-medium"
              >
                <option value="">সকল ডেলিভারিম্যান</option>
                {uniqueDeliveryMen.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* SR Select */}
            <div>
              <select
                value={selectedSR}
                onChange={(e) => setSelectedSR(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700 font-medium"
              >
                <option value="">সকল এসআর (SR)</option>
                {uniqueSRs.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Company Select */}
            <div>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700 font-medium"
              >
                <option value="">সকল কোম্পানি</option>
                {uniqueCompanies.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Route Select */}
            <div>
              <select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700 font-medium"
              >
                <option value="">সকল রুট / এলাকা</option>
                {uniqueRoutes.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
            {/* Date Filter */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-slate-500 font-bold">অর্ডারের তারিখ:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700 font-medium"
              />
              {(searchTerm || selectedDeliveryMan || selectedSR || selectedCompany || selectedRoute || selectedDate) && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline ml-2"
                >
                  ফিল্টার মুছুন
                </button>
              )}
            </div>

            {/* Total due in filtered list */}
            <div className="text-xs text-slate-600 font-bold">
              ফিল্টারকৃত মোট বাকি: <span className="text-rose-600 font-black text-sm">{formatCurrency(filteredDuesTotalRemaining)}</span>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">দোকান ও অর্ডার</th>
                <th className="px-5 py-3.5">ডেলিভারিম্যান</th>
                <th className="px-5 py-3.5">মূল বাকি</th>
                <th className="px-5 py-3.5">পরিশোধিত</th>
                <th className="px-5 py-3.5">অবশিষ্ট বাকি</th>
                <th className="px-5 py-3.5">অবস্থা</th>
                <th className="px-5 py-3.5 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
                    <p className="mt-2 text-xs font-bold text-slate-400">বকেয়া তালিকা লোড হচ্ছে...</p>
                  </td>
                </tr>
              ) : filteredDues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm font-bold">
                    কোনো বকেয়া বাকি পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredDues.map((due: any) => {
                  const badge = getStatusBadge(due.status);
                  return (
                    <tr key={due.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 flex-shrink-0">
                            <Store className="w-4 h-4" />
                          </div>
                          <div>
                            <button
                              onClick={() => {
                                setSelectedDue(due);
                                setIsHistoryModalOpen(true);
                              }}
                              className="font-black text-slate-900 hover:text-indigo-600 transition-colors text-left hover:underline block text-sm"
                            >
                              {due.shop?.name || 'সরাসরি বিক্রি'}
                            </button>
                            <button
                              onClick={() => handleViewOrder(due.orderId)}
                              className="text-[10px] font-black text-indigo-600 hover:underline tracking-tight block text-left mt-0.5"
                            >
                              অর্ডার #{due.orderId}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 text-[10px] font-bold flex-shrink-0">
                            {due.deliveryManName?.charAt(0) || 'D'}
                          </div>
                          <span className="font-bold text-slate-800 text-xs">{due.deliveryManName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">{formatCurrency(due.dueAmount)}</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-600">{formatCurrency(due.paidAmount)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`font-black text-sm ${due.remainingDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatCurrency(due.remainingDue)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedDue(due);
                              setIsHistoryModalOpen(true);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                            title="আদায় হিস্ট্রি দেখুন"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {due.remainingDue > 0 && (
                            <button
                              onClick={() => {
                                setSelectedDue(due);
                                setIsCollectModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              আদায়
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Cards */}
        <div className="md:hidden flex flex-col divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
              <p className="mt-2 text-xs text-slate-400 font-bold">বকেয়া তালিকা লোড হচ্ছে...</p>
            </div>
          ) : filteredDues.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              কোনো বকেয়া বাকি পাওয়া যায়নি।
            </div>
          ) : (
            filteredDues.map((due: any) => {
              const badge = getStatusBadge(due.status);
              return (
                <div key={due.id} className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <button
                          onClick={() => {
                            setSelectedDue(due);
                            setIsHistoryModalOpen(true);
                          }}
                          className="font-black text-slate-900 hover:text-indigo-600 text-sm transition-colors text-left hover:underline block"
                        >
                          {due.shop?.name || 'সরাসরি বিক্রি'}
                        </button>
                        <button
                          onClick={() => handleViewOrder(due.orderId)}
                          className="text-[10px] font-black text-indigo-600 hover:underline tracking-tight block text-left mb-0.5"
                        >
                          অর্ডার #{due.orderId}
                        </button>
                        <p className="text-[10px] font-medium text-slate-400">ডেলিভারিম্যান: {due.deliveryManName || '—'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">মূল বাকি</p>
                      <p className="font-bold text-slate-900 text-xs sm:text-sm">{formatCurrency(due.dueAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">পরিশোধিত</p>
                      <p className="font-bold text-emerald-600 text-xs sm:text-sm">{formatCurrency(due.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">অবশিষ্ট বাকি</p>
                      <p className={`font-black text-xs sm:text-sm ${due.remainingDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(due.remainingDue)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => {
                        setSelectedDue(due);
                        setIsHistoryModalOpen(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      <History className="w-4 h-4" />
                      হিস্ট্রি
                    </button>
                    {due.remainingDue > 0 && (
                      <button
                        onClick={() => {
                          setSelectedDue(due);
                          setIsCollectModalOpen(true);
                        }}
                        className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                      >
                        <DollarSign className="w-4 h-4" />
                        আদায় করুন
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isCollectModalOpen && selectedDue && (
        <CollectModal 
          due={selectedDue} 
          onClose={() => setIsCollectModalOpen(false)} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['dues'] });
            queryClient.invalidateQueries({ queryKey: ['due-stats'] });
          }}
        />
      )}

      {isHistoryModalOpen && selectedDue && (
        <HistoryModal 
          due={selectedDue} 
          onClose={() => setIsHistoryModalOpen(false)} 
        />
      )}

      {isViewingOrderLoading && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-sm font-bold text-slate-700">অর্ডারের তথ্য লোড হচ্ছে...</span>
          </div>
        </div>
      )}

      {viewingOrder && (
        <OrderModal
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}

      {isManualDueModalOpen && (
        <ManualDueModal
          onClose={() => setIsManualDueModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['dues'] });
            queryClient.invalidateQueries({ queryKey: ['due-stats'] });
          }}
        />
      )}
    </div>
  );
}

function ManualDueModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [shopId, setShopId] = useState('');
  const [shopSearch, setShopSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user?.role !== Role.SUPER_ADMIN) {
    return null;
  }

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['all-shops-for-due'],
    queryFn: () => getShops(),
  });

  const selectedShop = useMemo(() => {
    return shops.find((s: any) => String(s.id) === String(shopId));
  }, [shops, shopId]);

  const filteredShops = useMemo(() => {
    if (!shopSearch.trim()) return shops;
    const q = shopSearch.toLowerCase();
    return shops.filter((s: any) =>
      s.name?.toLowerCase().includes(q) ||
      s.ownerName?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.route?.name?.toLowerCase().includes(q)
    );
  }, [shops, shopSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);

    if (!shopId) {
      showErrorToast('অনুগ্রহ করে একটি দোকান নির্বাচন করুন।');
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showErrorToast('টাকার পরিমাণ ০ এর বেশি হতে হবে।');
      return;
    }

    if (reason.trim().length < 3) {
      showErrorToast('বাকির কারণ কমপক্ষে ৩ অক্ষরের হতে হবে।');
      return;
    }

    try {
      setIsSubmitting(true);
      await addManualDue({
        shopId,
        amount: parsedAmount,
        reason: reason.trim(),
        note: note.trim() || undefined,
      });
      showSuccessToast('নতুন বকেয়া সফলভাবে যুক্ত হয়েছে।');
      onSuccess();
      onClose();
    } catch (err: any) {
      showErrorToast(err.message || 'বকেয়া যোগ করতে ব্যর্থ হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in duration-200 mb-0 pb-safe pb-4 sm:pb-0">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-base sm:text-lg font-black text-slate-900">নতুন বকেয়া বাকি এন্ট্রি</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5 relative">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">দোকান নির্বাচন করুন</label>

            {selectedShop ? (
              <div className="flex items-center justify-between p-3 border border-indigo-200 rounded-xl bg-indigo-50/40 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedShop.name}</p>
                    <p className="text-xs text-slate-500">
                      {selectedShop.route?.name ? `রুট: ${selectedShop.route.name}` : ''}
                      {selectedShop.ownerName ? ` · ${selectedShop.ownerName}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShopId(''); setShopSearch(''); setIsDropdownOpen(true); }}
                  className="text-xs font-bold text-indigo-600 hover:underline px-2 py-1"
                >
                  পরিবর্তন
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={shopSearch}
                    onChange={(e) => {
                      setShopSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="দোকানের নাম, রুট বা মোবাইল দিয়ে খুঁজুন..."
                    disabled={isLoading}
                    className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  />
                </div>

                {isLoading && <p className="text-[10px] text-slate-400 mt-1">দোকানের তালিকা লোড হচ্ছে...</p>}

                {isDropdownOpen && !isLoading && (
                  <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 divide-y divide-slate-100">
                    {filteredShops.length > 0 ? (
                      filteredShops.map((shop: any) => (
                        <button
                          key={shop.id}
                          type="button"
                          onClick={() => {
                            setShopId(String(shop.id));
                            setIsDropdownOpen(false);
                            setShopSearch('');
                          }}
                          className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">{shop.name}</p>
                            <p className="text-xs text-slate-500">
                              {shop.route?.name ? `রুট: ${shop.route.name}` : 'রুট নেই'}
                              {shop.ownerName ? ` · ${shop.ownerName}` : ''}
                            </p>
                          </div>
                          {shop.phone && (
                            <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {shop.phone}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">&quot;{shopSearch}&quot; নামে কোনো দোকান পাওয়া যায়নি</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">বাকি টাকার পরিমাণ (৳)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">বাকির কারণ / রেফারেন্স</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="যেমন: পূর্বের মেমোর বকেয়া টাকা"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">নোট (ঐচ্ছিক)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="অতিরিক্ত কোনো তথ্য থাকলে লিখুন..."
            />
          </div>

          <div className="pt-3 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-xs sm:text-sm font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="flex-1 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'বাকি সংরক্ষণ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CollectModal({ due, onClose, onSuccess }: { due: any, onClose: () => void, onSuccess: () => void }) {
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const [amount, setAmount] = useState(due.remainingDue.toString());
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: collections = [] } = useQuery({
    queryKey: ['order-collections', due.orderId],
    queryFn: () => apiRequest<any[]>(`/dues/order/${due.orderId}/collections`, { method: 'GET' }),
  });

  const pendingAmount = collections
    .filter((c: any) => c.status === 'PENDING')
    .reduce((sum: number, c: any) => sum + Number(c.collectedAmount), 0);

  const maxCollectable = Math.max(0, Number(due.remainingDue) - pendingAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const collectAmount = Number(amount);
    
    if (collectAmount <= 0) {
      showErrorToast('আদায়ের পরিমাণ ০ এর বেশি হতে হবে');
      return;
    }
    
    if (collectAmount > maxCollectable) {
      showErrorToast(`আদায়ের পরিমাণ সর্বোচ্চ সীমা (${formatCurrency(maxCollectable)}) এর বেশি হতে পারবে না।`);
      return;
    }

    try {
      setIsSubmitting(true);
      await collectDue({
        orderId: due.orderId,
        amount: collectAmount,
        note,
        collectionDate: date
      });
      showSuccessToast('কালেকশনটি সফলভাবে অনুমোদনের জন্য জমা দেওয়া হয়েছে।');
      onSuccess();
      onClose();
    } catch (err: any) {
      showErrorToast(err.message || 'কালেকশন জমা হতে ব্যর্থ হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in duration-200 mb-0 pb-safe pb-4 sm:pb-0">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-base sm:text-lg font-black text-slate-900">বকেয়া টাকা আদায় (Collection)</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">দোকান:</span>
              <span className="font-bold text-slate-900">{due.shop?.name}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span className="font-medium">অবশিষ্ট বাকি:</span>
              <span className="font-black">{formatCurrency(due.remainingDue)}</span>
            </div>
            {pendingAmount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span className="font-medium">অনুমোদনের অপেক্ষায় আছে:</span>
                <span className="font-bold">-{formatCurrency(pendingAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-emerald-600">
              <span>সর্বোচ্চ আদায়যোগ্য:</span>
              <span>{formatCurrency(maxCollectable)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">আদায়ের পরিমাণ (৳)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                step="0.01"
                required
                max={maxCollectable}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">আদায়ের তারিখ</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">নোট / মন্তব্য (ঐচ্ছিক)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="পেমেন্ট সম্পর্কিত বিবরণ..."
            />
          </div>

          <div className="pt-3 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-xs sm:text-sm font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isSubmitting || maxCollectable <= 0}
              className="flex-1 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'জমা দিন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryModal({ due, onClose }: { due: any, onClose: () => void }) {
  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['order-collections', due.orderId],
    queryFn: () => apiRequest<any[]>(`/dues/order/${due.orderId}/collections`, { method: 'GET' }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return { label: 'অনুমোদিত', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'PENDING':
        return { label: 'পেন্ডিং', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { label: 'বাতিল', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 leading-none">আদায় ও পেমেন্ট হিস্ট্রি</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">দোকান: {due.shop?.name} · অর্ডার #{due.orderId}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
             <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <p className="text-[10px] font-black uppercase text-slate-400">মূল বাকি</p>
                <p className="text-lg font-black text-slate-900 mt-0.5">{formatCurrency(due.dueAmount)}</p>
             </div>
             <div className="rounded-xl bg-emerald-50 p-3.5 border border-emerald-100">
                <p className="text-[10px] font-black uppercase text-emerald-600">পরিশোধিত</p>
                <p className="text-lg font-black text-emerald-700 mt-0.5">{formatCurrency(due.paidAmount)}</p>
             </div>
             <div className="rounded-xl bg-rose-50 p-3.5 border border-rose-100">
                <p className="text-[10px] font-black uppercase text-rose-600">অবশিষ্ট বাকি</p>
                <p className="text-lg font-black text-rose-700 mt-0.5">{formatCurrency(due.remainingDue)}</p>
             </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">তারিখ</th>
                  <th className="px-4 py-3">আদায়কারী (SR)</th>
                  <th className="px-4 py-3 text-right">আদায়ের পরিমাণ</th>
                  <th className="px-4 py-3 text-center">অবস্থা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                    </td>
                  </tr>
                ) : collections.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs font-bold">কোনো পূর্বের আদায় হিস্ট্রি নেই।</td>
                  </tr>
                ) : (
                  collections.map((c: any) => {
                    const badge = getStatusBadge(c.status);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-xs font-bold text-slate-700">{new Date(c.collectionDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">{c.srName}</td>
                        <td className="px-4 py-3 text-right font-black text-indigo-600">{formatCurrency(c.collectedAmount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
