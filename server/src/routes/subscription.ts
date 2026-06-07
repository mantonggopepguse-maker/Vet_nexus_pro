import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import * as flwService from '../services/flutterwaveService.js';
import * as subService from '../services/subscriptionService.js';

const router = Router();
const APP_BASE_URL = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.vetnexuspro.com').replace(/\/$/, '');



// Subscription Plans
router.get('/plans', async (req: Request, res: Response) => {
    try {
        const plans = await prisma.subscriptionPlan.findMany({
            where: { isActive: true },
            orderBy: { priceMonthly: 'asc' },
        });
        res.json(plans);
    } catch (error: any) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ error: 'Failed to fetch subscription plans' });
    }
});

/**
 * Get current clinic subscription
 */
router.get('/current', authenticate, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user.clinicId) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        const subscription = await subService.getClinicSubscription(user.clinicId);

        if (!subscription) {
            // Create free subscription if none exists
            const newSub = await subService.createFreeSubscription(user.clinicId);
            const fullSub = await subService.getClinicSubscription(user.clinicId);
            return res.json(fullSub);
        }

        res.json(subscription);
    } catch (error: any) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

/**
 * Initialize payment for subscription upgrade
 */
router.post('/upgrade/initialize', authenticate, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { billingCycle, planId } = req.body;
        if (!planId) {
            return res.status(400).json({ error: 'Plan ID is required' });
        }

        if (!user.clinicId) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
            return res.status(400).json({ error: 'Invalid billing cycle' });
        }

        const targetPlan = await prisma.subscriptionPlan.findUnique({
            where: { id: planId },
        });

        if (!targetPlan) {
            return res.status(404).json({ error: 'Selected plan not found' });
        }

        const clinic = await prisma.clinic.findUnique({
            where: { id: user.clinicId },
        });

        if (!clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        const amount = billingCycle === 'monthly' ? targetPlan.priceMonthly : targetPlan.priceYearly;
        const flwPaymentPlanId = billingCycle === 'monthly'
            ? (targetPlan.flwPlanIdMonthly || undefined)
            : (targetPlan.flwPlanIdYearly || undefined);

        const paymentResponse = await flwService.initializePayment({
            amount,
            email: user.email,
            name: user.name,
            clinicId: user.clinicId,
            planId: targetPlan.id,
            billingCycle,
            redirectUrl: `${APP_BASE_URL}/subscription/callback`,
            flwPaymentPlanId,
            metadata: { planName: targetPlan.displayName },
        });

        // Store pending transaction reference
        const subscription = await subService.getClinicSubscription(user.clinicId);
        if (subscription) {
            await subService.recordTransaction({
                subscriptionId: subscription.id,
                flutterwaveRef: paymentResponse.data.tx_ref,
                amount,
                status: 'pending',
                description: `${billingCycle} Pro plan upgrade`,
            });
        }

        res.json({
            paymentUrl: paymentResponse.data.link,
            txRef: paymentResponse.data.tx_ref,
        });
    } catch (error: any) {
        console.error('Error initializing upgrade:', error);
        res.status(500).json({ error: error.message || 'Failed to initialize payment' });
    }
});

/**
 * Verify payment and complete upgrade
 */
router.post('/upgrade/verify', authenticate, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { txRef, transactionId } = req.body;

        if (!user.clinicId) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        // Verify with Flutterwave
        const verification = transactionId
            ? await flwService.verifyTransaction(transactionId)
            : await flwService.verifyTransactionByRef(txRef);

        if (verification.status !== 'success' || verification.data?.status !== 'successful') {
            return res.status(400).json({
                error: 'Payment verification failed',
                details: verification.message,
            });
        }

        const txData = verification.data;
        const meta = txData.meta || {};
        const billingCycle = meta.billingCycle || 'monthly';

        // Update subscription
        const subscription = await subService.upgradeToPremium(
            user.clinicId,
            billingCycle,
            txData.flw_ref
        );

        // Update transaction record
        await prisma.paymentTransaction.updateMany({
            where: { flutterwaveRef: txRef },
            data: {
                status: 'successful',
                flutterwaveTxId: String(txData.id),
                paymentMethod: txData.payment_type,
                cardLast4: txData.card?.last_4digits,
                paidAt: new Date(txData.created_at),
                metadata: txData,
            },
        });

        const fullSubscription = await subService.getClinicSubscription(user.clinicId);
        res.json({
            success: true,
            message: 'Subscription upgraded successfully',
            subscription: fullSubscription,
        });
    } catch (error: any) {
        console.error('Error verifying upgrade:', error);
        res.status(500).json({ error: error.message || 'Failed to verify payment' });
    }
});

/**
 * Schedule downgrade to free plan
 */
