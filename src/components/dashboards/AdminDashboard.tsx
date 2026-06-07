import React, { useEffect, useState } from 'react';
import { Appointment, AppView, ClinicSettings, Client, InventoryItem, User } from '../../types';
import { Building2, Calendar, Clock3, CreditCard, Package, PillBottle, Settings, TrendingUp, UsersRound } from 'lucide-react';
import { api } from '../../services/apiService';
import PageLoader from '../shared/PageLoader';
import { formatDateOnly } from '../../utils/date';

interface DashboardProps {
    settings: ClinicSettings;
    user?: User | null;
    onNavigate: (view: AppView) => void;
    onLogout?: () => void;
}

export const AdminDashboard: React.FC<DashboardProps> = ({
    settings,
    user,
    onNavigate,
}) => {
    const [dateFilter, setDateFilter] = useState<'Today' | 'Week' | 'Month'>('Month');
    const [recentClients, setRecentClients] = useState<Client[]>([]);

    const [stats, setStats] = useState(() => {
        const cached = api.getCache<any>('dashboard', 'stats');
        return cached || {
            patients: { today: 0, week: 0, month: 0 },
            clients: { today: 0, week: 0, month: 0 },
            revenue: { today: 0, week: 0, month: 0 },
            cogs: { today: 0, week: 0, month: 0 },
            overhead: { today: 0, week: 0, month: 0 },
            tax: { today: 0, week: 0, month: 0 },
            discount: { today: 0, week: 0, month: 0 },
            revenueByType: {
                today: { services: 0, retail: 0 },
                week: { services: 0, retail: 0 },
                month: { services: 0, retail: 0 }
            } as any,
            lowStock: [] as any[],
            topSelling: [] as InventoryItem[],
            totalAssetValue: 0,
            upcomingAppointments: [] as Appointment[],
            outstandingDebt: 0,
            weeklyRevenue: [] as { name: string, revenue: number }[],
            hospitalization: { active: 0, totalKennels: 0, occupiedKennels: 0, occupancyRate: 0 }
        };
    });

    const [loading, setLoading] = useState(!api.getCache('dashboard', 'stats'));

    useEffect(() => {
        const fetchDashboard = async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const [dashboardStats, clients] = await Promise.all([
                    api.dashboard.getStats(),
                    api.clients.getAll(1, 4)
                ]);
                setStats(dashboardStats);
                setRecentClients(clients.slice(0, 4));
            } catch (error) {
                console.error('Failed to load dashboard stats', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
        const interval = setInterval(fetchDashboard, 60000);
        return () => clearInterval(interval);
    }, [settings.acronym]);

    const getPatientCount = () => {
        if (dateFilter === 'Today') return stats.patients.today;
        if (dateFilter === 'Week') return stats.patients.week;
        return stats.patients.month;
    };

    const getRevenue = () => {
        if (dateFilter === 'Today') return stats.revenue?.today || 0;
        if (dateFilter === 'Week') return stats.revenue?.week || 0;
        return stats.revenue?.month || 0;
    };

    const getOverhead = () => {
        if (dateFilter === 'Today') return stats.overhead?.today || 0;
        if (dateFilter === 'Week') return stats.overhead?.week || 0;
        return stats.overhead?.month || 0;
    };

    const getCOGS = () => {
        if (dateFilter === 'Today') return stats.cogs?.today || 0;
        if (dateFilter === 'Week') return stats.cogs?.week || 0;
        return stats.cogs?.month || 0;
    };

    const getSubtotal = () => {
        if (dateFilter === 'Today') return (stats as any).subtotal?.today || 0;
        if (dateFilter === 'Week') return (stats as any).subtotal?.week || 0;
        return (stats as any).subtotal?.month || 0;
    };

    const getDiscount = () => {
        if (dateFilter === 'Today') return stats.discount?.today || 0;
        if (dateFilter === 'Week') return stats.discount?.week || 0;
        return stats.discount?.month || 0;
    };

    const getNetProfit = () => (getSubtotal() - getDiscount()) - getCOGS() - getOverhead();
    const upcomingAppointments = stats.upcomingAppointments || [];

    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    if (loading) {
        return <PageLoader />;
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20 relative max-w-7xl mx-auto">
            <div className="dashboard-hero">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex flex-col text-slate-900">
                        <span className="mb-3 text-xs font-extrabold uppercase tracking-[0.28em] text-teal-600/80">Clinic overview</span>
                        <p className="font-semibold text-base md:text-lg text-slate-500 max-w-2xl">
                            Welcome back {user?.name || 'Doctor'}, {getTimeGreeting()}. Here is today&apos;s clinic activity and finance summary.
                        </p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-3 self-stretch md:self-auto">
                        <div className="inline-flex items-center gap-2 rounded-[1.2rem] border border-white/80 bg-white/72 px-4 py-2 text-sm font-bold text-slate-700 shadow-[0_14px_32px_rgba(148,163,184,0.18)] backdrop-blur-xl">
                            <Building2 className="h-4 w-4 text-teal-600" />
                            <span className="truncate max-w-[14rem]">{settings.name || 'Your clinic'}</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                        {(['Today', 'Week', 'Month'] as const).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setDateFilter(filter)}
                                className={`${dateFilter === filter ? 'neo-pill text-teal-700' : 'neo-pill text-slate-500 bg-white/44'} transition-all`}
                            >
                                {filter}
                            </button>
                        ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 animate-fade-in-up" style={{ animationDelay: '40ms' }}>
                <div className="stat-widget stat-widget-purple">
                    <div className="stat-kicker">Revenue target</div>
                    <div className="stat-value mt-3">
                        {settings.currencySymbol}{Math.round(getRevenue()).toLocaleString()}
                        <span className="text-lg md:text-xl text-white/72"> / {settings.currencySymbol}{Math.max(Math.round(getRevenue() * 1.35), 1).toLocaleString()}</span>
                    </div>
                    <div className="mt-4 h-10 flex items-end gap-1.5">
                        <div className="w-10 h-1 rounded-full bg-white/20"></div>
                        <div className="w-12 h-1.5 rounded-full bg-white/28"></div>
                        <div className="w-14 h-2 rounded-full bg-white/40"></div>
                        <div className="w-16 h-2.5 rounded-full bg-amber-200/90"></div>
                    </div>
                    <div className="stat-footer">
                        <span>{dateFilter}</span>
                        <span>Active period</span>
                    </div>
                </div>

                <div className="stat-widget stat-widget-blue">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="stat-kicker">New patients</div>
                            <div className="stat-value mt-3">{getPatientCount()}</div>
                        </div>
                        <UsersRound className="w-7 h-7 text-white/80" />
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-2">
                        {[
                            ['Today', stats.patients.today],
                            ['7 days', stats.patients.week],
                            ['Month', stats.patients.month]
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl bg-white/14 px-3 py-2 text-center">
                                <div className="text-xl font-extrabold text-white">{value}</div>
                                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/70">{label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="stat-footer">
                        <span>{dateFilter} selected</span>
                        <span>Registered pets</span>
                    </div>
                </div>

                <div className="stat-widget stat-widget-teal">
                    <div className="stat-kicker">Net profit</div>
                    <div className="stat-value mt-3">{settings.currencySymbol}{Math.round(getNetProfit()).toLocaleString()}</div>
                    <div className="mt-6 flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-white/20 overflow-hidden">
                            <div className="h-full rounded-full bg-white/90" style={{ width: `${Math.min(100, Math.max(12, Math.round((getNetProfit() / Math.max(getRevenue(), 1)) * 100)))}%` }}></div>
                        </div>
                        <span className="text-sm font-bold text-white/90">{Math.min(100, Math.max(0, Math.round((getNetProfit() / Math.max(getRevenue(), 1)) * 100)))}%</span>
                    </div>
                    <div className="stat-footer">
                        <span>Margin</span>
                        <span>Monthly view</span>
                    </div>
                </div>

                <div className="stat-widget stat-widget-amber">
                    <div className="stat-kicker">Appointments</div>
                    <div className="stat-value mt-3">{upcomingAppointments.length}</div>
                    <div className="mt-5 grid grid-cols-4 gap-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className={`h-8 rounded-[0.9rem] ${index < Math.min(upcomingAppointments.length, 4) ? 'bg-white/24' : 'bg-black/10'}`}></div>
                        ))}
                    </div>
                    <div className="stat-footer">
                        <span>Queue ready</span>
                        <span>Next 24h</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                {[
                    { label: 'Reports', icon: TrendingUp, view: 'REPORTS', tint: 'soft-tint-rose' },
                    { label: 'Staff Shift', icon: Calendar, view: 'SHIFT_TIMETABLE', tint: 'soft-tint-amber' },
                    { label: 'Branches', icon: Building2, view: 'BRANCHES', tint: 'soft-tint-indigo' },
                    { label: 'Inventory', icon: Package, view: 'INVENTORY', tint: 'soft-tint-teal' },
                    { label: 'POS', icon: CreditCard, view: 'POS', tint: 'soft-tint-amber' },
                    { label: 'Settings', icon: Settings, view: 'SETTINGS', tint: 'soft-tint-rose' }
                ].map((tool) => (
                    <button
                        key={tool.label}
                        onClick={() => onNavigate(tool.view as AppView)}
                        className="quick-access-card group active:scale-95"
                    >
                        <div className={`quick-access-inner ${tool.tint}`}>
                            <div className="quick-access-badge">
                                <tool.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <span className="quick-access-label">{tool.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in-up" style={{ animationDelay: '70ms' }}>
                <div className="dashboard-panel p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="eyebrow-label">Appointment queue</div>
                            <h3 className="section-title text-2xl mt-2">Next 4</h3>
                        </div>
                        <div className="w-11 h-11 rounded-[1rem] bg-sky-100 text-sky-600 flex items-center justify-center shadow-inner">
                            <Clock3 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        {upcomingAppointments.slice(0, 4).map((appointment: any) => (
                            <div key={appointment.id} className="neo-tile p-4 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-extrabold text-slate-800 truncate">{appointment.client?.firstName} {appointment.client?.lastName}</p>
                                    <p className="text-xs text-slate-500 mt-1 truncate">{appointment.procedure?.name || 'General consultation'}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-extrabold text-sky-600 uppercase tracking-[0.16em]">{appointment.time}</p>
                                    <p className="text-[11px] text-slate-400 mt-1">{formatDateOnly(appointment.date)}</p>
                                </div>
                            </div>
                        ))}
                        {upcomingAppointments.length === 0 && (
                            <div className="neo-tile p-5 text-sm text-slate-500">No upcoming appointments in queue.</div>
                        )}
                    </div>
                </div>

                <div className="dashboard-panel p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="eyebrow-label">Recent clients</div>
                            <h3 className="section-title text-2xl mt-2">Last 4</h3>
                        </div>
                        <div className="w-11 h-11 rounded-[1rem] bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                            <UsersRound className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        {recentClients.map((client) => (
                            <div key={client.id} className="neo-tile p-4 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-extrabold text-slate-800 truncate">{client.firstName} {client.lastName}</p>
                                    <p className="text-xs text-slate-500 mt-1 truncate">{client.phone}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-extrabold text-emerald-600 uppercase tracking-[0.16em]">New</p>
                                    <p className="text-[11px] text-slate-400 mt-1">{new Date(client.registrationDate).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                        {recentClients.length === 0 && (
                            <div className="neo-tile p-5 text-sm text-slate-500">No recent clients found.</div>
                        )}
                    </div>
                </div>

                <div className="dashboard-panel p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="eyebrow-label">Most sold items</div>
                            <h3 className="section-title text-2xl mt-2">Top 4</h3>
                        </div>
                        <div className="w-11 h-11 rounded-[1rem] bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                            <PillBottle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        {(stats.topSelling || []).slice(0, 4).map((item: InventoryItem) => (
                            <div key={item.id} className="neo-tile p-4 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-extrabold text-slate-800 truncate">{item.name}</p>
                                    <p className="text-xs text-slate-500 mt-1 truncate">{item.category}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-extrabold text-amber-600 uppercase tracking-[0.16em]">{item.sales || 0} sold</p>
                                    <p className="text-[11px] text-slate-400 mt-1">{settings.currencySymbol}{Number(item.retailPrice || 0).toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                        {(!stats.topSelling || stats.topSelling.length === 0) && (
                            <div className="neo-tile p-5 text-sm text-slate-500">No sales data available yet.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
