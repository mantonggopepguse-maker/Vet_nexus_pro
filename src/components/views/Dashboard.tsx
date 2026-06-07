import React from 'react';
import { ClinicSettings, User, AppView } from '../../types';
import { AdminDashboard } from '../dashboards/AdminDashboard';
import { ClinicalDashboard } from '../dashboards/ClinicalDashboard';
import { FrontDeskDashboard } from '../dashboards/FrontDeskDashboard';

interface DashboardProps {
    settings: ClinicSettings;
    user?: User | null;
    onNavigate: (view: AppView) => void;
    onLogout?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = (props) => {
    const roles = props.user?.roles || [];
    const isSuperAdmin = props.user?.isSuperAdmin;

    // Admin / Owner Dashboard (Full Access to Financials)
    if (isSuperAdmin || roles.includes('Admin')) {
        return <AdminDashboard {...props} />;
    }

    // Clinical Dashboard (Vets & Techs - Focus on Medical Activity)
    if (roles.includes('Veterinarian') || roles.includes('Vet Tech') || roles.includes('Vet Assistant') || roles.includes('Lab Scientist')) {
        return <ClinicalDashboard {...props} />;
    }

    // Front Desk Dashboard (Receptionists - Focus on Flow & Schedule)
    if (roles.includes('Receptionist')) {
        return <FrontDeskDashboard {...props} />;
    }

    // Fallback if role is empty or completely unknown (Safest view is Front Desk)
    return <FrontDeskDashboard {...props} />;
};
