import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Clock,
  Filter,
  Microscope,
  PawPrint,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/apiService';
import { ClinicSettings, Client, Pet, User } from '../../types';
import LabTrendAnalyzer from '../shared/LabTrendAnalyzer';

interface LabHubProps {
  patients: Pet[];
  clients: Client[];
  settings: ClinicSettings;
  currentUser: User | null;
  onViewPatient: (patientId: string) => void;
}

export const LabHub: React.FC<LabHubProps> = ({
  patients,
  clients,
  settings,
  currentUser,
  onViewPatient,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [selectedTrendTest, setSelectedTrendTest] = useState<string | null>(null);

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const owner = clients.find((client) => client.id === patient.ownerId);
      const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : '';
      const haystack = `${patient.name} ${patient.species} ${patient.breed || ''} ${ownerName}`.toLowerCase();
      return haystack.includes(searchTerm.toLowerCase());
    });
  }, [clients, patients, searchTerm]);

  const loadPatient = async (patientId: string) => {
    setLoadingPatient(true);
    try {
      const data = await api.patients.getOne(patientId);
      let labResults = data.labResults || [];
      if (!labResults.length) {
        try {
          labResults = await api.labs.getByPatientId(patientId);
        } catch (labError) {
          labResults = [];
        }
      }

      const nextPatient = { ...data, labResults };
      setSelectedPatient(nextPatient);

      const numericTest = labResults.find((result: any) => result.numericalValue !== undefined);
      setSelectedTrendTest(numericTest?.testName || null);
    } catch (error) {
      toast.error('Failed to load patient lab record');
    } finally {
      setLoadingPatient(false);
    }
  };

  useEffect(() => {
    if (filteredPatients.length === 0) {
      setSelectedPatientId(null);
      setSelectedPatient(null);
      return;
    }

    if (!selectedPatientId || !filteredPatients.some((patient) => patient.id === selectedPatientId)) {
      setSelectedPatientId(filteredPatients[0].id);
    }
  }, [filteredPatients, selectedPatientId]);

  useEffect(() => {
    if (selectedPatientId) {
      loadPatient(selectedPatientId);
    }
  }, [selectedPatientId]);

  const ownerName = selectedPatient
    ? `${selectedPatient.owner?.firstName || selectedPatient.client?.firstName || ''} ${selectedPatient.owner?.lastName || selectedPatient.client?.lastName || ''}`.trim()
    : '';

  const numericTests = useMemo(() => {
    return (selectedPatient?.labResults || [])
      .filter((result: any) => result.numericalValue !== undefined)
      .reduce((tests: string[], result: any) => (
        tests.includes(result.testName) ? tests : [...tests, result.testName]
      ), []);
  }, [selectedPatient]);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-8 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-black uppercase tracking-[0.3em]">
              <Microscope className="w-4 h-4" />
              Lab Scientist Workspace
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">Lab Hub</h1>
            <p className="mt-3 text-slate-300 text-sm md:text-base leading-relaxed">
              Review diagnostic records, follow trends, and jump into the patient record when a result needs clinical follow-up.
            </p>
          </div>
          <button
            onClick={() => selectedPatientId && loadPatient(selectedPatientId)}
            className="rounded-2xl bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/20 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh record
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
        <aside className="rounded-[32px] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-slate-800">Patient Queue</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Lab-ready patients</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                {filteredPatients.length}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search patients, owners..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-300"
              />
            </div>
          </div>

          <div className="max-h-[720px] overflow-y-auto divide-y divide-slate-100">
            {filteredPatients.length === 0 ? (
              <div className="p-8 text-center text-sm font-bold text-slate-400">
                No matching patients found.
              </div>
            ) : (
              filteredPatients.map((patient) => {
                const owner = clients.find((client) => client.id === patient.ownerId);
                const labCount = patient.labResults?.length || 0;
                return (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatientId(patient.id)}
                    className={`w-full p-5 text-left transition hover:bg-slate-50 ${
                      selectedPatientId === patient.id ? 'bg-emerald-50/70' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                          <PawPrint className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{patient.name}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                            {patient.species || 'Patient'}
                          </p>
                          <p className="mt-2 text-xs font-medium text-slate-500">
                            {owner ? `${owner.firstName} ${owner.lastName}` : 'Owner not loaded'}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                        {labCount || 'View'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="rounded-[32px] border border-slate-100 bg-white shadow-sm overflow-hidden min-h-[760px]">
          {loadingPatient ? (
            <div className="flex h-full items-center justify-center p-10 text-slate-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
            </div>
          ) : selectedPatient ? (
            <div className="p-8 space-y-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-black uppercase tracking-[0.3em]">
                    <Activity className="w-4 h-4" />
                    Patient Lab Record
                  </div>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-800">{selectedPatient.name}</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {selectedPatient.species || 'Patient'} {selectedPatient.breed ? `• ${selectedPatient.breed}` : ''}
                    {ownerName ? ` • Owner: ${ownerName}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onViewPatient(selectedPatient.id)}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-black flex items-center gap-2"
                >
                  Open patient record
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-[24px] bg-emerald-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Lab Results</p>
                  <p className="mt-2 text-3xl font-black text-slate-800">{selectedPatient.labResults?.length || 0}</p>
                </div>
                <div className="rounded-[24px] bg-slate-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Numeric Tests</p>
                  <p className="mt-2 text-3xl font-black text-slate-800">{numericTests.length}</p>
                </div>
                <div className="rounded-[24px] bg-blue-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Last Updated</p>
                  <p className="mt-2 text-sm font-black text-slate-800">
                    {selectedPatient.updatedAt ? new Date(selectedPatient.updatedAt).toLocaleString() : 'Recently'}
                  </p>
                </div>
              </div>

              {numericTests.length > 0 && selectedTrendTest && (
                <div className="rounded-[28px] border border-slate-100 bg-slate-50/70 p-6">
                  <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                        Trend review
                      </h3>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        Track numeric results over time
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {numericTests.map((testName) => (
                        <button
                          key={testName}
                          onClick={() => setSelectedTrendTest(testName)}
                          className={`rounded-full px-3 py-2 text-xs font-black transition ${
                            selectedTrendTest === testName
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                              : 'bg-white text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {testName}
                        </button>
                      ))}
                    </div>
                  </div>
                  <LabTrendAnalyzer results={selectedPatient.labResults || []} testName={selectedTrendTest} />
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Diagnostic Results</h3>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Most recent entries first</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                    <Clock className="w-4 h-4" />
                    Review queue
                  </div>
                </div>

                {selectedPatient.labResults?.length ? (
                  <div className="space-y-3">
                    {selectedPatient.labResults.map((lab: any) => (
                      <div key={lab.id} className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                              <Microscope className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-base font-black text-slate-800">{lab.testName}</h4>
                              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                                {new Date(lab.testDate).toLocaleDateString()}
                              </p>
                              {lab.findings && (
                                <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
                                  {lab.findings}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                            {lab.status}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {lab.numericalValue !== undefined && (
                            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                              {lab.numericalValue} {lab.unit || ''}
                            </span>
                          )}
                          {lab.referenceRange && (
                            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                              Range: {lab.referenceRange}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/70 p-10 text-center">
                    <Sparkles className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-sm font-bold text-slate-500">No lab results found for this patient yet.</p>
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      Use the patient record or add results as they are reviewed.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-10 text-center text-slate-400">
              <div>
                <Filter className="mx-auto mb-4 h-12 w-12 opacity-30" />
                <p className="text-lg font-black text-slate-500">No patient selected</p>
                <p className="mt-2 text-sm font-medium">Pick a patient from the queue to review lab history.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-black text-slate-800">Lab workflow notes</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Signed in as {currentUser?.name || 'Lab staff'} in {settings.name}.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
            Use the patient record for full diagnostics, hospitalization, and treatment coordination.
          </div>
        </div>
      </div>
    </div>
  );
};
