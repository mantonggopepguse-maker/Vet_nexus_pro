import React, { useState, useEffect } from 'react';
import { Bell, Clock, CheckCircle2, XCircle, Filter, Search, Send, Calendar } from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';

export const ReminderList: React.FC = () => {
    const [reminders, setReminders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('Pending');
    const [searchTerm, setSearchTerm] = useState('');

    const loadReminders = async () => {
        setLoading(true);
        try {
            const data = await api.reminders.getAll(statusFilter);
            setReminders(data);
        } catch (error) {
            console.error('Failed to load reminders:', error);
            toast.error('Failed to load reminder queue');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReminders();
    }, [statusFilter]);

    const handleCancel = async (id: string) => {
        try {
            await api.reminders.cancel(id);
            toast.success('Reminder cancelled');
            loadReminders();
        } catch (error) {
            toast.error('Failed to cancel reminder');
        }
    };

    const filteredReminders = reminders.filter(r =>
        r.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.client?.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.client?.lastName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Communication Queue</h1>
                    <p className="text-slate-500 font-medium">Automated & scheduled reminders for your clients</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-1 rounded-xl flex">
                        {['Pending', 'Sent', 'Failed'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${statusFilter === status ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="soft-card p-4 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by client or message..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl w-full text-sm focus:ring-2 focus:ring-amber-500"
                    />
                </div>
                <button
                    onClick={loadReminders}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                >
                    <Filter className="w-4 h-4" />
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                </div>
            ) : filteredReminders.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Bell className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">No {statusFilter.toLowerCase()} reminders found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredReminders.map((reminder) => (
                        <div key={reminder.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${reminder.status === 'Sent' ? 'bg-emerald-50 text-emerald-500' :
                                            reminder.status === 'Failed' ? 'bg-rose-50 text-rose-500' :
                                                'bg-amber-50 text-amber-500'
                                        }`}>
                                        {reminder.status === 'Sent' ? <CheckCircle2 className="w-6 h-6" /> :
                                            reminder.status === 'Failed' ? <XCircle className="w-6 h-6" /> :
                                                <Clock className="w-6 h-6" />}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500 tracking-wider">
                                                {reminder.type}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                Scheduled: {new Date(reminder.scheduledFor).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-slate-800 font-medium leading-relaxed">{reminder.message}</p>
                                        <div className="flex items-center gap-4 pt-1">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                                                    {reminder.client?.firstName[0]}
                                                </div>
                                                <span className="text-xs font-bold text-slate-600">
                                                    {reminder.client?.firstName} {reminder.client?.lastName}
                                                </span>
                                            </div>
                                            {reminder.patient && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    For: {reminder.patient.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {reminder.status === 'Pending' && (
                                    <button
                                        onClick={() => handleCancel(reminder.id)}
                                        className="soft-btn px-3 py-1.5 text-[10px] font-black uppercase text-rose-600 hover:bg-rose-50"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
