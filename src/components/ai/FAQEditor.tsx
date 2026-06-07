import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, Check, X, BookOpen, Tag } from 'lucide-react';
import { FAQ, User as UserType } from '../../types';
import { api } from '../../services/apiService';
import { toast } from 'sonner';

interface FAQEditorProps {
    currentUser: UserType;
}

const FAQEditor: React.FC<FAQEditorProps> = ({ currentUser }) => {
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const [form, setForm] = useState<Partial<FAQ>>({
        question: '',
        answer: '',
        category: 'General',
        isActive: true,
        keywords: []
    });

    useEffect(() => {
        fetchFAQs();
    }, []);

    const fetchFAQs = async () => {
        try {
            const data = await api.aiClient.getFAQs();
            setFaqs(data);
        } catch (error) {
            console.error('Failed to fetch FAQs');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.question || !form.answer) return;

        try {
            if (editingId) {
                await api.aiClient.updateFAQ(editingId, form);
                toast.success("FAQ updated");
            } else {
                await api.aiClient.createFAQ(form);
                toast.success("FAQ added");
            }
            setIsAdding(false);
            setEditingId(null);
            setForm({ question: '', answer: '', category: 'General', isActive: true, keywords: [] });
            fetchFAQs();
        } catch (error) {
            toast.error("Failed to save FAQ");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this FAQ?')) return;
        try {
            await api.aiClient.deleteFAQ(id);
            toast.success("FAQ deleted");
            fetchFAQs();
        } catch (error) {
            toast.error("Failed to delete FAQ");
        }
    };

    const filteredFaqs = faqs.filter(f =>
        f.question.toLowerCase().includes(search.toLowerCase()) ||
        f.answer.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-slate-800">Knowledge Base</h2>
                    <p className="text-sm text-slate-500 font-medium">Manage the FAQs used by the AI Client Agent</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="soft-btn-primary px-4 py-2 flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Add New FAQ
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search knowledge base..."
                    className="w-full soft-input pl-12 py-3"
                />
            </div>

            {isAdding || editingId ? (
                <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-xl shadow-amber-50/50 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-black text-slate-800">{editingId ? 'Edit FAQ' : 'New FAQ'}</h3>
                        <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Question</label>
                            <input
                                value={form.question}
                                onChange={(e) => setForm({ ...form, question: e.target.value })}
                                className="w-full soft-input px-4 py-2 font-bold"
                                placeholder="e.g., What are your opening hours?"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Category</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full soft-input px-4 py-2 font-bold"
                            >
                                <option>General</option>
                                <option>Pricing</option>
                                <option>Appointments</option>
                                <option>Emergency</option>
                                <option>Medical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Status</label>
                            <div className="flex items-center gap-4 py-2">
                                <label className="flex items-center gap-2 font-bold text-sm">
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-300"
                                    />
                                    Active
                                </label>
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Answer</label>
                            <textarea
                                value={form.answer}
                                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                                className="w-full soft-input p-4 min-h-[120px] font-medium"
                                placeholder="Provide a detailed answer for the AI..."
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            onClick={() => { setIsAdding(false); setEditingId(null); }}
                            className="soft-btn px-6 py-2 font-black"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="soft-btn-primary px-6 py-2 shadow-lg shadow-amber-100"
                        >
                            <Check className="w-4 h-4 mr-2" /> Save Entry
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFaqs.map(faq => (
                    <div key={faq.id} className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-amber-200 transition-all hover:shadow-lg hover:shadow-amber-50/30 group">
                        <div className="flex justify-between items-start mb-3">
                            <span className="bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">
                                {faq.category}
                            </span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => { setEditingId(faq.id); setForm(faq); }}
                                    className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(faq.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <h4 className="font-black text-slate-800 mb-2 leading-tight">{faq.question}</h4>
                        <p className="text-sm text-slate-500 font-medium line-clamp-3">{faq.answer}</p>
                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Tag className="w-3 h-3" /> {faq.keywords.length} Keywords
                            <span className="ml-auto flex items-center gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${faq.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                {faq.isActive ? 'Active' : 'Disabled'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FAQEditor;
