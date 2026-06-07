import React, { useState, useEffect } from 'react';
import { AudioRecorder } from './AudioRecorder';
import { SOAPNoteEditor } from './SOAPNoteEditor';
import { api } from '../../services/apiService';
import { toast } from 'sonner';
import { Client, Pet, User } from '../../types';
import { ClipboardList, Mic, History, User as UserIcon } from 'lucide-react';

interface ClinicalScribeProps {
    currentUser: User;
    clients: Client[];
    patients: Pet[];
    initialPatientId?: string;
}

export const ClinicalScribe: React.FC<ClinicalScribeProps> = ({ currentUser, clients, patients, initialPatientId }) => {
    const [activeStep, setActiveStep] = useState<'RECORD' | 'EDIT' | 'HISTORY'>('RECORD');
    const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || '');
    const [isProcessing, setIsProcessing] = useState(false);
    const [generatedSoap, setGeneratedSoap] = useState<any>(null);
    const [transcriptId, setTranscriptId] = useState<string | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Filter patients based on selection or show all
    const sortedPatients = [...patients].sort((a, b) => a.name.localeCompare(b.name));

    const handleRecordingComplete = async (file: File) => {
        if (!selectedPatientId) {
            toast.error('Please select a patient before processing audio');
            return;
        }

        setIsProcessing(true);
        try {
            // 1. Transcribe
            const transcriptRes = await api.aiScribe.transcribe(file, selectedPatientId);
            setTranscriptId(transcriptRes.id);
            toast.success('Transcription complete. Generating SOAP note...');

            // 2. Generate SOAP
            const soapRes = await api.aiScribe.generateSOAP(transcriptRes.id, selectedPatientId);
            setGeneratedSoap(soapRes);
            setActiveStep('EDIT');
            toast.success('SOAP Note Generated');

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to process recording');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApprove = async (data: any) => {
        try {
            await api.aiScribe.approveSOAP(data.id, data);
            toast.success('Record approved and saved to treatments');
            setGeneratedSoap(null);
            setActiveStep('RECORD');
            setSelectedPatientId('');
        } catch (error: any) {
            toast.error('Failed to approve record');
        }
    };

    const handleReject = async () => {
        if (window.confirm('Discard this draft?')) {
            setGeneratedSoap(null);
            setActiveStep('RECORD');
            toast.info('Draft discarded');
        }
    };

    useEffect(() => {
        if (activeStep === 'HISTORY') {
            fetchHistory();
        }
    }, [activeStep]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const data = await api.aiScribe.getHistory();
            setHistory(data || []);
        } catch (error) {
            toast.error('Failed to fetch scribe history');
        } finally {
            setLoadingHistory(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Top Bar */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Clinical Scribe AI</h1>
                    <p className="text-slate-500">Automated documentation assistant</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveStep('RECORD')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${activeStep === 'RECORD' ? 'bg-peach-100 text-peach-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Mic className="w-4 h-4" />
                            New Recording
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveStep('HISTORY')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${activeStep === 'HISTORY' ? 'bg-peach-100 text-peach-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4" />
                            History
                        </div>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {activeStep === 'RECORD' && !generatedSoap && (
                    <div className="max-w-2xl mx-auto flex flex-col items-center gap-8 py-12">

                        {/* Patient Selector */}
                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Select Patient</label>
                            <select
                                value={selectedPatientId}
                                onChange={(e) => setSelectedPatientId(e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-peach-500 focus:border-peach-500 bg-white"
                                disabled={isProcessing}
                            >
                                <option value="">-- Select a patient --</option>
                                {sortedPatients.map(p => {
                                    const owner = clients.find(c => c.id === p.ownerId);
                                    return (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.species}) - Owner: {owner?.firstName} {owner?.lastName}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className="w-full border-t border-slate-200 my-4" />

                        <div className="w-full">
                            <AudioRecorder
                                onRecordingComplete={handleRecordingComplete}
                                isProcessing={isProcessing}
                            />
                        </div>

                        <div className="text-center text-slate-500 text-sm max-w-md">
                            <p>
                                Record your consultation or upload an audio file.
                                The AI will transcribe the audio and generate a structured SOAP note for your review.
                            </p>
                        </div>
                    </div>
                )}

                {(activeStep === 'EDIT' || generatedSoap) && (
                    <div className="pb-20">
                        <SOAPNoteEditor
                            initialData={generatedSoap}
                            onApprove={handleApprove}
                            onReject={handleReject}
                        />
                    </div>
                )}

                {/* History View */}
                {activeStep === 'HISTORY' && (
                    <div className="max-w-4xl mx-auto space-y-4 pb-12">
                        {loadingHistory ? (
                            <div className="flex justify-center py-20">
                                <div className="w-8 h-8 border-4 border-peach-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <History className="w-12 h-12 mb-4 opacity-20" />
                                <p className="font-bold">No scribe history found</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {history.map((item) => {
                                    const patient = patients.find(p => p.id === item.patientId);
                                    return (
                                        <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-peach-50 flex items-center justify-center text-peach-600">
                                                        <ClipboardList className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-800">{patient?.name || 'Unknown Patient'}</h3>
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                            {new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setGeneratedSoap(item.soapNote);
                                                            setActiveStep('EDIT');
                                                        }}
                                                        className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-black rounded-lg hover:bg-peach-600 hover:text-white transition-all uppercase tracking-wider"
                                                    >
                                                        Review SOAP
                                                    </button>
                                                </div>
                                            </div>
                                            {item.transcript && (
                                                <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                                                    <p className="text-sm text-slate-600 line-clamp-2 italic">"{item.transcript}"</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
