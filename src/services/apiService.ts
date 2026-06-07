import { InventoryItem, Client, Pet, Procedure, User, LogEntry, ClinicSettings, Appointment, AIConversation, AIMessage, FAQ, Hospitalization, PortalConversationSummary, PortalInboxSummary, PortalShopItem, PortalOrderSummary } from '../types';
import { cacheManager } from './cacheManager';

export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

// Helper to get token from localStorage
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

const handleResponse = async (response: Response) => {
    const body = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (!response.ok) {
        // Attach the full JSON body to the error so callers can read code, paymentUrl, etc.
        const err: any = new Error(body.error || 'API request failed');
        err.data = body;
        throw err;
    }
    return body;
};

export const api = {
    auth: {
        login: (credentials: any) =>
            fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
            }).then(handleResponse).then(res => {
                if (res.token) localStorage.setItem('token', res.token);
                // Set user context for caching after login
                if (res.user) {
                    cacheManager.setUserContext(res.user.clinicId || 'default', res.user.id);
                }
                return res;
            }),
        sharedLogin: (credentials: any) =>
            fetch(`${API_URL}/auth/shared-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
            }).then(handleResponse).then(res => {
                if (res.token) {
                    localStorage.setItem('token', res.token);
                }
                if (res.user) {
                    cacheManager.setUserContext(res.user.clinicId || 'default', res.user.id);
                }
                return res;
            }),
        firebaseLogin: (idToken: string) =>
            fetch(`${API_URL}/auth/firebase-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            }).then(handleResponse).then(res => {
                if (res.token) {
                    localStorage.setItem('token', res.token);
                }
                if (res.user) {
                    cacheManager.setUserContext(res.user.clinicId || 'default', res.user.id);
                }
                return res;
            }),
        register: (data: any) =>
            fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).then(handleResponse).then(res => {
                if (res.token) localStorage.setItem('token', res.token);
                if (res.user) cacheManager.setUserContext(res.user.clinicId || 'default', res.user.id);
                return res;
            }),
        initiateRegistration: (data: any) =>
            fetch(`${API_URL}/auth/initiate-registration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).then(handleResponse),
        sendVerification: (email: string) =>
            fetch(`${API_URL}/auth/send-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            }).then(handleResponse),
        verifyCode: (email: string, code: string) =>
            fetch(`${API_URL}/auth/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            }).then(handleResponse),
        forgotPassword: (email: string) =>
            fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            }).then(handleResponse),
        resetPassword: (data: any) =>
            fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).then(handleResponse),
        logout: () => {
            localStorage.removeItem('token');
            cacheManager.clearAll(); // Clear all cache on logout
            cacheManager.clearUserContext();
        }
    },

    firebase: {
        registerFcmToken: (token: string, platform: string = 'web') =>
            fetch(`${API_URL}/firebase/fcm-token`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ token, platform }),
            }).then(handleResponse),
        sendTestNotification: () =>
            fetch(`${API_URL}/firebase/notifications/test`, {
                method: 'POST',
                headers: getAuthHeaders(),
            }).then(handleResponse),
    },

    // Inventory
    inventory: {
        getAll: async (page: number = 1, limit: number = 50, search?: string): Promise<InventoryItem[]> => {
            const cacheKey = `page=${page}&limit=${limit}&search=${search || ''}`;
            const cached = cacheManager.get<InventoryItem[]>('inventory', cacheKey);
            if (cached) return cached;

            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(search && { search })
            });

            const data = await fetch(`${API_URL}/inventory?${queryParams.toString()}`, { headers: getAuthHeaders() }).then(handleResponse);
            cacheManager.set('inventory', data, cacheKey);
            return data;
        },
        getOne: (id: string): Promise<InventoryItem> =>
            fetch(`${API_URL}/inventory/${id}`, { headers: getAuthHeaders() }).then(handleResponse),
        getStats: (): Promise<{ total: number, lowStock: number }> =>
            fetch(`${API_URL}/inventory/stats`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> =>
            fetch(`${API_URL}/inventory`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(item),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('inventory');
                return res;
            }),
        update: (item: InventoryItem): Promise<InventoryItem> =>
            fetch(`${API_URL}/inventory/${item.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(item),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('inventory');
                return res;
            }),
        addBatch: (data: { itemId: string; date: string; quantity: number; note?: string | null }): Promise<any> =>
            fetch(`${API_URL}/inventory/batch`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('inventory');
                return res;
            }),
        delete: (id: string): Promise<void> =>
            fetch(`${API_URL}/inventory/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('inventory');
                return res;
            }),
    },

    // Clients
    clients: {
        getAll: async (page: number = 1, limit: number = 100): Promise<Client[]> => {
            const cacheKey = `page=${page}&limit=${limit}`;
            const cached = cacheManager.get<Client[]>('clients', cacheKey);
            if (cached) return cached;

            const data = await fetch(`${API_URL}/clients?page=${page}&limit=${limit}`, { headers: getAuthHeaders() }).then(handleResponse);
            cacheManager.set('clients', data, cacheKey);
            return data;
        },
        getOne: (id: string): Promise<any> =>
            fetch(`${API_URL}/clients/${id}`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (client: Omit<Client, 'id' | 'registrationDate'>): Promise<Client> =>
            fetch(`${API_URL}/clients`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(client),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('clients');
                return res;
            }),
        update: (client: Client): Promise<Client> =>
            fetch(`${API_URL}/clients/${client.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(client),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('clients');
                return res;
            }),
        sendPortalInvite: (id: string): Promise<any> =>
            fetch(`${API_URL}/clients/${id}/portal/invite`, {
                method: 'POST',
                headers: getAuthHeaders(),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('clients');
                return res;
            }),
        resendPortalInvite: (id: string): Promise<any> =>
            fetch(`${API_URL}/clients/${id}/portal/invite/resend`, {
                method: 'POST',
                headers: getAuthHeaders(),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('clients');
                return res;
            }),
        generatePortalCredentials: (id: string): Promise<any> =>
            fetch(`${API_URL}/clients/${id}/portal/credentials`, {
                method: 'POST',
                headers: getAuthHeaders(),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('clients');
                return res;
            }),
        enablePortalAccess: (id: string): Promise<any> =>
            fetch(`${API_URL}/clients/${id}/portal/access/enable`, {
                method: 'POST',
                headers: getAuthHeaders(),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('clients');
                return res;
            }),
        revokePortalAccess: (id: string): Promise<any> =>
            fetch(`${API_URL}/clients/${id}/portal/access/revoke`, {
                method: 'POST',
                headers: getAuthHeaders(),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('clients');
                return res;
            }),
        delete: (id: string): Promise<void> =>
            fetch(`${API_URL}/clients/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('clients');
                return res;
            }),
    },

    // Patients
    patients: {
        getAll: async (page: number = 1, limit: number = 100): Promise<Pet[]> => {
            const cacheKey = `page=${page}&limit=${limit}`;
            const cached = cacheManager.get<Pet[]>('patients', cacheKey);
            if (cached) return cached;

            const data = await fetch(`${API_URL}/patients?page=${page}&limit=${limit}`, { headers: getAuthHeaders() }).then(handleResponse);
            cacheManager.set('patients', data, cacheKey);
            return data;
        },
        getOne: (id: string): Promise<any> =>
            fetch(`${API_URL}/patients/${id}`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (pet: Omit<Pet, 'id'>): Promise<Pet> =>
            fetch(`${API_URL}/patients`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(pet),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('patients');
                return res;
            }),
        update: (pet: Pet): Promise<Pet> =>
            fetch(`${API_URL}/patients/${pet.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(pet),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('patients');
                return res;
            }),
        delete: (id: string): Promise<void> =>
            fetch(`${API_URL}/patients/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('patients');
                return res;
            }),
    },

    // Procedures
    procedures: {
        getAll: (): Promise<Procedure[]> =>
            fetch(`${API_URL}/procedures`, { headers: getAuthHeaders() }).then(handleResponse),
        save: (procedure: Procedure): Promise<Procedure> => {
            const isUpdate = !!procedure.id && !String(procedure.id).startsWith('new-');
            console.log('Procedure save:', { id: procedure.id, isUpdate, method: isUpdate ? 'PUT' : 'POST' });
            return fetch(`${API_URL}/procedures${isUpdate ? `/${procedure.id}` : ''}`, {
                method: isUpdate ? 'PUT' : 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(procedure),
            }).then(handleResponse);
        }
    },


    // Staff
    staff: {
        getAll: (): Promise<User[]> =>
            fetch(`${API_URL}/auth/users`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (user: Partial<User>): Promise<User> =>
            fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(user),
            }).then(handleResponse).then(res => {
                // Ensure we return the user object properly
                if (res.user) return res.user;
                return res;
            }),
        update: (user: User): Promise<User> =>
            fetch(`${API_URL}/auth/users/${user.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(user),
            }).then(handleResponse),
        delete: (id: string): Promise<void> =>
            fetch(`${API_URL}/auth/users/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            }).then(handleResponse),
    },

    // Settings
    settings: {
        get: (): Promise<ClinicSettings> =>
            fetch(`${API_URL}/settings`, { headers: getAuthHeaders() }).then(handleResponse),
        update: (settings: Partial<ClinicSettings>): Promise<ClinicSettings> =>
            fetch(`${API_URL}/settings`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(settings),
            }).then(handleResponse),
        getDriveAuthUrl: (): Promise<{ url: string }> =>
            fetch(`${API_URL}/drive/auth`, { headers: getAuthHeaders() }).then(handleResponse),
    },

    // Sales
    sales: {
        getAll: async (page: number = 1, limit: number = 10000): Promise<any[]> => {
            const cached = cacheManager.get<any[]>('sales', `page=${page}&limit=${limit}`);
            if (cached) return cached;

            const data = await fetch(`${API_URL}/sales?page=${page}&limit=${limit}`, { headers: getAuthHeaders() }).then(handleResponse);
            cacheManager.set('sales', data, `page=${page}&limit=${limit}`);
            return data;
        },
        getOne: (id: string): Promise<any> =>
            fetch(`${API_URL}/sales/${id}`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (data: any): Promise<any> =>
            fetch(`${API_URL}/sales`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('sales');
                cacheManager.invalidate('inventory');
                cacheManager.invalidate('dashboard');
                return res;
            }),
        pay: (id: string, paymentMethod: string, amount: number, reference?: string): Promise<any> =>
            fetch(`${API_URL}/sales/${id}/pay`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ paymentMethod, amount, reference }),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('sales');
                cacheManager.invalidate('dashboard');
                return res;
            }),
        void: (id: string, reason: string): Promise<any> =>
            fetch(`${API_URL}/sales/${id}/void`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ reason }),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('sales');
                cacheManager.invalidate('inventory');
                cacheManager.invalidate('dashboard');
                return res;
            }),
        delete: (id: string, reason: string): Promise<void> =>
            fetch(`${API_URL}/sales/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify({ reason }),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('sales');
                cacheManager.invalidate('dashboard');
                return res;
            }),
    },

    // Treatments
    treatments: {
        getAll: async (): Promise<any[]> => {
            const cached = cacheManager.get<any[]>('treatments', 'all');
            if (cached) return cached;

            const data = await fetch(`${API_URL}/treatments`, { headers: getAuthHeaders() }).then(handleResponse);
            cacheManager.set('treatments', data, 'all');
            return data;
        },
        getOne: (id: string): Promise<any> =>
            fetch(`${API_URL}/treatments/${id}`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (treatment: any): Promise<any> =>
            fetch(`${API_URL}/treatments`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(treatment),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('treatments');
                return res;
            }),
        update: (id: string, treatment: any): Promise<any> =>
            fetch(`${API_URL}/treatments/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(treatment),
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('treatments');
                return res;
            }),
        delete: (id: string): Promise<void> =>
            fetch(`${API_URL}/treatments/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('treatments');
                return res;
            }),
        addNote: (id: string, note: string): Promise<any> =>
            fetch(`${API_URL}/treatments/${id}/notes`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ note })
            }).then(handleResponse).then(res => {
                cacheManager.invalidate('treatments');
                return res;
            }),
    },

    // Appointments
    appointments: {
        getAll: (filters?: { date?: string; status?: string; clientId?: string; staffId?: string }): Promise<Appointment[]> => {
            const params = new URLSearchParams();
            if (filters?.date) params.append('date', filters.date);
            if (filters?.status) params.append('status', filters.status);
            if (filters?.clientId) params.append('clientId', filters.clientId);
            if (filters?.staffId) params.append('staffId', filters.staffId);
            const queryString = params.toString();
            return fetch(`${API_URL}/appointments${queryString ? `?${queryString}` : ''}`, { headers: getAuthHeaders() }).then(handleResponse);
        },
        getOne: (id: string): Promise<Appointment> =>
            fetch(`${API_URL}/appointments/${id}`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Appointment> =>
            fetch(`${API_URL}/appointments`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(appointment),
            }).then(handleResponse),
        update: (appointment: Appointment): Promise<Appointment> =>
            fetch(`${API_URL}/appointments/${appointment.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(appointment),
            }).then(handleResponse),
        delete: (id: string): Promise<void> =>
            fetch(`${API_URL}/appointments/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(handleResponse),
    },

    // Audit Logs
    audit: {
        getAll: (): Promise<LogEntry[]> =>
            fetch(`${API_URL}/audit`, { headers: getAuthHeaders() }).then(handleResponse),
    },

    // Dashboard
    dashboard: {
        getStats: async (): Promise<any> => {
            const cached = cacheManager.get<any>('dashboard', 'stats');
            if (cached) return cached;

            const data = await fetch(`${API_URL}/dashboard`, { headers: getAuthHeaders() }).then(handleResponse);
            cacheManager.set('dashboard', data, 'stats', 60 * 1000); // 60 second TTL for dashboard
            return data;
        },
    },

    // Subscription (Public & Protected)
    subscription: {
        getPlans: (): Promise<any[]> =>
            fetch(`${API_URL}/subscription/plans`).then(handleResponse), // Public endpoint
        verifyRegistrationPayment: (data: { txRef?: string; transactionId?: string }) =>
            fetch(`${API_URL}/subscription/verify-registration-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).then(handleResponse),
    },

    // Super Admin
    superAdmin: {
        getClinics: (): Promise<any[]> =>
            fetch(`${API_URL}/superadmin/clinics`, { headers: getAuthHeaders() }).then(handleResponse),
        createClinic: (data: any): Promise<any> =>
            fetch(`${API_URL}/superadmin/clinics`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        updateClinic: (id: string, data: any): Promise<any> =>
            fetch(`${API_URL}/superadmin/clinics/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        deleteClinic: (id: string): Promise<void> =>
            fetch(`${API_URL}/superadmin/clinics/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(handleResponse),
        getClinicDetails: (id: string): Promise<any> =>
            fetch(`${API_URL}/superadmin/clinics/${id}`, { headers: getAuthHeaders() }).then(handleResponse),
        getInvites: (): Promise<any[]> =>

            fetch(`${API_URL}/superadmin/invites`, { headers: getAuthHeaders() }).then(handleResponse),
        updateSubscription: (id: string, data: { planId: string, status?: string, currentPeriodEnd?: string, billingCycle?: string, cancelAtPeriodEnd?: boolean }): Promise<any> =>
            fetch(`${API_URL}/superadmin/clinics/${id}/subscription`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        createInvite: (data: any): Promise<any> =>
            fetch(`${API_URL}/superadmin/invites`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        getPlans: (): Promise<any[]> =>
            fetch(`${API_URL}/subscription/plans`, { headers: getAuthHeaders() }).then(handleResponse),
        getStats: (): Promise<any> =>
            fetch(`${API_URL}/superadmin/stats`, { headers: getAuthHeaders() }).then(handleResponse)
    },

    // AI Features
    ai: {
        scanProduct: (imageBase64: string): Promise<any> =>
            fetch(`${API_URL}/ai/scan-product`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ imageBase64 }),
            }).then(handleResponse),
        suggestDiagnosis: (complaint: string, assessment: string): Promise<any[]> =>
            fetch(`${API_URL}/ai/suggest-diagnosis`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ complaint, assessment }),
            }).then(handleResponse),
    },

    // Expenses
    expenses: {
        getAll: (page: number = 1, limit: number = 100): Promise<any[]> =>
            fetch(`${API_URL}/expenses?page=${page}&limit=${limit}`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (data: any): Promise<any> =>
            fetch(`${API_URL}/expenses`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        delete: (id: string): Promise<void> =>
            fetch(`${API_URL}/expenses/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(handleResponse),
    },

    // Reports
    reports: {
        getProfitLoss: (params: any): Promise<any> => {
            const query = new URLSearchParams(params).toString();
            return fetch(`${API_URL}/reports/profit-loss?${query}`, { headers: getAuthHeaders() }).then(handleResponse);
        },
        generateReferral: (patientId: string): Promise<any> =>
            fetch(`${API_URL}/reports/referral-synthesis`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ patientId }),
            }).then(handleResponse),
        generateHomeCare: (treatmentId: string): Promise<any> =>
            fetch(`${API_URL}/reports/home-care-instructions`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ treatmentId }),
            }).then(handleResponse),
    },

    // Search
    search: {
        query: (q: string): Promise<{ clients: any[], patients: any[], inventory: any[] }> =>
            fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`, { headers: getAuthHeaders() }).then(handleResponse),
    },

    // Vaccinations
    vaccinations: {
        getByPatientId: (patientId: string): Promise<any[]> =>
            fetch(`${API_URL}/vaccinations/patient/${patientId}`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (data: any): Promise<any> =>
            fetch(`${API_URL}/vaccinations`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        update: (id: string, data: any): Promise<any> =>
            fetch(`${API_URL}/vaccinations/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        delete: (id: string): Promise<void> =>
            fetch(`${API_URL}/vaccinations/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(handleResponse),
    },

    // Reminders
    reminders: {
        getAll: (status?: string, type?: string): Promise<any[]> => {
            const params = new URLSearchParams();
            if (status) params.append('status', status);
            if (type) params.append('type', type);
            return fetch(`${API_URL}/reminders?${params.toString()}`, { headers: getAuthHeaders() }).then(handleResponse);
        },
        cancel: (id: string): Promise<any> =>
            fetch(`${API_URL}/reminders/${id}/cancel`, {
                method: 'POST',
                headers: getAuthHeaders()
            }).then(handleResponse),
    },

    // Shifts
    shifts: {
        getAll: (start?: string, end?: string): Promise<any[]> => {
            const params = new URLSearchParams();
            if (start) params.append('start', start);
            if (end) params.append('end', end);
            return fetch(`${API_URL}/shifts?${params.toString()}`, { headers: getAuthHeaders() }).then(handleResponse);
        },
        create: (data: any): Promise<any> =>
            fetch(`${API_URL}/shifts`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        update: (id: string, data: any): Promise<any> =>
            fetch(`${API_URL}/shifts/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        delete: (id: string): Promise<void> =>
            fetch(`${API_URL}/shifts/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(handleResponse),
    },

    // Profile
    profile: {
        get: (): Promise<any> =>
            fetch(`${API_URL}/profile`, { headers: getAuthHeaders() }).then(handleResponse),
        updateAvatar: (avatarUrl: string): Promise<any> =>
            fetch(`${API_URL}/profile/avatar`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ avatarUrl }),
            }).then(handleResponse),
        updatePin: (pin: string): Promise<any> =>
            fetch(`${API_URL}/profile/pin`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ pin }),
            }).then(handleResponse),
        deleteAccount: (deleteClinic: boolean): Promise<any> =>
            fetch(`${API_URL}/profile`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify({ deleteClinic }),
            }).then(handleResponse),
    },
    // Branches
    branches: {
        getAll: (): Promise<any[]> => fetch(`${API_URL}/branches`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (data: any): Promise<any> => fetch(`${API_URL}/branches`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
    },
    // Triage
    triage: {
        getActive: (): Promise<any[]> => fetch(`${API_URL}/triage/active`, { headers: getAuthHeaders() }).then(handleResponse),
        updateStatus: (patientId: string, status: string): Promise<any> => fetch(`${API_URL}/triage/${patientId}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status }),
        }).then(handleResponse),
        quickAdmit: (triageStatus: string): Promise<any> => fetch(`${API_URL}/triage/quick-admit`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ triageStatus }),
        }).then(handleResponse),
    },
    // AI Scribe
    aiScribe: {
        transcribe: (audioFile: File, patientId?: string): Promise<any> => {
            const formData = new FormData();
            formData.append('audio', audioFile);
            if (patientId) formData.append('patientId', patientId);

            return fetch(`${API_URL}/ai/transcribe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            }).then(handleResponse);
        },
        generateSOAP: (transcriptId: string, patientId: string, additionalContext?: string): Promise<any> =>
            fetch(`${API_URL}/ai-scribe/generate-soap`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ transcriptId, patientId, additionalContext }),
            }).then(handleResponse),
        approveSOAP: (id: string, soapData: any): Promise<any> =>
            fetch(`${API_URL}/ai-scribe/approve-soap/${id}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(soapData),
            }).then(handleResponse),
        getHistory: (): Promise<any[]> =>
            fetch(`${API_URL}/ai-scribe/history`, { headers: getAuthHeaders() }).then(handleResponse),
    },

    // AI Activity
    aiActivity: {
        getLogs: (page: number = 1, limit: number = 50, filters?: any): Promise<any> => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...filters
            });
            return fetch(`${API_URL}/ai-activity?${params.toString()}`, { headers: getAuthHeaders() }).then(handleResponse);
        },
        getStats: (): Promise<any> =>
            fetch(`${API_URL}/ai-activity/stats`, { headers: getAuthHeaders() }).then(handleResponse),
    },

    // AI Client Communication
    aiClient: {
        getConversations: (params?: { platform?: 'PORTAL' | 'WHATSAPP' | 'SMS' | 'WEB_WIDGET'; status?: 'ACTIVE' | 'CLOSED' | 'ESCALATED' }): Promise<AIConversation[]> => {
            const query = new URLSearchParams();
            if (params?.platform) query.set('platform', params.platform);
            if (params?.status) query.set('status', params.status);
            const suffix = query.toString() ? `?${query.toString()}` : '';
            return fetch(`${API_URL}/ai-client/conversations${suffix}`, { headers: getAuthHeaders() }).then(handleResponse);
        },
        getConversation: (id: string): Promise<AIConversation> =>
            fetch(`${API_URL}/ai-client/conversations/${id}`, { headers: getAuthHeaders() }).then(handleResponse),
        createConversation: (data: { clientId: string; patientId?: string | null; subject: string; category?: string; content: string; platform?: 'PORTAL' }): Promise<AIConversation> =>
            fetch(`${API_URL}/ai-client/conversations`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        updateConversationStatus: (id: string, status: 'ACTIVE' | 'CLOSED'): Promise<AIConversation> =>
            fetch(`${API_URL}/ai-client/conversations/${id}/status`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status }),
            }).then(handleResponse),
        markConversationRead: (id: string): Promise<{ updated: number }> =>
            fetch(`${API_URL}/ai-client/conversations/${id}/read`, {
                method: 'POST',
                headers: getAuthHeaders(),
            }).then(handleResponse),
        sendMessage: (conversationId: string, content: string | FormData): Promise<AIMessage> => {
            const isFormData = content instanceof FormData;
            if (isFormData && !content.has('conversationId')) {
                content.append('conversationId', conversationId);
            }
            return fetch(`${API_URL}/ai-client/send`, {
                method: 'POST',
                headers: isFormData ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : getAuthHeaders(),
                body: isFormData ? content : JSON.stringify({ conversationId, content }),
            }).then(handleResponse);
        },
        getFAQs: (): Promise<FAQ[]> =>
            fetch(`${API_URL}/ai-client/faqs`, { headers: getAuthHeaders() }).then(handleResponse),
        createFAQ: (data: Partial<FAQ>): Promise<FAQ> =>
            fetch(`${API_URL}/ai-client/faqs`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        updateFAQ: (id: string, data: Partial<FAQ>): Promise<FAQ> =>
            fetch(`${API_URL}/ai-client/faqs/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        deleteFAQ: (id: string): Promise<void> =>
            fetch(`${API_URL}/ai-client/faqs/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            }).then(handleResponse),
    },

    aiOperations: {
        getInventoryAnalysis: (): Promise<any[]> =>
            fetch(`${API_URL}/ai-operations/inventory-analysis`, { headers: getAuthHeaders() }).then(handleResponse),
        getScheduleAudit: (): Promise<any> =>
            fetch(`${API_URL}/ai-operations/schedule-audit`, { headers: getAuthHeaders() }).then(handleResponse),
        generatePO: (itemIds: string[]): Promise<any> =>
            fetch(`${API_URL}/ai-operations/generate-po`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ itemIds }),
            }).then(handleResponse),
    },

    aiDiagnostic: {
        analyzeCase: (data: { patientId: string; complaint: string; clinicalSigns: string; vitals: any }): Promise<any> =>
            fetch(`${API_URL}/ai-diagnostic/analyze-case`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        parseLabResult: (data: { rawText: string; patientId?: string }): Promise<any> =>
            fetch(`${API_URL}/ai-diagnostic/parse-lab-result`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        getHealthTrends: (patientId: string): Promise<any[]> =>
            fetch(`${API_URL}/ai-diagnostic/health-trends/${patientId}`, { headers: getAuthHeaders() }).then(handleResponse),
    },

    aiImaging: {
        analyze: (mediaId: string): Promise<any> =>
            fetch(`${API_URL}/ai-imaging/analyze`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ mediaId }),
            }).then(handleResponse),
        compare: (mediaIdA: string, mediaIdB: string): Promise<any> =>
            fetch(`${API_URL}/ai-imaging/compare`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ mediaIdA, mediaIdB }),
            }).then(handleResponse),
    },

    // Reconciliation
    reconciliation: {
        create: (data: { itemId: string; physicalCount: number; reason?: string; notes?: string }): Promise<any> =>
            fetch(`${API_URL}/reconciliation`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        getAll: (page: number = 1, limit: number = 50, itemId?: string): Promise<any[]> => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(itemId && { itemId })
            });
            return fetch(`${API_URL}/reconciliation?${params.toString()}`, { headers: getAuthHeaders() }).then(handleResponse);
        },
        getByItem: (itemId: string): Promise<any[]> =>
            fetch(`${API_URL}/reconciliation/item/${itemId}`, { headers: getAuthHeaders() }).then(handleResponse),
    },

    // Hospitalization & ICU
    hospitalization: {
        getRounds: (): Promise<Hospitalization[]> => fetch(`${API_URL}/hospitalization/rounds`, { headers: getAuthHeaders() }).then(handleResponse),
        update: (id: string, data: Partial<Hospitalization>): Promise<Hospitalization> => fetch(`${API_URL}/hospitalization/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
        getKennels: (): Promise<any[]> => fetch(`${API_URL}/hospitalization/kennels`, { headers: getAuthHeaders() }).then(handleResponse),
        createKennel: (data: { name: string; type: string }): Promise<any> => fetch(`${API_URL}/hospitalization/kennels`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
        admit: (data: { patientId: string; kennelId: string; reason?: string; estimatedCost?: number }): Promise<any> => fetch(`${API_URL}/hospitalization/admit`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
        discharge: (id: string): Promise<any> => fetch(`${API_URL}/hospitalization/${id}/discharge`, {
            method: 'PUT',
            headers: getAuthHeaders()
        }).then(handleResponse),
        getFlowsheet: (id: string): Promise<any[]> => fetch(`${API_URL}/hospitalization/${id}/flowsheet`, { headers: getAuthHeaders() }).then(handleResponse),
        addFlowsheetEntry: (id: string, data: any): Promise<any> => fetch(`${API_URL}/hospitalization/${id}/flowsheet`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
        getNotes: (id: string): Promise<any[]> => fetch(`${API_URL}/hospitalization/${id}/notes`, { headers: getAuthHeaders() }).then(handleResponse),
        addNote: (id: string, data: any): Promise<any> => fetch(`${API_URL}/hospitalization/${id}/notes`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
        getPrescriptions: (id: string): Promise<any[]> => fetch(`${API_URL}/hospitalization/${id}/prescriptions`, { headers: getAuthHeaders() }).then(handleResponse),
        addPrescription: (id: string, data: any): Promise<any> => fetch(`${API_URL}/hospitalization/${id}/prescriptions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
        updatePrescription: (id: string, prescriptionId: string, data: { status: string }): Promise<any> => fetch(`${API_URL}/hospitalization/${id}/prescriptions/${prescriptionId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
    },
    // Client Auth
    clientAuth: {
        login: (credentials: any): Promise<any> =>
            fetch(`${API_URL}/auth/client/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
            }).then(handleResponse),
        getInvite: (token: string): Promise<any> =>
            fetch(`${API_URL}/auth/client/invite/${token}`, {
                headers: { 'Content-Type': 'application/json' },
            }).then(handleResponse),
        acceptInvite: (data: { token: string; password: string }): Promise<any> =>
            fetch(`${API_URL}/auth/client/invite/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).then(handleResponse),
        changePassword: (data: { currentPassword?: string; newPassword: string }): Promise<any> =>
            fetch(`${API_URL}/auth/client/change-password`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
    },
    // Portal Data
    portal: {
        getDashboard: (): Promise<any> =>
            fetch(`${API_URL}/portal/dashboard`, { headers: getAuthHeaders() }).then(handleResponse),
        getDriveAuthUrl: (): Promise<{ url: string }> =>
            fetch(`${API_URL}/portal/drive/auth`, { headers: getAuthHeaders() }).then(handleResponse),
        exportToDrive: (data: FormData): Promise<any> =>
            fetch(`${API_URL}/portal/drive/export`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: data,
            }).then(handleResponse),
        getShop: (): Promise<{ items: PortalShopItem[] }> =>
            fetch(`${API_URL}/portal/shop`, { headers: getAuthHeaders() }).then(handleResponse),
        getOrders: (): Promise<{ orders: PortalOrderSummary[] }> =>
            fetch(`${API_URL}/portal/orders`, { headers: getAuthHeaders() }).then(handleResponse),
        createOrder: (items: Array<{ itemId: string; quantity: number }>): Promise<PortalOrderSummary> =>
            fetch(`${API_URL}/portal/orders`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ items }),
            }).then(handleResponse),
        getPatientHistory: (id: string): Promise<any> =>
            fetch(`${API_URL}/portal/patient/${id}/history`, { headers: getAuthHeaders() }).then(handleResponse),
        getInbox: (): Promise<PortalInboxSummary> =>
            fetch(`${API_URL}/portal/inbox`, { headers: getAuthHeaders() }).then(handleResponse),
        getConversation: (id: string): Promise<AIConversation> =>
            fetch(`${API_URL}/portal/inbox/${id}`, { headers: getAuthHeaders() }).then(handleResponse),
        createConversation: (data: { subject: string; content: string; category?: string; patientId?: string | null }): Promise<AIConversation> =>
            fetch(`${API_URL}/portal/inbox`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
        sendMessage: (id: string, content: string | FormData): Promise<AIMessage> => {
            const isFormData = content instanceof FormData;
            return fetch(`${API_URL}/portal/inbox/${id}/messages`, {
                method: 'POST',
                headers: isFormData ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : getAuthHeaders(),
                body: isFormData ? content : JSON.stringify({ content }),
            }).then(handleResponse);
        },
        markConversationRead: (id: string): Promise<{ updated: number }> =>
            fetch(`${API_URL}/portal/inbox/${id}/read`, {
                method: 'POST',
                headers: getAuthHeaders(),
            }).then(handleResponse),
        signConsent: (id: string, signedBy: string): Promise<any> =>
            fetch(`${API_URL}/portal/consent/${id}/sign`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ signedBy }),
            }).then(handleResponse),
    },
    consent: {
        create: (data: any): Promise<any> =>
            fetch(`${API_URL}/portal/consent`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            }).then(handleResponse),
    },
    // Labs
    labs: {
        getByPatientId: (patientId: string): Promise<any[]> => fetch(`${API_URL}/labs/patient/${patientId}`, { headers: getAuthHeaders() }).then(handleResponse),
        create: (data: any): Promise<any> => fetch(`${API_URL}/labs`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
        update: (id: string, data: any): Promise<any> => fetch(`${API_URL}/labs/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
        delete: (id: string): Promise<any> => fetch(`${API_URL}/labs/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        }).then(handleResponse),
    },
    // Generic helpers
    get: (url: string): Promise<any> =>
        fetch(`${API_URL}${url}`, { headers: getAuthHeaders() }).then(handleResponse),
    post: (url: string, data: any): Promise<any> =>
        fetch(`${API_URL}${url}`, {
            method: 'POST',
            headers: data instanceof FormData ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : getAuthHeaders(),
            body: data instanceof FormData ? data : JSON.stringify(data),
        }).then(handleResponse),
    put: (url: string, data: any): Promise<any> =>
        fetch(`${API_URL}${url}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
    patch: (url: string, data: any): Promise<any> =>
        fetch(`${API_URL}${url}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        }).then(handleResponse),
    delete: (url: string): Promise<any> =>
        fetch(`${API_URL}${url}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        }).then(handleResponse),
    getCache: <T>(resource: string, params?: string): T | null => {
        return cacheManager.get<T>(resource, params);
    },
    setCache: <T>(resource: string, data: T, params?: string, ttl?: number): void => {
        cacheManager.set(resource, data, params, ttl);
    }
};
