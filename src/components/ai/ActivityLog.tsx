import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiService';
import { Loader2, Bot, Calendar, User as UserIcon, CheckCircle, Smartphone, Activity } from 'lucide-react';
import { format } from 'date-fns';

export const ActivityLog = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, [page]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [logsData, statsData] = await Promise.all([
                api.aiActivity.getLogs(page, 50),
                api.aiActivity.getStats()
            ]);
            setLogs(logsData.data);
            setStats(statsData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getAgentIcon = (type: string) => {
        switch (type) {
            case 'SCRIBE': return <Bot className="w-5 h-5 text-peach-600" />;
            case 'CLIENT_COMM': return <Smartphone className="w-5 h-5 text-blue-600" />;
            default: return <Activity className="w-5 h-5 text-slate-600" />;
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-slate-500 text-sm font-medium">Monthly Actions</span>
                    <div className="text-3xl font-bold text-slate-800 mt-2">{stats?.totalActions || 0}</div>
                </div>
                {stats?.breakdown?.map((b: any) => (
                    <div key={b.agent} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-slate-500 text-sm font-medium">{b.agent} Usage</span>
                        <div className="text-3xl font-bold text-slate-800 mt-2">{b.count}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-peach-600" />
                        Audit Trail
                    </h3>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-6 py-3">Timestamp</th>
                                <th className="px-6 py-3">Agent</th>
                                <th className="px-6 py-3">Action</th>
                                <th className="px-6 py-3">User</th>
                                <th className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-peach-600" />
                                    </td>
                                </tr>
                            ) : logs.map((log) => (
                                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-mono text-slate-500">
                                        {format(new Date(log.createdAt), 'MMM dd, HH:mm')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getAgentIcon(log.agentType)}
                                            <span className="font-medium text-slate-700">{log.agentType}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-700 font-medium">
                                        {log.action}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                                                {log.user?.name?.charAt(0)}
                                            </div>
                                            {log.user?.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.status === 'SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {log.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
