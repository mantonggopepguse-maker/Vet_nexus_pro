import React, { useState, useEffect } from 'react';
import { 
    Inbox, Search, ArrowRight,
    CheckCircle2, XCircle, AlertTriangle, UserPlus, FileText, ChevronRight, Dog, ClipboardList
} from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';

interface Referral {
    id: string;
    submittingVetName: string;
    submittingClinic: string;
    patientName: string;
    patientSpecies: string;
    clientName: string;
    urgency: string;
    status: string;
    createdAt: string;
    reasonForReferral: string;
    history: string;
}

interface ReferralManagementProps {
    onNavigate: (view: any) => void;
}

export const ReferralManagement: React.FC<ReferralManagementProps> = ({ onNavigate }) => {
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchReferrals();
    }, []);

    const fetchReferrals = async () => {
        try {
            const data = await api.get('/referrals');
            setReferrals(data);
        } catch (error) {
            toast.error('Failed to fetch referrals');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await api.patch(`/referrals/${id}/status`, { status });
            toast.success(`Referral ${status.toLowerCase()}`);
            fetchReferrals();
            setSelectedReferral(null);
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const filteredReferrals = referrals.filter(r => 
        r.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.submittingClinic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                        <Inbox className="w-10 h-10 text-amber-600" />
                        Referral Inbox
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Manage incoming specialist cases</p>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search referrals..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full soft-input pl-11 py-3 text-sm font-bold"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* List Column */}
                <div className="lg:col-span-4 space-y-4">
                    {loading ? (
                        <div className="p-12 text-center text-slate-300">Loading incoming cases...</div>
                    ) : filteredReferrals.length === 0 ? (
                        <div className="p-20 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[3rem]">
                            <Inbox className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p className="font-bold">Inbox Empty</p>
                        </div>
                    ) : (
                        filteredReferrals.map((referral) => (
                            <button
                                key={referral.id}
                                onClick={() => setSelectedReferral(referral)}
                                className={`w-full text-left p-6 rounded-[2.5rem] transition-all duration-300 border-2 ${
                                    selectedReferral?.id === referral.id 
                                    ? 'bg-white border-amber-600 shadow-2xl shadow-amber-100 scale-[1.02]' 
                                    : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200'
                                } group relative overflow-hidden`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-black text-slate-800">{referral.patientName}</span>
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{referral.submittingClinic}</span>
                                    </div>
                                    <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 ${
                                        referral.urgency === 'Emergency' ? 'bg-rose-100 text-rose-600' : 
                                        referral.urgency === 'Urgent' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        <AlertTriangle className="w-3 h-3" /> {referral.urgency}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-500">Owner: {referral.clientName}</p>
                                    <p className="text-xs font-bold text-slate-400">Recieved: {new Date(referral.createdAt).toLocaleDateString()}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Detail Column */}
                <div className="lg:col-span-8">
                    {selectedReferral ? (
                        <div className="soft-card p-12 space-y-10 animate-fade-in-up">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-400">
                                        <Dog className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">{selectedReferral.patientName}</h2>
                                        <p className="text-amber-600 font-bold text-sm tracking-tight">Referral from: {selectedReferral.submittingClinic}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${
                                        selectedReferral.status === 'Pending' ? 'bg-amber-500 text-white' : 
                                        selectedReferral.status === 'Accepted' ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'
                                    }`}>
                                        {selectedReferral.status}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Submitting Vet</p>
                                    <p className="text-md font-bold text-slate-700">{selectedReferral.submittingVetName}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient Info</p>
                                    <p className="text-md font-bold text-slate-700">{selectedReferral.patientSpecies} | {selectedReferral.clientName} (Owner)</p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-slate-50">
                                <h4 className="flex items-center gap-2 font-black text-slate-800">
                                    <ClipboardList className="w-5 h-5 text-amber-600" />
                                    Clinical Reason for Referral
                                </h4>
                                <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    {selectedReferral.reasonForReferral}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h4 className="flex items-center gap-2 font-black text-slate-800">
                                    <FileText className="w-5 h-5 text-amber-600" />
                                    Initial History
                                </h4>
                                <p className="text-sm font-medium text-slate-500 whitespace-pre-wrap leading-relaxed">
                                    {selectedReferral.history}
                                </p>
                            </div>

                            {selectedReferral.status === 'Pending' && (
                                <div className="flex gap-4 pt-10 border-t border-slate-50">
                                    <button 
                                        onClick={() => handleUpdateStatus(selectedReferral.id, 'Declined')}
                                        className="flex-1 py-5 border-2 border-slate-100 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <XCircle size={16} /> Decline Case
                                    </button>
                                    <button 
                                        onClick={() => handleUpdateStatus(selectedReferral.id, 'Accepted')}
                                        className="flex-1 py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-100 hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 size={16} /> Accept Case & Notify Vet
                                    </button>
                                </div>
                            )}

                            {selectedReferral.status === 'Accepted' && (
                                <div className="p-6 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-emerald-600">
                                            <UserPlus className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-emerald-800">Ready for Intake</p>
                                            <p className="text-[10px] font-bold text-emerald-600">Referral has been accepted into hospital care.</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => onNavigate('PATIENTS')}
                                        className="soft-btn-primary px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                    >
                                        Create Patient File <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-[600px] flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-[4rem] border-2 border-dashed border-slate-100">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-slate-200 mb-8 shadow-inner">
                                <ChevronRight size={48} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-300 tracking-tight">Referral Details</h3>
                            <p className="text-slate-400 font-bold max-w-xs mt-4">Select an incoming case from the left to review history and accept into specialty care.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
