import React, { useState, useEffect } from 'react';
import { Stethoscope, Plus, HeartPulse, Clock, FileText, CheckCircle2, MoreVertical, X, Calendar, Activity, Pill, Mic, FilePenLine, Package, UserRound } from 'lucide-react';
import { api } from '../../services/apiService';
import { Hospitalization, Kennel, FlowsheetEntry, ClinicSettings, User, InventoryItem, HospitalizationNote, HospitalizationPrescription } from '../../types';
import { toast } from 'sonner';

interface ICUBoardProps {
  settings: ClinicSettings;
  currentUser: User | null;
  onNavigate: (view: any) => void;
}

export const ICUBoard: React.FC<ICUBoardProps> = ({ settings, currentUser, onNavigate }) => {
  const [kennels, setKennels] = useState<Kennel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHospitalization, setSelectedHospitalization] = useState<Hospitalization | null>(null);
  const [viewMode, setViewMode] = useState<'KENNELS' | 'ROUNDS'>('KENNELS');
  const [rounds, setRounds] = useState<Hospitalization[]>([]);
  const [isHandoffModalOpen, setIsHandoffModalOpen] = useState(false);
  const [handoffData, setHandoffData] = useState<Partial<Hospitalization>>({});
  const [isSavingHandoff, setIsSavingHandoff] = useState(false);
  const [staff, setStaff] = useState<User[]>([]);

  // Chart State
  const [activeTab, setActiveTab] = useState<'FLOWSHEET'|'PRESCRIPTIONS'|'NOTES'>('FLOWSHEET');
  const [flowsheet, setFlowsheet] = useState<FlowsheetEntry[]>([]);
  const [notes, setNotes] = useState<HospitalizationNote[]>([]);
  const [prescriptions, setPrescriptions] = useState<HospitalizationPrescription[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Forms
  const [newEntry, setNewEntry] = useState({ temperature: '', heartRate: '', respiratoryRate: '', notes: '' });
  const [administeredMeds, setAdministeredMeds] = useState<{rxId: string, item?: any, qty: number}[]>([]);
  
  const [newNote, setNewNote] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  
  const [newRx, setNewRx] = useState({ drugName: '', dose: '', route: '', frequency: '', inventoryItemId: '' });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [kennelsData, roundsData, staffData] = await Promise.all([
        api.hospitalization.getKennels(),
        api.hospitalization.getRounds().catch(() => []),
        api.staff.getAll().catch(() => [])
      ]);
      setKennels(kennelsData);
      setRounds(roundsData);
      setStaff(staffData);
    } catch (error) {
      toast.error(error?.data?.details || error?.message || 'Failed to load ICU Board');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const openFlowsheet = async (hosp: Hospitalization) => {
    setSelectedHospitalization(hosp);
    setActiveTab('FLOWSHEET');
    try {
      const [entries, nts, rx, inv] = await Promise.all([
        api.hospitalization.getFlowsheet(hosp.id),
        api.hospitalization.getNotes(hosp.id),
        api.hospitalization.getPrescriptions(hosp.id),
        api.inventory.getAll()
      ]);
      setFlowsheet(entries);
      setNotes(nts);
      setPrescriptions(rx);
      setInventory(inv.filter((i: any) => i.category === 'Medicine' || i.category === 'Vaccine' || i.category === 'Consumables'));
      
      // Reset forms
      setAdministeredMeds([]);
      setNewEntry({ temperature: '', heartRate: '', respiratoryRate: '', notes: '' });
      setNewNote({ subjective: '', objective: '', assessment: '', plan: '' });
      setNewRx({ drugName: '', dose: '', route: '', frequency: '', inventoryItemId: '' });
    } catch (error) {
      toast.error(error?.data?.details || error?.message || 'Failed to load patient chart');
    }
  };

  const handleAddFlowsheetEntry = async () => {
    if (!selectedHospitalization) return;
    try {
      const deductItems = administeredMeds.filter(m => m.item).map(m => ({ id: m.item.id, quantity: m.qty || 1, name: m.item.name }));
      const medsGiven = administeredMeds.map(m => {
        const rx = prescriptions.find(p => p.id === m.rxId);
        return rx ? `${rx.drugName} ${rx.dose} x${m.qty || 1}` : 'Unknown';
      });

      const entryData = {
         ...newEntry,
         medicationsGiven: medsGiven,
         deductInventoryItems: deductItems
      };
      
      const res = await api.hospitalization.addFlowsheetEntry(selectedHospitalization.id, entryData);
      setFlowsheet([res, ...flowsheet]);
      setNewEntry({ temperature: '', heartRate: '', respiratoryRate: '', notes: '' });
      setAdministeredMeds([]);
      toast.success('Flowsheet entry added');
    } catch (error: any) {
      toast.error(error?.data?.details || error?.message || 'Failed to add entry');
    }
  };

  const handleAddNote = async () => {
    if (!selectedHospitalization) return;
    try {
      const res = await api.hospitalization.addNote(selectedHospitalization.id, newNote);
      setNotes([res, ...notes]);
      setNewNote({ subjective: '', objective: '', assessment: '', plan: '' });
      toast.success('SOAP note saved');
    } catch (error) {
      toast.error(error?.data?.details || error?.message || 'Failed to save note');
    }
  };

  const handleAddPrescription = async () => {
    if (!selectedHospitalization) return;
    if (!newRx.drugName || !newRx.dose || !newRx.frequency) {
        return toast.error("Drug name, dose, and frequency are required.");
    }
    try {
      const res = await api.hospitalization.addPrescription(selectedHospitalization.id, newRx);
      setPrescriptions([res, ...prescriptions]);
      setNewRx({ drugName: '', dose: '', route: '', frequency: '', inventoryItemId: '' });
      toast.success('Prescription added');
    } catch (error) {
      toast.error(error?.data?.details || error?.message || 'Failed to add prescription');
    }
  };

  const toggleRxStatus = async (rxId: string, currentStatus: string) => {
      if (!selectedHospitalization) return;
      const newStatus = currentStatus === 'Active' ? 'Discontinued' : 'Active';
      try {
          // Assuming an API endpoint exists, or we update status manually (we built an endpoint for this)
          await api.hospitalization.updatePrescription(selectedHospitalization.id, rxId, { status: newStatus });
          setPrescriptions(prescriptions.map(p => p.id === rxId ? { ...p, status: newStatus } : p));
          toast.success(`Prescription ${newStatus.toLowerCase()}`);
      } catch (error) {
          toast.error(error?.data?.details || error?.message || 'Failed to update prescription');
      }
  };

   const handleDischarge = async (id: string) => {
    if(!window.confirm("Are you sure you want to discharge this patient?")) return;
    try {
       const res = await api.hospitalization.discharge(id);
       toast.success("Patient Discharged", {
         description: "A draft invoice has been generated.",
         action: {
           label: "View Invoice",
           onClick: () => {
             // We can navigate to sales or a specific invoice view if it exists
             // For now, let's navigate to SALES view
             onNavigate('SALES');
           }
         }
       });
       setSelectedHospitalization(null);
       loadData();
    } catch (error) {
       toast.error(error?.data?.details || error?.message || 'Failed to discharge patient');
    }
  };

  const handleUpdateHandoff = async () => {
    if (!selectedHospitalization) return;
    setIsSavingHandoff(true);
    try {
      await api.hospitalization.update(selectedHospitalization.id, handoffData);
      toast.success("Handoff instructions updated");
      setIsHandoffModalOpen(false);
      loadData();
    } catch (error) {
      toast.error(error?.data?.details || error?.message || 'Failed to update handoff');
    } finally {
      setIsSavingHandoff(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Loading ICU Board...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#F0FFF4] shadow-2xl flex items-center justify-center text-rose-500 animate-pulse-subtle">
              <HeartPulse className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-5xl font-black text-slate-800 tracking-tighter uppercase leading-none">Clinical Core</h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-3">ICU Monitoring & Critical Care Protocol</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/40 backdrop-blur-xl p-2 rounded-2xl border border-white/60 shadow-xl flex gap-1">
          <button 
            onClick={() => setViewMode('KENNELS')}
            className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-500 ${viewMode === 'KENNELS' ? 'bg-white text-slate-900 shadow-xl border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Tactical Grid
          </button>
          <button 
            onClick={() => setViewMode('ROUNDS')}
            className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-500 ${viewMode === 'ROUNDS' ? 'bg-white text-slate-900 shadow-xl border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Rounds Ledger
          </button>
        </div>
      </div>

      {viewMode === 'ROUNDS' ? (
        <div className="glass-card p-0 border-white/60 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/40 border-b border-slate-100">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Patient Profile</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Medical Authority</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Clinical Status</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Instructions</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Phase</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Utility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rounds.map(hosp => (
                  <tr key={hosp.id} className="hover:bg-white/60 transition-all duration-500 group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-slate-800 font-black border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                          {hosp.patient?.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 uppercase text-[11px] tracking-widest">{hosp.patient?.name}</p>
                          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">{hosp.kennel?.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-white">
                          <UserRound className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{hosp.doctorInCharge?.name || "Pending Assignment"}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {hosp.criticalAlert ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 animate-pulse-subtle">
                          <Activity className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{hosp.criticalAlert}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic opacity-40">Stable Baseline</span>
                      )}
                    </td>
                    <td className="px-8 py-6 max-w-xs">
                      <p className="text-[11px] font-bold text-slate-500 line-clamp-2 uppercase tracking-tight leading-relaxed">{hosp.nursingInstructions || "No active protocols."}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[9px] font-black px-3 py-1 bg-white border border-slate-100 text-slate-500 rounded-full uppercase tracking-widest shadow-sm">{hosp.status}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 translate-x-4">
                        <button 
                          onClick={() => {
                            setSelectedHospitalization(hosp);
                            setHandoffData({
                              criticalAlert: hosp.criticalAlert,
                              nursingInstructions: hosp.nursingInstructions,
                              treatmentPlan: hosp.treatmentPlan,
                              doctorInChargeId: hosp.doctorInChargeId
                            });
                            setIsHandoffModalOpen(true);
                          }}
                          className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm hover:shadow-xl transition-all"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openFlowsheet(hosp)}
                          className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#14B8A6] shadow-sm hover:shadow-xl transition-all"
                        >
                          <FilePenLine className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {kennels.map((kennel) => {
          const activeHosp = kennel.hospitalizations?.[0];
          
          return (
            <div key={kennel.id} className={`glass-card p-0 transition-all duration-500 relative overflow-hidden group ${activeHosp ? 'border-l-4 border-l-rose-400 shadow-2xl shadow-rose-100/20' : 'border-dashed border-2 border-slate-200 bg-white/20 opacity-60'}`}>
              <div className="px-6 py-4 bg-white/40 border-b border-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-800 uppercase tracking-widest text-[11px]">{kennel.name}</span>
                  <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-slate-900 text-white uppercase tracking-widest">{kennel.type}</span>
                </div>
                {activeHosp ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></div>
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Active Pulse</span>
                  </div>
                ) : (
                  <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-widest">Available</span>
                )}
              </div>

              {activeHosp && activeHosp.patient ? (
                <div className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{activeHosp.patient.name}</h3>
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-3">{activeHosp.patient.species} • {activeHosp.patient.breed}</p>
                      <div className="mt-6 p-4 bg-white/60 border border-white rounded-[1.5rem] shadow-inner">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Clinical Protocol</span>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tight leading-relaxed line-clamp-2">
                          {activeHosp.reason || 'Symptomatic Monitoring'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <Clock className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span>{new Date(activeHosp.admissionDate).toLocaleDateString()}</span>
                    </div>
                    <button 
                      onClick={() => openFlowsheet(activeHosp)}
                      className="btn-luminous btn-luminous-neutral bg-white px-5 py-2.5 text-[9px] uppercase tracking-widest shadow-lg"
                    >
                      <FilePenLine className="w-3.5 h-3.5" />
                      Digital Chart
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-20 h-20 mx-auto bg-white/40 rounded-[2rem] border border-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Plus className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Cage Latency</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Handoff Modal */}
      {isHandoffModalOpen && selectedHospitalization && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 border border-white/60">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-white/40">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Shift Handoff</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-3">Intelligence Transfer for {selectedHospitalization.patient?.name}</p>
                </div>
                <button onClick={() => setIsHandoffModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white rounded-2xl transition-all text-slate-400 shadow-sm border border-slate-50">
                  <X className="w-6 h-6" />
                </button>
            </div>

            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Critical Vector</label>
                  <input 
                    type="text"
                    value={handoffData.criticalAlert || ''}
                    onChange={e => setHandoffData({...handoffData, criticalAlert: e.target.value})}
                    placeholder="e.g. SEIZURE WATCH"
                    className="w-full px-6 py-4 bg-rose-50/30 border border-rose-100 rounded-2xl text-sm font-black text-rose-600 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all placeholder:text-rose-200 uppercase tracking-tight"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Medical Lead</label>
                  <select 
                    value={handoffData.doctorInChargeId || ''}
                    onChange={e => setHandoffData({...handoffData, doctorInChargeId: e.target.value})}
                    className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all appearance-none shadow-inner"
                  >
                    <option value="">Assign Lead</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Nursing Protocols</label>
                <textarea 
                  value={handoffData.nursingInstructions || ''}
                  onChange={e => setHandoffData({...handoffData, nursingInstructions: e.target.value})}
                  placeholder="Hourly monitoring protocols..."
                  className="w-full px-6 py-4 bg-white border border-slate-100 rounded-[2rem] text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all min-h-[120px] shadow-inner uppercase tracking-tight"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Trajectory Review</label>
                <textarea 
                  value={handoffData.treatmentPlan || ''}
                  onChange={e => setHandoffData({...handoffData, treatmentPlan: e.target.value})}
                  placeholder="Long term goals and expected discharge criteria..."
                  className="w-full px-6 py-4 bg-white border border-slate-100 rounded-[2rem] text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all min-h-[120px] shadow-inner uppercase tracking-tight"
                />
              </div>
            </div>

            <div className="p-10 bg-white/40 border-t border-slate-100">
              <button 
                onClick={handleUpdateHandoff}
                disabled={isSavingHandoff}
                className="btn-luminous btn-luminous-emerald w-full py-5 text-[11px] shadow-2xl"
              >
                {isSavingHandoff ? 'Synchronizing Protocols...' : 'Commit Handoff Intelligence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Chart Panel */}
      {selectedHospitalization && selectedHospitalization.patient && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setSelectedHospitalization(null)} />
          <div className="relative w-full max-w-2xl bg-[#F8FAFC] h-full shadow-2xl flex flex-col animate-slide-in-right border-l border-white/40">
            
            {/* Header / HUD */}
            <div className="pt-10 px-10 pb-2 bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-10 shadow-sm flex flex-col">
               <div className="flex justify-between items-start mb-8">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-[2rem] bg-[#F0FFF4] border border-[#14B8A6]/20 flex items-center justify-center text-[#14B8A6] shadow-xl animate-pulse-subtle">
                         <HeartPulse className="w-8 h-8" />
                      </div>
                      <div>
                         <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none">{selectedHospitalization.patient.name}</h2>
                         <div className="flex gap-4 mt-4">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-100 px-3 py-1 rounded-lg">Vector ID: {selectedHospitalization.patient.id.substring(0,8)}</span>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{selectedHospitalization.kennel?.name || 'Critical Ward'}</span>
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleDischarge(selectedHospitalization.id)} 
                        className="px-6 py-3 bg-white border border-emerald-200 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg active:scale-95"
                      >
                         Release
                      </button>
                      <button onClick={() => setSelectedHospitalization(null)} className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-white rounded-2xl text-slate-400 transition-all border border-slate-100 shadow-sm">
                        <X className="w-6 h-6" />
                      </button>
                   </div>
               </div>
               
               {/* HUD Navigation */}
               <div className="flex gap-10 mt-2">
                   {[
                       { id: 'FLOWSHEET', label: 'Clinical Flow', color: 'emerald' },
                       { id: 'PRESCRIPTIONS', label: 'Pharmacology', color: 'peach' },
                       { id: 'NOTES', label: 'Assessment (SOAP)', color: 'amber' }
                   ].map(tab => (
                       <button 
                           key={tab.id}
                           className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 transition-all duration-500 ${activeTab === tab.id ? `border-emerald-500 text-slate-900` : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                           onClick={() => setActiveTab(tab.id as any)}
                       >
                           {tab.label}
                       </button>
                   ))}
               </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               
               {/* === FLOWSHEET TAB === */}
               {activeTab === 'FLOWSHEET' && (
                  <>
                    {/* Add Entry Module */}
                    <div className="glass-card p-8 border-white/60 bg-white/40 shadow-xl group">
                       <div className="flex items-center gap-4 mb-8">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center border border-emerald-100">
                             <Activity className="w-5 h-5" />
                          </div>
                          <div>
                             <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-[0.2em]">Clinical Telemetry Log</h3>
                             <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Real-time vital synchronization</p>
                          </div>
                       </div>

                       <div className="grid grid-cols-3 gap-4 mb-8">
                          <div className="space-y-2">
                             <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">Temp (°C)</label>
                             <input className="w-full bg-white border border-slate-100 px-4 py-3 rounded-xl text-xs font-black focus:ring-4 focus:ring-emerald-500/10 outline-none shadow-inner" placeholder="38.5" value={newEntry.temperature} onChange={(e) => setNewEntry({...newEntry, temperature: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">HR (bpm)</label>
                             <input className="w-full bg-white border border-slate-100 px-4 py-3 rounded-xl text-xs font-black focus:ring-4 focus:ring-emerald-500/10 outline-none shadow-inner" placeholder="120" value={newEntry.heartRate} onChange={(e) => setNewEntry({...newEntry, heartRate: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">RR (rpm)</label>
                             <input className="w-full bg-white border border-slate-100 px-4 py-3 rounded-xl text-xs font-black focus:ring-4 focus:ring-emerald-500/10 outline-none shadow-inner" placeholder="24" value={newEntry.respiratoryRate} onChange={(e) => setNewEntry({...newEntry, respiratoryRate: e.target.value})} />
                          </div>
                       </div>
                       
                       <div className="mb-8 space-y-4">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                             <Pill className="w-3 h-3 text-peach-500" /> Active Pharmacology Administration
                          </label>
                          {prescriptions.filter(p => p.status === 'Active').length === 0 ? (
                              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-[10px] font-black text-slate-400 uppercase text-center">
                                 No Active Orders Found
                              </div>
                          ) : (
                              <div className="space-y-3">
                                {prescriptions.filter(p => p.status === 'Active').map(rx => {
                                   let invItem = null;
                                   if (rx.inventoryItemId) invItem = inventory.find(i => i.id === rx.inventoryItemId);
                                   
                                   const isSelected = administeredMeds.some(m => m.rxId === rx.id);
                                   return (
                                     <label key={rx.id} className={`flex items-center gap-4 p-5 rounded-[1.5rem] border transition-all duration-500 cursor-pointer select-none group ${isSelected ? 'bg-peach-900 text-white border-peach-900 shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-peach-200'}`}>
                                       <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${isSelected ? 'bg-white border-white text-peach-900' : 'bg-slate-50 border-slate-200 text-transparent'}`}>
                                          <CheckCircle2 className="w-4 h-4" />
                                       </div>
                                       <input 
                                         type="checkbox" 
                                         className="sr-only"
                                         checked={isSelected}
                                         onChange={(e) => {
                                            if (e.target.checked) setAdministeredMeds([...administeredMeds, {rxId: rx.id, item: invItem, qty: 1}]);
                                            else setAdministeredMeds(administeredMeds.filter(m => m.rxId !== rx.id));
                                         }}
                                       />
                                       <div className="flex-1">
                                         <div className="flex items-center gap-2">
                                            <span className={`text-[11px] font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>{rx.drugName}</span>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-peach-50 text-peach-600'}`}>{rx.dose}</span>
                                         </div>
                                         <div className={`text-[9px] font-black uppercase tracking-widest mt-1 opacity-60 ${isSelected ? 'text-peach-100' : 'text-slate-400'}`}>{rx.route} • {rx.frequency}</div>
                                       </div>
                                       {isSelected && invItem && (
                                         <div className="flex items-center gap-2 animate-fade-in">
                                           <span className="text-[8px] font-black text-white/60 uppercase">Unit Qty</span>
                                           <input 
                                             type="number"
                                             min="1"
                                             className="w-16 px-3 py-1.5 text-[10px] font-black text-center bg-white/10 border border-white/20 rounded-xl text-white outline-none"
                                             value={administeredMeds.find(m => m.rxId === rx.id)?.qty || 1}
                                             onClick={(e) => e.stopPropagation()}
                                             onChange={(e) => {
                                               const newQty = Math.max(1, parseInt(e.target.value) || 1);
                                               setAdministeredMeds(administeredMeds.map(m => m.rxId === rx.id ? {...m, qty: newQty} : m));
                                             }}
                                           />
                                         </div>
                                       )}
                                       {invItem && !isSelected && (
                                         <div className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                                           <Package className="w-3 h-3" /> Auto-Depletion
                                         </div>
                                       )}
                                     </label>
                                   );
                                })}
                              </div>
                          )}
                       </div>

                       <div className="space-y-3 mb-8">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">Observations & Progression</label>
                          <textarea className="w-full bg-white border border-slate-100 px-6 py-4 rounded-[2rem] text-xs font-medium focus:ring-4 focus:ring-emerald-500/10 outline-none shadow-inner min-h-[100px] uppercase tracking-tight" placeholder="Document clinical trajectory..." rows={2} value={newEntry.notes} onChange={(e) => setNewEntry({...newEntry, notes: e.target.value})} />
                       </div>
                       
                       <button 
                          onClick={handleAddFlowsheetEntry} 
                          className="btn-luminous btn-luminous-emerald w-full py-5 text-[11px] shadow-2xl"
                       >
                          Commit Entry to Matrix
                       </button>
                    </div>

                    {/* Clinical Timeline */}
                    <div className="space-y-6">
                       <div className="flex items-center gap-4 ml-4">
                          <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-[0.2em]">Clinical Chronology</h3>
                          <div className="h-[2px] flex-1 bg-slate-100"></div>
                       </div>
                       
                       {flowsheet.length === 0 ? (
                          <div className="text-center py-16 glass-card bg-white/20 border-white/60 border-dashed">
                             <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Chronological Matrix Empty</p>
                          </div>
                       ) : (
                          <div className="space-y-8">
                             {flowsheet.map(entry => (
                                <div key={entry.id} className="relative pl-10 before:content-[''] before:absolute before:left-[18px] before:top-4 before:w-[4px] before:h-full before:bg-slate-100 last:before:hidden group">
                                   <div className="absolute left-0 top-1 w-10 h-10 rounded-2xl bg-white border border-slate-100 shadow-xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform z-10">
                                      <Clock className="w-5 h-5" />
                                   </div>
                                   <div className="glass-card p-6 bg-white shadow-2xl border-white group-hover:border-emerald-200 transition-all duration-500">
                                      <div className="flex justify-between items-center mb-6">
                                         <div className="space-y-1">
                                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tighter">
                                               {new Date(entry.time).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                            </span>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Temporal Signature</p>
                                         </div>
                                         <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                                            {entry.staff?.name || 'Authorized Staff'}
                                         </span>
                                      </div>
                                      
                                      {(entry.temperature || entry.heartRate || entry.respiratoryRate) && (
                                         <div className="grid grid-cols-3 gap-3 mb-6">
                                            {entry.temperature && (
                                               <div className="bg-orange-50 border border-orange-100 p-3 rounded-2xl text-center">
                                                  <p className="text-[8px] font-black text-orange-400 uppercase tracking-widest mb-1">Temp</p>
                                                  <span className="text-xs font-black text-orange-600">{entry.temperature}°C</span>
                                               </div>
                                            )}
                                            {entry.heartRate && (
                                               <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl text-center">
                                                  <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">HR</p>
                                                  <span className="text-xs font-black text-rose-600">{entry.heartRate} bpm</span>
                                               </div>
                                            )}
                                            {entry.respiratoryRate && (
                                               <div className="bg-cyan-50 border border-cyan-100 p-3 rounded-2xl text-center">
                                                  <p className="text-[8px] font-black text-cyan-400 uppercase tracking-widest mb-1">RR</p>
                                                  <span className="text-xs font-black text-cyan-600">{entry.respiratoryRate} rpm</span>
                                               </div>
                                            )}
                                         </div>
                                      )}

                                      {Array.isArray(entry.medicationsGiven) && entry.medicationsGiven.length > 0 && (
                                         <div className="mb-6 p-5 bg-peach-900 text-white rounded-[2rem] shadow-2xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                                            <h4 className="text-[8px] font-black uppercase tracking-[0.3em] text-peach-200 mb-4 flex items-center gap-2">
                                               <Pill className="w-3 h-3" /> Pharmacology Protocol Execution
                                            </h4>
                                            <div className="space-y-3">
                                               {entry.medicationsGiven.map((med: string, i: number) => (
                                                  <div key={i} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-tight bg-white/10 p-3 rounded-xl border border-white/10">
                                                     <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {med}
                                                  </div>
                                               ))}
                                            </div>
                                         </div>
                                      )}

                                      {entry.notes && (
                                         <div className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] shadow-inner">
                                            <p className="text-[11px] font-bold text-slate-600 leading-relaxed uppercase tracking-tight text-justify">
                                               {entry.notes}
                                            </p>
                                         </div>
                                      )}
                                   </div>
                                </div>
                             ))}
                          </div>
                       )}
                    </div>
                  </>
               )}

               {/* === PRESCRIPTIONS TAB === */}
               {activeTab === 'PRESCRIPTIONS' && (
                   <div className="space-y-10 animate-fade-in">
                      <div className="glass-card p-8 border-white/60 bg-white/40 shadow-xl">
                         <div className="flex items-center gap-4 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-peach-50 text-peach-500 flex items-center justify-center border border-peach-100">
                               <Pill className="w-5 h-5" />
                            </div>
                            <div>
                               <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-[0.2em]">Pharmacology Provisioning</h3>
                               <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Initiate therapeutic protocols</p>
                            </div>
                         </div>

                         <div className="grid grid-cols-2 gap-6 mb-8">
                            <div className="space-y-2">
                               <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">Pharmaceutical Agent <span className="text-rose-500">*</span></label>
                               <input className="w-full bg-white border border-slate-100 px-5 py-4 rounded-2xl text-xs font-black focus:ring-4 focus:ring-peach-500/10 outline-none shadow-inner" placeholder="e.g. AMOXICILLIN" value={newRx.drugName} onChange={(e) => setNewRx({...newRx, drugName: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">Precision Dosage <span className="text-rose-500">*</span></label>
                               <input className="w-full bg-white border border-slate-100 px-5 py-4 rounded-2xl text-xs font-black focus:ring-4 focus:ring-peach-500/10 outline-none shadow-inner" placeholder="e.g. 50MG" value={newRx.dose} onChange={(e) => setNewRx({...newRx, dose: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">Administration Route</label>
                               <select className="w-full bg-white border border-slate-100 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-peach-500/10 outline-none appearance-none shadow-inner" value={newRx.route} onChange={(e) => setNewRx({...newRx, route: e.target.value})}>
                                   <option value="">SELECT ROUTE</option>
                                   <option value="PO (ORAL)">PO (ORAL)</option>
                                   <option value="IV (INTRAVENOUS)">IV (INTRAVENOUS)</option>
                                   <option value="IM (INTRAMUSCULAR)">IM (INTRAMUSCULAR)</option>
                                   <option value="SC (SUBCUTANEOUS)">SC (SUBCUTANEOUS)</option>
                                   <option value="TOPICAL">TOPICAL</option>
                               </select>
                            </div>
                            <div className="space-y-2">
                               <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-2">Temporal Frequency <span className="text-rose-500">*</span></label>
                               <select className="w-full bg-white border border-slate-100 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-peach-500/10 outline-none appearance-none shadow-inner" value={newRx.frequency} onChange={(e) => setNewRx({...newRx, frequency: e.target.value})}>
                                   <option value="">SELECT FREQUENCY</option>
                                   <option value="SID (ONCE DAILY)">SID (ONCE DAILY)</option>
                                   <option value="BID (TWICE DAILY)">BID (TWICE DAILY)</option>
                                   <option value="TID (THREE TIMES DAILY)">TID (THREE TIMES DAILY)</option>
                                   <option value="QID (FOUR TIMES DAILY)">QID (FOUR TIMES DAILY)</option>
                                   <option value="PRN (AS NEEDED)">PRN (AS NEEDED)</option>
                               </select>
                            </div>
                         </div>

                         <div className="mb-8 p-6 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
                            <label className="block text-[8px] font-black text-[#14B8A6] uppercase tracking-[0.3em] mb-4">Neural Inventory Synchronization</label>
                            <div className="relative">
                               <select className="w-full bg-white/5 border border-white/10 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-[#14B8A6]/20 outline-none appearance-none text-white" value={newRx.inventoryItemId} onChange={(e) => setNewRx({...newRx, inventoryItemId: e.target.value})}>
                                   <option value="" className="bg-slate-900">NO INVENTORY LINKAGE</option>
                                   {inventory.map((item: any) => (
                                       <option key={item.id} value={item.id} className="bg-slate-900">{item.name} ({item.quantity} REMAINING)</option>
                                   ))}
                               </select>
                               <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                                  <Package className="w-4 h-4 text-[#14B8A6]" />
                               </div>
                            </div>
                            <p className="text-[8px] font-black text-slate-500 mt-4 uppercase tracking-widest leading-relaxed">System will autonomously deplete stock upon flowsheet administration confirmation.</p>
                         </div>

                         <button onClick={handleAddPrescription} className="btn-luminous btn-luminous-emerald w-full py-5 text-[11px] shadow-2xl">
                            Authorize Protocol
                         </button>
                      </div>

                      <div className="space-y-6">
                         <div className="flex items-center gap-4 ml-4">
                            <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-[0.2em]">Pharmacology History</h3>
                            <div className="h-[2px] flex-1 bg-slate-100"></div>
                         </div>

                         {prescriptions.length === 0 ? (
                              <div className="text-center py-16 glass-card bg-white/20 border-white/60 border-dashed">
                                <Pill className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Active Orders Recorded</p>
                              </div>
                         ) : (
                              <div className="space-y-4">
                                 {prescriptions.map(rx => (
                                     <div key={rx.id} className="glass-card p-6 flex justify-between items-center group bg-white border-white hover:border-peach-200 transition-all duration-500 shadow-xl">
                                         <div className="flex items-center gap-6">
                                             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors shadow-inner ${rx.status === 'Active' ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
                                                 <Pill className="w-6 h-6" />
                                             </div>
                                             <div>
                                                 <div className="flex items-center gap-3 mb-2">
                                                     <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-widest ${rx.status === 'Active' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                                                         {rx.status}
                                                     </span>
                                                     {rx.inventoryItemId && <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-2"><Package className="w-3 h-3"/> SYNCED</span>}
                                                 </div>
                                                 <h4 className="font-black text-slate-800 text-xl tracking-tighter uppercase flex gap-3">
                                                     {rx.drugName} <span className="text-peach-600">{rx.dose}</span>
                                                 </h4>
                                                 <div className="flex items-center gap-4 mt-2">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{rx.route} • {rx.frequency}</p>
                                                    <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auth: {rx.vet?.name || 'Authorized Clinician'}</p>
                                                 </div>
                                             </div>
                                         </div>
                                         <button 
                                             onClick={() => toggleRxStatus(rx.id, rx.status)}
                                             className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${rx.status === 'Active' ? 'bg-white border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-white border border-emerald-100 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
                                         >
                                             {rx.status === 'Active' ? 'Suspend' : 'Resume'}
                                         </button>
                                     </div>
                                 ))}
                              </div>
                         )}
                      </div>
                   </div>
               )}

               {activeTab === 'NOTES' && (
                   <div className="space-y-10 animate-fade-in">
                      <div className="glass-card p-10 border-white/60 bg-white/40 shadow-xl">
                         <div className="flex items-center gap-4 mb-10">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100 shadow-lg">
                               <FileText className="w-6 h-6" />
                            </div>
                            <div>
                               <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-[0.2em]">Clinical Assessment Dossier</h3>
                               <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">SOAP Methodology Protocol</p>
                            </div>
                         </div>

                         <div className="space-y-10">
                            {[
                               { id: 'subjective', label: 'Subjective Assessment', placeholder: 'Patient history, behavior, appetite metrics...' },
                               { id: 'objective', label: 'Objective Analysis', placeholder: 'Exam findings, laboratory diagnostics, clinical indicators...' },
                               { id: 'assessment', label: 'Clinical Assessment', placeholder: 'Differential diagnostics, trajectory status...' },
                               { id: 'plan', label: 'Action Protocol', placeholder: 'Future treatments, client directives, procedures...' }
                            ].map(field => (
                               <div key={field.id} className="space-y-3">
                                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-4">{field.label}</label>
                                  <textarea 
                                     className="w-full bg-white border border-slate-100 px-8 py-6 rounded-[2.5rem] font-bold text-xs focus:ring-4 focus:ring-amber-500/10 outline-none shadow-inner min-h-[120px] uppercase tracking-tight leading-relaxed transition-all" 
                                     placeholder={field.placeholder} 
                                     value={(newNote as any)[field.id]} 
                                     onChange={(e) => setNewNote({...newNote, [field.id]: e.target.value})} 
                                  />
                               </div>
                            ))}
                         </div>
                         <div className="mt-12">
                            <button onClick={handleAddNote} className="btn-luminous btn-luminous-emerald w-full py-6 text-[12px] shadow-2xl">
                               Finalize Assessment
                            </button>
                         </div>
                      </div>

                      <div className="space-y-8">
                         <div className="flex items-center gap-4 ml-4">
                            <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-[0.2em]">Historical Assessments</h3>
                            <div className="h-[2px] flex-1 bg-slate-100"></div>
                         </div>

                         {notes.length === 0 ? (
                              <div className="text-center py-20 glass-card bg-white/20 border-white/60 border-dashed">
                                 <FileText className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Historical Dossiers Found</p>
                              </div>
                         ) : (
                              <div className="space-y-6">
                                 {notes.map(note => (
                                     <div key={note.id} className="glass-card p-10 bg-white border-white hover:border-amber-200 transition-all duration-500 shadow-2xl relative group">
                                         <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-50">
                                             <div className="flex items-center gap-4">
                                                 <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100 group-hover:scale-110 transition-transform">
                                                     <Calendar className="w-6 h-6" />
                                                 </div>
                                                 <div>
                                                     <h4 className="font-black text-slate-800 text-[11px] uppercase tracking-[0.2em]">
                                                         {new Date(note.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                     </h4>
                                                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Dossier Timestamp</p>
                                                 </div>
                                             </div>
                                             <div className="text-right">
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-slate-100 text-slate-600 px-4 py-2 rounded-xl border border-slate-200">
                                                   Auth: {note.vet?.name || 'Clinician'}
                                                </span>
                                             </div>
                                         </div>
                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                             {[
                                                { label: 'Subjective', content: note.subjective, color: 'emerald' },
                                                { label: 'Objective', content: note.objective, color: 'blue' },
                                                { label: 'Assessment', content: note.assessment, color: 'amber' },
                                                { label: 'Plan', content: note.plan, color: 'rose' }
                                             ].map(section => section.content && (
                                                <div key={section.label} className="space-y-3">
                                                   <h5 className="text-[8px] uppercase font-black tracking-[0.3em] text-slate-400 pl-2 flex items-center gap-2">
                                                      <div className={`w-1.5 h-1.5 rounded-full bg-${section.color}-400`}></div>
                                                      {section.label}
                                                   </h5>
                                                   <div className="p-6 bg-slate-50/50 rounded-[1.5rem] border border-slate-100">
                                                      <p className="text-[11px] font-bold text-slate-700 leading-relaxed uppercase tracking-tight">{section.content}</p>
                                                   </div>
                                                </div>
                                             ))}
                                         </div>
                                     </div>
                                 ))}
                              </div>
                         )}
                      </div>
                   </div>
                )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

