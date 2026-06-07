import React, { useState } from 'react';
import { Save, CheckCircle, XCircle, AlertTriangle, FileText, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface SOAPNoteData {
    id?: string;
    transcriptId?: string;
    patientId: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    visitSummary?: string;
    dischargeNotes?: string;
    status: 'DRAFT' | 'APPROVED' | 'REJECTED';
}

interface SOAPNoteEditorProps {
    initialData: SOAPNoteData;
    onApprove: (data: SOAPNoteData) => Promise<void>;
    onReject: () => Promise<void>;
    onSaveDraft?: (data: SOAPNoteData) => Promise<void>;
    readOnly?: boolean;
}

export const SOAPNoteEditor: React.FC<SOAPNoteEditorProps> = ({
    initialData,
    onApprove,
    onReject,
    onSaveDraft,
    readOnly = false
}) => {
    const [data, setData] = useState<SOAPNoteData>(initialData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedSection, setExpandedSection] = useState<string | null>('subjective');

    const handleChange = (field: keyof SOAPNoteData, value: string) => {
        if (readOnly) return;
        setData(prev => ({ ...prev, [field]: value }));
    };

    const sections = [
        { id: 'subjective', label: 'Subjective (History)', icon: FileText, color: 'blue' },
        { id: 'objective', label: 'Objective (Exam Findings)', icon: FileText, color: 'green' },
        { id: 'assessment', label: 'Assessment (Diagnosis)', icon: FileText, color: 'peach' },
        { id: 'plan', label: 'Plan (Treatment)', icon: FileText, color: 'amber' },
    ];

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    const handleApprove = async () => {
        if (window.confirm('This will finalize the record and create a treatment entry. Continue?')) {
            setIsSubmitting(true);
            try {
                await onApprove(data);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    return (
        <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
            {/* Header / Status Banner */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${data.status === 'DRAFT'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : data.status === 'APPROVED'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                <div className="flex items-center gap-2">
                    {data.status === 'DRAFT' && <AlertTriangle className="w-5 h-5" />}
                    {data.status === 'APPROVED' && <CheckCircle className="w-5 h-5" />}
                    <span className="font-semibold text-lg">{data.status} MODE</span>
                    {data.status === 'DRAFT' && <span className="text-sm opacity-75">- Review and edit before approving</span>}
                </div>

                {data.status === 'DRAFT' && !readOnly && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => onReject()}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-white/50 hover:bg-white text-red-700 rounded-lg text-sm font-medium transition"
                        >
                            Reject Draft
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium shadow-sm transition flex items-center gap-2"
                        >
                            {isSubmitting ? 'Approving...' : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    Approve & Save
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Main SOAP Sections */}
                <div className="flex flex-col gap-4">
                    {sections.map((section) => (
                        <div key={section.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <button
                                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                                className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition"
                            >
                                <div className="flex items-center gap-2 font-semibold text-slate-700">
                                    <section.icon className={`w-4 h-4 text-${section.color}-600`} />
                                    {section.label}
                                </div>
                                {expandedSection === section.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </button>

                            {expandedSection === section.id && (
                                <div className="p-4">
                                    <textarea
                                        value={(data as any)[section.id]}
                                        onChange={(e) => handleChange(section.id as keyof SOAPNoteData, e.target.value)}
                                        disabled={readOnly}
                                        className="w-full h-48 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-peach-500 focus:border-peach-500 text-slate-700 leading-relaxed font-mono text-sm resize-none"
                                        placeholder={`Enter ${section.label.toLowerCase()} details...`}
                                    />
                                    <div className="flex justify-end mt-2">
                                        <button
                                            onClick={() => handleCopy((data as any)[section.id])}
                                            className="text-xs text-slate-400 hover:text-peach-600 flex items-center gap-1"
                                        >
                                            <Copy className="w-3 h-3" /> Copy
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Client Facing Outputs */}
                <div className="flex flex-col gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            Client Summary (Take Home)
                        </h3>
                        <textarea
                            value={data.visitSummary || ''}
                            onChange={(e) => handleChange('visitSummary', e.target.value)}
                            disabled={readOnly}
                            className="w-full h-32 p-3 bg-white border border-slate-200 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-peach-500"
                            placeholder="Client-friendly summary of the visit..."
                        />

                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            Discharge Instructions
                        </h3>
                        <textarea
                            value={data.dischargeNotes || ''}
                            onChange={(e) => handleChange('dischargeNotes', e.target.value)}
                            disabled={readOnly}
                            className="w-full h-32 p-3 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-peach-500"
                            placeholder="Instructions for the owner..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
