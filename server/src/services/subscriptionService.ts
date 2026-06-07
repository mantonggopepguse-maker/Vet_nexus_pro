import { prisma } from '../db.js';

// Subscription plan definitions
export const SUBSCRIPTION_PLANS = {
    FREE: {
        name: 'Free',
        displayName: 'SoloVets (Free)',
        priceMonthly: 0,
        priceYearly: 0,
        flwPlanIdMonthly: null,
        flwPlanIdYearly: null,
        maxClients: 50,
        maxPatients: 100,
        maxStaff: 2,
        features: {
            googleDrive: true,
            aiFeatures: false,
            advancedReports: false,
            prioritySupport: false,
            customBranding: false,
            hospitalFeatures: false,
            multiBranch: false,
        },
    },
    STARTER: {
        name: 'Starter',
        displayName: 'Starter Plan',
        priceMonthly: 5000,
        priceYearly: 50000,
        flwPlanIdMonthly: '161038',
        flwPlanIdYearly: '161037',
        maxClients: null,
        maxPatients: null,
        maxStaff: 3,
        features: {
            googleDrive: true,
            aiFeatures: false,
            advancedReports: false,
            prioritySupport: false,
            customBranding: false,
            hospitalFeatures: false,
            multiBranch: false,
        },
    },
    STANDARD: {
        name: 'Standard',
        displayName: 'Standard Plan',
        priceMonthly: 10000,
        priceYearly: 100000,
        flwPlanIdMonthly: '161039',
        flwPlanIdYearly: '161040',
        maxClients: null,
        maxPatients: null,
        maxStaff: 7,
        features: {
            googleDrive: true,
            aiFeatures: true,
            advancedReports: true,
            prioritySupport: true,
            customBranding: true,
            hospitalFeatures: false,
            multiBranch: false,
        },
    },
    PREMIUM: {
        name: 'Premium',
        displayName: 'Premium Plan',
        priceMonthly: 25000,
        priceYearly: 250000,
        flwPlanIdMonthly: '161041',
        flwPlanIdYearly: '161042',
        maxClients: null,
        maxPatients: null,
        maxStaff: null,
        features: {
            googleDrive: true,
            aiFeatures: true,
            advancedReports: true,
            prioritySupport: true,
            customBranding: true,
            hospitalFeatures: true,
            multiBranch: true,
        },
    },
};

/**
 * Initialize subscription plans in database
 */
export async function initializeSubscriptionPlans(): Promise<void> {
    // First, deactivate any old plans that are no longer in our definitions
    const validPlanNames = Object.values(SUBSCRIPTION_PLANS).map(p => p.name);
    await prisma.subscriptionPlan.updateMany({
        where: {
            name: { notIn: validPlanNames }
        },
        data: { isActive: false }
    });

    // Upsert current plans
    for (const [key, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
        await prisma.subscriptionPlan.upsert({
            where: { name: plan.name },
            update: {
                displayName: (plan as any).displayName,
                priceMonthly: (plan as any).priceMonthly,
                priceYearly: (plan as any).priceYearly,
                flwPlanIdMonthly: (plan as any).flwPlanIdMonthly,
                flwPlanIdYearly: (plan as any).flwPlanIdYearly,
                maxClients: (plan as any).maxClients,
                maxPatients: (plan as any).maxPatients,
                maxStaff: (plan as any).maxStaff,
                features: (plan as any).features,
                isActive: true,
            },
            create: {
                name: (plan as any).name,
                displayName: (plan as any).displayName,
                priceMonthly: (plan as any).priceMonthly,
                priceYearly: (plan as any).priceYearly,
                flwPlanIdMonthly: (plan as any).flwPlanIdMonthly,
                flwPlanIdYearly: (plan as any).flwPlanIdYearly,
                currency: 'NGN',
                maxClients: (plan as any).maxClients,
                maxPatients: (plan as any).maxPatients,
                maxStaff: (plan as any).maxStaff,
                features: (plan as any).features,
                isActive: true,
            },
        });
    }
    console.log('Subscription plans initialized (old plans deactivated)');
}

/**
 * Get clinic's current subscription
 */
export async function getClinicSubscription(clinicId: string) {
    return prisma.subscription.findUnique({
        where: { clinicId },
        include: {
            plan: true,
            transactions: {
                orderBy: { createdAt: 'desc' },
                take: 10,
            },
        },
    });
}

/**
 * Create a free subscription for a new clinic
 */
export async function createFreeSubscription(clinicId: string) {
    const freePlan = await prisma.subscriptionPlan.findUnique({
        where: { name: 'Free' },
    });

    if (!freePlan) {
        throw new Error('Free plan not found. Run initializeSubscriptionPlans first.');
    }

    // Far future date for free plan (100 years)
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 100);

    return prisma.subscription.create({
        data: {
            clinicId,
            planId: freePlan.id,
            status: 'active',
            billingCycle: 'monthly',
            currentPeriodEnd: farFuture,
        },
    });
}

/**
 * Create a 30-day trial subscription for a new clinic (Path B)
 * Uses the highest plan (Premium) so they experience all features
 */
