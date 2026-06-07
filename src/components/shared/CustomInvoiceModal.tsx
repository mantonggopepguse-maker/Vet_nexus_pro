import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Plus,
    Trash2,
    X,
    Save,
    Printer,
    FileText,
    Info,
    AlertTriangle,
    Clock,
    CreditCard,
    Download,
    User,
    Calendar
} from 'lucide-react';
import { ClinicSettings, User as UserType } from '../../types';
import { api } from '../../services/apiService';
import { InvoiceModal } from './InvoiceModal';

interface CustomInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: ClinicSettings;
    user: UserType | null;
    onSuccess?: () => void;
}

interface InvoiceItem {
    id: string;
    description: string;
    qty: number;
    unitPrice: number;
}

export const CustomInvoiceModal: React.FC<CustomInvoiceModalProps> = ({ isOpen, onClose, settings, user, onSuccess }) => {
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
    const [isSaving, setIsSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [savedSale, setSavedSale] = useState<any>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'CARD' | 'MOBILE_MONEY' | null>(null);

    // Load draft from local storage
    useEffect(() => {
        if (!user) return;
        const draftKey = `draft_custom_invoice_${user.clinicId}_${user.id}`;
        const saved = localStorage.getItem(draftKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setClientName(parsed.clientName || '');
                setItems(parsed.items || []);
                setDiscount(parsed.discount || 0);
                setAmountPaid(parsed.amountPaid || 0);
                setInvoiceType(parsed.invoiceType || 'INVOICE');
            } catch (e) {
                console.error("Failed to load draft", e);
            }
        }
    }, []);

    // Auto-save to local storage
    useEffect(() => {
        if (!user) return;
        const draftKey = `draft_custom_invoice_${user.clinicId}_${user.id}`;
        const draft = { clientName, items, discount, amountPaid, invoiceType };
        localStorage.setItem(draftKey, JSON.stringify(draft));
    }, [clientName, items, discount, amountPaid, invoiceType, user]);

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
    const effectiveAmountPaid = invoiceType === 'RECEIPT' ? total : amountPaid;
    const balanceDue = invoiceType === 'RECEIPT' ? 0 : Math.max(0, total - amountPaid);

    if (!isOpen) return null;

    const handleSave = async (showPreviewAfter: boolean = false) => {
        if (!clientName.trim()) {
            toast.error('Please enter a client name.');
            return;
        }

        setIsSaving(true);
        try {
            // If invoice number is empty, let backend generate it or use placeholder?
            // Backend generates if not provided usually, but here we might want to let user specify.
            // If user leaves blank, we can pass null/empty to backend if modified route supports it,
            // or generate a temp one. `sales.ts` generates one if not provided in `create`.

            const saleData = {
                type: invoiceType,
                clientName,
                invoiceNumber: invoiceNumber || undefined, // undefined lets backend generate usually, but we need to check route.
                amountPaid: effectiveAmountPaid,
                balanceDue,
                paymentMethod: invoiceType === 'RECEIPT' ? (selectedPaymentMethod || 'CASH') : null,
                issuerName: saleBy,
                subtotal,
                discount,
                total,
                items: items.map(item => ({
                    description: item.description,
                    name: item.description, // Backend expects name or description
                    quantity: item.qty,
                    pricePerUnit: item.unitPrice
                }))
            };

            // Use the sales create endpoint
            const result = await api.sales.create(saleData);

            setSavedSale(result);
            // Clear draft
            if (user) {
                const draftKey = `draft_custom_invoice_${user.clinicId}_${user.id}`;
                localStorage.removeItem(draftKey);
            }

            if (showPreviewAfter) {
                setShowPreview(true);
            } else {
                toast.success('Saved successfully!'); // Replaced alert with toast
                onSuccess?.();
                onClose();
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error?.data?.details || error?.message || 'Failed to save'); // Replaced alert with toast
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">

                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div>
                            <h2 className="font-bold text-slate-800 text-lg">Create Custom {invoiceType === 'INVOICE' ? 'Invoice' : 'Receipt'}</h2>
                            <p className="text-xs text-slate-500 font-medium">Manual entry for freestyle items</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all active:scale-90 border border-rose-100 flex items-center justify-center shadow-sm"
                            title="Close"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Scrollable Form */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                            {/* Main Inputs */}
                            <div className="md:col-span-2 space-y-6">
                                {/* Items List */}
                                <div className="soft-card p-5 bg-white">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-slate-700 text-sm">Billable Items</h3>
                                        <button onClick={addItem} className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition">
                                            + Add Item
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {items.map((item, index) => (
                                            <div key={item.id} className="grid grid-cols-12 gap-3 items-end">
                                                <div className="col-span-6">
                                                    <input
                                                        type="text"
                                                        placeholder="Description"
                                                        value={item.description}
                                                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                        className="w-full soft-input px-3 py-2 text-sm"
                                                        autoFocus={index === items.length - 1}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        type="number"
                                                        placeholder="Qty"
                                                        value={item.qty}
                                                        onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                                                        className="w-full soft-input px-3 py-2 text-sm text-center"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        type="number"
                                                        placeholder="Price"
                                                        value={item.unitPrice}
                                                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                        className="w-full soft-input px-3 py-2 text-sm text-right"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-center pb-2">
                                                    <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-rose-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Financials Card */}
                                <div className="soft-card p-5 bg-white space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400">Discount</label>
                                            <input
                                                type="number"
                                                value={discount}
                                                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                                className="w-full soft-input px-3 py-2 font-bold text-rose-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400">Paid</label>
                                            <input
                                                type="number"
                                                value={amountPaid}
                                                onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                                                className="w-full soft-input px-3 py-2 font-bold text-emerald-600"
                                            />
                                        </div>
                                    </div>

                                    {invoiceType === 'RECEIPT' && (
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400">Payment Method</label>
                                            <select
                                                value={selectedPaymentMethod || 'CASH'}
                                                onChange={(e) => setSelectedPaymentMethod(e.target.value as any)}
                                                className="w-full soft-input px-3 py-2 text-sm font-bold bg-amber-50/30"
                                            >
                                                <option value="CASH">Cash</option>
                                                <option value="TRANSFER">Transfer</option>
                                                <option value="CARD">Card</option>
                                                <option value="MOBILE_MONEY">Mobile Money</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 rounded-xl p-3 flex flex-col justify-center text-right">
                                        <span className="text-[10px] font-black uppercase text-slate-400">Total</span>
                                        <span className="text-2xl font-black text-slate-800">{settings.currencySymbol}{total.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar Settings */}
                            <div className="space-y-4">
                                <div className="soft-card p-4 bg-white space-y-4">
                                    <div className="flex bg-slate-100 rounded-lg p-1">
                                        <button
                                            onClick={() => setInvoiceType('INVOICE')}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${invoiceType === 'INVOICE' ? 'bg-white shadow text-amber-600' : 'text-slate-400'}`}
                                        >
                                            Invoice
                                        </button>
                                        <button
                                            onClick={() => setInvoiceType('RECEIPT')}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${invoiceType === 'RECEIPT' ? 'bg-white shadow text-amber-600' : 'text-slate-400'}`}
                                        >
                                            Receipt
                                        </button>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Client Name</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                                            <input
                                                type="text"
                                                value={clientName}
                                                onChange={(e) => setClientName(e.target.value)}
                                                className="w-full soft-input pl-8 pr-3 py-2 text-sm"
                                                placeholder="Client Name"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Invoice # (Optional)</label>
                                        <div className="relative">
                                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                                            <input
                                                type="text"
                                                value={invoiceNumber}
                                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                                className="w-full soft-input pl-8 pr-3 py-2 text-sm font-mono"
                                                placeholder="Auto-generated"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                                            <input
                                                type="date"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className="w-full soft-input pl-8 pr-3 py-2 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-2 text-center text-xs text-slate-400 italic">
                                        Changes auto-save to local draft
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition">
                            Cancel
                        </button>
                        <button onClick={() => handleSave(true)} disabled={isSaving} className="px-5 py-2.5 rounded-xl font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 transition flex items-center gap-2">
                            <Printer className="w-4 h-4" /> Save & Print
                        </button>
                        <button onClick={() => handleSave(false)} disabled={isSaving} className="px-6 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-200 transition flex items-center gap-2">
                            <Save className="w-4 h-4" /> Save Record
                        </button>
                    </div>
                </div>
            </div>

            {/* Print Preview Overlay */}
            {savedSale && (
                <InvoiceModal
                    isOpen={showPreview}
                    onClose={() => {
                        setShowPreview(false);
                        onSuccess?.();
                        onClose();
                    }}
                    type={savedSale.type}
                    items={savedSale.items.map((i: any) => ({
                        ...i,
                        retailPrice: i.pricePerUnit,
                        cartQuantity: i.quantity
                    }))}
                    settings={settings}
                    totals={{ subtotal: savedSale.subtotal, discount: savedSale.discount, tax: savedSale.tax, total: savedSale.total }}
                    invoiceNumber={savedSale.invoiceNumber}
                    clientName={savedSale.clientName || 'Walk-in'}
                    issuerName={savedSale.issuerName}
                    amountPaid={savedSale.amountPaid}
                    balanceDue={savedSale.balanceDue}
                    paymentMethod={savedSale.paymentMethod}
                />
            )}
        </>
    );
};

