import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Beaker,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  FlaskConical,
  Layers,
  Microscope,
  PawPrint,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/apiService';
import { ClinicSettings, Client, Pet, User } from '../../types';
import LabTrendAnalyzer from '../shared/LabTrendAnalyzer';

/* ─── Lab Test Panel Templates ─── */
const LAB_PANELS: { name: string; icon: React.ReactNode; tests: { testName: string; unit: string; referenceRange: string }[] }[] = [
  {
    name: 'CBC',
    icon: <Beaker className="w-4 h-4" />,
    tests: [
      { testName: 'RBC', unit: 'M/µL', referenceRange: '5.5-8.5' },
      { testName: 'WBC', unit: 'K/µL', referenceRange: '5.5-16.9' },
      { testName: 'Hemoglobin', unit: 'g/dL', referenceRange: '12-18' },
      { testName: 'Hematocrit', unit: '%', referenceRange: '37-55' },
      { testName: 'Platelet Count', unit: 'K/µL', referenceRange: '175-500' },
      { testName: 'MCV', unit: 'fL', referenceRange: '60-77' },
      { testName: 'MCH', unit: 'pg', referenceRange: '19.5-24.5' },
      { testName: 'MCHC', unit: 'g/dL', referenceRange: '31-36' },
    ],
  },
  {
    name: 'Chemistry',
    icon: <FlaskConical className="w-4 h-4" />,
    tests: [
      { testName: 'Glucose', unit: 'mg/dL', referenceRange: '74-143' },
      { testName: 'BUN', unit: 'mg/dL', referenceRange: '7-27' },
      { testName: 'Creatinine', unit: 'mg/dL', referenceRange: '0.5-1.8' },
      { testName: 'ALT', unit: 'U/L', referenceRange: '10-125' },
      { testName: 'AST', unit: 'U/L', referenceRange: '0-50' },
      { testName: 'ALP', unit: 'U/L', referenceRange: '23-212' },
      { testName: 'Total Protein', unit: 'g/dL', referenceRange: '5.2-8.2' },
      { testName: 'Albumin', unit: 'g/dL', referenceRange: '2.3-4.0' },
      { testName: 'Bilirubin', unit: 'mg/dL', referenceRange: '0.0-0.9' },
    ],
  },
  {
    name: 'Urinalysis',
    icon: <Beaker className="w-4 h-4" />,
    tests: [
      { testName: 'pH', unit: '', referenceRange: '5.5-7.5' },
      { testName: 'Specific Gravity', unit: '', referenceRange: '1.015-1.045' },
      { testName: 'Urine Protein', unit: 'mg/dL', referenceRange: '0-30' },
      { testName: 'Urine Glucose', unit: 'mg/dL', referenceRange: '0' },
      { testName: 'Ketones', unit: '', referenceRange: 'Negative' },
      { testName: 'Urine Bilirubin', unit: '', referenceRange: 'Negative' },
      { testName: 'Urine Blood', unit: '', referenceRange: 'Negative' },
    ],
  },
  {
    name: 'Electrolytes',
    icon: <Zap className="w-4 h-4" />,
    tests: [
      { testName: 'Sodium', unit: 'mEq/L', referenceRange: '144-160' },
      { testName: 'Potassium', unit: 'mEq/L', referenceRange: '3.5-5.8' },
      { testName: 'Chloride', unit: 'mEq/L', referenceRange: '109-122' },
      { testName: 'Calcium', unit: 'mg/dL', referenceRange: '7.9-12.0' },
      { testName: 'Phosphorus', unit: 'mg/dL', referenceRange: '2.5-6.8' },
    ],
  },
  {
    name: 'Thyroid',
    icon: <Activity className="w-4 h-4" />,
    tests: [
      { testName: 'T4', unit: 'µg/dL', referenceRange: '1.0-4.0' },
      { testName: 'Free T4', unit: 'ng/dL', referenceRange: '0.7-2.3' },
      { testName: 'TSH', unit: 'ng/mL', referenceRange: '0.03-0.5' },
    ],
  },
];

/* ─── Status helpers ─── */
type LabStatus = 'Requested' | 'Preliminary' | 'Final' | 'Abnormal' | 'Critical';

