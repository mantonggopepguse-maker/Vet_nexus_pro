import React, { useState, useEffect } from 'react';
import { ClinicSettings, User, AppView } from '../../types';
import { Calendar, Users, PawPrint, ChevronRight, Clock, Plus, CreditCard, Bell, Package } from 'lucide-react';
import { api } from '../../services/apiService';
import PageLoader from '../shared/PageLoader';

interface FrontDeskDashboardProps {
    settings: ClinicSettings;
    user?: User | null;
    onNavigate: (view: AppView) => void;
}

export const FrontDeskDashboard: React.FC<FrontDeskDashboardProps> = ({
    settings,
    user,
    onNavigate
}) => {
    const [stats, setStats] = useState(() => {
        const cached = api.getCache<any>('dashboard', 'stats');
        return cached || {
            upcomingAppointments: [],
            clients: { today: 0 },
            patients: { today: 0 },
            outstandingDebt: 0
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
                console.error("Failed to load front desk stats", error);
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

    if (loading) return <PageLoader />;

    return (
        <div className="space-y-10 animate-fade-in pb-20 relative max-w-7xl mx-auto px-4 md:px-0">
            {/* Header */}
            <div className="dashboard-hero">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="flex flex-col text-slate-900">
                        <span className="eyebrow-label mb-2">{settings.name || 'Your clinic'}</span>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-11 h-11 bg-amber-500 rounded-[1.3rem] flex items-center justify-center text-white shadow-lg shadow-amber-100/60">
                            <Users className="w-5 h-5" />
                            </div>
                            <h1 className="section-title text-3xl md:text-5xl">Front Desk</h1>
                        </div>
                        <span className="mb-3 text-xs font-extrabold uppercase tracking-[0.28em] text-amber-600/80">Front desk summary</span>
                        <p className="font-semibold text-lg text-slate-500 max-w-2xl">
                            {getTimeGreeting()}, <span className="text-amber-600">{user?.name?.split(' ')[0] || 'Team'}</span>. Track arrivals, check-ins, and payments in one place.
                        </p>
                    </div>
                    <div className="neo-pill text-amber-700">Live status</div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                <div className="stat-widget stat-widget-amber">
                    <div className="stat-kicker">Client sign-ins</div>
                    <div className="stat-value mt-3">{stats.clients?.today || 0}</div>
                    <div className="mt-5 flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-white/20 overflow-hidden">
                            <div className="h-full w-3/4 rounded-full bg-white/90"></div>
                        </div>
                        <span className="text-sm font-bold text-white/88">steady</span>
                    </div>
                    <div className="stat-footer">
                        <span>Front desk</span>
                        <span>Today</span>
                    </div>
                </div>
                <div className="stat-widget stat-widget-blue">
                    <div className="stat-kicker">Upcoming arrivals</div>
                    <div className="stat-value mt-3">{stats.upcomingAppointments?.length || 0}</div>
                    <div className="mt-5 grid grid-cols-4 gap-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className={`h-10 rounded-[0.9rem] ${index < Math.min(stats.upcomingAppointments?.length || 0, 4) ? 'bg-white/24' : 'bg-black/10'}`}></div>
                        ))}
                    </div>
                    <div className="stat-footer">
                        <span>Check-ins</span>
                        <span>Queue</span>
                    </div>
                </div>
                <div className="stat-widget stat-widget-red">
                    <div className="stat-kicker">Outstanding balance</div>
                    <div className="stat-value mt-3">{settings.currencySymbol}{(stats.outstandingDebt || 0).toLocaleString()}</div>
                    <div className="mt-5 text-lg font-bold text-white/88">91 Due</div>
                    <div className="stat-footer">
                        <span>Payments</span>
                        <span>Attention</span>
                    </div>
                </div>
                <div className="stat-widget stat-widget-teal">
                    <div className="stat-kicker">Patients today</div>
                    <div className="stat-value mt-3">{stats.patients?.today || 0}</div>
                    <div className="mt-5 flex justify-between gap-2">
                        {['Now', '2PM', '3PM'].map((slot) => (
                            <div key={slot} className="flex-1 rounded-[0.9rem] bg-white/14 px-2 py-3 text-center text-xs font-extrabold uppercase tracking-[0.14em] text-white/92">
                                {slot}
                            </div>
                        ))}
                    </div>
                    <div className="stat-footer">
                        <span>Flow</span>
                        <span>Active day</span>
                    </div>
                </div>
            </div>

            {/* Reception Tools - Neomorphic Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Book Appt', icon: Calendar, view: 'APPOINTMENTS', tint: 'soft-tint-amber' },
                    { label: 'Add Client', icon: Users, view: 'CLIENTS', tint: 'soft-tint-rose' },
                    { label: 'POS', icon: CreditCard, view: 'POS', tint: 'soft-tint-indigo' },
                    { label: 'Inventory', icon: Package, view: 'INVENTORY', tint: 'soft-tint-teal' }
                ].map(tool => (
                    <button
                        key={tool.label}
                        onClick={() => onNavigate(tool.view as AppView)}
                        className="quick-access-card group active:scale-95 text-left"
                    >
                        <div className={`quick-access-inner ${tool.tint}`}>
                            <div className="flex justify-between items-start">
                                <div className="quick-access-badge">
                                    <tool.icon className="w-4.5 h-4.5" />
                                </div>
                                <div className="w-8 h-8 rounded-[1rem] bg-white/12" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-8 rounded-[0.95rem] bg-white/12" />
                                <div className="h-8 rounded-[0.95rem] bg-black/10" />
                            </div>
                        </div>
                        <span className="quick-access-label">{tool.label}</span>
                    </button>
                ))}
            </div>

            {/* High-Level Flow Stats - Prism Glass */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="metric-card flex items-center justify-between gap-6">
                    <div className="relative z-10">
                        <p className="eyebrow-label text-amber-700/70 mb-3">New clients today</p>
                        <p className="section-title text-3xl">{stats.clients?.today || 0} Registrations</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-amber-500 relative z-10">
                        <Users className="w-6 h-6" />
                    </div>
                </div>
                
                <div className="metric-card flex items-center justify-between gap-6">
                    <div className="relative z-10">
                        <p className="eyebrow-label text-amber-700/70 mb-3">Today&apos;s schedule</p>
                        <p className="section-title text-3xl">{stats.upcomingAppointments?.length || 0} Arrivals</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-amber-500 relative z-10">
                        <Calendar className="w-6 h-6" />
                    </div>
                </div>

                <div className="metric-card flex items-center justify-between gap-6">
                    <div className="relative z-10">
                        <p className="eyebrow-label text-rose-700/70 mb-3">Outstanding balance</p>
                        <p className="section-title text-3xl text-rose-600">{settings.currencySymbol}{(stats.outstandingDebt || 0).toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-rose-500 relative z-10">
                        <CreditCard className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Daily Schedule - Check-in Dashboard */}
            <div className="dashboard-panel-strong p-8">
                 <div className="flex justify-between items-center mb-8">
                     <div>
                         <h3 className="section-title text-2xl flex items-center gap-3">
                             <Clock className="w-6 h-6 text-amber-500" />
                             Patient Arrivals & Check-ins
                         </h3>
                         <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Monitor expected patient arrivals</p>
                     </div>
                     <button onClick={() => onNavigate('APPOINTMENTS')} className="text-[10px] font-black text-amber-600 uppercase hover:underline">Full Daily View</button>
                 </div>

                 <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                     {stats.upcomingAppointments && stats.upcomingAppointments.length > 0 ? (
                         stats.upcomingAppointments.map((apt: any) => (
                             <div key={apt.id} className="neo-tile flex items-center justify-between p-5 group">
                                 <div className="flex items-center gap-8">
                                     <div className="flex flex-col items-center justify-center w-16 px-4 border-r border-slate-200">
                                         <span className="text-sm font-black text-slate-400 uppercase leading-none mb-1">Time</span>
                                         <span className="text-xl font-black text-amber-600">{apt.time}</span>
                                     </div>
                                     <div className="flex flex-col">
                                         <span className="text-base font-black text-slate-800">{apt.client?.firstName} {apt.client?.lastName}</span>
                                         <div className="flex items-center gap-3 mt-1">
                                             <div className="flex items-center gap-1">
                                                 <PawPrint className="w-3 h-3 text-slate-400" />
                                                 <span className="text-xs font-bold text-slate-500">{apt.patient?.name || 'Guest Patient'}</span>
                                             </div>
                                             <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                                 {apt.procedure?.name || 'General Examination'}
                                             </span>
                                         </div>
                                     </div>
                                 </div>
                                 <div className="flex gap-2">
                                     <button 
                                         onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: { view: 'CLIENT_DETAILS', clientId: apt.clientId } }))}
                                         className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:border-amber-200 group-hover:shadow-md transition-all"
                                         title="Go to Client File"
                                     >
                                         <ChevronRight className="w-6 h-6" />
                                     </button>
                                 </div>
                             </div>
                         ))
                     ) : (
                         <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
                             <Bell className="w-16 h-16 mb-4 opacity-10" />
                             <p className="text-lg font-black text-slate-300">No scheduled arrivals for today.</p>
                             <button onClick={() => onNavigate('APPOINTMENTS')} className="mt-6 btn-luminous btn-luminous-neutral px-8 py-3 text-sm font-black">Open Scheduler</button>
                         </div>
                     )}
                 </div>
            </div>
        </div>
    );
};
