'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Store, 
  User, 
  MapPin, 
  Phone, 
  Calendar, 
  Package, 
  Plus, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { formatCurrency, formatDate, toNumber } from '@/lib/utils/format';
import { getShops, createShop } from '@/lib/api/shops';
import { useToast } from '@/components/ui/toast-provider';
import type { Order, Shop, Route } from '@/types/api';

interface DueModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId: number;
  batchOrders: any[]; // DispatchBatchOrder with order relation
  draftDues: Record<number, Array<{ shopId: number; shopName: string; amount: number; note?: string }>>;
  route: Route;
  companyId: number;
  onAddDraftDue: (orderId: number, dues: Array<{ shopId: number; shopName: string; amount: number; note?: string }>) => void;
  onSuccess: () => void;
}

export function DueModal({ 
  isOpen, 
  onClose, 
  productName, 
  productId, 
  batchOrders,
  draftDues,
  route,
  companyId,
  onAddDraftDue,
  onSuccess
}: DueModalProps) {
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [dueAmount, setDueAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Shop management state
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [isLoadingShops, setIsLoadingShops] = useState(false);
  const [shopSearch, setShopSearch] = useState('');
  
  // List of added dues for this order/product
  const [orderDues, setOrderDues] = useState<Array<{ shopId: number; shopName: string; amount: number; note?: string }>>([]);

  // New shop form
  const [newShop, setNewShop] = useState({
    name: '',
    ownerName: '',
    phone: '',
    address: '',
    isActive: true
  });

  // Filter orders that contain the selected product
  const relevantOrders = useMemo(() => {
    return batchOrders.filter(bo => 
      bo.order.items.some((item: any) => item.productId === productId)
    ).map(bo => {
      const orderItem = bo.order.items.find((i: any) => i.productId === productId);
      return {
        ...bo,
        orderItem
      };
    });
  }, [batchOrders, productId]);

  const selectedOrder = useMemo(() => 
    relevantOrders.find(ro => ro.orderId === selectedOrderId),
    [relevantOrders, selectedOrderId]
  );

  const maxAllowed = useMemo(() => {
    if (!selectedOrder) return 0;
    const finalAmount = Number(selectedOrder.finalSoldAmount || 0);
    const advance = Number(selectedOrder.order?.advancePaid || 0);
    return Math.max(0, finalAmount - advance);
  }, [selectedOrder]);

  const currentTotalDues = useMemo(() => {
    return orderDues.reduce((sum, d) => sum + d.amount, 0);
  }, [orderDues]);

  const remainingBalanceForDues = useMemo(() => {
    return Math.max(0, maxAllowed - currentTotalDues);
  }, [maxAllowed, currentTotalDues]);

  useEffect(() => {
    if (isOpen) {
      if (relevantOrders.length === 1) {
        const oid = relevantOrders[0].orderId;
        setSelectedOrderId(oid);
        setOrderDues(draftDues[oid] || []);
      }
      fetchShops();
    } else {
      setSelectedOrderId(null);
      setDueAmount('');
      setNote('');
      setOrderDues([]);
      setSelectedShop(null);
      setShowShopSelector(false);
      setShowCreateShop(false);
    }
  }, [isOpen, relevantOrders, draftDues]);

  const handleOrderChange = (oid: number) => {
    setSelectedOrderId(oid);
    setOrderDues(draftDues[oid] || []);
    setSelectedShop(null);
    setDueAmount('');
    setNote('');
  };

  const fetchShops = async () => {
    try {
      setIsLoadingShops(true);
      const shops = await getShops(route.id);
      setAllShops(shops);
    } catch (error) {
      console.error('Failed to fetch shops', error);
    } finally {
      setIsLoadingShops(false);
    }
  };

  const filteredShops = useMemo(() => {
    if (!shopSearch) return allShops;
    const q = shopSearch.toLowerCase();
    return allShops.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.ownerName?.toLowerCase().includes(q)) || 
      (s.phone?.includes(q))
    );
  }, [allShops, shopSearch]);

  const handleAddShopDue = () => {
    if (!selectedShop) {
      showErrorToast('Please select a shop first.');
      return;
    }
    const amount = Number(dueAmount);
    if (isNaN(amount) || amount <= 0) {
      showErrorToast('Please enter a valid amount greater than 0.');
      return;
    }
    
    const potentialTotal = currentTotalDues + amount;

    if (potentialTotal > maxAllowed + 0.01) {
      showErrorToast(`Total dues (${potentialTotal}) cannot exceed max allowed BDT ${maxAllowed}.`);
      return;
    }

    const existingIndex = orderDues.findIndex(d => d.shopId === selectedShop.id);
    if (existingIndex > -1) {
      setOrderDues(prev => {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          amount: updated[existingIndex].amount + amount,
          note: note ? note.trim() : updated[existingIndex].note,
        };
        return updated;
      });
      showSuccessToast(`Dues merged for ${selectedShop.name}.`);
    } else {
      setOrderDues(prev => [
        ...prev,
        { shopId: selectedShop.id, shopName: selectedShop.name, amount, note: note ? note.trim() : undefined }
      ]);
      showSuccessToast(`Due added for ${selectedShop.name}.`);
    }

    setSelectedShop(null);
    setDueAmount('');
    setNote('');
  };

  const handleRemoveShopDue = (shopId: number) => {
    setOrderDues(prev => prev.filter(d => d.shopId !== shopId));
    showSuccessToast('Due entry removed.');
  };

  const handleLinkShop = (shopId: number) => {
    const shop = allShops.find(s => s.id === shopId);
    if (shop) {
      setSelectedShop(shop);
      setShowShopSelector(false);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const shop = await createShop({
        ...newShop,
        routeId: route.id,
        companyId: companyId
      });
      showSuccessToast('Shop created successfully.');
      setSelectedShop(shop);
      fetchShops();
      setShowCreateShop(false);
      setShowShopSelector(false);
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to create shop');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllDues = () => {
    if (!selectedOrderId) return;
    onAddDraftDue(selectedOrderId, orderDues);
    showSuccessToast('Dues updated in settlement draft');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={isSaving ? undefined : onClose} />
      
      <div className="relative z-10 flex h-[95vh] sm:h-[90vh] w-full sm:max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">

        {/* Global Loading Overlay */}
        {isSaving && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-t-3xl sm:rounded-3xl">
            <div className="flex flex-col items-center gap-4">
              <div className="h-14 w-14 rounded-full border-4 border-slate-200 border-t-cyan-600 animate-spin" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-700">Saving...</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Assign Shop Dues: {productName}</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{route.name} Route</p>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Order Selection */}
          {relevantOrders.length > 1 && !selectedOrderId ? (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Package className="h-3 w-3" />
                Select Order
              </h3>
              <div className="space-y-3">
                {relevantOrders.map(ro => (
                  <button
                    key={ro.orderId}
                    onClick={() => handleOrderChange(ro.orderId)}
                    className={`w-full flex flex-col gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                      selectedOrderId === ro.orderId 
                        ? 'border-cyan-600 bg-cyan-50/30' 
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3 sm:gap-2">
                       <div className="flex items-start sm:items-center gap-3">
                          <div className={`flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl ${selectedOrderId === ro.orderId ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                             <Store className="h-5 w-5" />
                          </div>
                          <div>
                             <p className="text-sm font-black text-slate-900 leading-tight mb-0.5">
                               {ro.order.shop?.name || "Consolidated Fast-Track Order"}
                             </p>
                             <p className="text-[10px] font-bold text-slate-500 uppercase">
                               Order #{ro.orderId} · SR: {ro.order.createdBy || '—'}
                             </p>
                          </div>
                       </div>
                       <div className="text-left sm:text-right pl-13 sm:pl-0">
                          <p className="text-sm font-black text-slate-900">{formatCurrency(ro.finalSoldAmount)}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Final Amount</p>
                       </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Dues Entry Forms */}
          {selectedOrderId && !showShopSelector && !showCreateShop && (
            <div className="space-y-6">
              
              {/* List of Added Dues */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Already Added Dues
                </h3>
                <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 bg-slate-50/30">
                  {orderDues.map((due) => (
                    <div key={due.shopId} className="flex items-center justify-between p-4 group">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{due.shopName}</p>
                        {due.note && <p className="text-xs text-slate-400 truncate mt-0.5">{due.note}</p>}
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <span className="text-sm font-black text-slate-900">{formatCurrency(due.amount)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveShopDue(due.shopId)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {orderDues.length === 0 && (
                    <div className="p-6 text-center text-slate-400 font-bold text-sm">
                      No dues added yet.
                    </div>
                  )}
                  
                  {/* Summary Totals Footer */}
                  <div className="p-4 bg-slate-50/50 flex items-center justify-between font-black text-sm text-slate-700">
                    <span>Total Due Added:</span>
                    <div className="text-right">
                      <p className="text-cyan-700 font-black">{formatCurrency(currentTotalDues)}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                        Max Allowed: {formatCurrency(maxAllowed)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form to Add Shop Due */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Add Shop Due
                </h3>

                <div className="space-y-4">
                  {/* Shop Select Button */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 px-1">Shop</label>
                    {selectedShop ? (
                      <div className="flex items-center justify-between border-2 border-cyan-100 bg-cyan-50/20 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                          <Store className="h-5 w-5 text-cyan-600" />
                          <div>
                            <p className="text-sm font-black text-slate-900">{selectedShop.name}</p>
                            <p className="text-xs text-slate-400">{selectedShop.ownerName}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedShop(null)}
                          className="text-xs font-bold text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowShopSelector(true)}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-sm font-black text-slate-400 hover:border-cyan-600 hover:text-cyan-600 transition-all bg-slate-50/30"
                      >
                        <Plus className="h-4 w-4" />
                        Select Shop from Route
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Due Amount Input */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 px-1">Due Amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                        <input 
                          type="number"
                          value={dueAmount}
                          onChange={(e) => setDueAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 py-3 pl-8 pr-4 text-base font-black outline-none focus:border-cyan-600 focus:bg-white transition-all"
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase px-1">
                        Remaining Limit: {formatCurrency(remainingBalanceForDues)}
                      </p>
                    </div>

                    {/* Note Input */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 px-1">Note (Optional)</label>
                      <input 
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Due reason..."
                        className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-600 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddShopDue}
                    disabled={!selectedShop || !dueAmount || Number(dueAmount) <= 0 || Number(dueAmount) > remainingBalanceForDues}
                    className="w-full py-3.5 rounded-2xl bg-cyan-700 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-cyan-100 hover:bg-cyan-800 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add/Merge Due Entry
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* Shop Selector Section */}
          {showShopSelector && !showCreateShop && (
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Select Shop for Route: {route.name}</h3>
                  <button 
                    onClick={() => setShowShopSelector(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
               </div>
               
               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text"
                    value={shopSearch}
                    onChange={(e) => setShopSearch(e.target.value)}
                    placeholder="Search shops..."
                    className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium outline-none focus:border-cyan-600 focus:bg-white transition-all"
                  />
               </div>

               <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {filteredShops.map(shop => (
                    <button
                      key={shop.id}
                      onClick={() => handleLinkShop(shop.id)}
                      className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-cyan-200 hover:bg-cyan-50/20 transition-all text-left group"
                    >
                       <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 group-hover:bg-cyan-100 group-hover:text-cyan-600">
                             <Store className="h-5 w-5" />
                          </div>
                          <div>
                             <p className="text-sm font-black text-slate-900">{shop.name}</p>
                             <p className="text-xs text-slate-400">{shop.ownerName || 'No owner name'}</p>
                          </div>
                       </div>
                       <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-cyan-600" />
                    </button>
                  ))}
                  
                  {filteredShops.length === 0 && (
                    <div className="py-8 text-center">
                       <p className="text-sm text-slate-400 font-bold">No shops found</p>
                    </div>
                  )}
               </div>

               <button 
                onClick={() => setShowCreateShop(true)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-sm font-black text-slate-400 hover:border-cyan-600 hover:text-cyan-600 transition-all"
               >
                 <Plus className="h-4 w-4" />
                 Create New Shop
               </button>
            </div>
          )}

          {/* Create Shop Form */}
          {showCreateShop && (
            <form onSubmit={handleCreateShop} className="space-y-4">
               <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Create New Shop</h3>
                  <button 
                    type="button"
                    onClick={() => setShowCreateShop(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Back to Selection
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 px-1">Shop Name *</label>
                    <input 
                      required
                      value={newShop.name}
                      onChange={(e) => setNewShop({...newShop, name: e.target.value})}
                      className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-cyan-600"
                      placeholder="e.g. Mina Store"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 px-1">Owner Name</label>
                    <input 
                      value={newShop.ownerName}
                      onChange={(e) => setNewShop({...newShop, ownerName: e.target.value})}
                      className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-cyan-600"
                      placeholder="Owner name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 px-1">Phone</label>
                    <input 
                      value={newShop.phone}
                      onChange={(e) => setNewShop({...newShop, phone: e.target.value})}
                      className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-cyan-600"
                      placeholder="Contact number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 px-1">Address</label>
                    <input 
                      value={newShop.address}
                      onChange={(e) => setNewShop({...newShop, address: e.target.value})}
                      className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-cyan-600"
                      placeholder="Physical address"
                    />
                  </div>
               </div>

               <button 
                type="submit"
                disabled={isSaving}
                className="w-full py-4 rounded-2xl bg-cyan-600 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-cyan-100 disabled:opacity-50"
               >
                 {isSaving ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Create & Link Shop'}
               </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:px-6 sm:py-5 flex flex-col gap-3 pb-8 sm:pb-5">
           <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
             <button 
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3.5 sm:py-3 rounded-xl text-sm font-black uppercase text-slate-500 bg-slate-200/50 hover:bg-slate-200 sm:bg-transparent sm:hover:bg-transparent hover:text-slate-700 transition-colors"
             >
               Cancel
             </button>
             {!showShopSelector && !showCreateShop && (
              <button 
                onClick={handleSaveAllDues}
                disabled={isSaving || !selectedOrderId}
                className="w-full sm:w-auto px-10 py-3.5 sm:py-3 rounded-xl bg-slate-900 text-sm font-black uppercase tracking-widest text-white shadow-xl tracking-widest hover:bg-slate-800 disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none transition-all flex items-center justify-center gap-2"
               >
               <CheckCircle2 className="h-4 w-4" />
               Save All Dues
             </button>
            )}
           </div>
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
