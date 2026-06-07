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
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-blue-100/50 rounded-full blur-3xl opacity-60 animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-amber-100/50 rounded-full blur-3xl opacity-60" />
            </div>

            <div className="w-full max-w-[480px] bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] p-10 md:p-14 relative z-10 border border-white">
                <div className="flex flex-col items-center mb-12">
                    <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-blue-600 to-amber-600 flex items-center justify-center shadow-xl shadow-blue-200 mb-8 transform hover:scale-105 transition-transform duration-300">
                        <Dog className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight text-center mb-3">Pet Parent Portal</h1>
                    <p className="text-slate-500 font-medium text-center">Manage your furry family's clinical journey.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                        <div className="relative group">
                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-blue-500/20 outline-none transition-all duration-300 text-slate-900 font-medium placeholder:text-slate-400"
                                placeholder="name@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] focus:bg-white focus:border-blue-500/20 outline-none transition-all duration-300 text-slate-900 font-medium placeholder:text-slate-400"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-slate-900 text-white py-6 rounded-[24px] font-black tracking-tight text-lg hover:bg-black active:scale-[0.98] transition-all duration-300 shadow-xl shadow-slate-200 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 group"
                    >
                        {isLoading ? 'Entering Portal...' : (
                            <>
                                Sign In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
                    <p className="text-slate-400 text-sm font-medium">Need to activate your portal access first?</p>
                    <button 
                        onClick={onViewClaim}
                        className="flex items-center gap-2 text-blue-600 font-bold hover:text-blue-700 transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" /> Use your invite link
                    </button>
                </div>

                <div className="mt-8 flex justify-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Secure Access</div>
                    <div className="w-1 h-1 rounded-full bg-slate-300 self-center" />
                    <div className="flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> AI Enhanced</div>
                </div>
            </div>
        </div>
    );
};