router.post('/downgrade', authenticate, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        if (!user.clinicId) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        const subscription = await subService.getClinicSubscription(user.clinicId);

        if (!subscription) {
            return res.status(404).json({ error: 'No subscription found' });
        }

        if (subscription.plan.name === 'Free') {
            return res.status(400).json({ error: 'Already on Free plan' });
        }

        // Cancel Flutterwave subscription if exists
        if (subscription.flutterwaveSubId) {
            try {
                await flwService.cancelFlutterwaveSubscription(subscription.flutterwaveSubId);
            } catch (e) {
                console.warn('Failed to cancel Flutterwave subscription:', e);
            }
        }

        // Schedule downgrade for end of period
        await subService.scheduleDowngrade(user.clinicId);

        res.json({
            success: true,
            message: 'Subscription will be downgraded at the end of the current billing period',
            currentPeriodEnd: subscription.currentPeriodEnd,
        });
    } catch (error: any) {
        console.error('Error scheduling downgrade:', error);
        res.status(500).json({ error: error.message || 'Failed to schedule downgrade' });
    }
});

/**
 * Cancel scheduled downgrade
 */
router.post('/downgrade/cancel', authenticate, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        if (!user.clinicId) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        await prisma.subscription.update({
            where: { clinicId: user.clinicId },
            data: { cancelAtPeriodEnd: false },
        });

        res.json({
            success: true,
            message: 'Downgrade cancelled. Your Pro subscription will continue.',
        });
    } catch (error: any) {
        console.error('Error cancelling downgrade:', error);
        res.status(500).json({ error: error.message || 'Failed to cancel downgrade' });
    }
});

/**
 * Get subscription usage/limits
 */
router.get('/usage', authenticate, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        if (!user.clinicId) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        const [clientsCheck, patientsCheck, staffCheck] = await Promise.all([
            subService.checkSubscriptionLimit(user.clinicId, 'clients'),
            subService.checkSubscriptionLimit(user.clinicId, 'patients'),
            subService.checkSubscriptionLimit(user.clinicId, 'staff'),
        ]);

        const subscription = await subService.getClinicSubscription(user.clinicId);

        res.json({
            plan: subscription?.plan?.name || 'Free',
            usage: {
                clients: { current: clientsCheck.current, limit: clientsCheck.limit },
                patients: { current: patientsCheck.current, limit: patientsCheck.limit },
                staff: { current: staffCheck.current, limit: staffCheck.limit },
            },
        });
    } catch (error: any) {
        console.error('Error fetching usage:', error);
        res.status(500).json({ error: 'Failed to fetch usage' });
    }
});

/**
 * Check feature access
 */
router.get('/feature/:feature', authenticate, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { feature } = req.params;

        if (!user.clinicId) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        const hasAccess = await subService.checkFeatureAccess(user.clinicId, feature as string);

        res.json({ feature, hasAccess });
    } catch (error: any) {
        console.error('Error checking feature:', error);
        res.status(500).json({ error: 'Failed to check feature access' });
    }
});

/**
 * Flutterwave webhook handler
 */
router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const verifHash = req.headers['verif-hash'];
        const signature = Array.isArray(verifHash) ? verifHash[0] : (verifHash || '');

        if (!flwService.validateWebhookSignature(signature, req.body)) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        const { event, data } = req.body;

        switch (event) {
            case 'charge.completed':
                // Payment successful
                if (data.status === 'successful') {
                    const meta = data.meta || {};
                    const txRef = data.tx_ref;

                    // Handle Registration Payment
                    if (meta.registrationEmail || txRef?.startsWith('reg_')) {
                        const email = meta.registrationEmail;
                        const pending = await prisma.pendingRegistration.findFirst({
                            where: { OR: [{ email }, { txRef }] }
                        });

                        if (pending && pending.status === 'pending') {
                            await subService.completeRegistration(pending.registrationData, (pending.registrationData as any).planId);
                            await prisma.pendingRegistration.update({
                                where: { id: pending.id },
                                data: { status: 'completed' }
                            });
                        }
                    } 
                    // Handle Existing Clinic Upgrade
                    else if (meta.clinicId) {
                        await subService.upgradeToPremium(meta.clinicId, meta.billingCycle || 'monthly');
                        await subService.reactivateSubscription(meta.clinicId);

                        await prisma.clinic.updateMany({
                            where: { id: meta.clinicId, status: 'PendingPayment' },
                            data: { status: 'Active' }
                        });
                        await prisma.user.updateMany({
                            where: { clinicId: meta.clinicId, status: 'PendingPayment' },
                            data: { status: 'Active' }
                        });
                    }
                }
                break;

            case 'charge.failed':
                // Payment failed
                const meta = data.meta || {};
                if (meta.clinicId) {
                    await subService.processFailedPayment(meta.clinicId);
                }
                break;

            case 'subscription.cancelled':
                // Subscription cancelled
                if (data.customer?.email) {
                    const user = await prisma.user.findUnique({
                        where: { email: data.customer.email },
                    });
                    if (user?.clinicId) {
                        await subService.executeDowngrade(user.clinicId);
                    }
                }
                break;

            default:
                console.log('Unhandled webhook event:', event);
        }

        res.status(200).json({ received: true });
    } catch (error: any) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * Get payment history
 */
