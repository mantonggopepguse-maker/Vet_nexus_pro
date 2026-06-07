import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Zap, FileText, CreditCard, ChevronDown, User, PawPrint, ArrowLeft, CalendarDays, AlertCircle, Mic, Square, Loader } from 'lucide-react';
import { Client, Pet, ClinicSettings, Procedure, ProcedureMedication, User as UserType } from '../../types';
import { suggestDiagnosis } from '../../services/geminiService';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { api } from '../../services/apiService';

interface NewTreatmentFormProps {
  clients: Client[];
  patients: Pet[];
  settings: ClinicSettings;
  procedures: Procedure[];
  currentUser: UserType | null;
  onBack: () => void;
  onSave: (treatmentData: any) => void;
  initialData?: any;
}

export const NewTreatmentForm: React.FC<NewTreatmentFormProps> = ({
  clients,
  patients,
  settings,
  procedures,
  currentUser,
  onBack,
  onSave,
  initialData
}) => {
  const isEditMode = Boolean(initialData?.id);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [medications, setMedications] = useState<ProcedureMedication[]>([{ id: 1, drug: '', dose: '', route: '', freq: '', duration: '' }]);
  const [problems, setProblems] = useState(['']);
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>([]);

  // Cost State
  const [procedureCost, setProcedureCost] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [instructions, setInstructions] = useState('');

  // Form fields
  const [presentingComplaint, setPresentingComplaint] = useState('');
  const [clinicalAssessment, setClinicalAssessment] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [differentialDiagnosis, setDifferentialDiagnosis] = useState('');
  const [followUp, setFollowUp] = useState<'yes' | 'no'>('no');
  const [followUpDate, setFollowUpDate] = useState('');
  
  // Multi-day Treatment Plan State
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [treatmentDays, setTreatmentDays] = useState(5);

  // Next Appointment State
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');
  const [nextAppointmentTime, setNextAppointmentTime] = useState('');
  const [nextAppointmentProcedure, setNextAppointmentProcedure] = useState('');
  const [nextAppointmentNotes, setNextAppointmentNotes] = useState('');

  // Hospitalization State
  const [kennels, setKennels] = useState<any[]>([]);
  const [admitToWard, setAdmitToWard] = useState(false);
  const [selectedKennelId, setSelectedKennelId] = useState('');
  const [admissionReason, setAdmissionReason] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Error State
  const [error, setError] = useState('');

  // Vitals
  const [vitals, setVitals] = useState({
    temperature: '',
    heartRate: '',
    respiratoryRate: '',
    pulse: '',
    bcs: '',
    mmColor: ''
  });

  // Load initial data or draft
  useEffect(() => {
    if (currentUser) {
      api.hospitalization.getKennels()
        .then(res => setKennels(res.filter((k: any) => k.status === 'Available')))
        .catch(err => console.error('Failed to load kennels:', err));
    }

    if (initialData) {
      // Edit Mode: Populate from existing record
      const patient = patients.find(p => p.id === initialData.patientId);
      setSelectedClientId(patient?.ownerId || '');
      setSelectedPatientId(initialData.patientId || '');
      setPresentingComplaint(initialData.chiefComplaint || '');

      // Parse notes for structured fields if possible, or just dump to instructions/assessment
      // Assuming simple mapping for now based on typical structure
      const notes = initialData.notes || '';
      // Simple extraction logic would go here if notes were structured, likely just manual copy for now
      setInstructions(notes); // Fallback
      setFinalDiagnosis(initialData.diagnosis || '');

      if (initialData.medications) {
        setMedications(initialData.medications.map((m: any, i: number) => ({ ...m, id: i })));
      }

      setOtherCharges(initialData.totalCost || 0); // Simplified cost mapping

    } else {
      // New Mode: Load from local storage draft
      if (currentUser) {
        const draftKey = `treatment_draft_${currentUser.clinicId}_${currentUser.id}`;
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          try {
            const draft = JSON.parse(saved);
            setSelectedClientId(draft.selectedClientId || '');
            setSelectedPatientId(draft.selectedPatientId || '');
            setPresentingComplaint(draft.presentingComplaint || '');
            setClinicalAssessment(draft.clinicalAssessment || '');
            setFinalDiagnosis(draft.finalDiagnosis || '');
            setDifferentialDiagnosis(draft.differentialDiagnosis || '');
            setInstructions(draft.instructions || '');
            if (draft.medications) setMedications(draft.medications);
            if (draft.problems) setProblems(draft.problems);
            if (draft.vitals) setVitals(draft.vitals);
          } catch (e) { console.error("Failed to load draft"); }
        }
      }
    }
  }, [initialData]);

  // Persistence logic (Disabled in Edit Mode)
  useEffect(() => {
    if (initialData || !currentUser) return;
    const draftKey = `treatment_draft_${currentUser.clinicId}_${currentUser.id}`;
    const draft = {
      selectedClientId,
      selectedPatientId,
      presentingComplaint,
      clinicalAssessment,
      finalDiagnosis,
      differentialDiagnosis,
      instructions,
      medications,
      problems,
      vitals
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [
    selectedClientId, selectedPatientId, presentingComplaint, clinicalAssessment,
    finalDiagnosis, differentialDiagnosis, instructions, medications, problems, vitals, currentUser, initialData
  ]);

  const clearDraft = () => {
    if (currentUser) {
      const draftKey = `treatment_draft_${currentUser.clinicId}_${currentUser.id}`;
      localStorage.removeItem(draftKey);
    }
  };

  // AI Suggestions
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ diagnosis: string; confidence: number }>>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // AI Dictation
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleDictateToggle = async () => {
    if (isRecording) {
      const audioBlob = await stopRecording();
      if (!audioBlob || audioBlob.size === 0) return;
      
      setIsTranscribing(true);
      setError('');
      try {
          const file = new File([audioBlob], "dictation.webm", { type: "audio/webm" });
          const parsedSOAP = await api.aiScribe.transcribe(file, selectedPatientId);
          
          if (parsedSOAP) {
             setPresentingComplaint(prev => prev ? `${prev}\n\n[AI Dictated - Subjective]\n${parsedSOAP.subjective}` : parsedSOAP.subjective || '');
             setClinicalAssessment(prev => prev ? `${prev}\n\n[AI Dictated - Objective/Assessment]\n${parsedSOAP.objective}\n\n${parsedSOAP.assessment}` : `${parsedSOAP.objective || ''}\n\n${parsedSOAP.assessment || ''}`);
             
             if(parsedSOAP.plan) {
                 setInstructions(prev => prev ? `${prev}\n\n[AI Dictated - Plan]\n${parsedSOAP.plan}` : parsedSOAP.plan);
             }
          }
      } catch (err: any) {
          console.error("Transcription Failed:", err);
          setError(err.message || 'Failed to transcribe audio.');
      } finally {
          setIsTranscribing(false);
      }
    } else {
      setError('');
      try {
        await startRecording();
      } catch(err) {
        setError('Microphone access denied. Please check your browser permissions.');
      }
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const filteredPatients = patients.filter(p => p.ownerId === selectedClientId);
  const activeProcedures = procedures.filter(p => p.status === 'Active');

  const subtotal = procedureCost + otherCharges;
  const total = Math.max(0, subtotal - discount);

  const addMedication = () => {
    setMedications([...medications, { id: Date.now(), drug: '', dose: '', route: '', freq: '', duration: '' }]);
  };

  const removeMedication = (id: number) => {
    setMedications(medications.filter(m => m.id !== id));
  };

  const addProblem = () => setProblems([...problems, '']);

  const handleProcedureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const procId = e.target.value;
    const procedure = procedures.find(p => p.id === procId);

    if (procedure) {
      // Track selected procedure
      setSelectedProcedures(prev => [...prev, procId]);

      // Update Cost
      setProcedureCost(prev => prev + procedure.costClient);

      // Append Medications
      const newMeds = procedure.medications.map(m => ({ ...m, id: Date.now() + Math.random() }));
      setMedications(prev => [...prev, ...newMeds]);

      // Append Instructions
      if (procedure.instructions) {
        setInstructions(prev => prev ? `${prev}\n\n${procedure.instructions}` : procedure.instructions);
      }
    }
  };

  const handleSave = () => {
    setError('');

    if (!selectedPatientId) {
      setError('Please select a patient');
      return;
    }

    if (!currentUser?.id) {
      setError('You must be logged in to save a treatment');
      return;
    }

    if (!isEditMode && admitToWard && !selectedKennelId) {
      setError('Select an available kennel before admitting to ward');
      return;
    }

    const effectiveAppointmentDate = nextAppointmentDate || followUpDate;
    const shouldCreateFollowUpAppointment = Boolean(effectiveAppointmentDate || nextAppointmentTime || nextAppointmentProcedure);

    if (followUp === 'yes' && !effectiveAppointmentDate) {
      setError('Select a follow-up date before saving');
      return;
    }

    if (shouldCreateFollowUpAppointment && (!effectiveAppointmentDate || !nextAppointmentTime || !nextAppointmentProcedure)) {
      setError('Complete the follow-up appointment date, time, and procedure before saving');
      return;
    }

    // Filter out empty medication entries
    const validMedications = medications.filter(m => m.drug.trim());

    const treatmentData: any = {
      patientId: selectedPatientId,
      vetId: currentUser.id,
      chiefComplaint: presentingComplaint,
      diagnosis: finalDiagnosis,
      notes: `Clinical Assessment: ${clinicalAssessment}\n\nProblems: ${problems.join(', ')}\n\nDifferential: ${differentialDiagnosis}\n\nInstructions: ${instructions}`,
      totalCost: total,
      status: isMultiDay ? 'Ongoing' : 'Completed',
      endDate: isMultiDay ? new Date(Date.now() + treatmentDays * 24 * 60 * 60 * 1000).toISOString() : undefined,
      medications: validMedications.map(m => ({
        drug: m.drug,
        dose: m.dose,
        route: m.route,
        freq: m.freq,
        duration: m.duration,
        cost: 0
      })),
      procedures: selectedProcedures.map(procId => {
        const proc = procedures.find(p => p.id === procId);
        return {
          procedureId: procId,
          cost: proc?.costClient || 0
        };
      })
    };

    if (!isEditMode) {
      treatmentData.hospitalization = admitToWard ? {
        kennelId: selectedKennelId,
        patientId: selectedPatientId,
        reason: admissionReason,
        estimatedCost: estimatedCost
      } : null;

      treatmentData.nextAppointment = shouldCreateFollowUpAppointment ? {
        date: effectiveAppointmentDate,
        time: nextAppointmentTime,
        procedureId: nextAppointmentProcedure,
        notes: nextAppointmentNotes || (followUp === 'yes' ? 'Follow-up visit scheduled from treatment sheet' : '')
      } : null;
    }

    onSave(treatmentData);
    clearDraft();
  };

  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    const today = new Date();

    let years = today.getFullYear() - dob.getFullYear();
    let months = today.getMonth() - dob.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    return { years, months };
  };

  const handleAISuggest = async () => {
    setError('');

    if (!presentingComplaint && !clinicalAssessment) {
      setError('Please enter presenting complaint or clinical assessment first');
      return;
    }

    setIsAnalyzing(true);
    try {
      setAiSuggestions([]); // Clear previous
      const suggestions = await suggestDiagnosis(presentingComplaint, clinicalAssessment);

      if (suggestions.length === 0) {
        setError("AI could not generate suggestions. Please ensure details are sufficient.");
      } else {
        setAiSuggestions(suggestions);
      }
    } catch (err) {
      setError("Failed to connect to AI service.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Follow-up scheduling is now handled atomically with treatment save.

  const patientAge = selectedPatient ? calculateAge(selectedPatient.dateOfBirth) : null;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="sticky top-0 z-30 bg-[#F2F4F8]/90 backdrop-blur-md py-2 -mx-4 px-4 md:-mx-8 md:px-8">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white rounded-lg text-slate-500 transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{isEditMode ? 'Edit Treatment Sheet' : 'New Treatment Sheet'}</h1>
              <p className="text-blue-500 text-sm font-bold">{isEditMode ? 'Update consultation & treatment plan' : 'Create consultation & treatment plan'}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="soft-btn px-4 py-2 text-slate-500 font-bold text-sm flex items-center gap-2 hover:bg-white">
              <Save className="w-4 h-4" /> Save Draft
            </button>
            <button
              onClick={handleSave}
              className="soft-btn-primary bg-gradient-to-r from-blue-500 to-amber-600 px-6 py-2 text-white font-bold text-sm flex items-center gap-2 shadow-blue-200"
            >
              <FileText className="w-4 h-4" /> {isEditMode ? 'Save Changes' : 'Save & Invoice'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-bold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 space-y-6">
          <div className="soft-card p-6 border-t-4 border-blue-400">
            <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <PawPrint className="w-5 h-5 text-blue-400" />
              Patient Details
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Client</label>
                <div className="relative">
                  <select
                    value={selectedClientId}
                    onChange={(e) => {
                      setSelectedClientId(e.target.value);
                      setSelectedPatientId('');
                    }}
                    className="w-full soft-input px-4 py-3 font-bold text-slate-700 appearance-none bg-transparent text-sm"
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Patient</label>
                <div className="relative">
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    disabled={!selectedClientId}
                    className="w-full soft-input px-4 py-3 font-bold text-slate-700 appearance-none bg-transparent text-sm disabled:opacity-50"
                  >
                    <option value="">Select Patient</option>
                    {filteredPatients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {selectedPatient && (
                <div className="p-4 bg-blue-50 rounded-xl mt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-blue-700 text-lg">{selectedPatient.name}</span>
                    <span className="text-xs bg-white px-2 py-1 rounded text-blue-500 font-bold border border-blue-100">{selectedPatient.species}</span>
                  </div>
                  <div className="text-xs text-blue-600/80 font-medium grid grid-cols-1 gap-1">
                    <span className="font-bold">{selectedPatient.breed}</span>
                    <div className="flex gap-2 items-center">
                      <span className="bg-white px-2 py-0.5 rounded border border-blue-100">{selectedPatient.gender}</span>
                      <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-bold">
                        {patientAge ? `${patientAge.years}y ${patientAge.months}m` : `${selectedPatient.age} yrs`}
                      </span>
                    </div>
                    <span>{selectedPatient.weight} kg</span>
                    <span>Color: {selectedPatient.color}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="soft-card p-6 border-t-4 border-amber-400">
             <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
               <CalendarDays className="w-5 h-5 text-amber-400" />
               Treatment Plan
             </h2>
             <div className="space-y-4">
                 <label className="flex items-center gap-3 cursor-pointer group">
                   <div className={`w-10 h-6 flex items-center bg-slate-200 rounded-full p-1 duration-300 ease-in-out ${isMultiDay ? 'bg-amber-500' : ''}`}>
                     <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${isMultiDay ? 'translate-x-4' : ''}`} />
                   </div>
                   <span className="text-sm font-bold text-slate-700">Multi-Day Care Plan?</span>
                 </label>
                 
                 {isMultiDay && (
                     <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl animate-fade-in space-y-3">
                         <label className="text-xs font-bold text-amber-700 uppercase">Treatment Duration (Days)</label>
                         <input
                           type="number"
                           min="1"
                           value={treatmentDays}
                           onChange={e => setTreatmentDays(parseInt(e.target.value) || 1)}
                           className="w-full soft-input px-4 py-2 font-bold text-slate-700 bg-white"
                           placeholder="e.g. 5"
                         />
                         <p className="text-xs font-bold text-slate-500 mt-2">
                             Status will track as <span className="text-amber-500 uppercase">Ongoing</span> on the Dashboard.
                         </p>
                     </div>
                 )}
             </div>
          </div>

          <div className="soft-card p-6 border-t-4 border-slate-700 bg-slate-800 text-white shadow-xl shadow-slate-200">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Cost Summary
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Procedures</span>
                <span>{settings.currencySymbol}{procedureCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Other Charges</span>
                <input
                  type="number"
                  value={otherCharges}
                  onChange={(e) => setOtherCharges(parseFloat(e.target.value) || 0)}
                  className="w-20 bg-slate-700 border-none rounded px-2 py-1 text-right text-xs text-white focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-between items-center text-slate-300 border-t border-slate-700 pt-2">
                <span>Discount</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-20 bg-slate-700 border-none rounded px-2 py-1 text-right text-xs text-rose-400 focus:ring-1 focus:ring-rose-500 font-bold"
                />
              </div>
              <div className="border-t border-slate-700 pt-3 flex justify-between font-black text-2xl text-white tracking-tight">
                <span>Total</span>
                <span>{settings.currencySymbol}{total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="soft-card p-6 border border-transparent focus-within:border-blue-200 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-slate-700">Presenting Complaint</h2>
                <button
                  onClick={handleDictateToggle}
                  disabled={isTranscribing}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                    isRecording 
                      ? 'bg-rose-100 text-rose-600 animate-pulse border border-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                      : isTranscribing
                        ? 'bg-blue-50 text-blue-400 opacity-70 cursor-not-allowed'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:shadow-md'
                  }`}
                >
                  {isTranscribing ? (
                     <><Loader className="w-3 h-3 animate-spin"/> Transcribing...</>
                  ) : isRecording ? (
                     <><Square className="w-3 h-3 fill-rose-600"/> Stop Recording</>
                  ) : (
                     <><Mic className="w-3 h-3"/> AI Dictate Notes</>
                  )}
                </button>
              </div>
              <textarea
                className="w-full soft-input p-4 text-sm font-medium text-slate-700 min-h-[120px]"
                placeholder="Reason for visit..."
                value={presentingComplaint}
                onChange={(e) => setPresentingComplaint(e.target.value)}
              />
            </div>
            <div className="soft-card p-6">
              <h2 className="font-bold text-slate-700 mb-4">Clinical Assessment</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <input className="soft-input px-3 py-2 text-sm font-bold text-slate-700" placeholder="Temp (°C)" value={vitals.temperature} onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })} />
                <input className="soft-input px-3 py-2 text-sm font-bold text-slate-700" placeholder="HR (bpm)" value={vitals.heartRate} onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })} />
                <input className="soft-input px-3 py-2 text-sm font-bold text-slate-700" placeholder="RR (rpm)" value={vitals.respiratoryRate} onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })} />
                <input className="soft-input px-3 py-2 text-sm font-bold text-slate-700" placeholder="Pulse" value={vitals.pulse} onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })} />
                <input className="soft-input px-3 py-2 text-sm font-bold text-slate-700" placeholder="BCS" value={vitals.bcs} onChange={(e) => setVitals({ ...vitals, bcs: e.target.value })} />
                <input className="soft-input px-3 py-2 text-sm font-bold text-slate-700" placeholder="MM Color" value={vitals.mmColor} onChange={(e) => setVitals({ ...vitals, mmColor: e.target.value })} />
              </div>
              <textarea
                className="w-full soft-input p-3 text-sm font-medium text-slate-700"
                placeholder="Detailed assessment..."
                rows={2}
                value={clinicalAssessment}
                onChange={(e) => setClinicalAssessment(e.target.value)}
              />
            </div>
          </div>

          <div className="soft-card p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="font-bold text-slate-700 mb-4">Problem List</h2>
                <ul className="space-y-2">
                  {problems.map((prob, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-slate-400 font-bold py-2">{idx + 1}.</span>
                      <input className="w-full soft-input px-3 py-2 text-sm font-medium" placeholder="Problem..." value={prob} onChange={(e) => { const newProblems = [...problems]; newProblems[idx] = e.target.value; setProblems(newProblems); }} />
                    </li>
                  ))}
                </ul>
                <button onClick={() => setProblems([...problems, ''])} className="mt-3 text-xs font-bold text-blue-500 hover:text-blue-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Problem
                </button>
              </div>
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold text-slate-700">Diagnosis</h2>
                  <button
                    onClick={handleAISuggest}
                    disabled={isAnalyzing}
                    className="px-3 py-1.5 rounded-lg bg-peach-50 text-peach-600 text-xs font-bold flex items-center gap-1 hover:bg-peach-100 transition disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isAnalyzing ? (
                      <><div className="w-3 h-3 border-2 border-peach-600 border-t-transparent rounded-full animate-spin"></div> Analyzing...</>
                    ) : (
                      <><Zap className="w-3 h-3" /> AI Suggest</>
                    )}
                  </button>
                </div>
                {aiSuggestions.length > 0 && (
                  <div className="mb-4 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100 animate-fade-in">
                    {aiSuggestions.map((suggestion, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                          <span>{suggestion.diagnosis}</span><span>{suggestion.confidence}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${suggestion.confidence > 70 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${suggestion.confidence}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  <input className="w-full soft-input px-4 py-3 text-sm font-bold text-slate-700" placeholder="Final Diagnosis" value={finalDiagnosis} onChange={(e) => setFinalDiagnosis(e.target.value)} />
                  <input className="w-full soft-input px-4 py-3 text-sm font-medium text-slate-700" placeholder="Differentials" value={differentialDiagnosis} onChange={(e) => setDifferentialDiagnosis(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="soft-card p-6">
            <h2 className="font-bold text-slate-700 mb-4">Medications</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead><tr className="text-xs font-bold text-slate-400 uppercase"><th className="p-2">Drug</th><th className="p-2 w-24">Dose</th><th className="p-2 w-32">Route</th><th className="p-2 w-32">Freq</th><th className="p-2 w-24">Dur.</th><th className="p-2 w-10"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {medications.map((med) => (
                    <tr key={med.id}>
                      <td className="p-2"><input className="w-full soft-input px-3 py-2 text-sm font-medium" value={med.drug} onChange={(e) => setMedications(medications.map(m => m.id === med.id ? { ...m, drug: e.target.value } : m))} /></td>
                      <td className="p-2"><input className="w-full soft-input px-3 py-2 text-sm font-medium" value={med.dose} onChange={(e) => setMedications(medications.map(m => m.id === med.id ? { ...m, dose: e.target.value } : m))} /></td>
                      <td className="p-2">
                        <select className="w-full soft-input px-3 py-2 text-sm font-medium" value={med.route} onChange={(e) => setMedications(medications.map(m => m.id === med.id ? { ...m, route: e.target.value } : m))}>
                          <option>Oral</option><option>SC</option><option>IM</option><option>IV</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select className="w-full soft-input px-3 py-2 text-sm font-medium" value={med.freq} onChange={(e) => setMedications(medications.map(m => m.id === med.id ? { ...m, freq: e.target.value } : m))}>
                          <option>SID</option><option>BID</option><option>TID</option><option>EOD</option>
                        </select>
                      </td>
                      <td className="p-2"><input className="w-full soft-input px-3 py-2 text-sm font-medium" value={med.duration} onChange={(e) => setMedications(medications.map(m => m.id === med.id ? { ...m, duration: e.target.value } : m))} /></td>
                      <td className="p-2"><button onClick={() => setMedications(medications.filter(m => m.id !== med.id))} className="text-rose-400"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setMedications([...medications, { id: Date.now(), drug: '', dose: '', route: 'Oral', freq: 'SID', duration: '' }])} className="mt-4 text-sm font-bold text-blue-500 hover:text-blue-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Add Medication</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="soft-card p-6">
              <h2 className="font-bold text-slate-700 mb-4">Add Procedure</h2>
              <select className="w-full soft-input px-4 py-3 font-bold text-slate-700 text-sm" onChange={handleProcedureChange} value="">
                <option value="" disabled>Select Procedure...</option>
                {procedures.filter(p => p.status === 'Active').map(p => <option key={p.id} value={p.id}>{p.name} - {settings.currencySymbol}{p.costClient}</option>)}
              </select>
            </div>
            <div className="soft-card p-6">
              <h2 className="font-bold text-slate-700 mb-4">Follow Up</h2>
              <div className="flex gap-6 mb-4">
                <label className="flex items-center gap-2 font-bold text-slate-600 text-sm"><input type="radio" checked={followUp === 'yes'} onChange={() => setFollowUp('yes')} /> Yes</label>
                <label className="flex items-center gap-2 font-bold text-slate-600 text-sm"><input type="radio" checked={followUp === 'no'} onChange={() => setFollowUp('no')} /> No</label>
              </div>
              <input type="date" className="w-full soft-input px-4 py-3 font-bold text-slate-700 text-sm" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} disabled={followUp === 'no'} />
              <p className="mt-3 text-xs font-medium text-slate-400">
                {followUp === 'yes'
                  ? 'This date is used for the appointment below if the appointment date field is left blank.'
                  : 'Choose Yes if this case needs a scheduled return visit.'}
              </p>
            </div>
          </div>

          <div className="soft-card p-6 border-t-4 border-peach-400">
            <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-peach-400" /> Schedule Next Appointment</h2>
            <p className="text-xs font-medium text-slate-400 mb-4">
              {isEditMode
                ? 'Appointments are only created during a new treatment save. Editing this record will not create a new appointment.'
                : 'This will be created automatically when you save the treatment.'}
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="date" className="w-full soft-input px-4 py-3 font-bold text-slate-700" value={nextAppointmentDate} onChange={(e) => setNextAppointmentDate(e.target.value)} />
                <input type="time" className="w-full soft-input px-4 py-3 font-bold text-slate-700" value={nextAppointmentTime} onChange={(e) => setNextAppointmentTime(e.target.value)} />
              </div>
              <select className="w-full soft-input px-4 py-3 font-bold text-slate-700 text-sm" value={nextAppointmentProcedure} onChange={(e) => setNextAppointmentProcedure(e.target.value)}>
                <option value="">Select Follow-up Procedure...</option>
                {procedures.filter(p => p.status === 'Active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="text" className="w-full soft-input px-4 py-3 text-sm font-medium text-slate-700" placeholder="Appointment notes (optional)" value={nextAppointmentNotes} onChange={(e) => setNextAppointmentNotes(e.target.value)} />
              {!nextAppointmentDate && followUpDate && followUp === 'yes' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-amber-700 animate-fade-in">
                  <CalendarDays className="w-4 h-4" />
                  Using the follow-up date above unless you choose a different appointment date here
                </div>
              )}
              {(nextAppointmentDate || (followUp === 'yes' && followUpDate)) && nextAppointmentTime && nextAppointmentProcedure && !isEditMode && (
                <div className="flex items-center gap-2 px-3 py-2 bg-peach-50 border border-peach-100 rounded-xl text-xs font-bold text-peach-600 animate-fade-in">
                  <CalendarDays className="w-4 h-4" />
                  Follow-up will be scheduled on save
                </div>
              )}
            </div>
          </div>

          <div className="soft-card p-6 border-t-4 border-rose-400">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-700">Hospitalization / Admit to Ward</h2>
              {!isEditMode && (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={admitToWard} onChange={(e) => setAdmitToWard(e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                </label>
              )}
            </div>

            {isEditMode ? (
              <p className="text-xs font-medium text-slate-400">
                Ward admission is only created from a new treatment save. Use the active hospitalization workflow to manage admitted patients.
              </p>
            ) : admitToWard && (
              <div className="space-y-4 animate-fade-in mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select 
                    className="w-full soft-input px-4 py-3 font-bold text-slate-700 text-sm"
                    value={selectedKennelId}
                    onChange={(e) => setSelectedKennelId(e.target.value)}
                  >
                    <option value="" disabled>Select Available Kennel...</option>
                    {kennels.map(k => <option key={k.id} value={k.id}>{k.name} ({k.type})</option>)}
                  </select>
                  <input 
                    type="number" 
                    placeholder="Estimated Cost" 
                    className="w-full soft-input px-4 py-3 font-bold text-slate-700 text-sm"
                    value={estimatedCost || ''}
                    onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <textarea 
                  className="w-full soft-input p-3 text-sm font-medium text-slate-700 min-h-[80px]" 
                  placeholder="Reason for admission..."
                  value={admissionReason}
                  onChange={(e) => setAdmissionReason(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="soft-card p-6">
            <h2 className="font-bold text-slate-700 mb-4">Discharge Instructions</h2>
            <textarea className="w-full soft-input p-4 text-sm font-medium text-slate-700 min-h-[100px]" placeholder="Instructions for owner..." value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
};
