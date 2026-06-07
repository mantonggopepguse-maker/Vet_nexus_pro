import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
    Save, Building2, Wallet, FileText, Cloud, Check, 
    UserRound, Upload, Shield, CreditCard, Globe, 
    Bell, Settings as SettingsIcon, LayoutGrid, 
    Mail, Phone, MapPin, Briefcase, Loader2,
    Download, Trash2, AlertTriangle, FileSpreadsheet,
    Users, Package, ShoppingCart, HeartPulse
} from 'lucide-react';
import { ClinicSettings, User } from '../../types';
import { api } from '../../services/apiService';

interface SettingsProps {
    settings: ClinicSettings;
    user?: User | null;
    isSaving: boolean;
    onSave: (settings: ClinicSettings) => void;
    onUpdateUser?: (user: User) => void;
    onNavigate?: (view: string) => void;
}

type TabType = 'profile' | 'clinic' | 'financial' | 'integrations' | 'preferences' | 'privacy';

export const Settings: React.FC<SettingsProps> = ({ settings, user, isSaving, onSave, onUpdateUser, onNavigate }) => {
    const [formData, setFormData] = useState<ClinicSettings>(settings);
    const [activeTab, setActiveTab] = useState<TabType>('profile');
    const [isUploading, setIsUploading] = useState(false);
    const [pinData, setPinData] = useState({ pin: '', confirm: '' });

    // Privacy / deletion state
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<'account' | 'clinic' | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        setFormData(settings);
    }, [settings]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result as string;
                const updatedUser = await api.profile.updateAvatar(base64String);
                if (onUpdateUser && user) {
                    onUpdateUser({ ...user, avatarUrl: updatedUser.avatarUrl });
                }
                toast.success('Avatar updated');
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Failed to upload avatar', error);
            toast.error('Failed to upload avatar');
        } finally {
            setIsUploading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value
        }));
    };

    const handlePinUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pinData.pin.length !== 4) {
            toast.error('PIN must be 4 digits');
            return;
        }
        if (pinData.pin !== pinData.confirm) {
            toast.error('PINs do not match');
            return;
        }

        try {
            await api.post('/profile/pin', { pin: pinData.pin });
            toast.success('Narcotics PIN updated successfully');
            setPinData({ pin: '', confirm: '' });
        } catch (err: any) {
            toast.error(err.message || 'Failed to update PIN');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const isAdmin = user?.roles?.includes('Admin') || user?.isSuperAdmin;

    // ── PDF Export helper ──────────────────────────────────────────────
    const exportPDF = async (type: 'sales' | 'inventory' | 'clients' | 'patients') => {
        setIsExporting(type);
        try {
            // Dynamically load html2pdf.js from CDN
            if (!(window as any).html2pdf) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error('Failed to load html2pdf'));
                    document.head.appendChild(script);
                });
            }

            let data: any[] = [];
            let title = '';
            let columns: string[] = [];
            let rows: ((item: any) => string[]) = () => [];

            if (type === 'sales') {
                title = 'Sales & Revenue Ledger';
                columns = ['Invoice #', 'Date', 'Client', 'Items', 'Total', 'Status'];
                data = await api.sales.getAll(1, 10000);
                rows = (s: any) => [
                    s.invoiceNumber || s.id?.slice(0,8) || '-',
                    s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-',
                    s.client?.name || s.clientName || '-',
                    (s.items?.length || 0).toString(),
                    `GHS ${(s.total || 0).toFixed(2)}`,
                    s.paymentStatus || s.status || '-'
                ];
            } else if (type === 'inventory') {
                title = 'Inventory Stock Ledger';
                columns = ['Name', 'Category', 'Quantity', 'Unit', 'Reorder Lvl', 'Unit Price'];
                data = await api.inventory.getAll(1, 10000);
                rows = (i: any) => [
                    i.name || '-',
                    i.category || '-',
                    (i.quantity ?? '-').toString(),
                    i.unit || '-',
                    (i.reorderLevel ?? '-').toString(),
                    `GHS ${(i.unitPrice || 0).toFixed(2)}`
                ];
            } else if (type === 'clients') {
                title = 'Client Directory';
                columns = ['Name', 'Email', 'Phone', 'Address', 'Registered'];
                data = await api.clients.getAll(1, 10000);
                rows = (c: any) => [
                    c.name || '-',
                    c.email || '-',
                    c.phone || '-',
                    c.address || '-',
                    c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'
                ];
            } else {
                title = 'Patient Register';
                columns = ['Name', 'Species', 'Breed', 'Owner', 'DOB', 'Status'];
                data = await api.patients.getAll(1, 10000);
                rows = (p: any) => [
                    p.name || '-',
                    p.species || '-',
                    p.breed || '-',
                    p.client?.name || p.ownerName || '-',
                    p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : '-',
                    p.status || '-'
                ];
            }

            const clinicName = settings.name || 'VetNexus';
            const now = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

            const tableRows = data.map(item => rows(item)
                .map(cell => `<td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#475569">${cell}</td>`)
                .join('')
            ).map(r => `<tr>${r}</tr>`).join('');

            const headerCells = columns.map(c => `<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0">${c}</th>`).join('');

            const html = `
            <div style="font-family:'Segoe UI',Arial,sans-serif;padding:32px;max-width:900px;margin:0 auto">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #0f172a">
                <div>
                  <div style="font-size:9px;font-weight:900;letter-spacing:0.3em;text-transform:uppercase;color:#14B8A6;margin-bottom:8px">${clinicName}</div>
                  <h1 style="font-size:28px;font-weight:900;color:#0f172a;margin:0;letter-spacing:-0.04em">${title}</h1>
                  <p style="font-size:11px;color:#94a3b8;margin-top:6px">Exported on ${now} · ${data.length} records</p>
                </div>
                <div style="text-align:right">
                  <div style="font-size:9px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:#94a3b8">CONFIDENTIAL</div>
                  <div style="font-size:9px;color:#cbd5e1;margin-top:4px">VetNexus Pro Clinical System</div>
                </div>
              </div>
              <table style="width:100%;border-collapse:collapse">
                <thead><tr style="background:#f8fafc">${headerCells}</tr></thead>
                <tbody>${tableRows}</tbody>
              </table>
              <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:9px;color:#cbd5e1;text-align:center">
                This document is generated from VetNexus Pro and is intended for authorised use only.
              </div>
            </div>`;

            await (window as any).html2pdf().set({
                margin: 0,
                filename: `${clinicName.replace(/\s+/g,'-')}_${type}_${Date.now()}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: type === 'sales' ? 'landscape' : 'portrait' }
            }).from(html).save();
            toast.success(`${title} exported successfully`);
        } catch (err: any) {
            toast.error(err.message || 'Failed to generate PDF');
        } finally {
            setIsExporting(null);
        }
    };

    // ── Account Deletion ───────────────────────────────────────────────
    const handleDeleteAccount = async () => {
        const deleteClinic = showDeleteModal === 'clinic';
        const expected = deleteClinic ? (settings.name || 'DELETE CLINIC') : 'DELETE MY ACCOUNT';
        if (deleteConfirmText !== expected) {
            toast.error(`Please type "${expected}" exactly to confirm`);
            return;
        }
        setIsDeleting(true);
        try {
            await api.profile.deleteAccount(deleteClinic);
            toast.success(deleteClinic ? 'Clinic permanently purged' : 'Account deleted');
            setTimeout(() => {
                api.auth.logout();
                window.location.href = '/';
            }, 1500);
        } catch (err: any) {
            toast.error(err.message || 'Deletion failed');
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(null);
            setDeleteConfirmText('');
        }
    };

    const tabs = [
        { id: 'profile' as const, label: 'My Profile', icon: UserRound, color: 'text-amber-500', bg: 'bg-amber-50', show: true },
        { id: 'clinic' as const, label: 'Clinic Info', icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50', show: isAdmin },
        { id: 'financial' as const, label: 'Billing & Tax', icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-50', show: isAdmin },
        { id: 'integrations' as const, label: 'Integrations', icon: Cloud, color: 'text-orange-500', bg: 'bg-orange-50', show: isAdmin },
        { id: 'preferences' as const, label: 'Preferences', icon: LayoutGrid, color: 'text-slate-500', bg: 'bg-slate-50', show: true },
        { id: 'privacy' as const, label: 'Data & Privacy', icon: Shield, color: 'text-rose-500', bg: 'bg-rose-50', show: true },
    ].filter(t => t.show);

    return (
        <>
        <div className="space-y-10 animate-fade-in pb-32">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-5xl font-black text-slate-800 tracking-tighter uppercase leading-none">Control Center</h1>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-4">System Protocols & Administrative Intelligence</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="btn-luminous btn-luminous-emerald px-10 py-4 text-[11px] uppercase tracking-[0.2em] shadow-2xl"
                    >
                        {isSaving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        {isSaving ? 'Synchronizing...' : 'Commit Configuration'}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                {/* Elite Vertical Navigation */}
                <div className="lg:col-span-1 space-y-3">
                    <div className="bg-white/40 backdrop-blur-xl p-3 rounded-[2.5rem] border border-white/60 shadow-2xl ring-1 ring-white/10">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`w-full flex items-center gap-4 px-6 py-5 rounded-2xl transition-all duration-500 font-black uppercase tracking-widest group relative overflow-hidden ${
                                    activeTab === tab.id 
                                    ? 'text-slate-800' 
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {activeTab === tab.id && (
                                    <div className="absolute inset-0 bg-white rounded-2xl shadow-xl -z-10 animate-fade-in border border-slate-100"></div>
                                )}
                                <tab.icon className={`w-5 h-5 transition-transform duration-500 ${activeTab === tab.id ? 'scale-110 text-[#14B8A6]' : 'group-hover:scale-110'}`} />
                                <span className="text-[10px]">{tab.label}</span>
                                {activeTab === tab.id && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#14B8A6] shadow-[0_0_8px_#14B8A6]"></div>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="glass-card p-6 border-white/60">
                        <div className="flex items-center gap-4 text-slate-400">
                            <Shield className="w-5 h-5 opacity-30" />
                            <p className="text-[9px] font-black uppercase tracking-widest leading-relaxed">
                                Administrative Privileges <br />
                                <span className="text-[#14B8A6]">Level 4 Access</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3">
                    <div className="glass-card p-0 border-white/60 overflow-hidden">
                        <div className="p-10 lg:p-12">
                            {activeTab === 'profile' && (
                                <div className="space-y-12 animate-fade-in">
                                    <div className="flex flex-col md:flex-row items-center md:items-start gap-12 border-b border-slate-100 pb-12">
                                        <div className="relative group shrink-0">
                                            <div className="w-40 h-40 md:w-48 md:h-48 rounded-[3rem] bg-white border-4 border-white shadow-2xl overflow-hidden ring-1 ring-slate-100">
                                                {user?.avatarUrl ? (
                                                    <img src={user.avatarUrl} alt="DP" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-white font-black text-6xl">
                                                        {user?.name?.charAt(0) || 'V'}
                                                    </div>
                                                )}
                                                {isUploading && (
                                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center">
                                                        <Loader2 className="w-10 h-10 text-[#14B8A6] animate-spin" />
                                                    </div>
                                                )}
                                            </div>
                                            <label className="absolute -bottom-3 -right-3 w-14 h-14 rounded-2xl bg-white border border-slate-100 shadow-2xl flex items-center justify-center text-[#14B8A6] cursor-pointer hover:scale-110 active:scale-95 transition-all group-hover:border-[#14B8A6]/30">
                                                <Upload className="w-6 h-6" />
                                                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                            </label>
                                        </div>
                                        
                                        <div className="flex-1 text-center md:text-left space-y-8">
                                            <div>
                                                <h3 className="font-black text-5xl text-slate-800 tracking-tighter uppercase leading-none">{user?.name}</h3>
                                                <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-6">
                                                    {user?.roles?.map(role => (
                                                        <span key={role} className="px-5 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-200">
                                                            {role}
                                                        </span>
                                                    ))}
                                                    <span className="px-5 py-1.5 rounded-xl bg-white/60 backdrop-blur-md text-[#14B8A6] text-[10px] font-black uppercase tracking-[0.2em] border border-[#14B8A6]/20">
                                                        {user?.status}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto md:mx-0">
                                                <div className="bg-white/60 border border-white px-6 py-4 rounded-2xl shadow-sm flex items-center gap-4">
                                                    <Mail className="w-4 h-4 text-slate-400" />
                                                    <span className="font-black text-slate-600 text-[11px] uppercase tracking-widest truncate">{user?.email}</span>
                                                </div>
                                                <div className="bg-white/60 border border-white px-6 py-4 rounded-2xl shadow-sm flex items-center gap-4">
                                                    <Shield className="w-4 h-4 text-slate-400" />
                                                    <span className="font-black text-slate-600 text-[11px] uppercase tracking-widest">ID: {user?.id.slice(0, 8)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center shadow-xl">
                                                <Shield className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 text-xl uppercase tracking-tighter leading-none">Security Encryption Key</h4>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Required for restricted pharmaceutical authorization</p>
                                            </div>
                                        </div>

                                        <form onSubmit={handlePinUpdate} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end bg-[#FFFBEB]/40 p-8 rounded-[2.5rem] border border-[#14B8A6]/10">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Initial Vector (PIN)</label>
                                                <input 
                                                    type="password" 
                                                    maxLength={4}
                                                    placeholder="••••"
                                                    value={pinData.pin}
                                                    onChange={e => setPinData(prev => ({...prev, pin: e.target.value}))}
                                                    className="w-full bg-white border border-white px-6 py-4 rounded-2xl text-2xl font-black tracking-[0.8em] text-center focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Confirm Vector</label>
                                                <input 
                                                    type="password" 
                                                    maxLength={4}
                                                    placeholder="••••"
                                                    value={pinData.confirm}
                                                    onChange={e => setPinData(prev => ({...prev, confirm: e.target.value}))}
                                                    className="w-full bg-white border border-white px-6 py-4 rounded-2xl text-2xl font-black tracking-[0.8em] text-center focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner"
                                                />
                                            </div>
                                            <button 
                                                type="submit"
                                                className="btn-luminous btn-luminous-neutral bg-white py-5 text-[10px] uppercase tracking-[0.2em] shadow-xl"
                                            >
                                                Commit Protocol
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}                              {activeTab === 'clinic' && (
                                <div className="space-y-12 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Establishment Identity</label>
                                                <div className="relative">
                                                    <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#14B8A6]" />
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        value={formData.name}
                                                        onChange={handleChange}
                                                        className="w-full bg-white border border-slate-100 pl-14 pr-6 py-5 rounded-2xl text-sm font-black uppercase tracking-tight focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Clinical Specialization</label>
                                                <div className="relative">
                                                    <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                                    <select
                                                        name="practiceType"
                                                        value={formData.practiceType || ''}
                                                        onChange={handleChange}
                                                        className="w-full bg-white border border-slate-100 pl-14 pr-6 py-5 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-700 focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner appearance-none"
                                                    >
                                                        <option value="">Select practice type...</option>
                                                        <option value="Small Animal">Small Animal</option>
                                                        <option value="Mixed Practice">Mixed Practice</option>
                                                        <option value="Large Animal/Equine">Large Animal / Equine</option>
                                                        <option value="Exotic/Specialty">Exotic / Specialty</option>
                                                        <option value="Emergency/Critical Care">Emergency / Critical Care</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Protocol Identifier (Acronym)</label>
                                                <div className="relative">
                                                    <FileText className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                                    <input
                                                        type="text"
                                                        name="acronym"
                                                        value={formData.acronym}
                                                        onChange={handleChange}
                                                        placeholder="VET"
                                                        className="w-full bg-white border border-slate-100 pl-14 pr-6 py-5 rounded-2xl text-lg font-black text-slate-800 uppercase tracking-[0.3em] focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Geospatial Data (Address)</label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-5 top-6 w-5 h-5 text-rose-400" />
                                                    <textarea
                                                        name="address"
                                                        value={formData.address || ''}
                                                        onChange={handleChange}
                                                        rows={3}
                                                        className="w-full bg-white border border-slate-100 pl-14 pr-6 py-5 rounded-[2rem] text-sm font-bold text-slate-700 resize-none focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner uppercase tracking-tight"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Communication Terminal</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                                                    <input
                                                        type="text"
                                                        name="phone"
                                                        value={formData.phone || ''}
                                                        onChange={handleChange}
                                                        className="w-full bg-white border border-slate-100 pl-14 pr-6 py-5 rounded-2xl text-sm font-black focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner"
                                                    />
                                                </div>
                                            </div>

                                            <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100 shadow-inner flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-blue-500 shadow-xl border border-blue-50">
                                                        <Globe className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Multi-Branch Grid</p>
                                                        <p className="text-[9px] text-blue-400 font-black uppercase mt-1">Network Synchronization</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => onNavigate?.('BRANCHES')}
                                                    className="w-10 h-10 rounded-xl bg-white text-blue-600 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                                                >
                                                    <Globe className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}                                {activeTab === 'financial' && (
                                <div className="space-y-12 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl bg-[#F0FFF4] text-[#14B8A6] border border-[#14B8A6]/10 flex items-center justify-center shadow-xl">
                                                    <Wallet className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-xl uppercase tracking-tighter">Fiscal Infrastructure</h4>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Banking & Revenue Protocols</p>
                                                </div>
                                            </div>
                                            <div className="space-y-6 bg-white/40 p-8 rounded-[2.5rem] border border-white shadow-inner">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Financial Institution</label>
                                                    <input type="text" name="bankName" value={formData.bankName || ''} onChange={handleChange} className="w-full bg-white border border-slate-100 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-tight focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner" />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Account Beneficiary</label>
                                                    <input type="text" name="accountName" value={formData.accountName || ''} onChange={handleChange} className="w-full bg-white border border-slate-100 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-tight focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner" />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Routing Identifier</label>
                                                    <input type="text" name="accountNumber" value={formData.accountNumber || ''} onChange={handleChange} className="w-full bg-white border border-slate-100 px-6 py-4 rounded-2xl text-lg font-black tracking-[0.3em] focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner" />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Monetary Token</label>
                                                    <input type="text" name="currencySymbol" value={formData.currencySymbol || ''} onChange={handleChange} className="w-32 bg-white border border-slate-100 px-6 py-4 rounded-2xl text-2xl font-black text-center focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner text-[#14B8A6]" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 border border-blue-100 flex items-center justify-center shadow-xl">
                                                    <FileText className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-xl uppercase tracking-tighter">Tax Compliance</h4>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Automated Policy Enforcement</p>
                                                </div>
                                            </div>
                                            
                                            <div className="glass-card p-8 bg-gradient-to-br from-slate-50 to-white hover:shadow-2xl transition-all duration-500 group border-white/60">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <p className="font-black text-slate-800 uppercase text-xs tracking-widest">Autonomous Calculation</p>
                                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-tight">Apply standardized tax rates</p>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            name="taxEnabled"
                                                            checked={formData.taxEnabled}
                                                            onChange={handleChange}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                                                    </label>
                                                </div>

                                                {formData.taxEnabled && (
                                                    <div className="mt-10 space-y-3 animate-fade-in">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Rate Percentage</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                name="taxRate"
                                                                value={formData.taxRate}
                                                                onChange={handleChange}
                                                                className="w-full bg-white border border-slate-100 px-8 py-5 rounded-2xl text-3xl font-black focus:ring-2 focus:ring-[#14B8A6]/20 outline-none shadow-inner"
                                                            />
                                                            <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl">%</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white flex items-start gap-6 shadow-2xl relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
                                                <CreditCard className="w-10 h-10 text-[#14B8A6] shrink-0" />
                                                <div>
                                                    <h5 className="font-black text-lg uppercase tracking-tighter">Enterprise Plan</h5>
                                                    <p className="text-slate-400 text-[10px] mt-2 font-black uppercase tracking-widest leading-relaxed">
                                                        Active Subscription: <span className="text-white">{settings.subscription?.plan?.name || 'Vanguard Edition'}</span>
                                                    </p>
                                                    <button className="mt-6 text-[9px] font-black uppercase tracking-[0.2em] text-slate-900 bg-[#14B8A6] px-6 py-3 rounded-xl shadow-lg hover:translate-x-2 transition-transform active:scale-95">
                                                        Upgrade Hierarchy →
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}                              {activeTab === 'integrations' && (
                                <div className="space-y-12 animate-fade-in">
                                    <div className="max-w-3xl">
                                        <div className="flex items-center gap-5 mb-10">
                                            <div className="w-16 h-16 rounded-[1.5rem] bg-orange-500 text-white flex items-center justify-center shadow-2xl shadow-orange-200">
                                                <Cloud className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 text-2xl uppercase tracking-tighter">Third-Party Neural Grid</h4>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Cloud Synapse & External Storage</p>
                                            </div>
                                        </div>

                                        <div className="glass-card p-10 bg-gradient-to-br from-white to-slate-50 border-white/60 shadow-2xl group relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                                            
                                            <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10 mb-10">
                                                <div className="flex items-center gap-8">
                                                    <div className="w-24 h-24 rounded-[2rem] bg-white shadow-2xl flex items-center justify-center border-4 border-slate-50 ring-1 ring-slate-100">
                                                        <Globe className="w-12 h-12 text-blue-500" />
                                                    </div>
                                                    <div>
                                                        <h5 className="font-black text-slate-800 text-xl uppercase tracking-tighter">Google Drive Archive</h5>
                                                        <p className="text-[9px] text-[#14B8A6] font-black uppercase tracking-[0.3em] mt-2">High-Availability Storage</p>
                                                    </div>
                                                </div>
                                                {settings.googleDriveRefreshToken ? (
                                                    <div className="flex items-center gap-3 text-emerald-600 font-black bg-emerald-50 px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-emerald-100 shadow-sm animate-pulse">
                                                        <Check className="w-5 h-5" /> Connected
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-5 py-2 rounded-full uppercase tracking-widest border border-slate-200 shadow-inner">Terminal Offline</span>
                                                )}
                                            </div>

                                            <p className="text-slate-500 font-bold text-sm leading-relaxed mb-10 max-w-2xl">
                                                Enable autonomous synchronization of clinical dossiers, high-resolution imaging (X-Ray/MRI), and financial ledgers to your secure cloud infrastructure. 
                                                The system automatically constructs an indexed hierarchy for each client and patient entity.
                                            </p>

                                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-slate-100">
                                                <div className="flex -space-x-4">
                                                    {[1, 2, 3].map(i => (
                                                        <div key={i} className="w-12 h-12 rounded-full bg-slate-100 border-4 border-white flex items-center justify-center text-slate-400 font-black text-[10px] shadow-xl group-hover:-translate-y-2 transition-transform duration-500" style={{ transitionDelay: `${i * 100}ms` }}>{i === 3 ? '+12' : `S${i}`}</div>
                                                    ))}
                                                </div>
                                                
                                                <button
                                                    type="button"
                                                    disabled={!!settings.googleDriveRefreshToken}
                                                    onClick={async () => {
                                                        try {
                                                            const res = await api.settings.getDriveAuthUrl();
                                                            if (res.url) window.location.href = res.url;
                                                        } catch (e) {
                                                            console.error(e);
                                                            toast.error('Failed to initiate connection');
                                                        }
                                                    }}
                                                    className={`px-12 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl ${
                                                        settings.googleDriveRefreshToken 
                                                        ? 'bg-slate-100 text-slate-400 cursor-default border border-slate-200' 
                                                        : 'btn-luminous-emerald btn-luminous text-slate-900 border-4 border-white'
                                                    }`}
                                                >
                                                    {settings.googleDriveRefreshToken ? 'Protocol Active' : 'Initiate Handshake'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}                              {activeTab === 'preferences' && (
                                <div className="space-y-12 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-2xl">
                                                    <Bell className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-xl uppercase tracking-tighter">Signal Protocols</h4>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Notification & Alert Latency</p>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-4">
                                                {[
                                                    { id: 'notif_appointments', label: 'Appointment Reminders', desc: 'Pre-emptive staff alert (T-30m)' },
                                                    { id: 'notif_inventory', label: 'Critical Stock Depletion', desc: 'Real-time threshold monitoring' },
                                                    { id: 'notif_reports', label: 'Intelligence Briefing', desc: 'Weekly email performance audit' }
                                                ].map(pref => (
                                                    <div key={pref.id} className="flex items-center justify-between p-6 rounded-[2rem] bg-white border border-slate-100 hover:border-[#14B8A6]/30 hover:shadow-xl transition-all duration-500 group">
                                                        <div>
                                                            <p className="font-black text-slate-800 text-[11px] uppercase tracking-widest">{pref.label}</p>
                                                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-tight mt-1">{pref.desc}</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input type="checkbox" className="sr-only peer" defaultChecked />
                                                            <div className="w-12 h-6 bg-slate-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900 shadow-inner"></div>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl bg-[#FFFBEB] text-[#14B8A6] border border-[#14B8A6]/10 flex items-center justify-center shadow-xl">
                                                    <LayoutGrid className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-xl uppercase tracking-tighter">Interface Geometry</h4>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Visual Density & Grid Scaling</p>
                                                </div>
                                            </div>
                                            
                                            <div className="glass-card p-8 bg-amber-50/30 border-white/60 group hover:shadow-2xl transition-all duration-500">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <p className="font-black text-slate-800 uppercase text-xs tracking-widest">Temporal Roster</p>
                                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-tight">Enable shift-based synchronization</p>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            name="useShiftTimetable"
                                                            checked={formData.useShiftTimetable}
                                                            onChange={handleChange}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-slate-900 shadow-inner"></div>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] text-center mb-4">Rendering Resolution Mode</p>
                                                <div className="grid grid-cols-3 gap-4">
                                                    {['Compact', 'Optimum', 'Expanded'].map(mode => (
                                                        <button 
                                                            key={mode}
                                                            className={`py-5 rounded-2xl border transition-all font-black text-[10px] uppercase tracking-widest ${mode === 'Optimum' ? 'bg-slate-900 text-white shadow-2xl ring-4 ring-slate-900/10' : 'bg-white border-slate-100 text-slate-400 hover:border-[#14B8A6]/30 shadow-sm'}`}
                                                        >
                                                            {mode}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ══════════════ DATA & PRIVACY TAB ══════════════ */}
                            {activeTab === 'privacy' && (
                                <div className="space-y-12 animate-fade-in">
                                    {/* Header */}
                                    <div className="border-b border-slate-100 pb-8">
                                        <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Data &amp; Privacy</h2>
                                        <p className="text-xs text-slate-400 mt-2 font-medium">Export your clinical data as formal PDF reports, or manage your account lifecycle.</p>
                                    </div>

                                    {/* ── Export Cards ── */}
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Export Data as PDF</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            {[
                                                { key: 'sales' as const, label: 'Sales & Revenue Ledger', desc: 'All invoices, payments & financial records', icon: ShoppingCart, color: 'from-violet-500 to-purple-600' },
                                                { key: 'inventory' as const, label: 'Inventory Stock Ledger', desc: 'All stock items, quantities & valuations', icon: Package, color: 'from-orange-400 to-amber-500' },
                                                { key: 'clients' as const, label: 'Client Directory', desc: 'Full client contact & registration records', icon: Users, color: 'from-sky-400 to-blue-600' },
                                                { key: 'patients' as const, label: 'Patient Register', desc: 'Complete patient medical profiles', icon: HeartPulse, color: 'from-rose-400 to-pink-600' },
                                            ].map(({ key, label, desc, icon: Icon, color }) => (
                                                <div key={key} className="glass-card p-6 border-white/60 group hover:shadow-xl transition-all duration-300">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                                                            <Icon className="w-6 h-6 text-white" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-[11px] uppercase tracking-widest text-slate-800">{label}</p>
                                                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{desc}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => exportPDF(key)}
                                                        disabled={isExporting === key}
                                                        className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 active:scale-95 transition-all shadow-lg disabled:opacity-60"
                                                    >
                                                        {isExporting === key ? (
                                                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                                                        ) : (
                                                            <><Download className="w-4 h-4" /> Download PDF</>
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── Danger Zone ── */}
                                    <div className="border border-red-100 rounded-3xl overflow-hidden">
                                        <div className="bg-red-50 px-8 py-5 flex items-center gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-500" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600">Danger Zone</p>
                                        </div>
                                        <div className="p-8 space-y-6">
                                            {/* Delete personal account */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-red-100">
                                                <div>
                                                    <p className="font-black text-[11px] uppercase tracking-widest text-slate-800">Delete Personal Account</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">Permanently remove your staff profile from this clinic. Your clinical records will be preserved.</p>
                                                </div>
                                                <button
                                                    onClick={() => { setShowDeleteModal('account'); setDeleteConfirmText(''); }}
                                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all whitespace-nowrap flex-shrink-0"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete Account
                                                </button>
                                            </div>

                                            {/* Delete clinic — Admin only */}
                                            {isAdmin && (
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border-2 border-red-300">
                                                    <div>
                                                        <p className="font-black text-[11px] uppercase tracking-widest text-red-700">Purge Entire Clinic &amp; All Data</p>
                                                        <p className="text-[10px] text-red-400 mt-1">⚠️ This is irreversible. ALL data — clients, patients, sales, inventory — will be permanently deleted.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => { setShowDeleteModal('clinic'); setDeleteConfirmText(''); }}
                                                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all whitespace-nowrap flex-shrink-0 shadow-lg shadow-red-200"
                                                    >
                                                        <AlertTriangle className="w-4 h-4" /> Purge Clinic
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* ══════════════ DELETE CONFIRMATION MODAL ══════════════ */}
        {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(15,23,42,0.7)', backdropFilter:'blur(8px)'}}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-fade-in border border-red-100 overflow-hidden">
                    {/* Modal Header */}
                    <div className={`px-8 py-6 flex items-center gap-3 ${showDeleteModal === 'clinic' ? 'bg-red-600' : 'bg-slate-900'}`}>
                        <AlertTriangle className="w-6 h-6 text-white flex-shrink-0" />
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/60">Irreversible Action</p>
                            <h3 className="font-black text-white text-lg uppercase tracking-tight mt-0.5">
                                {showDeleteModal === 'clinic' ? 'Purge Entire Clinic' : 'Delete Personal Account'}
                            </h3>
                        </div>
                    </div>

                    {/* Modal Body */}
                    <div className="px-8 py-7 space-y-6">
                        <p className="text-sm text-slate-500 leading-relaxed">
                            {showDeleteModal === 'clinic'
                                ? `This will permanently delete your clinic "${settings.name || 'this clinic'}" and ALL associated data — clients, patients, sales, inventory, staff accounts, and all records. This cannot be undone.`
                                : 'Your personal staff profile will be permanently removed. Your historical clinical records (treatments, notes) will be preserved for compliance.'}
                        </p>

                        <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-3">
                                Type{' '}
                                <span className="font-mono bg-red-100 px-2 py-0.5 rounded-lg text-red-700">
                                    {showDeleteModal === 'clinic' ? (settings.name || 'DELETE CLINIC') : 'DELETE MY ACCOUNT'}
                                </span>{' '}
                                to confirm
                            </p>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={e => setDeleteConfirmText(e.target.value)}
                                placeholder="Type the confirmation text..."
                                className="w-full px-4 py-3 rounded-xl border-2 border-red-200 focus:border-red-400 outline-none font-mono text-sm text-slate-800 bg-white transition-colors"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => { setShowDeleteModal(null); setDeleteConfirmText(''); }}
                                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:border-slate-300 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting || deleteConfirmText !== (showDeleteModal === 'clinic' ? (settings.name || 'DELETE CLINIC') : 'DELETE MY ACCOUNT')}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-200"
                            >
                                {isDeleting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                                ) : (
                                    <><Trash2 className="w-4 h-4" /> {showDeleteModal === 'clinic' ? 'Purge Clinic' : 'Delete Account'}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
