import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Calendar,
    ChevronRight,
    CreditCard,
    Dog,
    Download,
    Edit2,
    FileText,
    Loader2,
    Mail,
    MapPin,
    MessageSquare,
    Phone,
    Plus,
    Receipt,
    Save,
    Shield,
    ShieldCheck,
    Trash2,
    Upload,
    User as UserIcon
} from 'lucide-react';
import { api } from '../../services/apiService';
import { Pet, User } from '../../types';

interface ClientDetailsProps {
    clientId: string;
    onBack: () => void;
    onAddPatient: (clientId: string) => void;
    onViewPatient: (patientId: string) => void;
    onNavigateView: (view: any) => void;
    onEditClient?: (clientId: string) => void;
    onDeleteClient?: (clientId: string) => void;
    currentUser: User | null;
}

type TabType = 'Financial' | 'Patients' | 'Communication' | 'Media' | 'Portal' | 'Notes';

const tabLabels: Record<TabType, string> = {
    Financial: 'Billing',
    Patients: 'Pets',
    Communication: 'Messages',
    Media: 'Files',
    Portal: 'Portal',
    Notes: 'Notes',
};

const getPetMotionClass = (breed?: string, species?: string) => {
    const value = `${breed || ''} ${species || ''}`.toLowerCase();
    if (/(husky|shepherd|malinois|collie|terrier|spitz)/.test(value)) return 'pet-motion-quick';
    if (/(bulldog|mastiff|rottweiler|pug|persian|british short)/.test(value)) return 'pet-motion-proud';
    if (/(retriever|beagle|spaniel|labrador|poodle)/.test(value)) return 'pet-motion-bouncy';
    return 'pet-motion-gentle';
};

const getPetToneClass = (breed?: string, species?: string) => {
    const value = `${breed || ''} ${species || ''}`.toLowerCase();
    if (/(cat|persian|siamese|maine coon)/.test(value)) return 'bg-rose-50 text-rose-500 border-rose-100';
    if (/(parrot|bird|canary)/.test(value)) return 'bg-amber-50 text-amber-500 border-amber-100';
    if (/(shepherd|husky|retriever|labrador|dog)/.test(value)) return 'bg-teal-50 text-teal-600 border-teal-100';
    return 'bg-sky-50 text-sky-600 border-sky-100';
};

