import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
    Shield, Search, Filter, Calendar, User, FileText, ArrowRight, 
    Lock, CheckCircle, AlertTriangle, Download, RefreshCw, Syringe,
    Clock, ShieldCheck, ChevronRight, Activity, Database
} from 'lucide-react';
import { api } from '../../services/apiService';
import { ClinicSettings, User as UserType } from '../../types';

interface NarcoticLog {
    id: string;
    timestamp: string;
    itemName: string;
    patientName: string;
    quantity: number;
    staffName: string;
    notes: string;
    item?: { name: string };
    patient?: { name: string };
    staff?: { name: string };
}

interface NarcoticsLockboxProps {
    settings: ClinicSettings;
    currentUser: UserType | null;
}

export const NarcoticsLockbox: React.FC<NarcoticsLockboxProps> = ({ settings, currentUser }) => {
    const [logs, setLogs] = useState<NarcoticLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStaff, setFilterStaff] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await api.get('/narcotics');
            setLogs(data);
        } catch (error) {
            toast.error('Failed to load narcotics audit logs');
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const query = searchTerm.toLowerCase();
        const drugName = log.item?.name || log.itemName || '';
        const patientName = log.patient?.name || log.patientName || '';
        const staffName = log.staff?.name || log.staffName || '';
        
        const matchesSearch = drugName.toLowerCase().includes(query) || 
                             patientName.toLowerCase().includes(query) ||
                             staffName.toLowerCase().includes(query);
                             
        const matchesStaff = !filterStaff || staffName === filterStaff;
        
        return matchesSearch && matchesStaff;
    });

    const uniqueStaff = Array.from(new Set(logs.map(l => l.staff?.name || l.staffName))).filter(Boolean);

    return (
        <div className="space-y-10 animate-fade-in pb-32">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white p-10 rounded-[3rem] border border-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>
                <div className="relative z-10">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-6 uppercase">
                        <div className="w-16 h-16 bg-rose-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-rose-200">
                            <Shield className="w-8 h-8" />
                        </div>
                        Narcotics Lockbox
                    </h1>
                    <p className="text-slate-400 font-black mt-4 uppercase text-[10px] tracking-[0.4em] ml-2 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                        High-Fidelity Regulatory Compliance Hub
                    </p>
                </div>
                
                <div className="flex items-center gap-4 relative z-10">
                    <button 
                        onClick={loadLogs}
                        className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm active:scale-95"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="btn-luminous btn-luminous-primary px-10 py-5 text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-rose-100">
                        <Download className="w-4 h-4" /> Export Audit Register
                    </button>
                </div>
            </div>

            {/* Matrix Metrics - Prism Glass */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="glass-card bg-rose-50/50 border-rose-100/50 p-8 rounded-[2.5rem] relative group overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full -mr-12 -mt-12 blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.3em] mb-3">Integrity Status</p>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-xl flex items-center justify-center text-rose-600 border border-white">
                            <Lock className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-black text-slate-900 tracking-tight uppercase">Audited</span>
                    </div>
                </div>
                <div className="glass-card bg-amber-50/50 border-amber-100/50 p-8 rounded-[2.5rem] relative group overflow-hidden">
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-[0.3em] mb-3">Total Vectors (30d)</p>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-black text-slate-900 tracking-tighter">{logs.length}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase pb-1.5 tracking-widest">Logs Recorded</span>
                    </div>
                </div>
                <div className="glass-card bg-emerald-50/50 border-emerald-100/50 p-8 rounded-[2.5rem] relative group overflow-hidden">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.3em] mb-3">Variance Alerts</p>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-black text-emerald-500 tracking-tighter">0</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase pb-1.5 tracking-widest">Discrepancies</span>
                    </div>
                </div>
                <div className="glass-card bg-slate-50/50 border-slate-100/50 p-8 rounded-[2.5rem] relative group overflow-hidden">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Active Signatories</p>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-black text-slate-900 tracking-tighter">{uniqueStaff.length}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase pb-1.5 tracking-widest">Authorized</span>
                    </div>
                </div>
            </div>

            {/* Filters & Navigation */}
            <div className="flex flex-col md:flex-row gap-6">
                <div className="relative flex-1 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#14B8A6] transition-colors" />
                    <input 
                        type="text" 
                        placeholder="SEARCH AUDIT TRAIL..."
                        className="w-full bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] pl-14 pr-6 py-5 text-xs font-black uppercase tracking-widest text-slate-700 placeholder:text-slate-300 focus:ring-4 focus:ring-[#14B8A6]/5 focus:border-[#14B8A6]/30 outline-none transition-all shadow-xl"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-64 relative group">
                    <select 
                        className="w-full bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-700 appearance-none outline-none focus:ring-4 focus:ring-[#14B8A6]/5 focus:border-[#14B8A6]/30 transition-all shadow-xl cursor-pointer"
                        value={filterStaff}
                        onChange={(e) => setFilterStaff(e.target.value)}
                    >
                        <option value="">All Signatories</option>
                        {uniqueStaff.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Filter className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none group-hover:text-[#14B8A6] transition-colors" />
                </div>
            </div>

            {/* Audit Intelligence Table */}
            <div className="glass-card overflow-hidden ring-1 ring-white/20">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/40 border-b border-white/60">
                                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Temporal Anchor</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Controlled Asset</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Clinical Target</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Protocol Qty</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Authorization</th>
                                <th className="px-8 py-6 text-right text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Integrity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/20">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Synchronizing Encrypted Audit Trail...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center gap-6 opacity-20">
                                            <Database className="w-20 h-20" />
                                            <p className="text-[11px] font-black uppercase tracking-[0.4em]">Zero Controlled Records Found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="group hover:bg-white/40 transition-all cursor-pointer">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-800 tracking-tight">{new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3 text-rose-400" />
                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] flex items-center justify-center text-rose-500 border border-rose-100 shadow-inner group-hover:scale-110 transition-transform">
                                                    <Syringe className="w-5 h-5" />
                                                </div>
                                                <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{log.item?.name || log.itemName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                                                    <User className="w-4 h-4 text-slate-300" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-600">{log.patient?.name || log.patientName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 border border-rose-100 shadow-sm">
                                                <Activity className="w-3.5 h-3.5" />
                                                {log.quantity} UNITS
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-[10px] font-black text-[#14B8A6] uppercase">
                                                    {(log.staff?.name || log.staffName || 'D').charAt(0)}
                                                </div>
                                                <span className="text-sm font-black text-slate-700 tracking-tight">{log.staff?.name || log.staffName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm group-hover:shadow-emerald-100 transition-all">
                                                <ShieldCheck className="w-4 h-4" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Verified</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Compliance Footer - Luminous Aura */}
            <div className="glass-card bg-[#FFFBEB]/30 border-amber-100/50 p-10 rounded-[3rem] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                <div className="flex items-start gap-8 relative z-10">
                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-amber-500 shadow-xl border border-amber-50 group-hover:rotate-12 transition-transform">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Compliance Protocols & Legal Mandate</h4>
                        <p className="text-sm text-slate-500 font-bold mt-2 leading-relaxed max-w-4xl">
                            Federal regulations mandate absolute traceability of Schedule II-IV substances. This digital ledger is cryptographically hashed and serves as the primary legal audit source. Any physical variance must be reported and reconciled immediately within the clinical master record.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
