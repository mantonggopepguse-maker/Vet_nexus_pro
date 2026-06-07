import React, { useState } from 'react';
import {
    Plus,
    Trash2,
    Printer,
    FileText,
    ArrowLeft,
    Save,
    Calendar,
    User,
    CreditCard,
    FileSpreadsheet,
    Download
} from 'lucide-react';
import { toast } from 'sonner';
import { ClinicSettings, User as UserType } from '../../types';
import { api } from '../../services/apiService';

interface FreeInvoiceProps {
    settings: ClinicSettings;
    user: UserType | null;
}

interface InvoiceItem {
    id: string;
    description: string;
    qty: number;
    unitPrice: number;
}

export const FreeInvoice: React.FC<FreeInvoiceProps> = ({ settings, user }) => {
    const [invoiceType, setInvoiceType] = useState<'INVOICE' | 'RECEIPT'>('INVOICE');
    const [clientName, setClientName] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<InvoiceItem[]>([
        { id: Math.random().toString(36).substr(2, 9), description: '', qty: 1, unitPrice: 0 }
    ]);
    const [discount, setDiscount] = useState(0);
    const [amountPaid, setAmountPaid] = useState(0);
    const [saleBy, setSaleBy] = useState(user?.name || '');
    const [showPreview, setShowPreview] = useState(false);

    // Load from localStorage on mount
    React.useEffect(() => {
        if (!user) return;
        const draftKey = `vet_nexus_free_invoice_draft_${user.clinicId}_${user.id}`;
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                setInvoiceType(draft.invoiceType || 'INVOICE');
                setClientName(draft.clientName || '');
                setInvoiceNumber(draft.invoiceNumber || '');
                setDate(draft.date || new Date().toISOString().split('T')[0]);
                setItems(draft.items || [{ id: Math.random().toString(36).substr(2, 9), description: '', qty: 1, unitPrice: 0 }]);
                setDiscount(draft.discount || 0);
                setAmountPaid(draft.amountPaid || 0);
                if (draft.saleBy) setSaleBy(draft.saleBy);
            } catch (e) {
                console.error("Failed to parse saved draft", e);
            }
        }
    }, []);

    // Save to localStorage on change
    React.useEffect(() => {
        if (!user) return;
        const draftKey = `vet_nexus_free_invoice_draft_${user.clinicId}_${user.id}`;
        const draft = {
            invoiceType,
            clientName,
            invoiceNumber,
            date,
            items,
            discount,
            amountPaid,
            saleBy
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
    }, [invoiceType, clientName, invoiceNumber, date, items, discount, amountPaid, saleBy, user]);

    const addItem = () => {
        setItems([...items, { id: Math.random().toString(36).substr(2, 9), description: '', qty: 1, unitPrice: 0 }]);
    };

    const removeItem = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
    const total = Math.max(0, subtotal - discount);
    const balanceDue = Math.max(0, total - amountPaid);

    const [isSaving, setIsSaving] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleSave = async () => {
        if (!clientName.trim()) {
            toast.error('Please enter a client name before saving.');
            return;
        }

        setIsSaving(true);
        try {
            await api.sales.create({
                type: invoiceType,
                clientName,
                invoiceNumber,
                amountPaid,
                balanceDue,
                issuerName: saleBy,
                subtotal,
                discount,
                total,
                items: items.map(item => ({
                    description: item.description,
                    quantity: item.qty,
                    pricePerUnit: item.unitPrice
                }))
            });
            toast.success(`${invoiceType} saved successfully to history!`);
            setShowPreview(false);
        } catch (error: any) {
            toast.error(error?.data?.details || error?.message || 'Failed to save to history');
        } finally {
            setIsSaving(false);
        }
    };

    const StatusBadge = () => {
        const isPaid = balanceDue <= 0 && total > 0;
        return (
            <div className={`mt-4 text-right ${isPaid ? 'text-emerald-500' : 'text-rose-500'} font-bold text-lg uppercase tracking-wider`}>
                {isPaid ? 'Paid' : 'Unpaid'}
            </div>
        );
    };

    if (showPreview) {
        return (
            <>
                {/* Non-printable controls */}
                <div className="min-h-screen bg-slate-100 p-4 md:p-8 no-print">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Preview Actions */}
                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <button
                                onClick={() => setShowPreview(false)}
                                className="flex items-center gap-2 text-slate-600 font-bold hover:text-amber-600 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" /> Back to Edit
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save to History'}
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all"
                                >
                                    <Printer className="w-4 h-4" /> Print
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="bg-white text-slate-700 border border-slate-200 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all"
                                >
                                    <Download className="w-4 h-4" /> Download PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Printable Paper Preview */}
                <div className="printable-area bg-white p-12 md:p-20 shadow-2xl rounded-sm min-h-[1123px] relative print:p-10 print:shadow-none print:rounded-none max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-16">
                        <h1 className="text-4xl font-black text-emerald-800 tracking-tight mb-2">{settings.name || 'Vet Nexus'}</h1>
                        <p className="text-slate-500 font-medium">{settings.address || 'Address not set'}</p>
                        <p className="text-slate-500 font-medium">{settings.email} | {settings.phone}</p>
                    </div>

                    {/* Billed To / Type */}
                    <div className="flex justify-between items-start mb-16">
                        <div>
                            <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2">BILLED TO</h3>
                            <p className="text-xl font-black text-slate-800">{clientName || 'Valued Client'}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-4xl font-black text-emerald-700 tracking-tight italic mb-2">{invoiceType}</h2>
                            <p className="text-sm font-bold text-slate-700">Number #: {invoiceNumber || '---'}</p>
                            <p className="text-sm font-bold text-slate-700">Date: {new Date(date).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-12">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="py-4 text-left text-sm font-bold text-emerald-600">Item / Service</th>
                                    <th className="py-4 text-center text-sm font-bold text-emerald-600">Qty</th>
                                    <th className="py-4 text-right text-sm font-bold text-emerald-600">Unit Price</th>
                                    <th className="py-4 text-right text-sm font-bold text-emerald-600">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td className="py-4 font-bold text-slate-700">{item.description || 'New Service'}</td>
                                        <td className="py-4 text-center text-slate-600 font-medium">{item.qty}</td>
                                        <td className="py-4 text-right text-slate-600 font-medium">{settings.currencySymbol}{item.unitPrice.toLocaleString()}</td>
                                        <td className="py-4 text-right font-black text-slate-800">{settings.currencySymbol}{(item.qty * item.unitPrice).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Section */}
                    <div className="mt-auto grid grid-cols-2 gap-12 pt-12 border-t border-slate-100">
                        <div className="space-y-6 text-left">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Sale by: <span className="text-slate-700 font-bold">{saleBy}</span></p>
                            </div>

                            {invoiceType === 'INVOICE' && (
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Details</h4>
                                    <div className="text-sm font-bold text-slate-600 space-y-1">
                                        <p><span className="text-slate-400">Bank:</span> {settings.bankName || '---'}</p>
                                        <p><span className="text-slate-400">Account Name:</span> {settings.accountName || '---'}</p>
                                        <p><span className="text-slate-400">Account Number:</span> {settings.accountNumber || '---'}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-slate-500 font-bold">
                                <span>Subtotal:</span>
                                <span>{settings.currencySymbol}{subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-500 font-bold">
                                <span>Discount:</span>
                                <span>-{settings.currencySymbol}{discount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-900 border-t border-slate-200 pt-2 pb-4">
                                <span className="text-xl font-black">Total:</span>
                                <span className="text-2xl font-black">{settings.currencySymbol}{total.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center text-slate-700 font-bold">
                                <span>{invoiceType === 'RECEIPT' ? 'Total Paid' : 'Amount Paid'}:</span>
                                <span>{settings.currencySymbol}{amountPaid.toLocaleString()}</span>
                            </div>

                            {invoiceType === 'INVOICE' && (
                                <div className="flex justify-between items-center text-emerald-700 font-black text-xl pt-4">
                                    <span>Balance Due:</span>
                                    <span>{settings.currencySymbol}{balanceDue.toLocaleString()}</span>
                                </div>
                            )}

                            <StatusBadge />
                        </div>
                    </div>

                    <div className="absolute bottom-20 left-0 right-0 text-center">
                        <p className="text-slate-400 font-bold italic">Thank you for your business!</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Free Style Invoice</h1>
                    <p className="text-slate-500 font-medium">Create custom invoices and receipts manually</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowPreview(true)}
                        className="soft-btn-primary px-8 py-3 flex items-center gap-2"
                    >
                        <FileText className="w-5 h-5" /> Preview & Print
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Items Section */}
                    <div className="soft-card p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-amber-500" /> Billable Items
                            </h3>
                            <button
                                onClick={addItem}
                                className="text-sm font-bold text-amber-600 bg-amber-50 px-4 py-2 rounded-xl hover:bg-amber-100 transition-colors"
                            >
                                Add Item
                            </button>
                        </div>

                        <div className="space-y-4">
                            {items.map((item, index) => (
                                <div key={item.id} className="grid grid-cols-12 gap-4 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                    <div className="col-span-12 md:col-span-6 space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Description</label>
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                            placeholder="Service or Item Name"
                                            className="w-full soft-input px-4 py-2 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-4 md:col-span-2 space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Qty</label>
                                        <input
                                            type="number"
                                            value={item.qty}
                                            onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                                            className="w-full soft-input px-4 py-2 text-sm text-center"
                                        />
                                    </div>
                                    <div className="col-span-6 md:col-span-3 space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Price ({settings.currencySymbol})</label>
                                        <input
                                            type="number"
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                            className="w-full soft-input px-4 py-2 text-sm text-right"
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1 flex justify-center pb-2">
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="text-slate-300 hover:text-rose-500 transition-colors"
                                            title="Remove Item"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Summary Section */}
                    <div className="soft-card p-6 bg-slate-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Discount ({settings.currencySymbol})</label>
                                <input
                                    type="number"
                                    value={discount}
                                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                    className="w-full soft-input px-4 py-3 font-bold text-rose-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    {invoiceType === 'RECEIPT' ? 'Total Paid' : 'Amount Paid'} ({settings.currencySymbol})
                                </label>
                                <input
                                    type="number"
                                    value={amountPaid}
                                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                                    className="w-full soft-input px-4 py-3 font-bold text-emerald-600"
                                />
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Final Total</p>
                                <p className="text-2xl font-black text-slate-800">{settings.currencySymbol}{total.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Config */}
                <div className="space-y-6">
                    <div className="soft-card p-6 space-y-6">
                        <h3 className="font-bold text-slate-700">Document Settings</h3>

                        <div className="space-y-4">
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => setInvoiceType('INVOICE')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${invoiceType === 'INVOICE' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    INVOICE
                                </button>
                                <button
                                    onClick={() => setInvoiceType('RECEIPT')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${invoiceType === 'RECEIPT' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    RECEIPT
                                </button>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Billed To / Client Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input
                                        type="text"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        placeholder="e.g., Mr. Marco Abader"
                                        className="w-full soft-input pl-10 pr-4 py-2.5 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Invoice Number</label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input
                                        type="text"
                                        value={invoiceNumber}
                                        onChange={(e) => setInvoiceNumber(e.target.value)}
                                        placeholder="INV-00001-2025"
                                        className="w-full soft-input pl-10 pr-4 py-2.5 text-sm font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full soft-input pl-10 pr-4 py-2.5 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sale by</label>
                                <input
                                    type="text"
                                    value={saleBy}
                                    onChange={(e) => setSaleBy(e.target.value)}
                                    className="w-full soft-input px-4 py-2.5 text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="soft-card p-6 bg-emerald-50 border-emerald-100 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Save className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase text-emerald-600 tracking-wider">Quick Action</p>
                            <p className="text-sm font-bold text-emerald-800">Everything auto-saves locally while you edit</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

