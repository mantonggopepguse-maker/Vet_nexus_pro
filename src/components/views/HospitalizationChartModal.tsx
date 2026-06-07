import React, { useState, useEffect } from 'react';
import { Clock, Pill, Package, FileText, Calendar, HeartPulse, X, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/apiService';

interface HospitalizationChartModalProps {
    hospitalization: any;
    patientName: string;
    onClose: () => void;
}

export const HospitalizationChartModal: React.FC<HospitalizationChartModalProps> = ({ hospitalization, patientName, onClose }) => {
    const [hospChartTab, setHospChartTab] = useState<'FLOWSHEET' | 'PRESCRIPTIONS' | 'NOTES'>('FLOWSHEET');
    const [hospFlowsheet, setHospFlowsheet] = useState<any[]>([]);
    const [hospPrescriptions, setHospPrescriptions] = useState<any[]>([]);
    const [hospNotes, setHospNotes] = useState<any[]>([]);
    const [hospChartLoading, setHospChartLoading] = useState(true);

    useEffect(() => {
        const loadChartData = async () => {
            setHospChartLoading(true);
            try {
                const [fs, rx, nt] = await Promise.all([
                    api.hospitalization.getFlowsheet(hospitalization.id),
                    api.hospitalization.getPrescriptions(hospitalization.id),
                    api.hospitalization.getNotes(hospitalization.id)
                ]);
                setHospFlowsheet(fs);
                setHospPrescriptions(rx);
                setHospNotes(nt);
            } catch (err) {
                console.error('Failed to load chart data:', err);
            } finally {
                setHospChartLoading(false);
            }
        };
        loadChartData();
    }, [hospitalization.id]);

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-[#F2F4F8] h-full shadow-2xl flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="pt-8 px-8 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <HeartPulse className="w-8 h-8 text-rose-500" />
                                <h2 className="text-3xl font-black text-slate-800 tracking-tight">{patientName}'s Chart</h2>
                            </div>
                            <div className="flex gap-3 text-sm font-bold text-slate-500">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${hospitalization.status === 'Admitted' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                    {hospitalization.status}
                                </span>
                                <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-600 text-[10px] font-bold border border-slate-200 uppercase tracking-wider">{hospitalization.reason || 'Hospitalization'}</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-100 rounded-2xl text-slate-400 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {/* Tabs */}
                    <div className="flex gap-8 border-b border-slate-100">
                        <button 
                            className={`pb-4 text-sm font-black tracking-wider border-b-[3px] transition-colors ${hospChartTab === 'FLOWSHEET' ? 'border-rose-500 text-rose-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setHospChartTab('FLOWSHEET')}
                        >FLOWSHEET</button>
                        <button 
                            className={`pb-4 text-sm font-black tracking-wider border-b-[3px] transition-colors ${hospChartTab === 'PRESCRIPTIONS' ? 'border-peach-500 text-peach-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setHospChartTab('PRESCRIPTIONS')}
                        >PRESCRIPTIONS</button>
                        <button 
                            className={`pb-4 text-sm font-black tracking-wider border-b-[3px] transition-colors ${hospChartTab === 'NOTES' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setHospChartTab('NOTES')}
                        >DAILY NOTES</button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                    {hospChartLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-rose-500 rounded-full animate-spin mb-4" />
                            <div className="font-bold">Loading chart data...</div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            {hospChartTab === 'FLOWSHEET' && (
                                hospFlowsheet.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">No chart entries recorded for this stay.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {hospFlowsheet.map((entry: any) => (
                                            <div key={entry.id} className="soft-card p-5 bg-white border border-slate-100 shadow-sm transition-shadow hover:shadow-md">
                                                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-50">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-5 h-5 text-slate-400" />
                                                        <span className="text-sm font-extrabold text-slate-700">
                                                            {new Date(entry.time).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                                        {entry.staff?.name || 'Staff'}
                                                    </span>
                                                </div>
                                                {(entry.temperature || entry.heartRate || entry.respiratoryRate) && (
                                                    <div className="flex flex-wrap gap-2 mb-4">
                                                        {entry.temperature && <span className="text-[11px] font-black tracking-wide text-orange-600 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">Temp: {entry.temperature}</span>}
                                                        {entry.heartRate && <span className="text-[11px] font-black tracking-wide text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">HR: {entry.heartRate}</span>}
                                                        {entry.respiratoryRate && <span className="text-[11px] font-black tracking-wide text-cyan-600 bg-cyan-50 px-3 py-1.5 rounded-xl border border-cyan-100">RR: {entry.respiratoryRate}</span>}
                                                    </div>
                                                )}
                                                {Array.isArray(entry.medicationsGiven) && entry.medicationsGiven.length > 0 && (
                                                    <div className="mb-4 p-4 bg-peach-50/50 rounded-2xl border border-peach-100">
                                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-peach-400 mb-2 border-b border-peach-100 pb-2">Administered Medications</h4>
                                                        <div className="flex flex-col gap-2">
                                                              {entry.medicationsGiven.map((med: string, i: number) => (
                                                                 <span key={i} className="flex items-center gap-2 text-xs font-bold text-peach-700">
                                                                    <CheckCircle2 className="w-3 h-3 text-peach-500" /> {med}
                                                                 </span>
                                                              ))}
                                                        </div>                                                    </div>
                                                )}
                                                {entry.notes && (
                                                  <div className="text-sm font-medium text-slate-600 bg-slate-50 p-4 leading-relaxed rounded-2xl border border-slate-100">
                                                      {entry.notes}
                                                  </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                            {hospChartTab === 'PRESCRIPTIONS' && (
                                hospPrescriptions.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm flex flex-col items-center gap-3">
                                        <Pill className="w-8 h-8 text-slate-200" />
                                        No prescriptions recorded.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {hospPrescriptions.map((rx: any) => (
                                            <div key={rx.id} className="soft-card p-6 bg-white border border-slate-100 shadow-sm">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${rx.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                        {rx.status}
                                                    </span>
                                                    {rx.inventoryItemId && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex items-center gap-1 border border-blue-100"><Package className="w-3 h-3"/> Linked</span>}
                                                </div>
                                                <h4 className="font-black text-slate-800 text-xl flex flex-wrap gap-2 items-baseline mb-1">
                                                    {rx.drugName} <span className="text-peach-600 font-bold text-base bg-peach-50 px-2 py-0.5 rounded-lg border border-peach-100">{rx.dose}</span>
                                                </h4>
                                                <p className="text-sm font-bold text-slate-500 mb-4 bg-slate-50 inline-block px-3 py-1 rounded-lg border border-slate-100">{rx.route} • {rx.frequency}</p>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-4 border-t border-slate-100">
                                                    Prescribed by <span className="text-slate-600">{rx.vet?.name || 'Dr.'}</span> on {new Date(rx.datePrescribed).toLocaleDateString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                            {hospChartTab === 'NOTES' && (
                                hospNotes.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm flex flex-col items-center gap-3">
                                        <FileText className="w-8 h-8 text-slate-200" />
                                        No progress notes recorded.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {hospNotes.map((note: any) => (
                                            <div key={note.id} className="soft-card p-6 bg-white border border-slate-100 shadow-sm">
                                                <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
                                                    <h4 className="font-black text-slate-800 flex items-center gap-2">
                                                        <Calendar className="w-5 h-5 text-amber-500" />
                                                        {new Date(note.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                    </h4>
                                                    <span className="text-[10px] font-black tracking-wider uppercase bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1 rounded-full">Dr. {note.vet?.name || 'Unassigned'}</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-4">
                                                        {note.subjective && <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><h5 className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-2">Subjective</h5><p className="text-sm font-medium text-slate-700 leading-relaxed">{note.subjective}</p></div>}
                                                        {note.objective && <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><h5 className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-2">Objective</h5><p className="text-sm font-medium text-slate-700 leading-relaxed">{note.objective}</p></div>}
                                                    </div>
                                                    <div className="space-y-4">
                                                        {note.assessment && <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><h5 className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-2">Assessment</h5><p className="text-sm font-medium text-slate-700 leading-relaxed">{note.assessment}</p></div>}
                                                        {note.plan && <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100"><h5 className="text-[10px] uppercase font-black tracking-wider text-amber-400 mb-2">Plan</h5><p className="text-sm font-medium text-slate-700 leading-relaxed">{note.plan}</p></div>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
