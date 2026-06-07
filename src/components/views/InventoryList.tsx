import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus, Search, Filter, Box, X, Calendar, Edit2, Trash2, History, ChevronRight, AlertTriangle, List, LayoutGrid, Zap, Shield, Settings, Loader2 } from 'lucide-react';
import { InventoryItem, StockBatch, InventoryReconciliation, ClinicSettings } from '../../types';
import { api, API_URL } from '../../services/apiService';

interface InventoryListProps {
    items: InventoryItem[];
    settings: ClinicSettings;
    onAddItem: () => void;
    onUpdateItem: (updatedItem: InventoryItem) => void;
    onDeleteItem: (id: string) => void;
    onEditItem: (item: InventoryItem) => void;
    totalLowStock?: number;
    onSearch?: (term: string) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
}

export const InventoryList: React.FC<InventoryListProps> = ({ items, settings, onAddItem, onUpdateItem, onDeleteItem, onEditItem, totalLowStock, onSearch, onLoadMore, hasMore }) => {
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLowStock, setFilterLowStock] = useState(false);

    // Debounced Search
    useEffect(() => {
        if (onSearch) {
            const timer = setTimeout(() => {
                onSearch(searchTerm);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [searchTerm, onSearch]);

    // Smart Filtering Logic (Fuzzy-ish)
    const filteredItems = useMemo(() => {
        let result = items;

        // Only apply client-side search if no server-side search handler is provided
        if (!onSearch) {
            result = items.filter(i => {
                const searchLower = searchTerm.toLowerCase();
                return !searchTerm ||
                    i.name.toLowerCase().includes(searchLower) ||
                    i.sku.toLowerCase().includes(searchLower) ||
                    i.category.toLowerCase().includes(searchLower) ||
                    (i.description && i.description.toLowerCase().includes(searchLower)) ||
                    (i.manufacturer && i.manufacturer.toLowerCase().includes(searchLower));
            });
        }

        if (filterLowStock) {
            result = result.filter(i => i.quantity <= i.minThreshold);
        }

        return result;
    }, [items, searchTerm, filterLowStock, onSearch]);

    const lowStockCount = totalLowStock ?? items.filter(i => i.quantity <= i.minThreshold).length;

    return (
        <div className="space-y-8 animate-fade-in pb-32">
            <div className="flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-center">
                <div className="w-full lg:w-auto">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-[#FFFBEB] flex items-center justify-center text-[#14B8A6] border border-[#14B8A6]/20 shadow-inner">
                            <Box className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Inventory</h1>
                            <p className="text-sm text-slate-500 font-semibold">Manage your stock and supplies.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {lowStockCount > 0 && (
                            <button
                                onClick={() => setFilterLowStock(!filterLowStock)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${filterLowStock ? 'bg-rose-500 text-white shadow-lg shadow-rose-200 border-transparent' : 'bg-white/40 backdrop-blur-md text-rose-500 border-rose-100 hover:bg-rose-50'}`}
                            >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {lowStockCount} Low stock items
                            </button>
                        )}
                        <div className="px-4 py-2 rounded-xl bg-white/40 backdrop-blur-md border border-slate-100 text-xs font-bold text-slate-500">
                            {items.length} items
                        </div>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="flex bg-white/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/60 shadow-xl ring-1 ring-white/20 w-full md:w-auto">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex-1 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all ${viewMode === 'table' ? 'bg-[#14B8A6] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <List className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`flex-1 md:w-12 md:h-12 flex items-center justify-center rounded-xl transition-all ${viewMode === 'grid' ? 'bg-[#14B8A6] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="relative w-full lg:w-72">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors w-4.5 h-4.5 ${searchTerm ? 'text-[#14B8A6]' : 'text-slate-400'}`} />
                        <input
                            type="text"
                            placeholder="Search items"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl py-4 pl-12 pr-12 text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6]/40 outline-none transition-all shadow-xl ring-1 ring-white/20"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[#14B8A6] transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={onAddItem}
                            className="flex-1 md:flex-none btn-luminous btn-luminous-emerald text-[10px] uppercase tracking-widest px-8"
                        >
                            <Plus className="w-4 h-4" /> Add item
                        </button>
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: { view: 'AI_HUB', tab: 'OPERATIONS' } }))}
                            className="flex-1 md:flex-none btn-luminous btn-luminous-emerald text-[10px] uppercase tracking-widest px-8"
                        >
                            <Zap className="w-4 h-4" /> AI help
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full">
                {viewMode === 'table' ? (
                    <div className="glass-card overflow-hidden ring-1 ring-white/20">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse hidden md:table">
                                <thead className="bg-white/40 border-b border-white/60">
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        <th className="px-8 py-6">Product & Identity</th>
                                        <th className="px-8 py-6">Classification</th>
                                        <th className="px-8 py-6">Stock Status</th>
                                        <th className="px-8 py-6">Valuation</th>
                                        <th className="px-8 py-6 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/20">
                                    {filteredItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            onClick={() => onEditItem(item)}
                                            className="group hover:bg-white/40 transition-all cursor-pointer active:scale-[0.998]"
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    {item.imageUrl ? (
                                                        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/60 shadow-inner bg-white/60 flex-shrink-0">
                                                            <img src={item.imageUrl.startsWith('/') ? `${API_URL}${item.imageUrl}` : item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-2xl bg-[#FFFBEB] flex items-center justify-center text-[#14B8A6] border border-[#14B8A6]/20 flex-shrink-0 shadow-inner">
                                                            <Box className="w-7 h-7" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-black text-slate-800 text-sm uppercase tracking-tighter">{item.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">{item.sku}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-500 uppercase tracking-widest w-fit">
                                                        {item.category}
                                                    </span>
                                                    {item.isControlled && (
                                                        <span className="px-3 py-1 rounded-lg text-[9px] font-black bg-rose-50 text-rose-500 uppercase flex items-center gap-1.5 w-fit border border-rose-100 shadow-sm shadow-rose-50">
                                                            <Shield className="w-3 h-3" /> Narcotics Lock
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${item.quantity <= item.minThreshold ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                                    <div className="flex flex-col">
                                                        <span className={`font-black text-base leading-none ${item.quantity <= item.minThreshold ? 'text-rose-600' : 'text-slate-800'}`}>
                                                            {item.quantity}
                                                        </span>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Available Qty</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 text-sm">{settings.currencySymbol}{item.retailPrice.toLocaleString()}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Unit Price</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="w-10 h-10 rounded-xl bg-white/40 flex items-center justify-center text-slate-300 group-hover:text-[#14B8A6] group-hover:bg-white transition-all shadow-sm ml-auto">
                                                    <Edit2 className="w-5 h-5" />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredItems.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-24 text-slate-400">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Box className="w-12 h-12 opacity-10" />
                                                    <p className="font-black text-[10px] uppercase tracking-[0.3em]">No Assets Found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile card list - visible only on small screens in list mode */}
                        <div className="md:hidden divide-y divide-white/20">
                            {filteredItems.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => onEditItem(item)}
                                    className="flex items-center gap-3 p-4 hover:bg-white/40 transition-all cursor-pointer active:scale-[0.98]"
                                >
                                    {item.imageUrl ? (
                                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/60 shadow-inner bg-white/60 flex-shrink-0">
                                            <img src={item.imageUrl.startsWith('/') ? `${API_URL}${item.imageUrl}` : item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl bg-[#FFFBEB] flex items-center justify-center text-[#14B8A6] border border-[#14B8A6]/20 flex-shrink-0 shadow-inner">
                                            <Box className="w-6 h-6" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-slate-800 text-xs uppercase tracking-tighter truncate">{item.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-500 uppercase tracking-widest">{item.category}</span>
                                            {item.isControlled && (
                                                <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-50 text-rose-500 uppercase flex items-center gap-1">
                                                    <Shield className="w-2.5 h-2.5" /> Ctrl
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-right">
                                            <div className={`font-black text-sm ${item.quantity <= item.minThreshold ? 'text-rose-600' : 'text-slate-800'}`}>
                                                {item.quantity}
                                            </div>
                                            <div className="text-[8px] font-black text-slate-400 uppercase">Qty</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-sm text-[#14B8A6]">{settings.currencySymbol}{item.retailPrice.toLocaleString()}</div>
                                            <div className="text-[8px] font-black text-slate-400 uppercase">Price</div>
                                        </div>
                                        <Edit2 className="w-4 h-4 text-slate-300" />
                                    </div>
                                </div>
                            ))}
                            {filteredItems.length === 0 && (
                                <div className="py-16 text-center">
                                    <Box className="w-10 h-10 mx-auto opacity-10 mb-3" />
                                    <p className="font-black text-[10px] text-slate-400 uppercase tracking-[0.3em]">No Assets Found</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {filteredItems.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => onEditItem(item)}
                                className="glass-card p-0 overflow-hidden flex flex-col group cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all relative"
                            >
                                <div className="aspect-square relative flex items-center justify-center bg-white/60 border-b border-white/60">
                                    <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-[#14B8A6] shadow-xl">
                                            <Edit2 className="w-5 h-5" />
                                        </div>
                                    </div>
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl.startsWith('/') ? `${API_URL}${item.imageUrl}` : item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Box className="w-16 h-16 text-[#14B8A6] opacity-20" />
                                    )}
                                    <div className="absolute top-3 right-3">
                                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase shadow-lg ${item.quantity <= item.minThreshold ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                            {item.quantity} Qty
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 bg-white/40">
                                    <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-tighter line-clamp-1">{item.name}</h3>
                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/60">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.category}</span>
                                        <span className="text-sm font-black text-[#14B8A6]">{settings.currencySymbol}{item.retailPrice.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {hasMore && (
                    <div className="mt-12 flex justify-center">
                        <button
                            onClick={onLoadMore}
                            className="btn-luminous btn-luminous-neutral text-[10px] uppercase tracking-widest px-12 py-4"
                        >
                            Load More Items
                        </button>
                    </div>
                )}
            </div>

        </div>
    );
};

