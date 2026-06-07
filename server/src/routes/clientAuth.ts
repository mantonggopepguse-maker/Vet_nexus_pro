import { Router } from 'express';
import { prisma } from '../db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const acceptInviteSchema = z.object({
    token: z.string().min(12),
    password: z.string().min(6),
});

const signClientToken = (client: {
    id: string;
    clinicId: string;
    firstName: string;
    lastName: string;
    email: string | null;
}) => {
    const token = jwt.sign(
        {
            id: client.id,
            email: client.email,
            name: `${client.firstName} ${client.lastName}`,
            roles: ['CLIENT'],
            clinicId: client.clinicId,
            isSuperAdmin: false,
            isClient: true,
        },
        JWT_SECRET,
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
            portalPasswordMustChange: (client as any).portalPasswordMustChange || false,
        },
    };
};

const getInviteState = (invite: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null }) => {
    if (invite.revokedAt) return 'REVOKED';
    if (invite.acceptedAt) return 'ACCEPTED';
    if (invite.expiresAt < new Date()) return 'EXPIRED';
    return 'ACTIVE';
};

// POST /api/auth/client/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const normalizedEmail = email.toLowerCase().trim();

        const client = await prisma.client.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        if (!client || !client.isPortalEnabled) {
            return res.status(401).json({ error: 'Portal access not enabled or client not found' });
        }

        if (!client.password) {
            return res.status(401).json({
                error: 'Portal setup incomplete. Please use the invitation link sent to your email.',
                code: 'INVITE_REQUIRED',
            });
        }

        const isMatch = await bcrypt.compare(password, client.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await prisma.client.update({
            where: { id: client.id },
            data: { lastLogin: new Date() },
        });

        res.json(signClientToken(client));
    } catch (error) {
        console.error('Client Login Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/client/invite/:token
router.get('/invite/:token', async (req, res) => {
    try {
        const token = String(req.params.token || '').trim();
        if (!token) {
            return res.status(400).json({ error: 'Invite token required' });
        }

        const invite = await prisma.portalInvite.findUnique({
            where: { token },
            include: {
                clinic: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                    },
                },
                client: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        if (!invite) {
            return res.status(404).json({ error: 'Invite not found' });
        }

        const status = getInviteState(invite);
        if (status !== 'ACTIVE') {
            return res.status(410).json({
                error: `This invite is ${status.toLowerCase()}.`,
                status,
            });
        }

        res.json({
            invite: {
                token: invite.token,
                status,
                expiresAt: invite.expiresAt,
                clinic: invite.clinic,
                client: {
                    id: invite.client.id,
                    firstName: invite.client.firstName,
                    lastName: invite.client.lastName,
                    email: invite.emailSnapshot,
                },
            },
        });
    } catch (error) {
        console.error('Invite lookup error:', error);
        res.status(500).json({ error: 'Failed to load invite' });
    }
});

// POST /api/auth/client/invite/accept
router.post('/invite/accept', async (req, res) => {
    try {
        const { token, password } = acceptInviteSchema.parse(req.body);

        const invite = await prisma.portalInvite.findUnique({
            where: { token },
            include: {
                client: true,
                clinic: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!invite) {
            return res.status(404).json({ error: 'Invite not found' });
        }

        const status = getInviteState(invite);
        if (status !== 'ACTIVE') {
            return res.status(410).json({
                error: `This invite is ${status.toLowerCase()}.`,
                status,
            });
        }

        if (!invite.client.email || invite.client.email.toLowerCase() !== invite.emailSnapshot.toLowerCase()) {
            return res.status(400).json({
                error: 'Invite email no longer matches the client record. Please contact your clinic to resend the invite.',
            });
        }

        const conflict = await prisma.client.findFirst({
            where: {
                id: { not: invite.clientId },
                isPortalEnabled: true,
                email: { equals: invite.client.email, mode: 'insensitive' },
            },
            select: { id: true },
        });

        if (conflict) {
            return res.status(409).json({
                error: 'This email is already in use by another active portal account.',
                code: 'PORTAL_EMAIL_CONFLICT',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date();

        await prisma.$transaction([
            prisma.client.update({
                where: { id: invite.clientId },
                data: {
                    password: hashedPassword,
                    isPortalEnabled: true,
                    portalPasswordMustChange: false,
                    lastLogin: now,
                },
            }),
            prisma.portalInvite.update({
                where: { id: invite.id },
                data: { acceptedAt: now },
            }),
            prisma.portalInvite.updateMany({
                where: {
                    clientId: invite.clientId,
                    id: { not: invite.id },
                    acceptedAt: null,
                    revokedAt: null,
                },
                data: { revokedAt: now },
            }),
        ]);

        const client = await prisma.client.findUnique({
            where: { id: invite.clientId },
        });

        if (!client) {
            return res.status(404).json({ error: 'Client not found after activation' });
        }

        res.json({
            ...signClientToken(client),
            message: 'Portal account activated successfully',
        });
    } catch (error) {
        console.error('Invite acceptance error:', error);
        res.status(500).json({ error: 'Failed to accept invite' });
    }
});

// POST /api/auth/client/change-password
router.post('/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
        if (!decoded?.isClient || !decoded?.id || !decoded?.clinicId) {
            return res.status(403).json({ error: 'Client portal access required' });
        }

        const { currentPassword, newPassword } = z.object({
            currentPassword: z.string().optional(),
            newPassword: z.string().min(6),
        }).parse(req.body);

        const client = await prisma.client.findFirst({
            where: {
                id: decoded.id,
                clinicId: decoded.clinicId,
                isPortalEnabled: true,
            },
        });

        if (!client || !client.password) {
            return res.status(404).json({ error: 'Client portal account not found' });
        }

        if (!client.portalPasswordMustChange) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required' });
            }
            const isMatch = await bcrypt.compare(currentPassword, client.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updated = await prisma.client.update({
            where: { id: client.id },
            data: {
                password: hashedPassword,
                portalPasswordMustChange: false,
                lastLogin: new Date(),
            },
        });

        res.json({
            ...signClientToken(updated),
            message: 'Password changed successfully',
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Client password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// POST /api/auth/client/claim (legacy)
router.post('/claim', async (_req, res) => {
    return res.status(410).json({
        error: 'Direct account claiming has been retired. Please use the invitation link sent by your clinic.',
        code: 'CLAIM_RETIRED',
    });
});

export default router;
