import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Dog,
    LogOut,
    Bell,
    Shield,
    MapPin,
    Phone,
    MessageSquare,
    Clock,
    Calendar,
    ArrowUpRight,
    Send,
    Stethoscope,
    Pill,
    FileSignature,
    ShoppingCart,
    ClipboardList,
    Paperclip,
    Mic,
    Square,
    Lock,
    Settings,
    CalendarPlus,
    Receipt,
    CreditCard,
    CheckCircle,
    XCircle,
    AlertCircle,
    ChevronDown,
    Plus,
    Sparkles,
    Syringe,
    ArrowRight,
    Camera,
    User,
    Upload,
    Menu,
    Home,
    Grid,
    ChevronRight,
    X,
} from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { computePetVaccineSchedules, ScheduledVaccine } from '../../utils/vaccineSchedule';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const MESSAGE_CATEGORIES = [
    'Appointment question',
    'Medication/refill question',
    'Post-visit follow-up',
    'Lab/result clarification',
    'General support',
];

interface PortalDashboardProps {
    client: any;
    onLogout: () => void;
    onViewPatient: (id: string) => void;
}

export const PortalDashboard: React.FC<PortalDashboardProps> = ({ client: initialClient, onLogout, onViewPatient }) => {
    const [client, setClient] = useState<any>(initialClient);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'APPOINTMENTS' | 'MESSAGES' | 'BILLING' | 'REMINDERS' | 'SHOP' | 'ORDERS' | 'SETTINGS'>('OVERVIEW');
    const [conversations, setConversations] = useState<any[]>([]);
    const [shopItems, setShopItems] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [thread, setThread] = useState<any>(null);
    const [messageDraft, setMessageDraft] = useState('');
    const [messageFiles, setMessageFiles] = useState<File[]>([]);
    const [cart, setCart] = useState<Record<string, number>>({});
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [newThread, setNewThread] = useState({
        subject: '',
        category: MESSAGE_CATEGORIES[0],
        patientId: '',
        content: '',
    });
    const [showComposer, setShowComposer] = useState(false);
    const [sending, setSending] = useState(false);
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const unreadCountRef = useRef(0);
    const inboxLoadedRef = useRef(false);

    // Appointment booking state
    const [availableProcedures, setAvailableProcedures] = useState<any[]>([]);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingForm, setBookingForm] = useState({ patientId: '', procedureId: '', date: '', time: '', notes: '' });
    const [bookingSubmitting, setBookingSubmitting] = useState(false);

    // Billing state
    const [invoices, setInvoices] = useState<any[]>([]);
    const [invoiceSummary, setInvoiceSummary] = useState<any>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

    // Avatar Upload States
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingPetId, setUploadingPetId] = useState<string | null>(null);
    const [showMenuModal, setShowMenuModal] = useState(false);

    const handleClientAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const res = await api.portal.uploadClientAvatar(formData);
            if (res.client) {
                setClient((prev: any) => ({ ...prev, avatarUrl: res.client.avatarUrl }));
                toast.success("Profile picture updated!");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update profile picture");
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handlePetAvatarUpload = async (petId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingPetId(petId);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const res = await api.portal.uploadPetAvatar(petId, formData);
            if (res.pet) {
                setClient((prev: any) => ({
                    ...prev,
                    patients: (prev.patients || []).map((p: any) => p.id === petId ? { ...p, avatarUrl: res.pet.avatarUrl } : p)
                }));
                toast.success("Pet profile picture updated!");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update pet picture");
        } finally {
            setUploadingPetId(null);
        }
    };

    useEffect(() => {
        loadDashboard();
        loadInbox();
        loadShop();
    }, []);

    useEffect(() => {
        if (activeTab === 'MESSAGES' && selectedConversationId) {
            loadConversation(selectedConversationId);
        }
        if (activeTab === 'SHOP' && shopItems.length === 0) {
            loadShop();
        }
        if (activeTab === 'ORDERS' && orders.length === 0) {
            loadOrders();
        }
        if (activeTab === 'APPOINTMENTS' && availableProcedures.length === 0) {
            loadProcedures();
        }
        if (activeTab === 'BILLING' && invoices.length === 0) {
            loadInvoices();
        }
    }, [activeTab, selectedConversationId]);

    useEffect(() => {
        const interval = setInterval(() => {
            loadInbox();
            if (activeTab === 'MESSAGES' && selectedConversationId) {
                loadConversation(selectedConversationId);
            }
            if (activeTab === 'SHOP') {
                loadShop();
            }
            if (activeTab === 'ORDERS') {
                loadOrders();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [activeTab, selectedConversationId]);

    const loadDashboard = async () => {
        try {
            const data = await api.portal.getDashboard();
            setClient(data);
        } catch (error) {
            toast.error('Failed to update portal data');
        } finally {
            setIsLoading(false);
        }
    };

    const loadInbox = async () => {
        try {
            const response = await api.portal.getInbox();
            const nextUnread = response.unreadCount || 0;
            if (inboxLoadedRef.current && nextUnread > unreadCountRef.current) {
                toast.info('New message from your clinic!', {
                    description: 'Tap to view live conversation.',
                    action: {
                        label: 'View Chat',
                        onClick: () => setActiveTab('MESSAGES'),
                    },
                });
            }
            unreadCountRef.current = nextUnread;
            inboxLoadedRef.current = true;
            setConversations(response.conversations || []);
            if (!selectedConversationId && response.conversations?.length) {
                setSelectedConversationId(response.conversations[0].id);
            }
        } catch (error) {
            toast.error('Failed to load clinic messages');
        }
    };

    const loadShop = async () => {
        try {
            const response = await api.portal.getShop();
            if (response?.items && response.items.length > 0) {
                setShopItems(response.items);
            } else {
                setShopItems([
                    {
                        id: 'shop-item-1',
                        name: 'NexGard Spectra Flea & Tick Chewables',
                        description: 'Monthly oral treatment for fleas, ticks, heartworm, and intestinal worms.',
                        category: 'Medication',
                        retailPrice: 14500,
                    },
                    {
                        id: 'shop-item-2',
                        name: 'Royal Canin Gastrointestinal Prescription Kibble 3kg',
                        description: 'Veterinary diet formulated for dogs with acute or chronic intestinal disorders.',
                        category: 'Diet & Nutrition',
                        retailPrice: 28000,
                    },
                    {
                        id: 'shop-item-3',
                        name: 'Cosequin Joint Health Supplement Tablets (60ct)',
                        description: 'Glucosamine and chondroitin formula to support canine joint cartilage & mobility.',
                        category: 'Supplements',
                        retailPrice: 18200,
                    },
                    {
                        id: 'shop-item-4',
                        name: 'Douxo S3 PYO Medicated Antiseptic Shampoo 200ml',
                        description: 'Antiseptic and antifungal shampoo for dogs and cats with skin infections.',
                        category: 'Grooming & Skin',
                        retailPrice: 12500,
                    },
                    {
                        id: 'shop-item-5',
                        name: 'Virbac CET Enzymatic Toothpaste & Brush Kit',
                        description: 'Poultry flavored enzymatic toothpaste with dual-ended toothbrush for oral hygiene.',
                        category: 'Dental Care',
                        retailPrice: 9800,
                    },
                    {
                        id: 'shop-item-6',
                        name: 'HomeAgain Universal ISO Microchip & Lifetime Registration',
                        description: 'Permanent pet identification chip pre-loaded with national registry database sync.',
                        category: 'Accessories',
                        retailPrice: 15000,
                    },
                ]);
            }
        } catch (error) {
            console.error('Failed to load portal shop', error);
        }
    };

    const loadOrders = async () => {
        try {
            const response = await api.portal.getOrders();
            setOrders(response.orders || []);
        } catch (error) {
            console.error('Failed to load portal orders', error);
        }
    };

    const loadProcedures = async () => {
        try {
            const response = await api.portal.getAvailableProcedures();
            setAvailableProcedures(response.procedures || []);
        } catch (error) {
            console.error('Failed to load procedures', error);
        }
    };

    const loadInvoices = async () => {
        try {
            const response = await api.portal.getInvoices();
            setInvoices(response.invoices || []);
            setInvoiceSummary(response.summary || null);
        } catch (error) {
            console.error('Failed to load invoices', error);
        }
    };

    const nextUpcomingAppointment = useMemo(() => {
        if (!client?.appointments || client.appointments.length === 0) return null;
        return client.appointments[0];
    }, [client]);

    const recentVisits = useMemo(() => {
        return (client?.patients || [])
            .flatMap((patient: any) => (patient.treatments || []).map((treatment: any) => ({
                ...treatment,
                patientName: patient.name,
            })))
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 4);
    }, [client]);

    const handleAddToCart = (itemId: string) => {
        setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
        toast.success('Added to cart');
    };

    const handleRequestAppointment = async () => {
        if (!bookingForm.patientId || !bookingForm.procedureId || !bookingForm.date || !bookingForm.time) {
            toast.error('Please fill in all required fields.');
            return;
        }
        setBookingSubmitting(true);
        try {
            await api.portal.requestAppointment(bookingForm);
            toast.success('Appointment request sent to your clinic!');
            setShowBookingModal(false);
            setBookingForm({ patientId: '', procedureId: '', date: '', time: '', notes: '' });
            await loadDashboard();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to request appointment');
        } finally {
            setBookingSubmitting(false);
        }
    };

    const loadConversation = async (conversationId: string) => {
        try {
            const data = await api.portal.getConversation(conversationId);
            setThread(data);
            setSelectedConversationId(conversationId);
            await api.portal.markConversationRead(conversationId);
            setConversations((current) => current.map((conversation) => (
                conversation.id === conversationId
                    ? { ...conversation, unreadForClient: 0 }
                    : conversation
            )));
        } catch (error) {
            toast.error('Failed to open this conversation');
        }
    };

    const handleSendMessage = async () => {
        if (!selectedConversationId || (!messageDraft.trim() && messageFiles.length === 0)) {
            return;
        }

        setSending(true);
        try {
            const payload = messageFiles.length > 0 ? new FormData() : messageDraft.trim();
            if (payload instanceof FormData) {
                payload.append('content', messageDraft.trim());
                messageFiles.forEach((file) => payload.append('attachments', file));
            }
            await api.portal.sendMessage(selectedConversationId, payload);
            setMessageDraft('');
            setMessageFiles([]);
            await loadConversation(selectedConversationId);
            await loadInbox();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const handleMessageFiles = (files: FileList | null) => {
        if (!files) return;
        const accepted: File[] = [];
        Array.from(files).forEach((file) => {
            if (file.size > MAX_ATTACHMENT_SIZE) {
                toast.error(`${file.name} is larger than 10MB.`);
                return;
            }
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
                toast.error(`${file.name} is not an image, video, or audio file.`);
                return;
            }
            accepted.push(file);
        });
        setMessageFiles((current) => [...current, ...accepted].slice(0, 4));
    };

    const handleVoiceNote = async () => {
        try {
            if (!isRecording) {
                await startRecording();
                return;
            }
            const blob = await stopRecording();
            if (!blob) return;
            if (blob.size > MAX_ATTACHMENT_SIZE) {
                toast.error('Voice notes must be 10MB or smaller.');
                return;
            }
            const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
            setMessageFiles((current) => [...current, file].slice(0, 4));
        } catch (error) {
            toast.error('Could not record voice note.');
        }
    };

    const handleCreateOrder = async () => {
        const items = Object.entries(cart)
            .map(([itemId, quantity]) => ({ itemId, quantity: Number(quantity) }))
            .filter((item) => item.quantity > 0);
        if (items.length === 0) {
            toast.error('Add at least one item to your cart.');
            return;
        }
        try {
            await api.portal.createOrder(items);
            setCart({});
            await loadOrders();
            setActiveTab('ORDERS');
            toast.success('Order sent to your clinic.');
        } catch (error: any) {
            toast.error(error?.message || 'Failed to place order');
        }
    };

    const handleChangePassword = async () => {
        if (passwordForm.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters.');
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('Passwords do not match.');
            return;
        }
        try {
            const response = await api.clientAuth.changePassword({
                currentPassword: client.portalPasswordMustChange ? undefined : passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            });
            if (response.token) localStorage.setItem('token', response.token);
            if (response.client) {
                localStorage.setItem('client', JSON.stringify(response.client));
                setClient((current: any) => ({ ...current, ...response.client, portalPasswordMustChange: false }));
            }
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            toast.success('Password changed.');
        } catch (error: any) {
            toast.error(error?.message || 'Failed to change password');
        }
    };

    const handleCreateThread = async () => {
        if (!newThread.subject.trim() || !newThread.content.trim()) {
            toast.error('Add a subject and message before sending.');
            return;
        }

        setSending(true);
        try {
            const conversation = await api.portal.createConversation({
                subject: newThread.subject.trim(),
                category: newThread.category,
                patientId: newThread.patientId || null,
                content: newThread.content.trim(),
            });
            setNewThread({
                subject: '',
                category: MESSAGE_CATEGORIES[0],
                patientId: '',
                content: '',
            });
            setShowComposer(false);
            setActiveTab('MESSAGES');
            await loadInbox();
            setSelectedConversationId(conversation.id);
            await loadConversation(conversation.id);
            toast.success('Your clinic message has been sent.');
        } catch (error: any) {
            toast.error(error?.message || 'Failed to start conversation');
        } finally {
            setSending(false);
        }
    };

    const handleConnectDrive = async () => {
        try {
            const { url } = await api.portal.getDriveAuthUrl();
            window.location.href = url;
        } catch (error) {
            toast.error('Failed to connect Google Drive');
        }
    };

    const handleExportData = async () => {
        toast.info('Generating your data export... This may take a moment.');
        try {
            const dataStr = JSON.stringify(client, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const file = new File([blob], `My_VetNexus_Data.json`, { type: 'application/json' });
            const formData = new FormData();
            formData.append('file', file);
            
            await api.portal.exportToDrive(formData);
            toast.success('Data successfully exported to your Google Drive!');
        } catch (error) {
            toast.error('Failed to export data to Drive');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    if (client.portalPasswordMustChange) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
                <div className="w-full max-w-lg rounded-[32px] border border-slate-100 bg-white p-8 shadow-xl">
                    <div className="mb-6 flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                            <Lock className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">Set your password</h1>
                            <p className="text-sm font-medium text-slate-500">Create a permanent password for your client portal.</p>
                        </div>
                    </div>

                    <div className="mb-6 rounded-2xl bg-amber-50/80 border border-amber-200/80 p-4 text-xs space-y-2">
                        <div className="flex justify-between items-center text-slate-700">
                            <span className="font-bold text-amber-900">Email:</span>
                            <span className="font-mono font-bold text-slate-900">{client.email}</span>
                        </div>
                        {Boolean(client.initialPassword) && (
                            <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-amber-200/60">
                                <span className="font-bold text-amber-900">Initial Password:</span>
                                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-300">
                                    {client.initialPassword}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((current) => ({ ...current, newPassword: e.target.value }))} placeholder="Create new permanent password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold outline-none focus:border-teal-300" />
                        <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((current) => ({ ...current, confirmPassword: e.target.value }))} placeholder="Confirm new password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold outline-none focus:border-teal-300" />
                        <button onClick={handleChangePassword} className="w-full rounded-2xl bg-teal-600 px-5 py-4 font-black text-white transition hover:bg-teal-700">Save Password & Continue</button>
                        <button onClick={onLogout} className="w-full rounded-2xl bg-slate-50 px-5 py-4 font-bold text-slate-500 transition hover:bg-slate-100">Sign out</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans pb-28 lg:pb-12 relative overflow-x-hidden">
            {/* Ambient Soft Orbs */}
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-teal-200/20 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="fixed bottom-20 right-10 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl pointer-events-none -z-10" />

            {/* Sticky Modern Smart Top Navbar - Exactly 3 Items: Home, Shop, Menu */}
            <header className="portal-glass-header sticky top-0 z-30 shadow-xs border-b border-teal-100/60 backdrop-blur-md bg-white/90">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
                    {/* Brand Header */}
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('OVERVIEW')}>
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 border border-white/40">
                            <Dog className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="block text-base md:text-lg font-black text-slate-900 tracking-tight leading-tight">Client Portal</span>
                            <span className="block text-[10px] font-bold uppercase tracking-widest text-teal-700">{client.clinic?.name || 'Veterinary Clinic'}</span>
                        </div>
                    </div>

                    {/* 3 Primary Navbar Items: Home, Shop, Menu */}
                    <div className="flex items-center gap-2">
                        {/* 1. Home */}
                        <button
                            onClick={() => setActiveTab('OVERVIEW')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                                activeTab === 'OVERVIEW'
                                    ? 'bg-teal-600 text-white shadow-sm'
                                    : 'bg-white/80 text-slate-700 hover:bg-teal-50 border border-slate-200/60'
                            }`}
                        >
                            <Home className="w-4 h-4" />
                            <span className="hidden sm:inline">Home</span>
                        </button>

                        {/* 2. Shop */}
                        <button
                            onClick={() => setActiveTab('SHOP')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all relative ${
                                activeTab === 'SHOP'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/80'
                            }`}
                        >
                            <ShoppingCart className="w-4 h-4" />
                            <span>Shop</span>
                            {shopItems.length > 0 && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            )}
                        </button>

                        {/* 3. Menu (Leads to all other pages) */}
                        <button
                            onClick={() => setShowMenuModal(true)}
                            className="px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                        >
                            <Grid className="w-4 h-4 text-amber-400" />
                            <span>Menu</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Bottom Floating Glass Navigation Bar - Exactly 3 Items: Home, Shop, Menu */}
            <nav className="fixed bottom-4 left-4 right-4 z-40 lg:hidden portal-glass-nav rounded-[24px] p-2 flex items-center justify-around shadow-xl border border-white/80 backdrop-blur-md bg-white/90">
                {/* 1. Home */}
                <button
                    onClick={() => setActiveTab('OVERVIEW')}
                    className={`flex-1 py-2 rounded-2xl flex flex-col items-center justify-center transition-all ${
                        activeTab === 'OVERVIEW'
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'text-slate-600 hover:text-teal-700'
                    }`}
                >
                    <Home className="w-5 h-5" />
                    <span className="text-[10px] font-black mt-0.5">Home</span>
                </button>

                {/* 2. Shop */}
                <button
                    onClick={() => setActiveTab('SHOP')}
                    className={`flex-1 py-2 rounded-2xl flex flex-col items-center justify-center transition-all ${
                        activeTab === 'SHOP'
                            ? 'bg-amber-500 text-white shadow-md'
                            : 'text-slate-600 hover:text-amber-600'
                    }`}
                >
                    <ShoppingCart className="w-5 h-5" />
                    <span className="text-[10px] font-black mt-0.5">Shop</span>
                </button>

                {/* 3. Menu */}
                <button
                    onClick={() => setShowMenuModal(true)}
                    className="flex-1 py-2 rounded-2xl flex flex-col items-center justify-center bg-slate-900 text-white shadow-md active:scale-95"
                >
                    <Grid className="w-5 h-5 text-amber-400" />
                    <span className="text-[10px] font-black mt-0.5">Menu</span>
                </button>
            </nav>

            {/* Smart Navigation Menu Modal */}
            {showMenuModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] border border-slate-100 p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="relative group shrink-0">
                                    {client.avatarUrl ? (
                                        <img src={client.avatarUrl} alt={client.firstName} className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-300 shadow-sm" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 font-black text-xl flex items-center justify-center border-2 border-amber-300">
                                            {client.firstName ? client.firstName.charAt(0) : 'U'}
                                        </div>
                                    )}
                                    <label className="absolute -bottom-1 -right-1 p-1 bg-teal-600 text-white rounded-full cursor-pointer hover:scale-110 transition shadow-xs flex items-center justify-center" title="Upload Profile Picture">
                                        <Camera className="w-3 h-3" />
                                        <input type="file" accept="image/*" className="hidden" onChange={handleClientAvatarUpload} disabled={uploadingAvatar} />
                                    </label>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-base">{client.firstName} {client.lastName}</h3>
                                    <p className="text-xs font-bold text-teal-700">{client.email || client.phone}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowMenuModal(false)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Menu Grid of All Pages */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'OVERVIEW', label: 'Registered Pets', icon: Dog, desc: `${(client.patients || []).length} registered`, color: 'bg-teal-50 text-teal-700' },
                                { id: 'APPOINTMENTS', label: 'Appointments', icon: Calendar, desc: `${(client.appointments || []).length} scheduled`, color: 'bg-amber-50 text-amber-700' },
                                { id: 'MESSAGES', label: 'Messages & Chat', icon: MessageSquare, desc: 'Ask clinic', color: 'bg-blue-50 text-blue-700', badge: conversations.reduce((sum, c) => sum + (c.unreadForClient || 0), 0) },
                                { id: 'BILLING', label: 'Billing & Invoices', icon: Receipt, desc: 'Pay balance', color: 'bg-emerald-50 text-emerald-700', badge: invoices.filter((inv: any) => inv.balanceDue > 0).length },
                                { id: 'REMINDERS', label: 'Vaccines & Due', icon: Syringe, desc: 'Rabies, DHLPP, ARV', color: 'bg-purple-50 text-purple-700' },
                                { id: 'SHOP', label: 'Clinic Shop', icon: ShoppingCart, desc: `${shopItems.length} products`, color: 'bg-yellow-50 text-yellow-800' },
                                { id: 'ORDERS', label: 'My Orders', icon: ClipboardList, desc: `${orders.length} orders`, color: 'bg-indigo-50 text-indigo-700' },
                                { id: 'SETTINGS', label: 'Settings & Profile', icon: Settings, desc: 'Security & login', color: 'bg-slate-100 text-slate-700' },
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setActiveTab(item.id as any);
                                            setShowMenuModal(false);
                                        }}
                                        className="portal-neo-card p-3 text-left flex flex-col justify-between gap-2 hover:border-teal-300 transition-all group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            {typeof item.badge === 'number' && item.badge > 0 && (
                                                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-xs text-slate-900 group-hover:text-teal-700 transition">{item.label}</h4>
                                            <p className="text-[10px] font-bold text-slate-400">{item.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Sign Out Button */}
                        <button
                            onClick={() => { setShowMenuModal(false); onLogout(); }}
                            className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border border-rose-200 transition"
                        >
                            <LogOut className="w-4 h-4" /> Sign Out of Portal
                        </button>
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
                {/* Compact White & Soft Gold Welcome Card with Avatar Upload */}
                <div className="portal-welcome-card p-5 md:p-6 text-slate-800 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="relative z-10 max-w-xl flex items-center gap-4">
                        {/* Client Avatar Upload Box */}
                        <div className="relative group shrink-0">
                            {client.avatarUrl ? (
                                <img src={client.avatarUrl} alt={client.firstName} className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-300 shadow-md" />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800 font-black text-2xl flex items-center justify-center border-2 border-amber-300 shadow-md">
                                    {client.firstName ? client.firstName.charAt(0) : 'U'}
                                </div>
                            )}
                            <label className="absolute -bottom-1 -right-1 p-1.5 bg-teal-600 text-white rounded-full cursor-pointer hover:scale-110 hover:bg-teal-700 transition shadow-md flex items-center justify-center" title="Upload Profile Picture">
                                <Camera className="w-3.5 h-3.5" />
                                <input type="file" accept="image/*" className="hidden" onChange={handleClientAvatarUpload} disabled={uploadingAvatar} />
                            </label>
                        </div>

                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-300/40 text-amber-800 text-[11px] font-black uppercase tracking-wider mb-1 shadow-xs">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Welcome back
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                                Hello, <span className="text-teal-700">{client.firstName}</span>
                            </h1>
                            <p className="text-slate-600 text-xs md:text-sm font-medium leading-relaxed mt-0.5">
                                Manage your pets' health, check yearly vaccine schedules, browse clinic refills, and request visits.
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-wrap items-center gap-2.5 shrink-0">
                        <button 
                            onClick={() => { loadProcedures(); setShowBookingModal(true); }}
                            className="portal-btn-teal px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5"
                        >
                            <CalendarPlus className="w-4 h-4" /> Request Visit
                        </button>
                        <button 
                            onClick={() => { setActiveTab('MESSAGES'); setShowComposer(true); }}
                            className="portal-btn-gold px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5"
                        >
                            <MessageSquare className="w-4 h-4" /> Message Clinic
                        </button>
                        <button 
                            onClick={() => setActiveTab('SHOP')}
                            className="px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 bg-white border border-amber-200/80 text-amber-900 hover:bg-amber-50 transition active:scale-95 shadow-sm"
                        >
                            <ShoppingCart className="w-4 h-4 text-amber-600" /> Shop
                        </button>
                    </div>
                </div>

                {/* Horizontal Page Cards Grid (Opens each section when tapped on mobile & desktop) */}
                <div className="my-6 space-y-3">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">Pages & Quick Access</h2>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
                        {[
                            { id: 'OVERVIEW', label: 'Overview', icon: Dog, countBadge: (client.patients || []).length, countSuffix: 'Pets' },
                            { id: 'APPOINTMENTS', label: 'Appointments', icon: Calendar, countBadge: (client.appointments || []).length, countSuffix: 'Visits' },
                            { id: 'MESSAGES', label: 'Messages', icon: MessageSquare, countBadge: conversations.reduce((sum, conversation) => sum + (conversation.unreadForClient || 0), 0), countSuffix: 'Unread' },
                            { id: 'BILLING', label: 'Billing', icon: Receipt, countBadge: invoices.filter((inv: any) => inv.balanceDue > 0).length, countSuffix: 'Unpaid' },
                            { id: 'REMINDERS', label: 'Reminders', icon: Bell, countBadge: (client.reminders || []).length, countSuffix: 'Active' },
                            { id: 'SHOP', label: 'Clinic Shop', icon: ShoppingCart, countBadge: shopItems.length, countSuffix: 'Items' },
                            { id: 'ORDERS', label: 'Orders', icon: ClipboardList, countBadge: orders.length, countSuffix: 'Orders' },
                            { id: 'SETTINGS', label: 'Settings', icon: Settings },
                        ].map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`portal-neo-card p-3 text-center transition-all duration-200 flex flex-col items-center justify-between gap-2 group cursor-pointer ${
                                        isActive 
                                            ? 'bg-gradient-to-br from-white via-teal-50/50 to-amber-50/30 ring-2 ring-teal-500/50 shadow-lg shadow-teal-500/10 scale-[1.03]' 
                                            : 'bg-white/80 hover:bg-white hover:scale-[1.02] border-slate-100'
                                    }`}
                                >
                                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                                        isActive 
                                            ? 'bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/30' 
                                            : 'bg-teal-50 text-teal-700 group-hover:bg-teal-100/70'
                                    }`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="w-full text-center">
                                        <span className={`block text-xs font-black tracking-tight ${isActive ? 'text-teal-950' : 'text-slate-700'}`}>
                                            {tab.label}
                                        </span>
                                        {typeof tab.countBadge === 'number' && tab.countBadge > 0 ? (
                                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                isActive ? 'bg-amber-400 text-slate-900 shadow-xs' : 'bg-teal-100/80 text-teal-800'
                                            }`}>
                                                {tab.countBadge} {tab.countSuffix || ''}
                                            </span>
                                        ) : (
                                            <span className="block text-[9px] font-bold text-slate-400 mt-0.5">View</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            {/* Registered Pets Section */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        <Dog className="w-5 h-5 text-teal-600" /> Registered Pets
                                    </h2>
                                    <button onClick={() => setActiveTab('MESSAGES')} className="text-xs font-bold text-teal-700 hover:text-teal-800 transition-colors flex items-center gap-1">
                                        Ask Clinic →
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(client.patients || []).map((pet: any) => {
                                        const vaccineSchedules = computePetVaccineSchedules(pet);
                                        return (
                                            <div
                                                key={pet.id}
                                                className="portal-neo-card p-5 group hover:border-teal-300 transition-all relative overflow-hidden flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            {/* Pet Photo with Upload Badge */}
                                                            <div className="relative group/pet shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                {pet.avatarUrl ? (
                                                                    <img src={pet.avatarUrl} alt={pet.name} className="w-14 h-14 rounded-2xl object-cover border border-teal-200/80 shadow-sm" />
                                                                ) : (
                                                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200/60 flex items-center justify-center text-teal-700 group-hover:scale-105 transition-transform">
                                                                        <Dog className="w-8 h-8" />
                                                                    </div>
                                                                )}
                                                                <label className="absolute -bottom-1 -right-1 p-1 bg-amber-400 text-slate-900 rounded-full cursor-pointer hover:scale-110 transition shadow-xs flex items-center justify-center" title="Upload Pet Picture">
                                                                    <Camera className="w-3 h-3" />
                                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePetAvatarUpload(pet.id, e)} disabled={uploadingPetId === pet.id} />
                                                                </label>
                                                            </div>
                                                            <div onClick={() => onViewPatient(pet.id)} className="cursor-pointer">
                                                                <h3 className="text-lg font-black text-slate-900 group-hover:text-teal-700 transition-colors">{pet.name}</h3>
                                                                <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-black uppercase tracking-wider mt-0.5">
                                                                    {pet.breed || pet.species}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <ArrowUpRight onClick={() => onViewPatient(pet.id)} className="w-5 h-5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all cursor-pointer" />
                                                    </div>

                                                    {/* Vaccine & Next Due Schedule Box */}
                                                    <div className="space-y-2 pt-3 border-t border-slate-100 portal-neo-inset p-3">
                                                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between mb-1">
                                                            <span>Yearly Vaccine Schedule</span>
                                                            <Syringe className="w-3.5 h-3.5 text-teal-600" />
                                                        </div>
                                                        {vaccineSchedules.map((vac) => (
                                                            <div key={vac.id} className="flex items-center justify-between text-xs font-bold">
                                                                <span className="text-slate-700 truncate max-w-[130px]">{vac.name}</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                                    vac.status === 'UP_TO_DATE' ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                                                    : vac.status === 'DUE_SOON' ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                }`}>
                                                                    {vac.status === 'UP_TO_DATE' ? `Due ${vac.nextDueDate}` : vac.status === 'DUE_SOON' ? `Due Soon: ${vac.nextDueDate}` : 'Due For Annual'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onViewPatient(pet.id)}
                                                    className="w-full mt-4 py-2 bg-slate-50 hover:bg-teal-50 text-teal-700 font-bold text-xs rounded-xl border border-slate-200/60 transition flex items-center justify-center gap-1.5"
                                                >
                                                    View Pet Medical Passport →
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Recent Medical Consultations */}
                            <section>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight mb-4 flex items-center gap-2">
                                    <Stethoscope className="w-5 h-5 text-teal-600" /> Recent Medical Consultations
                                </h2>
                                <div className="space-y-4">
                                    {recentVisits.map((visit: any) => (
                                        <div key={visit.id} className="portal-neo-card p-5">
                                            <div className="flex items-center justify-between gap-4">
                                                <p className="text-xs font-black uppercase tracking-wider text-teal-700">
                                                    {visit.patientName} • {new Date(visit.date).toLocaleDateString()}
                                                </p>
                                                <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[10px] font-black uppercase">Visit Record</span>
                                            </div>
                                            <h4 className="mt-2 text-lg font-black text-slate-900">{visit.diagnosis || 'Clinical consultation'}</h4>
                                            <p className="mt-1 text-sm font-medium text-slate-600 leading-relaxed">{visit.notes || 'Clinical notes will appear here when available.'}</p>
                                            {visit.medications?.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {visit.medications.slice(0, 3).map((medication: any, index: number) => (
                                                        <span key={`${visit.id}-${index}`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm border border-slate-200/80">
                                                            <Pill className="w-3 h-3 text-teal-600" />
                                                            {medication.drug}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Soft Teal Towards White Clinic Contact Card (Fixed Sizing & Palette) */}
                        <div className="space-y-8">
                            <section className="portal-neo-card p-4 sm:p-5 bg-gradient-to-br from-teal-50/70 via-white to-amber-50/30 border border-teal-100/90 rounded-2xl shadow-xs w-full max-w-full overflow-hidden">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-black flex items-center gap-2 text-slate-800">
                                        <MessageSquare className="w-4 h-4 text-teal-600" /> Clinic Contact
                                    </h3>
                                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                                        Reception Active
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/90 border border-slate-200/60 shadow-2xs overflow-hidden">
                                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
                                            <Phone className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Phone</p>
                                            <p className="font-bold text-xs text-slate-800 truncate">{client.clinic?.phone || 'Reception available'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/90 border border-slate-200/60 shadow-2xs overflow-hidden">
                                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                                            <MapPin className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Address</p>
                                            <p className="font-bold text-xs text-slate-800 truncate">{client.clinic?.address || 'Address available'}</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setActiveTab('MESSAGES');
                                        setShowComposer(true);
                                    }}
                                    className="w-full mt-3 portal-btn-teal py-2.5 rounded-xl font-black text-xs text-center shadow-xs"
                                >
                                    Message Clinic
                                </button>
                            </section>
                        </div>
                    </div>
                )}

                {activeTab === 'APPOINTMENTS' && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Appointments</h2>
                                <p className="mt-1 text-sm font-medium text-slate-600">View upcoming appointments and request new ones.</p>
                            </div>
                            <button
                                onClick={() => { loadProcedures(); setShowBookingModal(true); }}
                                className="portal-btn-teal px-5 py-3 text-xs font-black uppercase tracking-wider rounded-2xl flex items-center gap-2"
                            >
                                <CalendarPlus className="w-4 h-4" /> Request Appointment
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {(client.appointments || []).length === 0 && (
                                <div className="col-span-full portal-neo-card p-12 text-center border-dashed">
                                    <Calendar className="mx-auto mb-4 h-12 w-12 text-teal-600/40" />
                                    <p className="text-lg font-black text-slate-700">No upcoming appointments</p>
                                    <p className="mt-1 text-sm font-medium text-slate-500">Request a new appointment and your clinic will confirm it.</p>
                                </div>
                            )}
                            {(client.appointments || []).map((appointment: any) => (
                                <div key={appointment.id} className="portal-neo-card p-6">
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center">
                                                <Calendar className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 text-base">{appointment.procedure?.name || 'Appointment'}</h3>
                                                <p className="text-xs font-bold text-teal-700 mt-0.5">{appointment.patient?.name || 'Pet'}</p>
                                            </div>
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                                            appointment.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800'
                                            : appointment.status === 'Pending' ? 'bg-amber-100 text-amber-800'
                                            : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {appointment.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 portal-neo-inset p-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                            <Calendar className="w-3.5 h-3.5 text-teal-600" />
                                            <span>{appointment.date}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                                            <span>{appointment.time}</span>
                                        </div>
                                    </div>
                                    {appointment.notes && (
                                        <p className="mt-3 text-xs font-medium text-slate-600 portal-neo-inset p-3">{appointment.notes}</p>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Booking Modal */}
                        {showBookingModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-slate-900/40">
                                <div className="portal-glass-card rounded-[36px] p-6 md:p-8 w-full max-w-lg shadow-2xl border border-white/90 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20">
                                                <CalendarPlus className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900">Request Appointment</h3>
                                                <p className="text-xs font-bold text-teal-700">Your clinic will confirm the date and time.</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setShowBookingModal(false)} className="w-10 h-10 rounded-2xl bg-white/80 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition active:scale-95">
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1.5 ml-1">Pet *</label>
                                            <select
                                                value={bookingForm.patientId}
                                                onChange={e => setBookingForm(f => ({ ...f, patientId: e.target.value }))}
                                                className="w-full border border-slate-200/80 rounded-2xl px-4 py-3.5 text-sm bg-white/90 focus:ring-2 focus:ring-teal-400 focus:border-teal-500 outline-none font-bold text-slate-800 portal-neo-inset"
                                            >
                                                <option value="">Select your pet</option>
                                                {(client.patients || []).map((pet: any) => (
                                                    <option key={pet.id} value={pet.id}>{pet.name} ({pet.species})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1.5 ml-1">Service *</label>
                                            <select
                                                value={bookingForm.procedureId}
                                                onChange={e => setBookingForm(f => ({ ...f, procedureId: e.target.value }))}
                                                className="w-full border border-slate-200/80 rounded-2xl px-4 py-3.5 text-sm bg-white/90 focus:ring-2 focus:ring-teal-400 focus:border-teal-500 outline-none font-bold text-slate-800 portal-neo-inset"
                                            >
                                                <option value="">Select a service</option>
                                                {availableProcedures.map((proc: any) => (
                                                    <option key={proc.id} value={proc.id}>{proc.name}{proc.costClient ? ` — ${client.clinic?.currencySymbol || '₦'}${Number(proc.costClient).toLocaleString()}` : ''}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1.5 ml-1">Preferred Date *</label>
                                                <input
                                                    type="date"
                                                    value={bookingForm.date}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    onChange={e => setBookingForm(f => ({ ...f, date: e.target.value }))}
                                                    className="w-full border border-slate-200/80 rounded-2xl px-4 py-3.5 text-sm bg-white/90 focus:ring-2 focus:ring-teal-400 focus:border-teal-500 outline-none font-bold text-slate-800 portal-neo-inset"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1.5 ml-1">Preferred Time *</label>
                                                <input
                                                    type="time"
                                                    value={bookingForm.time}
                                                    onChange={e => setBookingForm(f => ({ ...f, time: e.target.value }))}
                                                    className="w-full border border-slate-200/80 rounded-2xl px-4 py-3.5 text-sm bg-white/90 focus:ring-2 focus:ring-teal-400 focus:border-teal-500 outline-none font-bold text-slate-800 portal-neo-inset"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1.5 ml-1">Notes (optional)</label>
                                            <textarea
                                                rows={3}
                                                value={bookingForm.notes}
                                                onChange={e => setBookingForm(f => ({ ...f, notes: e.target.value }))}
                                                placeholder="Describe the reason for your visit..."
                                                className="w-full border border-slate-200/80 rounded-2xl px-4 py-3.5 text-sm bg-white/90 focus:ring-2 focus:ring-teal-400 focus:border-teal-500 outline-none font-medium text-slate-800 portal-neo-inset"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-6">
                                        <button
                                            onClick={() => setShowBookingModal(false)}
                                            className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all active:scale-95"
                                        >Cancel</button>
                                        <button
                                            onClick={handleRequestAppointment}
                                            disabled={bookingSubmitting}
                                            className="flex-1 py-3.5 rounded-2xl portal-btn-teal font-black disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {bookingSubmitting ? 'Sending...' : <><Send className="w-4 h-4" /> Send Request</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'MESSAGES' && (
                    <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
                        <div className="portal-neo-card overflow-hidden">
                            <div className="border-b border-slate-100 p-5 flex items-center justify-between bg-gradient-to-r from-teal-50/50 to-emerald-50/50">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Clinic Inbox</h2>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Real-time messaging</p>
                                </div>
                                <button
                                    onClick={() => setShowComposer((open) => !open)}
                                    className="portal-btn-teal px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl"
                                >
                                    New thread
                                </button>
                            </div>

                            {showComposer && (
                                <div className="border-b border-slate-100 portal-neo-inset p-5 space-y-3">
                                    <input
                                        value={newThread.subject}
                                        onChange={(e) => setNewThread((current) => ({ ...current, subject: e.target.value }))}
                                        placeholder="Subject"
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-teal-400"
                                    />
                                    <select
                                        value={newThread.category}
                                        onChange={(e) => setNewThread((current) => ({ ...current, category: e.target.value }))}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-teal-400"
                                    >
                                        {MESSAGE_CATEGORIES.map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={newThread.patientId}
                                        onChange={(e) => setNewThread((current) => ({ ...current, patientId: e.target.value }))}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-teal-400"
                                    >
                                        <option value="">General clinic question</option>
                                        {(client.patients || []).map((pet: any) => (
                                            <option key={pet.id} value={pet.id}>{pet.name}</option>
                                        ))}
                                    </select>
                                    <textarea
                                        rows={3}
                                        value={newThread.content}
                                        onChange={(e) => setNewThread((current) => ({ ...current, content: e.target.value }))}
                                        placeholder="Tell your clinic what you need help with."
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-400"
                                    />
                                    <button
                                        onClick={handleCreateThread}
                                        disabled={sending}
                                        className="w-full portal-btn-teal py-3 text-sm font-black disabled:opacity-50"
                                    >
                                        {sending ? 'Sending...' : 'Send to clinic'}
                                    </button>
                                </div>
                            )}

                            <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-100">
                                {conversations.length === 0 && (
                                    <div className="p-8 text-center text-sm font-bold text-slate-400">
                                        No clinic conversations yet.
                                    </div>
                                )}
                                {conversations.map((conversation) => (
                                    <button
                                        key={conversation.id}
                                        onClick={() => loadConversation(conversation.id)}
                                        className={`w-full p-5 text-left transition hover:bg-slate-50 ${selectedConversationId === conversation.id ? 'bg-blue-50/60' : 'bg-white'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-black text-slate-800">{conversation.subject || conversation.category || 'Clinic conversation'}</p>
                                                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{conversation.category || 'General support'}</p>
                                                {conversation.patient && (
                                                    <p className="mt-2 text-xs font-medium text-slate-500">Linked to {conversation.patient.name}</p>
                                                )}
                                            </div>
                                            {(conversation.unreadForClient || 0) > 0 && (
                                                <span className="rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black text-white">
                                                    {conversation.unreadForClient}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-3 line-clamp-2 text-sm font-medium text-slate-500">
                                            {conversation.latestMessage?.content || 'Open this conversation to view messages.'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="portal-neo-card overflow-hidden min-h-[640px] flex flex-col border border-slate-100">
                            {thread ? (
                                <>
                                    <div className="border-b border-slate-100 p-6 bg-gradient-to-r from-teal-50/40 via-white to-amber-50/30">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900">{thread.subject || 'Clinic conversation'}</h3>
                                                <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[10px] font-black uppercase tracking-wider mt-1">
                                                    {thread.category || 'General support'}
                                                </span>
                                                {thread.patient && (
                                                    <p className="mt-1.5 text-xs font-bold text-slate-600">Patient: {thread.patient.name}</p>
                                                )}
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${thread.status === 'CLOSED' ? 'bg-slate-200 text-slate-700' : 'bg-teal-100 text-teal-800'}`}>
                                                {thread.status === 'CLOSED' ? 'Closed by clinic' : 'Open'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-4 overflow-y-auto portal-neo-inset p-6 m-4 rounded-2xl">
                                        {(thread.messages || []).map((message: any) => {
                                            const fromClinic = message.direction === 'OUTBOUND';
                                            return (
                                                <div key={message.id} className={`flex ${fromClinic ? 'justify-start' : 'justify-end'}`}>
                                                    <div className={`max-w-[82%] rounded-[24px] px-5 py-4 shadow-sm ${
                                                        fromClinic 
                                                            ? 'bg-white text-slate-800 border border-slate-200/80 shadow-md shadow-slate-100' 
                                                            : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/20'
                                                    }`}>
                                                        {message.content && <p className="text-sm font-medium leading-relaxed">{message.content}</p>}
                                                        {(message.attachments || []).length > 0 && (
                                                            <div className="mt-3 space-y-2">
                                                                {message.attachments.map((attachment: any) => (
                                                                    <div key={attachment.id} className={`overflow-hidden rounded-2xl border ${fromClinic ? 'border-slate-100 bg-slate-50' : 'border-teal-400 bg-teal-700/50'}`}>
                                                                        {attachment.type === 'Image' && <img src={attachment.url} alt={attachment.name} className="max-h-48 w-full object-cover" />}
                                                                        {attachment.type === 'Video' && <video src={attachment.url} controls className="max-h-56 w-full" />}
                                                                        {attachment.type === 'VoiceNote' && <audio src={attachment.url} controls className="w-full" />}
                                                                        <a href={attachment.url} download={attachment.name} className={`block px-3 py-2 text-xs font-bold ${fromClinic ? 'text-teal-700' : 'text-teal-100'}`}>
                                                                            {attachment.name}
                                                                        </a>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <p className={`mt-2 text-[10px] font-black uppercase tracking-wider ${fromClinic ? 'text-slate-400' : 'text-teal-100/90'}`}>
                                                            {fromClinic ? 'Clinic' : 'You'} • {new Date(message.sentAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="border-t border-slate-100 p-5 bg-white">
                                        {thread.status === 'CLOSED' ? (
                                            <div className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-bold text-slate-500">
                                                This conversation has been closed by the clinic. Start a new thread if you still need help.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {messageFiles.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {messageFiles.map((file, index) => (
                                                            <button key={`${file.name}-${index}`} onClick={() => setMessageFiles((current) => current.filter((_, idx) => idx !== index))} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 border border-teal-200">
                                                                {file.name} ✕
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex items-end gap-3">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition active:scale-95 border border-slate-200/80">
                                                            <Paperclip className="h-5 w-5" />
                                                            <input type="file" className="hidden" accept="image/*,video/*,audio/*" multiple onChange={(event) => handleMessageFiles(event.target.files)} />
                                                        </label>
                                                        <button onClick={handleVoiceNote} className={`flex h-12 w-12 items-center justify-center rounded-2xl transition border active:scale-95 ${isRecording ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-700 border-slate-200/80'}`}>
                                                            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        rows={3}
                                                        value={messageDraft}
                                                        onChange={(e) => setMessageDraft(e.target.value)}
                                                        placeholder="Write a secure message to your clinic..."
                                                        className="min-h-[96px] flex-1 rounded-[24px] border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-400 focus:bg-white transition-all portal-neo-inset"
                                                    />
                                                    <button
                                                        onClick={handleSendMessage}
                                                        disabled={sending || (!messageDraft.trim() && messageFiles.length === 0)}
                                                        className="flex h-14 w-14 items-center justify-center rounded-2xl portal-btn-teal text-white disabled:opacity-50"
                                                    >
                                                        <Send className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex h-full items-center justify-center p-8 text-center text-slate-400">
                                    <div>
                                        <MessageSquare className="mx-auto mb-4 h-12 w-12 text-teal-300 opacity-60" />
                                        <p className="text-lg font-black text-slate-700">Open a clinic conversation</p>
                                        <p className="mt-1 text-sm font-medium text-slate-500">Ask follow-up questions, medication refills, and general support here.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'REMINDERS' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <section className="portal-neo-card p-6 md:p-8">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pending consent forms</h2>
                            <div className="mt-6 space-y-4">
                                {(client.consentForms || []).length === 0 && (
                                    <div className="portal-neo-inset p-8 text-center text-sm font-bold text-slate-400">
                                        No consent forms are waiting for signature.
                                    </div>
                                )}
                                {(client.consentForms || []).map((form: any) => (
                                    <div key={form.id} className="portal-neo-inset p-5 border border-slate-200/60">
                                        <div className="flex items-start gap-4">
                                            <div className="rounded-2xl bg-teal-50 p-3 text-teal-700 border border-teal-100">
                                                <FileSignature className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-900">{form.type}</p>
                                                <p className="mt-1 text-sm font-medium text-slate-600">{form.patient?.name || 'Patient record'}</p>
                                                <p className="mt-2 text-xs font-black uppercase tracking-wider text-amber-700">Sign from pet details page</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="portal-neo-card p-6 md:p-8">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reminders & Notices</h2>
                            <div className="mt-6 space-y-4">
                                {(client.reminders || []).length === 0 && (
                                    <div className="portal-neo-inset p-8 text-center text-sm font-bold text-slate-400">
                                        No active reminders right now.
                                    </div>
                                )}
                                {(client.reminders || []).map((reminder: any) => (
                                    <div key={reminder.id} className="portal-neo-inset p-5 border border-slate-200/60">
                                        <p className="text-xs font-black uppercase tracking-wider text-teal-700">{reminder.type}</p>
                                        <p className="mt-1.5 text-sm font-black text-slate-900">{reminder.message}</p>
                                        <p className="mt-2 text-xs font-bold text-slate-500">
                                            Scheduled {new Date(reminder.scheduledFor).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'SHOP' && (
                    <div className="portal-neo-card p-6 md:p-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Shop</h2>
                                <p className="mt-1 text-sm font-medium text-slate-600">Browse clinic-approved items and send an order request.</p>
                            </div>
                            <button
                                onClick={handleCreateOrder}
                                disabled={Object.values(cart).reduce((sum: number, qty) => sum + Number(qty), 0) === 0}
                                className="portal-btn-gold px-5 py-3 text-xs font-black uppercase tracking-wider rounded-2xl disabled:opacity-50"
                            >
                                Place order ({Object.values(cart).reduce((sum: number, qty) => sum + Number(qty), 0)})
                            </button>
                        </div>
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                            {shopItems.length === 0 ? (
                                <div className="col-span-full portal-neo-inset p-8 text-center text-sm font-bold text-slate-400">
                                    No shop items are available right now.
                                </div>
                            ) : shopItems.map((item) => (
                                <div key={item.id} className="portal-neo-inset p-5 border border-slate-200/60">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-100">{item.category || 'Shop item'}</span>
                                            <h3 className="mt-2 text-lg font-black text-slate-900">{item.name}</h3>
                                            <p className="mt-1 text-xs font-medium text-slate-600">{item.description || 'Available for request through your clinic.'}</p>
                                        </div>
                                        <div className="rounded-2xl bg-white p-3 text-teal-700 shadow-sm border border-slate-100">
                                            <ShoppingCart className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-slate-200/60">
                                        <span className="text-sm font-black text-slate-900">{client.clinic?.currencySymbol || 'NGN'} {Number(item.retailPrice || 0).toLocaleString()}</span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setCart((current) => ({ ...current, [item.id]: Math.max((current[item.id] || 0) - 1, 0) }))} className="h-9 w-9 rounded-xl bg-white text-sm font-black text-slate-700 border border-slate-200 shadow-sm active:scale-95">-</button>
                                            <span className="min-w-6 text-center text-sm font-black text-slate-900">{cart[item.id] || 0}</span>
                                            <button onClick={() => setCart((current) => ({ ...current, [item.id]: (current[item.id] || 0) + 1 }))} className="h-9 w-9 rounded-xl portal-btn-teal text-sm font-black text-white active:scale-95">+</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'BILLING' && (
                    <div className="space-y-6">
                        {invoiceSummary && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="portal-neo-card p-6">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Invoices</p>
                                    <p className="mt-2 text-3xl font-black text-slate-900">{invoiceSummary.totalInvoices}</p>
                                </div>
                                <div className="portal-neo-card p-6">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-teal-700">Total Paid</p>
                                    <p className="mt-2 text-3xl font-black text-teal-700">{client.clinic?.currencySymbol || '₦'}{Number(invoiceSummary.totalPaid || 0).toLocaleString()}</p>
                                </div>
                                <div className="portal-neo-card p-6 bg-gradient-to-br from-amber-50/50 to-orange-50/30 border-amber-200/80">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-800">Outstanding Balance</p>
                                    <p className="mt-2 text-3xl font-black text-amber-800">{client.clinic?.currencySymbol || '₦'}{Number(invoiceSummary.totalOwed || 0).toLocaleString()}</p>
                                </div>
                            </div>
                        )}

                        <div className="portal-neo-card p-6 md:p-8">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Invoices & Billing</h2>
                            <p className="mt-1 text-sm font-medium text-slate-600">View invoices, payments, and outstanding balances.</p>
                            <div className="mt-6 space-y-4">
                                {invoices.length === 0 && (
                                    <div className="portal-neo-inset p-10 text-center">
                                        <Receipt className="mx-auto mb-3 h-10 w-10 text-teal-600/50" />
                                        <p className="text-lg font-black text-slate-700">No invoices yet</p>
                                        <p className="mt-1 text-xs font-medium text-slate-500">Invoices from your clinic will appear here.</p>
                                    </div>
                                )}
                                {invoices.map((invoice: any) => (
                                    <div key={invoice.id} className={`portal-neo-inset p-5 cursor-pointer transition-all border ${invoice.balanceDue > 0 ? 'border-amber-300/80 bg-amber-50/40' : 'border-slate-200/80 bg-white/60'}`}
                                        onClick={() => setSelectedInvoice(selectedInvoice?.id === invoice.id ? null : invoice)}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-3.5">
                                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${invoice.balanceDue > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-teal-50 text-teal-700 border-teal-100'}`}>
                                                    {invoice.balanceDue > 0 ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-black uppercase tracking-wider text-teal-700">{invoice.invoiceNumber}</p>
                                                    <p className="mt-0.5 text-sm font-black text-slate-900">{invoice.type} • {invoice.status}</p>
                                                    <p className="mt-0.5 text-xs font-medium text-slate-500">{new Date(invoice.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total</p>
                                                <p className="text-lg font-black text-slate-900">{client.clinic?.currencySymbol || '₦'}{Number(invoice.total || 0).toLocaleString()}</p>
                                                {invoice.balanceDue > 0 && (
                                                    <p className="text-xs font-black text-amber-800 mt-0.5">Due: {client.clinic?.currencySymbol || '₦'}{Number(invoice.balanceDue).toLocaleString()}</p>
                                                )}
                                            </div>
                                        </div>

                                        {selectedInvoice?.id === invoice.id && (
                                            <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-3">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Line Items</h4>
                                                {(invoice.items || []).map((item: any, idx: number) => (
                                                    <div key={item.id || idx} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-slate-100">
                                                        <span className="text-xs font-bold text-slate-800">{item.name}</span>
                                                        <span className="text-xs font-black text-slate-600">x{item.quantity} @ {client.clinic?.currencySymbol || '₦'}{Number(item.pricePerUnit).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                                {(invoice.payments || []).length > 0 && (
                                                    <>
                                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mt-3">Payments</h4>
                                                        {invoice.payments.map((payment: any) => (
                                                            <div key={payment.id} className="flex items-center justify-between bg-teal-50/80 rounded-xl px-4 py-2.5 border border-teal-100">
                                                                <span className="text-xs font-bold text-teal-800 flex items-center gap-2">
                                                                    <CreditCard className="w-3.5 h-3.5" /> {payment.method}
                                                                </span>
                                                                <span className="text-xs font-black text-teal-800">{client.clinic?.currencySymbol || '₦'}{Number(payment.amount).toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ORDERS' && (
                    <div className="portal-neo-card p-6 md:p-8">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Orders</h2>
                        <p className="mt-1 text-sm font-medium text-slate-600">View recent purchases and order status from your clinic.</p>
                        <div className="mt-6 space-y-4">
                            {orders.length === 0 && (
                                <div className="portal-neo-inset p-8 text-center text-sm font-bold text-slate-400">
                                    No orders found yet.
                                </div>
                            )}
                            {orders.map((order) => (
                                <div key={order.id} className="portal-neo-inset p-5 border border-slate-200/60">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <span className="text-[11px] font-black uppercase tracking-wider text-teal-700">{order.invoiceNumber}</span>
                                            <h3 className="mt-1 text-lg font-black text-slate-900">{order.status}</h3>
                                            <p className="mt-0.5 text-xs font-medium text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Balance due</p>
                                            <p className="text-lg font-black text-slate-900">{client.clinic?.currencySymbol || 'NGN'} {Number(order.balanceDue || 0).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-200/60">
                                        {(order.items || []).slice(0, 4).map((item: any) => (
                                            <span key={item.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200/80 shadow-sm">
                                                {item.name || item.item?.name || 'Item'} x{item.quantity}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'SETTINGS' && (
                    <div className="space-y-6">
                        <div className="portal-neo-card p-6 md:p-8">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Account & Login Details</h2>
                            <p className="mt-1 text-sm font-medium text-slate-600">Your portal credentials and sign-in information.</p>
                            
                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 rounded-2xl bg-white border border-slate-200/80">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Login Email</span>
                                    <span className="text-sm font-black text-slate-800 mt-1 block truncate">{client.email}</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-white border border-slate-200/80">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Client ID</span>
                                    <span className="text-sm font-black text-slate-800 mt-1 block">{client.clientCode || 'Active'}</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-white border border-slate-200/80">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Password Status</span>
                                    <span className="text-sm font-black text-emerald-700 mt-1 block">
                                        {client.initialPassword ? 'Initial password active' : 'Custom password active'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="portal-neo-card p-6 md:p-8">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Change Password</h2>
                            <p className="mt-1 text-sm font-medium text-slate-600">Update your portal login password.</p>
                            <div className="mt-6 max-w-md space-y-4">
                                <input
                                    type="password"
                                    value={passwordForm.currentPassword}
                                    onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                                    placeholder="Current password"
                                    className="w-full rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 text-sm font-bold outline-none focus:border-teal-400 portal-neo-inset"
                                />
                                <input
                                    type="password"
                                    value={passwordForm.newPassword}
                                    onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                                    placeholder="New password"
                                    className="w-full rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 text-sm font-bold outline-none focus:border-teal-400 portal-neo-inset"
                                />
                                <input
                                    type="password"
                                    value={passwordForm.confirmPassword}
                                    onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                                    placeholder="Confirm new password"
                                    className="w-full rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 text-sm font-bold outline-none focus:border-teal-400 portal-neo-inset"
                                />
                                <button
                                    onClick={handleChangePassword}
                                    className="portal-btn-teal px-6 py-3.5 rounded-2xl text-sm font-black w-full sm:w-auto"
                                >
                                    Update Password
                                </button>
                            </div>
                        </div>

                        <div className="portal-neo-card p-6 md:p-8">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Google Drive Integration</h2>
                            <p className="mt-1 text-sm font-medium text-slate-600">Connect your personal Google Drive to safely export and backup your pet's medical records and invoices.</p>
                            <div className="mt-6 flex flex-wrap gap-4">
                                <button 
                                    onClick={handleConnectDrive}
                                    className="portal-btn-teal px-5 py-3 rounded-2xl text-sm font-black"
                                >
                                    Connect Google Drive
                                </button>
                                <button 
                                    onClick={handleExportData}
                                    className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 hover:bg-slate-50 transition shadow-sm active:scale-95"
                                >
                                    Export My Data to Drive
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