router.get('/transactions', authenticate, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        if (!user.clinicId) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        const subscription = await prisma.subscription.findUnique({
            where: { clinicId: user.clinicId },
        });

        if (!subscription) {
            return res.json([]);
        }

        const transactions = await prisma.paymentTransaction.findMany({
            where: { subscriptionId: subscription.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        res.json(transactions);
    } catch (error: any) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

/**
 * Public endpoint: Verify registration payment and activate PendingPayment account.
 * Called by SubscriptionCallback page after Flutterwave redirects back.
 */
router.post('/verify-registration-payment', async (req: Request, res: Response) => {
    try {
        const { txRef, transactionId } = req.body;

        if (!txRef && !transactionId) {
            return res.status(400).json({ error: 'Transaction reference required' });
        }

        // 1. Verify payment with Flutterwave
        const verification = transactionId
            ? await flwService.verifyTransaction(String(transactionId))
            : await flwService.verifyTransactionByRef(txRef);

        if (verification.status !== 'success' || verification.data?.status !== 'successful') {
            return res.status(400).json({
                error: 'Payment verification failed. Transaction may be pending or failed.',
            });
        }

        const txData = verification.data;
        const meta = txData.meta || {};
        const email = meta.registrationEmail;

        // 2. Find Pending Registration
        const pending = await prisma.pendingRegistration.findFirst({
            where: { OR: [{ email }, { txRef: txData.tx_ref }] }
        });

        if (!pending) {
            // Check if already registered (in case webhook beat us to it)
            const existingUser = await prisma.user.findUnique({
                where: { email: email },
                include: { clinic: true }
            });

            if (existingUser) {
                return respondWithToken(existingUser, res);
            }

            return res.status(404).json({ error: 'Registration data not found.' });
        }

        // 3. Complete Registration if still pending
        let finalUser: any;
        if (pending.status === 'pending') {
            finalUser = await subService.completeRegistration(
                pending.registrationData, 
                (pending.registrationData as any).planId
            );
            await prisma.pendingRegistration.update({
                where: { id: pending.id },
                data: { status: 'completed' }
            });
        } else {
            finalUser = await prisma.user.findUnique({
                where: { email: pending.email },
                include: { clinic: true }
            });
        }

        if (!finalUser) {
            return res.status(500).json({ error: 'Failed to finalize account creation.' });
        }

        // 4. Record the transaction
        const subscription = await subService.getClinicSubscription(finalUser.clinicId);
        if (subscription) {
            try {
                await subService.recordTransaction({
                    subscriptionId: subscription.id,
                    flutterwaveRef: txData.tx_ref,
                    flutterwaveTxId: String(txData.id),
                    amount: txData.amount,
                    status: 'successful',
                    paymentMethod: txData.payment_type,
                    description: `Premium plan registration payment`,
                    paidAt: new Date(txData.created_at),
                    metadata: txData,
                });
            } catch (e) {
                console.warn('Could not record transaction (non-fatal):', e);
            }
        }

        return respondWithToken(finalUser, res);

    } catch (error: any) {
        console.error('Error verifying registration payment:', error);
        res.status(500).json({ error: error.message || 'Payment verification failed' });
    }
});

async function respondWithToken(user: any, res: Response) {
    const secret = process.env.JWT_SECRET || 'default-secret-change-this';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles,
            clinicId: user.clinicId,
            isSuperAdmin: user.isSuperAdmin || false,
        },
        secret as any,
        { expiresIn: expiresIn as any }
    );

    return res.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles,
            status: user.status,
            clinicId: user.clinicId,
            isSuperAdmin: user.isSuperAdmin || false,
            clinic: user.clinic,
        },
    });
}

/**
 * Get trial status for the current clinic (visible to clinic admin)
 */
router.get('/trial-status', authenticate, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user.clinicId) return res.status(400).json({ error: 'No clinic' });

        const subscription = await subService.getClinicSubscription(user.clinicId);
        if (!subscription) return res.json({ isTrial: false });

        const isTrial = subscription.status === 'trialing';
        const now = new Date();
        const trialEnd = subscription.currentPeriodEnd;
        const daysLeft = isTrial
            ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

        res.json({
            isTrial,
            daysLeft,
            trialEnd: trialEnd.toISOString(),
            planName: subscription.plan?.displayName || 'Trial',
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get trial status' });
    }
});


export default router;
