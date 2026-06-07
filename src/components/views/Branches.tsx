import React, { useState, useEffect } from 'react';
import { Building2, Plus, MapPin, Phone, Users, Calendar, ArrowRight, ShieldCheck, ExternalLink, Activity, X } from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';

export const Branches: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newBranch, setNewBranch] = useState({
    name: '',
    acronym: '',
    address: '',
    phone: '',
    currencySymbol: '₦'
  });

  const loadBranches = async () => {
    setIsLoading(true);
    try {
      const data = await api.branches.getAll();
      setBranches(data);
    } catch (error) {
      toast.error('Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.branches.create(newBranch);
      toast.success('Branch created successfully!');
      setIsModalOpen(false);
      setNewBranch({ name: '', acronym: '', address: '', phone: '', currencySymbol: '₦' });
      loadBranches();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create branch');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-100">
               <Building2 className="w-6 h-6" />
            </div>
            Hospital Branches
          </h1>
          <p className="text-slate-400 font-bold mt-2 uppercase text-xs tracking-widest ml-1">
             Manage multi-location clinics and centralized inventory
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="soft-btn-primary px-8 py-4 flex items-center gap-3 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Add New Branch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {branches.map((branch) => (
          <div key={branch.id} className="soft-card group overflow-hidden border border-slate-100 transition-all hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start">
               <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">{branch.name}</h3>
                  <span className="text-[10px] font-black px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full uppercase tracking-tighter mt-1 inline-block">
                    {branch.acronym || 'MAIN'}
                  </span>
               </div>
               <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-400">
                  <ExternalLink className="w-4 h-4" />
               </div>
            </div>
            
            <div className="p-8 space-y-5">
               <div className="flex items-center gap-4 text-slate-500">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Address</p>
                    <p className="text-sm font-bold text-slate-600 truncate max-w-[200px]">{branch.address || 'No address set'}</p>
                  </div>
               </div>

               <div className="flex items-center gap-4 text-slate-500">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Phone</p>
                    <p className="text-sm font-bold text-slate-600">{branch.phone || 'N/A'}</p>
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                  <div className="text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Staff</p>
                     <p className="text-lg font-black text-slate-800">{branch._count?.users || 0}</p>
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Clients</p>
                     <p className="text-lg font-black text-slate-800">{branch._count?.clients || 0}</p>
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Pets</p>
                     <p className="text-lg font-black text-slate-800">{branch._count?.patients || 0}</p>
                  </div>
               </div>
            </div>

            <div className="px-8 pb-8">
               <button className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all active:scale-95">
                  Launch Branch Dashboard
               </button>
            </div>
          </div>
        ))}

        {branches.length === 0 && (
          <div className="col-span-full py-20 bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
             <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6 border border-slate-100">
                <Building2 className="w-10 h-10 text-slate-200" />
             </div>
             <h3 className="text-2xl font-black text-slate-400">No Branches Yet</h3>
             <p className="text-slate-300 font-bold mt-2">Scale your practice by adding a second location.</p>
          </div>
        )}
      </div>

      {/* New Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#F8FAFC] rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Expand Practice</h3>
                <p className="text-slate-400 font-bold mt-1 text-sm">Add a new hospital location to your network</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400">
                <X className="w-8 h-8" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch Name</label>
                  <input
                    type="text"
                    required
                    value={newBranch.name}
                    onChange={e => setNewBranch({ ...newBranch, name: e.target.value })}
                    className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                    placeholder="e.g. Westside Clinic"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Acronym</label>
                  <input
                    type="text"
                    required
                    value={newBranch.acronym}
                    onChange={e => setNewBranch({ ...newBranch, acronym: e.target.value.toUpperCase() })}
                    className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl font-black text-slate-700 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all uppercase"
                    placeholder="WST"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Physical Address</label>
                <input
                  type="text"
                  required
                  value={newBranch.address}
                  onChange={e => setNewBranch({ ...newBranch, address: e.target.value })}
                  className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl font-medium text-slate-700 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                  placeholder="Full location address"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <input
                    type="text"
                    value={newBranch.phone}
                    onChange={e => setNewBranch({ ...newBranch, phone: e.target.value })}
                    className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                    placeholder="+234..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={newBranch.currencySymbol}
                    onChange={e => setNewBranch({ ...newBranch, currencySymbol: e.target.value })}
                    className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl font-black text-slate-700 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                    placeholder="₦"
                  />
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4"
                >
                  {isSaving ? (
                    <>
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Initializing Branch...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-6 h-6 text-emerald-400" />
                      Create Branch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
