import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, ArrowLeft, CheckCircle2, Mail, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/apiService';

interface PortalClaimProps {
    onBack: () => void;
    onSuccess: (client?: any) => void;
}

const getInviteTokenFromLocation = () => {
    const pathMatch = window.location.pathname.match(/\/portal\/invite\/([^/]+)/i);
    if (pathMatch?.[1]) {
        return pathMatch[1];
    }

    const params = new URLSearchParams(window.location.search);
    return params.get('invite') || params.get('token') || '';
};

export const PortalClaim: React.FC<PortalClaimProps> = ({ onBack, onSuccess }) => {
    const [token, setToken] = useState('');
    const [invite, setInvite] = useState<any>(null);
    const [loadingInvite, setLoadingInvite] = useState(true);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const discoveredToken = getInviteTokenFromLocation();
        setToken(discoveredToken);

        if (!discoveredToken) {
            setLoadingInvite(false);
            setErrorMessage('This invite link is missing a token. Please open the portal invite from your email.');
            return;
        }

        api.clientAuth.getInvite(discoveredToken)
            .then((response) => {
                setInvite(response.invite);
            })
            .catch((error: any) => {
                setErrorMessage(error?.message || 'We could not load this portal invitation.');
            })
            .finally(() => {
                setLoadingInvite(false);
            });
    }, []);

    const canSubmit = useMemo(() => {
        return !!token && password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword;
    }, [token, password, confirmPassword]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.clientAuth.acceptInvite({ token, password });
            localStorage.setItem('token', response.token);
            localStorage.setItem('client', JSON.stringify(response.client));
            setIsSuccess(true);
            setInvite((prev: any) => prev ? { ...prev, status: 'ACCEPTED' } : prev);
            toast.success('Portal access activated successfully.');
            setTimeout(() => onSuccess(response.client), 1200);
        } catch (error: any) {
            toast.error(error?.message || 'Failed to activate portal access.');
        } finally {
            setIsLoading(false);
        }
    };

    if (loadingInvite) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
                <div className="w-full max-w-[480px] bg-white rounded-[40px] shadow-2xl p-12 text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
                    <p className="mt-6 text-sm font-bold text-slate-500">Checking your client portal invite...</p>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
                <div className="w-full max-w-[480px] bg-white rounded-[40px] shadow-2xl p-12 flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-8">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 mb-4">Portal Ready</h1>
                    <p className="text-slate-500 font-medium mb-10">Your client portal is active and your clinic conversations, pets, and records are ready.</p>
                    <button
                        onClick={() => onSuccess(invite?.client)}
                        className="w-full bg-slate-900 text-white py-6 rounded-[24px] font-black tracking-tight text-lg hover:bg-black transition-all"
                    >
                        Continue to Portal
                    </button>
                </div>
            </div>
        );
    }

    if (errorMessage) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
                <div className="w-full max-w-[520px] bg-white rounded-[40px] shadow-2xl p-10 md:p-14 relative overflow-hidden">
                    <button onClick={onBack} className="absolute top-8 left-8 p-3 hover:bg-slate-50 rounded-2xl text-slate-400 group">
                        <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex flex-col items-center mt-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6">
                            <TriangleAlert className="w-8 h-8" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Invite Unavailable</h1>
                        <p className="text-slate-500 font-medium">{errorMessage}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-[560px] bg-white rounded-[40px] shadow-2xl p-10 md:p-14 relative overflow-hidden">
                <button onClick={onBack} className="absolute top-8 left-8 p-3 hover:bg-slate-50 rounded-2xl text-slate-400 group">
                    <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                </button>

                <div className="flex flex-col items-center mb-10 mt-8">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight text-center mb-3">Activate Client Portal</h1>
                    <p className="text-slate-500 font-medium text-center px-4">
                        Finish setting your password to access your pets, clinic messages, and shared records.
                    </p>
                </div>

                {invite && (
                    <div className="mb-8 rounded-[28px] border border-blue-100 bg-blue-50/70 p-6 space-y-3">
                        <p className="text-xs font-black uppercase tracking-widest text-blue-600">Invite Details</p>
                        <div>
                            <p className="text-lg font-black text-slate-800">
                                {invite.client?.firstName} {invite.client?.lastName}
                            </p>
                            <p className="text-sm font-medium text-slate-500">{invite.clinic?.name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">{invite.client?.email}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-500">
                            Invite expires {new Date(invite.expiresAt).toLocaleString()}.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">New Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-blue-500/20 outline-none transition-all text-slate-900 font-medium"
                                placeholder="Create a secure password"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Confirm Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-blue-500/20 outline-none transition-all text-slate-900 font-medium"
                                placeholder="Repeat your new password"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!canSubmit || isLoading}
                        className="w-full bg-blue-600 text-white py-6 rounded-[24px] font-black tracking-tight text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {isLoading ? 'Activating Portal...' : (
                            <>
                                Activate Portal <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

