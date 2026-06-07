import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import * as flwService from '../services/flutterwaveService.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { verifyFirebaseIdToken } from '../services/firebaseAdmin.js';

const router = Router();
const APP_BASE_URL = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.vetnexuspro.com').replace(/\/$/, '');

const loginSchema = z.object({
    email: z.string().min(1), // Allow any identifier (email or username)
    password: z.string().min(6)
});

const firebaseLoginSchema = z.object({
    idToken: z.string().min(20)
});

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2), // This will be the admin's name
    username: z.string().optional(),
    roles: z.array(z.string()).default(['Veterinarian']),
    inviteCode: z.string().optional(),
    clinicId: z.string().optional(), // For SuperAdmin creating staff
    // New clinic details
    clinicName: z.string().optional(),
    clinicAddress: z.string().optional(),
    acronym: z.string().optional(),
    country: z.string().optional(),
    language: z.string().optional(),
    currencySymbol: z.string().optional()
});

const getJwtSecret = () => {
    let secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET must be defined in production environment');
        }
        console.warn('WARNING: Using default JWT secret. This is insecure for production.');
        secret = 'default-secret-change-this';
    }
    return secret;
};

const signStaffSession = (user: any) => {
    const secret = getJwtSecret();
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles,
            clinicId: user.clinicId,
            isSuperAdmin: user.isSuperAdmin
        },
        secret as jwt.Secret,
        { expiresIn: expiresIn as any }
    );

    return {
        token,
        accountType: 'staff' as const,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles,
            status: user.status,
            clinicId: user.clinicId,
            isSuperAdmin: user.isSuperAdmin,
            clinic: user.clinic
        }
    };
};

const signClientSession = (client: any) => {
    const secret = getJwtSecret();
    const token = jwt.sign(
        {
            id: client.id,
            email: client.email,
            name: `${client.firstName} ${client.lastName}`,
            roles: ['CLIENT'],
            clinicId: client.clinicId,
            isSuperAdmin: false,
            isClient: true
        },
        secret as jwt.Secret,
        { expiresIn: '30d' }
    );

    return {
        token,
        accountType: 'client' as const,
        client: {
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            clinicId: client.clinicId,
            portalPasswordMustChange: !!client.portalPasswordMustChange
        }
    };
};

const getStaffByIdentifier = async (identifier: string) => {
    return prisma.user.findFirst({
        where: {
            OR: [
                { email: identifier },
                { username: identifier }
            ]
        },
        include: {
            clinic: {
                include: {
                    subscription: {
                        include: {
                            plan: true
                        }
                    }
                }
            }
        }
    }) as any;
};

