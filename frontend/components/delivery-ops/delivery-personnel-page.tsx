'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Users, ArrowLeft, MapPin, Phone, Mail, MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageCard } from '@/components/ui/page-card';
import { StateMessage } from '@/components/ui/state-message';
import { useToast } from '@/components/ui/toast-provider';
import {
  createDeliveryPerson,
  deleteDeliveryPerson,
  getDeliveryPeople,
  updateDeliveryPerson,
} from '@/lib/api/delivery-ops';
import type { DeliveryPerson } from '@/types/api';

export function DeliveryPersonnelPage() {
  const router = useRouter();
  const [personnel, setPersonnel] = useState<DeliveryPerson[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<DeliveryPerson | null>(null);
  const { error: showErrorToast, success: showSuccessToast } = useToast();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/delivery-ops');
    }
  };

  const fetchPersonnel = async () => {
    try {
      setIsLoading(true);
      const data = await getDeliveryPeople(true); // Include inactive
      setPersonnel(data);
    } catch (error) {
      showErrorToast('Failed to load delivery personnel');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonnel();
  }, []);

  const handleEdit = (person: DeliveryPerson) => {
    setEditingPerson(person);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingPerson(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this delivery person?')) return;
    try {
      const response = await deleteDeliveryPerson(id);
      showSuccessToast(response.message || 'Delivery person deleted successfully');
      fetchPersonnel();
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to delete delivery person');
    }
  };

  const filteredPersonnel = personnel.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white px-4 py-3 border-b border-slate-100 lg:hidden">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 font-bold text-slate-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back</span>
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-slate-900">Personnel</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="hidden lg:flex lg:flex-row lg:items-end lg:justify-between pt-4 lg:pt-0">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700">
            Logistics Management
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            Delivery Personnel
          </h1>
        </div>
        <button
          onClick={handleAddNew}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-xl shadow-slate-200 transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add Staff
        </button>
      </div>

      {/* Mobile Search - Visible only on mobile */}
      <div className="pt-12 lg:hidden">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>
      </div>

      <PageCard
        title="Staff Directory"
        description="Manage your distribution team."
        className="hidden lg:block"
        action={
          <div className="relative w-full max-w-xs hidden lg:block">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm"
            />
          </div>
        }
        noPadding
      >
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <th className="px-6 py-4">Name & Contact</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-sm font-medium text-slate-400">
                    Loading personnel...
                  </td>
                </tr>
              ) : filteredPersonnel.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16">
                    <StateMessage
                      title="No delivery personnel found"
                      description="Add staff to start assigning batches."
                      icon={<Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />}
                    />
                  </td>
                </tr>
              ) : (
                filteredPersonnel.map((person) => (
                  <tr key={person.id} className="transition hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{person.name}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {person.phone} {person.email ? `· ${person.email}` : ''}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-700">{person.address || '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${person.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                          }`}
                      >
                        {person.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(person)}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(person.id)}
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageCard>

      {/* Mobile Card List */}
      <div className="lg:hidden grid grid-cols-1 min-[480px]:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="py-20 text-center text-sm font-bold text-slate-400">Loading staff...</div>
        ) : filteredPersonnel.length === 0 ? (
          <div className="py-20 bg-white rounded-3xl border border-slate-100">
            <StateMessage
              title="No staff found"
              description="Add staff to start assigning batches."
              icon={<Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />}
            />
          </div>
        ) : (
          filteredPersonnel.map((person) => (
            <div key={person.id} className="bg-white rounded-3xl border border-slate-100 p-5 space-y-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 font-black">
                    {person.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-slate-900">{person.name}</p>
                    <span
                      className={`inline-flex mt-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${person.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                        }`}
                    >
                      {person.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(person)} className="p-2 text-slate-400 bg-slate-50 rounded-xl"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(person.id)} className="p-2 text-rose-400 bg-rose-50 rounded-xl"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <div className="flex items-center gap-3 text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-bold">{person.phone}</span>
                </div>
                {person.email && (
                  <div className="flex items-center gap-3 text-slate-600">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs font-bold truncate">{person.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-bold">{person.address || 'No address provided'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Add Button for Mobile */}
      <button
        onClick={handleAddNew}
        className="fixed bottom-6 right-6 lg:hidden z-50 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-2xl transition hover:bg-slate-800"
      >
        <Plus className="h-6 w-6" />
      </button>

      {isModalOpen && (
        <PersonnelFormModal
          person={editingPerson}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchPersonnel();
          }}
        />
      )}
    </div>
  );
}

function PersonnelFormModal({
  person,
  onClose,
  onSuccess,
}: {
  person: DeliveryPerson | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: person?.name || '',
    phone: person?.phone || '',
    email: person?.email || '',
    address: person?.address || '',
    notes: person?.notes || '',
    isActive: person ? person.isActive : true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      if (person) {
        await updateDeliveryPerson(person.id, formData);
        showSuccessToast('Delivery person updated successfully');
      } else {
        await createDeliveryPerson(formData);
        showSuccessToast('Delivery person added successfully');
      }
      onSuccess();
    } catch (error: any) {
      showErrorToast(error.message || 'Failed to save delivery person');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="border-b border-slate-100 px-8 py-6 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900">
            {person ? 'Edit Staff' : 'Add New Staff'}
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 lg:hidden">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 max-h-[85vh] overflow-y-auto">
          <div className="grid gap-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Full Address
              </label>
              <input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Internal Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none"
              />
            </div>

            <label className="flex items-center gap-4 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 transition hover:bg-slate-100 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-6 w-6 rounded-lg border-slate-300 text-cyan-700 focus:ring-cyan-700"
              />
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Active Status</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                  Visible in assignment lists.
                </p>
              </div>
            </label>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3 border-t border-slate-100 pt-8">
            <button
              type="button"
              onClick={onClose}
              className="order-2 sm:order-1 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="order-1 sm:order-2 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isSaving ? 'Processing...' : (person ? 'Update Staff' : 'Add Staff')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
