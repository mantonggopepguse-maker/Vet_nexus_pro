import React from 'react';
import { Crown, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { User } from '../../types';

interface PremiumGateProps {
    children: React.ReactNode;
    user: User | null;
    featureName: string;
    featureKey?: 'hospitalFeatures' | 'multiBranch' | 'aiFeatures' | 'advancedReports' | 'customBranding';
    description?: string;
}

export const PremiumGate: React.FC<PremiumGateProps> = ({ children, user, featureName, featureKey, description }) => {
    // Check if the user is a Super Admin (can bypass all gates)
    const isSuperAdmin = user?.isSuperAdmin === true;
    
    // Check if the clinic has the required feature enabled
    // Default to 'hospitalFeatures' if no specific key is provided
    const key = featureKey || (featureName === 'Multi-Branch Network' ? 'multiBranch' : 'hospitalFeatures');
    const hasFeature = user?.clinic?.subscription?.plan?.features?.[key] === true;

    // Safety check: is the user on the highest possible plan (Premium)?
    const isHighestPlan = user?.clinic?.subscription?.plan?.name === 'Premium';

    if (isSuperAdmin || hasFeature || isHighestPlan) {
        return <>{children}</>;
    }

    return (
        <div className="relative group overflow-hidden">
            {/* Blurrable Content */}
            <div className="blur-[8px] pointer-events-none select-none opacity-40 transition-all duration-500">
                {children}
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center p-6 z-20">
                <div className="premium-glass-neo p-8 rounded-[2.5rem] border border-white/60 shadow-2xl max-w-sm text-center animate-fade-in-up">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-200 rotate-3 group-hover:rotate-0 transition-transform">
                        <Crown className="w-8 h-8 text-white" />
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Lock className="w-4 h-4 text-slate-400" />
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Plan Upgrade Required</h3>
                    </div>
                    
                    <h2 className="text-2xl font-black text-slate-900 mb-3">{featureName}</h2>
                    
                    <p className="text-slate-500 font-bold text-sm mb-8 leading-relaxed">
                        {description || `Unlock advanced tools and expanded clinic capabilities for your growing practice.`}
                    </p>

                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: { view: 'SETTINGS', section: 'subscription' } }))}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 ease-out flex items-center justify-center gap-3"
                    >
                        Manage Subscription
                        <ArrowRight className="w-5 h-5" />
                    </button>
                    
                    <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Secure Payment by Flutterwave
                    </div>
                </div>
            </div>
            
            {/* Background elements */}
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>
    );
};
