import React, { useEffect, useMemo, useState } from 'react';
import {
    MessageSquare,
    Send,
    User,
    Clock,
    CheckCircle2,
    Shield,
    MailPlus,
    Search,
    Paperclip,
    Mic,
    Square,
} from 'lucide-react';
import { AIConversation, AIMessage, User as UserType, Client, Pet } from '../../types';
import { api } from '../../services/apiService';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

interface ClientAssistantProps {
    currentUser: UserType;
}

const MESSAGE_CATEGORIES = [
    'Appointment question',
    'Medication/refill question',
    'Post-visit follow-up',
    'Lab/result clarification',
    'General support',
];

const ClientAssistant: React.FC<ClientAssistantProps> = () => {
    const [conversations, setConversations] = useState<AIConversation[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [reply, setReply] = useState('');
    const [replyFiles, setReplyFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(true);
    const [showComposer, setShowComposer] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [patients, setPatients] = useState<Pet[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [composer, setComposer] = useState({
        clientId: '',
        patientId: '',
        subject: '',
        category: MESSAGE_CATEGORIES[0],
        content: '',
    });

    const selectedConv = conversations.find((conversation) => conversation.id === selectedId) || null;
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();

    useEffect(() => {
        fetchConversations();
        loadComposerData();
        const interval = setInterval(fetchConversations, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedId) {
            loadConversation(selectedId);
        }
    }, [selectedId]);

    const fetchConversations = async () => {
        try {
            const data = await api.aiClient.getConversations({ platform: 'PORTAL' });
            setConversations(data);
            if (!selectedId && data.length > 0) {
                setSelectedId(data[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch conversations');
        } finally {
            setLoading(false);
        }
    };

    const loadConversation = async (conversationId: string) => {
        try {
            const data = await api.aiClient.getConversation(conversationId);
            setConversations((current) => current.map((conversation) => (
                conversation.id === conversationId ? { ...data, unreadForClinic: 0 } : conversation
            )));
            await api.aiClient.markConversationRead(conversationId);
        } catch (error) {
            toast.error('Failed to load this conversation');
        }
    };

    const loadComposerData = async () => {
        try {
            const [clientData, patientData] = await Promise.all([
                api.clients.getAll(1, 500),
                api.patients.getAll(1, 1000),
            ]);
            setClients(clientData);
            setPatients(patientData);
        } catch (error) {
            console.error('Failed to load compose metadata', error);
        }
    };

    const filteredClients = useMemo(() => {
        const term = clientSearch.trim().toLowerCase();
        if (!term) {
            return clients;
        }
        return clients.filter((client) => {
            return (
                client.firstName.toLowerCase().includes(term) ||
                client.lastName.toLowerCase().includes(term) ||
                (client.email || '').toLowerCase().includes(term) ||
                client.phone.includes(term)
            );
        });
    }, [clients, clientSearch]);

    const linkedPatients = useMemo(() => {
        if (!composer.clientId) {
            return [];
        }
        return patients.filter((patient) => patient.ownerId === composer.clientId);
    }, [patients, composer.clientId]);

    const handleSend = async () => {
        if (!selectedId || (!reply.trim() && replyFiles.length === 0)) {
            return;
        }

        try {
            const payload = replyFiles.length > 0 ? new FormData() : reply.trim();
            if (payload instanceof FormData) {
                payload.append('content', reply.trim());
                replyFiles.forEach((file) => payload.append('attachments', file));
            }
            await api.aiClient.sendMessage(selectedId, payload);
            setReply('');
            setReplyFiles([]);
            await loadConversation(selectedId);
            await fetchConversations();
        } catch (error) {
            toast.error('Failed to send message');
        }
    };

    const handleReplyFiles = (files: FileList | null) => {
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
        setReplyFiles((current) => [...current, ...accepted].slice(0, 4));
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
            setReplyFiles((current) => [...current, new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type || 'audio/webm' })].slice(0, 4));
        } catch (error) {
            toast.error('Could not record voice note.');
        }
    };

    const handleCreateConversation = async () => {
        if (!composer.clientId || !composer.subject.trim() || !composer.content.trim()) {
            toast.error('Choose a client, subject, and first message.');
            return;
        }

        try {
            const conversation = await api.aiClient.createConversation({
                clientId: composer.clientId,
                patientId: composer.patientId || null,
                subject: composer.subject.trim(),
                category: composer.category,
                content: composer.content.trim(),
                platform: 'PORTAL',
            });
            setComposer({
                clientId: '',
                patientId: '',
                subject: '',
                category: MESSAGE_CATEGORIES[0],
                content: '',
            });
            setShowComposer(false);
            await fetchConversations();
            setSelectedId(conversation.id);
            toast.success('Client conversation created.');
        } catch (error: any) {
            toast.error(error?.message || 'Failed to create conversation');
        }
    };

    const handleConversationStatus = async (status: 'ACTIVE' | 'CLOSED') => {
        if (!selectedId) {
            return;
        }

        try {
            await api.aiClient.updateConversationStatus(selectedId, status);
            await fetchConversations();
            await loadConversation(selectedId);
        } catch (error) {
            toast.error('Failed to update conversation status');
        }
    };

    if (loading && conversations.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-200px)] bg-slate-50/50 rounded-2xl overflow-hidden border border-slate-100">
            <div className="w-96 border-r border-slate-100 flex flex-col bg-white">
                <div className="p-4 border-b border-slate-50 bg-slate-50/30 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-black text-slate-800 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-amber-500" />
                            Portal Inbox
                        </h2>
                        <button
                            onClick={() => setShowComposer((open) => !open)}
                            className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-amber-700"
                        >
                            New thread
                        </button>
                    </div>

                    {showComposer && (
                        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={clientSearch}
                                    onChange={(e) => setClientSearch(e.target.value)}
                                    placeholder="Search client"
                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-amber-300"
                                />
                            </div>
                            <select
                                value={composer.clientId}
                                onChange={(e) => setComposer((current) => ({ ...current, clientId: e.target.value, patientId: '' }))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-amber-300"
                            >
                                <option value="">Select client</option>
                                {filteredClients.map((client) => (
                                    <option key={client.id} value={client.id}>
                                        {client.firstName} {client.lastName}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={composer.patientId}
                                onChange={(e) => setComposer((current) => ({ ...current, patientId: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-amber-300"
                            >
                                <option value="">General client conversation</option>
                                {linkedPatients.map((patient) => (
                                    <option key={patient.id} value={patient.id}>{patient.name}</option>
                                ))}
                            </select>
                            <input
                                value={composer.subject}
                                onChange={(e) => setComposer((current) => ({ ...current, subject: e.target.value }))}
                                placeholder="Subject"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-amber-300"
                            />
                            <select
                                value={composer.category}
                                onChange={(e) => setComposer((current) => ({ ...current, category: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-amber-300"
                            >
                                {MESSAGE_CATEGORIES.map((category) => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                            <textarea
                                value={composer.content}
                                onChange={(e) => setComposer((current) => ({ ...current, content: e.target.value }))}
                                rows={4}
                                placeholder="First message to the client"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-amber-300"
                            />
                            <button
                                onClick={handleCreateConversation}
                                className="w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-black text-white transition hover:bg-black"
                            >
                                Start conversation
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                    {conversations.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <p className="text-sm font-bold">No portal conversations yet</p>
                        </div>
                    ) : (
                        conversations.map((conversation) => (
                            <button
                                key={conversation.id}
                                onClick={() => setSelectedId(conversation.id)}
                                className={`w-full p-4 text-left transition-all hover:bg-slate-50 flex items-start gap-3 ${selectedId === conversation.id ? 'bg-amber-50/50' : ''}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1 gap-3">
                                        <div className="min-w-0">
                                            <span className="font-extrabold text-slate-700 text-sm block truncate">
                                                {conversation.client ? `${conversation.client.firstName} ${conversation.client.lastName}` : 'Client'}
                                            </span>
                                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mt-1">
                                                {conversation.subject || conversation.category || 'Portal message'}
                                            </span>
                                        </div>
                                        {(conversation.unreadForClinic || 0) > 0 && (
                                            <span className="rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black text-white">
                                                {conversation.unreadForClinic}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 truncate font-medium">
                                        {conversation.latestMessage?.content}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-white">
                {selectedConv ? (
                    <>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                    <User className="w-5 h-5 text-slate-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800">
                                        {selectedConv.client ? `${selectedConv.client.firstName} ${selectedConv.client.lastName}` : 'Client'}
                                    </h3>
                                    <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <Shield className="w-3 h-3" /> {selectedConv.platform}
                                        </span>
                                        <span>{selectedConv.status}</span>
                                        {selectedConv.patient && <span>{selectedConv.patient.name}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {selectedConv.status === 'CLOSED' ? (
                                    <button
                                        onClick={() => handleConversationStatus('ACTIVE')}
                                        className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-700 transition hover:bg-emerald-100"
                                    >
                                        Reopen
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleConversationStatus('CLOSED')}
                                        className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-200"
                                    >
                                        Close
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                            {(selectedConv.messages || []).map((message: AIMessage) => {
                                const outbound = message.direction === 'OUTBOUND';
                                return (
                                    <div key={message.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${outbound ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}>
                                            {message.content && <p className="text-sm font-medium leading-relaxed">{message.content}</p>}
                                            {(message.attachments || []).length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    {message.attachments.map((attachment: any) => (
                                                        <div key={attachment.id} className={`overflow-hidden rounded-xl border ${outbound ? 'border-slate-700 bg-slate-700' : 'border-slate-100 bg-slate-50'}`}>
                                                            {attachment.type === 'Image' && <img src={attachment.url} alt={attachment.name} className="max-h-48 w-full object-cover" />}
                                                            {attachment.type === 'Video' && <video src={attachment.url} controls className="max-h-56 w-full" />}
                                                            {attachment.type === 'VoiceNote' && <audio src={attachment.url} controls className="w-full" />}
                                                            <a href={attachment.url} download={attachment.name} className={`block px-3 py-2 text-xs font-bold ${outbound ? 'text-slate-200' : 'text-slate-500'}`}>{attachment.name}</a>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className={`mt-2 flex items-center gap-2 text-[10px] font-black uppercase opacity-60 ${outbound ? 'justify-end' : ''}`}>
                                                <span>{message.senderType === 'CLIENT' ? 'Client' : 'Clinic'}</span>
                                                {format(new Date(message.sentAt), 'h:mm a')}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white">
                            {selectedConv.status === 'CLOSED' ? (
                                <div className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-bold text-slate-500">
                                    This conversation is closed. Reopen it to reply.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {replyFiles.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {replyFiles.map((file, index) => (
                                                <button key={`${file.name}-${index}`} onClick={() => setReplyFiles((current) => current.filter((_, idx) => idx !== index))} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                                                    {file.name} x
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                <div className="relative">
                                    <textarea
                                        value={reply}
                                        onChange={(e) => setReply(e.target.value)}
                                        placeholder="Reply to the client..."
                                        className="w-full rounded-2xl border border-slate-200 p-4 pr-12 min-h-[80px] max-h-32 text-sm font-medium resize-none outline-none focus:border-amber-300"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                    />
                                    <div className="absolute left-3 bottom-3 flex gap-2">
                                        <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-amber-600">
                                            <Paperclip className="w-4 h-4" />
                                            <input type="file" className="hidden" accept="image/*,video/*,audio/*" multiple onChange={(event) => handleReplyFiles(event.target.files)} />
                                        </label>
                                        <button onClick={handleVoiceNote} className={`flex h-9 w-9 items-center justify-center rounded-xl ${isRecording ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500 hover:text-amber-600'}`}>
                                            {isRecording ? <Square className="w-3 h-3" /> : <Mic className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleSend}
                                        disabled={!reply.trim() && replyFiles.length === 0}
                                        className="absolute right-3 bottom-3 p-2 bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-100 transition hover:scale-105 active:scale-95 disabled:opacity-50"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <MailPlus className="w-16 h-16 mb-4 opacity-10" />
                        <h3 className="text-lg font-bold">Select a portal conversation</h3>
                        <p className="text-sm">Choose a client thread or start a new one from the left.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientAssistant;
