'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Mail,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit2,
  Trash2,
  Truck
} from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/api/users';
import { User, Role, UserStatus } from '@/types/api';
import { useAuth } from '../auth/auth-provider';
import { useToast } from '@/components/ui/toast-provider';

export function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalOpen(false);
      setEditingUser(null);
      success('User created successfully');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to create user');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalOpen(false);
      setEditingUser(null);
      success('User updated successfully');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update user');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      success('User deleted successfully');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete user');
    }
  });

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    updateMutation.mutate({
      id: user.id,
      data: { status: newStatus }
    });
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case Role.SUPER_ADMIN: return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case Role.ADMIN: return <ShieldCheck className="w-4 h-4 text-orange-500" />;
      case Role.MANAGER: return <ShieldCheck className="w-4 h-4 text-blue-500" />;
      case Role.SR: return <Shield className="w-4 h-4 text-emerald-500" />;
      case Role.DELIVERY_MAN: return <Truck className="w-4 h-4 text-amber-600" />;
      default: return <UserIcon className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">User Management</h2>
          <p className="text-sm text-muted">Manage system users, roles, and access permissions.</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wider">Total Users</p>
              <p className="text-xl font-bold text-foreground">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wider">Active</p>
              <p className="text-xl font-bold text-foreground">{users.filter(u => u.status === UserStatus.ACTIVE).length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wider">Admins</p>
              <p className="text-xl font-bold text-foreground">{users.filter(u => u.role === Role.SUPER_ADMIN).length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wider">SRs</p>
              <p className="text-xl font-bold text-foreground">{users.filter(u => u.role === Role.SR).length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-zinc-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    <p className="mt-2 text-muted">Loading users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold border border-zinc-200">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground leading-none">{user.name}</p>
                          <p className="text-xs text-muted mt-1 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-600">
                      @{user.username}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-100 w-fit border border-zinc-200">
                        {getRoleIcon(user.role)}
                        <span className="text-[11px] font-bold uppercase tracking-tight text-zinc-700">
                          {user.role.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => currentUser?.role === Role.SUPER_ADMIN && handleToggleStatus(user)}
                        disabled={currentUser?.role !== Role.SUPER_ADMIN}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${user.status === UserStatus.ACTIVE
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                          } ${currentUser?.role !== Role.SUPER_ADMIN ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${user.status === UserStatus.ACTIVE ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {user.status}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-muted text-xs font-medium">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {currentUser?.role === Role.SUPER_ADMIN && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-border animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-lg font-bold text-foreground">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-zinc-200 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-muted" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  name: formData.get('name') as string,
                  username: formData.get('username') as string,
                  email: formData.get('email') as string,
                  role: formData.get('role') as Role,
                  status: formData.get('status') as UserStatus,
                };
                const password = formData.get('password') as string;

                if (editingUser) {
                  updateMutation.mutate({
                    id: editingUser.id,
                    data: password ? { ...data, password } : data
                  });
                } else {
                  createMutation.mutate({ ...data, password });
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">Full Name</label>
                  <input
                    name="name"
                    required
                    defaultValue={editingUser?.name}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">Username</label>
                  <input
                    name="username"
                    required
                    defaultValue={editingUser?.username}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="johndoe"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">Email Address</label>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={editingUser?.email}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">
                  {editingUser ? 'New Password (Optional)' : 'Password'}
                </label>
                <input
                  name="password"
                  type="password"
                  required={!editingUser}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">Role</label>
                  <select
                    name="role"
                    defaultValue={editingUser?.role || Role.SR}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                  >
                    <option value={Role.SUPER_ADMIN}>Super Admin</option>
                    <option value={Role.ADMIN}>Admin</option>
                    <option value={Role.MANAGER}>Manager</option>
                    <option value={Role.SR}>Sales Representative (SR)</option>
                    <option value={Role.DELIVERY_MAN}>Delivery Man</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted">Status</label>
                  <select
                    name="status"
                    defaultValue={editingUser?.status || UserStatus.ACTIVE}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                  >
                    <option value={UserStatus.ACTIVE}>Active</option>
                    <option value={UserStatus.INACTIVE}>Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingUser ? (
                    'Update User'
                  ) : (
                    'Create User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
