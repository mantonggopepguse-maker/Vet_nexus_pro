import React, { useState, useEffect } from 'react';
import {
    Building2,
    Users,
    Database,
    Cpu,
    Link as LinkIcon,
    Plus,
    ShieldAlert,
    ShieldCheck,
    MoreVertical,
    Trash2,
    ExternalLink,
    Copy,
    CheckCircle2,
    Search,
    Crown,
    ArrowUpRight,
    Settings,
    Loader2,
    Mail,
    X,
    Activity,
    HardDrive
} from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';

interface Clinic {
    id: string;
    name: string;
    slug: string;
    status: 'Active' | 'Suspended';
    address?: string;
    country?: string;
    users: { name: string; email: string }[];
    subscription?: {
        plan: {
            id: string;
            name: string;
            displayName: string;
        };
        status: string;
        currentPeriodEnd?: string;
        billingCycle?: string;
    };
    storageUsage: number;
    ramUsage: number;
    _count?: {
        users: number;
        clients: number;
        patients?: number;
        sales?: number;
        appointments?: number;
    };
    activity24h?: number;
}

interface SubscriptionPlan {
    id: string;
    name: string;
    displayName: string;
    priceMonthly: number;
    priceYearly?: number;
}

interface SuperAdminDashboardProps {
    onViewClinic: (id: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onViewClinic }) => {
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [systemStats, setSystemStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [updatingSub, setUpdatingSub] = useState(false);
    const [manualPlanId, setManualPlanId] = useState('');
    const [useManualId, setUseManualId] = useState(false);

    // Enhanced Sub State
    const [subStatus, setSubStatus] = useState<'active' | 'past_due' | 'suspended' | 'cancelled'>('active');
    const [expiryDate, setExpiryDate] = useState('');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');

    // Create Clinic Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [creatingClinic, setCreatingClinic] = useState(false);
    const [newClinicData, setNewClinicData] = useState({
        name: '',
        address: '',
        email: '',
        phone: '',
        adminPassword: '',
        practiceType: '',
        planId: '',
        country: 'Nigeria',
        language: 'English',
        currencySymbol: '₦',
        acronym: '',
        status: 'Active',
        paymentReceived: false,
        emailVerified: false
    });

    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'info';
    } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [clinicsData, invitesData, plansData, statsData] = await Promise.all([
                api.superAdmin.getClinics(),
                api.superAdmin.getInvites(),
                api.superAdmin.getPlans().catch(() => []),
                api.superAdmin.getStats().catch(() => null)
            ]);
            setClinics(clinicsData);
            setInvites(invitesData);
            setPlans(plansData);
            setSystemStats(statsData);
        } catch (error) {
            console.error("Failed to load super admin data", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateClinic = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingClinic(true);
        const slug = newClinicData.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        const acronym = newClinicData.acronym || newClinicData.name.substring(0, 3).toUpperCase();

        try {
            const selectedPlan = plans.find(p => p.id === newClinicData.planId);
            if (selectedPlan && selectedPlan.name.toLowerCase() !== 'free') {
                if (!newClinicData.paymentReceived || !newClinicData.emailVerified) {
                    toast.error("For non-free plans, payment must be received and email verified before creation.");
                    setCreatingClinic(false);
                    return;
                }
            }

            await api.superAdmin.createClinic({
                ...newClinicData,
                slug,
                acronym,
                status: 'Active'
            });
            loadData();
            toast.success("Clinic and Admin user created successfully");
            setIsCreateModalOpen(false);
            setNewClinicData({
                name: '',
                address: '',
                email: '',
                phone: '',
                adminPassword: '',
                practiceType: '',
                planId: '',
                country: 'Nigeria',
                language: 'English',
                currencySymbol: '₦',
                acronym: '',
                status: 'Active',
                paymentReceived: false,
                emailVerified: false
            });
        } catch (error: any) {
            toast.error(error.message || "Failed to create clinic");
        } finally {
            setCreatingClinic(false);
        }
    };

    const handleToggleStatus = async (clinic: Clinic) => {
        const newStatus = clinic.status === 'Active' ? 'Suspended' : 'Active';
        setConfirmAction({
            title: `${newStatus === 'Active' ? 'Activate' : 'Suspend'} Clinic`,
            message: `Are you sure you want to ${newStatus === 'Active' ? 'activate' : 'suspend'} ${clinic.name}? Users of this clinic will be ${newStatus === 'Active' ? 'enabled' : 'disabled'}.`,
            type: newStatus === 'Active' ? 'info' : 'danger',
            onConfirm: async () => {
                try {
                    await api.superAdmin.updateClinic(clinic.id, { status: newStatus });
                    setClinics(prev => prev.map(c => c.id === clinic.id ? { ...c, status: newStatus } : c));
                    toast.success(`Clinic ${newStatus === 'Active' ? 'activated' : 'suspended'}`);
                } catch (error) {
                    toast.error("Failed to update clinic status");
                } finally {
                    setConfirmAction(null);
                }
            }
        });
    };

    const handleUpdateSubscription = async (manualId?: string) => {
        const planIdToUse = manualId || selectedPlanId;
        if (!selectedClinic || !planIdToUse) return;
        setUpdatingSub(true);
        try {
            await api.superAdmin.updateSubscription(selectedClinic.id, {
                planId: planIdToUse,
                status: subStatus,
                currentPeriodEnd: expiryDate,
                billingCycle: billingCycle
            });
            toast.success("Subscription updated successfully");
            setIsSubModalOpen(false);
            loadData();
        } catch (error: any) {
            toast.error(error?.message || "Failed to update subscription");
        } finally {
            setUpdatingSub(false);
            setConfirmAction(null);
        }
    };

    const confirmUpdateSubscription = () => {
        setConfirmAction({
            title: "Override Subscription?",
            message: `You are manually overriding the subscription for ${selectedClinic?.name}. This will bypass any automatic billing logic. Continue?`,
            type: 'info',
            onConfirm: () => handleUpdateSubscription()
        });
    };

    const handleCreateInvite = async () => {
        try {
            await api.superAdmin.createInvite({ expiresInDays: 7 });
            const invitesData = await api.superAdmin.getInvites();
            setInvites(invitesData);
            toast.success("Invite link generated");
        } catch (error) {
            toast.error("Failed to create invite");
        }
    };

    const handleDeleteClinic = async (clinic: Clinic) => {
        setConfirmAction({
            title: `Delete Clinic Permanently?`,
            message: `CRITICAL ACTION: This will permanently delete ${clinic.name} and ALL associated data (users, clients, patients, sales). This action CANNOT be undone.`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    await api.superAdmin.deleteClinic(clinic.id);
                    setClinics(prev => prev.filter(c => c.id !== clinic.id));
                    toast.success("Clinic deleted permanently");
                } catch (error) {
                    toast.error("Failed to delete clinic");
                } finally {
                    setConfirmAction(null);
                }
            }
        });
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        toast.success("Link copied to clipboard");
    };

    const filteredClinics = clinics.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const activeClinics = clinics.filter(c => c.status === 'Active').length;
    const suspendedClinics = clinics.filter(c => c.status !== 'Active').length;
    const pendingInvites = invites.length;
    const totalUsers = clinics.reduce((sum, clinic) => sum + (clinic._count?.users || 0), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
                    <p className="text-slate-500 font-medium animate-pulse">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            <div className="dashboard-hero">
                <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
                    <div className="space-y-5 max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500 shadow-[0_14px_30px_rgba(148,163,184,0.14)]">
                            <Crown className="w-4 h-4 text-amber-500" />
                            Super admin
                        </div>
                        <div>
                            <h1 className="section-title text-4xl md:text-5xl">Dashboard</h1>
                            <p className="mt-3 max-w-2xl text-base md:text-lg font-semibold text-slate-500">
                                Manage clinics, plans, invites, and system health from one calm dashboard.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Active clinics', value: activeClinics, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                                { label: 'Suspended', value: suspendedClinics, tone: 'bg-amber-50 text-amber-700 border-amber-100' },
                                { label: 'Open invites', value: pendingInvites, tone: 'bg-sky-50 text-sky-700 border-sky-100' },
                                { label: 'Team users', value: totalUsers, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
                            ].map((item) => (
                                <div key={item.label} className={`rounded-[1.4rem] border px-4 py-3 shadow-[0_14px_30px_rgba(148,163,184,0.12)] ${item.tone}`}>
                                    <div className="text-2xl font-black tracking-tight">{item.value}</div>
                                    <div className="mt-1 text-xs font-bold">{item.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={handleCreateInvite}
                            className="btn-luminous btn-luminous-accent px-6 py-3 text-xs shadow-xl"
                        >
                            <LinkIcon className="w-4 h-4 text-[#14B8A6]" />
                            New invite
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="btn-luminous btn-luminous-emerald px-6 py-3 text-xs shadow-2xl"
                        >
                            <Plus className="w-4 h-4" />
                            Add clinic
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total clinics', value: systemStats?.totalClinics || clinics.length, icon: Building2, prism: 'bg-sky-50/70 border-sky-100' },
                    { label: 'Active subscriptions', value: systemStats?.activeSubscriptions || 0, icon: Crown, prism: 'bg-amber-50/70 border-amber-100' },
                    { label: 'Total clients', value: systemStats?.totalClients || 0, icon: Users, prism: 'bg-emerald-50/70 border-emerald-100' },
                    { label: 'Storage used', value: `${(systemStats?.totalStorageMB || 0).toFixed(1)} MB`, icon: Database, prism: 'bg-rose-50/70 border-rose-100' }
                ].map((stat, i) => (
                    <div key={i} className={`dashboard-panel p-6 group transition-all duration-500 ${stat.prism}`}>
                        <div className="flex justify-between items-start mb-5">
                            <div className="p-4 rounded-[1.2rem] bg-white border border-white/80 shadow-[0_16px_32px_rgba(148,163,184,0.16)] text-slate-800 group-hover:-translate-y-1 transition-transform">
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.18em]">Overview</span>
                        </div>
                        <h4 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">{stat.value}</h4>
                        <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="dashboard-panel p-5 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="eyebrow-label">Clinic list</div>
                                <h2 className="section-title text-2xl mt-2">All clinics</h2>
                            </div>
                            <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by clinic name"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full rounded-2xl border border-white/80 bg-white/70 px-10 py-3 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_rgba(148,163,184,0.12)] outline-none transition-all focus:border-[#14B8A6]/30 focus:ring-4 focus:ring-[#14B8A6]/8"
                            />
                        </div>
                    </div>
                    </div>

                    <div className="grid gap-4">
                        {filteredClinics.map(clinic => (
                            <div key={clinic.id} className="dashboard-panel p-6 rounded-[2.2rem] group hover:-translate-y-1 transition-all duration-500">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#fff6ec] to-white shadow-[0_18px_34px_rgba(148,163,184,0.14)] flex items-center justify-center border border-white/80 group-hover:scale-105 transition-transform">
                                            <span className="text-xl font-black text-[#14B8A6] uppercase">
                                                {clinic.name.charAt(0)}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                                                {clinic.name}
                                                <span className={`w-2.5 h-2.5 rounded-full ${clinic.status === 'Active' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`} />
                                            </h3>
                                            <div className="flex items-center gap-4 mt-1.5">
                                                <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5 uppercase tracking-widest">
                                                    <LinkIcon className="w-3.5 h-3.5" />
                                                    {clinic.slug}
                                                </span>
                                                <span className="text-[10px] font-bold px-3 py-1 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 shadow-sm">
                                                    {clinic.subscription?.plan?.displayName || 'Free'} plan
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                setSelectedClinic(clinic);
                                                setSelectedPlanId(clinic.subscription?.plan?.id || '');
                                                setSubStatus(clinic.subscription?.status as any || 'active');
                                                setExpiryDate(clinic.subscription?.currentPeriodEnd ? new Date(clinic.subscription.currentPeriodEnd).toISOString().split('T')[0] : '');
                                                setBillingCycle(clinic.subscription?.billingCycle as any || 'monthly');
                                                setIsSubModalOpen(true);
                                            }}
                                            className="p-3 bg-white hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-[1.2rem] transition-all border border-slate-100 shadow-sm"
                                            title="Override Subscription"
                                        >
                                            <Crown className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onViewClinic(clinic.id)}
                                            className="p-3 bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-[1.2rem] transition-all border border-slate-100 shadow-sm"
                                            title="View Intelligence"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleToggleStatus(clinic)}
                                            className={`p-3 bg-white rounded-[1.2rem] transition-all border border-slate-100 shadow-sm ${clinic.status === 'Active'
                                                ? 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'
                                                : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                                                }`}
                                            title={clinic.status === 'Active' ? 'Suspend' : 'Activate'}
                                        >
                                            {clinic.status === 'Active' ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClinic(clinic)}
                                            className="p-3 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-[1.2rem] transition-all border border-slate-100 shadow-sm"
                                            title="Decommission Clinic"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-5 pt-5 border-t border-slate-100/80 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="rounded-[1.4rem] border border-emerald-100 bg-emerald-50/70 p-4">
                                            <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5">
                                                <Activity className="w-3 h-3" /> Activity (24h)
                                            </p>
                                            <span className="text-xs font-bold text-slate-600">{clinic.activity24h || 0} reqs</span>
                                        </div>
                                        <div className="w-full bg-white/80 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${((clinic.activity24h || 0) > 1000) ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(100, ((clinic.activity24h || 0) / 2000) * 100)}%` }}
                                            />
                                        </div>
                                        </div>
                                        
                                        <div className="rounded-[1.4rem] border border-sky-100 bg-sky-50/70 p-4">
                                            <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] font-black text-sky-700 uppercase tracking-widest flex items-center gap-1.5">
                                                <HardDrive className="w-3 h-3" /> Records
                                            </p>
                                            <span className="text-xs font-bold text-slate-600">
                                                {((clinic._count?.clients || 0) + (clinic._count?.patients || 0) + (clinic._count?.sales || 0))} total
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Users</p>
                                                <p className="text-xs font-black text-slate-700">{clinic._count?.users || 0}</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Clients</p>
                                                <p className="text-xs font-black text-slate-700">{clinic._count?.clients || 0}</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Patients</p>
                                                <p className="text-xs font-black text-slate-700">{clinic._count?.patients || 0}</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Storage</p>
                                                <p className="text-xs font-black text-slate-700">{clinic.storageUsage}MB</p>
                                            </div>
                                        </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="dashboard-panel p-6">
                        <div className="eyebrow-label">System snapshot</div>
                        <h2 className="section-title text-2xl mt-2">Platform health</h2>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-[1.3rem] border border-amber-100 bg-amber-50/70 p-4">
                                <div className="text-2xl font-black text-slate-900">{systemStats?.activeSubscriptions || 0}</div>
                                <div className="mt-1 text-sm font-semibold text-slate-500">Paid clinics</div>
                            </div>
                            <div className="rounded-[1.3rem] border border-rose-100 bg-rose-50/70 p-4">
                                <div className="text-2xl font-black text-slate-900">{pendingInvites}</div>
                                <div className="mt-1 text-sm font-semibold text-slate-500">Open invites</div>
                            </div>
                            <div className="rounded-[1.3rem] border border-sky-100 bg-sky-50/70 p-4">
                                <div className="text-2xl font-black text-slate-900">{(systemStats?.totalStorageMB || 0).toFixed(1)} MB</div>
                                <div className="mt-1 text-sm font-semibold text-slate-500">Storage used</div>
                            </div>
                            <div className="rounded-[1.3rem] border border-emerald-100 bg-emerald-50/70 p-4">
                                <div className="text-2xl font-black text-slate-900">{totalUsers}</div>
                                <div className="mt-1 text-sm font-semibold text-slate-500">Users</div>
                            </div>
                        </div>
                    </div>

                    <div>
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <Mail className="w-5 h-5 text-[#14B8A6]" />
                        Pending invites
                    </h2>
                    <div className="grid gap-4">
                        {invites.length === 0 ? (
                            <div className="dashboard-panel p-10 text-center border-2 border-dashed border-slate-200">
                                <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-500">No active invites</p>
                                <button
                                    onClick={handleCreateInvite}
                                    className="mt-4 text-xs font-black text-[#14B8A6] hover:text-[#14B8A6] underline"
                                >
                                    Create one now
                                </button>
                            </div>
                        ) : (
                            invites.map(invite => (
                                <div key={invite.id} className="dashboard-panel p-5 rounded-[1.8rem]">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                            <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Invite link</span>
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(invite.link || `https://app.vetnexuspro.com/?code=${invite.code}`, invite.id)}
                                            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-[#14B8A6] rounded-xl transition-all"
                                        >
                                            {copiedId === invite.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-50">
                                        <span className="font-medium text-slate-500">
                                            Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                                        </span>
                                        {invite.clinic && (
                                            <span className="font-bold text-[#14B8A6] bg-amber-50 px-2 py-0.5 rounded-full">
                                                {invite.clinic.name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    </div>
                </div>
            </div>

            {/* Create Clinic Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-white/50 flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Setup New Clinic</h3>
                                <p className="text-sm text-slate-500 font-bold">Configure clinic and master admin account</p>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-3 hover:bg-slate-200 rounded-2xl transition-all text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateClinic} className="p-8 space-y-6 overflow-y-auto">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 ml-1">Clinic Name</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="e.g. Blue Paw Hospital"
                                            value={newClinicData.name}
                                            onChange={e => setNewClinicData({ ...newClinicData, name: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 ml-1">Practice Type</label>
                                        <select
                                            required
                                            value={newClinicData.practiceType}
                                            onChange={e => setNewClinicData({ ...newClinicData, practiceType: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                                        >
                                            <option value="">Select Type</option>
                                            <option value="Small Animal">Small Animal</option>
                                            <option value="Large Animal">Large Animal</option>
                                            <option value="Mixed Practice">Mixed Practice</option>
                                            <option value="Equine">Equine</option>
                                            <option value="Exotic">Exotic</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 ml-1">Clinic Address</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Street, City"
                                            value={newClinicData.address}
                                            onChange={e => setNewClinicData({ ...newClinicData, address: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 ml-1">Clinic Phone</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="+234..."
                                            value={newClinicData.phone}
                                            onChange={e => setNewClinicData({ ...newClinicData, phone: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 ml-1">Acronym</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. BPH"
                                            value={newClinicData.acronym}
                                            onChange={e => setNewClinicData({ ...newClinicData, acronym: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 ml-1">Country</label>
                                        <select
                                            required
                                            value={newClinicData.country}
                                            onChange={e => {
                                                const country = e.target.value;
                                                let symbol = '₦';
                                                let lang = 'English';
                                                if (country === 'United States') symbol = '$';
                                                if (country === 'United Kingdom') symbol = '£';
                                                if (country === 'Ghana') symbol = '₵';
                                                if (country === 'Kenya') symbol = 'KSh';
                                                if (country === 'Europe') { symbol = '€'; lang = 'French'; }

                                                setNewClinicData({
                                                    ...newClinicData,
                                                    country,
                                                    currencySymbol: symbol,
                                                    language: lang
                                                });
                                            }}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                                        >
                                            <option value="Nigeria">Nigeria</option>
                                            <option value="United States">United States</option>
                                            <option value="United Kingdom">United Kingdom</option>
                                            <option value="Ghana">Ghana</option>
                                            <option value="Kenya">Kenya</option>
                                            <option value="Europe">Europe</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 ml-1">Admin Email</label>
                                        <input
                                            required
                                            type="email"
                                            placeholder="admin@clinic.com"
                                            value={newClinicData.email}
                                            onChange={e => setNewClinicData({ ...newClinicData, email: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 ml-1">Temporary Password</label>
                                        <input
                                            required
                                            type="password"
                                            placeholder="••••••••"
                                            value={newClinicData.adminPassword}
                                            onChange={e => setNewClinicData({ ...newClinicData, adminPassword: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Subscription Plan</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    {plans.length === 0 ? (
                                        <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                            <p className="text-xs text-slate-400 font-medium">Loading plans...</p>
                                        </div>
                                    ) : plans.map(plan => (
                                        <label
                                            key={plan.id}
                                            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${newClinicData.planId === plan.id
                                                ? 'border-[#14B8A6] bg-amber-50'
                                                : 'border-slate-100 bg-white hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    required
                                                    type="radio"
                                                    name="plan"
                                                    value={plan.id}
                                                    checked={newClinicData.planId === plan.id}
                                                    onChange={() => setNewClinicData({ ...newClinicData, planId: plan.id })}
                                                    className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-slate-300"
                                                />
                                                <div>
                                                    <p className="font-black text-slate-800 tracking-tight">{plan.displayName}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                        {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(plan.priceMonthly)}/mo
                                                    </p>
                                                </div>
                                            </div>
                                            {newClinicData.planId === plan.id && (
                                                <CheckCircle2 className="w-5 h-5 text-amber-600" />
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-100">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Verification</h4>
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all">
                                        <input
                                            type="checkbox"
                                            checked={newClinicData.emailVerified}
                                            onChange={e => setNewClinicData({ ...newClinicData, emailVerified: e.target.checked })}
                                            className="w-5 h-5 rounded-lg text-amber-600 focus:ring-amber-500 border-slate-300"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">Email Verified?</span>
                                            <span className="text-[10px] text-slate-400">Owner's email has been confirmed</span>
                                        </div>
                                        {newClinicData.emailVerified && <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto" />}
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all">
                                        <input
                                            type="checkbox"
                                            checked={newClinicData.paymentReceived}
                                            onChange={e => setNewClinicData({ ...newClinicData, paymentReceived: e.target.checked })}
                                            className="w-5 h-5 rounded-lg text-amber-600 focus:ring-amber-500 border-slate-300"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">First Payment Received?</span>
                                            <span className="text-[10px] text-slate-400">Initial subscription fee has been paid</span>
                                        </div>
                                        {newClinicData.paymentReceived && <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto" />}
                                    </label>
                                </div>
                            </div>

                            <div className="pt-6">
                                <button
                                    type="submit"
                                    disabled={creatingClinic}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                >
                                    {creatingClinic ? (
                                        <>
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            Setting Up...
                                        </>
                                    ) : (
                                        <>
                                            <Building2 className="w-6 h-6" />
                                            Initialize Clinic
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Subscription Manager Modal */}
            {isSubModalOpen && selectedClinic && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-white/50">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Manage Subscription</h3>
                                <p className="text-sm text-slate-500 font-medium">for {selectedClinic.name}</p>
                            </div>
                            <button
                                onClick={() => setIsSubModalOpen(false)}
                                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Current Plan</p>
                                    <span className="font-bold text-slate-800">
                                        {selectedClinic.subscription?.plan?.displayName || 'Free Plan'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Status</p>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${selectedClinic.subscription?.status === 'active' || !selectedClinic.subscription ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {selectedClinic.subscription?.status || 'Active'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 ml-1">Subscription Status</label>
                                    <select
                                        value={subStatus}
                                        onChange={e => setSubStatus(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                                    >
                                        <option value="active">Active</option>
                                        <option value="past_due">Past Due</option>
                                        <option value="suspended">Suspended</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 ml-1">Billing Cycle</label>
                                    <select
                                        value={billingCycle}
                                        onChange={e => setBillingCycle(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                                    >
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 ml-1">Override Expiry Date</label>
                                <input
                                    type="date"
                                    value={expiryDate}
                                    onChange={e => setExpiryDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                                />
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-[10px] text-slate-400 font-medium">Current: {selectedClinic.subscription?.currentPeriodEnd ? (new Date(selectedClinic.subscription.currentPeriodEnd).getFullYear() > 2099 ? 'Lifetime' : new Date(selectedClinic.subscription.currentPeriodEnd).toLocaleDateString()) : 'None'}</p>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const nextMonth = new Date();
                                            nextMonth.setMonth(nextMonth.getMonth() + 1);
                                            setExpiryDate(nextMonth.toISOString().split('T')[0]);
                                        }}
                                        className="text-[10px] font-black text-slate-600 hover:underline px-2 py-1 rounded-lg bg-slate-100"
                                    >
                                        + Grant 1 Month
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const nextYear = new Date();
                                            nextYear.setFullYear(nextYear.getFullYear() + 1);
                                            setExpiryDate(nextYear.toISOString().split('T')[0]);
                                        }}
                                        className="text-[10px] font-black text-amber-600 hover:underline px-2 py-1 rounded-lg bg-amber-50"
                                    >
                                        + Grant 1 Year
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm font-bold text-slate-700">Change Plan To:</p>
                                <div className="grid gap-3">
                                    {plans.map(plan => (
                                        <button
                                            key={plan.id}
                                            onClick={() => setSelectedPlanId(plan.id)}
                                            disabled={updatingSub || plan.id === selectedClinic.subscription?.plan?.id}
                                            className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${plan.id === selectedPlanId
                                                ? 'border-amber-600 bg-amber-50 cursor-default ring-1 ring-amber-600'
                                                : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                                                }`}
                                        >
                                            <div>
                                                <p className={`font-bold ${plan.id === selectedPlanId ? 'text-amber-700' : 'text-slate-700'}`}>
                                                    {plan.displayName}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(plan.priceMonthly)}/mo
                                                </p>
                                            </div>
                                            {plan.id === selectedPlanId && (
                                                <CheckCircle2 className="w-5 h-5 text-amber-600" />
                                            )}
                                            {!updatingSub && plan.id !== selectedPlanId && (
                                                <div className="hidden group-hover:block">
                                                    <ArrowUpRight className="w-5 h-5 text-slate-400" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <button
                                        onClick={() => setUseManualId(!useManualId)}
                                        className="text-xs font-bold text-slate-400 hover:text-amber-600 flex items-center gap-1 mb-2"
                                    >
                                        <Settings className="w-3 h-3" />
                                        Advanced: Enter Plan ID Manually
                                    </button>

                                    {useManualId && (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={manualPlanId}
                                                onChange={(e) => setManualPlanId(e.target.value)}
                                                placeholder="Enter Plan UUID..."
                                                className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                                            />
                                            <button
                                                onClick={() => { setSelectedPlanId(manualPlanId); setUseManualId(false); }}
                                                className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="mt-8 flex gap-4">
                                    <button
                                        onClick={() => setIsSubModalOpen(false)}
                                        className="flex-1 px-6 py-4 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmUpdateSubscription}
                                        disabled={updatingSub || !selectedPlanId}
                                        className="flex-[2] px-6 py-4 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-xl shadow-amber-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        {updatingSub ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="w-5 h-5" />
                                        )}
                                        {updatingSub ? 'Saving...' : 'Update Subscription'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Confirmation Modal */}
            {confirmAction && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                        <div className="p-8 text-center">
                            <div className={`w-16 h-16 rounded-3xl ${confirmAction.type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'} flex items-center justify-center mx-auto mb-6`}>
                                {confirmAction.type === 'danger' ? <ShieldAlert className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">{confirmAction.title}</h3>
                            <p className="text-sm font-bold text-slate-500 leading-relaxed mb-8">
                                {confirmAction.message}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="flex-1 py-3.5 rounded-2xl font-black text-slate-400 hover:bg-slate-100 transition-all border border-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmAction.onConfirm}
                                    className={`flex-1 py-3.5 rounded-2xl font-black text-white ${confirmAction.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} shadow-xl transition-all`}
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
