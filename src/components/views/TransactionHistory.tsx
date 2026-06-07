import React, { useState, useEffect } from 'react';
import {
    FileText,
    CheckCircle,
    XCircle,
    Trash2,
    Search,
    Filter,
    Download,
    Eye,
    Receipt,
    AlertCircle,
    Calendar,
    ArrowUpRight,
    PenTool,
    Printer
} from 'lucide-react';
import { api } from '../../services/apiService';
import { Sale, ClinicSettings, User } from '../../types';
import { InvoiceModal } from '../shared/InvoiceModal';
import { CustomInvoiceModal } from '../shared/CustomInvoiceModal';
import { toast } from 'sonner';

interface TransactionHistoryProps {
    settings: ClinicSettings;
    currentUser: User | null;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ settings, currentUser }) => {
    const [sales, setSales] = useState<Sale[]>(() => api.getCache<Sale[]>('sales', 'page=1&limit=50') || []);
    const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(!api.getCache('sales', 'page=1&limit=50'));
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'RECEIPT' | 'INVOICE'>('ALL');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'Completed' | 'Pending' | 'Voided'>('ALL');

    // Modal state
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

    // Action Dialogs
    const [actionType, setActionType] = useState<'VOID' | 'DELETE' | null>(null);
    const [actionId, setActionId] = useState<string | null>(null);
    const [reason, setReason] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        filterData();
    }, [sales, searchTerm, filterType, filterStatus]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.sales.getAll();
            setSales(data);
        } catch (error) {
            console.error("Failed to load sales history:", error);
        } finally {
            setLoading(false);
        }
    };

    const filterData = () => {
        let result = [...sales];

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(sale =>
                sale.invoiceNumber.toLowerCase().includes(lowerTerm) ||
                sale.total.toString().includes(lowerTerm) ||
                sale.clientName?.toLowerCase().includes(lowerTerm)
            );
        }

        if (filterType !== 'ALL') {
            result = result.filter(sale => sale.type === filterType);
        }

        if (filterStatus !== 'ALL') {
            result = result.filter(sale => sale.status === filterStatus);
        }

        setFilteredSales(result);
    };

    const handlePay = async (sale: Sale) => {
        if (!window.confirm(`Mark invoice ${sale.invoiceNumber} as paid?`)) return;
        try {
            await api.sales.pay(sale.id, 'Cash', sale.balanceDue || sale.total); // Defaulting to Cash for now
            loadData();
            // Optionally open receipt immediately
            toast.success("Invoice marked as paid");
        } catch (error) {
            toast.error("Failed to pay invoice");
        }
    };

    const initiateAction = (type: 'VOID' | 'DELETE', id: string) => {
        setActionType(type);
        setActionId(id);
        setReason('');
    };

    const confirmAction = async () => {
        if (!actionId || !actionType) return;
        if (!reason.trim()) {
            toast.error("Please provide a reason.");
            return;
        }

        try {
            if (actionType === 'VOID') {
                await api.sales.void(actionId, reason);
            } else {
                await api.sales.delete(actionId, reason);
            }
            loadData();
            setActionType(null);
            setActionId(null);
            setReason('');
            toast.success(`Transaction ${actionType.toLowerCase()}ed successfully`);
        } catch (error) {
            toast.error(`Failed to ${actionType.toLowerCase()} transaction.`);
        }
    };

    const openDetails = async (sale: Sale) => {
        try {
            // Fetch the full sale data including items
            const fullSale = await api.sales.getOne(sale.id);
            setSelectedSale(fullSale);
            setShowInvoiceModal(true);
        } catch (error) {
            toast.error("Failed to load transaction details.");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#14B8A6]"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full flex flex-col animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Sales</h1>
                    <p className="text-slate-500 font-medium">View and manage receipts and invoices.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsCustomModalOpen(true)}
                        className="bg-[#14B8A6] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#B8962D] transition shadow-lg shadow-amber-200"
                    >
                        <PenTool className="w-4 h-4" />
                        New invoice
                    </button>
                    <div className="soft-card px-4 py-2 flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <span className="text-xs font-bold text-slate-600">Paid: {settings.currencySymbol}{sales.filter(s => s.status === 'Completed').reduce((a, b) => a + b.total, 0).toLocaleString()}</span>
                        </div>
                        <div className="w-px h-4 bg-slate-200"></div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                            <span className="text-xs font-bold text-slate-600">Pending: {settings.currencySymbol}{sales.filter(s => s.status === 'Pending').reduce((a, b) => a + b.total, 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search invoice number, client, or amount"
                        className="w-full soft-input pl-12 pr-4 py-3"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    <select
                        className="soft-input px-4 py-3 font-bold text-slate-600"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                    >
                        <option value="ALL">All types</option>
                        <option value="RECEIPT">Receipts</option>
                        <option value="INVOICE">Invoices</option>
                    </select>
                    <select
                        className="soft-input px-4 py-3 font-bold text-slate-600"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                    >
                        <option value="ALL">All status</option>
                        <option value="Completed">Paid</option>
                        <option value="Pending">Unpaid</option>
                        <option value="Voided">Voided</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 soft-card overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Number</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Client</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredSales.map((sale) => (
                                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            {new Date(sale.createdAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                            {sale.invoiceNumber}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-slate-700">{sale.clientName || 'Guest'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {sale.type === 'RECEIPT' ? <Receipt className="w-4 h-4 text-emerald-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                                            <span className="font-bold text-sm text-slate-700 capitalize">{sale.type.toLowerCase()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`
                                            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border
                                            ${sale.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                sale.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    'bg-slate-50 text-slate-500 border-slate-200 line-through'}
                                        `}>
                                            {sale.status === 'Completed' && <CheckCircle className="w-3 h-3" />}
                                            {sale.status === 'Pending' && <AlertCircle className="w-3 h-3" />}
                                            {sale.status === 'Voided' && <XCircle className="w-3 h-3" />}
                                            {sale.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-slate-800">
                                            {settings.currencySymbol}{sale.total.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                            {/* View Details */}
                                            <button
                                                onClick={() => openDetails(sale)}
                                                className="p-2 text-slate-400 hover:text-[#14B8A6] hover:bg-amber-50 rounded-lg transition-colors"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>

                                            {/* Quick Print */}
                                            <button
                                                onClick={async () => {
                                                    const fullSale = await api.sales.getOne(sale.id);
                                                    setSelectedSale(fullSale);
                                                    setShowInvoiceModal(true);
                                                    setTimeout(() => window.print(), 500);
                                                }}
                                                className="p-2 text-slate-400 hover:text-peach-600 hover:bg-peach-50 rounded-lg transition-colors"
                                                title="Quick Print"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>

                                            {/* Quick PDF Download */}
                                            <button
                                                onClick={async () => {
                                                    const fullSale = await api.sales.getOne(sale.id);
                                                    setSelectedSale(fullSale);
                                                    setShowInvoiceModal(true);
                                                    // Trigger PDF download via the modal
                                                    setTimeout(() => {
                                                        const downloadBtn = document.querySelector('[title="Download PDF"]') as HTMLButtonElement;
                                                        if (downloadBtn) {
                                                            downloadBtn.click();
                                                            setTimeout(() => setShowInvoiceModal(false), 1000);
                                                        }
                                                    }, 500);
                                                }}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Download PDF"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>

                                            {/* Pay (Invoice Only) */}
                                            {sale.type === 'INVOICE' && sale.status === 'Pending' && (
                                                <button
                                                    onClick={() => handlePay(sale)}
                                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors font-bold flex items-center gap-1 text-xs"
                                                    title="Mark as Paid"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            )}

                                            {/* Void/Delete - Admin Only */}
                                            {currentUser?.roles.includes('Admin') && (
                                                <>
                                                    {sale.status !== 'Voided' && sale.status !== 'Deleted' && (
                                                        <button
                                                            onClick={() => initiateAction('VOID', sale.id)}
                                                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title="Void Transaction"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => initiateAction('DELETE', sale.id)}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Delete Transaction"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredSales.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Receipt className="w-16 h-16 mb-4 opacity-20" />
                            <p className="font-bold">No transactions found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Confirmation Modal */}
            {actionType && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${actionType === 'VOID' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                                {actionType === 'VOID' ? <XCircle className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="text-xl font-extrabold text-slate-800 capitalize">{actionType.toLowerCase()} Transaction</h3>
                                <p className="text-slate-500 font-medium">This action requires a reason.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Reason for {actionType.toLowerCase()}ing</label>
                            <textarea
                                autoFocus
                                className="w-full soft-input p-4 min-h-[100px]"
                                placeholder="e.g. Duplicate entry, Refunded customer..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => { setActionType(null); setActionId(null); }}
                                className="flex-1 soft-btn py-3 text-slate-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmAction}
                                disabled={!reason.trim()}
                                className={`flex-1 font-bold py-3 rounded-xl text-white transition disabled:opacity-50 ${actionType === 'VOID' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'}`}
                            >
                                Confirm {actionType}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Viewer Modal */}
            {selectedSale && (
                <InvoiceModal
                    isOpen={showInvoiceModal}
                    onClose={() => setShowInvoiceModal(false)}
                    type={selectedSale.type}
                    items={selectedSale.items?.map(i => ({
                        ...(i.item || {}),
                        id: i.id,
                        name: i.name || i.item?.name || 'Unknown Item',
                        cartQuantity: i.quantity,
                        retailPrice: i.pricePerUnit
                    })) as any || []}
                    settings={settings}
                    totals={{
                        subtotal: selectedSale.subtotal,
                        discount: selectedSale.discount,
                        tax: selectedSale.tax,
                        total: selectedSale.total
                    }}
                    invoiceNumber={selectedSale.invoiceNumber}
                    readOnly={true}
                    status={selectedSale.status}
                    clientName={selectedSale.clientName || 'Walk-in Customer'}
                    issuerName={selectedSale.issuerName}
                    amountPaid={selectedSale.amountPaid}
                    balanceDue={selectedSale.balanceDue}
                    payments={selectedSale.payments}
                />
            )}

            <CustomInvoiceModal
                isOpen={isCustomModalOpen}
                onClose={() => setIsCustomModalOpen(false)}
                settings={settings}
                user={currentUser}
                onSuccess={() => {
                    loadData();
                }}
            />
        </div>
    );
};
