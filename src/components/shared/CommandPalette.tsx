import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Users, PawPrint, Package, ArrowRight, Command } from 'lucide-react';
import { api, API_URL } from '../../services/apiService';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: any, id?: string) => void;
}

type SearchResultItem = {
    id: string;
    type: 'client' | 'patient' | 'inventory';
    [key: string]: any;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{ clients: any[], patients: any[], inventory: any[] }>({ clients: [], patients: [], inventory: [] });
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults({ clients: [], patients: [], inventory: [] });
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleSearch = async () => {
            if (!query.trim()) {
                setResults({ clients: [], patients: [], inventory: [] });
                return;
            }

            setLoading(true);
            try {
                const data = await api.search.query(query);
                setResults(data);
                setSelectedIndex(0);
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(handleSearch, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const flatResults: SearchResultItem[] = [
        ...results.clients.map((client) => ({ ...client, type: 'client' as const })),
        ...results.patients.map((patient) => ({ ...patient, type: 'patient' as const })),
        ...results.inventory.map((item) => ({ ...item, type: 'inventory' as const })),
    ];

    const getResultKey = (item: SearchResultItem) => `${item.type}:${item.id}`;
    const selectedItem = flatResults[selectedIndex];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % (flatResults.length || 1));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + (flatResults.length || 1)) % (flatResults.length || 1));
            }
            if (e.key === 'Enter' && flatResults[selectedIndex]) {
                handleSelect(flatResults[selectedIndex]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [flatResults, isOpen, onClose, selectedIndex]);

    const handleSelect = (item: SearchResultItem) => {
        if (item.type === 'client') onNavigate('CLIENT_DETAILS', item.id);
        if (item.type === 'patient') onNavigate('PATIENT_DETAILS', item.id);
        if (item.type === 'inventory') onNavigate('INVENTORY', item.id);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 sm:px-0">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-fade-in"
                onClick={onClose}
            />

            <div className="relative w-full max-w-2xl bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-white/50 overflow-hidden animate-fade-in-up ring-1 ring-slate-900/5">
                <div className="relative border-b border-slate-100 p-4">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search for anything... (clients, pets, items)"
                        className="w-full bg-transparent pl-12 pr-10 py-3 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none text-lg"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            className="absolute right-6 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {!query && (
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <Command className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-slate-600 font-bold mb-1">Search</h3>
                            <p className="text-slate-400 text-sm">Find clients, patients, and items quickly.</p>
                        </div>
                    )}

                    {query && flatResults.length === 0 && !loading && (
                        <div className="p-12 text-center text-slate-400">
                            No results found for "<span className="text-slate-600 font-bold">{query}</span>"
                        </div>
                    )}

                    {loading && (
                        <div className="p-8 flex items-center justify-center gap-3 text-slate-400">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-b-amber-500" />
                            <span className="text-sm font-medium">Searching clinic database...</span>
                        </div>
                    )}

                    {!loading && results.clients.length > 0 && (
                        <div className="mb-4">
                            <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Users className="w-3 h-3" /> Clients
                            </div>
                            {results.clients.map((client) => {
                                const isSelected = selectedItem ? getResultKey(selectedItem) === `client:${client.id}` : false;
                                return (
                                    <div
                                        key={client.id}
                                        onClick={() => handleSelect({ ...client, type: 'client' })}
                                        className={`px-4 py-3 mx-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-300 ease-out ${isSelected ? 'bg-amber-500 text-white shadow-xl shadow-amber-200 scale-[1.02]' : 'hover:bg-slate-50 hover:translate-x-1'}`}
                                        onMouseEnter={() => setSelectedIndex(flatResults.findIndex((item) => getResultKey(item) === `client:${client.id}`))}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${isSelected ? 'bg-white/20' : 'bg-rose-50 text-rose-500'}`}>
                                                {client.firstName[0]}{client.lastName[0]}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{client.firstName} {client.lastName}</div>
                                                <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>{client.phone}</div>
                                            </div>
                                        </div>
                                        {isSelected && <ArrowRight className="w-4 h-4" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!loading && results.patients.length > 0 && (
                        <div className="mb-4">
                            <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <PawPrint className="w-3 h-3" /> Patients
                            </div>
                            {results.patients.map((pet) => {
                                const isSelected = selectedItem ? getResultKey(selectedItem) === `patient:${pet.id}` : false;
                                return (
                                    <div
                                        key={pet.id}
                                        onClick={() => handleSelect({ ...pet, type: 'patient' })}
                                        className={`px-4 py-3 mx-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-300 ease-out ${isSelected ? 'bg-peach-500 text-white shadow-xl shadow-peach-200 scale-[1.02]' : 'hover:bg-slate-50 hover:translate-x-1'}`}
                                        onMouseEnter={() => setSelectedIndex(flatResults.findIndex((item) => getResultKey(item) === `patient:${pet.id}`))}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${isSelected ? 'bg-white/20' : 'bg-peach-50 text-peach-600'}`}>
                                                <PawPrint className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{pet.name}</div>
                                                <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>{pet.species} - {pet.breed || 'Mixed'}</div>
                                            </div>
                                        </div>
                                        {isSelected && <ArrowRight className="w-4 h-4" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!loading && results.inventory.length > 0 && (
                        <div className="mb-4">
                            <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Package className="w-3 h-3" /> Inventory
                            </div>
                            {results.inventory.map((item) => {
                                const isSelected = selectedItem ? getResultKey(selectedItem) === `inventory:${item.id}` : false;
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleSelect({ ...item, type: 'inventory' })}
                                        className={`px-4 py-3 mx-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-300 ease-out ${isSelected ? 'bg-amber-500 text-white shadow-xl shadow-amber-200 scale-[1.02]' : 'hover:bg-slate-50 hover:translate-x-1'}`}
                                        onMouseEnter={() => setSelectedIndex(flatResults.findIndex((result) => getResultKey(result) === `inventory:${item.id}`))}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-amber-50 text-amber-600'}`}>
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl.startsWith('/') ? `${API_URL}${item.imageUrl}` : item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package className="w-5 h-5" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{item.name}</div>
                                                <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>Qty: {item.quantity} - SKU: {item.sku}</div>
                                            </div>
                                        </div>
                                        {isSelected && <ArrowRight className="w-4 h-4" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-black text-slate-400 shadow-sm">Enter</kbd>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">to select</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-black text-slate-400 shadow-sm">UP/DN</kbd>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">to navigate</span>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Search clinic records</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