const STATUS_STYLES: Record<string, string> = {
  Requested: 'bg-amber-50 text-amber-700 border-amber-200',
  Preliminary: 'bg-blue-50 text-blue-700 border-blue-200',
  Final: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Abnormal: 'bg-orange-50 text-orange-700 border-orange-200',
  Critical: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse',
};

const STATUS_DOT: Record<string, string> = {
  Requested: 'bg-amber-500',
  Preliminary: 'bg-blue-500',
  Final: 'bg-emerald-500',
  Abnormal: 'bg-orange-500',
  Critical: 'bg-rose-500',
};

const isOutOfRange = (value: number | undefined, rangeStr: string | undefined): boolean => {
  if (value === undefined || !rangeStr) return false;
  const parts = rangeStr.split('-');
  if (parts.length !== 2) return false;
  const min = parseFloat(parts[0]);
  const max = parseFloat(parts[1]);
  if (isNaN(min) || isNaN(max)) return false;
  return value < min || value > max;
};

const STATUS_TABS: { id: string; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'Requested', label: 'Pending' },
  { id: 'Preliminary', label: 'Preliminary' },
  { id: 'Final', label: 'Final' },
  { id: 'Abnormal', label: 'Abnormal' },
  { id: 'Critical', label: 'Critical' },
];

