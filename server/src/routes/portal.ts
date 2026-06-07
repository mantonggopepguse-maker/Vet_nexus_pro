import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import multer from 'multer';

const router = Router();
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 4 },
});

const threadCreateSchema = z.object({
    subject: z.string().trim().min(1).max(120),
    content: z.string().trim().min(1).max(5000),
    category: z.enum([
        'Appointment question',
        'Medication/refill question',
        'Post-visit follow-up',
        'Lab/result clarification',
        'General support',
    ]).default('General support'),
    patientId: z.string().optional().nullable(),
});

const messageSchema = z.object({
    content: z.string().trim().max(5000).optional().default(''),
});

const orderSchema = z.object({
    items: z.array(z.object({
        itemId: z.string(),
        quantity: z.number().int().min(1).max(99),
    })).min(1),
});

const attachmentTypeFromMime = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.startsWith('video/')) return 'Video';
    if (mimeType.startsWith('audio/')) return 'VoiceNote';
    return null;
};

const buildAttachmentCreateData = (files: Express.Multer.File[] = []) => {
    return files.map((file) => {
        const type = attachmentTypeFromMime(file.mimetype);
        if (!type) {
            const error: any = new Error('Only image, video, and audio attachments are allowed.');
            error.statusCode = 400;
            throw error;
        }
        if (file.size > MAX_ATTACHMENT_SIZE) {
            const error: any = new Error('Attachments must be 10MB or smaller.');
            error.statusCode = 413;
            throw error;
        }
        return {
            type,
            url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
            name: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
        };
    });
};

const clientOnly = async (req: AuthRequest, res: any, next: any) => {
    if (!req.user || !req.user.roles.includes('CLIENT')) {
        return res.status(403).json({ error: 'Client portal access required' });
    }

    // Deep check: Is portal enabled for this specific client?
    const client = await prisma.client.findUnique({
        where: { id: req.user.id },
        select: { isPortalEnabled: true }
    });

    if (!client || !client.isPortalEnabled) {
        return res.status(403).json({ error: 'Portal access is disabled for this account.' });
    }

    next();
};

const getClientContext = async (clientId: string, clinicId: string) => {
    return prisma.client.findFirst({
        where: {
            id: clientId,
            clinicId,
            isPortalEnabled: true,
        },
        include: {
            clinic: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    email: true,
                    address: true,
                },
            },
        },
    });
};

const buildConversationSummary = (conversation: any) => {
    const unreadForClient = (conversation.messages || []).filter(
        (message: any) => message.direction === 'OUTBOUND' && !message.isRead
    ).length;

    return {
        id: conversation.id,
        subject: conversation.subject,
        category: conversation.category,
        status: conversation.status,
        priority: conversation.priority,
        startedAt: conversation.startedAt,
        updatedAt: conversation.updatedAt,
        unreadForClient,
        patient: conversation.patient
            ? {
                id: conversation.patient.id,
                name: conversation.patient.name,
                species: conversation.patient.species,
            }
            : null,
        latestMessage: conversation.messages?.[0]
            ? {
                id: conversation.messages[0].id,
                content: conversation.messages[0].content,
                direction: conversation.messages[0].direction,
                senderType: conversation.messages[0].senderType,
                sentAt: conversation.messages[0].sentAt,
                isRead: conversation.messages[0].isRead,
                attachments: conversation.messages[0].attachments || [],
            }
            : null,
    };
};

const buildOrderSummary = (order: any) => ({
    id: order.id,
    invoiceNumber: order.invoiceNumber,
    status: order.status,
    total: order.total,
    amountPaid: order.amountPaid,
    balanceDue: order.balanceDue,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    items: (order.items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        item: item.item
            ? {
                id: item.item.id,
                name: item.item.name,
                sku: item.item.sku,
                retailPrice: item.item.retailPrice,
            }
            : null,
    })),
});

