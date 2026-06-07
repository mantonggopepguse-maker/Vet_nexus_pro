import React, { useState, useEffect } from 'react';
import { User, ClinicSettings } from '../../types';
import { Calendar, Clock, Plus, ChevronLeft, ChevronRight, X, Trash2, Filter, Download } from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';

interface Shift {
    id: string;
    staffId: string;
    startTime: string;
    endTime: string;
    type: string;
    notes?: string;
    staff: { id: string; name: string; avatarUrl?: string };
}

interface ShiftTimetableProps {
    settings: ClinicSettings;
    onBack?: () => void;
}

export const ShiftTimetable: React.FC<ShiftTimetableProps> = ({ settings }) => {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [staff, setStaff] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState<Partial<Shift> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Get week dates
    const getWeekDates = (date: Date) => {
        const start = new Date(date);
        start.setDate(date.getDate() - date.getDay());
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    };

    const weekDates = getWeekDates(currentDate);

    useEffect(() => {
        loadData();
    }, [currentDate]);

    const loadData = async () => {
        setLoading(true);
        try {
            const start = weekDates[0].toISOString();
            const end = weekDates[6].toISOString();
            const [shiftsSnap, staffSnap] = await Promise.all([
                api.shifts.getAll(start, end),
                api.staff.getAll().catch(() => [])
            ]);
            setShifts(shiftsSnap);
            setStaff(staffSnap);
        } catch (error) {
            console.error("Failed to load roster data", error);
            toast.error("Failed to load timetable");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveShift = async () => {
        if (!editingShift?.staffId || !editingShift?.startTime || !editingShift?.endTime) {
            toast.error("Please fill in all required fields");
            return;
        }

        setIsSaving(true);
        try {
            if (editingShift.id) {
                await api.shifts.update(editingShift.id, editingShift);
                toast.success("Shift updated");
            } else {
                await api.shifts.create(editingShift);
                toast.success("Shift scheduled");
            }
            loadData();
            setIsModalOpen(false);
        } catch (error) {
            toast.error("Failed to save shift");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteShift = async (id: string) => {
        if (!confirm("Remove this shift?")) return;
        try {
            await api.shifts.delete(id);
            toast.success("Shift removed");
            loadData();
        } catch (error) {
            toast.error("Failed to delete shift");
        }
    };

    const navigateWeek = (direction: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() + (direction * 7));
        setCurrentDate(newDate);
    };

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getShiftsForDay = (date: Date) => {
        return shifts.filter(s => {
            const shiftDate = new Date(s.startTime);
            return shiftDate.getDate() === date.getDate() &&
                   shiftDate.getMonth() === date.getMonth() &&
                   shiftDate.getFullYear() === date.getFullYear();
        });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-amber-600" />
                        Shift Timetable
                    </h1>
                    <p className="text-slate-400 font-bold mt-1 uppercase text-xs tracking-widest">
                        Roster management for {settings.name}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-amber-200 text-slate-500 transition-all">
                        <Download className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => {
                            setEditingShift({
                                startTime: new Date().toISOString(),
                                endTime: new Date(Date.now() + 8 * 3600000).toISOString(),
                                type: 'Day'
                            });
                            setIsModalOpen(true);
                        }}
                        className="soft-btn-primary px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-amber-100"
                    >
                        <Plus className="w-5 h-5" /> Schedule Shift
                    </button>
                </div>
            </div>

            {/* Navigation & Controls */}
            <div className="flex items-center justify-between bg-white/50 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-inner">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm">
                        <ChevronLeft className="w-6 h-6 text-slate-600" />
                    </button>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight">
                        {weekDates[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </h2>
                    <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm">
                        <ChevronRight className="w-6 h-6 text-slate-600" />
                    </button>
                    <button 
                        onClick={() => setCurrentDate(new Date())}
                        className="text-xs font-black text-amber-600 hover:bg-white px-3 py-1.5 rounded-lg transition-all"
                    >
                        Today
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400 mr-2" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">All Staff</span>
                </div>
            </div>

            {/* Timetable Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
                {weekDates.map((date, idx) => {
                    const dayShifts = getShiftsForDay(date);
                    const isToday = new Date().toDateString() === date.toDateString();
                    
                    return (
                        <div key={idx} className={`flex flex-col min-h-[500px] ${isToday ? 'bg-amber-50/30' : 'bg-slate-50/20'} rounded-[2.5rem] border ${isToday ? 'border-amber-200' : 'border-slate-100'} p-4 transition-all duration-500`}>
                            <div className="text-center mb-6">
                                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-amber-500' : 'text-slate-400'}`}>
                                    {date.toLocaleDateString('default', { weekday: 'short' })}
                                </p>
                                <p className={`text-2xl font-black mt-1 ${isToday ? 'text-amber-600' : 'text-slate-700'}`}>
                                    {date.getDate()}
                                </p>
                                {isToday && <div className="w-1 h-1 bg-amber-600 rounded-full mx-auto mt-2" />}
                            </div>

                            <div className="space-y-4 flex-1">
                                {dayShifts.map(shift => (
                                    <div 
                                        key={shift.id}
                                        onClick={() => {
                                            setEditingShift(shift);
                                            setIsModalOpen(true);
                                        }}
                                        className={`group premium-glass-neo p-4 rounded-[2rem] border cursor-pointer hover:border-amber-300 transition-all duration-300 relative overflow-hidden ${
                                            shift.type === 'Night' ? 'bg-amber-900/5' : 'bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            {shift.staff.avatarUrl ? (
                                                <img src={shift.staff.avatarUrl} className="w-8 h-8 rounded-xl object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">
                                                    {shift.staff.name.charAt(0)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-slate-800 truncate">{shift.staff.name}</p>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${
                                                    shift.type === 'Day' ? 'bg-amber-100 text-amber-600' : 
                                                    shift.type === 'Night' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {shift.type}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <Clock className="w-3 h-3" />
                                            <span className="text-[10px] font-bold">{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</span>
                                        </div>
                                    </div>
                                ))}
                                {dayShifts.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center opacity-10 py-10">
                                        <div className="border-2 border-dashed border-slate-900 rounded-full w-12 h-12 flex items-center justify-center">
                                            <Clock className="w-6 h-6" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Shift Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 border border-white/50">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{editingShift?.id ? 'Edit Shift' : 'Schedule Shift'}</h3>
                                <p className="text-sm text-slate-500 font-bold">Manage clinician availability</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 shadow-sm">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Select Staff</label>
                                    <select 
                                        value={editingShift?.staffId || ''}
                                        onChange={e => setEditingShift({...editingShift!, staffId: e.target.value})}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                                    >
                                        <option value="">Select Clinician</option>
                                        {staff.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Shift Type</label>
                                        <select 
                                            value={editingShift?.type || 'Day'}
                                            onChange={e => setEditingShift({...editingShift!, type: e.target.value})}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                                        >
                                            <option value="Day">Day Shift</option>
                                            <option value="Night">Night Shift</option>
                                            <option value="Swing">Swing Shift</option>
                                            <option value="Emergency">Emergency On-Call</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Status</label>
                                        <div className="flex h-[58px] items-center px-6 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2" />
                                            <span className="text-sm font-black text-slate-700 uppercase tracking-tighter">Confirmed</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Start Time</label>
                                        <input 
                                            type="datetime-local" 
                                            value={editingShift?.startTime?.slice(0, 16)}
                                            onChange={e => setEditingShift({...editingShift!, startTime: new Date(e.target.value).toISOString()})}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">End Time</label>
                                        <input 
                                            type="datetime-local" 
                                            value={editingShift?.endTime?.slice(0, 16)}
                                            onChange={e => setEditingShift({...editingShift!, endTime: new Date(e.target.value).toISOString()})}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Handoff Instructions / Notes</label>
                                    <textarea 
                                        value={editingShift?.notes || ''}
                                        onChange={e => setEditingShift({...editingShift!, notes: e.target.value})}
                                        placeholder="Add special instructions for the clinician..."
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-amber-500/10 outline-none transition-all min-h-[100px]"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-6">
                                {editingShift?.id && (
                                    <button 
                                        onClick={() => handleDeleteShift(editingShift.id!)}
                                        className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all border border-rose-100"
                                    >
                                        <Trash2 className="w-6 h-6" />
                                    </button>
                                )}
                                <button 
                                    onClick={handleSaveShift}
                                    disabled={isSaving}
                                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all disabled:opacity-50"
                                >
                                    {isSaving ? 'Scheduling...' : (editingShift?.id ? 'Save Changes' : 'Schedule Shift')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
