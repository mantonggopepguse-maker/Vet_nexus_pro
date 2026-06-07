import React, { useState } from 'react';
import { 
    Calculator, Activity, Droplet, Zap, RefreshCw, ChevronRight, 
    AlertCircle, Info, Beaker, Syringe, Clipboard
} from 'lucide-react';
import { toast } from 'sonner';

type CalcMode = 'DOSE' | 'CRI' | 'FLUIDS';

export const ClinicalCalculators: React.FC = () => {
    const [mode, setMode] = useState<CalcMode>('DOSE');

    // State for Dose Calc
    const [doseForm, setDoseForm] = useState({
        weight: '',
        doseRate: '',
        concentration: ''
    });

    // State for CRI Calc
    const [criForm, setCriForm] = useState({
        weight: '',
        doseRate: '',
        concentration: '',
        fluidRate: '',
        bagSize: ''
    });

    // State for Fluid Therapy
    const [fluidForm, setFluidForm] = useState({
        weight: '',
        dehydration: '',
        maintenance: '50', // ml/kg/day standard
        losses: ''
    });

    const resetForms = () => {
        setDoseForm({ weight: '', doseRate: '', concentration: '' });
        setCriForm({ weight: '', doseRate: '', concentration: '', fluidRate: '', bagSize: '' });
        setFluidForm({ weight: '', dehydration: '', maintenance: '50', losses: '' });
    };

    // Calculations
    const calculateDose = () => {
        const w = parseFloat(doseForm.weight);
        const r = parseFloat(doseForm.doseRate);
        const c = parseFloat(doseForm.concentration);
        if (!w || !r || !c) return null;
        const totalMg = w * r;
        const totalMl = totalMg / c;
        return { totalMg, totalMl };
    };

    const calculateCRI = () => {
        const w = parseFloat(criForm.weight);
        const r = parseFloat(criForm.doseRate); // mcg/kg/min
        const c = parseFloat(criForm.concentration); // mg/ml
        const fr = parseFloat(criForm.fluidRate); // ml/hr
        const bs = parseFloat(criForm.bagSize); // ml
        
        if (!w || !r || !c || !fr || !bs) return null;

        // Formula: Amount to add = (mcg/kg/min * w * 60 * bs) / (fr * 1000 * concentration)
        const amountToAddMl = (r * w * 60 * bs) / (fr * 1000 * c);
        return { amountToAddMl };
    };

    const calculateFluids = () => {
        const w = parseFloat(fluidForm.weight);
        const d = parseFloat(fluidForm.dehydration); // %
        const m = parseFloat(fluidForm.maintenance); // ml/kg/day
        const l = parseFloat(fluidForm.losses) || 0;

        if (!w || isNaN(d) || !m) return null;

        const deficit = w * (d / 100) * 1000; // ml
        const maintenanceTotal = w * m; // ml/day
        const total24h = deficit + maintenanceTotal + l;
        const ratePerHour = total24h / 24;

        return { deficit, maintenanceTotal, total24h, ratePerHour };
    };

    const copyToClinic = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Result copied to clipboard");
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-amber-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-amber-100">
                        <Calculator className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Clinical Intelligence</h1>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                             Precision Veterinary Calculators
                        </p>
                    </div>
                </div>
                <button 
                    onClick={resetForms}
                    className="p-3 bg-slate-50 text-slate-400 hover:text-amber-600 rounded-2xl transition-all"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex p-2 bg-slate-100 rounded-3xl gap-2">
                <button 
                    onClick={() => setMode('DOSE')}
                    className={`flex-1 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all ${mode === 'DOSE' ? 'bg-white text-amber-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Syringe className="w-5 h-5" /> Drug Dosing
                </button>
                <button 
                    onClick={() => setMode('CRI')}
                    className={`flex-1 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all ${mode === 'CRI' ? 'bg-white text-amber-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Beaker className="w-5 h-5" /> CRI (Infusion)
                </button>
                <button 
                    onClick={() => setMode('FLUIDS')}
                    className={`flex-1 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all ${mode === 'FLUIDS' ? 'bg-white text-amber-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Droplet className="w-5 h-5" /> Fluid Therapy
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Input Panel */}
                <div className="soft-card p-10 space-y-8">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                        <Zap className="w-6 h-6 text-amber-500" />
                        Parameters
                    </h3>

                    {mode === 'DOSE' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient Weight (kg)</label>
                                <input 
                                    type="number" step="0.1"
                                    value={doseForm.weight}
                                    onChange={(e) => setDoseForm({...doseForm, weight: e.target.value})}
                                    className="soft-input w-full p-4 font-black text-lg bg-slate-50 border-transparent focus:bg-white"
                                    placeholder="0.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dose Rate (mg/kg)</label>
                                <input 
                                    type="number" step="0.1"
                                    value={doseForm.doseRate}
                                    onChange={(e) => setDoseForm({...doseForm, doseRate: e.target.value})}
                                    className="soft-input w-full p-4 font-black text-lg bg-slate-50 border-transparent focus:bg-white"
                                    placeholder="0.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Concentration (mg/ml)</label>
                                <input 
                                    type="number" step="0.1"
                                    value={doseForm.concentration}
                                    onChange={(e) => setDoseForm({...doseForm, concentration: e.target.value})}
                                    className="soft-input w-full p-4 font-black text-lg bg-slate-50 border-transparent focus:bg-white"
                                    placeholder="0.0"
                                />
                            </div>
                        </div>
                    )}

                    {mode === 'CRI' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                        Weight (kg)
                                    </label>
                                    <input 
                                        type="number" step="0.1"
                                        value={criForm.weight}
                                        onChange={(e) => setCriForm({...criForm, weight: e.target.value})}
                                        className="soft-input w-full p-3 font-bold bg-slate-50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate (mcg/kg/min)</label>
                                    <input 
                                        type="number"
                                        value={criForm.doseRate}
                                        onChange={(e) => setCriForm({...criForm, doseRate: e.target.value})}
                                        className="soft-input w-full p-3 font-bold bg-slate-50"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Concentration (mg/ml)</label>
                                    <input 
                                        type="number"
                                        value={criForm.concentration}
                                        onChange={(e) => setCriForm({...criForm, concentration: e.target.value})}
                                        className="soft-input w-full p-3 font-bold bg-slate-50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IV Fluid Rate (ml/hr)</label>
                                    <input 
                                        type="number"
                                        value={criForm.fluidRate}
                                        onChange={(e) => setCriForm({...criForm, fluidRate: e.target.value})}
                                        className="soft-input w-full p-3 font-bold bg-slate-50"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bag Size (ml)</label>
                                <input 
                                    type="number"
                                    value={criForm.bagSize}
                                    onChange={(e) => setCriForm({...criForm, bagSize: e.target.value})}
                                    className="soft-input w-full p-3 font-bold bg-slate-50"
                                />
                            </div>
                        </div>
                    )}

                    {mode === 'FLUIDS' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Weight (kg)</label>
                                    <input 
                                        type="number"
                                        value={fluidForm.weight}
                                        onChange={(e) => setFluidForm({...fluidForm, weight: e.target.value})}
                                        className="soft-input w-full p-4 font-black bg-slate-50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dehydration (%)</label>
                                    <input 
                                        type="number"
                                        value={fluidForm.dehydration}
                                        onChange={(e) => setFluidForm({...fluidForm, dehydration: e.target.value})}
                                        className="soft-input w-full p-4 font-black bg-slate-50"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maintenance Set (ml/kg/24h)</label>
                                <select 
                                    value={fluidForm.maintenance}
                                    onChange={(e) => setFluidForm({...fluidForm, maintenance: e.target.value})}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none"
                                >
                                    <option value="40">Cat (40 ml/kg)</option>
                                    <option value="50">Average Dog (50 ml/kg)</option>
                                    <option value="60">Puppy/Working Dog (60 ml/kg)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Est. Ongoing Losses (ml/24h)</label>
                                <input 
                                    type="number"
                                    value={fluidForm.losses}
                                    onChange={(e) => setFluidForm({...fluidForm, losses: e.target.value})}
                                    className="soft-input w-full p-4 font-black bg-slate-50"
                                    placeholder="Vomit, diarrhea, dialysis..."
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Panel */}
                <div className="space-y-6">
                    <div className="soft-card p-10 bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-2xl shadow-amber-200">
                        <h3 className="text-xl font-black flex items-center gap-3 mb-10">
                            <Clipboard className="w-6 h-6 text-amber-300" />
                            Calculation Results
                        </h3>

                        {mode === 'DOSE' && (
                            <div className="space-y-10">
                                {calculateDose() ? (
                                    <>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Total Dose To Administer</p>
                                            <div className="text-5xl font-black tabular-nums">{calculateDose()?.totalMg.toFixed(2)} <span className="text-2xl opacity-50">mg</span></div>
                                        </div>
                                        <div className="space-y-2 pt-6 border-t border-white/20">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Volume Required (Draw up)</p>
                                            <div className="text-6xl font-black tabular-nums">{calculateDose()?.totalMl.toFixed(2)} <span className="text-2xl opacity-50">ml</span></div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-20 opacity-40">
                                        <Syringe className="w-16 h-16 mx-auto mb-4" />
                                        <p className="font-bold">Enter values to compute dose</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {mode === 'CRI' && (
                            <div className="space-y-10">
                                {calculateCRI() ? (
                                    <>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Volume to add to Bag</p>
                                            <div className="text-6xl font-black tabular-nums">{calculateCRI()?.amountToAddMl.toFixed(2)} <span className="text-3xl opacity-50">ml</span></div>
                                            <p className="text-[10px] font-bold text-amber-200 mt-4 leading-relaxed">
                                                Add this volume of drug to a new {criForm.bagSize}ml bag to achieve {criForm.doseRate} mcg/kg/min at {criForm.fluidRate} ml/hr.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-20 opacity-40">
                                        <Beaker className="w-16 h-16 mx-auto mb-4" />
                                        <p className="font-bold">Enter values to compute CRI volume</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {mode === 'FLUIDS' && (
                            <div className="space-y-8">
                                {calculateFluids() ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="p-4 bg-white/10 rounded-2xl">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-200">Deficit</p>
                                                <div className="text-2xl font-black">{calculateFluids()?.deficit.toLocaleString()}ml</div>
                                            </div>
                                            <div className="p-4 bg-white/10 rounded-2xl">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-200">Maintenance</p>
                                                <div className="text-2xl font-black">{calculateFluids()?.maintenanceTotal.toLocaleString()}ml</div>
                                            </div>
                                        </div>
                                        <div className="space-y-2 pt-6 border-t border-white/20">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Total 24h Requirement</p>
                                            <div className="text-4xl font-black">{calculateFluids()?.total24h.toLocaleString()} <span className="text-xl opacity-50">ml</span></div>
                                        </div>
                                        <div className="space-y-2 bg-white text-amber-700 p-6 rounded-[2rem] shadow-xl">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Target Infusion Rate</p>
                                            <div className="text-5xl font-black tabular-nums">{calculateFluids()?.ratePerHour.toFixed(1)} <span className="text-2xl opacity-50">ml/hr</span></div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-20 opacity-40">
                                        <Droplet className="w-16 h-16 mx-auto mb-4" />
                                        <p className="font-bold">Enter values to compute fluid rate</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] flex items-start gap-4">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-wider">
                            Disclaimer: All calculations must be verified by a licensed veterinarian. VetNexusPro provides these tools for assistance only.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