export async function createTrialSubscription(clinicId: string, trialDays: number = 30) {
    // Trial gets Premium plan features
    const premiumPlan = await prisma.subscriptionPlan.findUnique({
        where: { name: 'Premium' },
    });
    const freePlan = await prisma.subscriptionPlan.findUnique({
        where: { name: 'Free' },
    });

    const trialPlan = premiumPlan || freePlan;
    if (!trialPlan) throw new Error('No subscription plan found.');

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    return prisma.subscription.upsert({
        where: { clinicId },
        create: {
            clinicId,
            planId: trialPlan.id,
            status: 'trialing',
            billingCycle: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEnd,
        },
        update: {
            planId: trialPlan.id,
            status: 'trialing',
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEnd,
            cancelAtPeriodEnd: false,
        },
    });
}

/**
 * Grant free access for a specified number of days (SuperAdmin action)
 * Can target any plan, defaults to current plan
 */
export async function grantFreeAccess(clinicId: string, days: number, planId?: string) {
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + days);

    const current = await prisma.subscription.findUnique({
        where: { clinicId },
    });

    const targetPlanId = planId || current?.planId;
    if (!targetPlanId) throw new Error('No plan specified and no existing subscription.');

    return prisma.subscription.upsert({
        where: { clinicId },
        create: {
            clinicId,
            planId: targetPlanId,
            status: 'trialing',
            billingCycle: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
        },
        update: {
            planId: targetPlanId,
            status: 'trialing',
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            failedPaymentCount: 0,
        },
        include: { plan: true },
    });
}

/**
 * Upgrade clinic to Premium plan
 */
export async function upgradeToPremium(
    clinicId: string,
    billingCycle: 'monthly' | 'yearly',
    flutterwaveSubId?: string
) {
    const premiumPlan = await prisma.subscriptionPlan.findUnique({
        where: { name: 'Premium' },
    });

    if (!premiumPlan) {
        throw new Error('Premium plan not found');
    }

    const now = new Date();
    const periodEnd = new Date();
    if (billingCycle === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    return prisma.subscription.upsert({
        where: { clinicId },
        update: {
            planId: premiumPlan.id,
            status: 'active',
            billingCycle,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            lastPaymentDate: now,
            nextPaymentDate: periodEnd,
            flutterwaveSubId,
            failedPaymentCount: 0,
            cancelAtPeriodEnd: false,
        },
        create: {
            clinicId,
            planId: premiumPlan.id,
            status: 'active',
            billingCycle,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            lastPaymentDate: now,
            nextPaymentDate: periodEnd,
            flutterwaveSubId,
        },
    });
}

/**
 * Schedule downgrade to free (takes effect at period end)
 */
export async function scheduleDowngrade(clinicId: string) {
    return prisma.subscription.update({
        where: { clinicId },
        data: {
            cancelAtPeriodEnd: true,
        },
    });
}

/**
 * Execute downgrade to free plan
 */
export async function executeDowngrade(clinicId: string) {
    const freePlan = await prisma.subscriptionPlan.findUnique({
        where: { name: 'Free' },
    });

    if (!freePlan) {
        throw new Error('Free plan not found');
    }

    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 100);

    return prisma.subscription.update({
        where: { clinicId },
        data: {
            planId: freePlan.id,
            status: 'active',
            billingCycle: 'monthly',
            currentPeriodEnd: farFuture,
            cancelAtPeriodEnd: false,
            flutterwaveSubId: null,
            nextPaymentDate: null,
        },
    });
}

/**
 * Process failed payment
 */
export async function processFailedPayment(clinicId: string) {
    const subscription = await prisma.subscription.findUnique({
        where: { clinicId },
    });

    if (!subscription) return null;

    const newFailedCount = subscription.failedPaymentCount + 1;
    let newStatus = subscription.status;

    // After 3 failed payments, suspend the subscription
    if (newFailedCount >= 3) {
        newStatus = 'suspended';
    } else if (newFailedCount >= 1) {
        newStatus = 'past_due';
    }

    return prisma.subscription.update({
        where: { clinicId },
        data: {
            failedPaymentCount: newFailedCount,
            status: newStatus,
        },
    });
}

/**
 * Reactivate subscription after successful payment
 */
export async function reactivateSubscription(clinicId: string) {
    return prisma.subscription.update({
        where: { clinicId },
        data: {
            status: 'active',
            failedPaymentCount: 0,
        },
    });
}

/**
 * Check if clinic can perform action based on subscription limits
 */
