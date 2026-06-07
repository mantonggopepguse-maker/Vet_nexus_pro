import React, { useState, useEffect } from 'react';
import { Plus, Search, FileText, Calendar, User, PawPrint, Filter, ChevronDown, Edit2, Trash2, Sparkles } from 'lucide-react';
import { Client, Pet, ClinicSettings, Procedure } from '../../types';

import { syncService } from '../../services/syncService';

interface TreatmentRecord {
  id: string;
  date: string;
  patient: Pet;
  client: Client;
  vet: string;
  diagnosis: string;
  procedures: string[];
  cost: number;
  status: 'Completed' | 'In Progress' | 'Scheduled';
  synced?: number;
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
          diagnosis: t.diagnosis || '',
          procedures: t.procedures?.map((p: any) => p.procedure?.name || procedures.find(proc => proc.id === (p.procedureId || p.id))?.name || 'Procedure') || [],
          cost: t.totalCost || 0,
          status: t.status || 'Completed',
          synced: t.synced
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
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Diagnosis & Assessment</p>
                          <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            {treatment.diagnosis || 'No diagnosis recorded for this visit.'}
                          </p>
                        </div>
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
                      </div>

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
                    </div>

                    <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
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
    </div>
  );
};