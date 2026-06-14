import React, { useState, useEffect } from 'react';
import { Layout } from './components/shared/Layout';
import { InventoryList } from './components/views/InventoryList';
import { AddItemForm } from './components/forms/AddItemForm';
import { Pos } from './components/views/Pos';
import { Settings } from './components/views/Settings';
import { Dashboard } from './components/views/Dashboard';
import { Auth } from './components/views/Auth';
import { ClientList } from './components/views/ClientList';
import { AddClientForm } from './components/forms/AddClientForm';
import { PatientList } from './components/views/PatientList';
import { AddPatientForm } from './components/forms/AddPatientForm';
import { Treatment } from './components/views/Treatment';
import { ProcedureManagement } from './components/views/ProcedureManagement';
import { Appointment } from './components/views/Appointment';
import { StaffManagement } from './components/views/StaffManagement';
import { AuditLog } from './components/views/AuditLog';
import { SuperAdminDashboard } from './components/views/SuperAdminDashboard';
import { ClinicDetails } from './components/views/ClinicDetails';
import { ClientDetails } from './components/views/ClientDetails';
import { PatientDetails } from './components/views/PatientDetails';
import { TransactionHistory } from './components/views/TransactionHistory';
import { FreeInvoice } from './components/views/FreeInvoice';
import { Expenses } from './components/views/Expenses';
import { AddExpenseForm } from './components/forms/AddExpenseForm';
import { ProfitLossReport } from './components/views/ProfitLossReport';
import { ReminderList } from './components/views/ReminderList';
import { AIHub } from './components/views/AIHub';
import { ICUBoard } from './components/views/ICUBoard';
import { ShiftTimetable } from './components/views/ShiftTimetable';
import { Branches } from './components/views/Branches';
import { TriageBoard } from './components/views/TriageBoard';
import { NarcoticsLockbox } from './components/views/NarcoticsLockbox';
import { ClinicalCalculators } from './components/views/ClinicalCalculators';
import { LabHub } from './components/views/LabHub';
import { Hospitalization } from './components/views/Hospitalization';
import PatientQueue from './components/views/PatientQueue';
import { PremiumGate } from './components/shared/PremiumGate';
import { SubscriptionCallback } from './components/views/SubscriptionCallback';
import { InventoryItem, ViewState, AppView, ClinicSettings, Client, Pet, Procedure, User, LogEntry, Appointment as AppointmentType, Expense } from './types';
import { api } from './services/apiService';
import { Toaster, toast } from 'sonner';
import { hasAccess } from './config/permissions';

// Portal Imports
import { PortalLogin } from './components/portal/PortalLogin';
import { PortalDashboard } from './components/portal/PortalDashboard';
import { PortalPetDetails } from './components/portal/PortalPetDetails';
import { PortalClaim } from './components/portal/PortalClaim';

const DEFAULT_SETTINGS: ClinicSettings = {
  name: 'Vet Nexus',
  acronym: 'PV',
  address: '123 Pet Street, Lagos',
  phone: '+234 800 123 4567',
  email: 'contact@vetnexus.com',
  taxEnabled: true,
  taxRate: 7.5,
  bankName: 'First Bank',
  accountName: 'Vet Nexus Clinic Ltd',
  accountNumber: '1234567890',
  currencySymbol: '\u20A6',
  country: 'Nigeria',
  language: 'English',
  useShiftTimetable: false
};

