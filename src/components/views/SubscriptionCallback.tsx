import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, Crown } from 'lucide-react';
import { API_URL } from '../../services/apiService';
import { toast } from 'sonner';

interface SubscriptionCallbackProps {
    onSuccess: (user: any) => void;
}

/**
 * This page handles the redirect from Flutterwave after payment.
 * Flutterwave calls back to: /subscription/callback?status=successful&tx_ref=...&transaction_id=...
 */
export const SubscriptionCallback: React.FC<SubscriptionCallbackProps> = ({ onSuccess }) => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your payment...');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('status');
        const txRef = params.get('tx_ref');
        const transactionId = params.get('transaction_id');

        if (!paymentStatus || paymentStatus !== 'successful') {
            setStatus('error');
            setMessage('Payment was cancelled or unsuccessful. Please try again.');
            return;
        }

        if (!txRef && !transactionId) {
            setStatus('error');
            setMessage('Invalid payment reference. Please contact support.');
            return;
        }

        // Verify with backend using the stored token (user registered but PendingPayment)
        const verify = async () => {
            try {
                // We need the token from a PendingPayment user — but since they're not logged in yet,
                // we call a public verify endpoint instead.
                const response = await fetch(`${API_URL}/subscription/verify-registration-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ txRef, transactionId }),
                });

                const data = await response.json();

                if (response.ok && data.token) {
                    localStorage.setItem('token', data.token);
                    setStatus('success');
                    setMessage('Payment confirmed! Your account is now active. Welcome to Vet Nexus! 🐾');
                    toast.success('Subscription activated!');
                    setTimeout(() => {
                        onSuccess(data.user);
                    }, 1800);
                } else {
                    setStatus('error');
                    setMessage(data.error || 'Payment verification failed. Please contact support.');
                }
            } catch (err) {
                setStatus('error');
                setMessage('Failed to verify payment. Please contact support.');
            }
        };

        verify();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F2F4F8] p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center space-y-6">
                <div className="flex justify-center">
                    {status === 'loading' && (
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center animate-pulse">
                            <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
                        </div>
                    )}
                    {status === 'success' && (
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-emerald-600" />
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center">
                            <XCircle className="w-10 h-10 text-rose-600" />
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Crown className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Premium Subscription</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-2">
                        {status === 'loading' ? 'Verifying Payment' : status === 'success' ? 'Payment Confirmed!' : 'Payment Issue'}
                    </h2>
                    <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
                </div>

                {status === 'error' && (
                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 transition"
                        >
                            Back to Home
                        </button>
                        <p className="text-xs text-slate-400">
                            If your payment was deducted, contact us at <strong>support@vetnexuspro.com</strong>
                        </p>
                    </div>
                )}

                {status === 'loading' && (
                    <p className="text-xs text-slate-400">Please wait, do not close this page...</p>
                )}
            </div>
        </div>
    );
};