// GET /api/portal/dashboard
router.get('/dashboard', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const clientId = req.user?.id as string;
        const clinicId = req.user?.clinicId as string;

        const client = await prisma.client.findUnique({
            where: { id: clientId },
            include: {
                clinic: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                        address: true,
                    },
                },
                patients: {
                    include: {
                        vaccinations: { orderBy: { dateGiven: 'desc' }, take: 3 },
                        labResults: { orderBy: { testDate: 'desc' }, take: 5 },
                        treatments: {
                            orderBy: { date: 'desc' },
                            take: 5,
                            include: {
                                medications: true,
                                procedures: { include: { procedure: true } },
                                vet: { select: { id: true, name: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                appointments: {
                    where: { status: { in: ['Pending', 'Confirmed'] } },
                    orderBy: [{ date: 'asc' }, { time: 'asc' }],
                    include: { procedure: true, patient: true },
                },
                reminders: {
                    orderBy: { scheduledFor: 'asc' },
                    take: 10,
                    include: {
                        patient: {
                            select: { id: true, name: true, species: true },
                        },
                    },
                },
                consentForms: {
                    where: { status: 'Pending' },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        patient: {
                            select: { id: true, name: true, species: true },
                        },
                    },
                },
            },
        });

        if (!client || client.clinicId !== clinicId) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const conversations = await prisma.aIConversation.findMany({
            where: {
                clinicId,
                clientId,
                platform: 'PORTAL',
            },
            include: {
                patient: {
                    select: {
                        id: true,
                        name: true,
                        species: true,
                    },
                },
                messages: {
                    orderBy: { sentAt: 'desc' },
                    take: 1,
                    include: { attachments: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
            take: 5,
        });

        const { password: _password, ...safeClient } = client as any;
        res.json({
            ...safeClient,
            portalInbox: {
                unreadCount: conversations.reduce((total, conversation) => {
                    const message = conversation.messages?.[0];
                    if (message && message.direction === 'OUTBOUND' && !message.isRead) {
                        return total + 1;
                    }
                    return total;
                }, 0),
                conversations: conversations.map(buildConversationSummary),
            },
        });
    } catch (error) {
        console.error('Portal Dashboard Data Error:', error);
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
});

// GET /api/portal/shop
router.get('/shop', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const clientId = req.user?.id as string;

        const client = await prisma.client.findFirst({
            where: { id: clientId, clinicId, isPortalEnabled: true },
            select: { id: true },
        });

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const items = await prisma.inventoryItem.findMany({
            where: {
                clinicId,
                showInClientPortal: true,
            },
            select: {
                id: true,
                name: true,
                description: true,
                sku: true,
                category: true,
                retailPrice: true,
                imageUrl: true,
                manufacturer: true,
            },
            orderBy: [
                { sales: 'desc' },
                { createdAt: 'desc' },
            ],
            take: 24,
        });

        res.json({ items });
    } catch (error) {
        console.error('Portal shop error:', error);
        res.status(500).json({ error: 'Failed to load shop items' });
    }
});

// GET /api/portal/orders
router.get('/orders', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const clientId = req.user?.id as string;

        const client = await prisma.client.findFirst({
            where: { id: clientId, clinicId, isPortalEnabled: true },
            select: { id: true },
        });

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const orders = await prisma.sale.findMany({
            where: {
                clinicId,
                clientId,
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                items: {
                    include: {
                        item: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                                retailPrice: true,
                            },
                        },
                    },
                },
            },
        });

        res.json({ orders: orders.map(buildOrderSummary) });
    } catch (error) {
        console.error('Portal orders error:', error);
        res.status(500).json({ error: 'Failed to load orders' });
    }
});

// GET /api/portal/patient/:id/history
router.get('/patient/:id/history', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const patientId = req.params.id;
        const clientId = req.user?.id;

        const patient = await prisma.patient.findFirst({
            where: { id: patientId as string, ownerId: clientId as string },
            include: {
                vaccinations: { orderBy: { dateGiven: 'desc' } },
                labResults: { orderBy: { testDate: 'desc' } },
                treatments: {
                    orderBy: { date: 'desc' },
                    include: {
                        medications: true,
                        procedures: { include: { procedure: true } },
                        treatmentNotes: {
                            orderBy: { date: 'desc' },
                            include: {
                                vet: { select: { id: true, name: true } },
                            },
                        },
                        vet: { select: { id: true, name: true } },
                    },
                },
                consentForms: {
                    orderBy: { createdAt: 'desc' },
                },
                hospitalizations: {
                    orderBy: { admissionDate: 'desc' },
                    include: {
                        prescriptions: true,
                        notes: {
                            orderBy: { date: 'desc' },
                        },
                    },
                },
            },
        });

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found or access denied' });
        }

        res.json(patient);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load patient history' });
    }
});

