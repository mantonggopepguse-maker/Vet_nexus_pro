import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    Activity,
    ArrowLeft,
    Calendar,
    ChevronRight,
    Dog,
    Download,
    Edit2,
    Eye,
    FileText,
    FileText as FileTextIcon,
    HeartPulse,
    Image as ImageIcon,
    Loader2,
    Microscope,
    MoreVertical,
    PawPrint,
    Plus,
    Printer,
    Save,
    ShieldCheck,
    Sparkles,
    Stethoscope,
    Syringe,
    Trash2,
    Upload,
    User as UserIcon,
    X
} from 'lucide-react';
import { api } from '../../services/apiService';
import { Client, ClinicSettings, Pet, Procedure, User } from '../../types';
import { NewTreatmentForm } from '../forms/NewTreatmentForm';
import LabTrendAnalyzer from '../shared/LabTrendAnalyzer';
import { formatDateOnly } from '../../utils/date';
import PharmacyLabel from '../shared/PharmacyLabel';
import { VaccinationTab } from './VaccinationTab';
import { HospitalizationChartModal } from './HospitalizationChartModal';

interface PatientDetailsProps {
    patientId: string;
    settings: ClinicSettings;
    procedures: Procedure[];
    clients: Client[];
    currentUser: User | null;
    onBack: () => void;
    onViewOwner: (ownerId: string) => void;
    onEditPatient?: (patientId: string) => void;
    onDeletePatient?: (patientId: string) => void;
}

type PatientTab = 'HISTORY' | 'VACCINATIONS' | 'LABS' | 'HOSPITALIZATIONS' | 'MEDIA' | 'CONSENT';

const tabs: Array<{ id: PatientTab; label: string; icon: React.ElementType }> = [
    { id: 'HISTORY', label: 'History', icon: Stethoscope },
    { id: 'VACCINATIONS', label: 'Vaccines', icon: Syringe },
    { id: 'LABS', label: 'Labs', icon: Microscope },
    { id: 'HOSPITALIZATIONS', label: 'Hospital stays', icon: HeartPulse },
    { id: 'MEDIA', label: 'Files', icon: ImageIcon },
    { id: 'CONSENT', label: 'Consent', icon: FileText },
];

const getPetToneClass = (breed?: string, species?: string) => {
    const value = `${breed || ''} ${species || ''}`.toLowerCase();
    if (/(cat|persian|siamese|maine coon)/.test(value)) return 'bg-rose-50 text-rose-500 border-rose-100';
    if (/(parrot|bird|canary)/.test(value)) return 'bg-amber-50 text-amber-500 border-amber-100';
    if (/(shepherd|husky|retriever|labrador|dog)/.test(value)) return 'bg-teal-50 text-teal-600 border-teal-100';
    return 'bg-sky-50 text-sky-600 border-sky-100';
};

