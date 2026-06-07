import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { checkResourceLimit } from '../middleware/subscriptionMiddleware.js';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/auditLogger.js';
import { sendPortalCredentialsEmail, sendPortalInviteEmail } from '../services/emailService.js';

const router = Router();

const clientSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
    phone: z.string().min(1),
    alternatePhone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
    emergencyContactName: z.string().optional().nullable(),
    emergencyContactPhone: z.string().optional().nullable(),
    emergencyContactRelation: z.string().optional().nullable(),
    preferredContact: z.string().optional().nullable(),
    referralSource: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    clinicId: z.string().optional() // For SuperAdmin
});

const generateClientCode = async (clinicId: string): Promise<string> => {
    // Get clinic acronym or use default 'CLT'
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { acronym: true }
    });
    const prefix = (clinic?.acronym || 'CLT').toUpperCase();

    const lastClient = await prisma.client.findFirst({
        where: { clinicId, clientCode: { startsWith: `${prefix}-` } },
        orderBy: { clientCode: 'desc' },
        select: { clientCode: true }
    });

    let nextNum = 1;
    if (lastClient?.clientCode) {
        const match = lastClient.clientCode.match(/(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `${prefix}-${String(nextNum).padStart(4, '0')}`;
};

const normalizeEmail = (email?: string | null) => {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
};

const getInviteStatus = (invite: any) => {
    if (!invite) return 'NOT_SENT';
    if (invite.revokedAt) return 'REVOKED';
    if (invite.acceptedAt) return 'ACCEPTED';
    if (invite.expiresAt < new Date()) return 'EXPIRED';
    return 'PENDING';
};

const withPortalAccess = (client: any) => {
    const latestInvite = client.portalInvites?.[0] || null;
    const portalConversationCount = client._count?.aiConversations ?? 0;
    const passwordSet = !!client.password;
    const { password: _password, ...safeClient } = client;

    return {
        ...safeClient,
        passwordSet,
        portalAccess: {
            enabled: !!client.isPortalEnabled,
            lastLogin: client.lastLogin || null,
            passwordMustChange: !!client.portalPasswordMustChange,
            portalConversationCount,
            invite: latestInvite
                ? {
                    id: latestInvite.id,
                    status: getInviteStatus(latestInvite),
                    emailSnapshot: latestInvite.emailSnapshot,
                    createdAt: latestInvite.createdAt,
                    expiresAt: latestInvite.expiresAt,
                    acceptedAt: latestInvite.acceptedAt,
                    revokedAt: latestInvite.revokedAt,
                }
                : null,
        },
    };
};

const generateTemporaryPassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    return Array.from(randomBytes(14), (byte) => alphabet[byte % alphabet.length]).join('');
};

const findClientForUser = async (req: AuthRequest, clientId: string) => {
    return prisma.client.findFirst({
        where: req.user?.isSuperAdmin
            ? { id: clientId }
            : { id: clientId, clinicId: req.user?.clinicId as string },
        include: {
            portalInvites: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
            _count: {
                select: {
                    aiConversations: {
                        where: { platform: 'PORTAL' },
                    },
                },
            },
        },
    });
};

const assertPortalEmailUniqueness = async (email: string, clientId: string) => {
    const conflict = await prisma.client.findFirst({
        where: {
            id: { not: clientId },
            isPortalEnabled: true,
            email: { equals: email, mode: 'insensitive' },
        },
        select: { id: true },
    });

    if (conflict) {
        const err: any = new Error('This email is already in use by another active portal account.');
        err.code = 'PORTAL_EMAIL_CONFLICT';
        throw err;
    }
};

const createPortalInvite = async (params: {
    client: any;
    invitedBy: string;
}) => {
    const { client, invitedBy } = params;
    const normalizedEmail = normalizeEmail(client.email);
    if (!normalizedEmail) {
        const err: any = new Error('Client email is required before sending a portal invite.');
        err.code = 'MISSING_CLIENT_EMAIL';
        throw err;
    }

    await assertPortalEmailUniqueness(normalizedEmail, client.id);

    // Revoke any previous open invites before creating a new one.
    await prisma.portalInvite.updateMany({
        where: {
            clientId: client.id,
            acceptedAt: null,
            revokedAt: null,
        },
        data: { revokedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    const invite = await prisma.portalInvite.create({
        data: {
            token,
            clinicId: client.clinicId,
            clientId: client.id,
            emailSnapshot: normalizedEmail,
            expiresAt,
            invitedBy,
        },
    });

    const appUrl = (process.env.APP_URL || 'https://vetnexus.vetnexuspro.com').replace(/\/$/, '');
    const inviteLink = `${appUrl}/portal/invite/${invite.token}`;

    const emailDelivery = await sendPortalInviteEmail({
        to: normalizedEmail,
        clinicName: client.clinic?.name || 'Your Veterinary Clinic',
        clientName: `${client.firstName} ${client.lastName}`,
        inviteLink,
        expiresAt,
    });

    return { invite, emailDelivery };
};

// Get all clients (paginated)
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const clients = await prisma.client.findMany({
            where: req.user?.isSuperAdmin ? {} : { clinicId: req.user?.clinicId as string },
            take: limit,
            skip,
            orderBy: { createdAt: 'desc' },
            include: {
                portalInvites: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                _count: {
                    select: {
                        aiConversations: {
                            where: { platform: 'PORTAL' },
                        },
                    },
                },
            },
        });

        res.json(clients.map(withPortalAccess));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// Get single client
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const client = await prisma.client.findUnique({
            where: { id: req.params.id as string },
            include: {
                patients: true,
                sales: {
                    include: {
                        items: {
                            include: {
                                item: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
                communications: {
                    orderBy: {
                        sentAt: 'desc'
                    }
                },
                media: {
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
                portalInvites: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                aiConversations: {
                    where: { platform: 'PORTAL' },
                    orderBy: { updatedAt: 'desc' },
                    select: {
                        id: true,
                        status: true,
                        subject: true,
                        category: true,
                        patientId: true,
                        updatedAt: true,
                    },
                },
                _count: {
                    select: {
                        aiConversations: {
                            where: { platform: 'PORTAL' },
                        },
                    },
                },
            }
        });

        if (client && !req.user?.isSuperAdmin && client.clinicId !== req.user?.clinicId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json(withPortalAccess(client));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

// Check for duplicate clients (by phone)
router.get('/check-duplicate', authenticate, async (req: AuthRequest, res) => {
    try {
        const phone = req.query.phone as string;
        if (!phone) return res.json({ exists: false });

        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.json({ exists: false });

        const existing = await prisma.client.findFirst({
            where: { clinicId, phone: phone.trim() },
            select: { id: true, firstName: true, lastName: true, phone: true }
        });

        res.json({ exists: !!existing, client: existing || null });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check duplicate' });
    }
});

// Create client
router.post('/', authenticate, checkResourceLimit('clients'), async (req: AuthRequest, res) => {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
        try {
            const { clinicId: requestedClinicId, tags, ...data } = clientSchema.parse(req.body);

            let clinicId = req.user?.clinicId;

            if (req.user?.isSuperAdmin) {
                if (!requestedClinicId) {
                    return res.status(400).json({ error: 'Clinic ID is required for SuperAdmin' });
                }
                clinicId = requestedClinicId;
            } else if (req.user?.roles?.includes('Admin') && !clinicId) {
                const userWithClinic = await prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: { clinicId: true }
                });
                clinicId = userWithClinic?.clinicId || undefined;
                if (!clinicId) {
                    return res.status(400).json({ error: 'Admin account is not associated with a clinic' });
                }
            } else if (!clinicId) {
                return res.status(400).json({ error: 'User is not associated with a clinic' });
            }

            const clientCode = await generateClientCode(clinicId as string);

            const client = await prisma.client.create({
                data: {
                    clientCode,
                    title: data.title || null,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: normalizeEmail(data.email),
                    phone: data.phone,
                    alternatePhone: data.alternatePhone || null,
                    address: data.address,
                    emergencyContactName: data.emergencyContactName || null,
                    emergencyContactPhone: data.emergencyContactPhone || null,
                    emergencyContactRelation: data.emergencyContactRelation || null,
                    preferredContact: data.preferredContact || 'Phone',
                    referralSource: data.referralSource || null,
                    internalNotes: data.internalNotes || null,
                    tags: tags || [],
                    clinicId: clinicId as string
                }
            });

            if (req.user?.id) {
                await logAudit(req.user.id, 'CLIENTS', 'CREATE', `Created client ${clientCode}: ${client.firstName} ${client.lastName}`, req.user.clinicId || undefined, req.user.name);
            }

            return res.status(201).json(client);
        } catch (error: any) {
            // Handle unique constraint conflict for clientCode (P2002)
            if (error?.code === 'P2002' && error?.meta?.target?.includes('clientCode')) {
                retryCount++;
                if (retryCount >= maxRetries) break;
                // Brief delay before retry
                await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
                continue;
            }

            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid input', details: error.errors });
            }
            console.error('Create client error:', error);
            return res.status(500).json({ error: 'Failed to create client' });
        }
    }
    res.status(500).json({ error: 'Failed to generate a unique client code after multiple attempts. Please try again.' });
});

// Update client
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { tags, ...data } = clientSchema.parse(req.body);

        const existingClient = await prisma.client.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });

        if (!existingClient) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const normalizedEmail = normalizeEmail(data.email);
        if (existingClient.isPortalEnabled && normalizedEmail) {
            await assertPortalEmailUniqueness(normalizedEmail, existingClient.id);
        }

        const client = await prisma.client.update({
            where: { id: req.params.id as string },
            data: {
                title: data.title || null,
                firstName: data.firstName,
                lastName: data.lastName,
                email: normalizedEmail,
                phone: data.phone,
                alternatePhone: data.alternatePhone || null,
                address: data.address,
                emergencyContactName: data.emergencyContactName || null,
                emergencyContactPhone: data.emergencyContactPhone || null,
                emergencyContactRelation: data.emergencyContactRelation || null,
                preferredContact: data.preferredContact || 'Phone',
                referralSource: data.referralSource || null,
                internalNotes: data.internalNotes || null,
                tags: tags || [],
            }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'CLIENTS', 'UPDATE', `Updated client: ${client.firstName} ${client.lastName}`, req.user.clinicId || undefined, req.user.name);
        }

        res.json(client);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        if (error?.code === 'PORTAL_EMAIL_CONFLICT') {
            return res.status(409).json({ error: error.message, code: error.code });
        }
        res.status(500).json({ error: 'Failed to update client' });
    }
});

// Update internal notes only
router.patch('/:id/notes', authenticate, async (req: AuthRequest, res) => {
    try {
        const { internalNotes } = req.body;
        const existingClient = await prisma.client.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });
        if (!existingClient) return res.status(404).json({ error: 'Client not found' });

        const client = await prisma.client.update({
            where: { id: req.params.id as string },
            data: { internalNotes: internalNotes || null }
        });
        res.json(client);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update notes' });
    }
});