/* ─── Component ─── */
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
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({ result: '', findings: '', numericalValue: '', unit: '', referenceRange: '', mediaUrl: '', status: 'Final' });
  const [aiInterpretation, setAiInterpretation] = useState<any>(null);
  const [interpretingLabId, setInterpretingLabId] = useState<string | null>(null);

  // New state for enhancements
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [clinicLabs, setClinicLabs] = useState<any[]>([]);
  const [loadingClinicLabs, setLoadingClinicLabs] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [batchMode, setBatchMode] = useState(false);
  const [batchEntries, setBatchEntries] = useState<Record<string, { numericalValue: string; unit: string; referenceRange: string; result: string; findings: string; status: string }>>({});
  const [savingBatch, setSavingBatch] = useState(false);
  const [showPanelMenu, setShowPanelMenu] = useState(false);
  const [creatingPanel, setCreatingPanel] = useState(false);
  const [showParseModal, setShowParseModal] = useState(false);
  const [parseText, setParseText] = useState('');
  const [parsingLab, setParsingLab] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const userRoles = currentUser?.roles || [];
  const canUploadResults = currentUser?.isSuperAdmin || userRoles.some(role => ['Admin', 'Lab Scientist', 'Lab Tech', 'Vet Tech'].includes(role));
  const canUseLabAI = currentUser?.isSuperAdmin || userRoles.some(role => ['Admin', 'Veterinarian', 'Lab Scientist', 'Lab Tech', 'Vet Tech'].includes(role));

  /* ─── Clinic-wide lab fetching ─── */
  const loadClinicLabs = async () => {
    setLoadingClinicLabs(true);
    try {
      const [all, pending] = await Promise.all([
        api.labs.getByClinic(),
        api.labs.getPending()
      ]);
      setClinicLabs(all);
      setPendingCount(pending.length);
    } catch {
      // Silently fail - clinic labs are supplementary
    } finally {
      setLoadingClinicLabs(false);
    }
  };

  useEffect(() => { loadClinicLabs(); }, []);

  /* ─── Patient filtering ─── */
  const filteredPatients = useMemo(() => {
    let base = patients.filter((patient) => {
      const owner = clients.find((client) => client.id === patient.ownerId);
      const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : '';
      const haystack = `${patient.name} ${patient.species} ${patient.breed || ''} ${ownerName}`.toLowerCase();
      return haystack.includes(searchTerm.toLowerCase());
    });

    // If filtering by status, only show patients that have labs with that status
    if (statusFilter !== 'ALL') {
      const patientIdsWithStatus = new Set(
        clinicLabs
          .filter(lab => lab.status === statusFilter)
          .map(lab => lab.patientId)
      );
      base = base.filter(p => patientIdsWithStatus.has(p.id));
    }

    return base;
  }, [clients, patients, searchTerm, statusFilter, clinicLabs]);

  /* ─── Patient loading ─── */
  const loadPatient = async (patientId: string) => {
    setLoadingPatient(true);
    try {
      const data = await api.patients.getOne(patientId);
      let labResults = data.labResults || [];
      if (!labResults.length) {
        try {
          labResults = await api.labs.getByPatientId(patientId);
        } catch {
          labResults = [];
        }
      }

      const nextPatient = { ...data, labResults };
      setSelectedPatient(nextPatient);

      const numericTest = labResults.find((result: any) => result.numericalValue !== undefined);
      setSelectedTrendTest(numericTest?.testName || null);
    } catch {
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

  /* ─── Filter patient labs by status ─── */
  const filteredLabResults = useMemo(() => {
    const labs = selectedPatient?.labResults || [];
    if (statusFilter === 'ALL') return labs;
    return labs.filter((lab: any) => lab.status === statusFilter);
  }, [selectedPatient, statusFilter]);

  /* ─── Result upload ─── */
  const startResultUpload = (lab: any) => {
    setEditingLabId(lab.id);
    setAiInterpretation(null);
    setResultForm({
      result: lab.result || '',
      findings: lab.findings || '',
      numericalValue: lab.numericalValue ?? '',
      unit: lab.unit || '',
      referenceRange: lab.referenceRange || '',
      mediaUrl: lab.mediaUrl || '',
      status: lab.status === 'Requested' ? 'Final' : lab.status || 'Final'
    });
  };

  const saveResultUpload = async () => {
    if (!editingLabId || !selectedPatientId) return;

    try {
      await api.labs.update(editingLabId, {
        ...resultForm,
        numericalValue: resultForm.numericalValue === '' ? null : resultForm.numericalValue,
        testDate: new Date().toISOString()
      });
      toast.success('Lab result uploaded');
      setEditingLabId(null);
      await loadPatient(selectedPatientId);
      loadClinicLabs();
    } catch {
      toast.error('Failed to upload lab result');
    }
  };

  /* ─── AI Interpretation ─── */
  const interpretLab = async (lab: any) => {
    if (!selectedPatientId) return;
    setInterpretingLabId(lab.id);
    setAiInterpretation(null);
    try {
      const interpretation = await api.aiDiagnostic.interpretLabResult({ patientId: selectedPatientId, lab });
      setAiInterpretation({ labId: lab.id, ...interpretation });
    } catch {
      toast.error('AI could not interpret this result');
    } finally {
      setInterpretingLabId(null);
    }
  };

  /* ─── Quick Panel creation ─── */
  const createPanel = async (panel: typeof LAB_PANELS[0]) => {
    if (!selectedPatientId) {
      toast.error('Select a patient first');
      return;
    }
    setCreatingPanel(true);
    setShowPanelMenu(false);
    try {
      for (const test of panel.tests) {
        await api.labs.create({
          patientId: selectedPatientId,
          testName: test.testName,
          unit: test.unit,
          referenceRange: test.referenceRange,
          status: 'Requested',
        });
      }
      toast.success(`${panel.name} panel created (${panel.tests.length} tests)`);
      await loadPatient(selectedPatientId);
      loadClinicLabs();
    } catch {
      toast.error('Failed to create lab panel');
    } finally {
      setCreatingPanel(false);
    }
  };

  /* ─── AI Parse Lab Text ─── */
  const handleParseLab = async () => {
    if (!parseText.trim() || !selectedPatientId) return;
    setParsingLab(true);
    try {
      const parsed = await api.aiDiagnostic.parseLabResult({ rawText: parseText, patientId: selectedPatientId });
      const labs = parsed.labs || parsed;
      if (Array.isArray(labs) && labs.length > 0) {
        for (const entry of labs) {
          await api.labs.create({
            patientId: selectedPatientId,
            testName: entry.test || entry.testName || 'Unknown',
            result: entry.value || entry.result || '',
            unit: entry.unit || '',
            referenceRange: entry.range || entry.referenceRange || '',
            numericalValue: parseFloat(entry.value) || null,
            status: entry.status || 'Final',
          });
        }
        toast.success(`${labs.length} lab result(s) parsed and saved`);
        setShowParseModal(false);
        setParseText('');
        await loadPatient(selectedPatientId);
        loadClinicLabs();
      } else {
        toast.error('Could not extract any lab values from the text');
      }
    } catch {
      toast.error('AI failed to parse lab text');
    } finally {
      setParsingLab(false);
    }
  };

  /* ─── Batch save ─── */
  const handleBatchSave = async () => {
    const updates = Object.entries(batchEntries)
      .filter(([_, entry]) => entry.numericalValue || entry.result || entry.findings)
      .map(([id, entry]) => ({
        id,
        numericalValue: entry.numericalValue === '' ? null : parseFloat(entry.numericalValue) || null,
        unit: entry.unit,
        referenceRange: entry.referenceRange,
        result: entry.result,
        findings: entry.findings,
        status: entry.status || 'Final',
        testDate: new Date().toISOString(),
      }));

    if (updates.length === 0) {
      toast.error('No entries to save');
      return;
    }

    setSavingBatch(true);
    try {
      await api.labs.batchUpdate(updates);
      toast.success(`${updates.length} result(s) saved`);
      setBatchMode(false);
      setBatchEntries({});
      if (selectedPatientId) await loadPatient(selectedPatientId);
      loadClinicLabs();
    } catch {
      toast.error('Batch save failed');
    } finally {
      setSavingBatch(false);
    }
  };

  const initBatchEntries = () => {
    const requested = (selectedPatient?.labResults || []).filter((l: any) => l.status === 'Requested');
    const entries: typeof batchEntries = {};
    for (const lab of requested) {
      entries[lab.id] = {
        numericalValue: '',
        unit: lab.unit || '',
        referenceRange: lab.referenceRange || '',
        result: '',
        findings: '',
        status: 'Final',
      };
    }
    setBatchEntries(entries);
  };

  /* ─── Status badge renderer ─── */
  const renderStatusBadge = (lab: any) => {
    const style = STATUS_STYLES[lab.status] || STATUS_STYLES.Final;
    const dotColor = STATUS_DOT[lab.status] || STATUS_DOT.Final;
    const outOfRange = isOutOfRange(lab.numericalValue, lab.referenceRange);

    return (
      <div className="flex items-center gap-2">
        {outOfRange && (
          <span className="flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-600">
            <AlertTriangle className="w-3 h-3" /> Out of range
          </span>
        )}
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${style}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          {lab.status}
        </span>
      </div>
    );
  };

  /* ─── Print View ─── */
  const handlePrint = () => {
    setShowPrintView(true);
    setTimeout(() => window.print(), 300);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* ─── Hero header ─── */}
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
          <div className="flex items-center gap-3 flex-wrap">
            {pendingCount > 0 && (
              <div className="rounded-2xl bg-amber-500/20 border border-amber-400/30 px-4 py-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-black text-amber-200">{pendingCount} pending</span>
              </div>
            )}
            <button
              onClick={() => {
                if (selectedPatientId) loadPatient(selectedPatientId);
                loadClinicLabs();
              }}
              className="rounded-2xl bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/20 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ─── Status filter tabs ─── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => {
          const isActive = statusFilter === tab.id;
          const isPending = tab.id === 'Requested';
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {isPending && pendingCount > 0 && (
                <span className="rounded-full bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 min-w-[20px] text-center">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Main layout ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
        {/* ─── Patient queue sidebar ─── */}
        <aside className="rounded-[32px] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-slate-800">Patient Queue</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  {statusFilter !== 'ALL' ? `${statusFilter} results` : 'Lab-ready patients'}
                </p>
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
                // Count pending for this patient from clinic labs
                const patientPending = clinicLabs.filter(l => l.patientId === patient.id && l.status === 'Requested').length;
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
                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                          {labCount || 'View'}
                        </span>
                        {patientPending > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700">
                            {patientPending} pending
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <section className="rounded-[32px] border border-slate-100 bg-white shadow-sm overflow-hidden min-h-[760px]">
          {loadingPatient ? (
            <div className="flex h-full items-center justify-center p-10 text-slate-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
            </div>
          ) : selectedPatient ? (
            <div className="p-8 space-y-8">
              {/* ─── Patient header ─── */}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handlePrint}
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-200 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button
                    onClick={() => onViewPatient(selectedPatient.id)}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-black flex items-center gap-2"
                  >
                    Open patient record
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ─── Summary cards ─── */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-[24px] bg-emerald-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Lab Results</p>
                  <p className="mt-2 text-3xl font-black text-slate-800">{selectedPatient.labResults?.length || 0}</p>
                </div>
                <div className="rounded-[24px] bg-amber-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pending</p>
                  <p className="mt-2 text-3xl font-black text-slate-800">
                    {(selectedPatient.labResults || []).filter((l: any) => l.status === 'Requested').length}
                  </p>
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

              {/* ─── Action toolbar ─── */}
              {canUploadResults && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Quick panels dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowPanelMenu(!showPanelMenu)}
                      disabled={creatingPanel}
                      className="rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Layers className="w-4 h-4" />
                      Quick panels
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showPanelMenu && (
                      <div className="absolute top-full left-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl z-30 py-2">
                        {LAB_PANELS.map(panel => (
                          <button
                            key={panel.name}
                            onClick={() => createPanel(panel)}
                            className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition"
                          >
                            {panel.icon}
                            <div>
                              <p className="font-black">{panel.name}</p>
                              <p className="text-[10px] font-medium text-slate-400">{panel.tests.length} tests</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI parse button */}
                  {canUseLabAI && (
                    <button
                      onClick={() => setShowParseModal(true)}
                      className="rounded-2xl bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-700 transition hover:bg-indigo-100 flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      AI parse text
                    </button>
                  )}

                  {/* Batch entry toggle */}
                  {(selectedPatient.labResults || []).some((l: any) => l.status === 'Requested') && (
                    <button
                      onClick={() => {
                        if (!batchMode) initBatchEntries();
                        setBatchMode(!batchMode);
                      }}
                      className={`rounded-2xl px-4 py-2.5 text-xs font-black transition flex items-center gap-2 ${
                        batchMode
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      {batchMode ? 'Exit batch mode' : 'Batch entry'}
                    </button>
                  )}
                </div>
              )}

              {/* ─── Batch entry table ─── */}
              {batchMode && (
                <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/30 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-emerald-500" />
                        Batch Entry Mode
                      </h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fill in pending results quickly</p>
                    </div>
                    <button
                      onClick={handleBatchSave}
                      disabled={savingBatch}
                      className="rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black text-white transition hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {savingBatch ? 'Saving...' : 'Save all'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-[1.5fr_100px_80px_120px_1fr_100px] gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                      <span>Test</span><span>Value</span><span>Unit</span><span>Ref. Range</span><span>Findings</span><span>Status</span>
                    </div>
                    {(selectedPatient.labResults || [])
                      .filter((l: any) => l.status === 'Requested')
                      .map((lab: any) => {
                        const entry = batchEntries[lab.id] || { numericalValue: '', unit: lab.unit || '', referenceRange: lab.referenceRange || '', result: '', findings: '', status: 'Final' };
                        const updateEntry = (field: string, value: string) => setBatchEntries(prev => ({ ...prev, [lab.id]: { ...entry, [field]: value } }));
                        return (
                          <div key={lab.id} className="grid grid-cols-[1.5fr_100px_80px_120px_1fr_100px] gap-2 items-center">
                            <span className="text-sm font-black text-slate-700 truncate">{lab.testName}</span>
                            <input className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-bold outline-none focus:border-emerald-300" placeholder="0.0" value={entry.numericalValue} onChange={e => updateEntry('numericalValue', e.target.value)} />
                            <input className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-medium outline-none focus:border-emerald-300" placeholder="unit" value={entry.unit} onChange={e => updateEntry('unit', e.target.value)} />
                            <input className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-medium outline-none focus:border-emerald-300" placeholder="0-100" value={entry.referenceRange} onChange={e => updateEntry('referenceRange', e.target.value)} />
                            <input className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-medium outline-none focus:border-emerald-300" placeholder="Findings..." value={entry.findings} onChange={e => updateEntry('findings', e.target.value)} />
                            <select className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold outline-none focus:border-emerald-300" value={entry.status} onChange={e => updateEntry('status', e.target.value)}>
                              <option>Final</option>
                              <option>Preliminary</option>
                              <option>Abnormal</option>
                              <option>Critical</option>
                            </select>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* ─── Trend chart ─── */}
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

              {/* ─── Diagnostic results ─── */}
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

                {filteredLabResults.length ? (
                  <div className="space-y-3">
                    {filteredLabResults.map((lab: any) => (
                      <div key={lab.id} className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                              lab.status === 'Critical' ? 'bg-rose-50 text-rose-600' :
                              lab.status === 'Abnormal' ? 'bg-orange-50 text-orange-600' :
                              lab.status === 'Requested' ? 'bg-amber-50 text-amber-600' :
                              'bg-emerald-50 text-emerald-600'
                            }`}>
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
                          {renderStatusBadge(lab)}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {lab.numericalValue !== undefined && (
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                              isOutOfRange(lab.numericalValue, lab.referenceRange)
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-50 text-slate-600'
                            }`}>
                              {lab.numericalValue} {lab.unit || ''}
                            </span>
                          )}
                          {lab.referenceRange && (
                            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                              Range: {lab.referenceRange}
                            </span>
                          )}
                          {lab.mediaUrl && (
                            <a href={lab.mediaUrl} target="_blank" rel="noreferrer" className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 flex items-center gap-1.5 hover:bg-blue-100">
                              <FileText className="w-3 h-3" /> View report
                            </a>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {canUploadResults && (
                            <button
                              type="button"
                              onClick={() => startResultUpload(lab)}
                              className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 flex items-center gap-2"
                            >
                              <Upload className="w-4 h-4" />
                              {lab.status === 'Requested' ? 'Upload result' : 'Edit result'}
                            </button>
                          )}
                          {canUseLabAI && lab.status !== 'Requested' && (
                            <button
                              type="button"
                              onClick={() => interpretLab(lab)}
                              disabled={interpretingLabId === lab.id}
                              className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-100 flex items-center gap-2 disabled:opacity-50"
                            >
                              <Wand2 className="w-4 h-4" />
                              {interpretingLabId === lab.id ? 'Thinking...' : 'AI review'}
                            </button>
                          )}
                        </div>

                        {editingLabId === lab.id && (
                          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-300" placeholder="Numeric value" value={resultForm.numericalValue} onChange={(e) => setResultForm(prev => ({ ...prev, numericalValue: e.target.value }))} />
                              <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-300" placeholder="Unit" value={resultForm.unit} onChange={(e) => setResultForm(prev => ({ ...prev, unit: e.target.value }))} />
                              <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-emerald-300" placeholder="Reference range" value={resultForm.referenceRange} onChange={(e) => setResultForm(prev => ({ ...prev, referenceRange: e.target.value }))} />
                            </div>
                            <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-emerald-300" placeholder="Report file/link URL" value={resultForm.mediaUrl} onChange={(e) => setResultForm(prev => ({ ...prev, mediaUrl: e.target.value }))} />
                            <textarea className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-emerald-300" rows={2} placeholder="Result summary" value={resultForm.result} onChange={(e) => setResultForm(prev => ({ ...prev, result: e.target.value }))} />
                            <textarea className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-emerald-300" rows={3} placeholder="Findings / interpretation notes" value={resultForm.findings} onChange={(e) => setResultForm(prev => ({ ...prev, findings: e.target.value }))} />
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-emerald-300" value={resultForm.status} onChange={(e) => setResultForm(prev => ({ ...prev, status: e.target.value }))}>
                                <option>Final</option>
                                <option>Preliminary</option>
                                <option>Abnormal</option>
                                <option>Critical</option>
                              </select>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setEditingLabId(null)} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-100">Cancel</button>
                                <button type="button" onClick={saveResultUpload} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700">Save result</button>
                              </div>
                            </div>
                          </div>
                        )}

                        {aiInterpretation?.labId === lab.id && (
                          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                            <p className="text-sm font-black text-slate-800">{aiInterpretation.summary}</p>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-medium text-slate-600">
                              <div><span className="font-black text-indigo-700">Flags:</span> {(aiInterpretation.flags || []).join(', ') || 'None'}</div>
                              <div><span className="font-black text-indigo-700">Consider:</span> {(aiInterpretation.clinicalConsiderations || []).join(', ') || 'No extra notes'}</div>
                              <div><span className="font-black text-indigo-700">Follow-up:</span> {(aiInterpretation.recommendedFollowUp || []).join(', ') || 'As clinically indicated'}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/70 p-10 text-center">
                    <Sparkles className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-sm font-bold text-slate-500">
                      {statusFilter !== 'ALL' ? `No ${statusFilter.toLowerCase()} results for this patient.` : 'No lab results found for this patient yet.'}
                    </p>
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

      {/* ─── Footer notes ─── */}
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

      {/* ─── AI Parse Modal ─── */}
      {showParseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-lg w-full mx-4 p-8 space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  AI Lab Text Parser
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1">Paste raw lab report text and AI will extract structured results</p>
              </div>
              <button onClick={() => { setShowParseModal(false); setParseText(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium outline-none focus:border-indigo-300 min-h-[200px]"
              placeholder="Paste lab report text here...&#10;&#10;Example:&#10;WBC: 12.5 K/µL (ref 5.5-16.9)&#10;RBC: 6.8 M/µL (ref 5.5-8.5)&#10;Hemoglobin: 15.2 g/dL (ref 12-18)"
              value={parseText}
              onChange={e => setParseText(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowParseModal(false); setParseText(''); }} className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-200">
                Cancel
              </button>
              <button
                onClick={handleParseLab}
                disabled={parsingLab || !parseText.trim()}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" />
                {parsingLab ? 'Parsing...' : 'Parse & save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Print View ─── */}
      {showPrintView && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-white overflow-auto">
          <div className="max-w-3xl mx-auto p-8">
            <div className="flex items-center justify-between mb-8 print:hidden">
              <h2 className="text-xl font-black text-slate-800">Lab Report Preview</h2>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white flex items-center gap-2">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={() => setShowPrintView(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div ref={printRef} id="lab-report-print">
              <div className="text-center border-b-2 border-slate-900 pb-6 mb-6">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{settings.name || 'Veterinary Clinic'}</h1>
                {settings.address && <p className="text-sm text-slate-600 mt-1">{settings.address}</p>}
                {settings.phone && <p className="text-sm text-slate-600">{settings.phone} • {settings.email}</p>}
                <p className="mt-4 text-lg font-black text-slate-800 uppercase tracking-widest">Laboratory Report</p>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase">Patient</p>
                  <p className="text-lg font-black text-slate-800">{selectedPatient.name}</p>
                  <p className="text-sm text-slate-600">{selectedPatient.species} {selectedPatient.breed ? `• ${selectedPatient.breed}` : ''}</p>
                  <p className="text-sm text-slate-600">{selectedPatient.gender} • {selectedPatient.age}yr • {selectedPatient.weight}kg</p>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase">Owner</p>
                  <p className="text-lg font-black text-slate-800">{ownerName || 'N/A'}</p>
                  <p className="text-xs text-slate-400 mt-4 font-bold uppercase">Report Date</p>
                  <p className="text-sm font-bold text-slate-600">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>

              <table className="w-full text-sm mb-8">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="py-2 text-left font-black text-slate-800 text-xs uppercase">Test</th>
                    <th className="py-2 text-left font-black text-slate-800 text-xs uppercase">Result</th>
                    <th className="py-2 text-left font-black text-slate-800 text-xs uppercase">Unit</th>
                    <th className="py-2 text-left font-black text-slate-800 text-xs uppercase">Ref. Range</th>
                    <th className="py-2 text-left font-black text-slate-800 text-xs uppercase">Status</th>
                    <th className="py-2 text-left font-black text-slate-800 text-xs uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPatient.labResults || []).map((lab: any) => (
                    <tr key={lab.id} className="border-b border-slate-100">
                      <td className="py-2 font-bold text-slate-700">{lab.testName}</td>
                      <td className={`py-2 font-bold ${isOutOfRange(lab.numericalValue, lab.referenceRange) ? 'text-rose-600' : 'text-slate-800'}`}>
                        {lab.numericalValue !== undefined ? lab.numericalValue : (lab.result || '—')}
                      </td>
                      <td className="py-2 text-slate-500">{lab.unit || ''}</td>
                      <td className="py-2 text-slate-500">{lab.referenceRange || ''}</td>
                      <td className="py-2 font-bold text-slate-600">{lab.status}</td>
                      <td className="py-2 text-slate-500">{new Date(lab.testDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(selectedPatient.labResults || []).some((l: any) => l.findings) && (
                <div className="mb-8">
                  <h3 className="text-sm font-black text-slate-800 uppercase mb-2">Findings</h3>
                  {(selectedPatient.labResults || []).filter((l: any) => l.findings).map((lab: any) => (
                    <div key={lab.id} className="mb-2">
                      <p className="text-sm"><span className="font-bold">{lab.testName}:</span> {lab.findings}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center pt-8 border-t border-slate-100 mt-8">
                <p className="text-[10px] text-slate-400 font-medium">This report was generated from {settings.name || 'VetNexus Pro'}.</p>
                <p className="text-[10px] text-slate-400 font-medium">Printed on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #lab-report-print, #lab-report-print * { visibility: visible; }
          #lab-report-print { position: absolute; left: 0; top: 0; width: 100%; }
          .fixed { position: relative !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
};
