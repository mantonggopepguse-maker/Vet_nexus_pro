import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, superAdminOnly, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();
const APP_BASE_URL = (process.env.FRONTEND_URL || process.env.APP_URL || 'https://app.vetnexuspro.com').replace(/\/$/, '');

const clinicSchema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    address: z.string().min(2).optional().or(z.literal('')),
    email: z.string().email(),
    phone: z.string().min(2).optional().or(z.literal('')),
    adminPassword: z.string().min(6),
    practiceType: z.string().min(2).optional().or(z.literal('')),
    planId: z.string(),
    country: z.string().optional(),
    language: z.string().optional(),
    currencySymbol: z.string().optional(),
    acronym: z.string().optional(),
    status: z.enum(['Active', 'Suspended']).default('Active')
});

const inviteSchema = z.object({
    clinicId: z.string().optional(),
    expiresInDays: z.number().default(7)
});

const subscriptionOverrideSchema = z.object({
    planId: z.string().min(1),
    status: z.string().optional(),
    billingCycle: z.enum(['monthly', 'yearly']).optional(),
    currentPeriodEnd: z.string().optional().nullable(),
    cancelAtPeriodEnd: z.boolean().optional()
});

// Get all clinics with usage metrics
router.get('/clinics', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const clinics = await prisma.clinic.findMany({
            include: {
                _count: {
                    select: { 
                        users: true, 
                        clients: true,
                        sales: true,
                        appointments: true 
                    }
                },
                users: {
                    where: { roles: { has: 'Admin' } },
                    select: { email: true, name: true },
                    take: 1
                },
                subscription: {
                    include: { plan: true }
                }
            }
        });

        // Calculate "Cloud Run Load" proxy based on 24h activity
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentActivity = await prisma.auditLog.groupBy({
            by: ['clinicId'],
            where: {
                timestamp: { gte: twentyFourHoursAgo },
                clinicId: { not: null }
            },
            _count: {
                _all: true
            }
        });

        const activityMap = new Map();
        recentActivity.forEach(a => activityMap.set(a.clinicId, a._count._all));

        const enhancedClinics = clinics.map(clinic => ({
            ...clinic,
            activity24h: activityMap.get(clinic.id) || 0
        }));

        res.json(enhancedClinics);
    } catch (error) {
        console.error('Failed to fetch clinics:', error);
        res.status(500).json({ error: 'Failed to fetch clinics' });
    }
});

// Get system-wide stats for Super Admin dashboard
router.get('/stats', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const [clinicCount, activeSubs, totalUsers, totalClients, storageUsage] = await prisma.$transaction([
            prisma.clinic.count(),
            prisma.subscription.count({ where: { status: 'active' } }),
            prisma.user.count(),
            prisma.client.count(),
            prisma.clinic.aggregate({ _sum: { storageUsage: true } })
        ]);

        res.json({
            totalClinics: clinicCount,
            activeSubscriptions: activeSubs,
            totalUsers,
            totalClients,
            totalStorageMB: storageUsage._sum.storageUsage || 0,
            dbStatus: 'Healthy',
            systemLoad: 'Normal' // Placeholder for real system metrics if available
        });
    } catch (error) {
        console.error('Failed to fetch system stats:', error);
        res.status(500).json({ error: 'Failed to fetch system statistics' });
    }
});

