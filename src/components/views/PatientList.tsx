import React, { useState } from 'react';
import { ChevronRight, PawPrint, Plus, Search, User } from 'lucide-react';
import { Client, Pet } from '../../types';

interface PatientListProps {
    patients: Pet[];
    clients: Client[];
    onAddPatient: () => void;
    onViewPatient: (id: string) => void;
}

const getOwnerName = (pet: Pet, clients: Client[]) => {
    if (pet.owner) return `${pet.owner.firstName} ${pet.owner.lastName}`;
    const client = clients.find((c) => c.id === pet.ownerId);
    return client ? `${client.firstName} ${client.lastName}` : 'No owner linked';
};

const getPetToneClass = (breed?: string, species?: string) => {
    const value = `${breed || ''} ${species || ''}`.toLowerCase();
    if (/(cat|persian|siamese|maine coon)/.test(value)) return 'bg-rose-50 text-rose-500 border-rose-100';
    if (/(parrot|bird|canary)/.test(value)) return 'bg-amber-50 text-amber-500 border-amber-100';
    if (/(shepherd|husky|retriever|labrador|dog)/.test(value)) return 'bg-teal-50 text-teal-600 border-teal-100';
    return 'bg-sky-50 text-sky-600 border-sky-100';
};

export const PatientList: React.FC<PatientListProps> = ({ patients, clients, onAddPatient, onViewPatient }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPatients = patients.filter((pet) =>
        pet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pet.breed || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        pet.species.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="client-page-shell">
            <div className="client-panel p-6 md:p-8">
                <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                                <PawPrint className="w-5 h-5" />
                            </div>
                            <span className="client-badge">{patients.length} patients</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">Patients</h1>
                        <p className="text-slate-500 mt-2">View pets, open profiles, and add a new patient.</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
                        <div className="relative w-full lg:w-80">
                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${searchTerm ? 'text-teal-600' : 'text-slate-400'}`} />
                            <input
                                type="text"
                                placeholder="Search by pet name, species, or breed"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-all focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-50"
                            />
                        </div>
                        <button
                            onClick={onAddPatient}
                            className="w-full md:w-auto px-5 py-3.5 rounded-2xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add patient
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredPatients.map((pet) => (
                    <div
                        key={pet.id}
                        onClick={() => onViewPatient(pet.id)}
                        className="client-list-card flex flex-col md:flex-row md:items-center justify-between gap-5"
                    >
                        <div className="flex items-start gap-4 min-w-0">
                            <div className={`w-14 h-14 rounded-[1.2rem] border flex items-center justify-center shrink-0 ${getPetToneClass(pet.breed, pet.species)}`}>
                                <PawPrint className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-bold text-slate-800 truncate">{pet.name}</h3>
                                    <span className="client-badge">{pet.species}</span>
                                    {pet.breed && <span className="client-badge">{pet.breed}</span>}
                                </div>
                                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 mt-3">
                                    <span>{pet.gender}</span>
                                    <span>{pet.age} years</span>
                                    <span>{pet.weight} kg</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-400 mt-3">
                                    <User className="w-4 h-4 text-teal-500" />
                                    <span>{getOwnerName(pet, clients)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                            <div className="text-sm text-slate-400">{pet.status || 'Active'}</div>
                            <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                ))}

                {filteredPatients.length === 0 && (
                    <div className="client-panel p-16 text-center flex flex-col items-center gap-4">
                        <div className="w-20 h-20 rounded-[1.8rem] bg-slate-50 border border-slate-200 flex items-center justify-center">
                            <PawPrint className="w-9 h-9 text-slate-300" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">No patients found</h3>
                            <p className="text-slate-500 mt-2">Try another search or add a new patient.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
