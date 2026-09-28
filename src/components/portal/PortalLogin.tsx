import React, { useState } from 'react';
import { Dog, ShieldCheck, Mail, Lock, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/apiService';

interface PortalLoginProps {
    onLogin: (clientData: any) => void;
    onViewClaim: () => void;
}

export const PortalLogin: React.FC<PortalLoginProps> = ({ onLogin, onViewClaim }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await api.auth.sharedLogin({ email, password });

            if (response.accountType === 'staff' && response.user) {
                localStorage.removeItem('client');
                toast.success('Redirecting you to the clinic workspace.');
                window.location.href = '/';
                return;
            }

            if (response.accountType === 'client' && response.client) {
                localStorage.setItem('client', JSON.stringify(response.client));
                onLogin(response.client);
                toast.success('Welcome back to your client portal.');
                return;
            }

            if (response.requiresAccountSelection && response.sessions?.client) {
                localStorage.setItem('token', response.sessions.client.token);
                localStorage.setItem('client', JSON.stringify(response.sessions.client.client));
                onLogin(response.sessions.client.client);
                toast.success('Client portal selected for this session.');
                return;
            }

            toast.error('We could not determine the right account for this login.');
        } catch (error: any) {
            toast.error(error?.message || 'Login failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] bg-teal-200/30 rounded-full blur-3xl opacity-70 animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] bg-amber-200/30 rounded-full blur-3xl opacity-70" />
            </div>

            <div className="w-full max-w-[480px] portal-glass-card rounded-[40px] p-8 md:p-12 relative z-10 border border-white/90 shadow-2xl">
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 flex items-center justify-center shadow-xl shadow-teal-600/30 mb-6 transform hover:scale-105 transition-transform duration-300 border border-white/40">
                        <Dog className="w-10 h-10 text-white" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-black uppercase tracking-wider mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Pet Parent Care Portal
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Welcome Back</h1>
                    <p className="text-slate-600 font-medium text-sm mt-1">Manage your pet's clinical care, appointments, and messages.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 ml-1">Email Address</label>
                        <div className="relative group">
                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 bg-white/90 border border-slate-200/80 rounded-[24px] focus:border-teal-400 outline-none transition-all duration-300 text-slate-900 font-bold placeholder:text-slate-400 portal-neo-inset"
                                placeholder="name@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 ml-1">Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 bg-white/90 border border-slate-200/80 rounded-[24px] focus:border-teal-400 outline-none transition-all duration-300 text-slate-900 font-bold placeholder:text-slate-400 portal-neo-inset"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full portal-btn-teal py-5 rounded-[24px] font-black tracking-tight text-base disabled:opacity-50 flex items-center justify-center gap-3 group mt-2"
                    >
                        {isLoading ? 'Signing In...' : (
                            <>
                                Sign In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-200/60 flex flex-col items-center gap-3">
                    <p className="text-slate-500 text-xs font-bold">Need to activate your portal access?</p>
                    <button 
                        onClick={onViewClaim}
                        className="flex items-center gap-1.5 text-teal-700 font-black text-xs hover:text-teal-800 transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" /> Claim portal access with invite link
                    </button>
                </div>

                <div className="mt-6 flex justify-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Encrypted Access</div>
                    <div className="w-1 h-1 rounded-full bg-slate-300 self-center" />
                    <div className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Live Updates</div>
                </div>
            </div>
        </div>
    );
};
