import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, Copy, Share2 } from 'lucide-react';
import { CartItem, ClinicSettings } from '../../types';
import html2pdf from 'html2pdf.js';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'RECEIPT' | 'INVOICE';
    items: CartItem[];
    settings: ClinicSettings;
    totals: {
        subtotal: number;
        discount: number;
        tax: number;
        total: number;
    };
    invoiceNumber: string;
    readOnly?: boolean;
    status?: string;
    clientName?: string;
    issuerName?: string;
    amountPaid?: number;
    balanceDue?: number;
    paymentMethod?: string;
    payments?: any[];
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
    isOpen, onClose, type, items, settings, totals, invoiceNumber, readOnly, status, clientName = 'Walk-in Customer', issuerName, amountPaid = 0, balanceDue = 0, paymentMethod, payments = []
}) => {
    const printAreaRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = () => {
        if (!printAreaRef.current) return;

        const filename = `${type}_${invoiceNumber.replace(/\//g, '-')}.pdf`;

        const options = {
            margin: [10, 10, 10, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            }
        };

        html2pdf().set(options).from(printAreaRef.current).save();
    };

    const effectiveBalance = balanceDue !== undefined ? balanceDue : (type === 'INVOICE' ? totals.total - amountPaid : 0);
    const isUnpaid = effectiveBalance > 0 && type === 'INVOICE';

    const content = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:block print:inset-0 animate-fade-in overflow-y-auto printable-area">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:h-auto print:shadow-none print:h-auto print:w-full print:max-w-none print:rounded-none print:static">

                {/* Actions Header (Hidden when printing) */}
                <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50 no-print flex-shrink-0">
                    <div className="flex justify-between items-start w-full sm:w-auto">
                        <div>
                            <h3 className="font-bold text-slate-700 text-sm sm:text-base">{type === 'RECEIPT' ? 'Payment Receipt' : 'Invoice Generated'}</h3>
                            <p className="text-xs text-slate-500 font-medium">Ready to print or download</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all active:scale-90 border border-rose-100 sm:hidden flex items-center justify-center shadow-sm"
                            title="Close Receipt"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={handlePrint}
                            className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 bg-peach-600 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:bg-peach-700 transition shadow-lg shadow-peach-200"
                        >
                            <Printer className="w-4 h-4" /> Print
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            title="Download PDF"
                            className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition shadow-sm"
                        >
                            <Download className="w-4 h-4" /> PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all font-black text-xs uppercase tracking-wider border border-rose-100 shadow-sm active:scale-95"
                        >
                            <X className="w-4 h-4" /> Close
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className={`overflow-y-auto p-2 sm:p-4 md:p-8 bg-slate-100 flex justify-center print:p-0 print:bg-white print:overflow-visible print:block`} ref={printAreaRef}>
                    <div className="bg-white w-full max-w-[210mm] min-h-0 md:min-h-[297mm] p-4 sm:p-6 md:p-14 shadow-lg print:shadow-none print:w-full print:max-w-none print:min-h-0 print:p-8 print:m-0 relative flex flex-col font-sans text-slate-900 print:text-black">

                        {/* Logo and Header Center */}
                        <div className="text-center mb-6 sm:mb-10 md:mb-16 print:mb-8">
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-blue-900 print:text-blue-900 tracking-tight mb-1 sm:mb-2">
                                {settings.name || 'Vet Nexus'}
                            </h1>
                            <div className="text-xs sm:text-sm font-medium text-slate-600 print:text-slate-800 space-y-0.5">
                                <p className="truncate px-2">{settings.address || '123 Veterinary Lane, Cityville'}</p>
                                <p className="truncate px-2">{settings.email} | {settings.phone}</p>
                            </div>
                        </div>

                        {/* BILL TO and INVOICE DETAILS Row */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-8 md:gap-0 mb-8 md:mb-12 print:mb-6">
                            {/* Left: Billed To */}
                            <div className="w-full md:w-auto">
                                <h3 className="text-xs font-bold text-peach-600 print:text-peach-800 uppercase tracking-widest mb-2">BILLED TO</h3>
                                <p className="text-lg font-black text-slate-800 print:text-black">{clientName}</p>
                            </div>

                            {/* Right: Invoice Info */}
                            <div className="text-left md:text-right w-full md:w-auto">
                                <h2 className="text-2xl font-black text-peach-600 print:text-peach-800 uppercase tracking-wider mb-2">
                                    {type}
                                </h2>
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-slate-700 print:text-slate-900">
                                        Number #: <span className="font-mono text-slate-900 print:text-black">{invoiceNumber}</span>
                                    </p>
                                    <p className="text-sm font-bold text-slate-700 print:text-slate-900">
                                        Date: <span className="text-slate-900 print:text-black">{new Date().toLocaleDateString('en-GB')}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Items Table - Clean & Spacious */}
                        <div className="mb-6 sm:mb-10 print:mb-6 overflow-x-auto -mx-2 px-2 print:overflow-visible">
                            <table className="w-full min-w-[320px]">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="py-2 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-peach-700 uppercase tracking-wide">Item</th>
                                        <th className="py-2 sm:py-3 text-center text-[10px] sm:text-xs font-bold text-peach-700 uppercase tracking-wide w-12 sm:w-auto">Qty</th>
                                        <th className="py-2 sm:py-3 text-right text-[10px] sm:text-xs font-bold text-peach-700 uppercase tracking-wide">Price</th>
                                        <th className="py-2 sm:py-3 text-right text-[10px] sm:text-xs font-bold text-peach-700 uppercase tracking-wide">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {items.map((item, idx) => (
                                        <tr key={item.id}>
                                            <td className="py-2 sm:py-4 text-xs sm:text-sm font-bold text-slate-700 max-w-[120px] sm:max-w-none truncate">
                                                {item.name}
                                            </td>
                                            <td className="py-2 sm:py-4 text-center text-xs sm:text-sm font-bold text-slate-600">
                                                {item.cartQuantity ?? item.quantity}
                                            </td>
                                            <td className="py-2 sm:py-4 text-right text-xs sm:text-sm font-bold text-slate-600 whitespace-nowrap">
                                                {settings.currencySymbol}{item.retailPrice.toLocaleString()}
                                            </td>
                                            <td className="py-2 sm:py-4 text-right text-xs sm:text-sm font-black text-slate-800 whitespace-nowrap">
                                                {settings.currencySymbol}{(item.retailPrice * (item.cartQuantity ?? item.quantity)).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer Section: Sale By, Summary, Account Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-12 border-t border-slate-100 pt-4 sm:pt-8 mt-auto break-inside-avoid print:pt-4">

                            {/* Left Column: Staff & Bank Info */}
                            <div className="space-y-4 sm:space-y-8 order-2 md:order-1 print:space-y-4">
                                <div>
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 print:text-slate-600 mb-1">Sale by:</p>
                                    <p className="text-xs sm:text-sm font-black text-slate-800 print:text-black">{issuerName || 'Staff'}</p>
                                </div>

                                {payments.length > 0 ? (
                                    <div className="pt-2">
                                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 print:text-slate-600 mb-2">Payment History:</p>
                                        <div className="space-y-1.5">
                                            {payments.map((p, idx) => (
                                                <div key={p.id || idx} className="flex justify-between items-center text-[10px] sm:text-xs bg-slate-50 print:bg-transparent p-1.5 rounded border border-slate-100 print:border-none">
                                                    <span className="font-bold text-slate-600">{new Date(p.date || p.createdAt).toLocaleDateString()}</span>
                                                    <span className="font-black text-slate-800 uppercase mx-2">{p.method.replace('_', ' ')}</span>
                                                    <span className="font-black text-peach-600 ml-auto">{settings.currencySymbol}{p.amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : paymentMethod && (
                                    <div>
                                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 print:text-slate-600 mb-1">Payment Method:</p>
                                        <p className="text-xs sm:text-sm font-black text-slate-800 print:text-black uppercase">{paymentMethod.replace('_', ' ')}</p>
                                    </div>
                                )}

                                {type === 'INVOICE' && (
                                    <div className="pt-2 sm:pt-4">
                                        <h4 className="text-[10px] sm:text-xs font-black text-slate-700 print:text-black mb-2 sm:mb-3">Account Details</h4>
                                        <div className="text-xs sm:text-sm font-medium text-slate-600 print:text-slate-800 space-y-1 sm:space-y-1.5">
                                            <p className="flex gap-2">
                                                <span className="text-slate-400 print:text-slate-600 w-20 sm:w-24 flex-shrink-0">Bank:</span>
                                                <span className="font-bold text-slate-800 print:text-black truncate">{settings.bankName || '---'}</span>
                                            </p>
                                            <p className="flex gap-2">
                                                <span className="text-slate-400 print:text-slate-600 w-20 sm:w-24 flex-shrink-0">Acc Name:</span>
                                                <span className="font-bold text-slate-800 print:text-black truncate">{settings.accountName || '---'}</span>
                                            </p>
                                            <p className="flex gap-2">
                                                <span className="text-slate-400 print:text-slate-600 w-20 sm:w-24 flex-shrink-0">Acc Number:</span>
                                                <span className="font-bold text-slate-800 print:text-black font-mono">{settings.accountNumber || '---'}</span>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Financials */}
                            <div className="space-y-2 sm:space-y-3 order-1 md:order-2">
                                <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-500 print:text-slate-600">
                                    <span>Subtotal:</span>
                                    <span>{settings.currencySymbol}{totals.subtotal.toLocaleString()}</span>
                                </div>

                                {totals.discount > 0 && (
                                    <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-500 print:text-slate-600">
                                        <span>Discount:</span>
                                        <span>-{settings.currencySymbol}{totals.discount.toLocaleString()}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center text-slate-900 print:text-black border-t border-slate-100 pt-2 sm:pt-3 pb-1">
                                    <span className="text-base sm:text-lg font-black">Total:</span>
                                    <span className="text-lg sm:text-xl font-black">{settings.currencySymbol}{totals.total.toLocaleString()}</span>
                                </div>

                                <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-600 print:text-slate-800">
                                    <span>Amount Paid:</span>
                                    <span>{settings.currencySymbol}{amountPaid.toLocaleString()}</span>
                                </div>

                                {type === 'INVOICE' && (
                                    <div className="flex justify-between text-base sm:text-lg font-black text-peach-700 print:text-peach-800 pt-1 sm:pt-2">
                                        <span>Balance Due:</span>
                                        <span>{settings.currencySymbol}{effectiveBalance.toLocaleString()}</span>
                                    </div>
                                )}

                                {/* Unpaid Badge */}
                                {isUnpaid && (
                                    <div className="mt-2 sm:mt-4 text-right">
                                        <div className="inline-block border-2 border-rose-500 text-rose-500 px-2 sm:px-3 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-black uppercase tracking-widest print:border-red-600 print:text-red-600">
                                            Unpaid
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom Greeting */}
                        <div className="text-center mt-8 sm:mt-16 pt-4 sm:pt-8 border-t border-slate-50 print:mt-8">
                            <p className="text-[10px] sm:text-xs font-bold text-slate-400 italic">Thank you for your business!</p>
                        </div>

                        {/* Secondary Close Button (Non-printable) */}
                        <div className="mt-8 flex justify-center no-print pb-4">
                            <button
                                onClick={onClose}
                                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95 flex items-center gap-3"
                            >
                                <X className="w-5 h-5" /> Complete & Close
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};




