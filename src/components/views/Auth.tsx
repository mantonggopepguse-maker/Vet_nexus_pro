import React, { useState, useEffect } from 'react';
import { Mail, Lock, Building2, Globe, Check, ArrowRight, User, PlayCircle, Loader2, PawPrint, Dog, Cat, Crown, Star, ArrowLeft, Chrome } from 'lucide-react';
import { ClinicSettings } from '../../types';
import { api } from '../../services/apiService';
import { createFirebaseEmailAccount, getFirebaseIdToken, requestFcmToken, signInWithFirebaseEmail, signInWithGoogle } from '../../services/firebaseService';
import { toast } from 'sonner';
import { Logo } from '../shared/Logo';

interface AuthProps {
  onLogin: (settings: Partial<ClinicSettings>) => void;
}

const COUNTRIES = [
  { name: 'Nigeria', currency: '₦', code: 'NG' },
  { name: 'United States', currency: '$', code: 'US' },
  { name: 'United Kingdom', currency: '£', code: 'GB' },
  { name: 'Ghana', currency: '₵', code: 'GH' },
  { name: 'Kenya', currency: 'KSh', code: 'KE' },
  { name: 'Europe', currency: '€', code: 'EU' },
];

const COUNTRY_OPTIONS = [
  { name: 'Nigeria', currency: '\u20A6', code: 'NG' },
  { name: 'United States', currency: '$', code: 'US' },
  { name: 'United Kingdom', currency: '\u00A3', code: 'GB' },
  { name: 'Ghana', currency: '\u20B5', code: 'GH' },
  { name: 'Kenya', currency: 'KSh', code: 'KE' },
  { name: 'Europe', currency: '\u20AC', code: 'EU' },
];

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '', // Admin Name
    clinicName: '',
    clinicAddress: '',
    country: 'Nigeria',
    language: 'English',
    currencySymbol: '₦'
  });

  const [otp, setOtp] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [pendingPaymentUrl, setPendingPaymentUrl] = useState<string | null>(null);
  const [emailExistsError, setEmailExistsError] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isResetFlow, setIsResetFlow] = useState(false);
  const [accountPicker, setAccountPicker] = useState<null | {
    staff: any;
    client: any;
  }>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setInviteCode(code);
      setIsLogin(false);
      setStep(1);
    }

    // Fetch plans
    api.subscription.getPlans()
      .then(data => {
        setPlans(data);
        // Pre-select Free plan if available
        const free = data.find((p: any) => p.name === 'Free');
        if (free) setSelectedPlanId(free.id);
      })
      .catch(console.error);
  }, []);

  const handleCountryChange = (countryName: string) => {
    const selectedCountry = COUNTRY_OPTIONS.find(c => c.name === countryName);
    if (selectedCountry) {
      setFormData({
        ...formData,
        country: countryName,
        currencySymbol: selectedCountry.currency,
        language: countryName === 'Europe' ? 'French' : 'English'
      });
    }
  };

  const handleFinalRegister = async () => {
    setLoading(true);
    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        clinicName: formData.clinicName,
        clinicAddress: formData.clinicAddress,
        country: formData.country,
        language: formData.language,
        currencySymbol: formData.currencySymbol,
        roles: ['Admin'],
        inviteCode: inviteCode || undefined,
        planId: selectedPlanId
      };

      const plan = plans.find(p => p.id === selectedPlanId);
      const isPaid = !!(plan && plan.name !== 'Free');

      if (isPaid) {
        // Use initiate-registration for paid plans (Account created ONLY AFTER payment)
        const response = await api.auth.initiateRegistration(payload);
        if (response.requiresPayment && response.paymentUrl) {
          setPendingPaymentUrl(response.paymentUrl);
          setStep(6);
          toast.success("Redirecting to secure payment...");
          setTimeout(() => {
            window.location.href = response.paymentUrl;
          }, 2000);
        }
        return;
      }

      // Free plan or Invite - Register directly
      const response = await api.auth.register(payload);
      try {
        await createFirebaseEmailAccount(formData.email, formData.password);
      } catch (firebaseError: any) {
        if (firebaseError?.code !== 'auth/email-already-in-use') {
          console.warn('Firebase account could not be created after registration:', firebaseError);
        }
      }
      syncNotifications();
      toast.success("Welcome to Vet Nexus.");
      onLogin(response.user);
    } catch (error: any) {
      toast.error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const syncNotifications = async () => {
    try {
      const token = await requestFcmToken();
      if (token) {
        await api.firebase.registerFcmToken(token);
      }
    } catch (error) {
      console.warn('Notification setup skipped:', error);
    }
  };

  const handleSharedResponse = (response: any) => {
    if (response?.requiresAccountSelection && response?.sessions) {
      setAccountPicker(response.sessions);
      toast.message('Choose which workspace you want to enter for this email.');
      return;
    }

    if (response?.accountType === 'client' && response?.client) {
      localStorage.setItem('client', JSON.stringify(response.client));
      syncNotifications();
      window.location.href = '/portal';
      return;
    }

    if (response?.user) {
      syncNotifications();
      onLogin(response.user);
    }
  };

  const handleFirebaseEmailLogin = async () => {
    try {
      const credential = await signInWithFirebaseEmail(formData.email, formData.password);
      const idToken = await getFirebaseIdToken(credential);
      return api.auth.firebaseLogin(idToken);
    } catch (firebaseError) {
      // Existing Postgres users may not have Firebase accounts yet, so keep a soft fallback during migration.
      return api.auth.sharedLogin({ email: formData.email, password: formData.password });
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const credential = await signInWithGoogle();
      const idToken = await getFirebaseIdToken(credential);
      const response = await api.auth.firebaseLogin(idToken);
      handleSharedResponse(response);
    } catch (error: any) {
      const code = error?.data?.code || error?.code;
      if (code === 'POSTGRES_USER_NOT_FOUND') {
        toast.error('Create your clinic account first, then Google sign-in will work for that email.');
      } else if (code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || 'Google sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin) {
      if (step === 1) {
        setStep(2);
        return;
      }
      if (step === 2) {
        setStep(3);
        return;
      }
      if (step === 3) {
        const plan = plans.find(p => p.id === selectedPlanId);
        if (plan && plan.name !== 'Free') {
          setStep(5); // Summary
        } else {
          handleFinalRegister();
        }
        return;
      }
      return;
    }

    setLoading(true);
    try {
      const response = await handleFirebaseEmailLogin();

      // Handle PendingPayment accounts
      if (response.code === 'PAYMENT_PENDING' || response.paymentUrl) {
        setPendingPaymentUrl(response.paymentUrl || null);
        setIsLogin(false);
        setStep(6);
        toast.error('Your account is pending payment. Please complete your subscription.');
        return;
      }

      handleSharedResponse(response);
    } catch (error: any) {
      // Check if the error response has a payment URL
      const errData = error?.data || {};
      if (errData.code === 'PAYMENT_PENDING' && errData.paymentUrl) {
        setPendingPaymentUrl(errData.paymentUrl);
        setIsLogin(false);
        setStep(6);
        toast.error('Payment required to access your account.');
        return;
      }
      toast.error(error.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    try {
      const res = await api.auth.forgotPassword(formData.email);
      setResetEmail(res.email || formData.email);
      toast.success(res.message);
      setStep(8);
    } catch (error: any) {
      toast.error(error.message || "Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      await api.auth.resetPassword({
        email: resetEmail,
        code: otp,
        newPassword: newPassword
      });
      toast.success("Password reset successful! Please login.");
      setIsResetFlow(false);
      setIsLogin(true);
      setStep(1);
      setOtp('');
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const response = await api.auth.login({ email: 'admin@vetnexus.com', password: 'admin123' });
      syncNotifications();
      onLogin(response.user);
    } catch (error: any) {
      toast.error("Unable to launch demo account at this time. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modern-shell min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Animated Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="auth-orb auth-orb-a animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="auth-orb auth-orb-b animate-pulse" style={{ animationDuration: '10s' }}></div>
        {/* Floating Icons */}
        <div className="absolute top-20 left-20 text-[#596B48]/15 animate-bounce" style={{ animationDuration: '3s' }}><Dog className="w-12 h-12" /></div>
        <div className="absolute bottom-40 right-20 text-[#6F805E]/15 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}><Cat className="w-10 h-10" /></div>
        <div className="absolute top-40 right-1/4 text-[#596B48]/15 animate-bounce" style={{ animationDuration: '5s', animationDelay: '0.5s' }}><PawPrint className="w-8 h-8" /></div>
      </div>

      <div className={`auth-modern-card auth-glass-card w-full ${isLogin ? 'max-w-[26rem]' : 'max-w-2xl'} min-h-[650px] relative z-10 transition-all duration-500`}>

        <div className={`auth-form-panel auth-glass-panel ${isLogin ? 'p-5 sm:p-6 md:p-7' : 'p-6 sm:p-8 md:p-12'} flex flex-col relative transition-all duration-500`}>
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="auth-logo-shell auth-logo-glass">
                  <Logo />
                </div>
                <div>
                  <span className="text-xl font-extrabold tracking-tight text-slate-800 block">Vet Nexus</span>
                  {!isLogin && <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Clinic account</span>}
                </div>
              </div>
              {isLogin && (
                <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/40 backdrop-blur-xl px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-700 shadow-[0_12px_30px_rgba(148,163,184,0.16)]">
                  Secure
                </div>
              )}
            </div>

            {!isLogin && <span className="auth-eyebrow">New workspace</span>}
            <h1 className={`font-extrabold text-slate-800 tracking-tight ${isLogin ? 'text-2xl md:text-3xl mt-2 mb-2' : 'text-3xl md:text-4xl mt-3 mb-3'}`}>
              {isLogin ? 'Sign in' : (
                step === 1 ? 'Set up your clinic' :
                  step === 2 ? 'Choose Your Plan' : 'Final Details'
              )}
            </h1>
            <p className="text-slate-500 font-semibold leading-relaxed">
              {isLogin ? 'Use your email and password to continue.' : (
                step === 1 ? 'Add your clinic details so your workspace feels ready from day one.' :
                  step === 2 ? 'Pick the plan that fits your team.' : 'Create your admin login.'
              )}
            </p>

            {/* Step Indicators */}
            {!isLogin && (
              <div className="mt-6 flex gap-2">
                {[1, 2, 3, 5, 6].map(i => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-[#14B8A6]' : 'bg-slate-100'}`}></div>
                ))}
              </div>
            )}

            {inviteCode && !isLogin && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-bold border border-amber-100">
                <Check className="w-4 h-4" />
                <span>Special Invite Applied</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <div className="flex-1">
              {isLogin ? (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="group">
                    <div className="relative transition-all duration-300 group-focus-within:-translate-y-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 transition-colors group-focus-within:text-[#14B8A6]" />
                      <input
                        type="email"
                        required
                        placeholder="Email"
                        className="w-full auth-neo-input pl-12 pr-4"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="group">
                    <div className="relative transition-all duration-300 group-focus-within:-translate-y-1">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 transition-colors group-focus-within:text-[#14B8A6]" />
                      <input
                        type="password"
                        required
                        placeholder="Password"
                        className="w-full auth-neo-input pl-12 pr-4"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => { setIsResetFlow(true); setIsLogin(false); setStep(7); }}
                      className="text-xs font-bold text-[#14B8A6] hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  {accountPicker && (
                    <div className="rounded-[1.6rem] border border-white/70 bg-white/50 backdrop-blur-2xl p-4 space-y-3 shadow-[0_20px_40px_rgba(148,163,184,0.16)]">
                      <p className="text-sm font-bold text-slate-700">This email belongs to both a clinic workspace and a client portal.</p>
                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setAccountPicker(null);
                            localStorage.setItem('token', accountPicker.staff.token);
                            syncNotifications();
                            onLogin(accountPicker.staff.user);
                          }}
                          className="w-full rounded-2xl bg-white/75 border border-white/70 px-4 py-3 text-left shadow-[0_12px_26px_rgba(148,163,184,0.12)] transition hover:bg-white"
                        >
                          <span className="block text-xs font-black uppercase tracking-widest text-[#14B8A6]">Clinic Staff</span>
                          <span className="block text-sm font-bold text-slate-700">{accountPicker.staff.user?.name || formData.email}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAccountPicker(null);
                            localStorage.setItem('token', accountPicker.client.token);
                            localStorage.setItem('client', JSON.stringify(accountPicker.client.client));
                            syncNotifications();
                            window.location.href = '/portal';
                          }}
                          className="w-full rounded-2xl bg-white/75 border border-white/70 px-4 py-3 text-left shadow-[0_12px_26px_rgba(148,163,184,0.12)] transition hover:bg-white"
                        >
                          <span className="block text-xs font-black uppercase tracking-widest text-[#14B8A6]">Client Portal</span>
                          <span className="block text-sm font-bold text-slate-700">
                            {accountPicker.client.client?.firstName} {accountPicker.client.client?.lastName}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {step === 1 && (
                    <div className="space-y-4 animate-fade-in-right">
                      <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-[#14B8A6]" />
                        <input
                          type="text"
                          required
                          placeholder="Clinic Name"
                          className="w-full auth-neo-input pl-12 pr-4"
                          value={formData.clinicName}
                          onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                        />
                      </div>
                      <div className="relative group">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-[#14B8A6]" />
                        <input
                          type="text"
                          required
                          placeholder="Clinic Address"
                          className="w-full auth-neo-input pl-12 pr-4"
                          value={formData.clinicAddress}
                          onChange={(e) => setFormData({ ...formData, clinicAddress: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative group">
                          <select
                            className="w-full auth-neo-input px-4 appearance-none cursor-pointer"
                            value={formData.country}
                            onChange={(e) => handleCountryChange(e.target.value)}
                          >
                            {COUNTRY_OPTIONS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            readOnly
                            className="w-full auth-neo-input auth-neo-input-muted px-4 text-center cursor-not-allowed"
                            value={`${formData.currencySymbol} • ${formData.language}`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4 animate-fade-in-right">
                      <div className="grid gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {plans.map((plan: any) => {
                          const isSelected = selectedPlanId === plan.id;
                          const isPro = plan.name === 'Premium';
                          return (
                            <div
                              key={plan.id}
                              onClick={() => setSelectedPlanId(plan.id)}
                              className={`
                                    relative p-4 rounded-2xl border-2 transition-all cursor-pointer group hover:shadow-md
                                    ${isSelected
                                  ? 'border-amber-500 bg-amber-50/50'
                                  : 'border-slate-100 bg-white hover:border-amber-200'}
                                `}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                  {isPro ? <Crown className="w-5 h-5 text-amber-500 fill-amber-500" /> : <Star className="w-5 h-5 text-slate-400" />}
                                  <h3 className={`font-bold ${isSelected ? 'text-amber-700' : 'text-slate-700'}`}>{plan.displayName}</h3>
                                </div>
                                <div className="text-right">
                                  <span className={`text-lg font-bold ${isSelected ? 'text-amber-700' : 'text-slate-900'}`}>
                                    {new Intl.NumberFormat('en-NG', { style: 'currency', currency: plan.currency }).format(plan.priceMonthly)}
                                  </span>
                                  <span className="text-xs text-slate-500 block">/month</span>
                                </div>
                              </div>

                              <ul className="text-xs space-y-1 mb-0 border-t border-dashed border-slate-200 pt-2 mt-2">
                                {isPro ? (
                                  <>
                                    <li className="flex items-center gap-1.5 text-slate-600"><Check className="w-3 h-3 text-green-500" /> Unlimited Clients & Patients</li>
                                    <li className="flex items-center gap-1.5 text-slate-600"><Check className="w-3 h-3 text-green-500" /> AI Features & Analytics</li>
                                  </>
                                ) : (
                                  <>
                                    <li className="flex items-center gap-1.5 text-slate-600"><Check className="w-3 h-3 text-green-500" /> Up to {plan.maxClients} Clients</li>
                                    <li className="flex items-center gap-1.5 text-slate-600"><Check className="w-3 h-3 text-green-500" /> Basic Features</li>
                                  </>
                                )}
                              </ul>

                              {isSelected && (
                                <div className="absolute top-4 right-4 animate-scale-in">
                                  <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white stroke-[3px]" />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-slate-400 text-sm font-bold hover:text-amber-600 transition-colors flex items-center gap-1"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to details
                      </button>
                    </div>
                  )}

                  {step === 3 && (
                        <div className="space-y-4 animate-fade-in-right">
                      <div className="group relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-[#14B8A6]" />
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          className="w-full auth-neo-input pl-12 pr-4"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div className="group relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-[#14B8A6]" />
                        <input
                          type="text"
                          required
                          placeholder="Email Address"
                          className="w-full auth-neo-input pl-12 pr-4"
                          value={formData.email}
                          onChange={(e) => {
                            setFormData({ ...formData, email: e.target.value });
                            if (emailExistsError) setEmailExistsError(false);
                          }}
                        />
                      </div>
                      <div className="group relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-[#14B8A6]" />
                        <input
                          type="password"
                          required
                          placeholder="Password"
                          className="w-full auth-neo-input pl-12 pr-4"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                      </div>

                      {emailExistsError && (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center animate-fade-in">
                          <p className="text-sm font-bold text-rose-800 mb-2">This email is already registered!</p>
                          <p className="text-xs text-rose-600 mb-3">If this is you, please log in to continue or reset your password.</p>
                          <button
                            type="button"
                            onClick={() => { setIsLogin(true); setStep(1); }}
                            className="bg-rose-600 text-white text-sm font-bold py-2 px-6 rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
                          >
                            Log In Now
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-slate-400 text-sm font-bold hover:text-amber-600 transition-colors flex items-center gap-1"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to plans
                      </button>
                    </div>
                  )}



                  {step === 5 && (
                    <div className="space-y-6 animate-fade-in-right">
                      <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Crown className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Complete Payment</h3>
                        <p className="text-sm text-slate-500">Your account will be activated immediately after payment.</p>
                      </div>

                        <div className="rounded-[1.7rem] bg-white/50 backdrop-blur-2xl p-6 border border-white/70 shadow-[0_22px_44px_rgba(148,163,184,0.16)]">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-slate-500 font-medium">Selected Plan</span>
                          <span className="font-bold text-slate-800">{plans.find(p => p.id === selectedPlanId)?.displayName}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg">
                          <span className="text-slate-700 font-bold">Total Due</span>
                          <span className="font-black text-amber-700">
                            {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(plans.find(p => p.id === selectedPlanId)?.priceMonthly || 0)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-3 text-center">Billed monthly • Cancel anytime</p>
                      </div>

                      <button
                        type="button"
                        onClick={handleFinalRegister}
                        disabled={loading}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account & Pay Securely'}
                      </button>

                      <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-widest">Powered by Flutterwave</p>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="text-slate-400 text-sm font-bold hover:text-amber-600 transition-colors flex items-center gap-1 mx-auto mt-2"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to details
                      </button>
                    </div>
                  )}

                  {step === 6 && (
                    <div className="space-y-6 animate-fade-in-right">
                      <div className="text-center space-y-2">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                          <Crown className="w-10 h-10 text-amber-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Payment Required</h3>
                        <p className="text-sm text-slate-500">
                          Your account is ready! Complete your payment to activate your Premium subscription.
                        </p>
                      </div>

                        <div className="bg-white/55 backdrop-blur-2xl border border-white/70 rounded-2xl p-4 text-center shadow-[0_18px_36px_rgba(148,163,184,0.14)]">
                        <p className="text-sm font-bold text-amber-800">Account awaiting payment activation</p>
                        <p className="text-xs text-amber-600 mt-1">You will be redirected to Flutterwave to complete payment.</p>
                      </div>

                      {pendingPaymentUrl && (
                        <a
                          href={pendingPaymentUrl}
                          className="w-full block text-center bg-gradient-to-r from-amber-600 to-amber-600 text-white py-4 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-amber-200"
                        >
                          Proceed to secure payment
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => { setIsLogin(true); setStep(1); }}
                        className="w-full text-slate-500 text-sm font-bold hover:text-amber-600 transition-colors"
                      >
                        Already paid? Sign In
                      </button>
                    </div>
                  )}

                  {step === 7 && (
                    <div className="space-y-6 animate-fade-in-right">
                      <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Lock className="w-8 h-8 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Forgot Password</h3>
                        <p className="text-sm text-slate-500">Enter your email to receive a reset code.</p>
                      </div>

                      <div className="group relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-amber-500" />
                        <input
                          type="email"
                          required
                          placeholder="Email Address"
                          className="w-full auth-neo-input pl-12 pr-4"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={loading || !formData.email}
                        className="w-full bg-amber-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Code'}
                      </button>

                      <div className="text-center">
                        <button type="button" onClick={() => { setIsLogin(true); setIsResetFlow(false); setStep(1); }} className="text-sm font-bold text-slate-400 hover:text-amber-600 transition-colors flex items-center justify-center gap-1 mx-auto">
                          <ArrowLeft className="w-4 h-4" /> Back to Login
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 8 && (
                    <div className="space-y-6 animate-fade-in-right">
                      <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Lock className="w-8 h-8 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Reset Password</h3>
                        <p className="text-sm text-slate-500">Enter the 6-digit code sent to <span className="font-bold">{resetEmail}</span></p>
                      </div>

                      <div className="relative group">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="000000"
                          className="w-full auth-neo-input px-4 text-3xl text-center tracking-[0.5em] font-black"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>

                      <div className="group relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-amber-500" />
                        <input
                          type="password"
                          required
                          placeholder="New Password"
                          className="w-full auth-neo-input pl-12"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={otp.length !== 6 || !newPassword || loading}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
                      </button>

                      <div className="text-center">
                        <button type="button" onClick={() => setStep(7)} className="text-sm font-bold text-slate-400 hover:text-amber-600">Didn't get code? Retry</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step < 4 || (isResetFlow && step === 7) ? (
                <div className="mt-6">
                  {isResetFlow ? null : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full btn-luminous btn-luminous-emerald py-4"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                           {isLogin ? 'Sign In' : (
                            step === 1 ? 'Next: Choose Plan' :
                              step === 2 ? 'Next: Account' : 
                                (plans.find(p => p.id === selectedPlanId)?.name === 'Free' ? 'Create Account' : 'Review & Pay')
                          )}
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : null}

              {isLogin && (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="mt-3 w-full rounded-2xl border border-white/70 bg-white/55 px-4 py-3.5 text-sm font-extrabold text-slate-700 shadow-[inset_8px_8px_18px_rgba(148,163,184,0.16),inset_-8px_-8px_18px_rgba(255,255,255,0.82),0_14px_30px_rgba(148,163,184,0.14)] transition hover:-translate-y-0.5 hover:bg-white/70 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Chrome className="w-5 h-5 text-[#EA4335]" />
                  Continue with Google
                </button>
              )}

              {isLogin && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(false);
                      setStep(1);
                      setAccountPicker(null);
                      setFormData({ ...formData, email: '', password: '' });
                    }}
                    className="text-sm font-bold text-teal-600 hover:underline underline-offset-4"
                  >
                    Create an account
                  </button>
                </div>
              )}

              {isLogin && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={loading}
                    className="text-sm font-bold text-[#3B82F6] hover:underline underline-offset-4 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Launch Demo Account'}
                  </button>
                </div>
              )}
            </div>
          </form>

          {!isLogin && (
            <div className="mt-6 text-center">
              <p className="text-slate-500 font-medium">
                Already have an account?
                <button
                  onClick={() => {
                    setIsLogin(true);
                    setStep(1);
                    setAccountPicker(null);
                    setFormData({ ...formData, email: '', password: '' });
                  }}
                  className="ml-2 text-teal-600 font-bold hover:underline underline-offset-4"
                >
                  Sign In
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile-only background hint */}
      <div className="absolute bottom-4 left-0 w-full text-center md:hidden text-slate-400 text-xs">
        Vet Nexus &copy; 2026
      </div>
    </div>
  );
};
