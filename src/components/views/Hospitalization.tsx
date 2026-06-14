import React, { useState, useEffect } from 'react';
import { Activity, Plus, X, CheckCircle2, AlertCircle, Search, BedDouble, User, Calendar, DollarSign, RefreshCw } from 'lucide-react';
import { api } from '../../services/apiService';
import { Hospitalization as HospitalizationType, Kennel, ClinicSettings, User as UserType } from '../../types';
import { toast } from 'sonner';

interface HospitalizationProps {
  settings: ClinicSettings;
  currentUser: UserType | null;
}

export const Hospitalization: React.FC<HospitalizationProps> = ({ settings, currentUser }) => {
  const [kennels, setKennels] = useState<(Kennel & { hospitalizations?: HospitalizationType[] })[]>([]);
  const [activeHospitalizations, setActiveHospitalizations] = useState<HospitalizationType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'KENNELS' | 'ADMITTED'>('KENNELS');

  // New kennel modal
  const [showNewKennel, setShowNewKennel] = useState(false);
  const [newKennelName, setNewKennelName] = useState('');
  const [newKennelType, setNewKennelType] = useState('General Ward');
  const [newKennelSize, setNewKennelSize] = useState('');
  const [newKennelCharge, setNewKennelCharge] = useState(0);
  const [newKennelCategory, setNewKennelCategory] = useState('General');

  // Discharge confirmation
  const [dischargingId, setDischargingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [kennelsData, roundsData] = await Promise.all([
        api.hospitalization.getKennels(),
        api.hospitalization.getRounds().catch(() => [])
      ]);
      setKennels(kennelsData);
      setActiveHospitalizations(roundsData);
    } catch (error) {
      toast.error('Failed to load hospitalization data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateKennel = async () => {
    if (!newKennelName.trim()) return;
    try {
      await api.hospitalization.createKennel({
        name: newKennelName.trim(),
        type: newKennelType,
        size: newKennelSize || undefined,
        chargePerNight: newKennelCharge,
        category: newKennelCategory
      });
      toast.success('Kennel created');
      setShowNewKennel(false);
      setNewKennelName('');
      setNewKennelSize('');
      setNewKennelCharge(0);
      setNewKennelCategory('General');
      loadData();
    } catch (error) {
      toast.error('Failed to create kennel');
    }
  };

  const handleDischarge = async (id: string) => {
    setDischargingId(id);
    try {
      await api.hospitalization.discharge(id);
      toast.success('Patient discharged');
      loadData();
    } catch (error) {
      toast.error('Failed to discharge patient');
    } finally {
      setDischargingId(null);
    }
  };

  const filteredKennels = kennels.filter(k =>
    k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHospitalizations = activeHospitalizations.filter(h =>
    h.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.kennel?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableCount = kennels.filter(k => k.status === 'Available').length;

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
              <Activity className="w-5 h-5" />
            </div>
            Hospitalization / Admit to Ward
          </h1>
          <p className="text-sm text-slate-400 font-medium mt-1">Manage kennels and active admissions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewKennel(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" /> Add Kennel
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 rounded-xl text-xs font-black hover:bg-slate-50 transition-all shadow-lg border border-slate-200"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="soft-card p-4">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Kennels</span>
          <p className="text-2xl font-black text-slate-800 mt-1">{kennels.length}</p>
        </div>
        <div className="soft-card p-4">
          <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Available</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{availableCount}</p>
        </div>
        <div className="soft-card p-4">
          <span className="text-xs font-black text-rose-500 uppercase tracking-widest">Occupied</span>
          <p className="text-2xl font-black text-rose-600 mt-1">{kennels.length - availableCount}</p>
        </div>
        <div className="soft-card p-4">
          <span className="text-xs font-black text-blue-500 uppercase tracking-widest">Admitted</span>
          <p className="text-2xl font-black text-blue-600 mt-1">{activeHospitalizations.length}</p>
        </div>
      </div>

      {/* View Toggle + Search */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
          <button
            onClick={() => setView('KENNELS')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${view === 'KENNELS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <BedDouble className="w-3.5 h-3.5 inline mr-1.5" />Kennels
          </button>
          <button
            onClick={() => setView('ADMITTED')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${view === 'ADMITTED' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <User className="w-3.5 h-3.5 inline mr-1.5" />Admitted Patients
          </button>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full soft-input pl-10 pr-4 py-2.5 text-sm font-medium"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500"></div>
        </div>
      ) : view === 'KENNELS' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKennels.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <BedDouble className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">No kennels found</p>
            </div>
          ) : filteredKennels.map(kennel => {
            const activeHosp = kennel.hospitalizations?.[0];
            return (
              <div key={kennel.id} className={`soft-card p-5 border-l-4 ${kennel.status === 'Available' ? 'border-l-emerald-400' : 'border-l-rose-400'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-black text-slate-800">{kennel.name}</h3>
                    <span className="text-xs text-slate-400 font-medium">{kennel.type}</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${kennel.status === 'Available' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {kennel.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                  {kennel.category && (
                    <span className={`font-bold ${kennel.category === 'VIP' ? 'text-amber-600' : 'text-slate-500'}`}>
                      {kennel.category}
                    </span>
                  )}
                  {kennel.size && <span>{kennel.size}</span>}
                  {kennel.chargePerNight > 0 && (
                    <span className="font-bold">{settings.currencySymbol}{kennel.chargePerNight}/night</span>
                  )}
                </div>
                {activeHosp && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {activeHosp.patient?.name || 'Unknown'}
                    </div>
                    {activeHosp.reason && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <AlertCircle className="w-3 h-3" />
                        {activeHosp.reason}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {new Date(activeHosp.admissionDate).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHospitalizations.length === 0 ? (
            <div className="text-center py-16">
              <User className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">No active admissions</p>
            </div>
          ) : filteredHospitalizations.map(hosp => (
            <div key={hosp.id} className="soft-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 flex-shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-slate-800">{hosp.patient?.name || 'Unknown Patient'}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><BedDouble className="w-3 h-3" />{hosp.kennel?.name || 'N/A'}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(hosp.admissionDate).toLocaleDateString()}</span>
                    {hosp.estimatedCost > 0 && (
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{settings.currencySymbol}{hosp.estimatedCost}</span>
                    )}
                  </div>
                  {hosp.reason && <p className="text-xs text-slate-400 mt-1">{hosp.reason}</p>}
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm(`Discharge ${hosp.patient?.name || 'this patient'} from ${hosp.kennel?.name || 'ward'}?`)) {
                    handleDischarge(hosp.id);
                  }
                }}
                disabled={dischargingId === hosp.id}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black hover:bg-emerald-100 transition-all border border-emerald-200 disabled:opacity-50 whitespace-nowrap"
              >
                {dischargingId === hosp.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Discharge
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Kennel Modal */}
      {showNewKennel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-fade-in border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <BedDouble className="w-5 h-5 text-rose-500" />
                New Kennel
              </h2>
              <button onClick={() => setShowNewKennel(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Kennel Name</label>
                <input
                  type="text"
                  value={newKennelName}
                  onChange={(e) => setNewKennelName(e.target.value)}
                  className="w-full soft-input px-4 py-3 text-sm font-bold"
                  placeholder="e.g. Kennel A1"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Type</label>
                <select
                  value={newKennelType}
                  onChange={(e) => setNewKennelType(e.target.value)}
                  className="w-full soft-input px-4 py-3 text-sm font-bold"
                >
                  <option>General Ward</option>
                  <option>ICU</option>
                  <option>Isolation</option>
                  <option>Surgery Recovery</option>
                  <option>Maternity</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Category</label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold cursor-pointer border-2 transition-all ${newKennelCategory === 'General' ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <input type="radio" name="category" value="General" checked={newKennelCategory === 'General'} onChange={(e) => setNewKennelCategory(e.target.value)} className="sr-only" />
                    General
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold cursor-pointer border-2 transition-all ${newKennelCategory === 'VIP' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <input type="radio" name="category" value="VIP" checked={newKennelCategory === 'VIP'} onChange={(e) => setNewKennelCategory(e.target.value)} className="sr-only" />
                    VIP
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">Size (optional)</label>
                  <select
                    value={newKennelSize}
                    onChange={(e) => setNewKennelSize(e.target.value)}
                    className="w-full soft-input px-4 py-3 text-sm font-bold"
                  >
                    <option value="">Select size...</option>
                    <option value="Small">Small</option>
                    <option value="Medium">Medium</option>
                    <option value="Large">Large</option>
                    <option value="Extra Large">Extra Large</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">Charge per Night</label>
                  <input
                    type="number"
                    min="0"
                    value={newKennelCharge || ''}
                    onChange={(e) => setNewKennelCharge(parseFloat(e.target.value) || 0)}
                    className="w-full soft-input px-4 py-3 text-sm font-bold"
                    placeholder="0"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateKennel}
                disabled={!newKennelName.trim()}
                className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                Create Kennel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