// GET /api/portal/inbox
router.get('/inbox', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const clientId = req.user?.id as string;
        const clinicId = req.user?.clinicId as string;

        const conversations = await prisma.aIConversation.findMany({
            where: {
                clinicId,
                clientId,
                platform: 'PORTAL',
            },
            include: {
                patient: {
                    select: {
                        id: true,
                        name: true,
                        species: true,
                    },
                },
                messages: {
                    orderBy: { sentAt: 'desc' },
                    take: 1,
                    include: { attachments: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        res.json({
            unreadCount: conversations.reduce((total, conversation) => total + (conversation.messages?.[0]?.direction === 'OUTBOUND' && !conversation.messages?.[0]?.isRead ? 1 : 0), 0),
            conversations: conversations.map(buildConversationSummary),
        });
    } catch (error) {
        console.error('Portal inbox error:', error);
        res.status(500).json({ error: 'Failed to load inbox' });
    }
});

// GET /api/portal/inbox/:id
router.get('/inbox/:id', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const conversationId = String(req.params.id);
        const clinicId = req.user?.clinicId as string;
        const clientId = req.user?.id as string;

        const conversation = await prisma.aIConversation.findFirst({
            where: {
                id: conversationId,
                clinicId,
                clientId,
                platform: 'PORTAL',
            },
            include: {
                patient: {
                    select: {
                        id: true,
                        name: true,
                        species: true,
                        breed: true,
                    },
                },
                clinic: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                        address: true,
                    },
                },
                messages: {
                    orderBy: { sentAt: 'asc' },
                    include: { attachments: true },
                },
            },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        await prisma.aIMessage.updateMany({
            where: {
                conversationId: conversation.id,
                direction: 'OUTBOUND',
                isRead: false,
            },
            data: { isRead: true },
        });

        res.json({
            ...conversation,
            messages: conversation.messages.map((message) => ({
                ...message,
                isRead: message.direction === 'OUTBOUND' ? true : message.isRead,
            })),
        });
    } catch (error) {
        console.error('Portal thread error:', error);
        res.status(500).json({ error: 'Failed to load conversation' });
    }
});

// POST /api/portal/inbox
router.post('/inbox', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const { subject, content, category, patientId } = threadCreateSchema.parse(req.body);
        const clientId = req.user?.id as string;
        const clinicId = req.user?.clinicId as string;

        const client = await getClientContext(clientId, clinicId);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        if (patientId) {
            const patient = await prisma.patient.findFirst({
                where: { id: patientId, ownerId: clientId },
                select: { id: true },
            });
            if (!patient) {
                return res.status(403).json({ error: 'Patient access denied' });
            }
        }

        const conversation = await prisma.aIConversation.create({
            data: {
                clinicId,
                clientId,
                patientId: patientId || null,
                platform: 'PORTAL',
                status: 'ACTIVE',
                priority: 'NORMAL',
                subject,
                category,
                messages: {
                    create: {
                        direction: 'INBOUND',
                        senderType: 'CLIENT',
                        content,
                        isRead: false,
                    },
                },
            },
            include: {
                patient: {
                    select: { id: true, name: true, species: true },
                },
                messages: {
                    orderBy: { sentAt: 'asc' },
                },
            },
        });

        res.status(201).json(conversation);
    } catch (error) {
        console.error('Portal conversation create error:', error);
        res.status(400).json({ error: 'Failed to create conversation' });
    }
});

// POST /api/portal/inbox/:id/messages
router.post('/inbox/:id/messages', authenticate, clientOnly, upload.array('attachments', 4), async (req: AuthRequest, res) => {
    try {
        const files = (req.files as Express.Multer.File[]) || [];
        const attachments = buildAttachmentCreateData(files);
        const { content } = messageSchema.parse(req.body);
        if (!content.trim() && attachments.length === 0) {
            return res.status(400).json({ error: 'Message text or attachment is required' });
        }
        const conversationId = String(req.params.id);
        const clinicId = req.user?.clinicId as string;
        const clientId = req.user?.id as string;

        const conversation = await prisma.aIConversation.findFirst({
            where: {
                id: conversationId,
                clinicId,
                clientId,
                platform: 'PORTAL',
            },
            select: {
                id: true,
                status: true,
            },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.status === 'CLOSED') {
            return res.status(400).json({ error: 'This conversation has been closed by the clinic.' });
        }

        const message = await prisma.aIMessage.create({
            data: {
                conversationId: conversation.id,
                direction: 'INBOUND',
                senderType: 'CLIENT',
                content: content.trim(),
                isRead: false,
                attachments: attachments.length ? { create: attachments } : undefined,
            },
            include: { attachments: true },
        });

        await prisma.aIConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
        });

        res.status(201).json(message);
    } catch (error) {
        console.error('Portal reply error:', error);
        res.status((error as any)?.statusCode || 400).json({ error: (error as any)?.message || 'Failed to send message' });
    }
});

