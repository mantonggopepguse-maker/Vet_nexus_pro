import Flutterwave from 'flutterwave-node-v3';

const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY || '',
  process.env.FLUTTERWAVE_SECRET_KEY || ''
);

export interface PaymentInitData {
  amount: number;
  email: string;
  name: string;
  clinicId: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  redirectUrl: string;
  metadata?: Record<string, any>;
  flwPaymentPlanId?: string; // Flutterwave recurring payment plan ID
}

export interface FlutterwavePaymentResponse {
  status: string;
  message: string;
  data: {
    link: string;
    tx_ref: string;
  };
}

/**
 * Initialize a payment for subscription via Flutterwave Standard Checkout.
 * Pass flwPaymentPlanId to attach a recurring payment plan so Flutterwave
 * auto-charges the customer on the next billing cycle.
 */
export async function initializePayment(data: PaymentInitData): Promise<FlutterwavePaymentResponse> {
  const txRef = `PV-SUB-${data.clinicId}-${Date.now()}`;

  const payload: any = {
    tx_ref: txRef,
    amount: data.amount,
    currency: 'NGN',
    redirect_url: data.redirectUrl,
    payment_options: 'card',
    customer: {
      email: data.email,
      name: data.name,
    },
    customizations: {
      title: 'Vet Nexus Pro',
      description: `${data.billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} ${data.metadata?.planName || 'Pro'} Plan`,
      logo: 'https://app.vetnexuspro.com/logo192.png',
    },
    meta: {
      clinicId: data.clinicId,
      planId: data.planId,
      billingCycle: data.billingCycle,
      ...(data.metadata || {}),
    },
  };

  // Attach Flutterwave recurring payment plan for automatic re-billing
  if (data.flwPaymentPlanId) {
    payload.payment_plan = data.flwPaymentPlanId;
  }

  try {
    const response = await (flw as any).Standard.initialize(payload);
    return {
      status: response.status,
      message: response.message,
      data: {
        link: response.data?.link || '',
        tx_ref: txRef,
      },
    };
  } catch (error: any) {
    console.error('Flutterwave payment initialization error:', error);
    throw new Error(`Payment initialization failed: ${error.message}`);
  }
}

/**
 * Verify a transaction by ID
 */
export async function verifyTransaction(transactionId: string): Promise<any> {
  try {
    const response = await flw.Transaction.verify({ id: transactionId });
    return response;
  } catch (error: any) {
    console.error('Flutterwave transaction verification error:', error);
    throw new Error(`Transaction verification failed: ${error.message}`);
  }
}

/**
 * Verify transaction by tx_ref
 */
export async function verifyTransactionByRef(txRef: string): Promise<any> {
  try {
    const response = await flw.Transaction.verify_by_ref({ tx_ref: txRef });
    return response;
  } catch (error: any) {
    console.error('Flutterwave transaction verification error:', error);
    throw new Error(`Transaction verification failed: ${error.message}`);
  }
}

/**
 * Cancel a Flutterwave subscription
 */
export async function cancelFlutterwaveSubscription(subscriptionId: string): Promise<any> {
  try {
    const response = await flw.Subscription.cancel({ id: subscriptionId });
    return response;
  } catch (error: any) {
    console.error('Flutterwave subscription cancellation error:', error);
    throw new Error(`Subscription cancellation failed: ${error.message}`);
  }
}

/**
 * Get all subscriptions for a customer
 */
export async function getCustomerSubscriptions(email: string): Promise<any> {
  try {
    const response = await flw.Subscription.fetch({ email });
    return response;
  } catch (error: any) {
    console.error('Flutterwave fetch subscriptions error:', error);
    throw new Error(`Fetch subscriptions failed: ${error.message}`);
  }
}

/**
 * Validate Flutterwave webhook signature
 */
export function validateWebhookSignature(signature: string, payload: any): boolean {
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
  return signature === secretHash;
}

export default flw;
