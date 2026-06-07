import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Save, PawPrint, Weight, Calendar, Info, Loader2 } from 'lucide-react';
import { Pet, Client } from '../../types';

interface AddPatientFormProps {
    onBack: () => void;
    clients: Client[];
    onSave: (pet: Omit<Pet, 'id'>) => void;
    isSaving?: boolean;
    initialOwnerId?: string;
    initialData?: Pet;
}

export const AddPatientForm: React.FC<AddPatientFormProps> = ({ onBack, clients, onSave, isSaving = false, initialOwnerId = '', initialData }) => {
    const isEdit = !!initialData;

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        ownerId: initialData?.ownerId || initialOwnerId,
        species: initialData?.species || 'Dog',
        breed: initialData?.breed || '',
        gender: (initialData?.gender || 'Male') as 'Male' | 'Female',
        age: initialData?.age || 0,
        ageYearsEntry: initialData ? Math.floor(initialData.age) : 0,
        ageMonthsEntry: initialData ? Math.round((initialData.age % 1) * 12) : 0,
        weight: initialData?.weight || 0,
        color: initialData?.color || '',
        microchipId: initialData?.microchipId || ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.ownerId) {
            toast.error("Please select an owner");
            return;
        }

        // Sanitize numeric data
        const ageYears = Math.floor(Number(formData.ageYearsEntry) || 0);
        const ageMonths = Math.floor(Number(formData.ageMonthsEntry) || 0);

        // Calculate approx birth date
        const dob = new Date();
        dob.setFullYear(dob.getFullYear() - ageYears);
        dob.setMonth(dob.getMonth() - ageMonths);

        const submissionData = {
            ...formData,
            ageYearsEntry: ageYears,
            ageMonthsEntry: ageMonths,
            weight: Number(formData.weight) || 0,
            dateOfBirth: dob.toISOString(),
            age: ageYears + (ageMonths / 12)
        };

        onSave(submissionData);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        let finalValue: any = value;
        if (type === 'number') {
            if (value === '' || value.endsWith('.')) {
                finalValue = value;
            } else {
                const parsed = parseFloat(value);
                finalValue = isNaN(parsed) ? 0 : parsed;
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: finalValue
        }));
    };

    return (
        <div className="animate-fade-in max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 md:mb-8">
                <button
                    onClick={onBack}
                    className="w-10 h-10 md:w-12 md:h-12 soft-btn flex items-center justify-center text-slate-500 hover:text-peach-500 hover:bg-peach-50"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{isEdit ? 'Edit Patient' : 'New Patient'}</h1>
                    <p className="text-peach-500 text-xs md:text-sm font-bold tracking-wide">{isEdit ? 'Update pet details' : 'Register a new pet'}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="soft-card p-4 md:p-8 space-y-6 md:space-y-8 border-t-4 border-peach-400">

                {/* Owner Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 ml-1">Pet Owner</label>
                    <div className="relative">
                        <select
                            name="ownerId"
                            value={formData.ownerId}
                            onChange={handleInputChange}
                            className="w-full soft-input px-5 py-4 font-bold text-slate-700 appearance-none bg-transparent"
                            required
                        >
                            <option value="" disabled>Select Client</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.phone})</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">Pet Name</label>
                        <div className="relative">
                            <PawPrint className="absolute left-4 top-1/2 -translate-y-1/2 text-peach-300 w-5 h-5" />
                            <input
                                required
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full soft-input pl-12 pr-4 py-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-peach-200"
                                placeholder="e.g. Buddy"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">Species</label>
                        <div className="relative">
                            <select
                                name="species"
                                value={formData.species}
                                onChange={handleInputChange}
                                className="w-full soft-input px-5 py-4 font-bold text-slate-700 appearance-none bg-transparent"
                            >
                                <option value="Dog">Dog</option>
                                <option value="Cat">Cat</option>
                                <option value="Bird">Bird</option>
                                <option value="Rabbit">Rabbit</option>
                                <option value="Reptile">Reptile</option>
                                <option value="Other">Other</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">Breed <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                        <input
                            type="text"
                            name="breed"
                            value={formData.breed}
                            onChange={handleInputChange}
                            className="w-full soft-input px-5 py-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-peach-200"
                            placeholder="e.g. Labrador"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">Color <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                        <input
                            type="text"
                            name="color"
                            value={formData.color}
                            onChange={handleInputChange}
                            className="w-full soft-input px-5 py-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-peach-200"
                            placeholder="e.g. Golden"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">Gender</label>
                        <div className="relative">
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleInputChange}
                                className="w-full soft-input px-5 py-4 font-bold text-slate-700 appearance-none bg-transparent"
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">Age (Years)</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-peach-300 w-5 h-5" />
                            <input
                                type="number"
                                name="ageYearsEntry"
                                value={formData.ageYearsEntry}
                                onChange={handleInputChange}
                                className="w-full soft-input pl-12 pr-4 py-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-peach-200"
                                min="0"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">Age (Months)</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-peach-300 w-5 h-5" />
                            <input
                                type="number"
                                name="ageMonthsEntry"
                                value={formData.ageMonthsEntry}
                                onChange={handleInputChange}
                                className="w-full soft-input pl-12 pr-4 py-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-peach-200"
                                min="0"
                                max="11"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">Weight (kg)</label>
                        <div className="relative">
                            <Weight className="absolute left-4 top-1/2 -translate-y-1/2 text-peach-300 w-5 h-5" />
                            <input
                                type="number" step="0.1"
                                name="weight"
                                value={formData.weight}
                                onChange={handleInputChange}
                                className="w-full soft-input pl-12 pr-4 py-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-peach-200"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 ml-1">Microchip ID <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                        <div className="relative">
                            <Info className="absolute left-4 top-1/2 -translate-y-1/2 text-peach-300 w-5 h-5" />
                            <input
                                type="text"
                                name="microchipId"
                                value={formData.microchipId}
                                onChange={handleInputChange}
                                className="w-full soft-input pl-12 pr-4 py-4 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-peach-200"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-[0.98]"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] bg-gradient-to-r from-peach-400 to-emerald-500 text-white shadow-lg shadow-peach-200 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isSaving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Register Patient')}
                    </button>
                </div>
            </form>
        </div>
    );
};




