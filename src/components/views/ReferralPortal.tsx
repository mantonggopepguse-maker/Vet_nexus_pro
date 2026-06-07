import React, { useState } from 'react';
import { 
    Stethoscope, User, Dog, Clipboard, Send, CheckCircle2, 
    AlertCircle, Info, ArrowRight, Building2, Phone, Mail 
} from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';

interface ReferralPortalProps {
    clinicId: string;
    clinicName: string;
}

export const ReferralPortal: React.FC<ReferralPortalProps> = ({ clinicId, clinicName }) => {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [form, setForm] = useState({
        submittingVetName: '',
        submittingClinic: '',
        submittingEmail: '',
        submittingPhone: '',
        patientName: '',
        patientSpecies: 'Canine',
        patientBreed: '',
        patientAge: '',
        clientName: '',
        history: '',
        reasonForReferral: '',
        urgency: 'Routine'
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post(`/referrals/submit/${clinicId}`, form);
            setIsSuccess(true);
            toast.success("Referral submitted successfully");
        } catch (error) {
            toast.error("Failed to submit referral. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-amber-100 animate-fade-in">
                    <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 mb-4">Submission Successful!</h1>
                    <p className="text-slate-500 font-bold leading-relaxed mb-10">
                        Thank you for referring {form.patientName} to {clinicName}. Our specialists will review the history and contact the client directly.
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all font-black uppercase tracking-widest text-xs"
                    >
                        Submit Another Case
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-20 px-6">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-sm border border-slate-100 mb-6">
                        <Building2 className="w-5 h-5 text-amber-600" />
                        <span className="text-sm font-black text-slate-800 tracking-tight">{clinicName} Specialist Services</span>
                    </div>
                    <h1 className="text-5xl font-black text-slate-800 tracking-tighter mb-4">Referral Portal</h1>
                    <p className="text-slate-400 font-bold max-w-lg mx-auto">Precise, professional handover form for external clinicians.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Step Indicators */}
                    <div className="flex gap-4 mb-10">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className={`h-2 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-amber-600' : 'bg-slate-200'}`}></div>
                        ))}
                    </div>

                    {step === 1 && (
                        <div className="soft-card p-12 space-y-10 animate-fade-in-up">
                            <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-2">
                                <Stethoscope className="w-8 h-8 text-amber-600" />
                                <h3 className="text-2xl font-black text-slate-800">Veterinary Information</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Submitting Veterinarian</label>
                                    <input required type="text" name="submittingVetName" value={form.submittingVetName} onChange={handleInputChange} className="soft-input w-full p-4 font-bold" placeholder="Dr. Jane Smith" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Practice Name</label>
                                    <input required type="text" name="submittingClinic" value={form.submittingClinic} onChange={handleInputChange} className="soft-input w-full p-4 font-bold" placeholder="Sunset Vet Clinic" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                                    <input required type="email" name="submittingEmail" value={form.submittingEmail} onChange={handleInputChange} className="soft-input w-full p-4 font-bold" placeholder="clinic@example.com" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Direct Phone</label>
                                    <input required type="tel" name="submittingPhone" value={form.submittingPhone} onChange={handleInputChange} className="soft-input w-full p-4 font-bold" placeholder="+1..." />
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setStep(2)}
                                className="w-full py-5 bg-amber-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-amber-100 flex items-center justify-center gap-3 hover:-translate-y-1 transition-all"
                            >
                                Next Step (Patient Info) <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="soft-card p-12 space-y-10 animate-fade-in-up">
                            <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-2">
                                <Dog className="w-8 h-8 text-amber-600" />
                                <h3 className="text-2xl font-black text-slate-800">Patient Details</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Patient Name</label>
                                    <input required type="text" name="patientName" value={form.patientName} onChange={handleInputChange} className="soft-input w-full p-4 font-bold" placeholder="Buddy" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Species</label>
                                    <select name="patientSpecies" value={form.patientSpecies} onChange={handleInputChange} className="soft-input w-full p-4 font-bold bg-white">
                                        <option value="Canine">Canine</option>
                                        <option value="Feline">Feline</option>
                                        <option value="Avian">Avian</option>
                                        <option value="Exotic">Exotic</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Breed</label>
                                    <input type="text" name="patientBreed" value={form.patientBreed} onChange={handleInputChange} className="soft-input w-full p-4 font-bold" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Owner Full Name</label>
                                    <input required type="text" name="clientName" value={form.clientName} onChange={handleInputChange} className="soft-input w-full p-4 font-bold" />
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button type="button" onClick={() => setStep(1)} className="soft-btn px-6 py-5 font-black uppercase text-[10px] tracking-widest text-slate-400">Back</button>
                                <button 
                                    type="button" 
                                    onClick={() => setStep(3)} 
                                    className="flex-1 py-5 bg-amber-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-amber-100 flex items-center justify-center gap-3 hover:-translate-y-1 transition-all"
                                >
                                    Clinical History <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="soft-card p-12 space-y-10 animate-fade-in-up">
                            <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-2">
                                <Clipboard className="w-8 h-8 text-amber-600" />
                                <h3 className="text-2xl font-black text-slate-800">History & Urgency</h3>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Clinical History & Medications</label>
                                    <textarea required rows={5} name="history" value={form.history} onChange={handleInputChange} className="soft-input w-full p-4 font-bold" placeholder="Chief complaint, diagnostics performed, current meds..." />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Specific Goal for Referral</label>
                                    <textarea required rows={3} name="reasonForReferral" value={form.reasonForReferral} onChange={handleInputChange} className="soft-input w-full p-4 font-bold" placeholder="e.g. Echo, Surgery, Oncology Consult" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Urgency</label>
                                    <div className="flex gap-4">
                                        {['Routine', 'Urgent', 'Emergency'].map((u) => (
                                            <button 
                                                key={u}
                                                type="button"
                                                onClick={() => setForm({...form, urgency: u})}
                                                className={`flex-1 py-3 border-2 rounded-2xl font-black text-xs transition-all ${form.urgency === u ? 'bg-amber-600 border-amber-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}
                                            >
                                                {u}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setStep(2)} className="soft-btn px-6 py-5 font-black uppercase text-[10px] tracking-widest text-slate-400">Back</button>
                                <button 
                                    disabled={isSubmitting}
                                    type="submit" 
                                    className="flex-1 py-5 bg-amber-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-amber-100 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Send Referral'} <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </form>

                <div className="mt-12 text-center p-8 bg-amber-50/50 rounded-[3rem] border border-amber-100">
                    <div className="flex items-center justify-center gap-2 text-amber-600 mb-2">
                        <Info className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">Professional Notice</span>
                    </div>
                    <p className="text-xs text-amber-400 font-bold leading-relaxed">
                        Referrals are only accepted from licensed veterinary professionals. For client emergencies, please direct owners to call the hospital line immediately.
                    </p>
                </div>
            </div>
        </div>
    );
};
