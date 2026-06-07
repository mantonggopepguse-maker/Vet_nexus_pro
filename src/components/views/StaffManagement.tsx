import React, { useState } from 'react';
import { User, UserRole, ViewState } from '../../types';
import { Plus, Search, Shield, MoreVertical, X, Check } from 'lucide-react';
import { AddStaffForm } from '../forms/AddStaffForm';

interface StaffManagementProps {
  users: User[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

interface UserWithPassword extends User {
  password?: string;
}

export const StaffManagement: React.FC<StaffManagementProps> = ({ users, onAddUser, onUpdateUser, onDeleteUser }) => {
  const [viewState, setViewState] = useState<ViewState>('LIST');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCredentials, setShowCredentials] = useState<{ email: string; password: string } | null>(null);

  const handleCreateNew = () => {
    setEditingUser(null);
    setViewState('ADD_STAFF');
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setViewState('EDIT_STAFF');
  };

  const handleBack = () => {
    setEditingUser(null);
    setViewState('LIST');
  };

  const handleSaveUser = (user: UserWithPassword) => {
    if (editingUser) {
      onUpdateUser(user);
    } else {
      const password = user.password;
      onAddUser(user);
      // Show credentials for new user
      setShowCredentials({ email: user.email, password: password || '123456' });
    }
    handleBack();
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter as UserRole);
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (viewState === 'ADD_STAFF' || viewState === 'EDIT_STAFF') {
    return (
      <AddStaffForm
        onBack={handleBack}
        onSave={handleSaveUser}
        onDelete={onDeleteUser}
        editingUser={editingUser}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Staff Management</h1>
          <p className="text-slate-400 font-medium text-sm">Manage team members and their access roles</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="soft-btn-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-amber-200"
        >
          <Plus className="w-5 h-5" /> Add Staff
        </button>
      </div>

      {/* Filters */}
      <div className="soft-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full soft-input pl-10 pr-4 py-2 font-medium text-slate-700"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full soft-input px-4 py-2 font-medium text-slate-700 appearance-none bg-transparent"
            >
              <option value="all">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Veterinarian">Veterinarian</option>
              <option value="Lab Scientist">Lab Scientist</option>
              <option value="Vet Tech">Vet Tech</option>
              <option value="Vet Assistant">Vet Assistant</option>
              <option value="Receptionist">Receptionist</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full soft-input px-4 py-2 font-medium text-slate-700 appearance-none bg-transparent"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>

          <div className="flex items-center justify-center">
            <span className="text-sm font-bold text-slate-500">
              {filteredUsers.length} of {users.length} members
            </span>
          </div>
        </div>
      </div>

      {/* Staff List */}
      {filteredUsers.length === 0 ? (
        <div className="soft-card p-12 text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-2">No Staff Members Found</h3>
          <p className="text-slate-400 text-sm mb-6">
            {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Start by adding your first staff member'}
          </p>
          <button
            onClick={handleCreateNew}
            className="soft-btn-primary px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(user => (
            <div key={user.id} className="soft-card p-6 relative group hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-md ${user.status === 'Suspended' ? 'bg-slate-400' : 'bg-gradient-to-br from-amber-500 to-amber-600'}`}>
                  {user.name.charAt(0)}
                </div>
                <button
                  onClick={() => handleEdit(user)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <h3 className="font-bold text-slate-700 text-lg">{user.name}</h3>
              <p className="text-xs text-slate-400 font-medium mb-2">{user.email}</p>
              {user.username && (
                <p className="text-xs text-amber-600 font-medium mb-4">@{user.username}</p>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                {user.roles.map(role => (
                  <span key={role} className="px-2 py-1 rounded-md bg-amber-50 text-amber-600 text-[10px] font-extrabold uppercase tracking-wide">
                    {role}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                <span className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                <span className={`text-xs font-bold ${user.status === 'Active' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {user.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-emerald-50">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-extrabold text-slate-800">Staff Member Created</h2>
                </div>
                <p className="text-sm text-slate-600">Please share these login credentials with the new staff member.</p>
              </div>
              <button onClick={() => setShowCredentials(null)} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm text-slate-700">
                  {showCredentials.email}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm text-slate-700">
                  {showCredentials.password}
                </div>
              </div>
              <p className="text-xs text-slate-400">
                ⚠️ Please save these credentials securely. The password cannot be recovered later.
              </p>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setShowCredentials(null)}
                className="w-full soft-btn-primary py-3 rounded-xl font-bold"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
