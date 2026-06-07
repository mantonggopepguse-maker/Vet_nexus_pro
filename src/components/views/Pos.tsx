import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, FileText, CheckCircle, TrendingUp, User as UserIcon, Camera, ScanLine, ChevronUp, ChevronDown, PenTool, Box, Loader2, Signal, CheckCircle2, CreditCard } from 'lucide-react';
import { InventoryItem, CartItem, ClinicSettings, Client, User, Sale } from '../../types';
import { api, API_URL } from '../../services/apiService';
import { analyzeProductImage } from '../../services/geminiService';
import { InvoiceModal } from '../shared/InvoiceModal';
import { CameraModal } from '../shared/CameraModal';
import { CustomInvoiceModal } from '../shared/CustomInvoiceModal';
import { toast } from 'sonner';

interface PosProps {
    inventory: InventoryItem[];
    settings: ClinicSettings;
    clients: Client[];
    invoiceCount: number;
    onIncrementInvoice: () => void;
    user: User | null;
}

export const Pos: React.FC<PosProps> = ({ inventory, settings, clients, invoiceCount, onIncrementInvoice, user }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState<number>(0);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'RECEIPT' | 'INVOICE'>('RECEIPT');
    const [currentInvoiceNum, setCurrentInvoiceNum] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [clientSearch, setClientSearch] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false); // Mobile drawer state
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'CARD' | 'MOBILE_MONEY'>('CASH');
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [splitPayments, setSplitPayments] = useState<{ method: string, amount: number }[]>([{ method: 'CASH', amount: 0 }]);
    const [createdSale, setCreatedSale] = useState<Sale | null>(null);

    const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Server-side search logic
    useEffect(() => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await api.inventory.getAll(1, 50, searchTerm);
                setSearchResults(results);
            } catch (error) {
                console.error("POS Search failed:", error);
                toast.error("Search failed");
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Logic for display items
    const getDisplayItems = () => {
        if (!searchTerm) {
            // Default: show top items from initial load
            return [...inventory]
                .sort((a, b) => (b.sales || 0) - (a.sales || 0))
                .slice(0, 10);
        }

        // If searching, show results from server
        if (searchResults.length > 0) return searchResults;

        // Fallback: local filter while server results are loading or if none found
        const lowerTerm = searchTerm.toLowerCase();
        return inventory.filter(item =>
            item.name.toLowerCase().includes(lowerTerm) ||
            item.sku.toLowerCase().includes(lowerTerm)
        );
    };

    const displayItems = getDisplayItems();

    const handleScan = async (base64Image: string) => {
        setIsSaving(true);
        try {
            const result = await analyzeProductImage(base64Image);
            if (result.sku || result.name) {
                const found = inventory.find(item =>
                    (result.sku && item.sku === result.sku) ||
                    (result.name && item.name.toLowerCase().includes(result.name.toLowerCase()))
                );
                if (found) {
                    addToCart(found);
                } else {
                    toast.error("Product not found: " + (result.name || result.sku));
                }
            }
        } catch (err) {
            console.error("Scan error:", err);
            toast.error("Scan failed. Please type manually.");
        } finally {
            setIsSaving(false);
        }
    };

    const addToCart = (item: InventoryItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i);
            }
            return [...prev, { ...item, cartQuantity: 1 }];
        });
    };

    const updateQuantity = (id: string, value: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, cartQuantity: Math.max(1, value) };
            }
            return item;
        }));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    // Calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.retailPrice * item.cartQuantity), 0);
    const taxAmount = settings.taxEnabled ? (subtotal - discount) * (settings.taxRate / 100) : 0;
    const total = Math.max(0, subtotal - discount + taxAmount);

    const handleCheckout = async (type: 'RECEIPT' | 'INVOICE') => {
        if (cart.length === 0) return;
        await processSale(type);
    };



    const processSale = async (type: 'RECEIPT' | 'INVOICE') => {
        if (isSplitPayment && type === 'RECEIPT') {
            const splitTotal = splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
            if (Math.abs(splitTotal - total) > 0.05 && splitTotal < total) {
                toast.error(`Split payments total (${settings.currencySymbol}${splitTotal}) is less than the required total (${settings.currencySymbol}${total}).`);
                return;
            }
        }

        setIsSaving(true);
        try {
            // Improved client name lookup
            const targetClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;
            const clientName = targetClient ? `${targetClient.firstName} ${targetClient.lastName}` : 'Walk-in Customer';

            const saleData = {
                type,
                subtotal,
                discount,
                tax: taxAmount,
                total,
                amountPaid: type === 'RECEIPT' ? total : 0,
                balanceDue: type === 'RECEIPT' ? 0 : total,
                paymentMethod: type === 'RECEIPT' ? (isSplitPayment ? 'SPLIT' : selectedPaymentMethod) : null,
                payments: type === 'RECEIPT' && isSplitPayment ? splitPayments.filter(p => Number(p.amount) > 0).map(p => ({ method: p.method, amount: Number(p.amount) })) : undefined,
                clientId: selectedClientId || null,
                clientName,
                issuerId: user?.id,
                issuerName: user?.name || settings.name,
                createdAt: new Date().toISOString(),
                status: type === 'RECEIPT' ? 'Completed' : 'Pending',
                items: cart.map(item => ({
                    itemId: item.id,
                    name: item.name,
                    quantity: item.cartQuantity,
                    pricePerUnit: item.retailPrice
                }))
            };

            const newSale = await api.sales.create(saleData);

            setCreatedSale(newSale);
            setCurrentInvoiceNum(newSale.invoiceNumber);
            setModalType(type);
            toast.success(`${type === 'RECEIPT' ? 'Payment Approved' : 'Invoice Issued'} Successfully`);
            setShowModal(true);
            onIncrementInvoice();
        } catch (error: any) {
            console.error(error);
            toast.error(error?.data?.details || error?.message || "Transaction failed. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const clearCart = () => {
        setCart([]);
        setDiscount(0);
        setSearchTerm('');
    };

    return (
        <div className="h-full flex flex-col xl:flex-row gap-4 md:gap-6 animate-fade-in overflow-y-auto md:overflow-hidden pb-4 md:pb-0">

            {/* LEFT: Product Selection */}
            <div className="flex-[1.4] flex flex-col gap-4 overflow-hidden min-h-[300px] md:min-h-0">
                {/* Search Header */}
                <div className="soft-card p-3 md:p-4 border-none">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors w-5 h-5 ${isSearchFocused ? 'text-[#14B8A6]' : 'text-slate-400'}`} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                className={`w-full soft-input pl-12 pr-12 py-3 text-base md:text-lg font-bold text-slate-700 transition-all ${isSearchFocused ? 'shadow-lg ring-2 ring-[#14B8A6]/10 bg-white' : ''}`}
                            />
                            {isSearching && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <Loader2 className="w-5 h-5 animate-spin text-[#14B8A6]" />
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setIsScanning(true)}
                            className="w-12 h-12 md:w-14 md:h-14 bg-[#14B8A6] text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all flex-shrink-0"
                        >
                            <ScanLine className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>

                {/* Product Area - Compact Grid */}
                <div className="flex-1 overflow-y-auto pr-1">
                    <div className="flex flex-col gap-2 pb-4">
                        {displayItems.map((item, index) => (
                            <div
                                key={item.id}
                                onClick={() => addToCart(item)}
                                className={`
                                    soft-card p-2 md:p-3 flex items-center gap-3 cursor-pointer transition-all active:scale-[0.99] border-none group
                                    ${index < 3 && !searchTerm ? 'bg-amber-50/20' : ''}
                                `}
                            >
                                {/* Image / Icon */}
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-100 flex items-center justify-center">
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl.startsWith('/') ? `${API_URL}${item.imageUrl}` : item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Box className="w-5 h-5 text-slate-300" />
                                    )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-slate-800 text-sm truncate pr-2">{item.name}</h3>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-400 mt-0.5">
                                        <span className="font-bold text-[#14B8A6] opacity-60">{item.sku}</span>
                                        <span className={`${item.quantity <= (item.minThreshold || 5) ? 'text-rose-500 font-bold' : ''}`}>
                                            {item.quantity} in stock
                                        </span>
                                    </div>
                                </div>

                                {/* Price & Add */}
                                <div className="flex items-center gap-3">
                                    <span className="font-black text-slate-900 text-sm whitespace-nowrap">
                                        {settings.currencySymbol}{item.retailPrice.toLocaleString()}
                                    </span>
                                    <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 text-[#14B8A6] flex items-center justify-center group-hover:bg-[#14B8A6] group-hover:text-white transition-colors">
                                        <Plus className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT: Cart & Checkout Section */}
            <div className="w-full xl:w-[500px] 2xl:w-[550px] flex flex-col glass-card overflow-hidden border-t-2 border-[#14B8A6] min-h-[400px] xl:min-h-0 border-none">
                {/* Cart Header */}
                <div className="p-4 border-b border-white/40 flex justify-between items-center bg-white/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#14B8A6] flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-black text-slate-800 tracking-tight">Cart Items</h2>
                            <p className="text-[10px] font-black uppercase text-[#14B8A6]">{cart.length} items added</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsCustomModalOpen(true)}
                            className="text-[#14B8A6] hover:text-[#0F766E] p-2 hover:bg-white/40 rounded-lg transition text-xs font-bold leading-none flex flex-col items-center gap-1"
                            title="Create Custom Invoice"
                        >
                            <PenTool className="w-4 h-4" />
                        </button>
                        <button
                            onClick={clearCart}
                            disabled={cart.length === 0 || isSaving}
                            className="text-rose-400 hover:text-rose-600 p-2 hover:bg-white/40 rounded-lg transition disabled:opacity-50"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Client Selection */}
                <div className="px-4 py-3 bg-slate-50/30 border-b border-slate-100">
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-200"
                        >
                            <option value="">Walk-in Customer</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Scrollable Cart List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 bg-slate-50/20">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-40 p-8 text-center">
                            <ShoppingCart className="w-12 h-12 mb-2 stroke-1" />
                            <p className="text-xs font-bold">Your cart is empty</p>
                            <button onClick={() => setIsCustomModalOpen(true)} className="mt-4 px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition">
                                Create Custom / Freestyle Invoice
                            </button>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm transition-all hover:border-amber-200">
                                <button 
                                    onClick={() => removeFromCart(item.id)}
                                    className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors flex-shrink-0"
                                    title="Remove item"
                                >
                                    <span className="text-sm font-black leading-none">×</span>
                                </button>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-700 text-[11px] leading-tight line-clamp-1">{item.name}</h4>
                                    <div className="text-[10px] text-slate-400 font-bold">{settings.currencySymbol}{item.retailPrice.toLocaleString()}</div>
                                </div>

                                <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                                    <button
                                        onClick={() => updateQuantity(item.id, item.cartQuantity - 1)}
                                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white rounded-md shadow-sm transition-colors"
                                    >
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <input
                                        type="number"
                                        value={item.cartQuantity}
                                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                                        className="w-10 bg-transparent text-center font-black text-slate-700 text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                        onClick={() => updateQuantity(item.id, item.cartQuantity + 1)}
                                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white rounded-md shadow-sm transition-colors"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>

                                <div className="w-20 text-right font-black text-slate-800 text-xs">
                                    {settings.currencySymbol}{(item.retailPrice * item.cartQuantity).toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Totals & Action Buttons */}
                <div className="p-4 md:p-6 bg-white/40 backdrop-blur-3xl border-t border-white/40 space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] pt-4">
                    <div className="space-y-2 mb-2">
                        <div className="flex justify-between items-center text-slate-500 text-xs font-bold">
                            <span>Subtotal</span>
                            <span>{settings.currencySymbol}{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-xs font-bold">
                            <span className="text-slate-500">Discount ({settings.currencySymbol})</span>
                            <input
                                type="number"
                                value={discount}
                                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                className="w-20 soft-input px-2 py-1 text-right font-black text-rose-500 bg-white/40"
                            />
                        </div>
                        <div className="flex justify-between items-center text-slate-800 pt-2 border-t border-white/60">
                            <span className="text-sm font-black uppercase text-slate-400">Total Payable</span>
                            <span className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
                                {settings.currencySymbol}{total.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Manual Payment Method Selector */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/60">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-400">Payment Method</span>
                            <button 
                                onClick={() => setIsSplitPayment(!isSplitPayment)}
                                className="text-[10px] font-bold text-[#14B8A6] bg-[#14B8A6]/10 px-2 py-1 rounded-md"
                            >
                                {isSplitPayment ? 'Single Payment' : 'Split Payment'}
                            </button>
                        </div>
                        
                        {!isSplitPayment ? (
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { id: 'CASH', label: 'Cash' },
                                    { id: 'TRANSFER', label: 'Transfer' },
                                    { id: 'CARD', label: 'Card' },
                                    { id: 'MOBILE_MONEY', label: 'Mobile' }
                                ].map((method) => (
                                    <button
                                        key={method.id}
                                        onClick={() => setSelectedPaymentMethod(method.id as any)}
                                        className={`py-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border-2 ${selectedPaymentMethod === method.id
                                            ? 'bg-[#14B8A6] text-white border-[#14B8A6] shadow-lg shadow-amber-100'
                                            : 'bg-white/40 text-slate-500 border-white/60 hover:bg-white'
                                            }`}
                                    >
                                        <span className="text-xs font-bold">{method.label}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {splitPayments.map((payment, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <select 
                                            value={payment.method}
                                            onChange={(e) => {
                                                const newPayments = [...splitPayments];
                                                newPayments[idx].method = e.target.value;
                                                setSplitPayments(newPayments);
                                            }}
                                            className="flex-1 soft-input py-1.5 px-2 text-xs font-bold"
                                        >
                                            <option value="CASH">Cash</option>
                                            <option value="TRANSFER">Transfer</option>
                                            <option value="CARD">Card</option>
                                            <option value="MOBILE_MONEY">Mobile</option>
                                        </select>
                                        <div className="relative w-28">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{settings.currencySymbol}</span>
                                            <input 
                                                type="number"
                                                value={payment.amount || ''}
                                                onChange={(e) => {
                                                    const newPayments = [...splitPayments];
                                                    newPayments[idx].amount = parseFloat(e.target.value) || 0;
                                                    setSplitPayments(newPayments);
                                                }}
                                                className="w-full soft-input py-1.5 pl-6 pr-2 text-xs font-black text-slate-800"
                                            />
                                        </div>
                                        {idx === splitPayments.length - 1 ? (
                                            <button 
                                                onClick={() => setSplitPayments([...splitPayments, {method: 'TRANSFER', amount: 0}])}
                                                className="w-8 flex items-center justify-center bg-[#14B8A6] text-white rounded-lg"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))}
                                                className="w-8 flex items-center justify-center bg-rose-100 text-rose-500 rounded-lg"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 pt-1">
                                    <span>Remaining: {settings.currencySymbol}{Math.max(0, total - splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)).toLocaleString()}</span>
                                    <span>Entered: {settings.currencySymbol}{splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0).toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleCheckout('RECEIPT')}
                            disabled={cart.length === 0 || isSaving}
                            className="btn-luminous btn-luminous-emerald w-full text-xs uppercase tracking-widest"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Pay & Receipt
                        </button>
                        <button
                            onClick={() => handleCheckout('INVOICE')}
                            disabled={cart.length === 0 || isSaving}
                            className="btn-luminous btn-luminous-primary w-full text-xs uppercase tracking-widest"
                        >
                            <FileText className="w-5 h-5" />
                            Issue Invoice
                        </button>
                    </div>
                </div>
            </div>

            <InvoiceModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    if (modalType === 'RECEIPT') {
                        clearCart();
                        setDiscount(0);
                    }
                    setSelectedClientId('');
                    setIsCartOpen(false);
                }}
                type={modalType}
                items={cart}
                settings={settings}
                totals={{ subtotal, discount, tax: taxAmount, total }}
                invoiceNumber={currentInvoiceNum}
                clientName={selectedClientId ? clients.find(c => c.id === selectedClientId)?.firstName + ' ' + clients.find(c => c.id === selectedClientId)?.lastName : 'Walk-in Customer'}
                issuerName={user?.name || settings.name}
                amountPaid={createdSale?.amountPaid ?? (modalType === 'RECEIPT' ? total : 0)}
                balanceDue={createdSale?.balanceDue ?? (modalType === 'RECEIPT' ? 0 : total)}
                paymentMethod={modalType === 'RECEIPT' ? selectedPaymentMethod : undefined}
                payments={createdSale?.payments || []}
            />

            <CustomInvoiceModal
                isOpen={isCustomModalOpen}
                onClose={() => setIsCustomModalOpen(false)}
                settings={settings}
                user={user}
                onSuccess={() => {
                    onIncrementInvoice();
                    setSuccessMessage("Custom sale saved successfully!");
                    setTimeout(() => setSuccessMessage(null), 3000);
                }}
            />

            <CameraModal
                isOpen={isScanning}
                onClose={() => setIsScanning(false)}
                onCapture={handleScan}
                title="POS Rapid Scan"
                hint="Point at product barcode"
            />

        </div >
    );
};