// Update tags only
router.patch('/:id/tags', authenticate, async (req: AuthRequest, res) => {
    try {
        const { tags } = req.body;
        const existingClient = await prisma.client.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });
        if (!existingClient) return res.status(404).json({ error: 'Client not found' });

        const client = await prisma.client.update({
            where: { id: req.params.id as string },
            data: { tags: tags || [] }
        });
        res.json(client);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update tags' });
    }
});

// Send portal invite
router.post('/:id/portal/invite', authenticate, async (req: AuthRequest, res) => {
    try {
        const client = await prisma.client.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string },
            include: {
                clinic: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const { invite, emailDelivery } = await createPortalInvite({
            client,
            invitedBy: req.user?.id as string,
        });

        await logAudit(
            req.user?.id as string,
            'CLIENTS',
            'PORTAL_INVITE',
            `Portal invite created for ${client.firstName} ${client.lastName} (${client.email || 'no-email'}). Delivery: ${emailDelivery.status}${emailDelivery.reason ? ` - ${emailDelivery.reason}` : ''}`,
            req.user?.clinicId || undefined,
            req.user?.name
        );

        const refreshed = await findClientForUser(req, client.id);
        res.status(201).json({
            message: emailDelivery.delivered ? 'Portal invite sent' : 'Portal invite created, but email delivery failed',
            invite,
            emailDelivery,
            client: refreshed ? withPortalAccess(refreshed) : null,
        });
    } catch (error: any) {
        console.error('Portal invite error:', error);
        if (error?.code === 'MISSING_CLIENT_EMAIL') {
            return res.status(400).json({ error: error.message, code: error.code });
        }
        if (error?.code === 'PORTAL_EMAIL_CONFLICT') {
            return res.status(409).json({ error: error.message, code: error.code });
        }
        res.status(500).json({ error: 'Failed to send portal invite' });
    }
});

