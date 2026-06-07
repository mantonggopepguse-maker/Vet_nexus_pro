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
} from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

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
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MESSAGES' | 'REMINDERS' | 'SHOP' | 'ORDERS' | 'SETTINGS'>('OVERVIEW');
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

    useEffect(() => {
        loadDashboard();
        loadInbox();
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
    }, [activeTab, selectedConversationId]);

    useEffect(() => {
        const interval = setInterval(() => {
            loadInbox();
            if (activeTab === 'SHOP') {
                loadShop();
            }
            if (activeTab === 'ORDERS') {
                loadOrders();
            }
        }, 15000);

        return () => clearInterval(interval);
    }, [activeTab]);

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
                toast.info('New message from your clinic.');
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
            setShopItems(response.items || []);
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
        const items = Object.entries(cart).map(([itemId, quantity]) => ({ itemId, quantity })).filter((item) => item.quantity > 0);
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

    const recentVisits = useMemo(() => {
        return (client?.patients || [])
            .flatMap((patient: any) => (patient.treatments || []).map((treatment: any) => ({
                ...treatment,
                patientName: patient.name,
            })))
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 4);
    }, [client]);

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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (client.portalPasswordMustChange) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
                <div className="w-full max-w-lg rounded-[32px] border border-slate-100 bg-white p-8 shadow-xl">
                    <div className="mb-8 flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <Lock className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">Change temporary password</h1>
                            <p className="text-sm font-medium text-slate-500">Create a private password before entering your portal.</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((current) => ({ ...current, newPassword: e.target.value }))} placeholder="New password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold outline-none focus:border-blue-300" />
                        <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((current) => ({ ...current, confirmPassword: e.target.value }))} placeholder="Confirm new password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold outline-none focus:border-blue-300" />
                        <button onClick={handleChangePassword} className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-black text-white transition hover:bg-blue-700">Save Password</button>
                        <button onClick={onLogout} className="w-full rounded-2xl bg-slate-50 px-5 py-4 font-bold text-slate-500 transition hover:bg-slate-100">Sign out</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20 md:pb-0">
            <header className="bg-white/90 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                            <Dog className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="block text-xl font-black text-slate-800 tracking-tighter">Client Portal</span>
                            <span className="block text-xs font-bold uppercase tracking-widest text-slate-400">{client.clinic?.name || 'Veterinary Clinic'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative rounded-xl bg-blue-50 px-3 py-2 text-blue-700">
                            <Bell className="w-5 h-5" />
                            {(client.portalInbox?.unreadCount || conversations.reduce((sum, item) => sum + (item.unreadForClient || 0), 0)) > 0 && (
                                <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                                    {client.portalInbox?.unreadCount || conversations.reduce((sum, item) => sum + (item.unreadForClient || 0), 0)}
                                </span>
                            )}
                        </div>
                        <button onClick={onLogout} className="flex items-center gap-2 p-2 px-4 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all font-bold text-sm">
                            <LogOut className="w-4 h-4" /> <span className="hidden md:inline">Sign Out</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 rounded-[32px] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
                    <div className="relative z-10 max-w-3xl">
                        <div className="flex items-center gap-2 mb-4">
                            <Shield className="w-5 h-5 text-blue-300" />
                            <span className="text-xs font-black uppercase tracking-widest text-blue-300">Secure care workspace</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                            Welcome back, {client.firstName}.
                        </h1>
                        <p className="text-slate-300 text-lg md:text-xl font-medium leading-relaxed">
                            You can review pets, upcoming visits, follow-up care, and message your clinic directly from here.
                        </p>
                    </div>
                    <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
                </div>

                <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
                    <aside className="hidden lg:block self-start sticky top-28">
                        <div className="rounded-[32px] border border-slate-100 bg-white p-3 shadow-sm space-y-2">
                            {[
                                { id: 'OVERVIEW', label: 'Overview', icon: Dog },
                                { id: 'MESSAGES', label: 'Messages', icon: MessageSquare, badge: conversations.reduce((sum, conversation) => sum + (conversation.unreadForClient || 0), 0) },
                                { id: 'REMINDERS', label: 'Reminders', icon: Bell },
                                { id: 'SHOP', label: 'Shop', icon: ShoppingCart, badge: shopItems.length },
                                { id: 'ORDERS', label: 'Orders', icon: ClipboardList, badge: orders.length },
                                { id: 'SETTINGS', label: 'Settings', icon: Settings },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                                        activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                                    }`}
                                >
                                    <span className="flex items-center gap-3 text-sm font-black">
                                        <tab.icon className="w-4 h-4" />
                                        {tab.label}
                                    </span>
                                    {typeof tab.badge === 'number' && tab.badge > 0 && (
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </aside>

                    <div className="space-y-10">
                        <div className="lg:hidden flex flex-wrap gap-3">
                            {[
                                { id: 'OVERVIEW', label: 'Overview' },
                                { id: 'MESSAGES', label: `Messages${conversations.some((conversation) => conversation.unreadForClient) ? ` (${conversations.reduce((sum, conversation) => sum + (conversation.unreadForClient || 0), 0)})` : ''}` },
                                { id: 'REMINDERS', label: 'Reminders & Forms' },
                                { id: 'SHOP', label: 'Shop' },
                                { id: 'ORDERS', label: 'Orders' },
                                { id: 'SETTINGS', label: 'Settings' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                                        activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-slate-500 hover:text-blue-600'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        <div className="lg:col-span-2 space-y-10">
                            <section>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Your Pets</h2>
                                    <button onClick={() => setActiveTab('MESSAGES')} className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                        Message clinic
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {(client.patients || []).map((pet: any) => {
                                        const latestVaccination = pet.vaccinations?.[0];
                                        const latestLab = pet.labResults?.[0];
                                        return (
                                            <div
                                                key={pet.id}
                                                onClick={() => onViewPatient(pet.id)}
                                                className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group"
                                            >
                                                <div className="flex items-start justify-between mb-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                            <Dog className="w-8 h-8" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xl font-black text-slate-800">{pet.name}</h3>
                                                            <p className="text-sm font-bold text-slate-400">{pet.breed || pet.species}</p>
                                                        </div>
                                                    </div>
                                                    <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                </div>

                                                <div className="space-y-3 pt-4 border-t border-slate-50">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-slate-400 font-bold flex items-center gap-2"><Shield className="w-4 h-4" /> Latest vaccine</span>
                                                        <span className="text-slate-700 font-black">
                                                            {latestVaccination ? new Date(latestVaccination.dateGiven).toLocaleDateString() : 'Not recorded'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-slate-400 font-bold flex items-center gap-2"><Stethoscope className="w-4 h-4" /> Latest lab</span>
                                                        <span className="text-slate-700 font-black">
                                                            {latestLab ? new Date(latestLab.testDate).toLocaleDateString() : 'Not recorded'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <section>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-6">Recent Visit History</h2>
                                <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-6">
                                    {recentVisits.length === 0 && (
                                        <div className="py-12 text-center text-slate-400 font-bold">No recent visit history available yet.</div>
                                    )}
                                    {recentVisits.map((visit: any) => (
                                        <div key={visit.id} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                                                {visit.patientName} • {new Date(visit.date).toLocaleDateString()}
                                            </p>
                                            <h4 className="mt-2 text-lg font-black text-slate-800">{visit.diagnosis || 'Clinical consultation'}</h4>
                                            <p className="mt-2 text-sm font-medium text-slate-500">{visit.notes || 'Clinical notes will appear here when available.'}</p>
                                            {visit.medications?.length > 0 && (
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {visit.medications.slice(0, 3).map((medication: any, index: number) => (
                                                        <span key={`${visit.id}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                                                            <Pill className="w-3 h-3 text-blue-500" />
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

                        <div className="space-y-10">
                            <section>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-6">Upcoming</h2>
                                <div className="space-y-4">
                                    {(client.appointments || []).map((appointment: any) => (
                                        <div key={appointment.id} className="bg-white rounded-3xl p-6 border-l-4 border-l-blue-600 border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                    <Calendar className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{appointment.date}</p>
                                                    <h4 className="font-black text-slate-800">{appointment.procedure?.name || 'Appointment'}</h4>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-500 bg-slate-50 p-3 rounded-xl">
                                                <Clock className="w-4 h-4" /> {appointment.time}
                                            </div>
                                        </div>
                                    ))}
                                    {(!client.appointments || client.appointments.length === 0) && (
                                        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400 font-bold">
                                            No upcoming appointments.
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="bg-blue-600 rounded-[32px] p-8 text-white">
                                <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                                    <MessageSquare className="w-6 h-6" /> Clinic Contact
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                                            <Phone className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-blue-200">Phone</p>
                                            <p className="font-bold">{client.clinic?.phone || 'Clinic phone available from reception'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                                            <MapPin className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-blue-200">Location</p>
                                            <p className="font-bold">{client.clinic?.address || 'Clinic address available on request'}</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setActiveTab('MESSAGES');
                                        setShowComposer(true);
                                    }}
                                    className="w-full mt-8 bg-white text-blue-600 py-4 rounded-2xl font-black text-sm hover:bg-blue-50 transition-colors"
                                >
                                    Start a secure message
                                </button>
                            </section>
                        </div>
                    </div>
                )}

                {activeTab === 'MESSAGES' && (
                    <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
                        <div className="rounded-[32px] border border-slate-100 bg-white shadow-sm overflow-hidden">
                            <div className="border-b border-slate-100 p-5 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-slate-800">Clinic Inbox</h2>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Secure, text-only messaging</p>
                                </div>
                                <button
                                    onClick={() => setShowComposer((open) => !open)}
                                    className="rounded-2xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700"
                                >
                                    New thread
                                </button>
                            </div>

                            {showComposer && (
                                <div className="border-b border-slate-100 bg-slate-50/70 p-5 space-y-3">
                                    <input
                                        value={newThread.subject}
                                        onChange={(e) => setNewThread((current) => ({ ...current, subject: e.target.value }))}
                                        placeholder="Subject"
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300"
                                    />
                                    <select
                                        value={newThread.category}
                                        onChange={(e) => setNewThread((current) => ({ ...current, category: e.target.value }))}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300"
                                    >
                                        {MESSAGE_CATEGORIES.map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={newThread.patientId}
                                        onChange={(e) => setNewThread((current) => ({ ...current, patientId: e.target.value }))}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300"
                                    >
                                        <option value="">General clinic question</option>
                                        {(client.patients || []).map((pet: any) => (
                                            <option key={pet.id} value={pet.id}>{pet.name}</option>
                                        ))}
                                    </select>
                                    <textarea
                                        rows={4}
                                        value={newThread.content}
                                        onChange={(e) => setNewThread((current) => ({ ...current, content: e.target.value }))}
                                        placeholder="Tell your clinic what you need help with."
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300"
                                    />
                                    <button
                                        onClick={handleCreateThread}
                                        disabled={sending}
                                        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-black disabled:opacity-50"
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

                        <div className="rounded-[32px] border border-slate-100 bg-white shadow-sm overflow-hidden min-h-[640px] flex flex-col">
                            {thread ? (
                                <>
                                    <div className="border-b border-slate-100 p-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800">{thread.subject || 'Clinic conversation'}</h3>
                                                <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-400">{thread.category || 'General support'}</p>
                                                {thread.patient && (
                                                    <p className="mt-2 text-sm font-medium text-slate-500">Patient: {thread.patient.name}</p>
                                                )}
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${thread.status === 'CLOSED' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {thread.status === 'CLOSED' ? 'Closed by clinic' : 'Open'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-6">
                                        {(thread.messages || []).map((message: any) => {
                                            const fromClinic = message.direction === 'OUTBOUND';
                                            return (
                                                <div key={message.id} className={`flex ${fromClinic ? 'justify-start' : 'justify-end'}`}>
                                                    <div className={`max-w-[78%] rounded-[24px] px-5 py-4 shadow-sm ${fromClinic ? 'bg-white text-slate-700' : 'bg-blue-600 text-white'}`}>
                                                        {message.content && <p className="text-sm font-medium leading-relaxed">{message.content}</p>}
                                                        {(message.attachments || []).length > 0 && (
                                                            <div className="mt-3 space-y-2">
                                                                {message.attachments.map((attachment: any) => (
                                                                    <div key={attachment.id} className={`overflow-hidden rounded-2xl border ${fromClinic ? 'border-slate-100 bg-slate-50' : 'border-blue-400 bg-blue-500'}`}>
                                                                        {attachment.type === 'Image' && <img src={attachment.url} alt={attachment.name} className="max-h-48 w-full object-cover" />}
                                                                        {attachment.type === 'Video' && <video src={attachment.url} controls className="max-h-56 w-full" />}
                                                                        {attachment.type === 'VoiceNote' && <audio src={attachment.url} controls className="w-full" />}
                                                                        <a href={attachment.url} download={attachment.name} className={`block px-3 py-2 text-xs font-bold ${fromClinic ? 'text-slate-500' : 'text-blue-50'}`}>
                                                                            {attachment.name}
                                                                        </a>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <p className={`mt-2 text-[10px] font-black uppercase tracking-widest ${fromClinic ? 'text-slate-400' : 'text-blue-100'}`}>
                                                            {fromClinic ? 'Clinic' : 'You'} • {new Date(message.sentAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="border-t border-slate-100 p-5">
                                        {thread.status === 'CLOSED' ? (
                                            <div className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-bold text-slate-500">
                                                This conversation has been closed by the clinic. Start a new thread if you still need help.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {messageFiles.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {messageFiles.map((file, index) => (
                                                            <button key={`${file.name}-${index}`} onClick={() => setMessageFiles((current) => current.filter((_, idx) => idx !== index))} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                                                {file.name} x
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex items-end gap-3">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl bg-slate-50 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600">
                                                            <Paperclip className="h-5 w-5" />
                                                            <input type="file" className="hidden" accept="image/*,video/*,audio/*" multiple onChange={(event) => handleMessageFiles(event.target.files)} />
                                                        </label>
                                                        <button onClick={handleVoiceNote} className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${isRecording ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}>
                                                            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        rows={3}
                                                        value={messageDraft}
                                                        onChange={(e) => setMessageDraft(e.target.value)}
                                                        placeholder="Write a secure message to your clinic..."
                                                        className="min-h-[96px] flex-1 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300"
                                                    />
                                                    <button
                                                        onClick={handleSendMessage}
                                                        disabled={sending || (!messageDraft.trim() && messageFiles.length === 0)}
                                                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50"
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
                                        <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-30" />
                                        <p className="text-lg font-black text-slate-500">Open a clinic conversation</p>
                                        <p className="mt-2 text-sm font-medium">You can ask follow-up questions, medication questions, and general support questions here.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'REMINDERS' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <section className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Pending consent forms</h2>
                            <div className="mt-6 space-y-4">
                                {(client.consentForms || []).length === 0 && (
                                    <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">
                                        No consent forms are waiting for signature.
                                    </div>
                                )}
                                {(client.consentForms || []).map((form: any) => (
                                    <div key={form.id} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                                        <div className="flex items-start gap-4">
                                            <div className="rounded-2xl bg-white p-3 text-blue-600">
                                                <FileSignature className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-800">{form.type}</p>
                                                <p className="mt-1 text-sm font-medium text-slate-500">{form.patient?.name || 'Patient record'}</p>
                                                <p className="mt-2 text-xs font-black uppercase tracking-widest text-rose-500">Sign from the pet detail page</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Reminders and notices</h2>
                            <div className="mt-6 space-y-4">
                                {(client.reminders || []).length === 0 && (
                                    <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">
                                        No active reminders right now.
                                    </div>
                                )}
                                {(client.reminders || []).map((reminder: any) => (
                                    <div key={reminder.id} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                                        <p className="text-xs font-black uppercase tracking-widest text-blue-600">{reminder.type}</p>
                                        <p className="mt-2 text-sm font-black text-slate-800">{reminder.message}</p>
                                        <p className="mt-2 text-xs font-medium text-slate-500">
                                            Scheduled {new Date(reminder.scheduledFor).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
                    {activeTab === 'SHOP' && (
                        <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Shop</h2>
                                    <p className="mt-1 text-sm font-medium text-slate-500">Browse clinic-approved items and send an order request.</p>
                                </div>
                                <button
                                    onClick={handleCreateOrder}
                                    disabled={Object.values(cart).reduce((sum, qty) => sum + qty, 0) === 0}
                                    className="rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700"
                                >
                                    Place order ({Object.values(cart).reduce((sum, qty) => sum + qty, 0)})
                                </button>
                            </div>
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {shopItems.length === 0 ? (
                                    <div className="col-span-full rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">
                                        No shop items are available right now.
                                    </div>
                                ) : shopItems.map((item) => (
                                    <div key={item.id} className="rounded-[28px] border border-slate-100 bg-slate-50/70 p-5 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-widest text-blue-600">{item.category || 'Shop item'}</p>
                                                <h3 className="mt-2 text-lg font-black text-slate-800">{item.name}</h3>
                                                <p className="mt-2 text-sm font-medium text-slate-500">{item.description || 'Available for request through your clinic.'}</p>
                                            </div>
                                            <div className="rounded-2xl bg-white p-3 text-blue-600 shadow-sm">
                                                <ShoppingCart className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div className="mt-5 flex items-center justify-between gap-3">
                                            <span className="text-sm font-black text-slate-700">{client.clinic?.currencySymbol || 'NGN'} {Number(item.retailPrice || 0).toLocaleString()}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setCart((current) => ({ ...current, [item.id]: Math.max((current[item.id] || 0) - 1, 0) }))} className="h-9 w-9 rounded-xl bg-white text-sm font-black text-slate-500">-</button>
                                                <span className="min-w-6 text-center text-sm font-black text-slate-700">{cart[item.id] || 0}</span>
                                                <button onClick={() => setCart((current) => ({ ...current, [item.id]: (current[item.id] || 0) + 1 }))} className="h-9 w-9 rounded-xl bg-blue-600 text-sm font-black text-white">+</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'ORDERS' && (
                        <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Orders</h2>
                            <p className="mt-1 text-sm font-medium text-slate-500">View recent purchases and order status from your clinic.</p>
                            <div className="mt-6 space-y-4">
                                {orders.length === 0 && (
                                    <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">
                                        No orders found yet.
                                    </div>
                                )}
                                {orders.map((order) => (
                                    <div key={order.id} className="rounded-[28px] border border-slate-100 bg-slate-50/70 p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-widest text-blue-600">{order.invoiceNumber}</p>
                                                <h3 className="mt-2 text-lg font-black text-slate-800">{order.status}</h3>
                                                <p className="mt-1 text-sm font-medium text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Balance due</p>
                                                <p className="text-lg font-black text-slate-800">{client.clinic?.currencySymbol || 'NGN'} {Number(order.balanceDue || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {(order.items || []).slice(0, 4).map((item: any) => (
                                                <span key={item.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
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
                        <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Settings & Integrations</h2>
                            <p className="mt-1 text-sm font-medium text-slate-500">Manage your account and cloud storage.</p>
                            
                            <div className="mt-8 space-y-6">
                                <div className="rounded-2xl border border-slate-100 p-6 bg-slate-50/50">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800">Google Drive Integration</h3>
                                            <p className="mt-1 text-sm font-medium text-slate-500">
                                                Connect your personal Google Drive to safely export and backup your pet's medical records and invoices.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-6 flex flex-wrap gap-4">
                                        <button 
                                            onClick={handleConnectDrive}
                                            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700 transition"
                                        >
                                            Connect Google Drive
                                        </button>
                                        <button 
                                            onClick={handleExportData}
                                            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50 transition"
                                        >
                                            Export My Data to Drive
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    </div>
                </div>
            </main>
        </div>
    );
};
