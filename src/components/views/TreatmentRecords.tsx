import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, FileText, Calendar, User, PawPrint, Filter, ChevronDown, Edit2, Trash2, Sparkles, Eye, Printer, X } from 'lucide-react';
import { Client, Pet, ClinicSettings, Procedure } from '../../types';

import { syncService } from '../../services/syncService';

interface ParsedVitals {
  temperature?: string;
  heartRate?: string;
  respiratoryRate?: string;
  pulse?: string;
  bcs?: string;
  mmColor?: string;
}

interface ParsedNotes {
  clinicalAssessment?: string;
  vitals?: ParsedVitals;
  problems?: string[];
  differentialDiagnosis?: string;
  instructions?: string;
}

interface TreatmentRecord {
  id: string;
  date: string;
  patient: Pet;
  client: Client;
  vet: string;
  chiefComplaint?: string;
  diagnosis: string;
  notes?: string;
  medications?: any[];
  procedures: string[];
  cost: number;
  status: 'Completed' | 'In Progress' | 'Scheduled' | 'Draft' | 'Ongoing';
  synced?: number;
  parsedNotes?: ParsedNotes;
}

interface TreatmentRecordsProps {
  clients: Client[];
  patients: Pet[];
  settings: ClinicSettings;
  procedures: Procedure[];
  onCreateNew: () => void;
  onEdit: (treatment: any) => void;
  onDelete: (id: string) => void;
  refreshTrigger?: number;
}

