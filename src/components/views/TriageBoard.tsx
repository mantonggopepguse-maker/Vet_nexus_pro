import React, { useState, useEffect } from 'react';
import { 
    AlertCircle, 
    Clock, 
    Stethoscope, 
    PlusCircle, 
    ArrowRight, 
    CheckCircle2, 
    Skull,
    User,
    Activity,
    Thermometer,
    Zap,
    HeartPulse,
    ShieldAlert,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';

type TriageStatus = 'CRITICAL' | 'URGENT' | 'STABLE' | 'NONE' | 'FATAL';

interface TriagePatient {
    id: string;
    name: string;
    species: string;
    triageStatus: TriageStatus;
    triageStartTime: string;
    owner?: {
        firstName: string;
        lastName: string;
    };
}

export const TriageBoard: React.FC = () => {
    const [patients, setPatients] = useState<TriagePatient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmitting, setIsAdmitting] = useState(false);

    const fetchQueue = async () => {
        try {
            const data = await api.triage.getActive();
            setPatients(data);
        } catch (error) {
            console.error('Failed to fetch triage queue');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(fetchQueue, 30000); // 30s auto-refresh
        return () => clearInterval(interval);
    }, []);

    const handleQuickAdmit = async (status: TriageStatus) => {
        setIsAdmitting(true);
        try {
            await api.triage.quickAdmit(status);
            toast.success('Emergency Quick Admit Successful');
            fetchQueue();
        } catch (error) {
            toast.error('Failed to quick admit');
        } finally {
            setIsAdmitting(false);
        }
    };

    const handleUpdateStatus = async (patientId: string, status: TriageStatus) => {
        try {
            await api.triage.updateStatus(patientId, status);
            toast.success(`Patient prioritized as ${status}`);
            fetchQueue();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const getWaitTime = (startTime: string) => {
        if (!startTime) return '0m';
        const start = new Date(startTime).getTime();
        const now = new Date().getTime();
        const minutes = Math.floor((now - start) / 60000);
        
        if (minutes > 60) {
            const hours = Math.floor(minutes / 60);
            return `${hours}h ${minutes % 60}m`;
        }
        return `${minutes}m`;
    };

    const StatusColumn = ({ 
        status, 
        label, 
        prismClass,
        icon: Icon,
        accentColor
    }: { 
        status: TriageStatus, 
        label: string, 
        prismClass: string,
        icon: any,
        accentColor: string
    }) => {
        const filtered = patients.filter(p => p.triageStatus === status);
        
        return (
            <div className="flex-1 min-w-[350px] flex flex-col h-[calc(100vh-280px)]">
                <div className={`glass-card ${prismClass} mb-6 p-6 rounded-[2rem] relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full -mr-12 -mt-12 blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center border border-white/50 text-slate-800`}>
                                <Icon size={22} className={accentColor} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 tracking-tighter uppercase text-sm leading-tight">{label}</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{filtered.length} Active Protocols</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar pb-10">
                    {filtered.map(patient => (
                        <div key={patient.id} className="glass-card bg-white/60 p-6 rounded-[2rem] border-white hover:bg-white transition-all duration-500 shadow-sm group relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${status === 'CRITICAL' ? 'bg-rose-500' : status === 'URGENT' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                            
                            <div className="flex justify-between items-start mb-5">
                                <div>
                                    <h4 className="font-black text-lg text-slate-900 tracking-tight leading-tight uppercase">{patient.name}</h4>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">{patient.species}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-1">OWNER: {patient.owner?.lastName || 'Intake'}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-slate-500 font-black text-[10px] shadow-sm">
                                        <Clock size={12} className={accentColor} />
                                        {getWaitTime(patient.triageStartTime)}
                                    </div>
                                    {status === 'CRITICAL' && (
                                        <span className="text-[8px] font-black text-rose-500 uppercase tracking-[0.2em] animate-pulse">Critical Pulse Active</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-5 border-t border-slate-50 relative z-10">
                                <button
                                    onClick={() => handleUpdateStatus(patient.id, 'NONE')}
                                    className="flex-1 bg-white border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-emerald-500 hover:border-emerald-100 transition-all flex items-center justify-center gap-2 py-3 rounded-2xl shadow-sm"
                                >
                                    <CheckCircle2 size={14} />
                                    Resolved
                                </button>
                                
                                {status !== 'CRITICAL' && (
                                    <button
                                        onClick={() => handleUpdateStatus(patient.id, 'CRITICAL')}
                                        className="p-3 bg-white border border-slate-100 rounded-2xl text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all shadow-sm group-hover:scale-110"
                                        title="Escalate to Critical"
                                    >
                                        <Zap size={16} />
                                    </button>
                                )}
                                
                                <button className="p-3 bg-white border border-slate-100 rounded-2xl text-amber-500 hover:bg-amber-50 hover:border-amber-100 transition-all shadow-sm group-hover:scale-110">
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-center bg-white/20 border-2 border-dashed border-white/60 rounded-[3rem]">
                            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mb-6 text-slate-200 shadow-xl border border-slate-50">
                                <Icon size={28} />
                            </div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Temporal Zone Clear</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-rose-500" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Initializing Emergency Vector...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-fade-in relative pb-10">
            {/* Command Header - Medical Mint Aura */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between bg-white p-10 rounded-[3.5rem] border border-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#F0FFF4] rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>
                <div className="relative z-10">
                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter flex items-center gap-6 uppercase">
                        <div className="w-16 h-16 bg-rose-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-rose-200 animate-pulse">
                            <Activity className="w-8 h-8" />
                        </div>
                        Emergency Matrix
                    </h1>
                    <p className="text-slate-400 font-black mt-4 uppercase text-[10px] tracking-[0.4em] ml-2 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                        Live Bio-Protocol Synchronization
                    </p>
                </div>
                
                <div className="flex items-center gap-4 mt-8 lg:mt-0 relative z-10">
                    <button 
                        disabled={isAdmitting}
                        onClick={() => handleQuickAdmit('URGENT')}
                        className="btn-luminous btn-luminous-accent px-8 py-5 text-[10px] uppercase tracking-[0.2em] shadow-xl border-slate-100"
                    >
                        <PlusCircle size={20} className="text-amber-500" />
                        Provision Protocol
                    </button>
                    <button 
                        disabled={isAdmitting}
                        onClick={() => handleQuickAdmit('CRITICAL')}
                        className="btn-luminous btn-luminous-primary px-10 py-5 text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-rose-200"
                    >
                        <Zap size={20} />
                        CODE RED [STAT]
                    </button>
                </div>
            </div>

            {/* Zone Map */}
            <div className="flex gap-10 overflow-x-auto pb-10 custom-scrollbar px-2">
                <StatusColumn 
                    status="CRITICAL" 
                    label="Zone Red / Resuscitation" 
                    prismClass="bg-rose-50/50 border-rose-100/50" 
                    icon={Skull} 
                    accentColor="text-rose-500"
                />
                <StatusColumn 
                    status="URGENT" 
                    label="Zone Amber / Emergent" 
                    prismClass="bg-amber-50/50 border-amber-100/50" 
                    icon={AlertCircle} 
                    accentColor="text-amber-500"
                />
                <StatusColumn 
                    status="STABLE" 
                    label="Zone Green / Observation" 
                    prismClass="bg-emerald-50/50 border-emerald-100/50" 
                    icon={Stethoscope} 
                    accentColor="text-emerald-500"
                />
            </div>

            {/* Telemetry Dashboard Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="glass-card bg-slate-900 p-8 rounded-[2.5rem] border-0 flex items-center justify-between group overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative z-10">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Matrix Saturation</p>
                        <p className="text-4xl font-black text-white tracking-tighter">{patients.length}</p>
                    </div>
                    <Activity className="text-slate-700 w-12 h-12 relative z-10 group-hover:scale-125 transition-transform" />
                </div>
                <div className="glass-card bg-white p-8 rounded-[2.5rem] border-white flex items-center justify-between group">
                    <div className="relative z-10">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Critical Vector</p>
                        <div className="flex items-end gap-2">
                            <p className="text-4xl font-black text-rose-500 tracking-tighter">
                                {patients.length > 0 ? Math.round((patients.filter(p => p.triageStatus === 'CRITICAL').length / patients.length) * 100) : 0}%
                            </p>
                            <span className="text-[10px] font-black text-slate-300 uppercase mb-1 tracking-widest">Protocol Shift</span>
                        </div>
                    </div>
                    <HeartPulse className="text-rose-100 w-12 h-12 group-hover:text-rose-200 transition-colors" />
                </div>
                <div className="lg:col-span-2 glass-card bg-emerald-50/30 border-emerald-100/50 p-8 rounded-[2.5rem] flex items-center justify-between group">
                     <div className="w-full">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-[9px] font-black text-emerald-600/60 uppercase tracking-[0.3em]">Observation Latency</p>
                            <span className="text-xs font-black text-emerald-700">65% Target Alignment</span>
                        </div>
                        <div className="h-1.5 w-full bg-emerald-100/50 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-[65%] animate-pulse"></div>
                        </div>
                     </div>
                </div>
            </div>
        </div>
    );
};
