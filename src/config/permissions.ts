
import { AppView, User, UserRole } from '../types';

export const PERMISSIONS: Partial<Record<AppView, UserRole[]>> = {
    // --- Operations ---
    DASHBOARD: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    APPOINTMENTS: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    PATIENT_QUEUE: ['Admin', 'Veterinarian', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    TRIAGE: ['Admin', 'Veterinarian', 'Vet Tech', 'Vet Assistant', 'SUPER_ADMIN'],
    ICU_BOARD: ['Admin', 'Veterinarian', 'Vet Tech', 'Vet Assistant', 'SUPER_ADMIN'],
    HOSPITALIZATION: ['Admin', 'Veterinarian', 'Vet Tech', 'Vet Assistant', 'SUPER_ADMIN'],
    SHIFT_TIMETABLE: ['Admin', 'Veterinarian', 'Vet Tech', 'SUPER_ADMIN'],

    // --- Client & Patient ---
    CLIENTS: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    PATIENTS: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    TREATMENTS: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'SUPER_ADMIN'],
    PROCEDURES: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'SUPER_ADMIN'],
    POS: ['Admin', 'Veterinarian', 'Vet Tech', 'Receptionist', 'SUPER_ADMIN'],
    // --- Financials ---
    SALES_HISTORY: ['Admin', 'Veterinarian', 'Receptionist', 'SUPER_ADMIN'],
    EXPENSES: ['Admin', 'Veterinarian', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    FREE_INVOICE: ['Admin', 'Veterinarian', 'Receptionist', 'SUPER_ADMIN'],
    REPORTS: ['Admin', 'SUPER_ADMIN'],

    // --- Pharmacy & Lab ---
    INVENTORY: ['Admin', 'Veterinarian', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    NARCOTICS_LOCKBOX: ['Admin', 'Veterinarian', 'SUPER_ADMIN'],
    CLINICAL_CALCULATORS: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'SUPER_ADMIN'],

    // --- Admin & AI ---
    AI_HUB: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'SUPER_ADMIN'],
    STAFF: ['Admin', 'SUPER_ADMIN'],
    REMINDERS: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    AUDIT_LOG: ['Admin', 'SUPER_ADMIN'],
    BRANCHES: ['Admin', 'SUPER_ADMIN'],
    SETTINGS: ['Admin', 'SUPER_ADMIN'],

    // --- Detail Views ---
    CLIENT_DETAILS: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    PATIENT_DETAILS: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],

    // --- Super Admin ---
    CLINIC_DETAILS: ['SUPER_ADMIN'],
    SUPER_ADMIN: ['SUPER_ADMIN'],

    // --- Portal (open to portal users, handled separately) ---
    PORTAL_DASHBOARD: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    PORTAL_LOGIN: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    PORTAL_INVITE: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    PORTAL_INBOX: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
    SUBSCRIPTION_CALLBACK: ['Admin', 'Veterinarian', 'Lab Scientist', 'Vet Tech', 'Vet Assistant', 'Receptionist', 'SUPER_ADMIN'],
};

export const hasAccess = (user: User | null, view: AppView): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;

    const allowedRoles = PERMISSIONS[view];
    if (!allowedRoles) return false; // DENY by default — new views must be explicitly listed

    return user.roles.some(role => allowedRoles.includes(role));
};
