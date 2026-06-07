import React, { useState } from 'react';
import { ChevronRight, Mail, Phone, Plus, Search, User } from 'lucide-react';
import { Client } from '../../types';

interface ClientListProps {
    clients: Client[];
    onAddClient: () => void;
    onViewClient: (id: string) => void;
}

export const ClientList: React.FC<ClientListProps> = ({ clients, onAddClient, onViewClient }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredClients = clients.filter((client) =>
        client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone.includes(searchTerm) ||
        (client.clientCode && client.clientCode.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="client-page-shell">
            <div className="client-panel p-6 md:p-8">
                <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                                <User className="w-5 h-5" />
                            </div>
                            <span className="client-badge">{clients.length} clients</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">Clients</h1>
                        <p className="text-slate-500 mt-2">Find a client, open their profile, or add a new one.</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
                        <div className="relative w-full lg:w-80">
                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${searchTerm ? 'text-teal-600' : 'text-slate-400'}`} />
                            <input
                                type="text"
                                placeholder="Search by name, phone, or code"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-all focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-50"
                            />
                        </div>
                        <button
                            onClick={onAddClient}
                            className="w-full md:w-auto px-5 py-3.5 rounded-2xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add client
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredClients.map((client) => (
                    <div
                        key={client.id}
                        onClick={() => onViewClient(client.id)}
                        className="client-list-card flex flex-col md:flex-row md:items-center justify-between gap-5"
                    >
                        <div className="flex items-start gap-4 min-w-0">
                            <div className="w-14 h-14 rounded-[1.2rem] bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center font-bold text-lg shrink-0">
                                {client.firstName[0]}{client.lastName[0]}
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-bold text-slate-800 truncate">{client.firstName} {client.lastName}</h3>
                                    {client.clientCode && <span className="client-badge">{client.clientCode}</span>}
                                    {client.tags?.slice(0, 2).map((tag) => (
                                        <span key={tag} className="client-badge bg-teal-50 text-teal-700 border-teal-100">{tag}</span>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 mt-3">
                                    <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-teal-500" /> {client.phone}</span>
                                    <span className="flex items-center gap-2 truncate"><Mail className="w-4 h-4 text-teal-500" /> {client.email || 'No email added'}</span>
                                </div>
                                <p className="text-sm text-slate-400 mt-3 truncate">{client.address || 'No address added yet'}</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                            <div className="text-sm text-slate-400">{client.patients?.length || 0} pets</div>
                            <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                ))}

                {filteredClients.length === 0 && (
                    <div className="client-panel p-16 text-center flex flex-col items-center gap-4">
                        <div className="w-20 h-20 rounded-[1.8rem] bg-slate-50 border border-slate-200 flex items-center justify-center">
                            <User className="w-9 h-9 text-slate-300" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">No clients found</h3>
                            <p className="text-slate-500 mt-2">Try a different search or add a new client.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
