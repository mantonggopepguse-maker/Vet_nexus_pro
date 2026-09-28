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

        let items = await prisma.inventoryItem.findMany({
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

        // Fallback: If no items explicitly flagged for portal, show top clinic inventory items
        if (items.length === 0) {
            items = await prisma.inventoryItem.findMany({
                where: { clinicId },
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
        }

        // Fallback: If clinic has zero inventory records yet, supply standard clinic shop catalog items
        if (items.length === 0) {
            const fallbackCatalog = [
                {
                    id: 'shop-item-1',
                    name: 'NexGard Spectra Flea & Tick Chewables',
                    description: 'Monthly oral treatment for fleas, ticks, heartworm, and intestinal worms.',
                    category: 'Medication',
                    retailPrice: 14500,
                    sku: 'NEX-SPEC-3PK',
                    imageUrl: null,
                    manufacturer: 'Boehringer Ingelheim',
                },
                {
                    id: 'shop-item-2',
                    name: 'Royal Canin Gastrointestinal Prescription Kibble 3kg',
                    description: 'Veterinary diet formulated for dogs with acute or chronic intestinal disorders.',
                    category: 'Diet & Nutrition',
                    retailPrice: 28000,
                    sku: 'RC-GI-3KG',
                    imageUrl: null,
                    manufacturer: 'Royal Canin',
                },
                {
                    id: 'shop-item-3',
                    name: 'Cosequin Joint Health Supplement Tablets (60ct)',
                    description: 'Glucosamine and chondroitin formula to support canine joint cartilage & mobility.',
                    category: 'Supplements',
                    retailPrice: 18200,
                    sku: 'COS-JT-60',
                    imageUrl: null,
                    manufacturer: 'Nutramax Labs',
                },
                {
                    id: 'shop-item-4',
                    name: 'Douxo S3 PYO Medicated Antiseptic Shampoo 200ml',
                    description: 'Antiseptic and antifungal shampoo for dogs and cats with skin infections.',
                    category: 'Grooming & Skin',
                    retailPrice: 12500,
                    sku: 'DOUXO-PYO-200',
                    imageUrl: null,
                    manufacturer: 'Ceva Animal Health',
                },
                {
                    id: 'shop-item-5',
                    name: 'Virbac CET Enzymatic Toothpaste & Brush Kit',
                    description: 'Poultry flavored enzymatic toothpaste with dual-ended toothbrush for oral hygiene.',
                    category: 'Dental Care',
                    retailPrice: 9800,
                    sku: 'VIR-DENT-KIT',
                    imageUrl: null,
                    manufacturer: 'Virbac',
                },
                {
                    id: 'shop-item-6',
                    name: 'HomeAgain Universal ISO Microchip & Lifetime Registration',
                    description: 'Permanent pet identification chip pre-loaded with national registry database sync.',
                    category: 'Accessories',
                    retailPrice: 15000,
                    sku: 'HA-MICRO-ISO',
                    imageUrl: null,
                    manufacturer: 'HomeAgain',
                },
            ];
            items = fallbackCatalog as any;
        }

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
                where: { id: { in: ids }, clinicId },
            });

            const fallbackCatalogMap = new Map([
                ['shop-item-1', { name: 'NexGard Spectra Flea & Tick Chewables', retailPrice: 14500 }],
                ['shop-item-2', { name: 'Royal Canin Gastrointestinal Prescription Kibble 3kg', retailPrice: 28000 }],
                ['shop-item-3', { name: 'Cosequin Joint Health Supplement Tablets (60ct)', retailPrice: 18200 }],
                ['shop-item-4', { name: 'Douxo S3 PYO Medicated Antiseptic Shampoo 200ml', retailPrice: 12500 }],
                ['shop-item-5', { name: 'Virbac CET Enzymatic Toothpaste & Brush Kit', retailPrice: 9800 }],
                ['shop-item-6', { name: 'HomeAgain Universal ISO Microchip & Lifetime Registration', retailPrice: 15000 }],
            ]);

            const itemMap = new Map<string, any>(inventory.map((item: any) => [item.id, item]));
            let subtotal = 0;
            const preparedItems = items.map((line) => {
                const item = itemMap.get(line.itemId) || fallbackCatalogMap.get(line.itemId);
                if (!item) {
                    throw new Error('Selected item is no longer available.');
                }
                const unitPrice = item.retailPrice || 0;
                subtotal += unitPrice * line.quantity;
                return {
                    itemId: item.id || null,
                    name: item.name,
                    quantity: line.quantity,
                    pricePerUnit: unitPrice,
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
        const { signedBy, signatureDataUrl } = req.body;
        const clientId = req.user?.id;
        const ipAddress = req.ip;

        const form = await prisma.consentForm.findFirst({
            where: { id: id as string, clientId: clientId as string }
        });

        if (!form) {
            return res.status(404).json({ error: 'Form not found or access denied' });
        }

        const finalSignedBy = signatureDataUrl 
            ? `${signedBy} [Canvas Digital Signature Attached]` 
            : signedBy;

        const updated = await prisma.consentForm.update({
            where: { id: id as string },
            data: {
                signedBy: finalSignedBy,
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

// ── Portal Available Procedures ──────────────────────────────────────────────
router.get('/appointments/available-procedures', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const procedures = await prisma.procedure.findMany({
            where: { clinicId, status: 'Active' },
            select: { id: true, name: true, description: true, category: true, costClient: true },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });
        res.json({ procedures });
    } catch (error) {
        console.error('Portal procedures error:', error);
        res.status(500).json({ error: 'Failed to load procedures' });
    }
});

// ── Portal Appointment Request ───────────────────────────────────────────────
router.post('/appointments/request', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const clientId = req.user?.id as string;
        const { patientId, procedureId, date, time, notes } = req.body;

        if (!patientId || !procedureId || !date || !time) {
            return res.status(400).json({ error: 'Patient, procedure, date, and time are required' });
        }

        // Verify patient belongs to client
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, ownerId: clientId },
            select: { id: true },
        });
        if (!patient) return res.status(403).json({ error: 'Patient access denied' });

        // Verify procedure exists
        const procedure = await prisma.procedure.findFirst({
            where: { id: procedureId, clinicId, status: 'Active' },
            select: { id: true },
        });
        if (!procedure) return res.status(404).json({ error: 'Procedure not found' });

        const appointment = await prisma.appointment.create({
            data: {
                clinicId,
                clientId,
                patientId,
                procedureId,
                date,
                time,
                notes: notes || null,
                status: 'Pending',
            },
            include: {
                patient: { select: { id: true, name: true, species: true } },
                procedure: { select: { id: true, name: true, costClient: true } },
            },
        });

        res.status(201).json(appointment);
    } catch (error) {
        console.error('Portal appointment request error:', error);
        res.status(500).json({ error: 'Failed to request appointment' });
    }
});

// ── Portal Invoices ──────────────────────────────────────────────────────────
router.get('/invoices', authenticate, clientOnly, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const clientId = req.user?.id as string;

        const invoices = await prisma.sale.findMany({
            where: { clinicId, clientId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                items: {
                    include: {
                        item: { select: { id: true, name: true, sku: true, retailPrice: true } },
                        procedure: { select: { id: true, name: true, costClient: true } },
                    },
                },
                payments: {
                    orderBy: { date: 'desc' },
                },
            },
        });

        res.json({
            invoices: invoices.map((inv: any) => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                type: inv.type,
                status: inv.status,
                subtotal: inv.subtotal,
                discount: inv.discount,
                tax: inv.tax,
                total: inv.total,
                amountPaid: inv.amountPaid,
                balanceDue: inv.balanceDue,
                paymentMethod: inv.paymentMethod,
                createdAt: inv.createdAt,
                items: (inv.items || []).map((item: any) => ({
                    id: item.id,
                    name: item.name || item.item?.name || item.procedure?.name || 'Item',
                    quantity: item.quantity,
                    pricePerUnit: item.pricePerUnit,
                    item: item.item ? { id: item.item.id, name: item.item.name } : null,
                    procedure: item.procedure ? { id: item.procedure.id, name: item.procedure.name } : null,
                })),
                payments: (inv.payments || []).map((p: any) => ({
                    id: p.id,
                    amount: p.amount,
                    method: p.method,
                    date: p.date,
                })),
            })),
            summary: {
                totalInvoices: invoices.length,
                totalOwed: invoices.reduce((sum, inv) => sum + inv.balanceDue, 0),
                totalPaid: invoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
            },
        });
    } catch (error) {
        console.error('Portal invoices error:', error);
        res.status(500).json({ error: 'Failed to load invoices' });
    }
});

