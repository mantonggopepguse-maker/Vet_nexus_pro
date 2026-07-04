import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/apiService';
import { AIConversation, AIMessage } from '../../types';
import { toast } from 'sonner';
import {
  MessageSquare,
  Send,
  User,
  Clock,
  Filter,
  CheckCircle,
  AlertCircle,
  X,
  ArrowLeft,
  Inbox,
  RefreshCw,
} from 'lucide-react';

type StatusFilter = 'ALL' | 'ACTIVE' | 'CLOSED' | 'ESCALATED';

const formatRelativeTime = (dateStr: string): string => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const formatMessageTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const truncate = (str: string, max: number): string => {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
};

const getClientName = (conv: AIConversation): string => {
  if (conv.client) {
    const first = conv.client.firstName || '';
    const last = conv.client.lastName || '';
    const name = `${first} ${last}`.trim();
    return name || 'Unknown Client';
  }
  return conv.guestPhone || 'Unknown Client';
};

export const PortalInbox: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<AIConversation | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showMobileThread, setShowMobileThread] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch conversation list
  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const data = await api.aiClient.getConversations({ platform: 'PORTAL' });
      setConversations(data);
    } catch (err) {
      if (!silent) toast.error('Failed to load portal conversations');
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, []);

  // Fetch a single conversation thread
  const fetchThread = useCallback(async (id: string) => {
    setLoadingThread(true);
    try {
      const data = await api.aiClient.getConversation(id);
      setActiveConversation(data);
      api.aiClient.markConversationRead(id).catch(() => {});
    } catch (err) {
      toast.error('Failed to load conversation');
    } finally {
      setLoadingThread(false);
    }
  }, []);

  // Initial load + auto-refresh
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => fetchConversations(true), 15000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Refresh active thread when conversations update (for unread badges, etc.)
  useEffect(() => {
    if (selectedId) {
      // Silently refresh the active thread to pick up new messages
      api.aiClient.getConversation(selectedId).then((data) => {
        setActiveConversation(data);
      }).catch(() => {});
    }
  }, [conversations, selectedId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, scrollToBottom]);

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setShowMobileThread(true);
    fetchThread(id);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchConversations(true);
    if (selectedId) {
      await fetchThread(selectedId);
    }
    setRefreshing(false);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      await api.aiClient.sendMessage(selectedId, replyText.trim());
      setReplyText('');
      await fetchThread(selectedId);
      await fetchConversations(true);
      textareaRef.current?.focus();
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: 'ACTIVE' | 'CLOSED') => {
    if (!selectedId) return;
    try {
      await api.aiClient.updateConversationStatus(selectedId, newStatus);
      toast.success(`Conversation ${newStatus === 'CLOSED' ? 'closed' : 'reopened'}`);
      await fetchThread(selectedId);
      await fetchConversations(true);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  // Filter conversations
  const filtered = conversations.filter((c) =>
    statusFilter === 'ALL' ? true : c.status === statusFilter
  );

  const messages = activeConversation?.messages || [];

  // Priority badge
  const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    if (priority === 'NORMAL') return null;
    const isUrgent = priority === 'URGENT';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${isUrgent ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
        <AlertCircle className="w-3 h-3" />
        {priority}
      </span>
    );
  };

  // Status badge
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-teal-50 text-teal-700',
      CLOSED: 'bg-slate-100 text-slate-500',
      ESCALATED: 'bg-amber-50 text-amber-700',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles[status] || 'bg-slate-100 text-slate-500'}`}>
        {status === 'ACTIVE' && <CheckCircle className="w-3 h-3" />}
        {status === 'CLOSED' && <X className="w-3 h-3" />}
        {status === 'ESCALATED' && <AlertCircle className="w-3 h-3" />}
        {status}
      </span>
    );
  };

  // ---------- CONVERSATION LIST ----------
  const renderConversationList = () => (
    <div className={`w-full md:w-[350px] md:min-w-[350px] flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/70 ${showMobileThread ? 'hidden md:flex' : 'flex'}`}>
      {/* Header */}
      <div className="p-5 border-b border-slate-200/70">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                <MessageSquare className="w-4.5 h-4.5 text-teal-600" />
              </div>
              <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Portal Inbox</h1>
            </div>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-all duration-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
          {(['ALL', 'ACTIVE', 'CLOSED', 'ESCALATED'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                statusFilter === status
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation items */}
      <div className="flex-1 overflow-y-auto">
        {loadingList ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
            <p className="text-sm text-slate-400 font-semibold">Loading conversations…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Inbox className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 font-semibold">No conversations</p>
            <p className="text-xs text-slate-400">
              {statusFilter !== 'ALL'
                ? `No ${statusFilter.toLowerCase()} conversations found`
                : 'Client messages will appear here'}
            </p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv.id === selectedId;
            const unread = conv.unreadForClinic || 0;
            return (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`px-4 py-3.5 cursor-pointer transition-all duration-300 border-l-[3px] ${
                  isActive
                    ? 'bg-teal-50/60 border-l-teal-500'
                    : 'border-l-transparent hover:bg-slate-50'
                } ${unread > 0 && !isActive ? 'bg-teal-50/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${unread > 0 ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${unread > 0 ? 'font-bold text-slate-800' : 'font-semibold text-slate-700'}`}>
                        {getClientName(conv)}
                      </p>
                      <p className="text-xs text-slate-500 truncate font-medium">
                        {conv.subject || 'No subject'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                    {unread > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-teal-500 text-white text-[10px] font-bold">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
                {conv.latestMessage && (
                  <p className="text-xs text-slate-400 mt-1.5 ml-[46px] truncate">
                    {truncate(conv.latestMessage.content, 60)}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-2 ml-[46px]">
                  <StatusBadge status={conv.status} />
                  <PriorityBadge priority={conv.priority} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ---------- MESSAGE THREAD ----------
  const renderMessageThread = () => {
    if (!selectedId || !activeConversation) {
      return (
        <div className={`flex-1 flex flex-col items-center justify-center bg-slate-50/50 ${showMobileThread ? 'hidden' : 'hidden md:flex'}`}>
          <div className="w-20 h-20 rounded-3xl bg-white border border-slate-200/70 flex items-center justify-center shadow-sm mb-4">
            <MessageSquare className="w-9 h-9 text-slate-300" />
          </div>
          <p className="text-slate-500 font-bold text-lg">Select a conversation</p>
          <p className="text-slate-400 text-sm mt-1">Choose a message from the list to view the thread</p>
        </div>
      );
    }

    const clientName = getClientName(activeConversation);
    const isClosed = activeConversation.status === 'CLOSED';

    return (
      <div className={`flex-1 flex flex-col bg-white/60 backdrop-blur-sm ${!showMobileThread ? 'hidden md:flex' : 'flex'}`}>
        {/* Thread header */}
        <div className="px-5 py-4 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile back button */}
              <button
                onClick={() => setShowMobileThread(false)}
                className="md:hidden w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-teal-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-800 truncate">{clientName}</h2>
                <p className="text-xs text-slate-500 truncate">{activeConversation.subject || 'No subject'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={activeConversation.status} />
              {isClosed ? (
                <button
                  onClick={() => handleStatusChange('ACTIVE')}
                  className="px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 text-xs font-bold hover:bg-teal-100 transition-all duration-300"
                >
                  Reopen
                </button>
              ) : (
                <button
                  onClick={() => handleStatusChange('CLOSED')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-all duration-300"
                >
                  Close
                </button>
              )}
            </div>
          </div>
          {activeConversation.patient && (
            <div className="mt-2 ml-[52px] md:ml-[52px] flex items-center gap-1.5 text-xs text-slate-400">
              <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-600 font-semibold">
                🐾 {activeConversation.patient.name}
                {activeConversation.patient.species && ` • ${activeConversation.patient.species}`}
              </span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loadingThread ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
              <p className="text-sm text-slate-400 font-semibold">Loading messages…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm text-slate-400 font-semibold">No messages yet</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isClient = msg.senderType === 'CLIENT' || msg.senderType === 'USER';
              const isAI = msg.senderType === 'AI';
              const isStaff = msg.senderType === 'STAFF';
              const alignRight = isStaff || isAI;

              let bubbleClass = 'bg-slate-100 text-slate-800';
              let labelText = 'Client';
              let labelClass = 'text-slate-400';

              if (isStaff) {
                bubbleClass = 'bg-teal-500 text-white';
                labelText = 'Staff';
                labelClass = 'text-teal-600';
              } else if (isAI) {
                bubbleClass = 'bg-purple-500 text-white';
                labelText = 'AI';
                labelClass = 'text-purple-500';
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'}`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wide mb-1 px-1 ${labelClass}`}>
                    {labelText}
                  </span>
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${bubbleClass} ${
                      alignRight ? 'rounded-br-md' : 'rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {msg.attachments.map((att) => {
                          if (att.type === 'Image') {
                            return (
                              <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="max-w-full max-h-48 rounded-xl object-cover mt-1"
                                />
                              </a>
                            );
                          }
                          return (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`block text-xs underline ${alignRight ? 'text-white/80 hover:text-white' : 'text-teal-600 hover:text-teal-700'}`}
                            >
                              📎 {att.name}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 px-1 ${alignRight ? 'text-slate-400' : 'text-slate-400'}`}>
                    {formatMessageTime(msg.sentAt)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply composer */}
        <div className="border-t border-slate-200/70 bg-white/90 backdrop-blur-xl p-4">
          {isClosed ? (
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-50 text-slate-400 text-sm font-semibold">
              <CheckCircle className="w-4 h-4" />
              This conversation is closed.
              <button
                onClick={() => handleStatusChange('ACTIVE')}
                className="text-teal-600 hover:text-teal-700 font-bold ml-1"
              >
                Reopen
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your reply…"
                rows={2}
                className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all duration-300"
              />
              <button
                onClick={handleSendReply}
                disabled={sending || !replyText.trim()}
                className="w-11 h-11 rounded-xl bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex-shrink-0"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4.5 h-4.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-7rem)] rounded-3xl overflow-hidden border border-slate-200/70 bg-white/80 backdrop-blur-xl shadow-lg flex">
      {renderConversationList()}
      {renderMessageThread()}
    </div>
  );
};
