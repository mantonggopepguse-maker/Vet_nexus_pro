import React, { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ScanLine, Save, Loader2, Sparkles, AlertCircle, Check, Upload, Camera, X, CheckCircle, Shield, Trash2, History, Box, Plus, Edit2, Settings } from 'lucide-react';
import { ProductCategory, PackagingType, InventoryItem, ClinicSettings, StockBatch, InventoryReconciliation } from '../../types';
import { api, API_URL } from '../../services/apiService';
import { analyzeProductImage } from '../../services/geminiService';
import { CameraModal } from '../shared/CameraModal';

interface AddItemFormProps {
    onBack: () => void;
    onSave: (item: InventoryItem | Omit<InventoryItem, 'id'>, skipRedirect?: boolean) => void;
    onDeleteItem?: (id: string) => void;
    settings: ClinicSettings;
    isSaving?: boolean;
    initialData?: InventoryItem;
}

const itemToFormData = (item: InventoryItem) => ({
    name: item.name || '',
    description: item.description || '',
    sku: item.sku || '',
    quantity: item.quantity ?? '',
    minThreshold: item.minThreshold ?? 10,
    expiryDate: item.expiryDate || '',
    category: item.category as ProductCategory || ProductCategory.OTHER,
    packaging: item.packaging as PackagingType || PackagingType.OTHER,
    costPrice: item.costPrice ?? '',
    wholesalePrice: item.wholesalePrice ?? '',
    retailPrice: item.retailPrice ?? '',
    showInClientPortal: !!item.showInClientPortal,
    manufacturer: item.manufacturer || '',
    batchNumber: item.batchNumber || '',
    nafdacNumber: item.nafdacNumber || '',
    imageUrl: item.imageUrl || '',
    isControlled: !!item.isControlled
});