DEFAULT_SETTINGS.currencySymbol = '\u20A6';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [viewState, setViewState] = useState<ViewState>('LIST');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Main Data States - Initialize from Cache if available
  const [clients, setClients] = useState<Client[]>(() => api.getCache<Client[]>('clients', 'page=1&limit=50') || []);
  const [patients, setPatients] = useState<Pet[]>(() => api.getCache<Pet[]>('patients', 'page=1&limit=100') || []);
  const [inventory, setInventory] = useState<InventoryItem[]>(() => api.getCache<InventoryItem[]>('inventory', 'page=1&limit=50&search=') || []);
  const [inventoryStats, setInventoryStats] = useState({ total: 0, lowStock: 0 });
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS);

  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null);
  const [invoiceCount, setInvoiceCount] = useState(0);

  // Portal State
  const [isPortal, setIsPortal] = useState(window.location.pathname.startsWith('/portal'));
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const isPortalInviteRoute = window.location.pathname.startsWith('/portal/invite/');

  // Pagination State
  const [inventoryPage, setInventoryPage] = useState(1);
  const [clientsPage, setClientsPage] = useState(1);
  const [patientsPage, setPatientsPage] = useState(1);
  const [hasMoreInventory, setHasMoreInventory] = useState(true);
  const [hasMoreClients, setHasMoreClients] = useState(true);
  const [hasMorePatients, setHasMorePatients] = useState(true);
  const [loadingMoreInventory, setLoadingMoreInventory] = useState(false);
  const [loadingMoreClients, setLoadingMoreClients] = useState(false);
  const [loadingMorePatients, setLoadingMorePatients] = useState(false);
  const [expensesPage, setExpensesPage] = useState(1);
  const [hasMoreExpenses, setHasMoreExpenses] = useState(true);
  const [loadingMoreExpenses, setLoadingMoreExpenses] = useState(false);
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');

  const [aiContext, setAiContext] = useState<{ tab?: 'SCRIBE' | 'CLIENT' | 'OPERATIONS' | 'LOGS'; patientId?: string }>({});

  // Apply foundation colors based on view
  useEffect(() => {
    const root = document.documentElement;
    let foundation = '#F8FAFC'; // Default

    switch (currentView) {
      case 'DASHBOARD':
        foundation = 'var(--aura-dashboard)';
        break;
      case 'PATIENTS':
      case 'PATIENT_DETAILS':
      case 'TREATMENTS':
      case 'ICU_BOARD':
      case 'HOSPITALIZATION':
      case 'TRIAGE':
        foundation = 'var(--aura-clinical)';
        break;
      case 'POS':
      case 'SALES_HISTORY':
      case 'EXPENSES':
      case 'REPORTS':
        foundation = 'var(--aura-finance)';
        break;
      case 'INVENTORY':
        foundation = 'var(--aura-inventory)';
        break;
      case 'SETTINGS':
      case 'STAFF':
      case 'AUDIT_LOG':
        foundation = 'var(--aura-admin)';
        break;
    }

    root.style.setProperty('--page-foundation', foundation);
  }, [currentView]);

  // Check for persistent login & Navigation listener
  useEffect(() => {
    const handleNavigation = (e: any) => {
      const { view, id, tab, patientId } = e.detail;
      if (view === 'CLIENT_DETAILS') {
        setSelectedClientId(id);
        setCurrentView('CLIENT_DETAILS');
      } else if (view === 'PATIENT_DETAILS') {
        setSelectedPatientId(id);
        setCurrentView('PATIENT_DETAILS');
      } else if (view === 'INVENTORY' && id) {
        setSelectedInventoryId(id);
        setCurrentView('INVENTORY');
      } else if (view === 'AI_HUB') {
        setAiContext({ tab, patientId });
        setCurrentView('AI_HUB');
      }
    };
    window.addEventListener('app-navigate', handleNavigation);

    const userJson = localStorage.getItem('user');
    const clientJson = localStorage.getItem('client');

    if (isPortal) {
      if (isPortalInviteRoute) {
        setCurrentView('PORTAL_INVITE');
      } else if (clientJson) {
        try {
          const client = JSON.parse(clientJson);
          setCurrentClient(client);
          setCurrentView('PORTAL_DASHBOARD');
        } catch (e) {
          handlePortalLogout();
        }
      } else {
        setCurrentView('PORTAL_LOGIN');
      }
    } else if (!userJson && clientJson) {
      window.location.href = '/portal';
    } else if (userJson) {
      try {
        const user = JSON.parse(userJson);
        setCurrentUser(user);
        setIsAuthenticated(true);
        if (user.clinic) {
          setSettings(user.clinic);
        }
        if (user.isSuperAdmin) {
          setCurrentView('SUPER_ADMIN');
        }
      } catch (e) {
        console.error("Failed to parse saved user", e);
        handleLogout();
      }
    }

    return () => {
      window.removeEventListener('app-navigate', handleNavigation);
    };
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    if (isAuthenticated && currentUser && !currentUser.isSuperAdmin) {
      loadData();
    }
  }, [isAuthenticated, currentUser]);

  // If Flutterwave redirects back to /subscription/callback, show verification screen
  if (window.location.pathname === '/subscription/callback' || window.location.pathname.includes('subscription/callback')) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <SubscriptionCallback onSuccess={(user) => {
          localStorage.setItem('user', JSON.stringify(user));
          // Reload to trigger normal auth flow
          window.location.href = '/';
        }} />
      </>
    );
  }

  const loadData = async () => {
    if (!currentUser) return;

    const cacheKey = `clinic_settings_${currentUser.id}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setSettings(JSON.parse(cached));
    } else if (currentUser.clinic) {
      // Fallback to clinic info stored in user profile if cache is missing
      setSettings(currentUser.clinic);
    }

    setLoading(true);
    try {
      const settingsData = await api.settings.get();
      if (settingsData) {
        setSettings(settingsData);
        sessionStorage.setItem(cacheKey, JSON.stringify(settingsData));
      }
    } catch (error: any) {
      console.error("Failed to load settings:", error);
      // If we already have settings from cache or user profile, don't revert to DEFAULT_SETTINGS
      if (error.message === 'Invalid or expired token' || error.message === 'No token provided' || error.message === 'Not authenticated') {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  // Permission Check
  useEffect(() => {
    if (isAuthenticated && currentUser && !currentUser.isSuperAdmin) {
      if (!hasAccess(currentUser, currentView)) {
        toast.error("Access Denied: You don't have permission to view this page.");
        setCurrentView('DASHBOARD');
      }
    }
  }, [currentView, currentUser, isAuthenticated]);

  // View-based Data Loading
  useEffect(() => {
    if (!isAuthenticated || !currentUser || currentUser.isSuperAdmin) return;

    const loadViewData = async () => {
      try {
        switch (currentView) {
          case 'DASHBOARD':
            // Logic handled within Dashboard component
            break;
          case 'INVENTORY':
          case 'POS':
            if (inventory.length === 0 || (currentView === 'POS' && clients.length === 0)) {
              const promises = [];
              if (inventory.length === 0) {
                const limit = currentView === 'POS' ? 1000 : 50;
                promises.push(api.inventory.getAll(1, limit).then(data => {
                  setInventory(data);
                  setHasMoreInventory(data.length === limit);
                }));
                promises.push(api.inventory.getStats().then(data => {
                  setInventoryStats(data);
                }));
              }
              if (currentView === 'POS' && clients.length === 0) promises.push(api.clients.getAll(1, 1000).then(data => {
                setClients(data);
                setHasMoreClients(data.length === 1000); // Increased limit for POS search
              }));
              await Promise.all(promises);
            }
            break;
          case 'CLIENTS':
          case 'CLIENT_DETAILS':
            if (clients.length === 0) {
              const data = await api.clients.getAll(1, 50);
              setClients(data);
              setHasMoreClients(data.length === 50);
            }
            break;
          case 'LAB_HUB':
          case 'PATIENTS':
            const clientEmpty = clients.length === 0;
            const patientEmpty = (currentView === 'PATIENTS' && patients.length === 0) || (currentView === 'LAB_HUB' && patients.length === 0);
            if (clientEmpty || patientEmpty) {
              const promises = [];
              if (patientEmpty) promises.push(api.patients.getAll(1, 50).then(data => {
                setPatients(data);
                setHasMorePatients(data.length === 50);
              }));
              if (clientEmpty) promises.push(api.clients.getAll(1, 50).then(data => {
                setClients(data);
                setHasMoreClients(data.length === 50);
              }));
              await Promise.all(promises);
            }
            break;
          case 'TREATMENTS':
          case 'PROCEDURES':
          case 'APPOINTMENTS':
            if (procedures.length === 0) {
              const procCacheKey = `procedures_${currentUser?.clinicId || 'global'}`;
              const cachedProcs = sessionStorage.getItem(procCacheKey);
              if (cachedProcs) {
                setProcedures(JSON.parse(cachedProcs));
              }
              const data = await api.procedures.getAll();
              setProcedures(data);
              sessionStorage.setItem(procCacheKey, JSON.stringify(data));
            }
            if (currentView === 'TREATMENTS' || currentView === 'APPOINTMENTS') {
              if (clients.length === 0) {
                const data = await api.clients.getAll(1, 50);
                setClients(data);
                setHasMoreClients(data.length === 50);
              }
            }
            if (currentView === 'TREATMENTS' && patients.length === 0) {
              const data = await api.patients.getAll(1, 50);
              setPatients(data);
              setHasMorePatients(data.length === 50);
            }
            if (currentView === 'APPOINTMENTS' && appointments.length === 0) {
              const data = await api.appointments.getAll();
              setAppointments(data);
            }
            break;
          case 'STAFF':
            if (users.length === 0) {
              const data = await api.staff.getAll().catch(() => []);
              setUsers(data);
            }
            break;
          case 'AUDIT_LOG':
            if (logs.length === 0) {
              const data = await api.audit.getAll().catch(() => []);
              setLogs(data);
            }
            break;
          case 'EXPENSES':
            if (expenses.length === 0) {
              const data = await api.expenses.getAll(1, 50);
              setExpenses(data);
              setHasMoreExpenses(data.length === 50);
            }
            break;
          case 'HOSPITALIZATION':
            break;
        }
      } catch (error) {
        console.error(`Failed to load data for view ${currentView}:`, error);
      }
    };

    loadViewData();
  }, [currentView, isAuthenticated]);

  const handleLoadMoreInventory = async () => {
    if (loadingMoreInventory || !hasMoreInventory) return;
    setLoadingMoreInventory(true);
    try {
      const nextPage = inventoryPage + 1;
      const moreItems = await api.inventory.getAll(nextPage, 50, inventorySearchTerm);
      setHasMoreInventory(moreItems.length === 50);
      setInventory(prev => [...prev, ...moreItems]);
      setInventoryPage(nextPage);
    } catch (error) {
      console.error("Failed to load more inventory", error);
    } finally {
      setLoadingMoreInventory(false);
    }
  };

  const handleInventorySearch = async (term: string) => {
    setInventorySearchTerm(term);
    setInventoryPage(1);
    try {
      const data = await api.inventory.getAll(1, 50, term);
      setInventory(data);
      setHasMoreInventory(data.length === 50);
    } catch (error) {
      console.error("Search failed", error);
      toast.error("Search failed");
    }
  };

  const handleLoadMoreClients = async () => {
    if (loadingMoreClients || !hasMoreClients) return;
    setLoadingMoreClients(true);
    try {
      const nextPage = clientsPage + 1;
      const moreClients = await api.clients.getAll(nextPage, 50);
      setHasMoreClients(moreClients.length === 50);
      setClients(prev => [...prev, ...moreClients]);
      setClientsPage(nextPage);
    } catch (error) {
      console.error("Failed to load more clients", error);
    } finally {
      setLoadingMoreClients(false);
    }
  };

  const handleLoadMorePatients = async () => {
    if (loadingMorePatients || !hasMorePatients) return;
    setLoadingMorePatients(true);
    try {
      const nextPage = patientsPage + 1;
      const morePatients = await api.patients.getAll(nextPage, 50);
      setHasMorePatients(morePatients.length === 50);
      setPatients(prev => [...prev, ...morePatients]);
      setPatientsPage(nextPage);
    } catch (error) {
      console.error("Failed to load more patients", error);
    } finally {
      setLoadingMorePatients(false);
    }
  };

  const handleLoadMoreExpenses = async () => {
    if (loadingMoreExpenses || !hasMoreExpenses) return;
    setLoadingMoreExpenses(true);
    try {
      const nextPage = expensesPage + 1;
      const moreExpenses = await api.expenses.getAll(nextPage, 50);
      setHasMoreExpenses(moreExpenses.length === 50);
      setExpenses(prev => [...prev, ...moreExpenses]);
      setExpensesPage(nextPage);
    } catch (error) {
      console.error("Failed to load more expenses", error);
    } finally {
      setLoadingMoreExpenses(false);
    }
  };

  const handleLogin = (user: any) => {
    // Clear any previous session data to be extra safe
    sessionStorage.clear();

    setCurrentUser(user);
    if (user.clinic) {
      setSettings(user.clinic);
    }
    localStorage.setItem('user', JSON.stringify(user));
    setIsAuthenticated(true);
    if (user.isSuperAdmin) {
      setCurrentView('SUPER_ADMIN');
    } else {
      setCurrentView('DASHBOARD');
    }

    // Force a reload to ensure the DB proxy and other services re-initialize with the clinic namespace
    window.location.reload();
  };

  const handleLogout = () => {
    api.auth.logout();
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    sessionStorage.clear(); // Clear namespaced dashboard stats

    setIsAuthenticated(false);
    setCurrentUser(null);
    setInventory([]);
    setClients([]);
    setPatients([]);
    setAppointments([]);
    setInventoryPage(1);
    setClientsPage(1);
    setPatientsPage(1);

    // Force a reload to clear all in-memory proxies and DB instances
    window.location.reload();
  };

  const handlePortalLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('client');
    setCurrentClient(null);
    setCurrentView('PORTAL_LOGIN');
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') toast.success(message);
    else toast.error(message);
  };

  const handleAddItem = async (newItem: Omit<InventoryItem, 'id'>) => {
    setIsSaving(true);
    try {
      const created = await api.inventory.create(newItem);
      setInventory(prev => [created, ...prev]);
      api.inventory.getStats().then(setInventoryStats);
      setViewState('LIST');
      toast.success("Item added successfully");
    } catch (error: any) {
      toast.error(error?.message || error?.error || "Failed to create item");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateItem = async (updatedItem: InventoryItem, skipRedirect: boolean = false) => {
    try {
      const updated = await api.inventory.update(updatedItem);
      setInventory(prev => prev.map(item => item.id === updated.id ? updated : item));
      api.inventory.getStats().then(setInventoryStats);
      if (!skipRedirect) {
        setViewState('LIST');
      }
      toast.success("Item updated");
    } catch (error) {
      toast.error("Failed to update item");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await api.inventory.delete(id);
      setInventory(prev => prev.filter(item => item.id !== id));
      api.inventory.getStats().then(setInventoryStats);
      toast.success("Item deleted");
    } catch (error) {
      toast.error("Failed to delete item");
    }
  };

  const handleAddClient = async (newClient: Omit<Client, 'id' | 'registrationDate'>) => {
    setIsSaving(true);
    try {
      const created = await api.clients.create(newClient);
      setClients(prev => [created, ...prev]);
      setViewState('LIST');
      toast.success("Client added");
    } catch (error) {
      toast.error("Failed to create client");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateClient = async (updatedClient: Client) => {
    setIsSaving(true);
    try {
      const updated = await api.clients.update(updatedClient);
      setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
      setViewState('LIST');
      setCurrentView('CLIENT_DETAILS'); // Return to details after edit
      toast.success("Client updated");
    } catch (error) {
      toast.error("Failed to update client");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPatient = async (newPet: Omit<Pet, 'id'>) => {
    setIsSaving(true);
    try {
      const created = await api.patients.create(newPet);
      setPatients(prev => [created, ...prev]);
      setViewState('LIST');
      toast.success("Patient added");
    } catch (error) {
      toast.error("Failed to create patient");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePatient = async (updatedPet: Pet) => {
    setIsSaving(true);
    try {
      const updated = await api.patients.update(updatedPet);
      setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
      setViewState('LIST');
      setCurrentView('PATIENT_DETAILS'); // Return to details after edit
      toast.success("Patient updated");
    } catch (error) {
      toast.error("Failed to update patient");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      await api.clients.delete(id);
      setClients(prev => prev.filter(c => c.id !== id));
      setCurrentView('CLIENTS');
      toast.success("Client deleted successfully");
    } catch (error) {
      toast.error("Failed to delete client");
    }
  };

  const handleDeletePatient = async (id: string) => {
    try {
      await api.patients.delete(id);
      setPatients(prev => prev.filter(p => p.id !== id));
      setCurrentView('PATIENTS');
      toast.success("Patient deleted successfully");
    } catch (error) {
      toast.error("Failed to delete patient");
    }
  };

  const handleSaveProcedure = async (procedure: Procedure) => {
    try {
      const saved = await api.procedures.save(procedure);
      setProcedures(prev => {
        const exists = prev.find(p => p.id === saved.id);
        if (exists) {
          return prev.map(p => p.id === saved.id ? saved : p);
        }
        return [saved, ...prev];
      });
      toast.success("Procedure saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save procedure");
      throw error;
    }
  };

  const handleAddUser = async (user: User) => {
    try {
      const created = await api.staff.create(user);
      setUsers(prev => [created, ...prev]);
      toast.success("User added");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || error?.error || "Failed to add user");
    }
  };

  const handleUpdateUser = async (user: User) => {
    try {
      const updated = await api.staff.update(user);
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      toast.success("User updated");
    } catch (error) {
      toast.error("Failed to update user");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await api.staff.delete(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success("User deleted");
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const handleSaveAppointment = async (appointmentData: any) => {
    setIsSaving(true);
    try {
      const created = await api.appointments.create(appointmentData);
      setAppointments(prev => [created, ...prev]);
      toast.success('Appointment scheduled successfully!');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || error?.error || "Failed to schedule appointment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAppointment = async (appointment: AppointmentType) => {
    try {
      const updated = await api.appointments.update(appointment);
      setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
      toast.success("Appointment updated");
    } catch (error) {
      toast.error("Failed to update appointment");
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    try {
      await api.appointments.delete(id);
      setAppointments(prev => prev.filter(a => a.id !== id));
      toast.success("Appointment deleted");
    } catch (error) {
      toast.error("Failed to delete appointment");
    }
  };

  const handleAddExpense = async (newExpense: any) => {
    setIsSaving(true);
    try {
      const created = await api.expenses.create(newExpense);
      setExpenses(prev => [created, ...prev]);
      setViewState('LIST');
      toast.success("Expense added");
    } catch (error: any) {
      toast.error(error?.message || error?.error || "Failed to create expense");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await api.expenses.delete(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast.success("Expense deleted");
    } catch (error) {
      toast.error("Failed to delete expense");
    }
  };

  const handleNavigate = (view: AppView) => {
    setCurrentView(view);
    setViewState('LIST');
    setSelectedClinicId(null);
    setSelectedClientId(null);
    setSelectedPatientId(null);
    setSelectedInventoryId(null);
    setEditingInventoryItem(null);
  };

  const renderContent = () => {
    if (loading && (inventory || []).length === 0 && !currentUser?.isSuperAdmin) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#14B8A6]"></div>
          <p className="text-slate-400 font-bold animate-pulse">Loading your clinic data...</p>
        </div>
      );
    }

    if (isPortal) {
      switch (currentView) {
        case 'PORTAL_LOGIN':
          return <PortalLogin onLogin={(client) => {
            setCurrentClient(client);
            setCurrentView('PORTAL_DASHBOARD');
          }} onViewClaim={() => setCurrentView('PORTAL_INVITE')} />;
        case 'PORTAL_INVITE':
          return <PortalClaim onBack={() => setCurrentView('PORTAL_LOGIN')} onSuccess={(client) => {
            if (client) {
              setCurrentClient(client);
              setCurrentView('PORTAL_DASHBOARD');
              return;
            }
            setCurrentView('PORTAL_LOGIN');
          }} />;
        case 'PORTAL_DASHBOARD':
          return <PortalDashboard client={currentClient} onLogout={handlePortalLogout} onViewPatient={(pid) => {
            setSelectedPatientId(pid);
            setCurrentView('PATIENT_DETAILS');
          }} />;
        case 'PATIENT_DETAILS':
          return selectedPatientId ? (
            <PortalPetDetails patientId={selectedPatientId} onBack={() => setCurrentView('PORTAL_DASHBOARD')} />
          ) : null;
        default:
          return <PortalLogin onLogin={() => {}} onViewClaim={() => {}} />;
      }
    }

    switch (currentView) {
      case 'SUPER_ADMIN':
        return (
          <SuperAdminDashboard
            onViewClinic={(id) => {
              setSelectedClinicId(id);
              setCurrentView('CLINIC_DETAILS');
            }}
          />
        );
      case 'AI_HUB':
        return (
          <PremiumGate
            user={currentUser}
            featureName="AI Hub"
            featureKey="aiFeatures"
            description="Use AI tools for notes, client messages, and clinical support."
          >
            <AIHub
              currentUser={currentUser}
              settings={settings}
              clients={clients}
              patients={patients}
              initialTab={aiContext.tab}
              initialPatientId={aiContext.patientId}
              key={`${aiContext.tab}-${aiContext.patientId}`}
            />
          </PremiumGate>
        );
      case 'LAB_HUB':
        return (
          <PremiumGate user={currentUser} featureName="Lab Hub" featureKey="hospitalFeatures" description="Access the full lab scientist workspace with AI-powered result parsing, batch entry, and trend analysis.">
            <LabHub
              patients={patients}
              clients={clients}
              settings={settings}
              currentUser={currentUser}
              onViewPatient={(pid) => {
                setSelectedPatientId(pid);
                setCurrentView('PATIENT_DETAILS');
              }}
            />
          </PremiumGate>
        );
      case 'CLINIC_DETAILS':
        return selectedClinicId ? (
          <ClinicDetails
            clinicId={selectedClinicId}
            onBack={() => setCurrentView('SUPER_ADMIN')}
          />
        ) : null;
      case 'CLIENT_DETAILS':
        return selectedClientId ? (
          <ClientDetails
            clientId={selectedClientId}
            onBack={() => setCurrentView('CLIENTS')}
            onAddPatient={(cid) => {
              setSelectedClientId(cid);
              setViewState('ADD_PATIENT');
              setCurrentView('PATIENTS');
            }}
            onViewPatient={(pid) => {
              setSelectedPatientId(pid);
              setCurrentView('PATIENT_DETAILS');
            }}
            onEditClient={(cid) => {
              setSelectedClientId(cid);
              setViewState('EDIT_CLIENT');
              setCurrentView('CLIENTS');
            }}
            onDeleteClient={handleDeleteClient}
            onNavigateView={handleNavigate}
            currentUser={currentUser}
          />
        ) : null;
      case 'PATIENT_DETAILS':
        return selectedPatientId ? (
          <PatientDetails
            patientId={selectedPatientId}
            settings={settings}
            procedures={procedures}
            clients={clients}
            currentUser={currentUser}
            onBack={() => setCurrentView('PATIENTS')}
            onViewOwner={(oid) => {
              setSelectedClientId(oid);
              setCurrentView('CLIENT_DETAILS');
            }}
            onEditPatient={(pid) => {
              setSelectedPatientId(pid);
              setViewState('EDIT_PATIENT');
              setCurrentView('PATIENTS');
            }}
            onDeletePatient={handleDeletePatient}
          />
        ) : null;
      case 'DASHBOARD':
        return (
          <Dashboard
            settings={settings}
            user={currentUser}
            onNavigate={handleNavigate}
          />
        );
      case 'POS':
        return (
          <Pos
            inventory={inventory}
            settings={settings}
            clients={clients}
            invoiceCount={invoiceCount}
            onIncrementInvoice={() => setInvoiceCount(prev => prev + 1)}
            user={currentUser}
          />
        );
      case 'INVENTORY':
        if (viewState === 'LIST') {
          return (
            <div className="h-full flex flex-col">
              <InventoryList
                items={inventory}
                settings={settings}
                totalLowStock={inventoryStats.lowStock}
                onAddItem={() => setViewState('ADD_ITEM')}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
                onEditItem={(item) => {
                  setEditingInventoryItem(item);
                  setViewState('EDIT_ITEM');
                }}
                onSearch={handleInventorySearch}
                hasMore={hasMoreInventory}
                onLoadMore={handleLoadMoreInventory}
              />
            </div>
          );
        } else if (viewState === 'ADD_ITEM') {
          return (
            <AddItemForm
              onBack={() => setViewState('LIST')}
              onSave={handleAddItem}
              settings={settings}
              isSaving={isSaving}
            />
          );
        } else if (viewState === 'EDIT_ITEM') {
          return (
            <AddItemForm
              onBack={() => setViewState('LIST')}
              onSave={(data, skipRedirect) => handleUpdateItem({ ...data, id: editingInventoryItem?.id || selectedInventoryId } as InventoryItem, skipRedirect)}
              onDeleteItem={handleDeleteItem}
              settings={settings}
              isSaving={isSaving}
              initialData={editingInventoryItem || inventory.find(i => i.id === (selectedInventoryId || editingInventoryItem?.id))}
            />
          );
        }
        return null;
      case 'CLIENTS':
        if (viewState === 'LIST') {
          return (
            <div className="h-full flex flex-col">
              <ClientList
                clients={clients}
                onAddClient={() => setViewState('ADD_CLIENT')}
                onViewClient={(id) => {
                  setSelectedClientId(id);
                  setCurrentView('CLIENT_DETAILS');
                }}
              />
              {hasMoreClients && (
                <div className="p-4 flex justify-center">
                  <button
                    onClick={handleLoadMoreClients}
                    disabled={loadingMoreClients}
                    className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition text-sm disabled:opacity-50"
                  >
                    {loadingMoreClients ? 'Loading...' : 'Load More Clients'}
                  </button>
                </div>
              )}
            </div>
          );
        } else if (viewState === 'ADD_CLIENT') {
          return (
            <AddClientForm
              onBack={() => setViewState('LIST')}
              onSave={handleAddClient}
              isSaving={isSaving}
            />
          );
        } else if (viewState === 'EDIT_CLIENT') {
          const clientData = clients.find(c => c.id === selectedClientId);
          return (
            <AddClientForm
              onBack={() => setCurrentView('CLIENT_DETAILS')}
              onSave={(data) => handleUpdateClient({ ...clientData, ...data } as Client)}
              isSaving={isSaving}
              initialData={clientData}
            />
          );
        }
        return null;
      case 'PATIENTS':
        if (viewState === 'LIST') {
          return (
            <div className="h-full flex flex-col">
              <PatientList
                patients={patients}
                clients={clients}
                onAddPatient={() => setViewState('ADD_PATIENT')}
                onViewPatient={(id) => {
                  setSelectedPatientId(id);
                  setCurrentView('PATIENT_DETAILS');
                }}
              />
              {hasMorePatients && (
                <div className="p-4 flex justify-center">
                  <button
                    onClick={handleLoadMorePatients}
                    disabled={loadingMorePatients}
                    className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition text-sm disabled:opacity-50"
                  >
                    {loadingMorePatients ? 'Loading...' : 'Load More Patients'}
                  </button>
                </div>
              )}
            </div>
          );
        } else if (viewState === 'ADD_PATIENT') {
          return (
            <AddPatientForm
              onBack={() => setViewState('LIST')}
              clients={clients}
              onSave={handleAddPatient}
              isSaving={isSaving}
              initialOwnerId={selectedClientId || undefined}
            />
          );
        } else if (viewState === 'EDIT_PATIENT') {
          const patientData = patients.find(p => p.id === selectedPatientId);
          return (
            <AddPatientForm
              onBack={() => setCurrentView('PATIENT_DETAILS')}
              clients={clients}
              onSave={(data) => handleUpdatePatient({ ...patientData, ...data, id: selectedPatientId } as Pet)}
              isSaving={isSaving}
              initialData={patientData}
            />
          );
        }
        return null;
      case 'TREATMENTS':
        return (
          <Treatment
            clients={clients}
            patients={patients}
            settings={settings}
            procedures={procedures}
            currentUser={currentUser}
          />
        );
      case 'PROCEDURES':
        return (
          <ProcedureManagement
            procedures={procedures}
            settings={settings}
            onSave={handleSaveProcedure}
          />
        );
      case 'APPOINTMENTS':
        return (
          <Appointment
            clients={clients}
            procedures={procedures}
            settings={settings}
            appointments={appointments}
            onSave={handleSaveAppointment}
            onUpdate={handleUpdateAppointment}
            onDelete={handleDeleteAppointment}
          />
        );
      case 'SETTINGS':
        return (
          <Settings
            settings={settings}
            user={currentUser}
            isSaving={isSaving}
            onSave={async (newSettings) => {
              setIsSaving(true);
              try {
                const saved = await api.settings.update(newSettings);
                setSettings(saved);
                if (currentUser) {
                  const updatedUser = { ...currentUser, clinic: saved };
                  setCurrentUser(updatedUser);
                  localStorage.setItem('user', JSON.stringify(updatedUser));
                }
                toast.success("Settings updated");
              } catch (error) {
                toast.error("Failed to update settings");
              } finally {
                setIsSaving(false);
              }
            }}
            onUpdateUser={(updated) => {
              setCurrentUser(updated);
              localStorage.setItem('user', JSON.stringify(updated));
              toast.success("Profile updated");
            }}
            onNavigate={(view) => setCurrentView(view as AppView)}
          />
        );
      case 'STAFF':
        return (
          <StaffManagement
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
          />
        );
      case 'AUDIT_LOG':
        return (
          <AuditLog logs={logs} />
        );
      case 'SALES_HISTORY':
        return (
          <TransactionHistory settings={settings} currentUser={currentUser} />
        );
      case 'EXPENSES':
        if (viewState === 'LIST') {
          return (
            <div className="h-full flex flex-col">
              <Expenses
                expenses={expenses}
                settings={settings}
                currentUser={currentUser}
                onAddExpense={() => setViewState('ADD_ITEM')}
                onDeleteExpense={handleDeleteExpense}
              />
              {hasMoreExpenses && (
                <div className="p-4 flex justify-center">
                  <button
                    onClick={handleLoadMoreExpenses}
                    disabled={loadingMoreExpenses}
                    className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition text-sm disabled:opacity-50"
                  >
                    {loadingMoreExpenses ? 'Loading...' : 'Load More Expenses'}
                  </button>
                </div>
              )}
            </div>
          );
        } else if (viewState === 'ADD_ITEM') {
          return (
            <AddExpenseForm
              onBack={() => setViewState('LIST')}
              onSave={handleAddExpense}
              settings={settings}
              isSaving={isSaving}
            />
          );
        }
        return null;
      case 'REMINDERS':
        return <ReminderList />;
      case 'FREE_INVOICE':
        return (
          <FreeInvoice
            settings={settings}
            user={currentUser}
          />
        );
      case 'REPORTS':
        return (
          <ProfitLossReport settings={settings} />
        );
      case 'ICU_BOARD':
        return (
          <PremiumGate 
            user={currentUser} 
            featureName="ICU & Hospitalization Board" 
            featureKey="hospitalFeatures"
            description="Manage critical patients, flowsheet digital tracking, and nursing rounds with our advanced ICU suite."
          >
            <ICUBoard settings={settings} currentUser={currentUser} onNavigate={setCurrentView} />
          </PremiumGate>
        );
      case 'HOSPITALIZATION':
        return (
          <Hospitalization settings={settings} currentUser={currentUser} />
        );
      case 'PATIENT_QUEUE':
        return (
          <PatientQueue
            currentUser={currentUser}
            settings={settings}
            onViewPatient={(pid: string) => {
              setSelectedPatientId(pid);
              setCurrentView('PATIENT_DETAILS');
            }}
          />
        );
      case 'SHIFT_TIMETABLE':
        return (
          <PremiumGate 
            user={currentUser} 
            featureName="Clinician Shift Roster" 
            featureKey="hospitalFeatures"
            description="Automate staff scheduling, visualize weekly shifts, and manage handoff reports across your entire team."
          >
            <ShiftTimetable settings={settings} onBack={() => setCurrentView('DASHBOARD')} />
          </PremiumGate>
        );
      case 'BRANCHES':
        return (
          <PremiumGate 
            user={currentUser} 
            featureName="Multi-Branch Network" 
            featureKey="multiBranch"
            description="Scale your practice by adding unlimited locations, centralized inventory, and cross-branch staff management."
          >
            <Branches />
          </PremiumGate>
        );
      case 'TRIAGE':
        return (
          <PremiumGate 
            user={currentUser} 
            featureName="ER Triage" 
            featureKey="hospitalFeatures"
            description="Track urgent patients and quick admissions from one board."
          >
            <TriageBoard />
          </PremiumGate>
        );
      case 'NARCOTICS_LOCKBOX':
        return (
          <PremiumGate 
            user={currentUser} 
            featureName="Narcotics Lockbox" 
            featureKey="hospitalFeatures"
            description="Track controlled drugs with PIN access and clear audit records."
          >
            <NarcoticsLockbox settings={settings} currentUser={currentUser} />
          </PremiumGate>
        );
      case 'CLINICAL_CALCULATORS':
        return (
          <PremiumGate 
            user={currentUser} 
            featureName="Clinical Intelligence" 
            featureKey="hospitalFeatures"
            description="Veterinary specific math tools for Drug Dosing, Constant Rate Infusions (CRI), and Fluid Therapy."
          >
            <ClinicalCalculators />
          </PremiumGate>
        );
      case 'SUBSCRIPTION_CALLBACK':
        return null;

      default:
        return null;
    }
  };

  if (isPortal) {
    return (
      <div className="h-screen bg-[#F8FAFC]">
        <Toaster position="top-right" richColors />
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50">
      <Toaster position="top-right" richColors />
      {!isAuthenticated ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <Layout 
          user={currentUser} 
          currentView={currentView} 
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          settings={settings}
        >
          {renderContent()}
        </Layout>
      )}
    </div>
  );
};

export default App;