export async function checkSubscriptionLimit(
    clinicId: string,
    resource: 'clients' | 'patients' | 'staff'
): Promise<{ allowed: boolean; reason?: string; limit?: number; current?: number }> {
    const subscription = await prisma.subscription.findUnique({
        where: { clinicId },
        include: { plan: true },
    });

    if (!subscription || subscription.status === 'suspended') {
        return { allowed: false, reason: 'Subscription is suspended or not found' };
    }

    const plan = subscription.plan;
    let limit: number | null = null;
    let currentCount = 0;

    switch (resource) {
        case 'clients':
            limit = plan.maxClients;
            currentCount = await prisma.client.count({ where: { clinicId } });
            break;
        case 'patients':
            limit = plan.maxPatients;
            currentCount = await prisma.patient.count({
                where: { owner: { clinicId } },
            });
            break;
        case 'staff':
            limit = plan.maxStaff;
            currentCount = await prisma.user.count({ where: { clinicId } });
            break;
    }

    if (limit === null) {
        return { allowed: true }; // No limit (Premium plan)
    }

    if (currentCount >= limit) {
        return {
            allowed: false,
            reason: `${resource} limit reached for your current plan. Move to a higher plan to increase your ${resource} allowance.`,
            limit,
            current: currentCount,
        };
    }

    return { allowed: true, limit, current: currentCount };
}

/**
 * Check if clinic has access to a feature
 */
export async function checkFeatureAccess(
    clinicId: string,
    feature: string
): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
        where: { clinicId },
        include: { plan: true },
    });

    if (!subscription || subscription.status === 'suspended') {
        return false;
    }

    const features = subscription.plan.features as Record<string, boolean>;
    return features[feature] === true;
}

/**
 * Record a payment transaction
 */
export async function recordTransaction(data: {
    subscriptionId: string;
    flutterwaveRef: string;
    flutterwaveTxId?: string;
    amount: number;
    status: string;
    paymentMethod?: string;
    cardLast4?: string;
    description?: string;
    metadata?: any;
    paidAt?: Date;
}) {
    return prisma.paymentTransaction.create({
        data: {
            subscriptionId: data.subscriptionId,
            flutterwaveRef: data.flutterwaveRef,
            flutterwaveTxId: data.flutterwaveTxId,
            amount: data.amount,
            currency: 'NGN',
            status: data.status,
            paymentMethod: data.paymentMethod,
            cardLast4: data.cardLast4,
            description: data.description,
            metadata: data.metadata,
            paidAt: data.paidAt,
        },
    });
}

/**
 * Get subscriptions that need reminders
 */
export async function getSubscriptionsNeedingReminders() {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return prisma.subscription.findMany({
        where: {
            status: 'active',
            plan: { name: 'Premium' },
            nextPaymentDate: {
                gte: now,
                lte: sevenDaysFromNow,
            },
            OR: [
                { lastReminderSent: null },
                {
                    lastReminderSent: {
                        lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // More than 24 hours ago
                    },
                },
            ],
        },
        include: {
            clinic: true,
            plan: true,
        },
    });
}

/**
 * Get overdue subscriptions
 */
export async function getOverdueSubscriptions() {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return prisma.subscription.findMany({
        where: {
            status: { in: ['past_due', 'active'] },
            plan: { name: 'Premium' },
            currentPeriodEnd: {
                lt: now,
                gte: sevenDaysAgo,
            },
        },
        include: {
            clinic: true,
            plan: true,
        },
    });
}

/**
 * Get subscriptions to suspend (past grace period)
 */
export async function getSubscriptionsToSuspend() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return prisma.subscription.findMany({
        where: {
            status: { in: ['past_due', 'active'] },
            plan: { name: 'Premium' },
            currentPeriodEnd: {
                lt: sevenDaysAgo,
            },
        },
        include: {
            clinic: true,
            plan: true,
        },
    });
}

/**
 * Update reminder sent timestamp
 */
export async function updateReminderSent(subscriptionId: string) {
    return prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
            lastReminderSent: new Date(),
            reminderCount: { increment: 1 },
        },
    });
}

/**
 * Complete registration by creating clinic and user from pending data
 */
export async function completeRegistration(registrationData: any, planId: string) {
    const { 
        email, name, password, clinicName, clinicAddress, 
        country, language, currencySymbol, roles, breed, age // age might be in data
    } = registrationData;

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Double check email doesn't exist (safety)
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return existing;

    // 2. Create Clinic
    const slug = clinicName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    let finalSlug = slug;
    const existingClinic = await prisma.clinic.findUnique({ where: { slug } });
    if (existingClinic) {
        finalSlug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const clinic = await prisma.clinic.create({
        data: {
            name: clinicName,
            slug: finalSlug,
            acronym: clinicName.substring(0, 3).toUpperCase(),
            address: clinicAddress || '',
            phone: '',
            email: normalizedEmail,
            bankName: '',
            accountName: '',
            accountNumber: '',
            country: country || '',
            language: language || '',
            currencySymbol: currencySymbol || '',
            status: 'Active'
        }
    });

    // 3. Create User
    const user = await prisma.user.create({
        data: {
            email: normalizedEmail,
            name,
            password, // Already hashed in auth.ts initiate
            clinicId: clinic.id,
            roles: roles || ['Admin'],
            status: 'Active'
        },
        include: { clinic: true }
    });

    // 4. Create Subscription
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await prisma.subscription.create({
        data: {
            clinicId: clinic.id,
            planId: planId,
            status: 'active',
            billingCycle: 'monthly',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            lastPaymentDate: now,
            nextPaymentDate: periodEnd,
        }
    });

    return user;
}
