import React, { useState } from 'react';
import { Plus, Search, Trash2, Calendar, CreditCard, Filter, X, ChevronRight, Receipt } from 'lucide-react';
import { Expense, ClinicSettings, User } from '../../types';

interface ExpensesProps {
    expenses: Expense[];
    settings: ClinicSettings;
    currentUser: User | null;
    onAddExpense: () => void;
    onDeleteExpense: (id: string) => void;
}

export const Expenses: React.FC<ExpensesProps> = ({
    expenses,
    settings,
    currentUser,
    onAddExpense,
    onDeleteExpense
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

    const isAdmin = currentUser?.roles.includes('Admin') || currentUser?.isSuperAdmin;

    const filteredExpenses = expenses.filter(e => {
        const matchesSearch = !searchTerm ||
            e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.purpose.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDate = !filterDate || e.date.startsWith(filterDate);

        return matchesSearch && matchesDate;
    });

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this expense?')) {
            onDeleteExpense(id);
            if (selectedExpense?.id === id) setSelectedExpense(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">Expenses</h1>
                    <p className="text-slate-400 text-sm font-medium mt-1">Track clinic spending and overheads</p>
                </div>
                <button
                    onClick={onAddExpense}
                    className="w-full sm:w-auto soft-btn-primary px-6 py-3 flex items-center justify-center gap-2 group"
                >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    Record Expense
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-peach-50 flex items-center justify-center text-peach-600">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
                        <p className="text-xl font-black text-slate-800">{settings.currencySymbol}{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Count</p>
                        <p className="text-xl font-black text-slate-800">{filteredExpenses.length} Records</p>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by vendor or purpose..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full soft-input py-3 pl-11 pr-10 text-sm"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="month"
                        value={filterDate.substring(0, 7)}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="w-full lg:w-48 soft-input py-3 pl-11 pr-4 text-sm"
                    />
                </div>
            </div>

            {/* Expenses List/Table */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                    {/* PC Header */}
                    <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wider">
                        <div className="col-span-3">Date & Vendor</div>
                        <div className="col-span-5">Purpose</div>
                        <div className="col-span-2 text-right">Amount</div>
                        <div className="col-span-2 text-right">Actions</div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                        {filteredExpenses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <CreditCard className="w-16 h-16 opacity-10 mb-4" />
                                <p className="font-bold">No expenses found</p>
                                <p className="text-xs">Try adjusting your filters or record a new expense</p>
                            </div>
                        ) : (
                            filteredExpenses.map((expense) => (
                                <div
                                    key={expense.id}
                                    className="group grid grid-cols-1 sm:grid-cols-12 gap-4 px-4 sm:px-6 py-4 items-center hover:bg-slate-50 transition-all cursor-pointer"
                                    onClick={() => setSelectedExpense(expense)}
                                >
                                    <div className="sm:col-span-3 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                                                {new Date(expense.date).toLocaleDateString()}
                                            </p>
                                            <p className="font-bold text-slate-900 truncate">
                                                {expense.name}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="sm:col-span-5">
                                        <p className="text-sm text-slate-600 line-clamp-1 sm:line-clamp-2">
                                            {expense.purpose}
                                        </p>
                                    </div>

                                    <div className="sm:col-span-2 text-left sm:text-right">
                                        <p className="font-black text-slate-900">
                                            {settings.currencySymbol}{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>

                                    <div className="sm:col-span-2 flex justify-end gap-2">
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => handleDelete(expense.id, e)}
                                                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                title="Delete Expense"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-peach-400 transition-colors" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Expense Detail Modal (Mobile Friendly) */}
            {selectedExpense && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setSelectedExpense(null)}
                    />
                    <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex justify-between items-start">
                                <div className="p-3 bg-peach-50 rounded-2xl text-peach-600">
                                    <CreditCard className="w-8 h-8" />
                                </div>
                                <button
                                    onClick={() => setSelectedExpense(null)}
                                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div>
                                <h3 className="text-2xl font-black text-slate-900 font-display">{selectedExpense.name}</h3>
                                <p className="text-slate-500 font-medium">{new Date(selectedExpense.date).toLocaleDateString(undefined, { dateStyle: 'full' })}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-2xl">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount Paid</p>
                                    <p className="text-xl font-black text-slate-900">{settings.currencySymbol}{selectedExpense.amount.toLocaleString()}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <p className="text-lg font-bold text-slate-700">Completed</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose & Description</p>
                                <div className="bg-slate-50 p-4 rounded-2xl text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                                    {selectedExpense.purpose}
                                </div>
                            </div>

                            {isAdmin && (
                                <button
                                    onClick={(e) => handleDelete(selectedExpense.id, e)}
                                    className="w-full soft-btn py-4 text-rose-600 hover:bg-rose-50 border-rose-100 font-bold flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-5 h-5" />
                                    Delete This Record
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