// Manual Subscription Override (God Mode)
router.patch('/clinics/:id/subscription', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const payload = subscriptionOverrideSchema.parse(req.body);
        const { planId, billingCycle, status: newStatus, currentPeriodEnd, cancelAtPeriodEnd } = payload;

        // Check if plan exists
        const plan = await prisma.subscriptionPlan.findUnique({
            where: { id: planId }
        });

        if (!plan) {
            return res.status(404).json({ error: 'Subscription plan not found' });
        }

        // Get current subscription to check for external providers
        const currentSub = await prisma.subscription.findUnique({
            where: { clinicId: id }
        });

        // 1. Cancel existing Flutterwave subscription if it exists
        // We do this to prevent double billing since we are manually overriding the plan
        if (currentSub?.flutterwaveSubId) {
            try {
                // Import dynamically to avoid circular dependency issues if any, though flwService is safe here
                const flwService = await import('../services/flutterwaveService.js');
                await flwService.cancelFlutterwaveSubscription(currentSub.flutterwaveSubId);
                console.log(`Cancelled Flutterwave sub ${currentSub.flutterwaveSubId} for clinic ${id} due to manual override`);
            } catch (e) {
                console.warn(`Failed to cancel Flutterwave sub for clinic ${id}:`, e);
                // Continue anyway, as the manual override is the priority
            }
        }

        // 2. Upsert subscription with manual settings
        const finalBillingCycle = billingCycle || 'monthly';
        let periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;

        if (!periodEnd) {
            periodEnd = new Date();
            if (finalBillingCycle === 'monthly') {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
            } else {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            }
        }

        if (Number.isNaN(periodEnd.getTime())) {
            return res.status(400).json({ error: 'Invalid expiry date supplied' });
        }

        const now = new Date();

        const subscription = await prisma.subscription.upsert({
            where: { clinicId: id },
            update: {
                planId: planId,
                status: newStatus || 'active',
                cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
                billingCycle: finalBillingCycle,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                nextPaymentDate: newStatus === 'cancelled' ? null : periodEnd,
                lastPaymentDate: newStatus === 'active' ? now : currentSub?.lastPaymentDate || null,
                failedPaymentCount: 0,
                flutterwaveSubId: null, // Clear external ID as this is now manually managed
                flutterwaveCustomerId: currentSub?.flutterwaveCustomerId // Keep customer ID for future reference
            },
            create: {
                clinicId: id,
                planId: planId,
                status: newStatus || 'active',
                billingCycle: finalBillingCycle,
                currentPeriodEnd: periodEnd,
                currentPeriodStart: now,
                nextPaymentDate: newStatus === 'cancelled' ? null : periodEnd,
                lastPaymentDate: newStatus === 'active' ? now : null,
                cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
                flutterwaveSubId: null
            },
            include: {
                plan: true
            }
        });

        // Log this action
        await logAudit(
            req.user!.id,
            'SuperAdmin',
            'Subscription Override',
            `Manually overrode subscription for clinic ${id} to plan ${plan.displayName} (Status: ${newStatus || 'active'}, Billing: ${finalBillingCycle}, Expiry: ${periodEnd.toLocaleDateString()})`
        );

        res.json({ success: true, subscription });
    } catch (error: any) {
        console.error('Failed to override subscription:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid subscription override payload', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});

// Create a clinic
router.post('/clinics', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const data = clinicSchema.parse(req.body);

        // Check if admin user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered to another user' });
        }

        const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Create Clinic
            const clinic = await tx.clinic.create({
                data: {
                    name: data.name,
                    slug: data.slug,
                    address: data.address || null,
                    email: data.email,
                    phone: data.phone || null,
                    practiceType: data.practiceType || null,
                    status: data.status,
                    country: data.country || 'Nigeria',
                    language: data.language || 'English',
                    currencySymbol: data.currencySymbol || '₦',
                    acronym: data.acronym || data.name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().substring(0, 3)
                }
            });

            // 2. Create Admin User
            const adminUser = await tx.user.create({
                data: {
                    email: data.email,
                    password: hashedPassword,
                    name: `${data.name} Admin`,
                    roles: ['Admin', 'Veterinarian'],
                    status: 'Active',
                    clinicId: clinic.id
                }
            });

            // 3. Create Subscription
            const plan = await tx.subscriptionPlan.findUnique({
                where: { id: data.planId }
            });

            if (!plan) {
                throw new Error('Subscription plan not found');
            }

            const now = new Date();
            const periodEnd = new Date();
            periodEnd.setFullYear(now.getFullYear() + 1); // 1 year default for SA creation

            await tx.subscription.create({
                data: {
                    clinicId: clinic.id,
                    planId: plan.id,
                    status: 'active',
                    billingCycle: 'monthly',
                    currentPeriodEnd: periodEnd
                }
            });

            return { clinic, adminUser };
        });

        // Log this action
        await logAudit(req.user!.id, 'SuperAdmin', 'Clinic Creation', `Created clinic ${data.name} (Slug: ${data.slug}) and admin user ${data.email}`);

        res.status(201).json(result);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Clinic creation failed:', error);
        res.status(500).json({ error: 'Failed to create clinic and admin user', message: error.message });
    }
});

