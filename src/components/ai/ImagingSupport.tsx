import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiService';
import { Sparkles, Image as ImageIcon, FileText, AlertCircle, History, ArrowRight, X, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImagingSupportProps {
    patientId?: string;
}

const ImagingSupport: React.FC<ImagingSupportProps> = ({ patientId: initialPatientId }) => {
    const [patientId, setPatientId] = useState(initialPatientId || '');
    const [loading, setLoading] = useState(false);
    const [media, setMedia] = useState<any[]>([]);
    const [selectedMedia, setSelectedMedia] = useState<any>(null);
    const [analysis, setAnalysis] = useState<any>(null);
    const [comparisonMode, setComparisonMode] = useState(false);
    const [compareWith, setCompareWith] = useState<any>(null);

    const fetchPatientMedia = async (id: string) => {
        try {
            // We'll fetch the patient details which includes media
            const patient = await api.get(`/patients/${id}`);
            setMedia((patient.media || []).filter((m: any) => m.type === 'Image'));
        } catch (error) {
            console.error('Failed to fetch media');
        }
    };

    useEffect(() => {
        if (initialPatientId) {
            fetchPatientMedia(initialPatientId);
        }
    }, [initialPatientId]);

    const handleAnalyze = async (mediaItem: any) => {
        setLoading(true);
        setAnalysis(null);
        try {
            const result = await api.aiImaging.analyze(mediaItem.id);
            setAnalysis(result);
            toast.success('Image analysis complete');
        } catch (error) {
            toast.error('Failed to analyze image');
        } finally {
            setLoading(false);
        }
    };

    const handleCompare = async () => {
        if (!selectedMedia || !compareWith) return;
        setLoading(true);
        try {
            const result = await api.aiImaging.compare(selectedMedia.id, compareWith.id);
            setAnalysis({ comparison: result });
            toast.success('Comparison complete');
        } catch (error) {
            toast.error('Failed to compare images');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Media Gallery / Selection */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="soft-card p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-amber-500" />
                                Patient Gallery
                            </h3>
                            <button
                                onClick={() => patientId && fetchPatientMedia(patientId)}
                                className="text-[10px] font-black text-amber-600 hover:bg-amber-50 px-2 py-1 rounded"
                            >
                                Refresh
                            </button>
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                            {media.length === 0 ? (
                                <div className="py-12 text-center text-slate-400">
                                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-10" />
                                    <p className="text-xs font-bold">No images found</p>
                                </div>
                            ) : (
                                media.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            if (comparisonMode) {
                                                if (selectedMedia?.id === item.id) return;
                                                setCompareWith(item);
                                            } else {
                                                setSelectedMedia(item);
                                                setAnalysis(null);
                                            }
                                        }}
                                        className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${selectedMedia?.id === item.id ? 'border-amber-500 ring-4 ring-amber-500/10' :
                                                compareWith?.id === item.id ? 'border-emerald-500 ring-4 ring-emerald-500/10' :
                                                    'border-transparent hover:border-slate-200'
                                            }`}
                                    >
                                        <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                        <div className="absolute bottom-1 left-1 right-1 p-1.5 bg-white/90 backdrop-blur rounded-lg translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                                            <p className="text-[9px] font-black truncate">{item.name}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Analysis Area */}
                <div className="lg:col-span-3 space-y-6">
                    {!selectedMedia ? (
                        <div className="soft-card p-24 flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                                <ImageIcon className="w-12 h-12 text-amber-500" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Radiology AI Support</h2>
                            <p className="text-slate-500 max-w-sm">Select an image from the patient gallery to begin clinical analysis or longitudinal comparison.</p>
                        </div>
                    ) : (
                        <>
                            <div className="soft-card p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-50 rounded-lg">
                                            <Sparkles className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800">Clinical Interpretation</h3>
                                            <p className="text-xs font-bold text-slate-400">Media: {selectedMedia.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setComparisonMode(!comparisonMode);
                                                setCompareWith(null);
                                                setAnalysis(null);
                                            }}
                                            className={`soft-btn px-4 py-2 text-xs font-black flex items-center gap-2 ${comparisonMode ? 'bg-amber-600 text-white hover:bg-amber-700' : 'text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            <History className="w-4 h-4" /> {comparisonMode ? 'Back to Analysis' : 'Longitudinal Comparison'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (comparisonMode) handleCompare();
                                                else handleAnalyze(selectedMedia);
                                            }}
                                            disabled={loading || (comparisonMode && !compareWith)}
                                            className="soft-btn-primary px-6 py-2 text-xs font-black flex items-center gap-2"
                                        >
                                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                            {comparisonMode ? 'Compare Images' : 'Generate AI Report'}
                                        </button>
                                    </div>
                                </div>

                                <div className={`grid gap-6 ${comparisonMode ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-5'}`}>
                                    <div className={comparisonMode ? '' : 'lg:col-span-2'}>
                                        <div className="relative group rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 aspect-video lg:aspect-square">
                                            <img src={selectedMedia.url} className="w-full h-full object-contain" alt="Selected" />
                                            <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
                                                Primary Study
                                            </div>
                                        </div>
                                    </div>

                                    {comparisonMode && (
                                        <div className="relative group rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 aspect-video lg:aspect-square">
                                            {compareWith ? (
                                                <>
                                                    <img src={compareWith.url} className="w-full h-full object-contain" alt="Compare" />
                                                    <div className="absolute top-4 left-4 px-3 py-1 bg-emerald-500/80 backdrop-blur rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
                                                        Reference Study
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-2xl">
                                                    <History className="w-8 h-8 opacity-20" />
                                                    <p className="text-xs font-bold">Select second image from gallery</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!comparisonMode && analysis && !analysis.comparison && (
                                        <div className="lg:col-span-3 space-y-6 animate-in fade-in slide-in-from-right-4">
                                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Findings</h4>
                                                <p className="text-sm text-slate-700 leading-relaxed font-medium">{analysis.findings}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                                                    <h4 className="text-xs font-black text-red-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                        <AlertCircle className="w-4 h-4" /> Impressions
                                                    </h4>
                                                    <ul className="space-y-2">
                                                        {analysis.impressions?.map((imp: string, i: number) => (
                                                            <li key={i} className="text-xs font-bold text-red-900">• {imp}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                                                    <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-4">Recommendations</h4>
                                                    <ul className="space-y-2">
                                                        {analysis.recommendations?.map((rec: string, i: number) => (
                                                            <li key={i} className="text-xs font-bold text-amber-900">• {rec}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {comparisonMode && analysis?.comparison && (
                                    <div className="mt-8 bg-amber-50 rounded-2xl p-8 border border-amber-100 animate-in fade-in slide-in-from-bottom-4">
                                        <div className="flex items-center justify-between mb-6">
                                            <h4 className="text-lg font-black text-amber-900 flex items-center gap-2">
                                                <History className="w-5 h-5" /> Progression Analysis
                                            </h4>
                                            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase ${analysis.comparison.progression === 'IMPROVING' ? 'bg-emerald-500 text-white' :
                                                    analysis.comparison.progression === 'WORSENING' ? 'bg-red-500 text-white' :
                                                        'bg-amber-400 text-white'
                                                }`}>
                                                {analysis.comparison.progression}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                            <div className="lg:col-span-2">
                                                <p className="text-sm text-amber-900 leading-relaxed font-medium">{analysis.comparison.summary}</p>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="bg-white/50 backdrop-blur p-4 rounded-xl border border-amber-200">
                                                    <h5 className="text-[10px] font-black text-amber-400 uppercase mb-1">Quantitative Change</h5>
                                                    <p className="text-sm font-black text-amber-900">{analysis.comparison.quantitativeChange}</p>
                                                </div>
                                                <div className="bg-white/50 backdrop-blur p-4 rounded-xl border border-amber-200">
                                                    <h5 className="text-[10px] font-black text-amber-400 uppercase mb-2">Next Steps</h5>
                                                    <ul className="space-y-1">
                                                        {analysis.comparison.nextSteps?.map((step: string, i: number) => (
                                                            <li key={i} className="text-[11px] font-bold text-amber-800">• {step}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImagingSupport;
