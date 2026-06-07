import { useState, useEffect } from 'react';
import { Crown, Check, X, Loader2, AlertTriangle, Calendar } from 'lucide-react';

interface SubscriptionPlan {
    id: string;
    name: string;
    displayName: string;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    features: {
        googleDrive: boolean;
        aiFeatures: boolean;
        advancedReports: boolean;
        prioritySupport: boolean;
        customBranding: boolean;
        hospitalFeatures?: boolean;
        multiBranch?: boolean;
    };
    maxClients: number | null;
    maxPatients: number | null;
    maxStaff: number | null;
}

interface Subscription {
    id: string;
    status: string;
    billingCycle: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    plan: SubscriptionPlan;
}

interface Usage {
    clients: { current: number; limit: number | null };
    patients: { current: number; limit: number | null };
    staff: { current: number; limit: number | null };
}

interface SubscriptionPlansProps {
    token: string;
    apiUrl: string;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function SubscriptionPlans({ token, apiUrl, showToast }: SubscriptionPlansProps) {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [downgrading, setDowngrading] = useState(false);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const headers = { Authorization: `Bearer ${token}` };

            const [plansRes, subRes, usageRes] = await Promise.all([
                fetch(`${apiUrl}/subscription/plans`, { headers }),
                fetch(`${apiUrl}/subscription/current`, { headers }),
                fetch(`${apiUrl}/subscription/usage`, { headers })
            ]);

            if (plansRes.ok) {
                const plansData = await plansRes.json();
                setPlans(plansData);
            }

            if (subRes.ok) {
                const subData = await subRes.json();
                setSubscription(subData);
            }

            if (usageRes.ok) {
                const usageData = await usageRes.json();
                setUsage(usageData.usage);
            }
        } catch (error) {
            console.error('Error fetching subscription data:', error);
            showToast('Failed to load subscription information', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (planId: string) => {
        setUpgrading(true);
        try {
            const response = await fetch(`${apiUrl}/subscription/upgrade/initialize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ billingCycle, planId })
            });

            const data = await response.json();

            if (response.ok && data.paymentUrl) {
                // Redirect to Flutterwave payment page
                window.location.href = data.paymentUrl;
            } else {
                showToast(data.error || 'Failed to initialize payment', 'error');
            }
        } catch (error) {
            console.error('Error initializing upgrade:', error);
            showToast('Failed to start upgrade process', 'error');
        } finally {
            setUpgrading(false);
        }
    };

    const handleDowngrade = async () => {
        if (!confirm(`Are you sure you want to change plans? Your ${subscription?.plan?.displayName || 'current'} plan access will remain available until the end of your current billing period.`)) {
            return;
        }

        setDowngrading(true);
        try {
            const response = await fetch(`${apiUrl}/subscription/downgrade`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (response.ok) {
                showToast('Downgrade scheduled successfully', 'success');
                fetchData();
            } else {
                showToast(data.error || 'Failed to schedule downgrade', 'error');
            }
        } catch (error) {
            console.error('Error scheduling downgrade:', error);
            showToast('Failed to schedule downgrade', 'error');
        } finally {
            setDowngrading(false);
        }
    };

    const handleCancelDowngrade = async () => {
        try {
            const response = await fetch(`${apiUrl}/subscription/downgrade/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (response.ok) {
                showToast('Downgrade cancelled', 'success');
                fetchData();
            } else {
                showToast(data.error || 'Failed to cancel downgrade', 'error');
            }
        } catch (error) {
            console.error('Error cancelling downgrade:', error);
            showToast('Failed to cancel downgrade', 'error');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        if (d.getFullYear() > 2099) return 'Lifetime';
        return d.toLocaleDateString('en-NG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const currentPlanName = subscription?.plan?.name || 'Free';
    const currentPlanDisplayName = subscription?.plan?.displayName || 'Current Plan';
    
    const sortedPlans = [...plans].sort((a, b) => (a.priceMonthly || 0) - (b.priceMonthly || 0));
    const highestPlanPrice = sortedPlans[sortedPlans.length - 1]?.priceMonthly || 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Current Status Banner */}
            {subscription?.status === 'past_due' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-amber-800">Payment Past Due</h4>
                        <p className="text-sm text-amber-700">
                            Your last payment failed. Please update your payment method to avoid service interruption.
                        </p>
                    </div>
                </div>
            )}

            {subscription?.cancelAtPeriodEnd && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-blue-800">Downgrade Scheduled</h4>
                            <p className="text-sm text-blue-700">
                                Your {currentPlanDisplayName} subscription will end on {formatDate(subscription.currentPeriodEnd)}.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCancelDowngrade}
                        className="text-sm text-blue-700 hover:text-blue-800 underline"
                    >
                        Cancel downgrade
                    </button>
                </div>
            )}

            {/* Usage Summary */}
            {usage && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-6">Current Usage</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:shadow-md">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clients</span>
                                    <div className="text-xs font-black text-slate-700">
                                        {usage.clients.current} / {usage.clients.limit ?? '\u221E'}
                                    </div>
                                </div>
                                <div className="mt-2 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-500 to-amber-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${usage.clients.limit ? Math.min((usage.clients.current / usage.clients.limit) * 100, 100) : 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:shadow-md">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Patients</span>
                                    <div className="text-xs font-black text-slate-700">
                                        {usage.patients.current} / {usage.patients.limit ?? '\u221E'}
                                    </div>
                                </div>
                                <div className="mt-2 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-amber-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${usage.patients.limit ? Math.min((usage.patients.current / usage.patients.limit) * 100, 100) : 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:shadow-md">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Staff Members</span>
                                    <div className="text-xs font-black text-slate-700">
                                        {usage.staff.current} / {usage.staff.limit ?? '\u221E'}
                                    </div>
                                </div>
                                <div className="mt-2 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-500 to-peach-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${usage.staff.limit ? Math.min((usage.staff.current / usage.staff.limit) * 100, 100) : 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Billing Cycle Toggle */}
            <div className="flex justify-center">
                <div className="inline-flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${billingCycle === 'monthly'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        MONTHLY
                    </button>
                    <button
                        onClick={() => setBillingCycle('yearly')}
                        className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all relative ${billingCycle === 'yearly'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        YEARLY
                        <span className="absolute -top-3 -right-3 bg-emerald-500 text-white text-[8px] px-2 py-0.5 rounded-full animate-bounce">
                            SAVE 17%
                        </span>
                    </button>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {sortedPlans.map(plan => {
                    const isCurrent = currentPlanName === plan.name;
                    const isHigher = (plan.priceMonthly || 0) > (subscription?.plan?.priceMonthly || 0);
                    const isTopTier = plan.name === 'Standard';
                    
                    return (
                        <div key={plan.id} className={`soft-card p-6 flex flex-col relative transition-all duration-300 ${isTopTier ? 'border-2 border-amber-400 bg-amber-50/10 shadow-xl scale-105 z-10' : 'border border-slate-100 bg-white hover:border-slate-300 hover:shadow-lg'}`}>
                            {isTopTier && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg flex items-center gap-1 whitespace-nowrap">
                                    ⭐ Most Popular
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">{plan.displayName}</h3>
                                <div className="mt-4 flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-slate-900">
                                        {formatCurrency(billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly)}
                                    </span>
                                    <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                                    </span>
                                </div>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    <span>{plan.maxStaff === null ? 'UNLIMITED' : plan.maxStaff} Staff Members</span>
                                </li>
                                <li className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    <span>{plan.maxClients === null ? 'UNLIMITED' : plan.maxClients} Clients</span>
                                </li>
                                {plan.features.aiFeatures && (
                                    <li className="flex items-center gap-3 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                        <Check className="w-4 h-4" />
                                        <span>AI Scribe & Diagnostics</span>
                                    </li>
                                )}
                                {plan.features.hospitalFeatures && (
                                    <li className="flex items-center gap-3 text-xs font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                                        <Crown className="w-4 h-4" />
                                        <span>ICU & Shift Timetable</span>
                                    </li>
                                )}
                                {plan.features.multiBranch && (
                                    <li className="flex items-center gap-3 text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                                        <Check className="w-4 h-4" />
                                        <span>Multi-Branch Support</span>
                                    </li>
                                )}
                            </ul>

                            {isCurrent ? (
                                <div className="w-full py-4 text-center text-slate-400 font-black text-xs uppercase tracking-[0.25em] bg-slate-50 border border-slate-100 rounded-2xl">
                                    Active Plan
                                </div>
                            ) : plan.name === 'Free' ? (
                                <button
                                    onClick={handleDowngrade}
                                    disabled={downgrading}
                                    className="w-full py-4 text-slate-600 font-black text-xs uppercase tracking-[0.25em] border-2 border-slate-100 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {downgrading ? 'Processing...' : 'Downgrade'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleUpgrade(plan.id)}
                                    disabled={upgrading}
                                    className={`w-full py-4 rounded-2xl font-black text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 ${isHigher 
                                        ? 'bg-slate-900 text-white hover:bg-slate-800' 
                                        : 'bg-white border-2 border-slate-100 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {upgrading ? 'Connecting...' : isHigher ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
