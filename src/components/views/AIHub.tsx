import React, { useState } from 'react';
import { ClinicalScribe } from '../ai/ClinicalScribe';
import { ActivityLog } from '../ai/ActivityLog';
import ClientAssistant from '../ai/ClientAssistant';
import FAQEditor from '../ai/FAQEditor';
import OperationsDashboard from '../ai/OperationsDashboard';
import ClinicalSupport from '../ai/ClinicalSupport';
import ImagingSupport from '../ai/ImagingSupport';
import { ClinicSettings, Client, Pet, User } from '../../types';
import { Bot, FileText, Smartphone, Settings, BookOpen, TrendingUp, Sparkles, Image as ImageIcon } from 'lucide-react';

interface AIHubProps {
    currentUser: User | null;
    settings: ClinicSettings;
    clients?: Client[];
    patients?: Pet[];
    initialTab?: 'SCRIBE' | 'CLIENT' | 'OPERATIONS' | 'LOGS';
    initialPatientId?: string;
}

export const AIHub: React.FC<AIHubProps> = ({ currentUser, settings, clients = [], patients = [], initialTab = 'SCRIBE', initialPatientId }) => {
    const [activeTab, setActiveTab] = useState<'SCRIBE' | 'CLIENT' | 'SUPPORT' | 'IMAGING' | 'OPERATIONS' | 'LOGS' | 'FAQ'>(initialTab);

    if (!currentUser) return null;

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* AI Hub Header & Navigation */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-200">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">VET-Sync AI</h1>
                            <p className="text-xs text-slate-500 font-medium">Intelligent Practice Assistant</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-1">
                    <button
                        onClick={() => setActiveTab('SCRIBE')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'SCRIBE' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <FileText className="w-4 h-4" />
                        Clinical Scribe
                    </button>
                    <button
                        onClick={() => setActiveTab('CLIENT')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'CLIENT' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <Smartphone className="w-4 h-4" />
                        Client Assistant
                    </button>
                    <button
                        onClick={() => setActiveTab('FAQ')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'FAQ' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <BookOpen className="w-4 h-4" />
                        Knowledge Base
                    </button>
                    <button
                        onClick={() => setActiveTab('OPERATIONS')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'OPERATIONS' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        Operations
                    </button>
                    <button
                        onClick={() => setActiveTab('LOGS')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'LOGS' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <Settings className="w-4 h-4" />
                        Activity Log
                    </button>
                    <button
                        onClick={() => setActiveTab('SUPPORT')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'SUPPORT' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        Clinical Support
                    </button>
                    <button
                        onClick={() => setActiveTab('IMAGING')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'IMAGING' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <ImageIcon className="w-4 h-4" />
                        Imaging Support
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-6">
                {activeTab === 'SCRIBE' && (
                    <ClinicalScribe
                        currentUser={currentUser}
                        clients={clients}
                        patients={patients}
                        initialPatientId={initialPatientId}
                    />
                )}

                {activeTab === 'CLIENT' && (
                    <ClientAssistant currentUser={currentUser} />
                )}

                {activeTab === 'FAQ' && (
                    <FAQEditor currentUser={currentUser} />
                )}

                {activeTab === 'OPERATIONS' && (
                    <OperationsDashboard />
                )}

                {activeTab === 'SUPPORT' && (
                    <ClinicalSupport patientId={initialPatientId} />
                )}

                {activeTab === 'IMAGING' && (
                    <ImagingSupport patientId={initialPatientId} />
                )}

                {activeTab === 'LOGS' && (
                    <ActivityLog />
                )}
            </div>
        </div>
    );
};