// POST /api/portal/profile/avatar
router.post('/profile/avatar', authenticate, clientOnly, upload.single('avatar'), async (req: AuthRequest, res) => {
    try {
        const clientId = req.user?.id as string;
        let avatarUrl = req.body?.avatarUrl;

        if (req.file) {
            avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        if (!avatarUrl) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const updatedClient = await prisma.client.update({
            where: { id: clientId },
            data: { avatarUrl },
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        });

        res.json({ success: true, client: updatedClient });
    } catch (error: any) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to update profile picture' });
    }
});

// POST /api/portal/patient/:id/avatar
router.post('/patient/:id/avatar', authenticate, clientOnly, upload.single('avatar'), async (req: AuthRequest, res) => {
    try {
        const clientId = req.user?.id as string;
        const patientId = req.params.id as string;
        let avatarUrl = req.body?.avatarUrl;

        if (req.file) {
            avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        if (!avatarUrl) {
            return res.status(400).json({ error: 'No image provided' });
        }

        // Verify pet ownership
        const pet = await prisma.patient.findFirst({
            where: { id: patientId, ownerId: clientId }
        });

        if (!pet) {
            return res.status(404).json({ error: 'Pet not found or unauthorized' });
        }

        const updatedPet = await prisma.patient.update({
            where: { id: patientId },
            data: { avatarUrl },
        });

        res.json({ success: true, pet: updatedPet });
    } catch (error: any) {
        console.error('Pet avatar upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to update pet picture' });
    }
});

export default router;
