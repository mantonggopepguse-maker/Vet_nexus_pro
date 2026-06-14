import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/apiService';
import { User, ClinicSettings, QueueEntry, Department } from '../../types';
import { toast } from 'sonner';
import {
  ListOrdered, Clock, Users, CheckCircle2, XCircle, ArrowRight,
  Phone, Play, UserCheck, AlertTriangle, Search, RefreshCw, Plus,
  ChevronRight, Timer, Building2, Filter
} from 'lucide-react';

interface PatientQueueProps {
  currentUser: User | null;
  settings: ClinicSettings | null;
  onViewPatient: (patientId: string) => void;
}

interface QueueStats {
  total: number;
  waiting: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  avgWaitMinutes: number;
}

interface AddToQueueModal {
  show: boolean;
  searchQuery: string;
  searchResults: any[];
  selectedPatient: any | null;
  departmentId: string;
  reason: string;
  priority: 'Normal' | 'Urgent' | 'Emergency';
}

const PatientQueue: React.FC<PatientQueueProps> = ({ currentUser, settings, onViewPatient }) => {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<QueueStats>({ total: 0, waiting: 0, inProgress: 0, completed: 0, cancelled: 0, avgWaitMinutes: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [transferModal, setTransferModal] = useState<{ show: boolean; entryId: string; currentDeptId: string }>({ show: false, entryId: '', currentDeptId: '' });
  const [addModal, setAddModal] = useState<AddToQueueModal>({
    show: false, searchQuery: '', searchResults: [], selectedPatient: null,
    departmentId: '', reason: '', priority: 'Normal'
  });

  const currencySymbol = settings?.currencySymbol || '₦';

  const fetchData = useCallback(async () => {
    try {
      const [queueData, deptData, statsData] = await Promise.all([
        api.queue.getToday(),
        api.departments.getAll(),
        api.queue.getStats()
      ]);
      setEntries(queueData);
      setDepartments(deptData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch queue data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Ensure default department exists on first load
  useEffect(() => {
    api.departments.ensureDefault().catch(() => {});
  }, []);

  const getWaitTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const handleCall = async (id: string) => {
    try {
      await api.queue.call(id);
      toast.success('Patient called — you are now assigned');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to call patient');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.queue.complete(id);
      toast.success('Consultation completed');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete');
    }
  };

  const handleCancel = async (id: string, type: 'Cancelled' | 'NoShow') => {
    try {
      await api.queue.cancel(id, type);
      toast.success(type === 'NoShow' ? 'Marked as no-show' : 'Queue entry cancelled');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  };

  const handleTransfer = async () => {
    if (!transferModal.entryId) return;
    const deptId = (document.getElementById('transfer-dept-select') as HTMLSelectElement)?.value;
    if (!deptId) return toast.error('Select a department');
    try {
      await api.queue.transfer(transferModal.entryId, deptId);
      toast.success('Patient transferred');
      setTransferModal({ show: false, entryId: '', currentDeptId: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to transfer');
    }
  };

  const handleSearchPatients = async (query: string) => {
    setAddModal(m => ({ ...m, searchQuery: query }));
    if (query.length < 2) {
      setAddModal(m => ({ ...m, searchResults: [] }));
      return;
    }
    try {
      const results = await api.patients.getAll();
      const filtered = results.filter((p: any) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.owner?.firstName?.toLowerCase().includes(query.toLowerCase()) ||
        p.owner?.lastName?.toLowerCase().includes(query.toLowerCase())
      );
      setAddModal(m => ({ ...m, searchResults: filtered.slice(0, 10) }));
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleAddToQueue = async () => {
    if (!addModal.selectedPatient) return toast.error('Select a patient');
    try {
      await api.queue.add({
        patientId: addModal.selectedPatient.id,
        clientId: addModal.selectedPatient.ownerId || undefined,
        departmentId: addModal.departmentId || undefined,
        reason: addModal.reason || undefined,
        priority: addModal.priority
      });
      toast.success(`${addModal.selectedPatient.name} added to queue`);
      setAddModal({ show: false, searchQuery: '', searchResults: [], selectedPatient: null, departmentId: '', reason: '', priority: 'Normal' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add to queue');
    }
  };

  // Filter entries
  const filteredEntries = entries.filter(e => {
    // Status filter
    if (statusFilter === 'active' && (e.status === 'Completed' || e.status === 'Cancelled' || e.status === 'NoShow')) return false;
    if (statusFilter === 'Waiting' && e.status !== 'Waiting') return false;
    if (statusFilter === 'InProgress' && e.status !== 'InProgress') return false;
    if (statusFilter === 'Completed' && e.status !== 'Completed') return false;
    // Department filter
    if (departmentFilter && e.departmentId !== departmentFilter) return false;
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.patient?.name?.toLowerCase().includes(q) ||
        e.client?.firstName?.toLowerCase().includes(q) ||
        e.client?.lastName?.toLowerCase().includes(q) ||
        e.reason?.toLowerCase().includes(q);
    }
    return true;
  });

  const statusColors: Record<string, string> = {
    Waiting: '#f59e0b',
    InProgress: '#3b82f6',
    Completed: '#10b981',
    Cancelled: '#6b7280',
    NoShow: '#ef4444',
  };

  const priorityConfig: Record<string, { color: string; label: string; bg: string }> = {
    Normal: { color: '#6b7280', label: 'Normal', bg: 'transparent' },
    Urgent: { color: '#f59e0b', label: 'Urgent', bg: 'rgba(245,158,11,0.12)' },
    Emergency: { color: '#ef4444', label: 'Emergency', bg: 'rgba(239,68,68,0.12)' },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: '#7c3aed' }} />
          <p style={{ marginTop: 12, color: '#9ca3af' }}>Loading queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f3f4f6', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ListOrdered size={28} style={{ color: '#7c3aed' }} />
            Patient Queue
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 4 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => fetchData()}
            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, padding: '8px 14px', color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setAddModal(m => ({ ...m, show: true }))}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: 10, padding: '8px 18px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
          >
            <Plus size={15} /> Add to Queue
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Today', value: stats.total, icon: Users, color: '#7c3aed' },
          { label: 'Waiting', value: stats.waiting, icon: Clock, color: '#f59e0b' },
          { label: 'In Progress', value: stats.inProgress, icon: Play, color: '#3b82f6' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: '#10b981' },
          { label: 'Avg Wait', value: `${stats.avgWaitMinutes}m`, icon: Timer, color: '#8b5cf6' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${stat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <stat.icon size={20} style={{ color: stat.color }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f3f4f6' }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', letterSpacing: 0.3 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status tabs */}
        {[
          { key: 'active', label: 'Active', count: stats.waiting + stats.inProgress },
          { key: 'Waiting', label: 'Waiting', count: stats.waiting },
          { key: 'InProgress', label: 'In Progress', count: stats.inProgress },
          { key: 'Completed', label: 'Completed', count: stats.completed },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            style={{
              padding: '7px 16px', borderRadius: 20, border: '1px solid',
              borderColor: statusFilter === tab.key ? '#7c3aed' : 'rgba(255,255,255,0.1)',
              background: statusFilter === tab.key ? 'rgba(124,58,237,0.15)' : 'transparent',
              color: statusFilter === tab.key ? '#a78bfa' : '#9ca3af',
              fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
            <span style={{ background: statusFilter === tab.key ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)', padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
              {tab.count}
            </span>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Department filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={14} style={{ color: '#9ca3af' }} />
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', color: '#d1d5db', fontSize: 13, cursor: 'pointer' }}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
          <input
            type="text"
            placeholder="Search queue..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px 6px 32px', color: '#d1d5db', fontSize: 13, width: 180 }}
          />
        </div>
      </div>

      {/* Queue List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
            <ListOrdered size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: 16, marginBottom: 4 }}>No patients in queue</p>
            <p style={{ fontSize: 13 }}>Click "Add to Queue" to get started</p>
          </div>
        ) : (
          filteredEntries.map((entry, index) => (
            <div
              key={entry.id}
              style={{
                background: entry.priority === 'Emergency' ? 'rgba(239,68,68,0.06)' : entry.priority === 'Urgent' ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${entry.priority === 'Emergency' ? 'rgba(239,68,68,0.2)' : entry.priority === 'Urgent' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                transition: 'all 0.2s',
                opacity: (entry.status === 'Completed' || entry.status === 'Cancelled' || entry.status === 'NoShow') ? 0.5 : 1,
              }}
            >
              {/* Queue Number */}
              <div style={{
                minWidth: 52, height: 52, borderRadius: 14,
                background: `${statusColors[entry.status] || '#6b7280'}18`,
                border: `2px solid ${statusColors[entry.status] || '#6b7280'}40`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, lineHeight: 1 }}>Q</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: statusColors[entry.status] || '#6b7280', lineHeight: 1.1 }}>
                  {String(entry.queueNumber).padStart(3, '0')}
                </span>
              </div>

              {/* Patient Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span
                    onClick={() => onViewPatient(entry.patientId)}
                    style={{ fontWeight: 600, color: '#f3f4f6', fontSize: 15, cursor: 'pointer', textDecoration: 'none' }}
                    onMouseEnter={e => (e.target as HTMLElement).style.color = '#a78bfa'}
                    onMouseLeave={e => (e.target as HTMLElement).style.color = '#f3f4f6'}
                  >
                    {entry.patient?.name}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    {entry.patient?.species}{entry.patient?.breed ? `, ${entry.patient.breed}` : ''}
                  </span>
                  {entry.priority !== 'Normal' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: priorityConfig[entry.priority].bg,
                      color: priorityConfig[entry.priority].color,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                      animation: entry.priority === 'Emergency' ? 'pulse 2s infinite' : 'none',
                    }}>
                      {entry.priority === 'Emergency' ? '🔴 ' : '⚠ '}{entry.priority}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#9ca3af' }}>
                  {entry.client && (
                    <span>Owner: {entry.client.firstName} {entry.client.lastName}</span>
                  )}
                  {entry.reason && (
                    <span style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 12 }}>
                      {entry.reason}
                    </span>
                  )}
                </div>
              </div>

              {/* Department badge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '2px 10px', borderRadius: 6 }}>
                  {entry.department?.name}
                </span>
                {/* Status badge */}
                <span style={{ fontSize: 11, fontWeight: 600, color: statusColors[entry.status], display: 'flex', alignItems: 'center', gap: 4 }}>
                  {entry.status === 'Waiting' && <><Clock size={11} /> Waiting · {getWaitTime(entry.createdAt)}</>}
                  {entry.status === 'InProgress' && <><Play size={11} /> With {entry.assignedTo?.name || 'Doctor'}</>}
                  {entry.status === 'Completed' && <><CheckCircle2 size={11} /> Completed</>}
                  {entry.status === 'Cancelled' && <><XCircle size={11} /> Cancelled</>}
                  {entry.status === 'NoShow' && <><XCircle size={11} /> No-Show</>}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6 }}>
                {entry.status === 'Waiting' && (
                  <>
                    <button
                      onClick={() => handleCall(entry.id)}
                      title="Call patient"
                      style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '7px 14px', color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Phone size={13} /> Call
                    </button>
                    <button
                      onClick={() => handleCancel(entry.id, 'NoShow')}
                      title="Mark as no-show"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '7px 10px', color: '#f87171', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <XCircle size={13} /> Skip
                    </button>
                  </>
                )}
                {entry.status === 'InProgress' && (
                  <>
                    <button
                      onClick={() => handleComplete(entry.id)}
                      style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '7px 14px', color: '#34d399', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <CheckCircle2 size={13} /> Complete
                    </button>
                    <button
                      onClick={() => setTransferModal({ show: true, entryId: entry.id, currentDeptId: entry.departmentId })}
                      title="Transfer to another department"
                      style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: '7px 10px', color: '#a78bfa', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <ArrowRight size={13} /> Transfer
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Transfer Modal */}
      {transferModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e1e2e', borderRadius: 16, padding: 28, width: 400, border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#f3f4f6', fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>Transfer Patient</h3>
            <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Select Department</label>
            <select
              id="transfer-dept-select"
              defaultValue=""
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', color: '#d1d5db', fontSize: 14, marginBottom: 20 }}
            >
              <option value="" disabled>Choose department...</option>
              {departments.filter(d => d.id !== transferModal.currentDeptId).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setTransferModal({ show: false, entryId: '', currentDeptId: '' })}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}
              >Cancel</button>
              <button
                onClick={handleTransfer}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >Transfer</button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Queue Modal */}
      {addModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e1e2e', borderRadius: 16, padding: 28, width: 480, border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#f3f4f6', fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} style={{ color: '#7c3aed' }} />
              Add to Queue
            </h3>

            {/* Patient Search */}
            <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Patient *</label>
            {addModal.selectedPatient ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <div>
                  <div style={{ color: '#f3f4f6', fontWeight: 600, fontSize: 14 }}>{addModal.selectedPatient.name}</div>
                  <div style={{ color: '#9ca3af', fontSize: 12 }}>
                    {addModal.selectedPatient.species}{addModal.selectedPatient.breed ? ` · ${addModal.selectedPatient.breed}` : ''}
                    {addModal.selectedPatient.owner && ` · Owner: ${addModal.selectedPatient.owner.firstName} ${addModal.selectedPatient.owner.lastName}`}
                  </div>
                </div>
                <button onClick={() => setAddModal(m => ({ ...m, selectedPatient: null, searchQuery: '' }))}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                  <input
                    type="text"
                    placeholder="Search by patient or owner name..."
                    value={addModal.searchQuery}
                    onChange={e => handleSearchPatients(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px 10px 34px', color: '#d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                    autoFocus
                  />
                </div>
                {addModal.searchResults.length > 0 && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {addModal.searchResults.map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => setAddModal(m => ({ ...m, selectedPatient: p, searchResults: [], searchQuery: '' }))}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div>
                          <div style={{ color: '#f3f4f6', fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>{p.species}{p.breed ? ` · ${p.breed}` : ''}</div>
                        </div>
                        {p.owner && (
                          <div style={{ color: '#9ca3af', fontSize: 11, textAlign: 'right' }}>
                            {p.owner.firstName} {p.owner.lastName}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Department */}
            <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Department</label>
            <select
              value={addModal.departmentId}
              onChange={e => setAddModal(m => ({ ...m, departmentId: e.target.value }))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', color: '#d1d5db', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
            >
              <option value="">Default (General Clinic)</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.isDefault ? ' (Default)' : ''}</option>
              ))}
            </select>

            {/* Reason */}
            <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Visit Reason</label>
            <input
              type="text"
              placeholder="e.g., Annual checkup, vaccination, skin issue..."
              value={addModal.reason}
              onChange={e => setAddModal(m => ({ ...m, reason: e.target.value }))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', color: '#d1d5db', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
            />

            {/* Priority */}
            <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Priority</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {(['Normal', 'Urgent', 'Emergency'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setAddModal(m => ({ ...m, priority: p }))}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${addModal.priority === p ? priorityConfig[p].color : 'rgba(255,255,255,0.1)'}`,
                    background: addModal.priority === p ? priorityConfig[p].bg : 'transparent',
                    color: addModal.priority === p ? priorityConfig[p].color : '#9ca3af',
                    transition: 'all 0.2s'
                  }}
                >
                  {p === 'Emergency' ? '🔴 ' : p === 'Urgent' ? '⚠ ' : ''}{p}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAddModal({ show: false, searchQuery: '', searchResults: [], selectedPatient: null, departmentId: '', reason: '', priority: 'Normal' })}
                style={{ padding: '9px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}
              >Cancel</button>
              <button
                onClick={handleAddToQueue}
                disabled={!addModal.selectedPatient}
                style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: addModal.selectedPatient ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.1)', color: addModal.selectedPatient ? '#fff' : '#6b7280', cursor: addModal.selectedPatient ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}
              >Add to Queue</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PatientQueue;