export const AddItemForm: React.FC<AddItemFormProps> = ({ onBack, onSave, onDeleteItem, settings, isSaving = false, initialData }) => {
    const isEdit = !!initialData;
    const [isScanning, setIsScanning] = useState(false);
    const [isSnapping, setIsSnapping] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [scanError, setScanError] = useState('');
    const [scanSuccess, setScanSuccess] = useState(false);
    const [validationError, setValidationError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scanInFlightRef = useRef(false);

    const [fullItem, setFullItem] = useState<InventoryItem | null>(initialData || null);
    const [reconciliations, setReconciliations] = useState<InventoryReconciliation[]>([]);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    
    // States for stock control
    const [isAddingStock, setIsAddingStock] = useState(false);
    const [stockForm, setStockForm] = useState({ quantity: 0, date: new Date().toISOString().split('T')[0] });
    const [isReconciling, setIsReconciling] = useState(false);
    const [reconcileForm, setReconcileForm] = useState({ physicalCount: 0, reason: '', notes: '' });

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sku: '',
        quantity: '' as string | number,
        minThreshold: '10' as string | number,
        expiryDate: '',
        category: ProductCategory.OTHER,
        packaging: PackagingType.OTHER,
        costPrice: '' as string | number,
        wholesalePrice: '' as string | number,
        retailPrice: '' as string | number,
        showInClientPortal: false,
        manufacturer: '',
        batchNumber: '',
        nafdacNumber: '',
        imageUrl: '',
        isControlled: false
    });

    // Populate form if editing
    useEffect(() => {
        if (initialData) {
            setFormData(itemToFormData(initialData));
        }
    }, [initialData]);

    useEffect(() => {
        if (isEdit && initialData?.id) {
            const fetchDetails = async () => {
                setIsFetchingDetails(true);
                try {
                    const [fetchedItem, itemReconciliations] = await Promise.all([
                        api.inventory.getOne(initialData.id),
                        api.reconciliation.getByItem(initialData.id)
                    ]);
                    setFullItem(fetchedItem);
                    setReconciliations(itemReconciliations);
                    setFormData(itemToFormData(fetchedItem));
                } catch (error) {
                    console.error('Failed to fetch item details', error);
                } finally {
                    setIsFetchingDetails(false);
                }
            };
            fetchDetails();
        }
    }, [isEdit, initialData?.id]);

    const handleAddStock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullItem || stockForm.quantity <= 0) return;

        setIsFetchingDetails(true);
        try {
            await api.inventory.addBatch({
                itemId: fullItem.id,
                date: stockForm.date,
                quantity: stockForm.quantity
            });

            const updatedItem = await api.inventory.getOne(fullItem.id);
            setFullItem(updatedItem);
            await onSave(updatedItem, true);
            setFormData(itemToFormData(updatedItem));
            setIsAddingStock(false);
            setStockForm({ quantity: 0, date: new Date().toISOString().split('T')[0] });
            toast.success('Stock batch added');
        } catch (error: any) {
            console.error('Failed to add stock', error);
            toast.error(error?.data?.details || error?.message || 'Failed to update inventory');
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const handleReconcile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullItem) return;

        setIsFetchingDetails(true);
        try {
            await api.reconciliation.create({
                itemId: fullItem.id,
                physicalCount: reconcileForm.physicalCount,
                reason: reconcileForm.reason || undefined,
                notes: reconcileForm.notes || undefined
            });

            const [updatedItem, itemReconciliations] = await Promise.all([
                api.inventory.getOne(fullItem.id),
                api.reconciliation.getByItem(fullItem.id)
            ]);

            setFullItem(updatedItem);
            await onSave(updatedItem, true);
            setFormData(itemToFormData(updatedItem));
            setReconciliations(itemReconciliations);
            setReconcileForm({ physicalCount: 0, reason: '', notes: '' });
            setIsReconciling(false);
        } catch (error: any) {
            console.error('Failed to reconcile inventory', error);
            toast.error(error?.data?.details || error?.message || 'Failed to reconcile inventory');
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const handleDelete = () => {
        if (fullItem && onDeleteItem) {
            onDeleteItem(fullItem.id);
            onBack();
        }
    };

    const productImageInputRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        let finalValue: any = value;
        if (type === 'checkbox') {
            finalValue = checked;
        } else if (type === 'number') {
            // allow empty or string representation for better UI control
            if (value === '') {
                finalValue = '';
            } else {
                finalValue = value;
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: finalValue
        }));
    };



    const [updatingFields, setUpdatingFields] = useState<Set<string>>(new Set());

    const normalizeOption = <T extends string>(value: unknown, options: T[], fallback: T): T => {
        if (!value) return fallback;
        const normalized = String(value).trim().toLowerCase().replace(/[_-]+/g, ' ');
        return options.find(option => option.toLowerCase() === normalized) || fallback;
    };

    const normalizeDateInput = (value: unknown) => {
        if (!value) return '';
        const text = String(value).trim();
        const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (!match) return '';
        const [, year, month, day] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };

    const processImage = async (base64Image: string) => {
        if (scanInFlightRef.current) return;
        scanInFlightRef.current = true;
        setIsAnalyzing(true);
        setScanError('');
        setScanSuccess(false);
        try {
            const result: any = await analyzeProductImage(base64Image);

            // Guard against null/undefined API response
            if (!result || typeof result !== 'object') {
                setScanError("Could not extract product details. Please try again with a clearer image.");
                return;
            }

            const scannedSku = result.sku || result.barcode || result.productCode;
            const scannedDescription = [
                result.description,
                result.composition ? `Composition: ${result.composition}` : ''
            ].filter(Boolean).join('\n\n');
            const scannedCategory = result.category
                ? normalizeOption(result.category, Object.values(ProductCategory), ProductCategory.OTHER)
                : '';
            const scannedPackaging = result.packaging
                ? normalizeOption(result.packaging, Object.values(PackagingType), PackagingType.OTHER)
                : '';
            const scannedExpiryDate = normalizeDateInput(result.expiryDate);

            // Fields that we want to track for visual feedback
            const updated = new Set<string>();
            if (result.name) updated.add('name');
            if (scannedSku) updated.add('sku');
            if (scannedDescription) updated.add('description');
            if (scannedExpiryDate) updated.add('expiryDate');
            if (result.category) updated.add('category');
            if (result.packaging) updated.add('packaging');
            if (result.manufacturer) updated.add('manufacturer');
            if (result.batchNumber) updated.add('batchNumber');
            if (result.nafdacNumber) updated.add('nafdacNumber');

            setUpdatingFields(updated);
            setTimeout(() => setUpdatingFields(new Set()), 3000);

            // Update form fields with scanned data - CRITICAL: Ignore pricing
            setFormData(prev => ({
                ...prev,
                name: result.name || prev.name,
                sku: scannedSku || prev.sku || `SKU-${Date.now().toString().slice(-8)}`,
                description: scannedDescription || prev.description,
                expiryDate: scannedExpiryDate || prev.expiryDate,
                category: scannedCategory || prev.category,
                packaging: scannedPackaging || prev.packaging,
                manufacturer: result.manufacturer || prev.manufacturer,
                batchNumber: result.batchNumber || prev.batchNumber,
                nafdacNumber: result.nafdacNumber || prev.nafdacNumber,
                // Do NOT update retailPrice, wholesalePrice, or costPrice
                // Set smart defaults for scanned items if empty
                minThreshold: prev.minThreshold || 10,
                showInClientPortal: true
            }));

            setScanSuccess(true);
            setIsScanning(false);
            setTimeout(() => setScanSuccess(false), 2000);
        } catch (err) {
            console.error('Scan error:', err);
            // Only set error if not in a background live scan or if it's a persistent failure
            setScanError("Could not recognize product details. Please try again with better lighting.");
        } finally {
            setIsAnalyzing(false);
            scanInFlightRef.current = false;
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                processImage(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setFormData(prev => ({ ...prev, imageUrl: base64String }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProductSnap = (base64Image: string) => {
        setFormData(prev => ({ ...prev, imageUrl: base64Image }));
        setIsSnapping(false);
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError('');

        // Final sanitation of numeric inputs
        const sanitizedForm = {
            ...formData,
            quantity: Math.floor(Number(formData.quantity) || 0),
            minThreshold: Math.floor(Number(formData.minThreshold) || 10),
            costPrice: parseFloat(formData.costPrice.toString()) || 0,
            retailPrice: parseFloat(formData.retailPrice.toString()) || 0,
            wholesalePrice: parseFloat(formData.wholesalePrice.toString()) || 0
        };

        if (!sanitizedForm.name.trim()) {
            setValidationError('Product name is required');
            return;
        }
        if (sanitizedForm.costPrice < 0) {
            setValidationError('Cost price must be 0 or greater');
            return;
        }
        if (sanitizedForm.wholesalePrice < 0) {
            setValidationError('Wholesale price must be 0 or greater');
            return;
        }
        if (sanitizedForm.retailPrice <= 0) {
            setValidationError('Retail price must be greater than 0');
            return;
        }
        if (sanitizedForm.wholesalePrice >= sanitizedForm.retailPrice) {
            setValidationError('Wholesale price should be less than retail price');
            return;
        }

        // When editing, merge with ALL existing item data so no fields are lost
        if (isEdit && initialData) {
            const mergedItem = {
                ...initialData,       // Preserve ALL original fields (batches, sales, createdAt, etc.)
                ...(fullItem || {}),   // Include any freshly-fetched data
                ...sanitizedForm       // Override with the form's edited values
            };
            onSave(mergedItem);
        } else {
            onSave(sanitizedForm);
        }
    };

    return (
        <div className="animate-fade-in max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="w-12 h-12 soft-btn flex items-center justify-center text-slate-500 hover:text-amber-600"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-800">{isEdit ? 'Edit Item' : 'Add New Item'}</h1>
                        <p className="text-slate-400 font-medium">{isEdit ? 'Update product details' : 'Scan product or enter details manually'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setIsScanning(true)} disabled={isAnalyzing} className="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition flex items-center gap-2 disabled:opacity-50">
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />} Scan to Add
                    </button>
                    <button type="button" onClick={triggerFileUpload} disabled={isAnalyzing} className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 transition flex items-center gap-2 disabled:opacity-50">
                        <Upload className="w-4 h-4" /> Upload Label
                    </button>
                    <div className="relative group z-50">
                        <button type="button" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition flex items-center gap-2">
                            <Camera className="w-4 h-4" /> Add Image
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col gap-1">
                            <button type="button" onClick={() => setIsSnapping(true)} className="w-full text-left px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                <Camera className="w-4 h-4" /> Snap Photo
                            </button>
                            <button type="button" onClick={() => productImageInputRef.current?.click()} className="w-full text-left px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                <Upload className="w-4 h-4" /> Upload File
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {validationError && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center gap-3 animate-fade-in">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="font-bold">{validationError}</p>
                </div>
            )}

            <CameraModal
                isOpen={isScanning}
                onClose={() => setIsScanning(false)}
                onCapture={processImage}
                title="Smart Product Scan"
                hint="Scan product label or barcode"
                showScanLine={true}
                autoLive={true}
            />

            <CameraModal
                isOpen={isSnapping}
                onClose={() => setIsSnapping(false)}
                onCapture={handleProductSnap}
                title="Snap Product Photo"
                hint="Center your product for a clear photo"
                showScanLine={false}
            />

            {/* Analyzing Banner - shown when AI is processing the image */}
            {isAnalyzing && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-pulse shadow-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-amber-700 text-sm">AI is analyzing your product...</p>
                        <p className="text-xs text-amber-500">Form fields will be auto-populated in a moment.</p>
                    </div>
                </div>
            )}

            {/* Scan Success Banner */}
            {scanSuccess && !isAnalyzing && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-fade-in shadow-sm">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-emerald-700 text-sm">Product details extracted successfully!</p>
                        <p className="text-xs text-emerald-500">Review and complete the highlighted fields below.</p>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileUpload}
                />
                <input
                    type="file"
                    ref={productImageInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleProductImageUpload}
                />
                {scanError && !isScanning && (
                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-start gap-2 shadow-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="text-xs font-medium leading-tight">{scanError}</p>
                    </div>
                )}
                <div className="space-y-6">

                    {isEdit && fullItem && (
                        <div className="soft-card p-8 space-y-10 relative">
                            {isFetchingDetails && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-30 flex items-center justify-center rounded-[32px]">
                                    <div className="w-12 h-12 border-4 border-[#14B8A6] border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                            <div>
                                <h3 className="text-[10px] font-black text-[#14B8A6] uppercase tracking-[0.3em] mb-4">Stock Intelligence & Control</h3>
                                <div className="flex flex-wrap gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => { setIsReconciling(!isReconciling); setIsAddingStock(false); }}
                                        className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${isReconciling ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 border-transparent' : 'bg-white/60 backdrop-blur-md text-emerald-600 border-emerald-100 hover:bg-emerald-50'}`}
                                    >
                                        <Edit2 className="w-4 h-4" /> Reconcile Count
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => { setIsAddingStock(!isAddingStock); setIsReconciling(false); }}
                                        className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${isAddingStock ? 'bg-[#14B8A6] text-white shadow-lg shadow-amber-200 border-transparent' : 'bg-white/60 backdrop-blur-md text-[#14B8A6] border-amber-100 hover:bg-amber-50'}`}
                                    >
                                        <Plus className="w-4 h-4" /> Add New Batch
                                    </button>
                                </div>
                            </div>

                            {(isAddingStock || isReconciling) && (
                                <div className="p-8 rounded-[32px] bg-slate-50 border border-slate-100 shadow-inner animate-scale-in">
                                    {isReconciling ? (
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-end border-b border-slate-200 pb-6">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Physical Stock Count</p>
                                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Audit current shelf inventory</h4>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Delta</p>
                                                    <span className={`text-xl font-black ${reconcileForm.physicalCount > fullItem.quantity ? 'text-emerald-500' : reconcileForm.physicalCount < fullItem.quantity ? 'text-rose-500' : 'text-slate-400'}`}>
                                                        {reconcileForm.physicalCount > fullItem.quantity ? '+' : ''}{reconcileForm.physicalCount - fullItem.quantity}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Physical Count</label>
                                                    <input 
                                                        type="number" 
                                                        value={reconcileForm.physicalCount}
                                                        onChange={(e) => setReconcileForm({ ...reconcileForm, physicalCount: parseInt(e.target.value) || 0 })}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reason for Audit</label>
                                                    <select 
                                                        value={reconcileForm.reason}
                                                        onChange={(e) => setReconcileForm({ ...reconcileForm, reason: e.target.value })}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all uppercase"
                                                    >
                                                        <option value="">Select Reason</option>
                                                        <option value="Damage">Damaged Asset</option>
                                                        <option value="Theft">Unaccounted Loss</option>
                                                        <option value="Surplus">Inventory Surplus</option>
                                                        <option value="Periodic Audit">Standard Periodic Audit</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <button type="button" onClick={handleReconcile} disabled={isFetchingDetails} className="w-full py-4 rounded-xl bg-emerald-500 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                                {isFetchingDetails ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                Execute Inventory Adjustment
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Procurement Intake</p>
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Register incoming stock batch</h4>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Batch Quantity</label>
                                                    <input 
                                                        type="number" 
                                                        value={stockForm.quantity}
                                                        onChange={(e) => setStockForm({ ...stockForm, quantity: parseInt(e.target.value) || 0 })}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] outline-none transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inbound Date</label>
                                                    <input 
                                                        type="date" 
                                                        value={stockForm.date}
                                                        onChange={(e) => setStockForm({ ...stockForm, date: e.target.value })}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <button type="button" onClick={handleAddStock} disabled={isFetchingDetails} className="w-full py-4 rounded-xl bg-[#14B8A6] text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-amber-200 hover:bg-[#0F766E] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                                {isFetchingDetails ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                Confirm Procurement Entry
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction History</h4>
                                    <div className="h-px flex-1 mx-4 bg-slate-100 opacity-50" />
                                </div>
                                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                    {((fullItem.batches && fullItem.batches.length > 0) || (reconciliations && reconciliations.length > 0)) ? (
                                        <div className="space-y-3">
                                            {[...(fullItem.batches || []), ...(reconciliations || [])]
                                                .sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
                                                .map((entry: any, i) => (
                                                    <div key={i} className="group p-4 rounded-2xl bg-white border border-slate-100 hover:shadow-lg transition-all flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${entry.physicalCount !== undefined ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-[#FFFBEB] text-[#14B8A6] border-[#14B8A6]/20'}`}>
                                                                {entry.physicalCount !== undefined ? <Shield className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{entry.physicalCount !== undefined ? 'Audit Reconciliation' : 'Procurement Batch'}</p>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{new Date(entry.date || entry.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className={`text-sm font-black ${entry.physicalCount !== undefined ? (entry.physicalCount > entry.previousCount ? 'text-emerald-500' : 'text-rose-500') : 'text-[#14B8A6]'}`}>
                                                                {entry.physicalCount !== undefined ? (entry.physicalCount > entry.previousCount ? '+' : '') + (entry.physicalCount - entry.previousCount) : `+${entry.quantity}`}
                                                            </span>
                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">{entry.physicalCount !== undefined ? 'Adjustment' : 'Intake'}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center gap-3">
                                            <History className="w-8 h-8 text-slate-200" />
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">No Historical Data Found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="soft-card p-8 space-y-8">

                        {/* Product Core Info */}
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Product Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Product Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                        className={`w-full soft-input px-5 py-4 font-bold text-slate-700 placeholder-slate-400 transition-all duration-500 ${updatingFields.has('name') ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50' : ''}`}
                                        placeholder="e.g. Amoxicillin"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">SKU / Barcode <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                                    <input
                                        type="text"
                                        name="sku"
                                        value={formData.sku}
                                        onChange={handleInputChange}
                                        onPaste={(e) => {
                                            // Ensure paste works by explicitly setting value if needed, 
                                            // though default behavior usually works. This is a safeguard.
                                            const pastedText = e.clipboardData.getData('text');
                                            if (pastedText) {
                                                setFormData(prev => ({ ...prev, sku: pastedText }));
                                            }
                                        }}
                                        className={`w-full soft-input px-5 py-4 font-bold text-slate-700 placeholder-slate-400 transition-all duration-500 ${updatingFields.has('sku') ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50' : formData.sku ? 'border-green-300 bg-green-50/50' : ''}`}
                                        placeholder="Optional identifier"
                                    />
                                    {formData.sku && (
                                        <p className="text-xs text-green-600 font-medium ml-1">✓ SKU set</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Category</label>
                                    <div className="relative">
                                        <select
                                            name="category"
                                            value={formData.category}
                                            onChange={handleInputChange}
                                            className={`w-full soft-input px-5 py-4 font-bold text-slate-700 appearance-none bg-transparent transition-all duration-500 ${updatingFields.has('category') ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50' : ''}`}
                                        >
                                            {Object.values(ProductCategory).map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Packaging</label>
                                    <div className="relative">
                                        <select
                                            name="packaging"
                                            value={formData.packaging}
                                            onChange={handleInputChange}
                                            className={`w-full soft-input px-5 py-4 font-bold text-slate-700 appearance-none bg-transparent transition-all duration-500 ${updatingFields.has('packaging') ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50' : ''}`}
                                        >
                                            {Object.values(PackagingType).map(pkg => (
                                                <option key={pkg} value={pkg}>{pkg}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 ml-1">Description <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className={`w-full soft-input px-5 py-4 font-medium text-slate-700 placeholder-slate-400 transition-all duration-500 ${updatingFields.has('description') ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50' : ''}`}
                                    placeholder="Dosage, usage instructions, or notes..."
                                />
                            </div>
                            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Shield className="w-6 h-6 text-rose-500" />
                                    <div>
                                        <p className="font-bold text-rose-700 text-sm">Controlled Substance</p>
                                        <p className="text-[10px] text-rose-500 font-medium">Requires PIN verification for every usage log.</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="isControlled"
                                        checked={formData.isControlled}
                                        onChange={handleInputChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                                </label>
                            </div>
                        </div>

                        {/* Tracking & Dates */}
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 pt-6">Inventory & Tracking</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Quantity</label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        value={formData.quantity}
                                        onChange={handleInputChange}
                                        className="w-full soft-input px-5 py-3 font-bold text-slate-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Min Threshold</label>
                                    <input
                                        type="number"
                                        name="minThreshold"
                                        value={formData.minThreshold}
                                        onChange={handleInputChange}
                                        className="w-full soft-input px-5 py-3 font-bold text-slate-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Expiry Date <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                                    <input
                                        type="date"
                                        name="expiryDate"
                                        value={formData.expiryDate}
                                        onChange={handleInputChange}
                                        className={`w-full soft-input px-5 py-3 font-bold text-slate-700 text-sm transition-all duration-500 ${updatingFields.has('expiryDate') ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50' : ''}`}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Manufacturer <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                                    <input
                                        type="text"
                                        name="manufacturer"
                                        value={formData.manufacturer}
                                        onChange={handleInputChange}
                                        className={`w-full soft-input px-5 py-3 font-medium text-slate-700 transition-all duration-500 ${updatingFields.has('manufacturer') ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50' : ''}`}
                                        placeholder="Brand or Lab"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Batch Number <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                                    <input
                                        type="text"
                                        name="batchNumber"
                                        value={formData.batchNumber}
                                        onChange={handleInputChange}
                                        className={`w-full soft-input px-5 py-3 font-medium text-slate-700 transition-all duration-500 ${updatingFields.has('batchNumber') ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50' : ''}`}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">NAFDAC Number <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                                    <input
                                        type="text"
                                        name="nafdacNumber"
                                        value={formData.nafdacNumber}
                                        onChange={handleInputChange}
                                        className={`w-full soft-input px-5 py-3 font-medium text-slate-700 transition-all duration-500 ${updatingFields.has('nafdacNumber') ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50' : ''}`}
                                        placeholder="e.g. A4-1234"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 pt-6">Financials</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Cost Price *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{settings.currencySymbol}</span>
                                        <input
                                            type="number" step="0.01"
                                            name="costPrice"
                                            value={formData.costPrice}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full soft-input pl-8 pr-4 py-3 font-bold text-slate-700"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Wholesale <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{settings.currencySymbol}</span>
                                        <input
                                            type="number" step="0.01"
                                            name="wholesalePrice"
                                            value={formData.wholesalePrice}
                                            onChange={handleInputChange}
                                            className="w-full soft-input pl-8 pr-4 py-3 font-bold text-slate-700"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Retail Price *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{settings.currencySymbol}</span>
                                        <input
                                            type="number" step="0.01"
                                            name="retailPrice"
                                            value={formData.retailPrice}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full soft-input pl-8 pr-4 py-3 font-bold text-slate-700"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 transition">
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.showInClientPortal ? 'bg-amber-500 border-amber-500' : 'bg-transparent border-slate-300'}`}>
                                        {formData.showInClientPortal && <Check className="w-4 h-4 text-white" />}
                                    </div>
                                    <input type="checkbox" name="showInClientPortal" checked={formData.showInClientPortal} onChange={handleInputChange} className="hidden" />
                                    <span className="text-slate-600 font-bold text-sm group-hover:text-amber-600">Visible in Client Portal</span>
                                </label>
                            </div>
                        </div>

                        <div className="pt-8 flex justify-between items-center border-t border-slate-100">
                            <div>
                                {isEdit && onDeleteItem && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="px-6 py-3 rounded-2xl text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center gap-2 border border-transparent hover:border-rose-100"
                                    >
                                        <Trash2 className="w-4 h-4" /> Purge SKU From Registry
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="px-8 py-4 rounded-2xl text-slate-500 font-bold hover:bg-slate-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="soft-btn-primary px-10 py-4 rounded-2xl font-bold flex items-center gap-3 hover:-translate-y-1 transition-transform disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    {isSaving ? 'Saving...' : (isEdit ? 'Update Item' : 'Save Item')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