export const TreatmentRecords: React.FC<TreatmentRecordsProps> = ({
  clients,
  patients,
  settings,
  procedures,
  onCreateNew,
  onEdit,
  onDelete,
  refreshTrigger
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'patient' | 'cost'>('date');
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<TreatmentRecord | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const parseNotes = (notes: string): ParsedNotes => {
    const result: ParsedNotes = {};
    const sections = notes.split(/\n\n(?=[A-Z])/);
    for (const section of sections) {
      const [label, ...rest] = section.split(': ');
      const value = rest.join(': ').trim();
      if (label.startsWith('Clinical Assessment')) result.clinicalAssessment = value;
      else if (label.startsWith('Vitals')) {
        const vitals: ParsedVitals = {};
        value.split(', ').forEach(pair => {
          const [k, ...v] = pair.split(': ');
          const key = k.trim().toLowerCase();
          const val = v.join(': ').trim();
          if (key === 'temperature') vitals.temperature = val;
          else if (key === 'heartrate') vitals.heartRate = val;
          else if (key === 'respiratoryrate') vitals.respiratoryRate = val;
          else if (key === 'pulse') vitals.pulse = val;
          else if (key === 'bcs') vitals.bcs = val;
          else if (key === 'mmcolor') vitals.mmColor = val;
        });
        result.vitals = vitals;
      } else if (label.startsWith('Problems')) result.problems = value ? value.split(', ') : [];
      else if (label.startsWith('Differential')) result.differentialDiagnosis = value;
      else if (label.startsWith('Instructions')) result.instructions = value;
    }
    return result;
  };

  // Fetch treatments from Sync Service
  useEffect(() => {
    const fetchTreatments = async () => {
      try {
        const data = await syncService.fetchAndMergeTreatments();

        // Map data to frontend interface
        const mappedTreatments: TreatmentRecord[] = data.map((t: any) => ({
          id: t.id || t.localId?.toString(),
          date: t.date || t.createdAt,
          patient: t.patient || patients.find(p => p.id === t.patientId),
          client: t.patient?.owner || clients.find(c => c.id === t.clientId),
          vet: t.vet?.name || t.vet || 'Veterinarian',
          chiefComplaint: t.chiefComplaint || '',
          diagnosis: t.diagnosis || '',
          notes: t.notes || '',
          medications: t.medications || [],
          procedures: t.procedures?.map((p: any) => p.procedure?.name || procedures.find(proc => proc.id === (p.procedureId || p.id))?.name || 'Procedure') || [],
          _procedures: t.procedures || [],
          cost: t.totalCost || 0,
          status: t.status || 'Completed',
          synced: t.synced,
          parsedNotes: parseNotes(t.notes || '')
        }));

        setTreatments(mappedTreatments.filter(t => t.patient && t.client));
      } catch (error) {
        console.error('Failed to fetch treatments:', error);
      }
    };

    fetchTreatments();
  }, [patients, clients, procedures, refreshTrigger]);

  const filteredTreatments = treatments.filter(treatment => {
    const matchesSearch = searchTerm === '' ||
      treatment.patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatment.client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatment.client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      treatment.diagnosis.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || treatment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const sortedTreatments = [...filteredTreatments].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case 'patient':
        return a.patient.name.localeCompare(b.patient.name);
      case 'cost':
        return b.cost - a.cost;
      default:
        return 0;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'In Progress':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Scheduled':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Treatment Records</h1>
          <p className="text-slate-400 font-medium text-sm">Consultation history and patient plans</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('app-navigate', {
                detail: { view: 'AI_HUB', tab: 'SCRIBE' }
              }));
            }}
            className="soft-btn px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-amber-600 bg-amber-50 hover:bg-amber-100"
          >
            <Sparkles className="w-5 h-5" /> Generate SOAP
          </button>
          <button
            onClick={onCreateNew}
            className="soft-btn-primary px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-amber-100"
          >
            <Plus className="w-5 h-5" /> New Record
          </button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="soft-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search diagnosis or patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full soft-input pl-10 pr-4 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="soft-input px-3 py-2 text-xs font-bold text-slate-600 appearance-none bg-transparent min-w-[120px]"
            >
              <option value="all">All Status</option>
              <option value="Completed">Completed</option>
              <option value="In Progress">In Progress</option>
              <option value="Scheduled">Scheduled</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="soft-input px-3 py-2 text-xs font-bold text-slate-600 appearance-none bg-transparent min-w-[120px]"
            >
              <option value="date">Latest First</option>
              <option value="cost">Highest Cost</option>
              <option value="patient">Patient Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Modern Compact List */}
      <div className="soft-card overflow-hidden">
        {sortedTreatments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No records found</h3>
            <p className="text-slate-400 text-sm mb-6">Start by creating a new treatment plan</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {sortedTreatments.map((treatment) => (
              <div
                key={treatment.id}
                className={`transition-all duration-300 ${expandedId === treatment.id ? 'bg-slate-50/80 shadow-inner' : 'hover:bg-slate-50'}`}
              >
                {/* Main Row */}
                <div
                  className="px-6 py-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === treatment.id ? null : treatment.id)}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-[#14B8A6] font-black shadow-sm shrink-0">
                    {treatment.patient.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-extrabold text-slate-800 truncate">{treatment.patient.name}</h3>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border shrink-0 ${getStatusColor(treatment.status)}`}>
                        {treatment.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-bold overflow-hidden">
                      <span className="truncate">{new Date(treatment.date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="truncate">{treatment.diagnosis || 'Clinical Visit'}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-800">
                      {settings.currencySymbol}{treatment.cost.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Total</p>
                  </div>

                  <div className={`transition-transform duration-300 ${expandedId === treatment.id ? 'rotate-180 text-[#14B8A6]' : 'text-slate-300'}`}>
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === treatment.id && (
                  <div className="px-6 pb-6 pt-2 animate-fade-in border-t border-slate-100/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-4">
                        <div className="flex gap-6">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Client</p>
                            <p className="text-sm text-slate-700 font-bold">{treatment.client.firstName} {treatment.client.lastName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Veterinarian</p>
                            <p className="text-sm text-slate-700 font-bold">{treatment.vet}</p>
                          </div>
                        </div>

                        {treatment.chiefComplaint && (
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Chief Complaint</p>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                              {treatment.chiefComplaint}
                            </p>
                          </div>
                        )}

                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Diagnosis</p>
                          <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                            {treatment.diagnosis || 'No diagnosis recorded.'}
                          </p>
                        </div>
                        
                        {treatment.notes && (
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Clinical Notes</p>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                              {treatment.notes}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Performed Procedures</p>
                          <div className="flex flex-wrap gap-2">
                            {treatment.procedures.length > 0 ? treatment.procedures.map((p, i) => (
                              <span key={i} className="px-2.5 py-1 bg-white border border-slate-100 rounded-lg text-xs font-bold text-slate-600 shadow-sm">
                                {p}
                              </span>
                            )) : (
                              <span className="text-xs text-slate-400 italic">No procedures recorded</span>
                            )}
                          </div>
                        </div>

                        {treatment.medications && treatment.medications.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Medications</p>
                            <div className="space-y-2">
                              {treatment.medications.map((m: any, i: number) => (
                                <div key={i} className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium text-slate-600">
                                  <span className="font-bold text-slate-800">{m.drug}</span> {m.dose} • {m.route} • {m.freq} {m.duration ? `• ${m.duration}` : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); setViewingRecord(treatment); }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-blue-600 rounded-xl text-xs font-black hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-95 shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Record
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(treatment); }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 shadow-sm"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit Record
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(treatment.id); }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-black hover:bg-rose-100 transition-all active:scale-95 border border-rose-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* View Record Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8 animate-fade-in border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Treatment Record</h2>
                  <p className="text-xs text-slate-400 font-medium">#{viewingRecord.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-lg"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() => setViewingRecord(null)}
                  className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Record Content */}
            <div ref={printRef} className="p-8 space-y-8" id="treatment-record-print">
              {/* Clinic Header */}
              <div className="text-center border-b-2 border-slate-900 pb-6 mb-6">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{settings.name || 'Veterinary Clinic'}</h1>
                <p className="text-sm text-slate-500 mt-1">{settings.address || ''}</p>
                <p className="text-sm text-slate-500">{settings.phone || ''} | {settings.email || ''}</p>
                <p className="text-xs text-slate-400 mt-2 font-medium">Treatment Record / Clinical Summary</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Patient Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Patient Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-slate-500">Name:</span>
                      <span className="text-sm font-black text-slate-800">{viewingRecord.patient?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-slate-500">Species:</span>
                      <span className="text-sm text-slate-700">{viewingRecord.patient?.species || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-slate-500">Breed:</span>
                      <span className="text-sm text-slate-700">{viewingRecord.patient?.breed || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-slate-500">Gender:</span>
                      <span className="text-sm text-slate-700">{viewingRecord.patient?.gender || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-slate-500">Weight:</span>
                      <span className="text-sm text-slate-700">{viewingRecord.patient?.weight ? `${viewingRecord.patient.weight} kg` : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Client Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Client Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-slate-500">Name:</span>
                      <span className="text-sm font-black text-slate-800">
                        {viewingRecord.client?.firstName || viewingRecord.patient?.owner?.firstName || ''} {viewingRecord.client?.lastName || viewingRecord.patient?.owner?.lastName || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-slate-500">Phone:</span>
                      <span className="text-sm text-slate-700">{viewingRecord.client?.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-slate-500">Email:</span>
                      <span className="text-sm text-slate-700">{viewingRecord.client?.email || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-slate-500">Address:</span>
                      <span className="text-sm text-slate-700">{viewingRecord.client?.address || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visit Details */}
              <div className="space-y-4 border-t border-slate-100 pt-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Visit Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 block">Date</span>
                    <span className="text-sm font-bold text-slate-800">{new Date(viewingRecord.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 block">Veterinarian</span>
                    <span className="text-sm font-bold text-slate-800">{viewingRecord.vet || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 block">Status</span>
                    <span className="text-sm font-bold text-slate-800">{viewingRecord.status}</span>
                  </div>
                </div>
              </div>

              {/* Chief Complaint */}
              {viewingRecord.chiefComplaint && (
                <div className="space-y-2 border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Chief Complaint</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingRecord.chiefComplaint}</p>
                </div>
              )}

              {/* Diagnosis */}
              <div className="space-y-2 border-t border-slate-100 pt-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Diagnosis</h3>
                <p className="text-sm font-bold text-slate-800">{viewingRecord.diagnosis || 'No diagnosis recorded'}</p>
              </div>

              {/* Vitals */}
              {viewingRecord.parsedNotes?.vitals && Object.values(viewingRecord.parsedNotes.vitals).some(v => v) && (
                <div className="space-y-3 border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Vital Signs</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {viewingRecord.parsedNotes.vitals.temperature && (
                      <div className="bg-slate-50 rounded-xl p-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">Temperature</span>
                        <span className="text-sm font-bold text-slate-800">{viewingRecord.parsedNotes.vitals.temperature}</span>
                      </div>
                    )}
                    {viewingRecord.parsedNotes.vitals.heartRate && (
                      <div className="bg-slate-50 rounded-xl p-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">Heart Rate</span>
                        <span className="text-sm font-bold text-slate-800">{viewingRecord.parsedNotes.vitals.heartRate}</span>
                      </div>
                    )}
                    {viewingRecord.parsedNotes.vitals.respiratoryRate && (
                      <div className="bg-slate-50 rounded-xl p-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">Resp. Rate</span>
                        <span className="text-sm font-bold text-slate-800">{viewingRecord.parsedNotes.vitals.respiratoryRate}</span>
                      </div>
                    )}
                    {viewingRecord.parsedNotes.vitals.pulse && (
                      <div className="bg-slate-50 rounded-xl p-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">Pulse</span>
                        <span className="text-sm font-bold text-slate-800">{viewingRecord.parsedNotes.vitals.pulse}</span>
                      </div>
                    )}
                    {viewingRecord.parsedNotes.vitals.bcs && (
                      <div className="bg-slate-50 rounded-xl p-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">BCS</span>
                        <span className="text-sm font-bold text-slate-800">{viewingRecord.parsedNotes.vitals.bcs}</span>
                      </div>
                    )}
                    {viewingRecord.parsedNotes.vitals.mmColor && (
                      <div className="bg-slate-50 rounded-xl p-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">MM Color</span>
                        <span className="text-sm font-bold text-slate-800">{viewingRecord.parsedNotes.vitals.mmColor}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Clinical Assessment */}
              {viewingRecord.parsedNotes?.clinicalAssessment && (
                <div className="space-y-2 border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Clinical Assessment</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingRecord.parsedNotes.clinicalAssessment}</p>
                </div>
              )}

              {/* Problems */}
              {viewingRecord.parsedNotes?.problems && viewingRecord.parsedNotes.problems.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Problems</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {viewingRecord.parsedNotes.problems.map((p, i) => (
                      <li key={i} className="text-sm text-slate-700 font-medium">{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Differential Diagnosis */}
              {viewingRecord.parsedNotes?.differentialDiagnosis && (
                <div className="space-y-2 border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Differential Diagnosis</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingRecord.parsedNotes.differentialDiagnosis}</p>
                </div>
              )}

              {/* Procedures */}
              {viewingRecord.procedures && viewingRecord.procedures.length > 0 && (
                <div className="space-y-3 border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Procedures Performed</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {viewingRecord.procedures.map((p, i) => (
                      <li key={i} className="text-sm text-slate-700 font-medium">{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Medications */}
              {viewingRecord.medications && viewingRecord.medications.length > 0 && (
                <div className="space-y-3 border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Medications Prescribed</h3>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-2 px-3 text-xs font-black text-slate-500 uppercase">Drug</th>
                        <th className="py-2 px-3 text-xs font-black text-slate-500 uppercase">Dose</th>
                        <th className="py-2 px-3 text-xs font-black text-slate-500 uppercase">Route</th>
                        <th className="py-2 px-3 text-xs font-black text-slate-500 uppercase">Frequency</th>
                        <th className="py-2 px-3 text-xs font-black text-slate-500 uppercase">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingRecord.medications.map((m: any, i: number) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-800">{m.drug}</td>
                          <td className="py-2 px-3 text-slate-700">{m.dose}</td>
                          <td className="py-2 px-3 text-slate-700">{m.route}</td>
                          <td className="py-2 px-3 text-slate-700">{m.freq}</td>
                          <td className="py-2 px-3 text-slate-700">{m.duration || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Instructions */}
              {viewingRecord.parsedNotes?.instructions && (
                <div className="space-y-2 border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Instructions</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingRecord.parsedNotes.instructions}</p>
                </div>
              )}

              {/* Raw Notes (fallback if no structured data) */}
              {viewingRecord.notes && !viewingRecord.parsedNotes?.clinicalAssessment && !viewingRecord.parsedNotes?.vitals && !viewingRecord.parsedNotes?.problems && !viewingRecord.parsedNotes?.differentialDiagnosis && !viewingRecord.parsedNotes?.instructions && (
                <div className="space-y-2 border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Clinical Notes</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingRecord.notes}</p>
                </div>
              )}

              {/* Cost */}
              <div className="border-t-2 border-slate-900 pt-4 mt-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-black text-slate-900">Total Cost</span>
                  <span className="text-2xl font-black text-slate-900">{settings.currencySymbol}{viewingRecord.cost.toLocaleString()}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-8 border-t border-slate-100 mt-8">
                <p className="text-[10px] text-slate-400 font-medium">This document is a clinical summary generated from {settings.name || 'VetNexus Pro'}.</p>
                <p className="text-[10px] text-slate-400 font-medium">Printed on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #treatment-record-print, #treatment-record-print * { visibility: visible; }
          #treatment-record-print { position: absolute; left: 0; top: 0; width: 100%; }
          .fixed { position: relative !important; }
        }
      `}</style>
    </div>
  );
};