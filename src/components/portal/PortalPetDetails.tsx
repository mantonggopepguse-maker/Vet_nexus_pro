import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, Dog, Shield, Activity, FileText, ChevronRight, 
    Printer, Share2, Sparkles, HeartPulse, Microscope, AlertTriangle,
    X, ShieldCheck, CheckCircle2, Syringe, Camera
} from 'lucide-react';
import { api } from '../../services/apiService';
import LabTrendAnalyzer from '../shared/LabTrendAnalyzer';
import { toast } from 'sonner';
import { computePetVaccineSchedules } from '../../utils/vaccineSchedule';

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
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

    const handlePetAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const res = await api.portal.uploadPetAvatar(patientId, formData);
            if (res.pet) {
                setPatient((prev: any) => ({ ...prev, avatarUrl: res.pet.avatarUrl }));
                toast.success("Pet profile picture updated!");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update pet picture");
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSign = async () => {
        if (!signature.trim()) return;
        setIsSubmitting(true);
        try {
            const canvas = document.getElementById('signature-canvas') as HTMLCanvasElement;
            const dataUrl = canvas ? canvas.toDataURL('image/png') : undefined;
            await api.portal.signConsent(signingForm.id, signature, dataUrl);
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    const vaccineSchedules = computePetVaccineSchedules(patient);

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans pb-12 relative overflow-x-hidden">
            {/* Ambient Background Glow */}
            <div className="fixed top-0 right-1/4 w-96 h-96 bg-teal-200/20 rounded-full blur-3xl pointer-events-none -z-10" />

            {/* Header */}
            <header className="portal-glass-header sticky top-0 z-30 h-20 flex items-center px-4 md:px-6">
                <div className="max-w-4xl mx-auto w-full flex items-center gap-4">
                    <button onClick={onBack} className="p-3 hover:bg-teal-50 rounded-2xl text-slate-500 hover:text-teal-700 group transition-all active:scale-95 border border-transparent hover:border-teal-100">
                        <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="relative group shrink-0">
                            {patient.avatarUrl ? (
                                <img src={patient.avatarUrl} alt={patient.name} className="w-12 h-12 rounded-2xl object-cover border-2 border-teal-500 shadow-md" />
                            ) : (
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 border border-white/40">
                                    <Dog className="w-6 h-6" />
                                </div>
                            )}
                            <label className="absolute -bottom-1 -right-1 p-1 bg-amber-400 text-slate-900 rounded-full cursor-pointer hover:scale-110 transition shadow-md flex items-center justify-center" title="Upload Pet Picture">
                                <Camera className="w-3 h-3" />
                                <input type="file" accept="image/*" className="hidden" onChange={handlePetAvatarUpload} disabled={uploadingAvatar} />
                            </label>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">{patient.name}</h1>
                            <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">{patient.species} • {patient.breed}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
                {/* Action Required: Consent Forms */}
                {patient.consentForms && patient.consentForms.some((f: any) => f.status === 'Pending') && (
                    <div className="space-y-3 mb-6">
                        <h3 className="text-xs font-black text-rose-600 uppercase tracking-wider px-1">Action Required</h3>
                        {patient.consentForms.filter((f: any) => f.status === 'Pending').map((form: any) => (
                            <div key={form.id} className="portal-neo-card bg-rose-50/60 border border-rose-200 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white text-rose-600 flex items-center justify-center shadow-sm border border-rose-100">
                                        <ShieldCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900">{form.type}</h4>
                                        <p className="text-xs font-medium text-slate-600">Requires your digital signature to proceed with treatment.</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSigningForm(form)}
                                    className="w-full sm:w-auto px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md hover:bg-rose-700 transition-all active:scale-95"
                                >
                                    Review & Sign
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Visual Navigation Tabs */}
                <div className="grid grid-cols-3 gap-2.5 p-2 portal-glass-card rounded-[28px]">
                    <button 
                        onClick={() => setActiveTab('PASSPORT')}
                        className={`py-3.5 rounded-[22px] font-black text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-2 transition-all ${
                            activeTab === 'PASSPORT' 
                                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/20' 
                                : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/50'
                        }`}
                    >
                        <Shield className="w-4 h-4" /> Passport
                    </button>
                    <button 
                        onClick={() => setActiveTab('TRENDS')}
                        className={`py-3.5 rounded-[22px] font-black text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-2 transition-all ${
                            activeTab === 'TRENDS' 
                                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/20' 
                                : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/50'
                        }`}
                    >
                        <Activity className="w-4 h-4" /> Health Trends
                    </button>
                    <button 
                        onClick={() => setActiveTab('HISTORY')}
                        className={`py-3.5 rounded-[22px] font-black text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-2 transition-all ${
                            activeTab === 'HISTORY' 
                                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/20' 
                                : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50/50'
                        }`}
                    >
                        <FileText className="w-4 h-4" /> Visit Logs
                    </button>
                </div>

                {activeTab === 'PASSPORT' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Yearly Vaccine Schedule Box */}
                        <div className="portal-neo-card p-6 border border-teal-200/80 bg-gradient-to-br from-teal-50/50 via-white to-amber-50/30">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
                                        <Syringe className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">Annual Immunization Schedule</h3>
                                        <p className="text-xs font-bold text-teal-700">Default 12-month interval for adult dogs & cats</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {vaccineSchedules.map((vac) => (
                                    <div key={vac.id} className="portal-neo-inset p-4 flex items-center justify-between border border-slate-200/80">
                                        <div>
                                            <h4 className="font-black text-slate-900 text-sm">{vac.name}</h4>
                                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                                                {vac.lastGivenDate ? `Last: ${new Date(vac.lastGivenDate).toLocaleDateString()}` : 'No previous record'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                vac.status === 'UP_TO_DATE' ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                                : vac.status === 'DUE_SOON' ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                                            }`}>
                                                {vac.status === 'UP_TO_DATE' ? `Next: ${vac.nextDueDate}` : vac.status === 'DUE_SOON' ? `Due Soon: ${vac.nextDueDate}` : 'Due For Annual'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="portal-neo-card overflow-hidden relative border border-slate-200/80">
                            <div className="absolute top-0 right-0 p-8">
                                <Shield className="w-28 h-28 text-teal-100/40 -rotate-12 pointer-events-none" />
                            </div>
                            <div className="p-6 md:p-10 border-b border-slate-100 flex items-center justify-between relative bg-gradient-to-r from-teal-50/40 via-white to-amber-50/30">
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1">Vaccination Passport</h2>
                                    <p className="text-teal-700 font-bold text-xs">Official Digital Clinical Record</p>
                                </div>
                                <button className="p-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:text-teal-700 hover:border-teal-200 transition-all shadow-sm active:scale-95">
                                    <Printer className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 md:p-10 space-y-4">
                                {patient.vaccinations?.map((v: any) => (
                                    <div key={v.id} className="flex items-center justify-between p-5 portal-neo-inset border border-slate-200/60 group hover:border-teal-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white text-teal-600 flex items-center justify-center shadow-sm border border-slate-100">
                                                <HeartPulse className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <h4 className="text-base font-black text-slate-900 uppercase">{v.name}</h4>
                                                <p className="text-xs font-bold text-slate-500">Given on {new Date(v.dateGiven).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
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
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="portal-glass-card bg-white/95 rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white">
                        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-teal-50/50 via-white to-amber-50/30">
                            <div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider mb-1">Action Required</span>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{signingForm.type}</h2>
                                <p className="text-xs font-bold text-slate-500 mt-0.5">Please review terms and sign below.</p>
                            </div>
                            <button onClick={() => setSigningForm(null)} className="p-3 hover:bg-white rounded-2xl text-slate-400 hover:text-slate-700 transition border border-transparent hover:border-slate-200">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 md:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                            <div className="portal-neo-inset p-5 rounded-2xl text-slate-700 leading-relaxed font-medium text-sm whitespace-pre-wrap border border-slate-200/60">
                                {signingForm.content}
                            </div>
                            
                            <div className="portal-neo-card p-5 space-y-4 border border-teal-200/60 bg-gradient-to-br from-teal-50/30 to-amber-50/20">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-teal-700" />
                                        <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Draw Digital Signature</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const canvas = document.getElementById('signature-canvas') as HTMLCanvasElement;
                                            if (canvas) {
                                                const ctx = canvas.getContext('2d');
                                                ctx?.clearRect(0, 0, canvas.width, canvas.height);
                                            }
                                        }}
                                        className="text-xs font-bold text-slate-500 hover:text-rose-600 transition"
                                    >
                                        Clear Signature
                                    </button>
                                </div>

                                <div className="rounded-2xl border-2 border-dashed border-teal-300 bg-white p-2 text-center relative overflow-hidden">
                                    <canvas
                                        id="signature-canvas"
                                        width={500}
                                        height={140}
                                        className="w-full h-36 touch-none cursor-crosshair"
                                        onMouseDown={(e) => {
                                            const canvas = e.currentTarget;
                                            const ctx = canvas.getContext('2d');
                                            if (!ctx) return;
                                            const rect = canvas.getBoundingClientRect();
                                            ctx.beginPath();
                                            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                                            (canvas as any).isDrawing = true;
                                            ctx.strokeStyle = '#0F766E';
                                            ctx.lineWidth = 3;
                                            ctx.lineCap = 'round';
                                        }}
                                        onMouseMove={(e) => {
                                            const canvas = e.currentTarget;
                                            if (!(canvas as any).isDrawing) return;
                                            const ctx = canvas.getContext('2d');
                                            if (!ctx) return;
                                            const rect = canvas.getBoundingClientRect();
                                            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                                            ctx.stroke();
                                        }}
                                        onMouseUp={(e) => { (e.currentTarget as any).isDrawing = false; }}
                                        onMouseLeave={(e) => { (e.currentTarget as any).isDrawing = false; }}
                                        onTouchStart={(e) => {
                                            const canvas = e.currentTarget;
                                            const ctx = canvas.getContext('2d');
                                            if (!ctx || !e.touches[0]) return;
                                            const rect = canvas.getBoundingClientRect();
                                            ctx.beginPath();
                                            ctx.moveTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
                                            (canvas as any).isDrawing = true;
                                            ctx.strokeStyle = '#0F766E';
                                            ctx.lineWidth = 3;
                                            ctx.lineCap = 'round';
                                        }}
                                        onTouchMove={(e) => {
                                            const canvas = e.currentTarget;
                                            if (!(canvas as any).isDrawing || !e.touches[0]) return;
                                            const ctx = canvas.getContext('2d');
                                            if (!ctx) return;
                                            const rect = canvas.getBoundingClientRect();
                                            ctx.lineTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
                                            ctx.stroke();
                                        }}
                                        onTouchEnd={(e) => { (e.currentTarget as any).isDrawing = false; }}
                                    />
                                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-widest pointer-events-none">Sign Above With Touch / Mouse</span>
                                </div>

                                <div className="space-y-1.5 pt-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 ml-1">Legal Full Name</label>
                                    <input 
                                        type="text"
                                        value={signature}
                                        onChange={(e) => setSignature(e.target.value)}
                                        placeholder="Enter your legal full name"
                                        className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-200 focus:border-teal-400 text-base font-bold transition-all portal-neo-inset"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                            <button 
                                onClick={() => setSigningForm(null)}
                                className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:text-slate-700"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSign}
                                disabled={!signature.trim() || isSubmitting}
                                className="flex-[2] portal-btn-teal py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider disabled:opacity-50"
                            >
                                {isSubmitting ? 'Signing Document...' : 'Sign & Submit Consent'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