export const ClientDetails: React.FC<ClientDetailsProps> = ({
    clientId,
    onBack,
    onAddPatient,
    onViewPatient,
    onNavigateView,
    onEditClient,
    onDeleteClient,
    currentUser
}) => {
    const [client, setClient] = useState<any>(() => api.getCache<any>('clients', `one:${clientId}`));
    const [loading, setLoading] = useState(!api.getCache('clients', `one:${clientId}`));
    const [activeTab, setActiveTab] = useState<TabType>('Patients');
    const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
    const [interactionData, setInteractionData] = useState({ type: 'General', content: '' });
    const [isSavingInteraction, setIsSavingInteraction] = useState(false);
    const [internalNotes, setInternalNotes] = useState(client?.internalNotes || '');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    useEffect(() => {
        loadClientDetails();
    }, [clientId]);

    const loadClientDetails = async () => {
        setLoading(true);
        try {
            const data = await api.clients.getOne(clientId);
            setClient(data);
            setInternalNotes(data.internalNotes || '');
            api.setCache('clients', data, `one:${clientId}`);
        } catch (error) {
            console.error('Failed to load client details', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClient = async () => {
        if (!currentUser?.roles.includes('Admin')) {
            toast.error('Only administrators can delete clients.');
            return;
        }
        if (!window.confirm(`Delete ${client.firstName} ${client.lastName}? This will remove the client and linked records.`)) {
            return;
        }

        if (onDeleteClient) {
            onDeleteClient(clientId);
            return;
        }

        try {
            await api.clients.delete(clientId);
            onBack();
        } catch (error) {
            toast.error('Failed to delete client.');
        }
    };

    const handleSaveNotes = async () => {
        setIsSavingNotes(true);
        try {
            await api.patch(`/clients/${clientId}/notes`, { internalNotes });
            const updatedClient = { ...client, internalNotes };
            setClient(updatedClient);
            api.setCache('clients', updatedClient, `one:${clientId}`);
            toast.success('Notes saved');
        } catch (error) {
            toast.error('Failed to save notes');
        } finally {
            setIsSavingNotes(false);
        }
    };

    const handleSaveInteraction = async () => {
        if (!interactionData.content.trim()) return;
        setIsSavingInteraction(true);
        try {
            await api.post(`/clients/${clientId}/communications`, {
                type: interactionData.type,
                content: interactionData.content,
                sentAt: new Date().toISOString()
            });
            setIsInteractionModalOpen(false);
            setInteractionData({ type: 'General', content: '' });
            loadClientDetails();
            toast.success('Message note saved');
        } catch (error) {
            toast.error('Failed to save message note');
        } finally {
            setIsSavingInteraction(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('clientId', clientId);

        try {
            await api.post('/drive/upload', formData);
            loadClientDetails();
            toast.success('File uploaded');
        } catch (error) {
            toast.error('Upload failed');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Client not found.</p>
                <button onClick={onBack} className="mt-4 text-teal-600 font-semibold flex items-center gap-2 justify-center w-full">
                    <ArrowLeft className="w-4 h-4" /> Go back
                </button>
            </div>
        );
    }

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0
        }).format(amount).replace('NGN', '₦');

    const sales = client.sales || [];
    const totalInvoices = sales.filter((s: any) => s.type === 'INVOICE').reduce((acc: number, s: any) => acc + (s.total || 0), 0) || 0;
    const totalReceipts = sales.filter((s: any) => s.type === 'RECEIPT' || (s.type === 'INVOICE' && s.status === 'Completed')).reduce((acc: number, s: any) => acc + (s.total || 0), 0) || 0;
    const balance = totalInvoices - totalReceipts;
    const pets = client.patients || [];
    const messages = client.communications || [];
    const files = client.media || [];

    return (
        <div className="client-page-shell">
            <div className="flex items-center">
                <button
                    onClick={onBack}
                    className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-teal-600 hover:border-teal-200 transition-all group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                </button>
            </div>

            <div className="client-panel p-5 md:p-10">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-5 md:gap-8">
                    <div className="w-24 h-24 md:w-36 md:h-36 rounded-[1.5rem] md:rounded-[2rem] bg-teal-50 flex items-center justify-center text-teal-600 font-extrabold text-4xl md:text-5xl border border-teal-100 shrink-0">
                        {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <div className="flex flex-wrap items-center justify-start gap-2 mb-4">
                            {client.clientCode && <span className="client-badge bg-teal-600 text-white border-teal-600">{client.clientCode}</span>}
                            {client.tags?.map((tag: string) => <span key={tag} className="client-badge bg-teal-50 text-teal-700 border-teal-100">{tag}</span>)}
                        </div>
                        <h1 className="text-3xl md:text-5xl font-extrabold text-slate-800 tracking-tight break-words">
                            {client.title ? `${client.title} ` : ''}{client.firstName} {client.lastName}
                        </h1>
                        <p className="text-slate-500 mt-3">Client profile, pets, billing, files, and notes in one place.</p>
                        <div className="flex flex-wrap items-center justify-start gap-x-6 gap-y-3 mt-5 text-sm text-slate-500">
                            <div className="flex items-center gap-2"><Dog className="w-4 h-4 text-teal-500" /> {pets.length} pets</div>
                            <div className="flex items-center gap-2"><Receipt className="w-4 h-4 text-teal-500" /> {sales.length} transactions</div>
                            <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-teal-500" /> Joined {new Date(client.registrationDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 w-full md:w-auto">
                        <button onClick={() => onAddPatient(client.id)} className="px-6 py-3.5 rounded-2xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all flex items-center justify-center gap-2">
                            <Plus className="w-4 h-4" /> Add pet
                        </button>
                        <div className="flex gap-3">
                            {onEditClient && (
                                <button onClick={() => onEditClient(client.id)} className="flex-1 px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold hover:bg-white transition-all flex items-center justify-center gap-2">
                                    <Edit2 className="w-4 h-4" /> Edit
                                </button>
                            )}
                            {currentUser?.roles.includes('Admin') && (
                                <button onClick={handleDeleteClient} className="flex-1 px-5 py-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 font-semibold hover:bg-rose-100 transition-all flex items-center justify-center gap-2">
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    <div className="client-panel p-6">
                        <h3 className="text-sm font-semibold text-slate-500 mb-5">Contact details</h3>
                        <div className="space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-400">Phone</p>
                                    <p className="text-sm font-semibold text-slate-700 mt-1">{client.phone}</p>
                                    {client.alternatePhone && <p className="text-sm text-teal-600 mt-1">{client.alternatePhone}</p>}
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-400">Email</p>
                                    <p className="text-sm font-semibold text-slate-700 mt-1 truncate">{client.email || 'No email added'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-400">Address</p>
                                    <p className="text-sm font-semibold text-slate-700 mt-1">{client.address || 'No address added'}</p>
                                </div>
                            </div>
                        </div>

                        {client.emergencyContactName && (
                            <div className="mt-8 pt-6 border-t border-slate-200">
                                <h3 className="text-sm font-semibold text-rose-500 mb-4 flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> Emergency contact
                                </h3>
                                <div className="client-panel-soft p-4">
                                    <p className="text-sm font-semibold text-slate-800">{client.emergencyContactName}</p>
                                    <p className="text-sm text-rose-600 mt-1">{client.emergencyContactPhone}</p>
                                    <p className="text-xs text-slate-500 mt-2">{client.emergencyContactRelation || 'Emergency contact'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="client-panel p-6 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-500 mb-2">Quick actions</h3>
                        <button onClick={() => setIsInteractionModalOpen(true)} className="w-full text-left p-4 rounded-2xl bg-slate-50 hover:bg-white hover:text-teal-600 border border-slate-200 transition-all flex items-center gap-4 text-sm font-semibold text-slate-600">
                            <MessageSquare className="w-4 h-4" /> Add note
                        </button>
                        <button onClick={() => onNavigateView('POS')} className="w-full text-left p-4 rounded-2xl bg-slate-50 hover:bg-white hover:text-teal-600 border border-slate-200 transition-all flex items-center gap-4 text-sm font-semibold text-slate-600">
                            <CreditCard className="w-4 h-4" /> Open billing
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-9">
                    <div className="client-panel-soft p-2 mb-8 overflow-x-auto no-scrollbar flex gap-2">
                        {(Object.keys(tabLabels) as TabType[]).map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`client-tab ${activeTab === tab ? 'client-tab-active' : ''}`}>
                                {tabLabels[tab]}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'Financial' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                <div className="client-panel p-6">
                                    <p className="text-sm text-slate-500">Balance</p>
                                    <p className={`text-3xl font-extrabold mt-3 ${balance > 0 ? 'text-rose-600' : balance < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>{formatCurrency(Math.abs(balance))}</p>
                                    <p className="text-sm text-slate-400 mt-2">{balance > 0 ? 'Amount still to pay' : balance < 0 ? 'Client credit available' : 'No balance due'}</p>
                                </div>
                                <div className="client-panel p-6">
                                    <p className="text-sm text-slate-500">Total billed</p>
                                    <p className="text-3xl font-extrabold mt-3 text-slate-800">{formatCurrency(totalInvoices)}</p>
                                    <p className="text-sm text-slate-400 mt-2">All invoices so far</p>
                                </div>
                                <div className="client-panel p-6">
                                    <p className="text-sm text-slate-500">Total paid</p>
                                    <p className="text-3xl font-extrabold mt-3 text-emerald-600">{formatCurrency(totalReceipts)}</p>
                                    <p className="text-sm text-slate-400 mt-2">Completed payments</p>
                                </div>
                            </div>

                            <div className="client-panel overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[680px] text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                {['Date', 'Type', 'Reference', 'Amount', 'Status', ''].map((label) => (
                                                    <th key={label} className="px-6 py-4 text-sm font-semibold text-slate-500">{label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {sales.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-14 text-center text-slate-500">No billing records yet.</td>
                                                </tr>
                                            ) : (
                                                sales.map((sale: any) => (
                                                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 text-sm text-slate-700">{new Date(sale.createdAt).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4"><span className="client-badge">{sale.type}</span></td>
                                                        <td className="px-6 py-4 text-sm font-semibold text-slate-700">#{sale.invoiceNumber}</td>
                                                        <td className="px-6 py-4 text-sm font-semibold text-slate-800">{formatCurrency(sale.total)}</td>
                                                        <td className="px-6 py-4"><span className="client-badge">{sale.status}</span></td>
                                                        <td className="px-6 py-4 text-right"><button className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500"><Download className="w-4 h-4" /></button></td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Patients' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {pets.length === 0 ? (
                                <div className="md:col-span-2 client-panel py-24 text-center flex flex-col items-center gap-6">
                                    <div className="w-24 h-24 bg-teal-50 rounded-3xl flex items-center justify-center border border-teal-100">
                                        <Dog className="w-10 h-10 text-teal-500 opacity-30" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">No pets yet</h3>
                                        <p className="text-sm text-slate-500 mt-2">Add a pet to start this client profile.</p>
                                    </div>
                                    <button onClick={() => onAddPatient(client.id)} className="px-6 py-3 rounded-2xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all flex items-center gap-2">
                                        <Plus className="w-4 h-4" /> Add pet
                                    </button>
                                </div>
                            ) : (
                                pets.map((patient: Pet) => (
                                    <div key={patient.id} onClick={() => onViewPatient(patient.id)} className="pet-card group flex items-center justify-between">
                                        <div className="flex items-center gap-5">
                                            <div className={`pet-icon-shell ${getPetToneClass(patient.breed, patient.species)} ${getPetMotionClass(patient.breed, patient.species)}`}>
                                                <Dog className="w-10 h-10" />
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-bold text-slate-800 tracking-tight group-hover:text-teal-600 transition-colors">{patient.name}</h4>
                                                <p className="text-sm text-slate-500 mt-1">{patient.species} • {patient.breed || 'Breed not added'}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                                    <span className="client-badge bg-white text-teal-700 border-teal-100">{patient.gender}</span>
                                                    <span className="client-badge">Age {patient.age}</span>
                                                    <span className="client-badge">Weight {patient.weight} kg</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-teal-600">
                                            <ChevronRight className="w-5 h-5" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'Communication' && (
                        <div className="client-panel p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-800">Messages and notes</h3>
                                    <p className="text-slate-500 mt-2">Keep a simple record of calls, chats, and follow-ups.</p>
                                </div>
                                <button onClick={() => setIsInteractionModalOpen(true)} className="px-5 py-3 rounded-2xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> Add note
                                </button>
                            </div>
                            {messages.length === 0 ? (
                                <div className="py-20 text-center text-slate-500">No messages saved yet.</div>
                            ) : (
                                <div className="space-y-4">
                                    {messages.map((comm: any) => (
                                        <div key={comm.id} className="client-panel-soft p-5">
                                            <div className="flex flex-wrap items-center gap-3 mb-3">
                                                <span className="client-badge">{comm.type}</span>
                                                <span className="text-sm text-slate-400">{new Date(comm.sentAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                            </div>
                                            <p className="text-slate-700 leading-relaxed">{comm.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'Media' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <label className="client-panel p-8 flex flex-col items-center justify-center gap-4 cursor-pointer min-h-[190px] border-dashed">
                                <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 border border-teal-100">
                                    <Upload className="w-7 h-7" />
                                </div>
                                <p className="text-sm font-semibold text-slate-500">Upload file</p>
                                <input type="file" className="hidden" onChange={handleFileUpload} />
                            </label>
                            {files.map((file: any) => (
                                <div key={file.id} className="client-panel p-4">
                                    <div className="aspect-square rounded-2xl bg-slate-50 border border-slate-200 mb-4 flex items-center justify-center overflow-hidden">
                                        {file.type === 'Image' ? (
                                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <FileText className="w-10 h-10 text-slate-300" />
                                        )}
                                    </div>
                                    <p className="text-sm font-semibold text-slate-700 truncate">{file.name}</p>
                                    <p className="text-xs text-slate-400 mt-1">{file.type}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'Portal' && (
                        <div className="client-panel p-8 space-y-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 rounded-[1.6rem] flex items-center justify-center border ${client.isPortalEnabled ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-teal-50 border-teal-100 text-teal-600'}`}>
                                        <ShieldCheck className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-800">Client portal</h3>
                                        <p className="text-slate-500 mt-1">
                                            {client.isPortalEnabled
                                                ? 'Portal access is active for this client.'
                                                : client.portalAccess?.invite?.status === 'PENDING'
                                                    ? 'Invite sent. Waiting for the client to finish setup.'
                                                    : 'Portal access has not been turned on yet.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: { view: 'AI_HUB', tab: 'CLIENT' } }))} className="px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" /> Open inbox
                                    </button>
                                    {!client.isPortalEnabled && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const response = await api.clients.generatePortalCredentials(client.id);
                                                    setClient(response.client || client);
                                                    toast.success(response.emailDelivery?.delivered ? 'Login details sent' : `Temporary password: ${response.temporaryPassword}`);
                                                } catch (err: any) {
                                                    toast.error(err?.message || 'Failed to generate login details');
                                                }
                                            }}
                                            className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-semibold hover:bg-black transition-all"
                                        >
                                            Generate login
                                        </button>
                                    )}
                                    {!client.isPortalEnabled && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const response = client.portalAccess?.invite?.status === 'PENDING'
                                                        ? await api.clients.resendPortalInvite(client.id)
                                                        : await api.clients.sendPortalInvite(client.id);
                                                    setClient(response.client || client);
                                                    if (response.emailDelivery && !response.emailDelivery.delivered) {
                                                        toast.error(`Invite created, but email failed to send: ${response.emailDelivery.error || 'Unknown error'}`);
                                                    } else {
                                                        toast.success(client.portalAccess?.invite?.status === 'PENDING' ? 'Invite sent again' : 'Invite sent');
                                                    }
                                                } catch (err: any) {
                                                    toast.error(err?.message || 'Failed to send invite');
                                                }
                                            }}
                                            className="px-5 py-3 rounded-2xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all"
                                        >
                                            {client.portalAccess?.invite?.status === 'PENDING' ? 'Send again' : 'Send invite'}
                                        </button>
                                    )}
                                    {client.isPortalEnabled && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const response = await api.clients.revokePortalAccess(client.id);
                                                    setClient(response.client || client);
                                                    toast.success('Portal access removed');
                                                } catch (err: any) {
                                                    toast.error(err?.message || 'Failed to remove portal access');
                                                }
                                            }}
                                            className="px-5 py-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 font-semibold"
                                        >
                                            Remove access
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="client-panel-soft p-6">
                                    <p className="text-sm font-semibold text-slate-500 mb-4">Portal details</p>
                                    <div className="space-y-3 text-sm text-slate-700">
                                        <div className="flex justify-between gap-4"><span className="text-slate-400">Email</span><span>{client.email || 'No email added'}</span></div>
                                        <div className="flex justify-between gap-4"><span className="text-slate-400">Status</span><span>{client.isPortalEnabled ? 'Active' : client.portalAccess?.invite?.status || 'Not started'}</span></div>
                                    </div>
                                </div>
                                <div className="client-panel-soft p-6">
                                    <p className="text-sm font-semibold text-slate-500 mb-4">Access history</p>
                                    <div className="space-y-3 text-sm text-slate-700">
                                        <div className="flex justify-between gap-4"><span className="text-slate-400">Password</span><span>{client.passwordSet ? 'Set' : 'Not set'}</span></div>
                                        <div className="flex justify-between gap-4"><span className="text-slate-400">Must change</span><span>{client.portalAccess?.passwordMustChange ? 'Yes' : 'No'}</span></div>
                                        <div className="flex justify-between gap-4"><span className="text-slate-400">Last login</span><span>{client.lastLogin ? new Date(client.lastLogin).toLocaleDateString() : 'No login yet'}</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Notes' && (
                        <div className="client-panel p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-800">Private notes</h3>
                                    <p className="text-slate-500 mt-2">These notes are only for your team.</p>
                                </div>
                                <button onClick={handleSaveNotes} disabled={isSavingNotes} className="px-5 py-3 rounded-2xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all flex items-center gap-2 disabled:opacity-60">
                                    {isSavingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {isSavingNotes ? 'Saving...' : 'Save notes'}
                                </button>
                            </div>
                            <textarea
                                value={internalNotes}
                                onChange={(e) => setInternalNotes(e.target.value)}
                                placeholder="Add private notes for your team..."
                                className="w-full min-h-[320px] rounded-[2rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-teal-300 focus:bg-white focus:ring-4 focus:ring-teal-50 resize-none"
                            />
                            <div className="client-panel-soft p-4 flex items-center gap-3 text-sm text-slate-500">
                                <Shield className="w-5 h-5 text-teal-600 shrink-0" />
                                These notes stay inside the clinic workspace and do not show in the client portal.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isInteractionModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-sm animate-fade-in">
                    <div className="client-panel w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">Add note</h3>
                                <p className="text-sm text-slate-500 mt-1">Save a call, chat, or update for this client.</p>
                            </div>
                            <button onClick={() => setIsInteractionModalOpen(false)} className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-200 text-slate-400 hover:text-rose-500 transition-all">
                                <ArrowLeft className="w-5 h-5 rotate-90" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="text-sm font-semibold text-slate-500 mb-2 block">Type</label>
                                <select
                                    value={interactionData.type}
                                    onChange={(e) => setInteractionData(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-sm text-slate-700 focus:outline-none focus:ring-4 focus:ring-teal-50"
                                >
                                    <option>General</option>
                                    <option>Phone Call</option>
                                    <option>WhatsApp</option>
                                    <option>Email</option>
                                    <option>In-Person</option>
                                    <option>Complaint</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-500 mb-2 block">Details</label>
                                <textarea
                                    rows={5}
                                    value={interactionData.content}
                                    onChange={(e) => setInteractionData(prev => ({ ...prev, content: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 px-4 py-4 rounded-[1.5rem] text-sm text-slate-700 focus:outline-none focus:ring-4 focus:ring-teal-50 resize-none"
                                    placeholder="Write a short note about this message or update..."
                                />
                            </div>
                            <button
                                onClick={handleSaveInteraction}
                                disabled={isSavingInteraction || !interactionData.content.trim()}
                                className="w-full px-5 py-3.5 rounded-2xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all disabled:opacity-60"
                            >
                                {isSavingInteraction ? 'Saving...' : 'Save note'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
