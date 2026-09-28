import React, { useState, useEffect } from 'react';
import { Patient, AppView } from '../../types';
import { 
    Activity, HeartPulse, Clock, ChevronRight, CheckCircle2, 
    AlertTriangle, Timer, Stethoscope, Plus, Save, Calculator, X 
} from 'lucide-react';
import { api } from '../../services/apiService';
import PageLoader from '../shared/PageLoader';
import { toast } from 'sonner';

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
    const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);

    // Dropdown data for new surgery modal
    const [patients, setPatients] = useState<Patient[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [procedures, setProcedures] = useState<any[]>([]);
    const [isSubmittingNewSurgery, setIsSubmittingNewSurgery] = useState(false);

    // New Surgery Form State
    const [newSurgeryForm, setNewSurgeryForm] = useState({
        patientId: '',
        surgeonId: '',
        anesthetistId: '',
        procedureId: '',
        preMeds: '',
        asaScore: 1
    });

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
        loadModalData();
        const interval = setInterval(fetchSurgeries, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchSurgeries = async () => {
        try {
            const data = await api.surgeries.getAll();
            setSurgeries(data as Surgery[]);
            if (selectedSurgery) {
                const updated = (data as Surgery[]).find(s => s.id === selectedSurgery.id);
                if (updated) setSelectedSurgery(updated);
            }
        } catch (error) {
            console.error("Failed to fetch surgeries", error);
        } finally {
            setLoading(false);
        }
    };

    const loadModalData = async () => {
        try {
            const [pts, staff, procs] = await Promise.all([
                api.patients.getAll().catch(() => []),
                api.staff.getAll().catch(() => []),
                api.procedures.getAll().catch(() => [])
            ]);
            setPatients(pts || []);
            setStaffList(staff || []);
            setProcedures(procs || []);
        } catch (err) {
            console.error("Failed to load options for new surgery", err);
        }
    };

    const handleCreateSurgery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSurgeryForm.patientId) {
            toast.error("Please select a patient for the surgery");
            return;
        }
        if (!newSurgeryForm.surgeonId) {
            toast.error("Please assign a primary surgeon");
            return;
        }

        setIsSubmittingNewSurgery(true);
        try {
            const created = await api.surgeries.create({
                patientId: newSurgeryForm.patientId,
                surgeonId: newSurgeryForm.surgeonId,
                anesthetistId: newSurgeryForm.anesthetistId || undefined,
                procedureId: newSurgeryForm.procedureId || undefined,
                preMeds: newSurgeryForm.preMeds || undefined,
                asaScore: Number(newSurgeryForm.asaScore) || 1
            });
            toast.success("Surgical theater session activated!");
            setShowNewSurgeryModal(false);
            setNewSurgeryForm({
                patientId: '',
                surgeonId: '',
                anesthetistId: '',
                procedureId: '',
                preMeds: '',
                asaScore: 1
            });
            await fetchSurgeries();
            if (created && (created as any).id) {
                setSelectedSurgery(created as unknown as Surgery);
            }
        } catch (error: any) {
            toast.error(error?.message || "Failed to create surgery session");
        } finally {
            setIsSubmittingNewSurgery(false);
        }
    };

    const handleLogInterval = async () => {
        if (!selectedSurgery) return;
        try {
            await api.surgeries.addInterval(selectedSurgery.id, intervalForm);
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
            toast.success("Monitoring interval logged successfully");
            fetchSurgeries();
        } catch (error) {
            toast.error("Failed to log monitoring interval");
        }
    };

    const handleCompleteSurgery = async () => {
        if (!selectedSurgery) return;
        try {
            await api.surgeries.complete(selectedSurgery.id);
            toast.success("Surgical procedure marked as completed");
            setConfirmCompleteId(null);
            setSelectedSurgery(null);
            fetchSurgeries();
        } catch (error) {
            toast.error("Failed to complete surgery");
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
                        onClick={() => setShowNewSurgeryModal(true)}
                        className="soft-btn px-8 py-4 bg-rose-600 text-white border-rose-500 hover:bg-rose-700 font-black flex items-center gap-2 group shadow-lg shadow-rose-200"
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
                                {confirmCompleteId === selectedSurgery.id ? (
                                    <div className="flex-1 p-4 bg-rose-50 border border-rose-200 rounded-[2rem] flex items-center justify-between gap-4">
                                        <span className="text-xs font-bold text-rose-700">Confirm procedure completion & discharge from theater?</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleCompleteSurgery}
                                                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black hover:bg-rose-700 transition shadow-sm"
                                            >
                                                Confirm Finalize
                                            </button>
                                            <button
                                                onClick={() => setConfirmCompleteId(null)}
                                                className="px-4 py-2 bg-white text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition border border-slate-200"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmCompleteId(selectedSurgery.id)}
                                        className="flex-1 py-4 bg-slate-800 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        <CheckCircle2 size={16} /> Finalize Session
                                    </button>
                                )}
                                <button 
                                    onClick={() => onNavigate('ICU_BOARD')}
                                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                >
                                    Transfer to ICU Board
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[600px] flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-[4rem] border-2 border-dashed border-slate-200">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-slate-200 mb-8 shadow-inner">
                                <ChevronRight size={48} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-300 tracking-tight">Theater View Control</h3>
                            <p className="text-slate-400 font-bold max-w-xs mt-4">Select an active surgery from the left to begin real-time anesthesia monitoring, or activate a new procedure.</p>
                            <button
                                onClick={() => setShowNewSurgeryModal(true)}
                                className="mt-6 px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-rose-700 transition shadow-lg shadow-rose-100"
                            >
                                Schedule Procedure
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* New Surgery Modal */}
            {showNewSurgeryModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up border border-slate-100">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-rose-50/40 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center">
                                    <HeartPulse className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">Activate Surgical Theater</h3>
                                    <p className="text-xs font-semibold text-slate-400">Initialize live intra-operative vitals tracking</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowNewSurgeryModal(false)}
                                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSurgery} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Patient */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Patient *</label>
                                    <select
                                        value={newSurgeryForm.patientId}
                                        onChange={(e) => setNewSurgeryForm({ ...newSurgeryForm, patientId: e.target.value })}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-800 focus:border-rose-500 transition-all outline-none"
                                        required
                                    >
                                        <option value="">-- Select Patient --</option>
                                        {patients.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.species} - {p.breed || 'Breed N/A'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Procedure */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Procedure</label>
                                    <select
                                        value={newSurgeryForm.procedureId}
                                        onChange={(e) => setNewSurgeryForm({ ...newSurgeryForm, procedureId: e.target.value })}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-800 focus:border-rose-500 transition-all outline-none"
                                    >
                                        <option value="">-- Select Procedure (Optional) --</option>
                                        {procedures.map(proc => (
                                            <option key={proc.id} value={proc.id}>
                                                {proc.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Primary Surgeon */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Primary Surgeon *</label>
                                    <select
                                        value={newSurgeryForm.surgeonId}
                                        onChange={(e) => setNewSurgeryForm({ ...newSurgeryForm, surgeonId: e.target.value })}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-800 focus:border-rose-500 transition-all outline-none"
                                        required
                                    >
                                        <option value="">-- Select Surgeon --</option>
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.id}>
                                                Dr. {s.name} ({s.role || (s.roles && s.roles[0]) || 'Clinician'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Anesthetist */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Anesthetist / Nurse</label>
                                    <select
                                        value={newSurgeryForm.anesthetistId}
                                        onChange={(e) => setNewSurgeryForm({ ...newSurgeryForm, anesthetistId: e.target.value })}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-800 focus:border-rose-500 transition-all outline-none"
                                    >
                                        <option value="">-- Select Anesthetist (Optional) --</option>
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.role || (s.roles && s.roles[0]) || 'Staff'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* ASA Physical Status Classification */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                                    ASA Risk Classification: Grade {newSurgeryForm.asaScore}
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[
                                        { grade: 1, label: 'I: Normal' },
                                        { grade: 2, label: 'II: Mild' },
                                        { grade: 3, label: 'III: Severe' },
                                        { grade: 4, label: 'IV: Threat' },
                                        { grade: 5, label: 'V: Moribund' },
                                    ].map(asa => (
                                        <button
                                            type="button"
                                            key={asa.grade}
                                            onClick={() => setNewSurgeryForm({ ...newSurgeryForm, asaScore: asa.grade })}
                                            className={`py-2 px-1 rounded-xl text-[11px] font-black uppercase transition border-2 ${
                                                newSurgeryForm.asaScore === asa.grade
                                                    ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-200'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {asa.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Pre-Meds / Anesthetic Protocol */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                                    Pre-medication & Induction Protocol
                                </label>
                                <textarea
                                    value={newSurgeryForm.preMeds}
                                    onChange={(e) => setNewSurgeryForm({ ...newSurgeryForm, preMeds: e.target.value })}
                                    rows={2}
                                    placeholder="e.g. Butorphanol 0.2mg/kg IM, Dexmedetomidine 5mcg/kg IM, Propofol 4mg/kg IV to effect"
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-medium text-sm text-slate-800 focus:border-rose-500 transition-all outline-none resize-none"
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowNewSurgeryModal(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingNewSurgery}
                                    className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-rose-700 transition shadow-lg shadow-rose-200 disabled:opacity-50"
                                >
                                    {isSubmittingNewSurgery ? 'Activating...' : 'Activate Theater'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
