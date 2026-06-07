import React, { useState } from 'react';
import { Save, Plus, Trash2, Search, Edit2, ChevronRight, ClipboardList } from 'lucide-react';
import { Procedure, ProcedureMedication, ClinicSettings } from '../../types';

interface ProcedureManagementProps {
    procedures: Procedure[];
    settings: ClinicSettings;
    onSave: (procedure: Procedure) => void;
}

export const ProcedureManagement: React.FC<ProcedureManagementProps> = ({ procedures, settings, onSave }) => {
    const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Procedure>({
        id: '',
        name: '',
        description: '',
        category: 'Medical',
        species: 'Canine',
        costClinic: 0,
        costClient: 0,
        medications: [],
        instructions: '',
        status: 'Active'
    });

    const resetForm = () => {
        setFormData({
            id: '',
            name: '',
            description: '',
            category: '',
            species: '',
            costClinic: 0,
            costClient: 0,
            medications: [],
            instructions: '',
            status: 'Active'
        });
    };

    const handleEdit = (proc: Procedure) => {
        setFormData(proc);
        setView('FORM');
    };

    const addMedication = () => {
        setFormData(prev => ({
            ...prev,
            medications: [...prev.medications, { id: Date.now(), drug: '', dose: '', route: '', freq: '', duration: '' }]
        }));
    };

    const updateMedication = (id: number, field: keyof ProcedureMedication, value: string) => {
        setFormData(prev => ({
            ...prev,
            medications: prev.medications.map(m => m.id === id ? { ...m, [field]: value } : m)
        }));
    };

    const removeMedication = (id: number) => {
        setFormData(prev => ({
            ...prev,
            medications: prev.medications.filter(m => m.id !== id)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const procedureToSave = {
                ...formData,
                id: formData.id || `new-${Date.now()}`
            };
            console.log('🔵 Submitting procedure with ID:', procedureToSave.id);
            await onSave(procedureToSave);
            setView('LIST');
            resetForm();
        } catch (error) {
            console.error('Failed to save procedure:', error);
            // Error is handled in App.tsx via alert
        } finally {
            setIsSaving(false);
        }
    };

    const filteredProcedures = procedures.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in pb-10">

            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Procedure Library</h1>
                    <p className="text-peach-500 text-sm font-bold">Register and manage standard procedures</p>
                </div>
                {view === 'LIST' && (
                    <button
                        onClick={() => { resetForm(); setView('FORM'); }}
                        className="soft-btn-primary bg-gradient-to-r from-peach-500 to-emerald-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-sm transition-transform hover:-translate-y-1 shadow-peach-200"
                    >
                        <Plus className="w-4 h-4 text-white" />
                        New Procedure
                    </button>
                )}
            </div>

            {view === 'LIST' ? (
                <div className="soft-card p-6 min-h-[500px] flex flex-col">
                    <div className="mb-6 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search procedures..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full soft-input pl-12 pr-4 py-4 text-sm font-bold text-slate-700"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100">
                                    <th className="py-4 pl-4">Procedure Name</th>
                                    <th className="py-4">Category</th>
                                    <th className="py-4">Cost ({settings.currencySymbol})</th>
                                    <th className="py-4 text-center">Status</th>
                                    <th className="py-4 text-right pr-4">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredProcedures.map(proc => (
                                    <tr key={proc.id} className="group hover:bg-slate-50 transition-colors">
                                        <td className="py-4 pl-4 font-bold text-slate-700">{proc.name}</td>
                                        <td className="py-4">
                                            <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase">
                                                {proc.category}
                                            </span>
                                        </td>
                                        <td className="py-4 font-medium text-slate-600">{proc.costClient.toLocaleString()}</td>
                                        <td className="py-4 text-center">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${proc.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                                                {proc.status}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right pr-4">
                                            <button
                                                onClick={() => handleEdit(proc)}
                                                className="text-slate-400 hover:text-peach-500 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredProcedures.length === 0 && (
                            <div className="text-center py-20 text-slate-400">
                                <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p>No procedures found.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="soft-card p-8 space-y-8 animate-fade-in border-t-4 border-peach-400">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-slate-100 pb-6">
                        <h2 className="text-xl font-bold text-slate-700">
                            {formData.id ? 'Edit Procedure' : 'Register New Procedure'}
                        </h2>
                        <button
                            type="button"
                            onClick={() => setView('LIST')}
                            className="text-sm font-bold text-slate-400 hover:text-slate-600"
                        >
                            Cancel
                        </button>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 ml-1">Procedure Name</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full soft-input px-4 py-3 font-bold text-slate-700"
                                    placeholder="e.g. IV Fluid Therapy"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 ml-1">Category</label>
                                <div className="relative">
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full soft-input px-4 py-3 font-bold text-slate-700 appearance-none bg-transparent"
                                    >
                                        <option value="">Select Category (Optional)</option>
                                        <option>Medical</option>
                                        <option>Surgical</option>
                                        <option>Preventive</option>
                                        <option>Reproductive</option>
                                    </select>
                                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rotate-90 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Short Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full soft-input px-4 py-3 font-medium text-slate-700"
                                placeholder="Brief summary of the procedure..."
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* Applicability */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Applicability</label>
                            <div className="relative">
                                <select
                                    value={formData.species}
                                    onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                                    className="w-full soft-input px-4 py-3 font-bold text-slate-700 appearance-none bg-transparent"
                                >
                                    <option value="">Select Species (Optional)</option>
                                    <option>Canine</option>
                                    <option>Feline</option>
                                    <option>Canine & Feline</option>
                                    <option>Bovine</option>
                                    <option>Equine</option>
                                    <option>Exotic / Others</option>
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rotate-90 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Status</label>
                            <div className="relative">
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                                    className="w-full soft-input px-4 py-3 font-bold text-slate-700 appearance-none bg-transparent"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rotate-90 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Cost Config */}
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Cost Configuration</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Cost to Clinic ({settings.currencySymbol})</label>
                                <input
                                    type="number"
                                    value={formData.costClinic}
                                    onChange={(e) => setFormData({ ...formData, costClinic: parseFloat(e.target.value) || 0 })}
                                    className="w-full soft-input px-4 py-3 font-bold text-slate-700 bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Cost to Client ({settings.currencySymbol})</label>
                                <input
                                    type="number"
                                    value={formData.costClient}
                                    onChange={(e) => setFormData({ ...formData, costClient: parseFloat(e.target.value) || 0 })}
                                    className="w-full soft-input px-4 py-3 font-bold text-peach-600 bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Included Medications */}
                    <div>
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            Included Medications
                            <span className="text-xs font-normal text-slate-400">(Auto-populated in Treatment Sheet)</span>
                        </h3>
                        <div className="space-y-2">
                            {formData.medications.map((med) => (
                                <div key={med.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center">
                                    <input
                                        className="sm:col-span-2 soft-input px-3 py-2 text-sm font-medium"
                                        placeholder="Drug Name"
                                        value={med.drug}
                                        onChange={(e) => updateMedication(med.id, 'drug', e.target.value)}
                                    />
                                    <input
                                        className="soft-input px-3 py-2 text-sm font-medium"
                                        placeholder="Dose"
                                        value={med.dose}
                                        onChange={(e) => updateMedication(med.id, 'dose', e.target.value)}
                                    />
                                    <select
                                        className="soft-input px-3 py-2 text-sm font-medium appearance-none bg-transparent"
                                        value={med.route}
                                        onChange={(e) => updateMedication(med.id, 'route', e.target.value)}
                                    >
                                        <option>Route</option>
                                        <option>Oral</option>
                                        <option>SC</option>
                                        <option>IM</option>
                                        <option>IV</option>
                                    </select>
                                    <select
                                        className="soft-input px-3 py-2 text-sm font-medium appearance-none bg-transparent"
                                        value={med.freq}
                                        onChange={(e) => updateMedication(med.id, 'freq', e.target.value)}
                                    >
                                        <option>Freq</option>
                                        <option>SID</option>
                                        <option>BID</option>
                                        <option>TID</option>
                                    </select>
                                    <div className="flex items-center gap-2">
                                        <input
                                            className="w-full soft-input px-3 py-2 text-sm font-medium"
                                            placeholder="Days"
                                            value={med.duration}
                                            onChange={(e) => updateMedication(med.id, 'duration', e.target.value)}
                                        />
                                        <button type="button" onClick={() => removeMedication(med.id)} className="text-rose-400 hover:text-rose-600 p-2">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addMedication} className="mt-3 text-sm font-bold text-peach-600 hover:text-peach-700 flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Add Medication
                        </button>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">Standard Instructions</label>
                        <textarea
                            rows={3}
                            value={formData.instructions}
                            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                            className="w-full soft-input px-4 py-3 font-medium text-slate-700"
                            placeholder="Clinical instructions auto-used in treatment sheet..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="pt-6 flex justify-end gap-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setView('LIST')}
                            className="px-6 py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="soft-btn-primary bg-gradient-to-r from-peach-500 to-emerald-500 px-10 py-3 rounded-xl font-bold flex items-center gap-2 text-white shadow-peach-200 disabled:opacity-70"
                        >
                            {isSaving ? (
                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            {isSaving ? 'Saving...' : 'Save Procedure'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};