// Update a clinic (status, subscription)
router.put('/clinics/:id', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { planId, ...clinicData } = req.body;

        // 1. Update Clinic basic data
        const validatedData = clinicSchema.partial().parse(clinicData);
        const clinic = await prisma.clinic.update({
            where: { id: id as string },
            data: validatedData
        });

        // 2. If planId is provided, update/create subscription
        if (planId) {
            const plan = await prisma.subscriptionPlan.findUnique({
                where: { id: planId }
            });

            if (plan) {
                const now = new Date();
                const periodEnd = new Date();
                periodEnd.setFullYear(now.getFullYear() + 1); // Default 1 year grant for SA actions

                await prisma.subscription.upsert({
                    where: { clinicId: id as string },
                    update: {
                        planId: plan.id,
                        status: 'active',
                        currentPeriodEnd: periodEnd,
                        flutterwaveSubId: null // Manual management
                    },
                    create: {
                        clinicId: id as string,
                        planId: plan.id,
                        status: 'active',
                        billingCycle: 'monthly',
                        currentPeriodEnd: periodEnd
                    }
                });
            }
        }

        // Log this action
        const action = validatedData.status ? `Status Update (${validatedData.status})` : 'Info Update';
        await logAudit(req.user!.id, 'SuperAdmin', 'Clinic Update', `${action} for clinic ${id}`);

        res.json(clinic);
    } catch (error: any) {
        console.error('Failed to update clinic:', error);
        res.status(500).json({ error: 'Failed to update clinic', message: error.message });
    }
});

// Delete a clinic
router.delete('/clinics/:id', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        await prisma.clinic.delete({ where: { id: id as string } });
        
        // Log this action
        await logAudit(req.user!.id, 'SuperAdmin', 'Clinic Deletion', `Permanently deleted clinic ID ${id}`);

        res.json({ message: 'Clinic deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete clinic' });
    }
});

// Generate one-time use registration link
router.post('/invites', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const { clinicId, expiresInDays } = inviteSchema.parse(req.body);
        const code = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        const invite = await prisma.inviteLink.create({
            data: {
                clinicId,
                code,
                expiresAt
            }
        });

        res.status(201).json({
            ...invite,
            link: `${APP_BASE_URL}/?code=${code}`
        });

        // Log this action
        await logAudit(req.user!.id, 'SuperAdmin', 'Invite Generation', `Generated registration invite code for clinic ${clinicId || 'New Practice'}`);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate invite' });
    }
});

// Get all active invites
router.get('/invites', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const invites = await prisma.inviteLink.findMany({
            where: { isUsed: false, expiresAt: { gt: new Date() } },
            include: { clinic: { select: { name: true } } }
        });
        res.json(invites.map(invite => ({
            ...invite,
            link: `${APP_BASE_URL}/?code=${invite.code}`
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch invites' });
    }
});

// Get a single clinic with detailed stats
router.get('/clinics/:id', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const clinic = await prisma.clinic.findUnique({
            where: { id: id as string },
            include: {
                subscription: {
                    include: { plan: true }
                },
                _count: {
                    select: {
                        users: true,
                        clients: true,
                        inventoryItems: true,
                        procedures: true,
                        sales: true,
                        appointments: true,
                    }
                },
                users: {
                    where: { roles: { has: 'Admin' } },
                    select: { email: true, name: true },
                    take: 1
                }
            }
        });

        if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

        // Count patients across all clients of this clinic
        const patientCount = await prisma.patient.count({
            where: { owner: { clinicId: id as string } }
        });

        res.json({ ...clinic, patientCount });
    } catch (error) {
        console.error("Failed to fetch clinic details:", error);
        res.status(500).json({ error: 'Failed to fetch clinic details' });
    }
});

// Grant free trial / free access period to a clinic (SuperAdmin)
router.post('/clinics/:id/grant-trial', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { days, planId } = z.object({
            days: z.number().int().min(1).max(365),
            planId: z.string().optional(),
        }).parse(req.body);

        const { grantFreeAccess } = await import('../services/subscriptionService.js');
        const subscription = await grantFreeAccess(id as string, days, planId);

        await logAudit(
            req.user!.id,
            'SuperAdmin',
            'Trial Grant',
            `Granted ${days}-day free trial to clinic ${id} (Plan: ${(subscription as any).plan?.displayName || planId || 'current'})`
        );

        res.json({ success: true, subscription, message: `${days}-day trial granted successfully.` });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Failed to grant trial:', error);
        res.status(500).json({ error: 'Failed to grant trial', message: error.message });
    }
});

export default router;
