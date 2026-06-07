import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface SubscriptionCallbackProps {
    token: string;
    apiUrl: string;
    onSuccess: () => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function SubscriptionCallback({ token, apiUrl, onSuccess, showToast }: SubscriptionCallbackProps) {
    const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
    const [message, setMessage] = useState('Verifying your payment...');

    useEffect(() => {
        const verifyPayment = async () => {
            const searchParams = new URLSearchParams(window.location.search);
            const txRef = searchParams.get('tx_ref');
            const transactionId = searchParams.get('transaction_id');
            const flwStatus = searchParams.get('status');

            if (flwStatus === 'cancelled') {
                setStatus('failed');
                setMessage('Payment was cancelled');
                return;
            }

            if (!txRef && !transactionId) {
                setStatus('failed');
                setMessage('Invalid payment callback');
                return;
            }

            try {
                const response = await fetch(`${apiUrl}/subscription/upgrade/verify`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ txRef, transactionId })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    setStatus('success');
                    setMessage('Your subscription has been upgraded successfully!');
                    showToast('Subscription updated successfully!', 'success');
                    setTimeout(() => onSuccess(), 2000);
                } else {
                    setStatus('failed');
                    setMessage(data.error || 'Payment verification failed');
                    showToast(data.error || 'Payment verification failed', 'error');
                }
            } catch (error) {
                console.error('Verification error:', error);
                setStatus('failed');
                setMessage('An error occurred while verifying your payment');
                showToast('Payment verification error', 'error');
            }
        };

        verifyPayment();
    }, [token, apiUrl, onSuccess, showToast]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
                {status === 'verifying' && (
                    <>
                        <Loader2 className="w-16 h-16 mx-auto mb-4 text-peach-600 animate-spin" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Payment</h2>
                        <p className="text-gray-600">{message}</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
                        <p className="text-gray-600">{message}</p>
                        <p className="text-sm text-gray-500 mt-4">Redirecting you back...</p>
                    </>
                )}

                {status === 'failed' && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                            <XCircle className="w-10 h-10 text-red-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
                        <p className="text-gray-600 mb-6">{message}</p>
                        <button
                            onClick={onSuccess}
                            className="bg-peach-600 hover:bg-peach-700 text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            Return to Dashboard
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
