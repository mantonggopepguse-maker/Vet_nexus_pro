import React, { useState, useEffect } from 'react';
import { ClinicSettings, User, AppView } from '../../types';
import { PawPrint, Plus, ChevronRight, Clock, Activity, HeartPulse, ShieldAlert, Stethoscope, ClipboardList, Sparkles } from 'lucide-react';
import { api } from '../../services/apiService';
import PageLoader from '../shared/PageLoader';
import { parseDateOnly } from '../../utils/date';

interface ClinicalDashboardProps {
    settings: ClinicSettings;
    user?: User | null;
    onNavigate: (view: AppView) => void;
}

export const ClinicalDashboard: React.FC<ClinicalDashboardProps> = ({
    settings,
    user,
    onNavigate
}) => {
    const [stats, setStats] = useState(() => {
        const cached = api.getCache<any>('dashboard', 'stats');
        return cached || {
            upcomingAppointments: [],
            ongoingTreatments: [],
            hospitalization: { active: 0, totalKennels: 0, occupiedKennels: 0, occupancyRate: 0 },
            patients: { today: 0, week: 0, month: 0 }
        };
    });

    const [loading, setLoading] = useState(!api.getCache('dashboard', 'stats'));

    useEffect(() => {
        const fetchStats = async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const data = await api.dashboard.getStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to load clinical stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();

        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, [settings.acronym]);

    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    };

    if (loading) {
        return <PageLoader />;
    }

    return (
        <div className="space-y-10 animate-fade-in pb-20 relative max-w-7xl mx-auto px-4 md:px-0">
            {/* Header & Greetings */}
            <div className="dashboard-hero">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="flex flex-col text-slate-900">
                        <span className="eyebrow-label mb-2">{settings.name || 'Your clinic'}</span>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-11 h-11 bg-emerald-50/90 text-emerald-600 rounded-[1.3rem] flex items-center justify-center shadow-inner">
                            <Stethoscope className="w-5 h-5" />
                            </div>
                            <h1 className="section-title text-3xl md:text-5xl">Clinical Hub</h1>
                        </div>
                        <span className="mb-3 text-xs font-extrabold uppercase tracking-[0.28em] text-emerald-600/80">Care coordination</span>
                        <p className="font-semibold text-lg text-slate-500 max-w-2xl">
                            {getTimeGreeting()}, <span className="text-emerald-600">Dr. {user?.name?.split(' ')[0] || 'Vet'}</span>. Your treatment queue, ward visibility, and next appointments are all in one place.
                        </p>
                    </div>
                    <div className="neo-pill text-emerald-700">Live clinical view</div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                <div className="stat-widget stat-widget-teal">
                    <div className="stat-kicker">Triage queue</div>
                    <div className="stat-value mt-3">{stats.triageQueue?.length || 0}</div>
                    <div className="mt-5 flex gap-2">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className={`h-9 flex-1 rounded-[0.9rem] ${index < Math.min(stats.triageQueue?.length || 0, 5) ? 'bg-white/22' : 'bg-black/10'}`}></div>
                        ))}
                    </div>
                    <div className="stat-footer">
                        <span>Priority intake</span>
                        <span>Live</span>
                    </div>
                </div>
                <div className="stat-widget stat-widget-blue">
                    <div className="stat-kicker">Ward occupancy</div>
                    <div className="mt-3 flex items-end justify-between">
                        <div className="stat-value">{Math.round((stats.hospitalization?.occupiedKennels / stats.hospitalization?.totalKennels) * 100) || 0}%</div>
                        <div className="text-lg font-bold text-white/82">{stats.hospitalization?.occupiedKennels || 0}/{stats.hospitalization?.totalKennels || 0}</div>
                    </div>
                    <div className="mt-6 h-3 rounded-full bg-white/20 overflow-hidden">
                        <div className="h-full rounded-full bg-white/90" style={{ width: `${Math.round((stats.hospitalization?.occupiedKennels / stats.hospitalization?.totalKennels) * 100) || 0}%` }}></div>
                    </div>
                    <div className="stat-footer">
                        <span>ICU beds</span>
                        <span>Capacity</span>
                    </div>
                </div>
                <div className="stat-widget stat-widget-rose">
                    <div className="stat-kicker">Active treatments</div>
                    <div className="stat-value mt-3">{stats.ongoingTreatments?.length || 0}</div>
                    <div className="mt-5 text-lg font-bold text-white/88">Well Above</div>
                    <div className="stat-footer">
                        <span>Case load</span>
                        <span>7 days</span>
                    </div>
                </div>
                <div className="stat-widget stat-widget-purple">
                    <div className="stat-kicker">Appointments</div>
                    <div className="stat-value mt-3">{stats.upcomingAppointments?.length || 0}</div>
                    <div className="mt-5 flex items-end gap-2">
                        <div className="h-6 w-8 rounded-full bg-white/20"></div>
                        <div className="h-8 w-10 rounded-full bg-white/26"></div>
                        <div className="h-10 w-12 rounded-full bg-white/35"></div>
                    </div>
                    <div className="stat-footer">
                        <span>Schedule</span>
                        <span>Today</span>
                    </div>
                </div>
            </div>

            {/* Command Center - Luminous Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                    { label: 'ICU Board', icon: HeartPulse, view: 'ICU_BOARD', tint: 'soft-tint-rose' },
                    { label: 'ER Triage', icon: Activity, view: 'TRIAGE', tint: 'soft-tint-amber' },
                    { label: 'Treatments', icon: Stethoscope, view: 'TREATMENTS', tint: 'soft-tint-teal' },
                    { label: 'Procedures', icon: ClipboardList, view: 'PROCEDURES', tint: 'soft-tint-indigo' },
                    { label: 'AI Scribe', icon: Sparkles, view: 'AI_HUB', tint: 'soft-tint-teal' }
                ].map(link => (
                    <button
                        key={link.label}
                        onClick={() => onNavigate(link.view as AppView)}
                        className="quick-access-card group active:scale-95 text-left"
                    >
                        <div className={`quick-access-inner ${link.tint}`}>
                            <div className="flex justify-between items-start">
                                <div className="quick-access-badge">
                                    <link.icon className="w-4.5 h-4.5" />
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-white/18" />
                                    <div className="w-3 h-3 rounded-full bg-white/28" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-8 rounded-[0.9rem] bg-black/10" />
                                <div className="h-8 rounded-[0.9rem] bg-white/10" />
                            </div>
                        </div>
                        <span className="quick-access-label">{link.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ER Waiting List - Rose Prism */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="dashboard-panel p-8 h-full group transition-all duration-500">
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <h3 className="section-title text-2xl flex items-center gap-3 uppercase">
                                <Activity className="w-6 h-6 text-rose-500" />
                                Triage Status
                            </h3>
                            <span className="neo-pill text-rose-600">
                                {stats.triageQueue?.length || 0} waiting
                            </span>
                        </div>

                        <div className="space-y-4 relative z-10">
                            {stats.triageQueue && stats.triageQueue.length > 0 ? (
                                stats.triageQueue.map((patient: any) => (
                                    <div key={patient.id} className="flex items-center gap-4 p-5 bg-white/60 rounded-[1.5rem] border border-white/60 group/item hover:bg-white transition-all shadow-sm">
                                        <div className={`w-1.5 h-8 rounded-full ${patient.triageStatus === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-400'} animate-pulse`}></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-800 truncate uppercase tracking-tight">{patient.name}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{patient.species}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Urgent</p>
                                            <div className="flex items-center justify-end gap-1 text-[9px] font-bold text-slate-400">
                                                <Clock size={10} />
                                                {Math.floor((new Date().getTime() - new Date(patient.triageStartTime).getTime()) / 60000)}m
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                    <div className="py-16 flex flex-col items-center justify-center text-center bg-white/20 border border-dashed border-white/60 rounded-[2.5rem]">
                                    <Activity size={24} className="mb-4 text-slate-200" />
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No patients waiting</p>
                                </div>
                            )}
                            <button 
                                onClick={() => onNavigate('TRIAGE')}
                                className="btn-luminous btn-luminous-emerald w-full text-[9px] uppercase tracking-widest mt-4"
                            >
                                Open triage board
                            </button>
                        </div>
                    </div>
                </div>

                {/* Patient Flows - ICU & Outpatient */}
                    {/* ICU Ward Status - Emerald Prism */}
                    <div className="dashboard-panel p-8 h-full group transition-all duration-500">
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <h3 className="section-title text-2xl flex items-center gap-3 uppercase">
                                <HeartPulse className="w-6 h-6 text-emerald-500" />
                                ICU Occupancy
                            </h3>
                            <div className="flex items-center gap-4">
                                <span className="neo-pill text-emerald-600">
                                    {stats.hospitalization?.active || 0} active
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                             <div className="neo-tile p-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Ward use</p>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-black text-slate-800">{Math.round((stats.hospitalization?.occupiedKennels / stats.hospitalization?.totalKennels) * 100) || 0}%</span>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase mb-1">{stats.hospitalization?.occupiedKennels}/{stats.hospitalization?.totalKennels} kennels</span>
                                </div>
                                <div className="h-[2px] w-full bg-emerald-100 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${(stats.hospitalization?.occupiedKennels / stats.hospitalization?.totalKennels) * 100}%` }}></div>
                                </div>
                             </div>
                             <div className="neo-tile p-6 flex flex-col justify-between">
                                <button 
                                    onClick={() => onNavigate('ICU_BOARD')}
                                    className="btn-luminous btn-luminous-neutral w-full text-[9px] uppercase tracking-[0.2em] py-4 shadow-xl"
                                >
                                    Open ward board
                                </button>
                             </div>
                        </div>
                    </div>

                    {/* Active Follow-up Cases - Amber Prism */}
                    <div className="dashboard-panel p-8 group transition-all duration-500">
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <h3 className="section-title text-2xl flex items-center gap-3 uppercase">
                                <Activity className="w-6 h-6 text-amber-500" />
                                Active cases
                            </h3>
                            <button onClick={() => onNavigate('TREATMENTS')} className="text-[9px] font-black text-amber-600 uppercase tracking-widest hover:underline">View all</button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                            {stats.ongoingTreatments && stats.ongoingTreatments.slice(0, 4).map((treatment: any) => (
                                <div key={treatment.id} className="neo-tile p-6 flex items-start gap-5 hover:bg-white transition-all group/item shadow-sm">
                                    <div className="w-14 h-14 rounded-2xl bg-white border border-amber-100 shadow-xl flex flex-col items-center justify-center flex-shrink-0 group-hover/item:scale-110 transition-transform">
                                        <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest leading-none">Days</span>
                                        <span className="text-xl font-black text-slate-800 leading-none mt-1">
                                            {treatment.endDate ? Math.ceil((new Date(treatment.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-800 truncate uppercase tracking-tight">{treatment.patient?.name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase truncate tracking-widest">Plan: {treatment.diagnosis || 'Standard care'}</p>
                                        <div className="mt-4">
                                            <button 
                                                onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: { view: 'PATIENT_DETAILS', patientId: treatment.patientId } }))}
                                                className="text-[9px] font-black text-amber-600 flex items-center gap-2 hover:translate-x-2 transition-all uppercase tracking-[0.2em]"
                                            >
                                                Update Chart <ChevronRight size={14} className="text-amber-300" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                </div>
            </div>

            {/* Schedule Grid - Amber Prism */}
            <div className="dashboard-panel-strong p-10 group transition-all duration-500">
                <div className="flex justify-between items-center mb-10 relative z-10">
                    <h3 className="section-title text-3xl flex items-center gap-4 uppercase">
                        <Clock className="w-8 h-8 text-amber-500" />
                        Schedule
                    </h3>
                    <button onClick={() => onNavigate('APPOINTMENTS')} className="btn-luminous btn-luminous-emerald px-8 py-3 text-[10px] uppercase tracking-[0.2em] shadow-xl">Open appointments</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                    {stats.upcomingAppointments && stats.upcomingAppointments.length > 0 ? (
                        stats.upcomingAppointments.map((apt: any) => (
                            <div key={apt.id} className="neo-tile p-6 shadow-xl flex items-start gap-5 group/item">
                                <div className="w-16 h-16 rounded-2xl bg-white border border-amber-100 shadow-2xl flex flex-col items-center justify-center flex-shrink-0 group-hover/item:scale-110 transition-transform">
                                    <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{parseDateOnly(apt.date).toLocaleString('default', { month: 'short' })}</span>
                                    <span className="text-2xl font-black text-amber-700 leading-none">{parseDateOnly(apt.date).getDate()}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-base font-black text-slate-800 truncate uppercase tracking-tight">{apt.client?.firstName} {apt.client?.lastName}</p>
                                    <p className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-widest">Visit: {apt.procedure?.name || 'Checkup'}</p>
                                    <div className="flex items-center gap-2 mt-4 px-3 py-1.5 bg-amber-50 rounded-xl w-fit border border-amber-100 shadow-inner">
                                        <Clock size={12} className="text-amber-500" />
                                        <span className="text-[10px] font-black text-amber-700">{apt.time}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 text-center text-slate-400 bg-white/20 rounded-[3rem] border-2 border-dashed border-white/60">
                            <Clock className="w-16 h-16 mb-4 mx-auto opacity-10" />
                            <p className="text-[11px] font-black uppercase tracking-[0.3em]">No appointments scheduled</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