const attemptStaffLogin = async (identifier: string, password: string) => {
    const user = await getStaffByIdentifier(identifier);
    if (!user) {
        return { ok: false, statusCode: 401, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
    }

    if (user.status === 'Suspended') {
        return { ok: false, statusCode: 403, error: 'Account suspended. Please contact support.', code: 'SUSPENDED' };
    }

    if (user.status === 'PendingPayment') {
        try {
            const pendingSubscription = user.clinic?.subscription;
            const pendingPlan = pendingSubscription?.plan;
            const pendingBillingCycle = pendingSubscription?.billingCycle === 'yearly' ? 'yearly' : 'monthly';

            if (pendingPlan) {
                const paymentResponse = await flwService.initializePayment({
                    amount: pendingBillingCycle === 'yearly' ? pendingPlan.priceYearly : pendingPlan.priceMonthly,
                    email: user.email,
                    name: user.name,
                    clinicId: user.clinicId || user.id,
                    planId: pendingPlan.id,
                    billingCycle: pendingBillingCycle,
                    redirectUrl: `${APP_BASE_URL}/subscription/callback`,
                });
                return {
                    ok: false,
                    statusCode: 402,
                    error: `Payment required to activate your ${pendingPlan.displayName || pendingPlan.name} subscription.`,
                    code: 'PAYMENT_PENDING',
                    paymentUrl: paymentResponse.data.link,
                };
            }
        } catch (e) {
            console.error('Failed to generate payment link for pending user:', e);
        }
        return {
            ok: false,
            statusCode: 402,
            error: 'Your account is pending payment. Please complete your subscription to continue.',
            code: 'PAYMENT_PENDING',
        };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        return { ok: false, statusCode: 401, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
    }

    return { ok: true, session: signStaffSession(user), user };
};

const attemptClientLogin = async (email: string, password: string) => {
    const client = await prisma.client.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!client || !client.isPortalEnabled) {
        return { ok: false, statusCode: 401, error: 'Portal access not enabled or client not found', code: 'PORTAL_DISABLED' };
    }

    if (!client.password) {
        return {
            ok: false,
            statusCode: 401,
            error: 'Portal setup incomplete. Please use the invitation link sent to your email.',
            code: 'INVITE_REQUIRED',
        };
    }

    const isValidPassword = await bcrypt.compare(password, client.password);
    if (!isValidPassword) {
        return { ok: false, statusCode: 401, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
    }

    await prisma.client.update({
        where: { id: client.id },
        data: { lastLogin: new Date() }
    });

    return { ok: true, session: signClientSession(client), client };
};

const getPendingPaymentResponse = async (user: any) => {
    try {
        const pendingSubscription = user.clinic?.subscription;
        const pendingPlan = pendingSubscription?.plan;
        const pendingBillingCycle = pendingSubscription?.billingCycle === 'yearly' ? 'yearly' : 'monthly';

        if (pendingPlan) {
            const paymentResponse = await flwService.initializePayment({
                amount: pendingBillingCycle === 'yearly' ? pendingPlan.priceYearly : pendingPlan.priceMonthly,
                email: user.email,
                name: user.name,
                clinicId: user.clinicId || user.id,
                planId: pendingPlan.id,
                billingCycle: pendingBillingCycle,
                redirectUrl: `${APP_BASE_URL}/subscription/callback`,
            });

            return {
                error: `Payment required to activate your ${pendingPlan.displayName || pendingPlan.name} subscription.`,
                code: 'PAYMENT_PENDING',
                paymentUrl: paymentResponse.data.link,
            };
        }
    } catch (e) {
        console.error('Failed to generate payment link for pending Firebase user:', e);
    }

    return {
        error: 'Your account is pending payment. Please complete your subscription to continue.',
        code: 'PAYMENT_PENDING',
    };
};

// Send Verification Code (REGISTRATION)
router.post('/send-verification', async (req, res) => {
    try {
        const { email } = z.object({ email: z.string().email() }).parse(req.body);
        const normalizedEmail = email.toLowerCase().trim();

        // Check if already an active registered account
        const existingActiveUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingActiveUser && existingActiveUser.status === 'Active') {
            return res.status(400).json({
                code: 'EMAIL_EXISTS',
                error: 'This email is already registered. Please sign in instead.'
            });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await prisma.emailVerification.upsert({
            where: { email_type: { email: normalizedEmail, type: 'VERIFICATION' } },
            create: { email: normalizedEmail, type: 'VERIFICATION', code, expiresAt },
            update: { code, expiresAt, verified: false }
        });

        // Send real verification email
        try {
            await sendVerificationEmail(normalizedEmail, code);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Still respond — code is saved in DB, user can request again
        }

        res.json({ message: 'Verification code sent' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to send verification code' });
    }
});

/**
 * Initiate registration for paid plans.
 * Stores data in PendingRegistration and returns payment URL.
 */
router.post('/initiate-registration', async (req, res) => {
    try {
        const payload = registerSchema.extend({ planId: z.string() }).parse(req.body);
        const { email, planId } = payload;
        const normalizedEmail = email.toLowerCase().trim();

        // 1. Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered. Please sign in.' });
        }

        // 2. Fetch plan
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        if (!plan || plan.name === 'Free') {
            return res.status(400).json({ error: 'Invalid plan selected or plan is free. Use /register for free plans.' });
        }

        // 3. Generate transaction reference
        const txRef = `reg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // 4. Store registration data temporarily
        const hashedPassword = await bcrypt.hash(payload.password, 10);
        const registrationData = {
            ...payload,
            password: hashedPassword, // Store hashed password
            roles: ['Admin']
        };

        await prisma.pendingRegistration.upsert({
            where: { email: normalizedEmail },
            create: {
                email: normalizedEmail,
                txRef,
                registrationData: registrationData as any
            },
            update: {
                txRef,
                registrationData: registrationData as any
            }
        });

        // 5. Initialize Payment
        const paymentResponse = await flwService.initializePayment({
            amount: plan.priceMonthly,
            email: normalizedEmail,
            name: payload.name,
            clinicId: 'temp', // Clinic not created yet
            planId: plan.id,
            billingCycle: 'monthly',
            redirectUrl: `${APP_BASE_URL}/subscription/callback?type=registration`,
            metadata: {
                registrationEmail: normalizedEmail,
                txRef
            }
        });

        res.json({
            requiresPayment: true,
            paymentUrl: paymentResponse.data.link,
            txRef
        });

    } catch (error: any) {
        console.error('Registration initiation failed:', error);
        res.status(400).json({ error: error.message || 'Failed to initiate registration' });
    }
});

// Verify Code (REGISTRATION)
router.post('/verify-code', async (req, res) => {
    try {
        const { email, code } = z.object({ email: z.string().email(), code: z.string() }).parse(req.body);
        const normalizedEmail = email.toLowerCase().trim();

        const verification = await prisma.emailVerification.findUnique({
            where: { email_type: { email: normalizedEmail, type: 'VERIFICATION' } }
        });

        if (!verification || verification.code !== code || verification.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        await prisma.emailVerification.update({
            where: { id: verification.id },
            data: { verified: true }
        });

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Verification failed' });
    }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = z.object({ email: z.string() }).parse(req.body);
        const normalizedIdentifier = email.toLowerCase().trim();

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: normalizedIdentifier },
                    { username: normalizedIdentifier }
                ]
            }
        });

        if (!user) {
            // Security: Don't reveal if user exists, but for now returned success message is fine.
            // Or return success anyway.
            return res.json({ message: 'If an account exists, a reset code has been sent.' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.emailVerification.upsert({
            where: { email_type: { email: user.email, type: 'PASSWORD_RESET' } },
            create: { email: user.email, type: 'PASSWORD_RESET', code, expiresAt },
            update: { code, expiresAt, verified: false }
        });

        // Send real password reset email
        try {
            await sendPasswordResetEmail(user.email, user.name, code);
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            // Still respond — code is saved in DB
        }

        res.json({ message: 'Reset code sent to your email', email: user.email });
    } catch (error) {
        res.status(400).json({ error: 'Failed to process request' });
    }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = z.object({
            email: z.string().email(),
            code: z.string().length(6),
            newPassword: z.string().min(6)
        }).parse(req.body);

        const normalizedEmail = email.toLowerCase().trim();

        const verification = await prisma.emailVerification.findUnique({
            where: { email_type: { email: normalizedEmail, type: 'PASSWORD_RESET' } }
        });

        if (!verification || verification.code !== code || verification.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired reset code' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { email: normalizedEmail },
            data: { password: hashedPassword }
        });

        // Cleanup
        await prisma.emailVerification.delete({
            where: { id: verification.id }
        });

        res.json({ message: 'Password reset successful. You can now login.' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to reset password' });
    }
});

// Firebase Auth entry point. Firebase verifies identity; Postgres still owns clinic data.
router.post('/firebase-login', async (req, res) => {
    try {
        const { idToken } = firebaseLoginSchema.parse(req.body);
        const decoded = await verifyFirebaseIdToken(idToken);
        const normalizedEmail = decoded.email?.toLowerCase().trim();

        if (!normalizedEmail) {
            return res.status(400).json({ error: 'Firebase account has no email address', code: 'EMAIL_REQUIRED' });
        }

        const user = await getStaffByIdentifier(normalizedEmail);
        if (!user) {
            return res.status(404).json({
                error: 'No clinic workspace is linked to this email yet. Create your clinic account first.',
                code: 'POSTGRES_USER_NOT_FOUND',
            });
        }

        if (user.status === 'Suspended') {
            return res.status(403).json({
                error: 'Account suspended. Please contact support.',
                code: 'SUSPENDED',
            });
        }

        if (user.status === 'PendingPayment') {
            return res.status(402).json(await getPendingPaymentResponse(user));
        }

        res.json(signStaffSession(user));
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Firebase login failed:', error);
        res.status(401).json({ error: 'Firebase sign in failed', code: 'FIREBASE_AUTH_FAILED' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email: identifier, password } = loginSchema.parse(req.body);
        const normalizedIdentifier = identifier.toLowerCase().trim();
        const staffAttempt = await attemptStaffLogin(normalizedIdentifier, password);
        if (!staffAttempt.ok) {
            const payload: any = { error: staffAttempt.error };
            if (staffAttempt.code) payload.code = staffAttempt.code;
            if ((staffAttempt as any).paymentUrl) payload.paymentUrl = (staffAttempt as any).paymentUrl;
            return res.status(staffAttempt.statusCode || 401).json(payload);
        }

        res.json(staffAttempt.session);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Login failed' });
    }
});

// Shared login entry (staff + client)
router.post('/shared-login', async (req, res) => {
    try {
        const { email, password } = z.object({
            email: z.string().min(1),
            password: z.string().min(6),
        }).parse(req.body);

        const normalizedIdentifier = email.toLowerCase().trim();

        // Staff-first strategy (as requested), then client fallback.
        const staffAttempt = await attemptStaffLogin(normalizedIdentifier, password);
        const clientAttempt = await attemptClientLogin(normalizedIdentifier, password);

        if (staffAttempt.ok && clientAttempt.ok) {
            return res.json({
                requiresAccountSelection: true,
                message: 'This email has both clinic staff and client access. Please choose one.',
                sessions: {
                    staff: staffAttempt.session,
                    client: clientAttempt.session,
                },
            });
        }

        if (staffAttempt.ok) {
            return res.json(staffAttempt.session);
        }

        if (clientAttempt.ok) {
            return res.json(clientAttempt.session);
        }

        // If both failed, prefer specific actionable staff state first, else client state, else generic.
        const preferred = [staffAttempt, clientAttempt].find(
            (a: any) => a.code && a.code !== 'INVALID_CREDENTIALS'
        ) || staffAttempt;

        const payload: any = {
            error: preferred.error || 'Invalid credentials',
        };
        if ((preferred as any).code) payload.code = (preferred as any).code;
        if ((preferred as any).paymentUrl) payload.paymentUrl = (preferred as any).paymentUrl;
        return res.status(preferred.statusCode || 401).json(payload);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Shared login failed:', error);
        return res.status(500).json({ error: 'Login failed' });
    }
});

// Register
router.post('/register', async (req: AuthRequest, res) => {
    try {
        const {
            email,
            password,
            name,
            username,
            roles,
            inviteCode,
            clinicId: requestedClinicId,
            clinicName,
            clinicAddress,
            country,
            language,
            currencySymbol,
            planId // Add planId to schema
        } = registerSchema.extend({ planId: z.string().optional() }).parse(req.body);

        const normalizedEmail = email.toLowerCase().trim();
        const normalizedUsername = username?.toLowerCase().trim();

        const subService = await import('../services/subscriptionService.js');

        let clinicId: string | null = null;
        let createdClinic: any = null; // Track created clinic to update subscription later
        let inviteRecord: any = null;

        // Attempt to get user from token if present
        let authenticatedUser: any = null;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const secret = process.env.JWT_SECRET || 'default-secret-change-this';
                authenticatedUser = jwt.verify(token, secret as jwt.Secret) as any;
            } catch (e) {
                // Ignore invalid token, proceed with normal registration
            }
        }

        // If authenticated as Admin or SuperAdmin, creating a staff member
        if (authenticatedUser && (authenticatedUser.isSuperAdmin || (authenticatedUser.roles && authenticatedUser.roles.includes('Admin')))) {
            if (authenticatedUser.isSuperAdmin) {
                // SuperAdmin must provide clinicId in request body
                if (!requestedClinicId) {
                    return res.status(400).json({ error: 'Clinic ID is required when creating staff as SuperAdmin' });
                }
                clinicId = requestedClinicId;
            } else {
                clinicId = authenticatedUser.clinicId;

                // Check staff limit
                const check = await subService.checkSubscriptionLimit(clinicId as string, 'staff');
                if (!check.allowed) {
                    return res.status(403).json({
                        error: 'Limit reached',
                        message: check.reason,
                        code: 'LIMIT_REACHED'
                    });
                }
            }
        }
        // Logic for new clinic via invite code
        else if (inviteCode) {
            const invite = await prisma.inviteLink.findUnique({
                where: { code: inviteCode }
            });

            if (!invite || invite.isUsed || invite.expiresAt < new Date()) {
                return res.status(400).json({ error: 'Invalid or expired invite code' });
            }

            inviteRecord = invite;
            clinicId = invite.clinicId || null;
        }
        
        // Logic for new clinic creation
        if (!clinicId && clinicName) {
            // --- Step 1: Check if Email Already Registered ---
            const existingActiveUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
            if (existingActiveUser) {
                return res.status(409).json({ error: 'Email already registered. Please sign in.' });
            }

            // --- Step 3: Create Clinic ---
            const slug = clinicName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            const generatedAcronym = clinicName
                .split(/\s+/)
                .filter((word: string) => word.length > 0)
                .map((word: string) => word[0])
                .join('')
                .toUpperCase();

            let finalSlug = slug;
            const existingClinic = await prisma.clinic.findUnique({ where: { slug } });
            if (existingClinic) {
                finalSlug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
            }

            // Determine if this is a paid plan
            let selectedPlan: any = null;
            if (planId) {
                selectedPlan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
            }
            const isPaidPlan = !!(selectedPlan && selectedPlan.name !== 'Free');

            if (isPaidPlan) {
                return res.status(400).json({ 
                    error: 'Payment required', 
                    message: 'Please use the initiate-registration sequence for paid plans' 
                });
            }

            // Create Free Clinic
            const clinic = await prisma.clinic.create({
                data: {
                    name: clinicName,
                    slug: finalSlug,
                    acronym: generatedAcronym || clinicName.substring(0, 3).toUpperCase(),
                    address: clinicAddress || '',
                    phone: '',
                    email: normalizedEmail,
                    bankName: '',
                    accountName: '',
                    accountNumber: '',
                    currencySymbol: currencySymbol || '₦'
                }
            });

            clinicId = clinic.id;

            // Create free subscription record
            try {
                const freePlanFallback = await prisma.subscriptionPlan.findFirst({
                    where: { name: 'Free' }
                });
                if (freePlanFallback) {
                    const farFuture = new Date();
                    farFuture.setFullYear(farFuture.getFullYear() + 100);
                    await prisma.subscription.create({
                        data: {
                            clinicId: clinic.id,
                            planId: freePlanFallback.id,
                            status: 'active',
                            billingCycle: 'monthly',
                            currentPeriodEnd: farFuture,
                        }
                    });
                }
            } catch (subError) {
                console.error('Failed to create subscription:', subError);
            }
        }

        // existingUser check (only if NOT creating a clinic — clinic path has its own check above)
        if (!clinicName) {
            const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
            if (existingUser) {
                return res.status(409).json({ error: 'Email already registered' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // If clinic was just created, force Admin role, unless created by an existing Admin
        const finalRoles = (clinicName && !authenticatedUser) ? ['Admin'] : roles;

        // Determine user status: PendingPayment for new-clinic paid plans, Active otherwise
        let isPaidPlan = false;
        if (clinicName && planId) {
            const chkPlan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
            isPaidPlan = !!(chkPlan && chkPlan.name !== 'Free');
        }
        const userStatus = (clinicName && isPaidPlan) ? 'PendingPayment' : 'Active';

        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                password: hashedPassword,
                name,
                username,
                roles: finalRoles,
                status: userStatus,
                clinicId
            },
            include: {
                clinic: {
                    include: {
                        subscription: {
                            include: {
                                plan: true
                            }
                        }
                    }
                }
            }
        }) as any;

        if (inviteRecord) {
            await prisma.inviteLink.update({
                where: { id: inviteRecord.id },
                data: { isUsed: true }
            });
        }

        // If an admin is creating the user, return the user object cleanly
        if (authenticatedUser && authenticatedUser.roles && authenticatedUser.roles.includes('Admin')) {
            return res.status(201).json({
                message: 'Staff member created successfully',
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    roles: user.roles,
                    status: user.status,
                    clinicId: user.clinicId,
                    clinic: user.clinic
                }
            });
        }

        // For Premium plan: initiate payment and return URL WITHOUT login token
        if (clinicName && isPaidPlan) {
            try {
                const premiumPlan = await prisma.subscriptionPlan.findUnique({ where: { id: planId as string } });
                if (premiumPlan) {
                    const paymentResponse = await flwService.initializePayment({
                        amount: premiumPlan.priceMonthly,
                        email: user.email,
                        name: user.name,
                        clinicId: user.clinicId || user.id,
                        planId: premiumPlan.id,
                        billingCycle: 'monthly',
                        redirectUrl: `${APP_BASE_URL}/subscription/callback`,
                    });
                    return res.status(201).json({
                        requiresPayment: true,
                        message: 'Account created! Please complete your payment to activate your subscription.',
                        paymentUrl: paymentResponse.data.link,
                        user: { id: user.id, email: user.email, name: user.name }
                    });
                }
            } catch (paymentError: any) {
                console.error('Failed to initialize payment after registration:', paymentError);
                // Account created but payment link failed — still return without token
                return res.status(201).json({
                    requiresPayment: true,
                    message: 'Account created but we could not generate a payment link. Please try logging in to retry payment.',
                    user: { id: user.id, email: user.email, name: user.name }
                });
            }
        }

        const secret = process.env.JWT_SECRET || 'default-secret-change-this';
        const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

        // Generate token for Free plan self-registration
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name,
                roles: user.roles,
                clinicId: user.clinicId,
                isSuperAdmin: user.isSuperAdmin
            },
            secret as jwt.Secret,
            { expiresIn: expiresIn as any }
        );

        res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                roles: user.roles,
                status: user.status,
                clinicId: user.clinicId,
                isSuperAdmin: user.isSuperAdmin,
                clinic: user.clinic
            }
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Registration error details:', error);
        res.status(500).json({ error: 'Registration failed', message: error.message });
    }
});

// User Management (Protected)
router.get('/users', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const users = await prisma.user.findMany({
            where: req.user?.isSuperAdmin ? {} : { clinicId: req.user?.clinicId as string },
            select: {
                id: true,
                email: true,
                name: true,
                roles: true,
                status: true,
                createdAt: true,
                clinicId: true
            }
        }) as any[];
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.put('/users/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params as { id: string };
        const { name, roles, status } = req.body;

        // SECURITY: Prevent privilege escalation - only SuperAdmins can create/modify SuperAdmins
        if (roles && roles.includes('Admin') && !req.user?.isSuperAdmin) {
            return res.status(403).json({ error: 'Only Super Admins can assign Admin role' });
        }

        // Block any attempt to set isSuperAdmin via this route
        const sanitizedData: any = { name, status };
        if (roles) {
            sanitizedData.roles = roles;
        }

        const updated = await prisma.user.update({
            where: req.user?.isSuperAdmin ? { id: id as string } : { id: id as string, clinicId: req.user?.clinicId as string },
            data: sanitizedData,
            select: {
                id: true,
                email: true,
                name: true,
                roles: true,
                status: true,
                clinicId: true
            }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

router.delete('/users/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({
            where: req.user?.isSuperAdmin ? { id: id as string } : { id: id as string, clinicId: req.user?.clinicId as string }
        });
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
