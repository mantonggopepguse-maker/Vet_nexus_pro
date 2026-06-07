import React, { useState } from 'react';
import { CalendarDays, Plus, User, Phone, Mail, MapPin, Save, ChevronDown, List, Filter, Edit, Trash2, CheckCircle, XCircle, Clock as ClockIcon, Zap } from 'lucide-react';
import { Client, Procedure, ClinicSettings, Appointment as AppointmentType, AppointmentStatus } from '../../types';
import { formatDateOnly, toLocalDateInputValue } from '../../utils/date';

interface AppointmentProps {
  clients: Client[];
  procedures: Procedure[];
  settings: ClinicSettings;
  appointments: AppointmentType[];
  onSave: (appointmentData: any) => void;
  onUpdate: (appointment: AppointmentType) => void;
  onDelete: (id: string) => void;
}

export const Appointment: React.FC<AppointmentProps> = ({ clients, procedures, settings, appointments, onSave, onUpdate, onDelete }) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState(toLocalDateInputValue());
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | 'all'>('all');
  const [filterClient, setFilterClient] = useState('');
  const [editingAppointment, setEditingAppointment] = useState<AppointmentType | null>(null);

  // Form state for new/edit appointments
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProcedureId, setSelectedProcedureId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');

  // Manual client input
  const [isManualClient, setIsManualClient] = useState(false);
  const [manualClient, setManualClient] = useState<Required<Pick<AppointmentType, 'manualClient'>>['manualClient']>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: ''
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedProcedure = procedures.find(p => p.id === selectedProcedureId);
  const activeProcedures = procedures.filter(p => p.status === 'Active');

  // Filter appointments based on current filters
  const filteredAppointments = appointments.filter(appointment => {
    if (filterStatus !== 'all' && appointment.status !== filterStatus) return false;
    if (filterClient && appointment.clientId !== filterClient) return false;
    return true;
  });

  // Get appointments for selected date
  const appointmentsForDate = filteredAppointments.filter(appointment => appointment.date === selectedDate);

  // Get status color
  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Confirmed': return 'bg-blue-100 text-blue-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const appointmentData = {
      clientId: isManualClient ? null : selectedClientId,
      manualClient: isManualClient ? manualClient : null,
      procedureId: selectedProcedureId,
      date: appointmentDate,
      time: appointmentTime,
      notes,
      status: 'Pending' as AppointmentStatus,
      staffId: assignedStaffId || undefined
    };

    if (editingAppointment) {
      await onUpdate({ ...editingAppointment, ...appointmentData });
      setEditingAppointment(null);
    } else {
      await onSave(appointmentData);
    }

    setSelectedDate(appointmentDate);
    // Reset form
    resetForm();
  };

  const resetForm = () => {
    setSelectedClientId('');
    setSelectedProcedureId('');
    setAppointmentDate('');
    setAppointmentTime('');
    setNotes('');
    setAssignedStaffId('');
    setIsManualClient(false);
    setManualClient({ firstName: '', lastName: '', email: '', phone: '', address: '' });
  };

  const handleEdit = (appointment: AppointmentType) => {
    setEditingAppointment(appointment);
    setSelectedClientId(appointment.clientId || '');
    setSelectedProcedureId(appointment.procedureId);
    setAppointmentDate(appointment.date);
    setAppointmentTime(appointment.time);
    setNotes(appointment.notes || '');
    setAssignedStaffId(appointment.staffId || '');
    setIsManualClient(!appointment.clientId);
    if (appointment.manualClient) {
      setManualClient(appointment.manualClient);
    }
  };

  const handleCancelEdit = () => {
    setEditingAppointment(null);
    resetForm();
  };

  const handleStatusChange = async (appointment: AppointmentType, newStatus: AppointmentStatus) => {
    await onUpdate({ ...appointment, status: newStatus });
  };


  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Appointments</h1>
            <p className="text-blue-500 text-sm font-bold">Manage appointments and schedule</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-lg font-medium ${viewMode === 'calendar' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
          >
            <CalendarDays className="w-4 h-4 inline mr-2" />
            Calendar
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg font-medium ${viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
          >
            <List className="w-4 h-4 inline mr-2" />
            List
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: { view: 'AI_HUB', tab: 'OPERATIONS' } }))}
            className="px-4 py-2 rounded-lg font-black text-amber-600 bg-amber-50 border border-amber-100 flex items-center gap-2 shadow-sm hover:bg-amber-100 transition"
          >
            <Zap className="w-4 h-4" />
            AI Audit
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="soft-card p-4 border-t-4 border-blue-400">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-700">Filters:</span>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as AppointmentStatus | 'all')}
            className="soft-input px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="soft-input px-3 py-2 text-sm"
          >
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar/List Section */}
        <div className="xl:col-span-2 space-y-6">
          {viewMode === 'calendar' ? (
            <div className="soft-card p-6 border-t-4 border-blue-400">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-slate-700 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-400" />
                  Appointments for {formatDateOnly(selectedDate)}
                </h2>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="soft-input px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-3">
                {appointmentsForDate.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <CalendarDays className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p>No appointments for this date</p>
                  </div>
                ) : (
                  appointmentsForDate.map(appointment => {
                    const client = appointment.client || (appointment.manualClient ? {
                      firstName: appointment.manualClient.firstName,
                      lastName: appointment.manualClient.lastName,
                      phone: appointment.manualClient.phone
                    } : null);
                    const procedure = procedures.find(p => p.id === appointment.procedureId);

                    return (
                      <div key={appointment.id} className="p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <ClockIcon className="w-4 h-4 text-slate-400" />
                              <span className="font-semibold text-slate-700">{appointment.time}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                                {appointment.status}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-slate-800">
                                {client ? `${client.firstName} ${client.lastName}` : 'Unknown Client'}
                              </p>
                              <p className="text-sm text-slate-600">
                                {procedure?.name || 'Unknown Procedure'}
                              </p>
                              {appointment.notes && (
                                <p className="text-xs text-slate-500">{appointment.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(appointment)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <select
                              value={appointment.status}
                              onChange={(e) => handleStatusChange(appointment, e.target.value as AppointmentStatus)}
                              className="text-xs p-1 border rounded"
                            >
                              <option value="Pending">Pending</option>
                              <option value="Confirmed">Confirmed</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                            <button
                              onClick={() => onDelete(appointment.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="soft-card p-6 border-t-4 border-blue-400">
              <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <List className="w-5 h-5 text-blue-400" />
                All Appointments ({filteredAppointments.length})
              </h2>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredAppointments.map(appointment => {
                  const client = appointment.client || (appointment.manualClient ? {
                    firstName: appointment.manualClient.firstName,
                    lastName: appointment.manualClient.lastName,
                    phone: appointment.manualClient.phone
                  } : null);
                  const procedure = procedures.find(p => p.id === appointment.procedureId);

                  return (
                    <div key={appointment.id} className="p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-slate-700">{formatDateOnly(appointment.date)} at {appointment.time}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                              {appointment.status}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <p className="font-medium text-slate-800">
                              {client ? `${client.firstName} ${client.lastName}` : 'Unknown Client'}
                            </p>
                            <p className="text-sm text-slate-600">
                              {procedure?.name || 'Unknown Procedure'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(appointment)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <select
                            value={appointment.status}
                            onChange={(e) => handleStatusChange(appointment, e.target.value as AppointmentStatus)}
                            className="text-xs p-1 border rounded"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                          <button
                            onClick={() => onDelete(appointment.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Form Section */}
        <div className="xl:col-span-1">
          <form onSubmit={handleSubmit} className="soft-card p-6 space-y-6 border-t-4 border-blue-400">
            <h2 className="text-xl font-bold text-slate-700">
              {editingAppointment ? 'Edit Appointment' : 'New Appointment'}
            </h2>

            {/* Client Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-600">Client:</label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="clientType"
                    checked={!isManualClient}
                    onChange={() => setIsManualClient(false)}
                  />
                  Existing
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="clientType"
                    checked={isManualClient}
                    onChange={() => setIsManualClient(true)}
                  />
                  New
                </label>
              </div>

              {!isManualClient ? (
                <div className="space-y-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full soft-input px-3 py-2 text-sm"
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                  <input
                    required
                    type="text"
                    placeholder="First Name"
                    value={manualClient.firstName}
                    onChange={(e) => setManualClient({ ...manualClient, firstName: e.target.value })}
                    className="w-full soft-input px-3 py-2 text-sm"
                  />
                  <input
                    required
                    type="text"
                    placeholder="Last Name"
                    value={manualClient.lastName}
                    onChange={(e) => setManualClient({ ...manualClient, lastName: e.target.value })}
                    className="w-full soft-input px-3 py-2 text-sm"
                  />
                  <input
                    required
                    type="tel"
                    placeholder="Phone"
                    value={manualClient.phone}
                    onChange={(e) => setManualClient({ ...manualClient, phone: e.target.value })}
                    className="w-full soft-input px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Procedure Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Procedure</label>
              <select
                required
                value={selectedProcedureId}
                onChange={(e) => setSelectedProcedureId(e.target.value)}
                className="w-full soft-input px-3 py-2 text-sm"
              >
                <option value="">Select Procedure</option>
                {activeProcedures.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Date and Time */}
            <div className="space-y-3">
              <input
                required
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full soft-input px-3 py-2 text-sm"
              />
              <input
                required
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="w-full soft-input px-3 py-2 text-sm"
              />
            </div>

            {/* Notes */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full soft-input px-3 py-2 text-sm"
              placeholder="Notes..."
            />

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                <Save className="w-4 h-4 inline mr-2" />
                {editingAppointment ? 'Update' : 'Schedule'}
              </button>
              {editingAppointment && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded-lg font-medium bg-gray-500 text-white hover:bg-gray-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div >
  );
};
