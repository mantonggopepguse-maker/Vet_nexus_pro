import React, { useState, useEffect } from 'react';
import { Patient, AppView } from '../../types';
import { Activity, HeartPulse, Clock, ChevronRight, CheckCircle2, AlertTriangle, Timer, Stethoscope, Plus, Save, Calculator } from 'lucide-react';
import { api } from '../../services/apiService';
import PageLoader from '../shared/PageLoader';

interface Surgery {
    id: string;
    patient: Patient;
    surgeon: { name: string };
    anesthetist?: { name: string };
    status: string;
    startTime: string;
    asaScore: number;
    monitoringEntries: any[];
}

interface SurgeryHubProps {
    onNavigate: (view: AppView) => void;
}

export const SurgeryHub: React.FC<SurgeryHubProps> = ({ onNavigate }) => {
    const [surgeries, setSurgeries] = useState<Surgery[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSurgery, setSelectedSurgery] = useState<Surgery | null>(null);
    const [showNewSurgeryModal, setShowNewSurgeryModal] = useState(false);

    // Monitoring Form State
    const [intervalForm, setIntervalForm] = useState({
        heartRate: '',
        spo2: '',
        respiration: '',
        bpSystolic: '',
        bpDiastolic: '',
        temp: '',
        etco2: '',
        fluids: '',
        notes: ''
    });

    useEffect(() => {
        fetchSurgeries();
        const interval = setInterval(fetchSurgeries, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchSurgeries = async () => {
        try {
            const data = await api.get('/surgeries');
            setSurgeries(data);
            if (selectedSurgery) {
                const updated = data.find((s: any) => s.id === selectedSurgery.id);
                if (updated) setSelectedSurgery(updated);
            }
        } catch (error) {
            console.error("Failed to fetch surgeries", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogInterval = async () => {
        if (!selectedSurgery) return;
        try {
            await api.post(`/surgeries/${selectedSurgery.id}/interval`, intervalForm);
            setIntervalForm({
                heartRate: '',
                spo2: '',
                respiration: '',
                bpSystolic: '',
                bpDiastolic: '',
                temp: '',
                etco2: '',
                fluids: '',
                notes: ''
            });
            fetchSurgeries();
        } catch (error) {
            alert("Failed to log interval");
        }
    };

    const handleCompleteSurgery = async () => {
        if (!selectedSurgery) return;
        if (!window.confirm("Are you sure you want to end this surgical session?")) return;
        try {
            await api.post(`/surgeries/${selectedSurgery.id}/complete`, {});
            setSelectedSurgery(null);
            fetchSurgeries();
        } catch (error) {
            alert("Failed to complete surgery");
        }
    };

    if (loading) return <PageLoader />;

    return (
        <div className="space-y-10 animate-fade-in pb-20 max-w-7xl mx-auto px-4 md:px-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="flex flex-col text-slate-800">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-rose-100">
                            <Activity className="w-6 h-6" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight">Surgery Hub</h1>
                    </div>
                    <p className="font-bold text-lg text-slate-400 uppercase tracking-widest text-[10px]">Anesthesia Monitoring & Operative Logs</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => onNavigate('CLINICAL_CALCULATORS')}
                        className="soft-btn px-6 py-4 bg-emerald-50 text-emerald-600 border-emerald-100 font-black flex items-center gap-2"
                    >
                        <Calculator className="w-5 h-5" /> Calculators
                    </button>
                    <button 
                        onClick={() => onNavigate('PATIENTS')}
                        className="soft-btn px-8 py-4 bg-rose-600 text-white border-rose-500 hover:bg-rose-700 font-black flex items-center gap-2 group"
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> New Surgery
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Active Surgery List */}
                <div className="lg:col-span-4 space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Active Theaters</h3>
                    {surgeries.filter(s => s.status === 'InProgress').length > 0 ? (
                        surgeries.filter(s => s.status === 'InProgress').map(surgery => (
                            <button
                                key={surgery.id}
                                onClick={() => setSelectedSurgery(surgery)}
                                className={`w-full text-left p-6 rounded-[2.5rem] transition-all duration-300 border-2 ${
                                    selectedSurgery?.id === surgery.id 
                                    ? 'bg-white border-rose-500 shadow-2xl shadow-rose-100 scale-[1.02]' 
                                    : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200'
                                } group relative overflow-hidden`}
                            >
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-black text-slate-800">{surgery.patient.name}</span>
                                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{surgery.patient.species}</span>
                                    </div>
                                    <div className="px-3 py-1 bg-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase flex items-center gap-1">
                                        <Timer className="w-3 h-3" /> Live
                                    </div>
                                </div>
                                <div className="space-y-1 relative z-10">
                                    <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                                        <Stethoscope size={14} className="text-slate-300" /> Dr. {surgery.surgeon.name}
                                    </p>
                                    <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                        <Clock size={14} className="text-slate-200" /> Start: {new Date(surgery.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                {selectedSurgery?.id === surgery.id && (
                                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-50 rounded-full opacity-50 blur-2xl"></div>
                                )}
                            </button>
                        ))
                    ) : (
                        <div className="p-12 text-center text-slate-300 border-2 border-dashed border-slate-200 rounded-[3rem]">
                            <Activity className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p className="font-bold flex flex-col text-sm uppercase tracking-tighter">No active procedures</p>
                        </div>
                    )}
                </div>

                {/* Surgery Monitoring Panel */}
                <div className="lg:col-span-8">
                    {selectedSurgery ? (
                        <div className="space-y-8 animate-fade-in-up">
                            {/* Stats Summary Bar */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="glass-card p-6 bg-rose-50/50 border-rose-100 flex flex-col">
                                    <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Heart Rate</span>
                                    <span className="text-2xl font-black text-rose-600">{selectedSurgery.monitoringEntries[0]?.heartRate || '--'} <small className="text-xs">bpm</small></span>
                                </div>
                                <div className="glass-card p-6 bg-blue-50/50 border-blue-100 flex flex-col">
                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">SpO2</span>
                                    <span className="text-2xl font-black text-blue-600">{selectedSurgery.monitoringEntries[0]?.spo2 || '--'} <small className="text-xs">%</small></span>
                                </div>
                                <div className="glass-card p-6 bg-amber-50/50 border-amber-100 flex flex-col">
                                    <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">MAP (BP)</span>
                                    <span className="text-2xl font-black text-amber-600">{selectedSurgery.monitoringEntries[0]?.bpSystolic || '--'}/{selectedSurgery.monitoringEntries[0]?.bpDiastolic || '--'}</span>
                                </div>
                                <div className="glass-card p-6 bg-emerald-50/50 border-emerald-100 flex flex-col">
                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Anesthesia Timer</span>
                                    <span className="text-2xl font-black text-emerald-600">
                                        {Math.floor((new Date().getTime() - new Date(selectedSurgery.startTime).getTime()) / 60000)}m
                                    </span>
                                </div>
                            </div>

                            {/* Interval Entry Form - Neomorphic */}
                            <div className="soft-card p-8">
                                <div className="flex justify-between items-center mb-10">
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                                        <Timer className="w-6 h-6 text-rose-500" />
                                        Log Monitoring Interval
                                    </h3>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Every 5 Minutes</span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">HR (bpm)</label>
                                        <input 
                                            type="number" 
                                            value={intervalForm.heartRate}
                                            onChange={(e) => setIntervalForm({...intervalForm, heartRate: e.target.value})}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-800 focus:border-rose-500 transition-all outline-none" 
                                            placeholder="--"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">SpO2 (%)</label>
                                        <input 
                                            type="number" 
                                            value={intervalForm.spo2}
                                            onChange={(e) => setIntervalForm({...intervalForm, spo2: e.target.value})}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-800 focus:border-rose-500 transition-all outline-none" 
                                            placeholder="--"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Resp (brpm)</label>
                                        <input 
                                            type="number" 
                                            value={intervalForm.respiration}
                                            onChange={(e) => setIntervalForm({...intervalForm, respiration: e.target.value})}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-800 focus:border-rose-500 transition-all outline-none" 
                                            placeholder="--"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">EtCO2</label>
                                        <input 
                                            type="number" 
                                            value={intervalForm.etco2}
                                            onChange={(e) => setIntervalForm({...intervalForm, etco2: e.target.value})}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-800 focus:border-rose-500 transition-all outline-none" 
                                            placeholder="--"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">BP Systolic</label>
                                            <input 
                                                type="number" 
                                                value={intervalForm.bpSystolic}
                                                onChange={(e) => setIntervalForm({...intervalForm, bpSystolic: e.target.value})}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-800 focus:border-rose-500 transition-all outline-none" 
                                                placeholder="--"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">BP Diastolic</label>
                                            <input 
                                                type="number" 
                                                value={intervalForm.bpDiastolic}
                                                onChange={(e) => setIntervalForm({...intervalForm, bpDiastolic: e.target.value})}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-800 focus:border-rose-500 transition-all outline-none" 
                                                placeholder="--"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Fluids / Notes</label>
                                        <input 
                                            type="text" 
                                            value={intervalForm.fluids}
                                            onChange={(e) => setIntervalForm({...intervalForm, fluids: e.target.value})}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-800 focus:border-rose-500 transition-all outline-none" 
                                            placeholder="e.g. Fluids 5ml/kg/hr"
                                        />
                                    </div>
                                </div>

                                <button 
                                    onClick={handleLogInterval}
                                    className="w-full py-5 bg-white border-2 border-rose-500 text-rose-600 rounded-[2rem] font-black uppercase tracking-widest text-sm hover:bg-rose-500 hover:text-white transition-all shadow-xl shadow-rose-100 flex items-center justify-center gap-3 group"
                                >
                                    <Save className="w-5 h-5 group-hover:scale-125 transition-transform" /> Save Monitoring Interval
                                </button>
                            </div>

                            {/* Surgery Actions */}
                            <div className="flex gap-4">
                                <button
                                    onClick={handleCompleteSurgery}
                                    className="flex-1 py-4 bg-slate-800 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-black transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 size={16} /> Finalize Session
                                </button>
                                <button 
                                    onClick={() => onNavigate('ICU_BOARD')}
                                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                >
                                    Cancel & Return
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[600px] flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-[4rem] border-2 border-dashed border-slate-200">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-slate-200 mb-8 shadow-inner">
                                <ChevronRight size={48} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-300 tracking-tight">Theater View Control</h3>
                            <p className="text-slate-400 font-bold max-w-xs mt-4">Select an active surgery from the left to begin real-time anesthesia monitoring.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