// POST /api/portal/orders
router.post('/orders', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const { items } = orderSchema.parse(req.body);
        const clinicId = req.user?.clinicId as string;
        const clientId = req.user?.id as string;

        const client = await prisma.client.findFirst({
            where: { id: clientId, clinicId, isPortalEnabled: true },
            select: { id: true, firstName: true, lastName: true },
        });
        if (!client) return res.status(404).json({ error: 'Client not found' });

        const sale = await prisma.$transaction(async (tx: any) => {
            const clinic = await tx.clinic.findUnique({ where: { id: clinicId }, select: { acronym: true } });
            const count = await tx.sale.count({ where: { clinicId } });
            let invoiceNumber = '';
            for (let offset = 1; offset <= 1000; offset++) {
                const candidate = `PORTAL-${(count + offset).toString().padStart(5, '0')}/${clinic?.acronym || 'VET'}`;
                const existing = await tx.sale.findFirst({ where: { clinicId, invoiceNumber: candidate }, select: { id: true } });
                if (!existing) {
                    invoiceNumber = candidate;
                    break;
                }
            }
            if (!invoiceNumber) throw new Error('Could not generate invoice number');

            const ids = items.map((item) => item.itemId);
            const inventory = await tx.inventoryItem.findMany({
                where: { id: { in: ids }, clinicId, showInClientPortal: true },
            });
            if (inventory.length !== ids.length) {
                throw new Error('One or more items are no longer available.');
            }

            const itemMap = new Map<string, any>(inventory.map((item: any) => [item.id, item]));
            let subtotal = 0;
            const preparedItems = items.map((line) => {
                const item = itemMap.get(line.itemId);
                if (!item) throw new Error('Item unavailable');
                subtotal += item.retailPrice * line.quantity;
                return {
                    itemId: item.id,
                    name: item.name,
                    quantity: line.quantity,
                    pricePerUnit: item.retailPrice,
                };
            });

            return tx.sale.create({
                data: {
                    clinicId,
                    clientId,
                    clientName: `${client.firstName} ${client.lastName}`,
                    invoiceNumber,
                    type: 'INVOICE',
                    status: 'Pending',
                    subtotal,
                    discount: 0,
                    tax: 0,
                    total: subtotal,
                    amountPaid: 0,
                    balanceDue: subtotal,
                    issuerName: 'Client Portal',
                    paymentMethod: 'Portal Order',
                    items: { create: preparedItems },
                },
                include: { items: { include: { item: true } } },
            });
        });

        res.status(201).json(buildOrderSummary(sale));
    } catch (error: any) {
        console.error('Portal order error:', error);
        res.status(400).json({ error: error?.message || 'Failed to create order' });
    }
});

// POST /api/portal/inbox/:id/read
router.post('/inbox/:id/read', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const conversationId = String(req.params.id);
        const clinicId = req.user?.clinicId as string;
        const clientId = req.user?.id as string;

        const conversation = await prisma.aIConversation.findFirst({
            where: {
                id: conversationId,
                clinicId,
                clientId,
                platform: 'PORTAL',
            },
            select: { id: true },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const result = await prisma.aIMessage.updateMany({
            where: {
                conversationId: conversation.id,
                direction: 'OUTBOUND',
                isRead: false,
            },
            data: { isRead: true },
        });

        res.json({ updated: result.count });
    } catch (error) {
        console.error('Portal read sync error:', error);
        res.status(500).json({ error: 'Failed to update read status' });
    }
});

// POST /api/portal/consent/:id/sign
router.post('/consent/:id/sign', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { signedBy } = req.body;
        const clientId = req.user?.id;
        const ipAddress = req.ip;

        const form = await prisma.consentForm.findFirst({
            where: { id: id as string, clientId: clientId as string }
        });

        if (!form) {
            return res.status(404).json({ error: 'Form not found or access denied' });
        }

        const updated = await prisma.consentForm.update({
            where: { id: id as string },
            data: {
                signedBy,
                signatureDate: new Date(),
                ipAddress,
                status: 'Signed'
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to sign consent form' });
    }
});

// GET /api/portal/drive/auth
router.get('/drive/auth', authenticate, clientOnly, (req: AuthRequest, res) => {
    import('../services/driveService.js').then(({ driveService }) => {
        // Pass 'client' in state to distinguish in callback if needed, 
        // though callback goes to portal/drive/callback
        const url = driveService.getAuthUrl('client');
        res.json({ url });
    }).catch(err => res.status(500).json({ error: 'Failed to load drive service' }));
});

// POST /api/portal/drive/callback
router.post('/drive/callback', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const { code } = req.body;
        const clientId = req.user?.id as string;
        
        const { driveService } = await import('../services/driveService.js');
        await driveService.handleClientCallback(code, clientId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Portal Drive auth error:', error);
        res.status(500).json({ error: 'Failed to authenticate with Drive' });
    }
});

// POST /api/portal/drive/export
router.post('/drive/export', authenticate, clientOnly, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Missing file' });
        const clientId = req.user?.id as string;

        const { driveService } = await import('../services/driveService.js');
        const result = await driveService.uploadClientFile(
            clientId,
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        res.json({ success: true, result });
    } catch (error) {
        console.error('Portal Drive export error:', error);
        res.status(500).json({ error: 'Failed to export to Drive' });
    }
});

export default router;