// Generate client portal login details immediately
router.post('/:id/portal/credentials', authenticate, async (req: AuthRequest, res) => {
    try {
        const client = await prisma.client.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string },
            include: {
                clinic: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const normalizedEmail = normalizeEmail(client.email);
        if (!normalizedEmail) {
            return res.status(400).json({ error: 'Client email is required before creating portal login details.' });
        }

        await assertPortalEmailUniqueness(normalizedEmail, client.id);

        const temporaryPassword = generateTemporaryPassword();
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        await prisma.client.update({
            where: { id: client.id },
            data: {
                password: hashedPassword,
                isPortalEnabled: true,
                portalPasswordMustChange: true,
            },
        });

        const appUrl = (process.env.APP_URL || 'https://vetnexus.vetnexuspro.com').replace(/\/$/, '');
        const emailDelivery = await sendPortalCredentialsEmail({
            to: normalizedEmail,
            clientName: `${client.firstName} ${client.lastName}`,
            clinicName: client.clinic?.name || 'Your Veterinary Clinic',
            email: normalizedEmail,
            temporaryPassword,
            loginUrl: `${appUrl}/portal`,
        });

        await logAudit(
            req.user?.id as string,
            'CLIENTS',
            'PORTAL_CREDENTIALS',
            `Generated portal login details for ${client.firstName} ${client.lastName}. Delivery: ${emailDelivery.status}${emailDelivery.reason ? ` - ${emailDelivery.reason}` : ''}`,
            req.user?.clinicId || undefined,
            req.user?.name
        );

        const refreshed = await findClientForUser(req, client.id);
        res.status(201).json({
            message: emailDelivery.delivered ? 'Portal login details sent' : 'Portal login details created, but email delivery failed',
            temporaryPassword,
            emailDelivery,
            client: refreshed ? withPortalAccess(refreshed) : null,
        });
    } catch (error: any) {
        console.error('Portal credentials error:', error);
        if (error?.code === 'PORTAL_EMAIL_CONFLICT') {
            return res.status(409).json({ error: error.message, code: error.code });
        }
        res.status(500).json({ error: 'Failed to generate portal login details' });
    }
});

