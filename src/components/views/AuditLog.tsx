
import React, { useState } from 'react';
import { LogEntry } from '../../types';
import { Search, Clock, User } from 'lucide-react';

interface AuditLogProps {
  logs: LogEntry[];
}

export const AuditLog: React.FC<AuditLogProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => 
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-xl font-extrabold text-slate-800">Audit Log</h2>
                <p className="text-slate-400 font-medium text-sm">Track system changes</p>
            </div>
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search logs..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full soft-input pl-10 pr-4 py-2 text-sm font-bold text-slate-600"
                />
            </div>
        </div>

        <div className="soft-card overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                            <th className="p-4">Time</th>
                            <th className="p-4">User</th>
                            <th className="p-4">Module</th>
                            <th className="p-4">Action</th>
                            <th className="p-4">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition">
                                <td className="p-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3 h-3 text-slate-300" />
                                        {new Date(log.timestamp).toLocaleString()}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-600">
                                            {log.userName.charAt(0)}
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">{log.userName}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-[10px] font-extrabold uppercase">
                                        {log.module}
                                    </span>
                                </td>
                                <td className="p-4 text-sm font-bold text-slate-700">{log.action}</td>
                                <td className="p-4 text-sm text-slate-500 max-w-md truncate" title={log.details}>
                                    {log.details}
                                </td>
                            </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400 text-sm font-medium">
                                    No records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};




