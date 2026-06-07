import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Calendar, Tag, Trash2, AlertCircle, FileText, X, Printer, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';
import { Pet, ClinicSettings } from '../../types';

interface VaccinationTabProps {
    patientId: string;
    patient: Pet;
    settings: ClinicSettings;
}

export const VaccinationTab: React.FC<VaccinationTabProps> = ({ patientId, patient, settings }) => {
    const [vaccinations, setVaccinations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedVac, setSelectedVac] = useState<any | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        dateGiven: new Date().toISOString().split('T')[0],
        nextDueDate: '',
        batchNumber: '',
        manufacturer: '',
        notes: ''
    });

    const loadVaccinations = async () => {
        try {
            const data = await api.vaccinations.getByPatientId(patientId);
            setVaccinations(data);
        } catch (error) {
            console.error('Failed to load vaccinations:', error);
            toast.error('Failed to load vaccination history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadVaccinations();
    }, [patientId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.vaccinations.create({
                ...formData,
                patientId
            });
            toast.success('Vaccination recorded successfully');
            setShowAddForm(false);
            setFormData({
                name: '',
                dateGiven: new Date().toISOString().split('T')[0],
                nextDueDate: '',
                batchNumber: '',
                manufacturer: '',
                notes: ''
            });
            loadVaccinations();
        } catch (error) {
            toast.error('Failed to record vaccination');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this record?')) return;
        try {
            await api.vaccinations.delete(id);
            toast.success('Record deleted');
            loadVaccinations();
        } catch (error) {
            toast.error('Failed to delete record');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#14B8A6]"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Vaccination Records</h3>
                    <p className="text-sm text-slate-500 text-compact">History of preventive care and boosters</p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#14B8A6] text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-200 hover:bg-[#B8962D] transition-all active:scale-95"
                >
                    {showAddForm ? <FileText className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showAddForm ? 'Cancel' : 'New Vaccination'}
                </button>
            </div>

            {showAddForm && (
                <form onSubmit={handleSubmit} className="bg-white/50 backdrop-blur-md rounded-2xl border border-slate-200 p-6 animate-slide-down space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Vaccine Name</label>
                            <input
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] transition-all"
                                placeholder="DHPP, Rabies, etc."
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Date Given</label>
                            <input
                                type="date"
                                required
                                value={formData.dateGiven}
                                onChange={e => setFormData({ ...formData, dateGiven: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Next Due Date (Optional)</label>
                            <input
                                type="date"
                                value={formData.nextDueDate}
                                onChange={e => setFormData({ ...formData, nextDueDate: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Batch / Serial #</label>
                            <input
                                value={formData.batchNumber}
                                onChange={e => setFormData({ ...formData, batchNumber: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] transition-all"
                                placeholder="e.g. 12345ABC"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] transition-all resize-none h-20"
                            placeholder="Reaction, specific instructions, etc."
                        />
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            className="px-8 py-3 bg-[#14B8A6] text-white rounded-xl font-bold text-sm shadow-xl shadow-amber-200 hover:bg-[#B8962D] transition-all active:scale-95"
                        >
                            Record Vaccination
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 gap-3">
                {vaccinations.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <ShieldCheck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-medium">No vaccinations recorded for this patient.</p>
                    </div>
                ) : (
                    vaccinations.map((vac) => {
                        const isOverdue = vac.nextDueDate && new Date(vac.nextDueDate) < new Date();
                        const isDueSoon = vac.nextDueDate &&
                            new Date(vac.nextDueDate) > new Date() &&
                            new Date(vac.nextDueDate).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;

                        return (
                            <div key={vac.id} className="group relative bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isOverdue ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-[#14B8A6]'}`}>
                                            <ShieldCheck className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{vac.name}</h4>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    Administered: {new Date(vac.dateGiven).toLocaleDateString()}
                                                </div>
                                                {vac.nextDueDate && (
                                                    <div className={`flex items-center gap-1.5 text-xs font-bold ${isOverdue ? 'text-rose-600' : isDueSoon ? 'text-amber-600' : 'text-peach-600'}`}>
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        Next Due: {new Date(vac.nextDueDate).toLocaleDateString()}
                                                        {isOverdue && <span className="ml-1 text-[10px] bg-rose-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">Overdue</span>}
                                                    </div>
                                                )}
                                                {vac.batchNumber && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <Tag className="w-3.5 h-3.5" />
                                                        Batch: {vac.batchNumber}
                                                    </div>
                                                )}
                                            </div>
                                            {vac.notes && <p className="mt-2 text-sm text-slate-500 italic">" {vac.notes} "</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedVac(vac)}
                                            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-[#14B8A6] rounded-lg transition-all"
                                            title="Print Certificate"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(vac.id)}
                                            className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Vaccination Certificate Modal */}
            {selectedVac && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:p-0 print:bg-white print:backdrop-none">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300 print:shadow-none print:rounded-none">
                        {/* Modal Header (Hidden on Print) */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white print:hidden">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Vaccination Certificate</h3>
                                <p className="text-xs font-bold text-[#14B8A6] uppercase">Preview & Print Document</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="p-3 bg-[#14B8A6] text-white rounded-2xl hover:bg-[#B8962D] transition-all shadow-lg shadow-amber-200 flex items-center gap-2 font-bold text-sm"
                                >
                                    <Printer className="w-4 h-4" /> Print
                                </button>
                                <button
                                    onClick={() => setSelectedVac(null)}
                                    className="p-3 bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Certificate Content */}
                        <div className="p-12 print:p-8 relative">
                            {/* Watermark/Background Decoration */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
                                <ShieldCheck className="w-[400px] h-[400px]" />
                            </div>

                            <div className="relative z-10 space-y-10">
                                {/* Logo & Clinic Header */}
                                <div className="text-center space-y-4">
                                    <div className="w-20 h-20 bg-[#14B8A6] rounded-[2rem] mx-auto flex items-center justify-center text-white shadow-xl">
                                        <ShieldCheck className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">{settings.name}</h1>
                                        <p className="text-sm font-bold text-slate-500">{settings.address || 'Veterinary Health & Wellness Center'}</p>
                                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">{settings.email} • {settings.phone}</p>
                                    </div>
                                    <div className="h-0.5 w-full bg-slate-100"></div>
                                </div>

                                {/* Certificate Title */}
                                <div className="text-center">
                                    <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-2">CERTIFICATE OF VACCINATION</h2>
                                    <p className="text-slate-500 font-medium">This document certifies that the following patient has been professionally vaccinated.</p>
                                </div>

                                {/* Patient Details */}
                                <div className="grid grid-cols-2 gap-8 bg-slate-50 p-8 rounded-3xl border border-slate-100">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Name</p>
                                            <p className="text-xl font-black text-slate-800">{patient.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Species / Breed</p>
                                            <p className="text-sm font-bold text-slate-600">{patient.species} • {patient.breed || 'Mixed'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Microchip ID</p>
                                            <p className="text-sm font-bold text-slate-600 font-mono tracking-wider">{patient.microchipId || 'Not Recorded'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Owner</p>
                                            <p className="text-sm font-bold text-slate-600">{patient.owner?.firstName} {patient.owner?.lastName}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Vaccination Details */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 bg-amber-50 p-6 rounded-3xl border border-amber-100 relative overflow-hidden group">
                                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#14B8A6] shadow-sm">
                                            <CheckCircle2 className="w-8 h-8" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Vaccine Administered</p>
                                            <h3 className="text-2xl font-black text-slate-800">{selectedVac.name}</h3>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Administered</p>
                                            <p className="text-sm font-black text-slate-700">{new Date(selectedVac.dateGiven).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-5 border border-slate-100 rounded-2xl bg-white shadow-sm">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch Number</p>
                                            <p className="text-sm font-bold text-slate-700">{selectedVac.batchNumber || 'N/A'}</p>
                                        </div>
                                        <div className="p-5 border border-slate-100 rounded-2xl bg-peach-50 shadow-sm">
                                            <p className="text-[10px] font-black text-peach-400 uppercase tracking-widest mb-1">Next Due Date</p>
                                            <p className="text-sm font-black text-peach-700">
                                                {selectedVac.nextDueDate 
                                                    ? new Date(selectedVac.nextDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                                    : 'Not Specified'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Doctor's Signature Block */}
                                <div className="pt-12 flex justify-between items-end">
                                    <div className="text-center space-y-2">
                                        <div className="w-48 h-px bg-slate-300"></div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Clinic Authentication</p>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <div className="w-48 border-b-2 border-slate-800 pb-2 italic text-slate-400 font-serif text-lg">
                                            {selectedVac.administeredBy || 'Medical Staff'}
                                        </div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attending Veterinarian</p>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="text-center pt-8">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Official Medical Record • Validating Vaccination Protocol</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
