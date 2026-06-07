import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, Dog, Shield, Activity, FileText, ChevronRight, 
    Printer, Share2, Sparkles, HeartPulse, Microscope, AlertTriangle,
    X, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { api } from '../../services/apiService';
import LabTrendAnalyzer from '../shared/LabTrendAnalyzer';
import { toast } from 'sonner';

interface PortalPetDetailsProps {
    patientId: string;
    onBack: () => void;
}

export const PortalPetDetails: React.FC<PortalPetDetailsProps> = ({ patientId, onBack }) => {
    const [patient, setPatient] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'PASSPORT' | 'TRENDS' | 'HISTORY'>('PASSPORT');
    const [signingForm, setSigningForm] = useState<any>(null);
    const [signature, setSignature] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadPatientHistory();
    }, [patientId]);

    const loadPatientHistory = async () => {
        try {
            const data = await api.portal.getPatientHistory(patientId);
            setPatient(data);
        } catch (error) {
            toast.error('Failed to load pet details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSign = async () => {
        if (!signature.trim()) return;
        setIsSubmitting(true);
        try {
            await api.portal.signConsent(signingForm.id, signature);
            toast.success('Document signed successfully');
            setSigningForm(null);
            setSignature('');
            loadPatientHistory();
        } catch (err) {
            toast.error('Failed to sign document');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || !patient) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans pb-10">
            {/* Header */}
            <header className="bg-white sticky top-0 z-30 border-b border-slate-100 h-20 shadow-sm shadow-slate-100 flex items-center px-6">
                <div className="max-w-4xl mx-auto w-full flex items-center gap-4">
                    <button onClick={onBack} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 group transition-all">
                        <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                            <Dog className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 tracking-tight">{patient.name}</h1>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{patient.species} • {patient.breed}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 md:p-10">
                {/* Action Required: Consent Forms */}
                {patient.consentForms && patient.consentForms.some((f: any) => f.status === 'Pending') && (
                    <div className="space-y-4 mb-8">
                        <h3 className="text-sm font-black text-rose-600 uppercase tracking-widest px-1">Action Required</h3>
                        {patient.consentForms.filter((f: any) => f.status === 'Pending').map((form: any) => (
                            <div key={form.id} className="bg-rose-50 border border-rose-100 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white text-rose-600 flex items-center justify-center shadow-sm">
                                        <ShieldCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-800">{form.type}</h4>
                                        <p className="text-xs font-medium text-slate-500">Requires your digital signature to proceed.</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSigningForm(form)}
                                    className="w-full md:w-auto px-6 py-3 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-colors"
                                >
                                    Review & Sign
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Visual Navigation */}
                <div className="grid grid-cols-3 gap-3 mb-10 bg-white p-2 rounded-[28px] border border-slate-100 shadow-sm">
                    <button 
                        onClick={() => setActiveTab('PASSPORT')}
                        className={`py-4 rounded-[22px] font-black text-sm flex flex-col items-center gap-2 transition-all ${activeTab === 'PASSPORT' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        <Shield className="w-5 h-5" /> Passport
                    </button>
                    <button 
                        onClick={() => setActiveTab('TRENDS')}
                        className={`py-4 rounded-[22px] font-black text-sm flex flex-col items-center gap-2 transition-all ${activeTab === 'TRENDS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        <Activity className="w-5 h-5" /> Health Trends
                    </button>
                    <button 
                        onClick={() => setActiveTab('HISTORY')}
                        className={`py-4 rounded-[22px] font-black text-sm flex flex-col items-center gap-2 transition-all ${activeTab === 'HISTORY' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        <FileText className="w-5 h-5" /> Visit Logs
                    </button>
                </div>

                {activeTab === 'PASSPORT' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8">
                                <Shield className="w-24 h-24 text-blue-50/50 -rotate-12" />
                            </div>
                            <div className="p-8 md:p-12 border-b border-slate-50 flex items-center justify-between relative">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Vaccination Passport</h2>
                                    <p className="text-slate-500 font-medium">Official Digital Clinical Proof</p>
                                </div>
                                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm">
                                    <Printer className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-8 md:p-12 space-y-6">
                                {patient.vaccinations?.map((v: any) => (
                                    <div key={v.id} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-slate-50 group hover:border-blue-200 transition-all">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 rounded-2xl bg-white text-emerald-500 flex items-center justify-center shadow-sm">
                                                <HeartPulse className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-slate-800 uppercase">{v.name}</h4>
                                                <p className="text-sm font-bold text-slate-400">Given on {new Date(v.dateGiven).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                            <span className="px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-black uppercase">Active</span>
                                        </div>
                                    </div>
                                ))}
                                {patient.vaccinations?.length === 0 && (
                                    <div className="text-center py-20 bg-slate-50/50 rounded-[40px] border border-dashed border-slate-200">
                                        <Shield className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400 font-bold">No vaccination records found.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'TRENDS' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-blue-600 rounded-[32px] p-8 text-white">
                                <Microscope className="w-8 h-8 opacity-40 mb-4" />
                                <h3 className="text-xl font-black mb-2 tracking-tight">Diagnostic Insights</h3>
                                <p className="text-blue-100 font-medium leading-relaxed">We monitor specific biomarkers to track {patient.name}'s long-term wellness and response to care.</p>
                            </div>
                            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col justify-center">
                                <div className="flex items-center gap-3 mb-4">
                                    <Sparkles className="w-6 h-6 text-amber-500" />
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Wellness Score</span>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-5xl font-black text-slate-800">92</span>
                                    <span className="text-xl font-bold text-slate-400 mb-1.5">/100</span>
                                </div>
                                <p className="text-slate-500 text-sm font-bold mt-2">Excellent health status for {patient.breed || 'this breed'}.</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] p-8 md:p-12 border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Biomarker Trends</h3>
                                    <p className="text-slate-400 font-medium">Historical diagnostic trajectories.</p>
                                </div>
                            </div>
                            <LabTrendAnalyzer results={patient.labResults || []} testName={patient.labResults?.[0]?.testName || ''} />
                        </div>
                    </div>
                )}

                {activeTab === 'HISTORY' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <section>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-8">Clinical Timeline</h2>
                            <div className="space-y-6">
                                {patient.treatments?.map((v: any, idx: number) => (
                                    <div key={idx} className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm group hover:border-blue-200 transition-all cursor-pointer">
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-6">
                                                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                    <FileText className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{new Date(v.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                                    <h3 className="text-xl font-black text-slate-800 mb-3">{v.diagnosis || 'Clinical Consultation'}</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {v.procedures?.map((p: any, pidx: number) => (
                                                            <span key={pidx} className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-black uppercase rounded-lg border border-slate-100">{p.procedure.name}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    </div>
                                ))}
                                {patient.treatments?.length === 0 && (
                                    <div className="text-center py-20 bg-slate-50 shadow-inner rounded-[40px]">
                                        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400 font-bold">No visit history available.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}
            </main>

            {/* Signature Modal */}
            {signingForm && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Digital Consent</h2>
                                <p className="text-xs font-bold text-rose-600 uppercase tracking-widest">{signingForm.type}</p>
                            </div>
                            <button onClick={() => setSigningForm(null)} className="p-3 hover:bg-white rounded-2xl text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                            <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                                {signingForm.content}
                            </div>
                            <div className="bg-blue-50 p-6 rounded-3xl space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-black text-blue-800 uppercase tracking-widest">Type Full Name to Sign</span>
                                </div>
                                <input 
                                    type="text"
                                    value={signature}
                                    onChange={(e) => setSignature(e.target.value)}
                                    placeholder="Enter your legal full name"
                                    className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-blue-100 focus:border-blue-500 focus:ring-0 text-lg transition-all placeholder:font-sans placeholder:text-slate-300"
                                    style={{ fontFamily: "cursive" }}
                                />
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider text-center">
                                    By typing your name, you agree that this constitutes a binding legal signature.
                                </p>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                            <button 
                                onClick={() => setSigningForm(null)}
                                className="flex-1 py-4 text-sm font-bold text-slate-400 hover:text-slate-600"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSign}
                                disabled={!signature.trim() || isSubmitting}
                                className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.98]"
                            >
                                {isSubmitting ? 'Processing...' : 'Complete & Sign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
