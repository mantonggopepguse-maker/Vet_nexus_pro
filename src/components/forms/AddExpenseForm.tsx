import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import { ClinicSettings, Expense } from '../../types';

interface AddExpenseFormProps {
    onBack: () => void;
    onSave: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'clinicId'>) => void;
    settings: ClinicSettings;
    isSaving?: boolean;
}

export const AddExpenseForm: React.FC<AddExpenseFormProps> = ({ onBack, onSave, settings, isSaving = false }) => {
    const [formData, setFormData] = useState({
        name: '',
        amount: '' as string | number,
        purpose: '',
        date: new Date().toISOString().split('T')[0],
    });

    const [error, setError] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.name || !formData.amount || !formData.purpose) {
            setError('Please fill in all required fields');
            return;
        }

        const amount = parseFloat(formData.amount.toString());
        if (isNaN(amount) || amount < 0) {
            setError('Please enter a valid amount');
            return;
        }

        onSave({
            name: formData.name,
            amount: amount,
            purpose: formData.purpose,
            date: formData.date,
            status: 'Completed'
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-4 px-4 sm:py-8 sm:px-6">
            <div className="flex items-center gap-4 mb-6 sm:mb-8">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">Record New Expense</h1>
                    <p className="text-sm sm:text-base text-slate-500">Log a business expense for your clinic</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="soft-card overflow-hidden p-6 sm:p-8 space-y-6 sm:space-y-8">
                {error && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 sm:gap-8">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Expense Name / Vendor*</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="e.g., Rent, Electricity, Medical Supplies"
                            className="w-full soft-input font-bold"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Amount ({settings.currencySymbol})*</label>
                            <input
                                type="number"
                                name="amount"
                                value={formData.amount}
                                onChange={handleInputChange}
                                step="0.01"
                                placeholder="0.00"
                                className="w-full soft-input font-bold"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Date*</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleInputChange}
                                className="w-full soft-input font-bold"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Purpose / Description*</label>
                        <textarea
                            name="purpose"
                            value={formData.purpose}
                            onChange={handleInputChange}
                            placeholder="What was this expense for?"
                            rows={4}
                            className="w-full soft-input font-medium resize-none"
                            required
                        />
                    </div>
                </div>

                <div className="pt-4 flex flex-col-reverse sm:flex-row items-center gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full sm:w-auto flex-1 bg-peach-600 hover:bg-peach-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-peach-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Saving Expense...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Expense
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