// Resend portal invite (creates a fresh token and revokes prior pending invites)
router.post('/:id/portal/invite/resend', authenticate, async (req: AuthRequest, res) => {
    try {
        const client = await prisma.client.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string },
            include: {
                clinic: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const { invite, emailDelivery } = await createPortalInvite({
            client,
            invitedBy: req.user?.id as string,
        });

        await logAudit(
            req.user?.id as string,
            'CLIENTS',
            'PORTAL_INVITE_RESEND',
            `Portal invite resent for ${client.firstName} ${client.lastName}. Delivery: ${emailDelivery.status}${emailDelivery.reason ? ` - ${emailDelivery.reason}` : ''}`,
            req.user?.clinicId || undefined,
            req.user?.name
        );

        const refreshed = await findClientForUser(req, client.id);
        res.json({
            message: emailDelivery.delivered ? 'Portal invite resent' : 'Portal invite recreated, but email delivery failed',
            invite,
            emailDelivery,
            client: refreshed ? withPortalAccess(refreshed) : null,
        });
    } catch (error: any) {
        console.error('Portal invite resend error:', error);
        if (error?.code === 'MISSING_CLIENT_EMAIL') {
            return res.status(400).json({ error: error.message, code: error.code });
        }
        if (error?.code === 'PORTAL_EMAIL_CONFLICT') {
            return res.status(409).json({ error: error.message, code: error.code });
        }
        res.status(500).json({ error: 'Failed to resend portal invite' });
    }
});

