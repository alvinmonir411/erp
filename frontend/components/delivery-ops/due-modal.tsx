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
  ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDate, toNumber } from '@/lib/utils/format';
import { getShops, createShop } from '@/lib/api/shops';
import { updateOrderShop } from '@/lib/api/orders';
// Removed unused upsertDue import
import { useToast } from '@/components/ui/toast-provider';
import type { Order, Shop, Route } from '@/types/api';

interface DueModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId: number;
  batchOrders: any[]; // DispatchBatchOrder with order relation
  draftDues: Record<number, number>;
  route: Route;
  onAddDraftDue: (orderId: number, amount: number) => void;
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
  onAddDraftDue,
  onSuccess
}: DueModalProps) {
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [dueAmount, setDueAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Shop management state
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [isLoadingShops, setIsLoadingShops] = useState(false);
  const [shopSearch, setShopSearch] = useState('');
  
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

  useEffect(() => {
    if (isOpen) {
      // Auto-select if only one order
      if (relevantOrders.length === 1) {
        setSelectedOrderId(relevantOrders[0].orderId);
        if (toNumber(relevantOrders[0].dueAmount) > 0) {
          setDueAmount(String(relevantOrders[0].dueAmount));
        }
      }
      fetchShops();
    } else {
      // Reset state on close
      setSelectedOrderId(null);
      setDueAmount('');
      setNote('');
      setShowShopSelector(false);
      setShowCreateShop(false);
    }
  }, [isOpen, relevantOrders]);

  const maxAllowed = useMemo(() => {
    if (!selectedOrder) return 0;
    
    // The final sold amount is the actual delivered value of the order
    const finalAmount = Number(selectedOrder.finalSoldAmount || 0);
    const advance = Number(selectedOrder.order?.advancePaid || 0);
    
    // Note: Do not subtract selectedOrder.dueAmount here! 
    // selectedOrder.dueAmount contains the initial order's remaining due (e.g. 650),
    // which caused the bug where maxAllowed became 0.
    // The max allowed should be the final amount minus advance minus any ALREADY SAVED delivery dues (if we had them).
    // Also, we do NOT subtract the draft due for this order because the user is currently editing it.
    const existingSavedDueForThisOrder = 0; 
    
    return Math.max(0, finalAmount - advance - existingSavedDueForThisOrder);
  }, [selectedOrder]);

  // Auto-fill due amount when order is selected
  useEffect(() => {
    if (selectedOrderId && maxAllowed > 0) {
       // If there is an existing draft for THIS order, show that
       if (draftDues[selectedOrderId]) {
         setDueAmount(String(draftDues[selectedOrderId]));
       } else {
         // Otherwise auto-fill with max
         setDueAmount(String(maxAllowed));
       }
    } else if (selectedOrderId && maxAllowed === 0) {
       setDueAmount('0');
    }
  }, [selectedOrderId, maxAllowed, draftDues]);

  const validation = useMemo(() => {
    if (!selectedOrderId) return { isValid: false, message: 'Select an order first.' };
    
    if (maxAllowed === 0) {
      return { isValid: false, message: 'Max allowed is BDT 0.' };
    }
    
    if (!dueAmount) return { isValid: false, message: 'Enter a due amount.' };
    
    const amount = Number(dueAmount);
    if (isNaN(amount)) return { isValid: false, message: 'Invalid amount.' };
    if (amount < 0) return { isValid: false, message: 'Due cannot be negative.' };
    if (amount === 0) return { isValid: false, message: 'Due amount must be greater than 0.' };
    
    if (amount > maxAllowed) {
      return { 
        isValid: false, 
        message: `Due amount cannot be greater than final amount. Max allowed is BDT ${maxAllowed}.` 
      };
    }
    
    return { isValid: true, message: 'Ready to save' };
  }, [dueAmount, maxAllowed, selectedOrderId]);

  const fetchShops = async () => {
    try {
      setIsLoadingShops(true);
      // Fetch shops for the current route
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

  const handleLinkShop = async (shopId: number) => {
    if (!selectedOrderId) return;
    try {
      setIsSaving(true);
      await updateOrderShop(selectedOrderId, shopId);
      showSuccessToast('Shop linked to order successfully');
      // Update local state to reflect the link
      onSuccess(); // Refresh batch data
      setShowShopSelector(false);
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to link shop');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    try {
      setIsSaving(true);
      const shop = await createShop({
        ...newShop,
        routeId: route.id
      });
      await updateOrderShop(selectedOrderId, shop.id);
      showSuccessToast('Shop created and linked to order');
      onSuccess(); // Refresh batch data
      setShowCreateShop(false);
      setShowShopSelector(false);
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to create shop');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDue = async () => {
    if (!selectedOrder || !dueAmount) return;
    
    if (!validation.isValid) {
      showErrorToast(validation.message);
      return;
    }

    if (!selectedOrder.order.shopId) {
      showErrorToast('Please link a shop before adding due');
      setShowShopSelector(true);
      return;
    }

    // Instead of API call, we just update the draft in parent
    onAddDraftDue(selectedOrder.orderId, Number(dueAmount));
    showSuccessToast('Due added to settlement draft');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 flex h-[95vh] sm:h-[90vh] w-full sm:max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Assign Due for {productName}</h2>
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
          {!selectedOrderId || (!showShopSelector && !showCreateShop) ? (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Package className="h-3 w-3" />
                Select Order
              </h3>
              <div className="space-y-3">
                {relevantOrders.map(ro => (
                  <button
                    key={ro.orderId}
                    onClick={() => setSelectedOrderId(ro.orderId)}
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
                             <p className="text-sm font-black text-slate-900 leading-tight mb-0.5">{ro.order.shop?.name || 'Missing Shop'}</p>
                             <p className="text-[10px] font-bold text-slate-500 uppercase">Order #{ro.orderId} · {ro.order.createdBy}</p>
                          </div>
                       </div>
                       <div className="text-left sm:text-right pl-13 sm:pl-0">
                          <p className="text-sm font-black text-slate-900">{formatCurrency(ro.finalSoldAmount)}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Final Amount</p>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100/50">
                       <div>
                          <p className="text-[8px] font-black uppercase text-slate-400">Ordered Qty</p>
                          <p className="text-xs font-bold text-slate-700">{ro.orderItem.quantity} {ro.orderItem.product.unit}</p>
                       </div>
                       <div>
                          <p className="text-[8px] font-black uppercase text-slate-400">Date</p>
                          <p className="text-xs font-bold text-slate-700">{formatDate(ro.order.orderDate)}</p>
                       </div>
                       <div>
                          <p className="text-[8px] font-black uppercase text-slate-400">Advance</p>
                          <p className="text-xs font-bold text-emerald-600">{formatCurrency(ro.order.advancePaid || 0)}</p>
                       </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Due Entry Form */}
          {selectedOrder && !showShopSelector && !showCreateShop && (
            <div className="space-y-6 pt-2 border-t border-slate-100 mt-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                       <Plus className="h-3 w-3 text-cyan-600" />
                       Due Amount
                    </label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                       <input 
                        type="number"
                        value={dueAmount}
                        onChange={(e) => setDueAmount(e.target.value)}
                        placeholder="0.00"
                        className={`w-full rounded-2xl border-2 py-3.5 pl-8 pr-4 text-lg font-black outline-none transition-all ${
                          dueAmount && !validation.isValid 
                            ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-600' 
                            : 'border-slate-100 bg-slate-50 text-slate-900 focus:border-cyan-600 focus:bg-white'
                        }`}
                       />
                    </div>
                    <p className={`text-[10px] font-bold uppercase ${dueAmount && !validation.isValid ? 'text-rose-500' : 'text-slate-400'}`}>
                      {dueAmount && !validation.isValid ? validation.message : `Max allowed: ${formatCurrency(maxAllowed)}`}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Note (Optional)</label>
                    <textarea 
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="Enter a reason or note..."
                      className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-900 outline-none focus:border-cyan-600 focus:bg-white transition-all resize-none"
                    />
                  </div>
               </div>

               {!selectedOrder.order.shopId ? (
                 <div className="rounded-2xl bg-amber-50 p-4 flex items-center justify-between border border-amber-100">
                    <div className="flex items-center gap-3">
                       <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                          <AlertCircle className="h-5 w-5" />
                       </div>
                       <div>
                          <p className="text-sm font-bold text-amber-900">Shop missing for this order</p>
                          <p className="text-xs text-amber-700">A shop must be linked before saving due.</p>
                       </div>
                    </div>
                    <button 
                      onClick={() => setShowShopSelector(true)}
                      className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-amber-700 transition-colors"
                    >
                      Fix Now
                    </button>
                 </div>
               ) : validation.isValid ? (
                 <div className="rounded-2xl bg-emerald-50 p-4 flex items-center gap-3 border border-emerald-100">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                       <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                       <p className="text-sm font-bold text-emerald-900">Ready to save</p>
                       <p className="text-xs text-emerald-700">Due will be linked to <span className="font-bold">{selectedOrder.order.shop?.name || 'Linked Shop'}</span></p>
                    </div>
                 </div>
               ) : dueAmount ? (
                 <div className="rounded-2xl bg-rose-50 p-4 flex items-center gap-3 border border-rose-100">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                       <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                       <p className="text-sm font-bold text-rose-900">Cannot save</p>
                       <p className="text-xs text-rose-700">{validation.message}</p>
                    </div>
                 </div>
               ) : null}
            </div>
          )}

          {/* Shop Selector */}
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
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:px-6 sm:py-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pb-8 sm:pb-6">
           <button 
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3.5 sm:py-3 rounded-xl text-sm font-black uppercase text-slate-500 bg-slate-200/50 hover:bg-slate-200 sm:bg-transparent sm:hover:bg-transparent hover:text-slate-700 transition-colors"
           >
             Cancel
           </button>
           {!showShopSelector && !showCreateShop && (
            <button 
              onClick={handleSaveDue}
              disabled={isSaving || !selectedOrderId || !dueAmount || !validation.isValid || maxAllowed === 0}
              className="w-full sm:w-auto px-10 py-3.5 sm:py-3 rounded-xl bg-slate-900 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none transition-all flex items-center justify-center gap-2"
             >
               {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
               Add Due to Settlement
             </button>
           )}
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
