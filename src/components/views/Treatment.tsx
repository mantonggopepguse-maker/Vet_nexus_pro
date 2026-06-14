import React, { useState } from 'react';
import { TreatmentRecords } from './TreatmentRecords';
import { NewTreatmentForm } from '../forms/NewTreatmentForm';
import { Client, Pet, ClinicSettings, Procedure, ViewState, User } from '../../types';
import { syncService } from '../../services/syncService';
import { api } from '../../services/apiService';
import { toast } from 'sonner';

interface TreatmentProps {
  clients: Client[];
  patients: Pet[];
  settings: ClinicSettings;
  procedures: Procedure[];
  currentUser: User | null;
}

export const Treatment: React.FC<TreatmentProps> = ({ clients, patients, settings, procedures, currentUser }) => {
  const [viewState, setViewState] = useState<ViewState>('LIST');
  const [editingTreatment, setEditingTreatment] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCreateNew = () => {
    setEditingTreatment(null);
    setViewState('NEW_TREATMENT');
  };

  const handleBack = () => {
    setEditingTreatment(null);
    setViewState('LIST');
  };

  const handleEditTreatment = (treatment: any) => {
    setEditingTreatment(treatment);
    setViewState('NEW_TREATMENT');
  };

  const handleDeleteTreatment = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this treatment record?')) return;
    try {
      await syncService.deleteTreatment(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to delete treatment:', error);
      toast.error('Failed to delete treatment');
    }
  };

  const handleSaveTreatment = async (treatmentData: any, action?: 'DRAFT' | 'INVOICE' | 'RECEIPT' | 'SAVE') => {
    try {
      const isCopy = treatmentData.saveAsCopy === true;
      const updatedData = { ...treatmentData };
      if (!isCopy) {
        updatedData.id = editingTreatment?.id;
      }
      delete updatedData.saveAsCopy;
      if (action === 'DRAFT') {
         updatedData.status = 'Draft';
      }
      
      // The backend POST /treatments now handles everything atomically:
      // treatment + medications + procedures + hospitalization + prescriptions + appointment
      await syncService.saveTreatment(updatedData);

      toast.success(editingTreatment ? 'Treatment updated successfully!' : 'Treatment saved successfully!');
      
      if (treatmentData.hospitalization && treatmentData.hospitalization.kennelId) {
        toast.success('Patient admitted to ward — medications copied to ICU prescriptions.', { duration: 5000 });
      }
      if (treatmentData.nextAppointment && treatmentData.nextAppointment.date) {
        toast.success('Follow-up appointment scheduled.', { duration: 4000 });
      }

      setViewState('LIST');
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Failed to save treatment:', error);
      toast.error(`Failed to save treatment: ${error.message}`);
    }
  };

  if (viewState === 'NEW_TREATMENT') {
    return (
      <NewTreatmentForm
        key={editingTreatment?.id || 'new'}
        clients={clients}
        patients={patients}
        settings={settings}
        procedures={procedures}
        currentUser={currentUser}
        onBack={handleBack}
        onSave={handleSaveTreatment}
        initialData={editingTreatment}
      />
    );
  }

  return (
    <TreatmentRecords
      clients={clients}
      patients={patients}
      settings={settings}
      procedures={procedures}
      onCreateNew={handleCreateNew}
      onEdit={handleEditTreatment}
      onDelete={handleDeleteTreatment}
      refreshTrigger={refreshTrigger}
    />
  );
};