// Enable portal access (for previously claimed accounts)
router.post('/:id/portal/access/enable', authenticate, async (req: AuthRequest, res) => {
    try {
        const existing = await prisma.client.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const normalizedEmail = normalizeEmail(existing.email);
        if (!normalizedEmail) {
            return res.status(400).json({ error: 'Client email is required to enable portal access.' });
        }
        if (!existing.password) {
            return res.status(400).json({
                error: 'Client has not completed portal setup yet. Send an invite first.',
                code: 'INVITE_REQUIRED',
            });
        }

        await assertPortalEmailUniqueness(normalizedEmail, existing.id);

        await prisma.client.update({
            where: { id: existing.id },
            data: { isPortalEnabled: true }
        });

        const refreshed = await findClientForUser(req, existing.id);
        res.json({
            message: 'Portal access enabled',
            client: refreshed ? withPortalAccess(refreshed) : null,
        });
    } catch (error: any) {
        if (error?.code === 'PORTAL_EMAIL_CONFLICT') {
            return res.status(409).json({ error: error.message, code: error.code });
        }
        res.status(500).json({ error: 'Failed to enable portal access' });
    }
});

// Revoke portal access
router.post('/:id/portal/access/revoke', authenticate, async (req: AuthRequest, res) => {
    try {
        const existing = await prisma.client.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const now = new Date();
        await prisma.$transaction([
            prisma.client.update({
                where: { id: existing.id },
                data: { isPortalEnabled: false },
            }),
            prisma.portalInvite.updateMany({
                where: {
                    clientId: existing.id,
                    acceptedAt: null,
                    revokedAt: null,
                },
                data: { revokedAt: now },
            }),
        ]);

        await logAudit(
            req.user?.id as string,
            'CLIENTS',
            'PORTAL_REVOKE',
            `Revoked portal access for ${existing.firstName} ${existing.lastName}`,
            req.user?.clinicId || undefined,
            req.user?.name
        );

        const refreshed = await findClientForUser(req, existing.id);
        res.json({
            message: 'Portal access revoked',
            client: refreshed ? withPortalAccess(refreshed) : null,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to revoke portal access' });
    }
});

// Delete client - Admin Only
router.delete('/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const existingClient = await prisma.client.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });

        if (!existingClient) {
            return res.status(404).json({ error: 'Client not found' });
        }

        await prisma.client.delete({
            where: { id: req.params.id as string }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'CLIENTS', 'DELETE', `Deleted client: ${existingClient.firstName} ${existingClient.lastName}`, req.user.clinicId || undefined, req.user.name);
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete client' });
    }
});

// Add communication record
router.post('/:id/communications', authenticate, async (req: AuthRequest, res) => {
    try {
        const { type, content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const targetClient = await prisma.client.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });

        if (!targetClient) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const communication = await prisma.communication.create({
            data: {
                clientId: req.params.id as string,
                staffId: req.user?.id || null,
                staffName: req.user?.name || null,
                type: type || 'General',
                content,
                status: 'Sent',
                sentAt: new Date()
            }
        });

        if (req.user?.id) {
            await logAudit(
                req.user.id,
                'CLIENTS',
                'RECORD_COMMUNICATION',
                `Recorded ${type || 'General'} interaction with client: ${targetClient.firstName} ${targetClient.lastName}`,
                req.user.clinicId || undefined,
                req.user.name
            );
        }

        res.status(201).json(communication);
    } catch (error) {
        console.error('Failed to create communication:', error);
        res.status(500).json({ error: 'Failed to record communication' });
    }
});

export default router;