export const PatientDetails: React.FC<PatientDetailsProps> = ({
    patientId,
    settings,
    procedures,
    clients,
    currentUser,
    onBack,
    onViewOwner,
    onEditPatient,
    onDeletePatient
}) => {
    const [patient, setPatient] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<PatientTab>('HISTORY');
    const [viewMode, setViewMode] = useState<'LIST' | 'TIMELINE'>('TIMELINE');
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [editingTreatment, setEditingTreatment] = useState<any>(null);
    const [viewingTreatment, setViewingTreatment] = useState<any>(null);
    const [deletingTreatmentId, setDeletingTreatmentId] = useState<string | null>(null);
    const [viewingHospChart, setViewingHospChart] = useState<any>(null);
    const [printingMed, setPrintingMed] = useState<any>(null);
    const [selectedTrendTest, setSelectedTrendTest] = useState<string | null>(null);
    const [isGeneratingReferral, setIsGeneratingReferral] = useState(false);
    const [generatedReferral, setGeneratedReferral] = useState<string | null>(null);
    const [isGeneratingHomeCare, setIsGeneratingHomeCare] = useState(false);
    const [generatedHomeCare, setGeneratedHomeCare] = useState<string | null>(null);

    useEffect(() => {
        loadPatientDetails();
    }, [patientId]);

    useEffect(() => {
        const checkOutside = () => setActiveMenuId(null);
        window.addEventListener('click', checkOutside);
        return () => window.removeEventListener('click', checkOutside);
    }, []);

    const loadPatientDetails = async () => {
        setLoading(true);
        try {
            const data = await api.patients.getOne(patientId);
            setPatient(data);
        } catch (error) {
            console.error('Failed to load patient details', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePatient = async () => {
        if (!currentUser?.roles.includes('Admin')) {
            toast.error('Only administrators can delete patients.');
            return;
        }
        if (!window.confirm(`Delete ${patient.name}? This will also remove their medical records.`)) return;

        if (onDeletePatient) {
            onDeletePatient(patientId);
            return;
        }

        try {
            await api.patients.delete(patientId);
            onBack();
        } catch (error) {
            toast.error('Failed to delete patient.');
        }
    };

    const handleDeleteTreatment = async (treatmentId: string) => {
        if (!currentUser?.roles.includes('Admin')) {
            toast.error('Only administrators can delete treatment records.');
            return;
        }
        if (!window.confirm('Delete this treatment record?')) return;
        setDeletingTreatmentId(treatmentId);
        try {
            await api.treatments.delete(treatmentId);
            await loadPatientDetails();
            toast.success('Treatment record deleted');
        } catch (error) {
            toast.error('Failed to delete treatment.');
        } finally {
            setDeletingTreatmentId(null);
        }
    };

    const handleUpdateTreatment = async (data: any) => {
        try {
            await api.treatments.update(editingTreatment.id, data);
            setEditingTreatment(null);
            loadPatientDetails();
            toast.success('Treatment updated');
        } catch (error) {
            toast.error('Failed to update treatment');
        }
    };

    const handleAddNote = async (e: React.MouseEvent, treatmentId: string) => {
        e.stopPropagation();
        const note = window.prompt('Add a daily note:');
        if (!note) return;
        try {
            await api.treatments.addNote(treatmentId, note);
            await loadPatientDetails();
            toast.success('Note added');
        } catch (error) {
            toast.error('Failed to add note');
        }
    };

    const handleMarkCompleted = async (e: React.MouseEvent, treatmentId: string) => {
        e.stopPropagation();
        if (!window.confirm('Mark this treatment as complete?')) return;
        try {
            await api.treatments.update(treatmentId, { status: 'Completed' });
            await loadPatientDetails();
            toast.success('Treatment completed');
        } catch (error) {
            toast.error('Failed to complete treatment');
        }
    };

    if (loading) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center animate-pulse">
                    <PawPrint className="w-8 h-8 text-teal-500" />
                </div>
                <p className="text-sm text-slate-500">Loading patient profile...</p>
            </div>
        );
    }

    if (!patient) return null;

    const pastTreatments = (patient?.treatments || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const nextAppointments = (patient?.appointments || [])
        .filter((a: any) => new Date(a.date).getTime() >= new Date().setHours(0, 0, 0, 0))
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <div className="client-page-shell max-w-7xl mx-auto px-1 md:px-0">
            <div className="client-panel p-4 md:p-8">
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-5 min-w-0">
                        <button
                            onClick={onBack}
                            className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-teal-600 transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className={`w-20 h-20 md:w-24 md:h-24 rounded-[1.4rem] md:rounded-[1.8rem] border flex items-center justify-center shrink-0 ${getPetToneClass(patient.breed, patient.species)}`}>
                            {patient.imageUrl ? (
                                <img src={patient.imageUrl} alt={patient.name} className="w-full h-full object-cover rounded-[1.8rem]" />
                            ) : (
                                <Dog className="w-12 h-12 opacity-70" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h1 className="text-2xl md:text-4xl font-extrabold text-slate-800 tracking-tight break-words">{patient.name}</h1>
                                <span className="client-badge">{patient.status || 'Active'}</span>
                            </div>
                            <p className="text-slate-500">{patient.species} • {patient.breed || 'Breed not added'}</p>
                            <button
                                onClick={() => onViewOwner(patient.ownerId)}
                                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700"
                            >
                                <UserIcon className="w-4 h-4" /> {patient.owner?.firstName} {patient.owner?.lastName}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
                        <button onClick={() => setEditingTreatment({})} className="px-4 md:px-5 py-3 rounded-2xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all flex items-center justify-center gap-2">
                            <Plus className="w-4 h-4" /> New visit
                        </button>
                        {onEditPatient && (
                            <button onClick={() => onEditPatient(patient.id)} className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-white transition-all">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        )}
                        {currentUser?.roles.includes('Admin') && (
                            <button onClick={handleDeletePatient} className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-all">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="client-panel p-4 md:p-5">
                    <p className="text-sm text-slate-500">Age</p>
                    <p className="text-xl md:text-2xl font-extrabold text-slate-800 mt-2">{patient.age} years</p>
                </div>
                <div className="client-panel p-4 md:p-5">
                    <p className="text-sm text-slate-500">Weight</p>
                    <p className="text-xl md:text-2xl font-extrabold text-slate-800 mt-2">{patient.weight} kg</p>
                </div>
                <div className="client-panel p-4 md:p-5">
                    <p className="text-sm text-slate-500">Gender</p>
                    <p className="text-xl md:text-2xl font-extrabold text-slate-800 mt-2">{patient.gender}</p>
                </div>
                <div className="client-panel p-4 md:p-5">
                    <p className="text-sm text-slate-500">Next visits</p>
                    <p className="text-xl md:text-2xl font-extrabold text-slate-800 mt-2">{nextAppointments.length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <aside className="lg:col-span-1">
                    <div className="client-panel-soft p-2 flex lg:flex-col gap-2 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`client-tab flex items-center gap-3 ${activeTab === tab.id ? 'client-tab-active' : ''}`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </aside>

                <main className="lg:col-span-3 space-y-6">
                    {activeTab === 'HISTORY' && (
                        <div className="space-y-6">
                            <div className="client-panel p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-800">Medical history</h2>
                                    <p className="text-slate-500 mt-1">Upcoming appointments and past visits.</p>
                                </div>
                                <div className="client-panel-soft p-1 flex w-full sm:w-auto">
                                    {(['TIMELINE', 'LIST'] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => setViewMode(mode)}
                                            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-semibold transition-all ${viewMode === mode ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                                        >
                                            {mode === 'TIMELINE' ? 'Timeline' : 'List'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {nextAppointments.length === 0 && pastTreatments.length === 0 ? (
                                <div className="client-panel p-8 md:p-16 text-center text-slate-500">
                                    <Stethoscope className="w-10 h-10 mx-auto mb-4 text-slate-300" />
                                    No visits have been recorded yet.
                                </div>
                            ) : (
                                <div className={viewMode === 'TIMELINE' ? 'space-y-4' : 'grid grid-cols-1 gap-4'}>
                                    {nextAppointments.map((app: any) => (
                                        <div key={app.id} className="client-panel p-4 md:p-5 flex items-center justify-between gap-4">
                                            <div>
                                                <span className="client-badge bg-teal-50 text-teal-700 border-teal-100">Scheduled • {app.time}</span>
                                                <h3 className="text-lg font-bold text-slate-800 mt-3">{app.procedure?.name || 'Appointment'}</h3>
                                                <p className="text-sm text-slate-500 mt-1">{formatDateOnly(app.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                            </div>
                                            <Calendar className="w-6 h-6 text-teal-500" />
                                        </div>
                                    ))}

                                    {pastTreatments.map((treatment: any) => (
                                        <div
                                            key={treatment.id}
                                            onClick={() => setViewingTreatment(treatment)}
                                            className="client-panel p-4 md:p-5 cursor-pointer hover:border-teal-200 transition-all"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="client-badge">{new Date(treatment.date).toLocaleDateString()}</span>
                                                        {treatment.status === 'Ongoing' && <span className="client-badge bg-amber-50 text-amber-700 border-amber-100">Ongoing</span>}
                                                    </div>
                                                    <h3 className="text-lg font-bold text-slate-800 mt-3">{treatment.diagnosis || 'Clinical visit'}</h3>
                                                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{treatment.chiefComplaint || treatment.notes || 'No visit notes added.'}</p>
                                                </div>
                                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenuId(activeMenuId === treatment.id ? null : treatment.id);
                                                        }}
                                                        className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                    {activeMenuId === treatment.id && (
                                                        <div className="absolute right-0 top-12 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-20">
                                                            <button onClick={() => { setViewingTreatment(treatment); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                                                                <Eye className="w-4 h-4" /> View
                                                            </button>
                                                            <button onClick={() => { setEditingTreatment(treatment); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                                                                <Edit2 className="w-4 h-4" /> Edit
                                                            </button>
                                                            {treatment.status === 'Ongoing' && (
                                                                <>
                                                                    <button onClick={(e) => handleAddNote(e, treatment.id)} className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                                                                        <FileTextIcon className="w-4 h-4" /> Add daily note
                                                                    </button>
                                                                    <button onClick={(e) => handleMarkCompleted(e, treatment.id)} className="w-full text-left px-4 py-3 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center gap-3">
                                                                        <Save className="w-4 h-4" /> Mark complete
                                                                    </button>
                                                                </>
                                                            )}
                                                            {currentUser?.roles.includes('Admin') && (
                                                                <button
                                                                    onClick={() => handleDeleteTreatment(treatment.id)}
                                                                    disabled={deletingTreatmentId === treatment.id}
                                                                    className="w-full text-left px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-3"
                                                                >
                                                                    {deletingTreatmentId === treatment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'VACCINATIONS' && (
                        <div className="client-panel p-6">
                            <VaccinationTab patientId={patientId} patient={patient} settings={settings} />
                        </div>
                    )}

                    {activeTab === 'MEDIA' && (
                        <div className="client-panel p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Files</h2>
                                    <p className="text-slate-500 mt-1">Images and documents for this patient.</p>
                                </div>
                                <label className="px-4 py-2.5 rounded-2xl bg-teal-600 text-white font-semibold flex items-center gap-2 cursor-pointer">
                                    <Upload className="w-4 h-4" /> Add file
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*,application/pdf"
                                        onChange={async (event) => {
                                            const file = event.target.files?.[0];
                                            if (!file) return;
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            formData.append('patientId', patientId);
                                            try {
                                                const response = await api.post('/drive/upload', formData);
                                                setPatient((prev: any) => ({ ...prev, media: [...(prev.media || []), response.media] }));
                                                toast.success('File uploaded');
                                            } catch (error) {
                                                toast.error('Upload failed');
                                            } finally {
                                                loadPatientDetails();
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                            {!patient.media?.length ? (
                                <div className="py-16 text-center text-slate-500">No files uploaded yet.</div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {patient.media.map((file: any) => (
                                        <div key={file.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden aspect-square">
                                            {file.type === 'Image' ? (
                                                <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <FileTextIcon className="w-10 h-10 text-slate-300" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'HOSPITALIZATIONS' && (
                        <div className="client-panel p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Hospital stays</h2>
                                    <p className="text-slate-500 mt-1">Current and past admissions.</p>
                                </div>
                            </div>
                            {!patient.hospitalizations?.length ? (
                                <div className="py-16 text-center text-slate-500">No hospital stays recorded.</div>
                            ) : (
                                <div className="space-y-4">
                                    {patient.hospitalizations.map((stay: any) => (
                                        <div key={stay.id} className="client-panel-soft p-5 flex items-center justify-between gap-4">
                                            <div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="client-badge">{stay.status}</span>
                                                    <span className="client-badge">{new Date(stay.admissionDate).toLocaleDateString()}</span>
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-800 mt-3">{stay.reason || 'Hospital stay'}</h3>
                                                <p className="text-sm text-slate-500 mt-1">{stay.kennel?.name || 'No kennel assigned'}</p>
                                            </div>
                                            <button onClick={() => setViewingHospChart(stay)} className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-semibold">
                                                Open chart
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'CONSENT' && (
                        <div className="client-panel p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Consent forms</h2>
                                    <p className="text-slate-500 mt-1">Forms sent to the owner for approval.</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        const type = window.prompt('Form type:', 'General Surgical Consent');
                                        if (!type) return;
                                        const content = window.prompt('Form content:', 'I authorize the clinic to perform the procedure described.');
                                        if (!content) return;
                                        try {
                                            await api.consent.create({ patientId, clientId: patient.ownerId, type, content });
                                            loadPatientDetails();
                                            toast.success('Consent form sent');
                                        } catch (error) {
                                            toast.error('Failed to create form');
                                        }
                                    }}
                                    className="px-5 py-3 rounded-2xl bg-teal-600 text-white font-semibold flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> New form
                                </button>
                            </div>
                            {!patient.consentForms?.length ? (
                                <div className="py-16 text-center text-slate-500">No consent forms yet.</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {patient.consentForms.map((form: any) => (
                                        <div key={form.id} className="client-panel-soft p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="client-badge">{form.status}</span>
                                                <span className="text-sm text-slate-400">{new Date(form.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-800">{form.type}</h3>
                                            <p className="text-sm text-slate-500 line-clamp-3 mt-2">{form.content}</p>
                                            {form.status === 'Signed' && (
                                                <div className="mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
                                                    Signed by {form.signedBy}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'LABS' && (
                        <div className="client-panel p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Labs</h2>
                                    <p className="text-slate-500 mt-1">Test results and trends.</p>
                                </div>
                                {patient.labResults?.some((result: any) => result.numericalValue !== undefined) && (
                                    <button
                                        onClick={() => setSelectedTrendTest(selectedTrendTest ? null : (patient.labResults?.[0]?.testName || null))}
                                        className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold flex items-center gap-2"
                                    >
                                        <Activity className="w-4 h-4" /> {selectedTrendTest ? 'Hide trends' : 'Show trends'}
                                    </button>
                                )}
                            </div>

                            {selectedTrendTest && patient.labResults && (
                                <div className="client-panel-soft p-5 mb-6">
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                        {(Array.from(new Set(patient.labResults.filter((result: any) => result.numericalValue !== undefined).map((result: any) => result.testName))) as string[]).map((name) => (
                                            <button
                                                key={name}
                                                onClick={() => setSelectedTrendTest(name)}
                                                className={`px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${selectedTrendTest === name ? 'bg-white text-slate-800 border border-slate-200 shadow-sm' : 'bg-slate-100 text-slate-500'}`}
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                    <LabTrendAnalyzer results={patient.labResults} testName={selectedTrendTest} />
                                </div>
                            )}

                            {!patient.labResults?.length ? (
                                <div className="py-16 text-center text-slate-500">No lab results yet.</div>
                            ) : (
                                <div className="space-y-4">
                                    {patient.labResults.map((lab: any) => (
                                        <div key={lab.id} className="client-panel-soft p-5">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex gap-4">
                                                    <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                                                        <Microscope className="w-5 h-5 text-teal-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-800">{lab.testName}</h3>
                                                        <p className="text-sm text-slate-500 mt-1">{new Date(lab.testDate).toLocaleDateString()}</p>
                                                        {lab.numericalValue !== undefined && (
                                                            <p className="mt-2 text-lg font-bold text-slate-800">
                                                                {lab.numericalValue} <span className="text-sm font-semibold text-slate-400">{lab.unit}</span>
                                                            </p>
                                                        )}
                                                        {lab.referenceRange && <p className="text-sm text-slate-400 mt-1">Range: {lab.referenceRange}</p>}
                                                    </div>
                                                </div>
                                                <span className="client-badge">{lab.status}</span>
                                            </div>
                                            {lab.findings && <p className="mt-4 text-sm text-slate-600 bg-white p-4 rounded-2xl border border-slate-200">{lab.findings}</p>}
                                            {lab.mediaUrl && (
                                                <a href={lab.mediaUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-600">
                                                    <FileTextIcon className="w-4 h-4" /> View report
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {editingTreatment && (
                <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur overflow-y-auto">
                    <div className="max-w-7xl mx-auto p-4 md:p-8">
                        <NewTreatmentForm
                            clients={clients}
                            patients={patient ? [patient] : []}
                            settings={settings}
                            procedures={procedures}
                            currentUser={currentUser}
                            onBack={() => setEditingTreatment(null)}
                            onSave={handleUpdateTreatment}
                            initialData={editingTreatment.id ? editingTreatment : undefined}
                        />
                    </div>
                </div>
            )}

            {viewingTreatment && (
                <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="client-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
                            <div>
                                <span className="text-sm font-semibold text-teal-600 block mb-1">{new Date(viewingTreatment.date).toLocaleDateString()}</span>
                                <h2 className="text-xl font-bold text-slate-800">{viewingTreatment.diagnosis || 'Visit record'}</h2>
                            </div>
                            <button onClick={() => setViewingTreatment(null)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {viewingTreatment.chiefComplaint && (
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-500 mb-2">Reason for visit</h4>
                                    <p className="client-panel-soft p-4 text-slate-700 text-sm">{viewingTreatment.chiefComplaint}</p>
                                </div>
                            )}
                            {viewingTreatment.notes && (
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-500 mb-2">Notes</h4>
                                    <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600 client-panel-soft p-4 leading-relaxed">{viewingTreatment.notes}</pre>
                                </div>
                            )}
                            {viewingTreatment.medications?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-500 mb-2">Medications</h4>
                                    <div className="space-y-2">
                                        {viewingTreatment.medications.map((medication: any, index: number) => (
                                            <div key={index} className="client-panel-soft p-4 text-sm group flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="font-bold text-slate-800">{medication.drug}</p>
                                                    <p className="text-slate-500 mt-1">{medication.dose} • {medication.route} • {medication.freq} • {medication.duration}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setPrintingMed({
                                                            ...medication,
                                                            vetName: viewingTreatment.vet?.name || 'Veterinarian',
                                                            date: new Date(viewingTreatment.date).toLocaleDateString()
                                                        });
                                                        setTimeout(() => window.print(), 500);
                                                    }}
                                                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center"
                                                    title="Print label"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm text-slate-400">Vet</div>
                                    <div className="font-semibold text-slate-700">Dr. {viewingTreatment.vet?.name || 'Unknown'}</div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={async () => {
                                            setIsGeneratingHomeCare(true);
                                            try {
                                                const response = await api.reports.generateHomeCare(viewingTreatment.id);
                                                setGeneratedHomeCare(response.instructions);
                                                toast.success('Home care guide generated');
                                            } catch (error) {
                                                toast.error('Failed to generate care guide');
                                            } finally {
                                                setIsGeneratingHomeCare(false);
                                            }
                                        }}
                                        className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold flex items-center gap-2"
                                        disabled={isGeneratingHomeCare}
                                    >
                                        <Sparkles className="w-4 h-4" /> {isGeneratingHomeCare ? 'Creating...' : 'Home care'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingTreatment(viewingTreatment);
                                            setViewingTreatment(null);
                                        }}
                                        className="px-4 py-2.5 rounded-2xl bg-teal-600 text-white font-semibold flex items-center gap-2"
                                    >
                                        <Edit2 className="w-4 h-4" /> Edit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewingHospChart && (
                <HospitalizationChartModal
                    hospitalization={viewingHospChart}
                    patientName={patient.name}
                    onClose={() => setViewingHospChart(null)}
                />
            )}

            {printingMed && (
                <div className="hidden">
                    <PharmacyLabel
                        patient={patient}
                        clinic={settings}
                        drug={printingMed.drug}
                        dose={printingMed.dose}
                        instructions={`${printingMed.route} ${printingMed.freq} for ${printingMed.duration}`}
                        vetName={printingMed.vetName}
                        date={printingMed.date}
                    />
                </div>
            )}

            {generatedReferral && (
                <AiTextModal
                    title="Referral note"
                    content={generatedReferral}
                    onClose={() => setGeneratedReferral(null)}
                />
            )}

            {generatedHomeCare && (
                <AiTextModal
                    title="Home care guide"
                    content={generatedHomeCare}
                    onClose={() => setGeneratedHomeCare(null)}
                />
            )}
        </div>
    );
};

const AiTextModal = ({ title, content, onClose }: { title: string; content: string; onClose: () => void }) => (
    <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="client-panel w-full max-w-3xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                    <p className="text-sm text-slate-500 mt-1">Generated text</p>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="client-panel-soft p-6 text-slate-700 whitespace-pre-wrap leading-relaxed">{content}</div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(content);
                        toast.success('Copied');
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold"
                >
                    Copy
                </button>
                <button onClick={() => window.print()} className="px-4 py-2.5 rounded-2xl bg-teal-600 text-white font-semibold">
                    Print
                </button>
            </div>
        </div>
    </div>
);
