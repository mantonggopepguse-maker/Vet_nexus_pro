import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiService';
import { Sparkles, Activity, FileText, AlertCircle, TrendingUp, TrendingDown, Clipboard, Package } from 'lucide-react';
import { toast } from 'sonner';

interface ClinicalSupportProps {
    patientId?: string;
}

const ClinicalSupport: React.FC<ClinicalSupportProps> = ({ patientId: initialPatientId }) => {
    const [patientId, setPatientId] = useState(initialPatientId || '');
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<any>(null);
    const [trends, setTrends] = useState<any[]>([]);
    const [complaint, setComplaint] = useState('');
    const [clinicalSigns, setClinicalSigns] = useState('');
    const [vitals, setVitals] = useState({
        temperature: '',
        weight: '',
        heartRate: '',
        respiratoryRate: ''
    });

    const fetchTrends = async (id: string) => {
        try {
            const data = await api.aiDiagnostic.getHealthTrends(id);
            setTrends(data);
        } catch (error) {
            console.error('Failed to fetch trends');
        }
    };

    useEffect(() => {
        if (initialPatientId) {
            fetchTrends(initialPatientId);
        }
    }, [initialPatientId]);

    const handleAnalyze = async () => {
        if (!patientId || !complaint) {
            toast.error('Patient ID and Complaint are required');
            return;
        }

        setLoading(true);
        try {
            const result = await api.aiDiagnostic.analyzeCase({
                patientId,
                complaint,
                clinicalSigns,
                vitals: {
                    temp: vitals.temperature,
                    weight: vitals.weight,
                    hr: vitals.heartRate,
                    rr: vitals.respiratoryRate
                }
            });
            setAnalysis(result);
            toast.success('Analysis complete');
            fetchTrends(patientId);
        } catch (error) {
            toast.error('Failed to analyze case');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Case Input */}
                <div className="soft-card p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Clipboard className="w-5 h-5 text-amber-500" />
                        <h3 className="text-lg font-bold text-slate-800">Case Analysis</h3>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Patient ID</label>
                        <input
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            className="soft-input w-full p-3 text-sm"
                            placeholder="Enter Patient ID..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Chief Complaint</label>
                        <input
                            value={complaint}
                            onChange={(e) => setComplaint(e.target.value)}
                            className="soft-input w-full p-3 text-sm"
                            placeholder="e.g., Persistent coughing, lethargy"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Clinical Signs / Notes</label>
                        <textarea
                            value={clinicalSigns}
                            onChange={(e) => setClinicalSigns(e.target.value)}
                            className="soft-input w-full p-3 text-sm h-24"
                            placeholder="Describe physical exam findings..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Temp (°C)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={vitals.temperature}
                                onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                                className="soft-input w-full p-2 text-sm"
                                placeholder="38.5"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={vitals.weight}
                                onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                                className="soft-input w-full p-2 text-sm"
                                placeholder="12.4"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HR (bpm)</label>
                            <input
                                type="number"
                                value={vitals.heartRate}
                                onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })}
                                className="soft-input w-full p-2 text-sm"
                                placeholder="100"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RR (brpm)</label>
                            <input
                                type="number"
                                value={vitals.respiratoryRate}
                                onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })}
                                className="soft-input w-full p-2 text-sm"
                                placeholder="24"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={loading}
                        className="w-full soft-btn-primary py-4 rounded-xl flex items-center justify-center gap-2 font-black text-sm"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Sparkles className="w-5 h-5" />
                        )}
                        {loading ? 'Analyzing...' : 'Generate AI Insights'}
                    </button>
                </div>

                {/* Health trends */}
                <div className="soft-card p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-bold text-slate-800">Health Trends</h3>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        {trends.length > 0 ? (
                            <div className="w-full space-y-6">
                                <div className="flex items-end justify-between gap-2 h-32 px-4">
                                    {trends.map((t, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                            <div
                                                className="w-full bg-blue-400 rounded-t-lg transition-all hover:bg-blue-500"
                                                style={{ height: `${(t.weight / 25) * 100}%` }}
                                            />
                                            <span className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-sm font-bold text-slate-600">Weight Trend (Historical)</div>
                            </div>
                        ) : (
                            <>
                                <TrendingUp className="w-12 h-12 text-slate-200 mb-4" />
                                <p className="text-sm font-bold text-slate-400">No trend data available for this patient yet.<br />Perform an analysis to aggregate history.</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Lab Result Parsing */}
            <div className="soft-card p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Package className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-lg font-bold text-slate-800">Lab Result Analyzer</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">Paste raw text from lab reports (PDF, CSV, or physical printouts) to convert them into structured clinical data.</p>
                        <textarea
                            className="soft-input w-full p-4 h-48 text-sm font-mono"
                            placeholder="Paste lab report text here... e.g. BUN: 22 mg/dL (Ref: 7-27), Creatinine: 1.2..."
                            id="lab-raw-text"
                        />
                        <button
                            onClick={async () => {
                                const text = (document.getElementById('lab-raw-text') as HTMLTextAreaElement).value;
                                if (!text) {
                                    toast.error('Please paste some text first');
                                    return;
                                }
                                setLoading(true);
                                try {
                                    const result = await api.aiDiagnostic.parseLabResult({ rawText: text, patientId });
                                    setAnalysis((prev: any) => ({ ...prev, parsedLabs: result.labs }));
                                    toast.success('Labs parsed successfully');
                                } catch (error) {
                                    toast.error('Failed to parse lab result');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="soft-btn-primary px-6 py-3 flex items-center gap-2 text-sm font-black"
                        >
                            <Sparkles className="w-4 h-4" /> Parse Lab Text
                        </button>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Structured Output</h4>
                        {analysis?.parsedLabs ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="pb-2 font-black text-slate-500">Test</th>
                                            <th className="pb-2 font-black text-slate-500">Value</th>
                                            <th className="pb-2 font-black text-slate-500">Range</th>
                                            <th className="pb-2 font-black text-slate-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {analysis.parsedLabs.map((lab: any, i: number) => (
                                            <tr key={i}>
                                                <td className="py-3 font-bold text-slate-700">{lab.test}</td>
                                                <td className="py-3 text-slate-600 font-medium">{lab.value} {lab.unit}</td>
                                                <td className="py-3 text-slate-400 text-xs">{lab.range}</td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${lab.status?.toLowerCase() === 'high' ? 'bg-red-50 text-red-600' :
                                                        lab.status?.toLowerCase() === 'low' ? 'bg-blue-50 text-blue-600' :
                                                            'bg-emerald-50 text-emerald-600'
                                                        }`}>
                                                        {lab.status || 'Normal'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                                <FileText className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold">No data parsed yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Analysis Results */}
            {analysis && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="lg:col-span-2 soft-card p-6 bg-white border-l-4 border-l-amber-500">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-amber-500" />
                            <h3 className="text-lg font-bold text-slate-800">Differential Diagnoses</h3>
                        </div>
                        <div className="space-y-4">
                            {analysis.differentials.map((d: any, i: number) => (
                                <div key={i} className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-black text-amber-900">{d.diagnosis}</h4>
                                        <span className="px-2 py-1 bg-amber-200 text-amber-700 text-[10px] font-black rounded-lg uppercase">
                                            {Math.round(d.probability * 100)}% Match
                                        </span>
                                    </div>
                                    <p className="text-sm text-amber-700 leading-relaxed">{d.reasoning}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Red Flags */}
                        <div className="soft-card p-6 bg-red-50 border border-red-100">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                                <h3 className="text-sm font-black text-red-800 uppercase tracking-wider">Urgent Concerns</h3>
                            </div>
                            <ul className="space-y-2">
                                {analysis.redFlags.map((flag: string, i: number) => (
                                    <li key={i} className="flex gap-2 text-sm font-bold text-red-700">
                                        <span className="shrink-0">•</span>
                                        {flag}
                                    </li>
                                ))}
                                {analysis.redFlags.length === 0 && (
                                    <li className="text-sm font-bold text-slate-400 italic">No red flags identified.</li>
                                )}
                            </ul>
                        </div>

                        {/* Recommended Tests */}
                        <div className="soft-card p-6 bg-amber-50 border border-amber-100">
                            <div className="flex items-center gap-2 mb-3">
                                <Clipboard className="w-5 h-5 text-amber-500" />
                                <h3 className="text-sm font-black text-amber-800 uppercase tracking-wider">Recommended Tests</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {analysis.recommendedTests.map((test: string, i: number) => (
                                    <span key={i} className="px-3 py-1.5 bg-amber-200 text-amber-800 text-xs font-bold rounded-lg border border-amber-300">
                                        {test}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClinicalSupport;
