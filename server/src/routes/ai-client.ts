import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';

const router = Router();
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 4 },
});

const messageSchema = z.object({
    conversationId: z.string(),
    content: z.string().trim().max(5000).optional().default(''),
});

const conversationCreateSchema = z.object({
    clientId: z.string(),
    patientId: z.string().optional().nullable(),
    subject: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(120).default('General support'),
    content: z.string().trim().min(1).max(5000),
    platform: z.enum(['PORTAL']).default('PORTAL'),
});

const statusSchema = z.object({
    status: z.enum(['ACTIVE', 'CLOSED']),
});

const faqSchema = z.object({
    question: z.string().trim().min(1),
    answer: z.string().trim().min(1),
    category: z.string().trim().min(1).default('General'),
    keywords: z.array(z.string().trim().min(1)).default([]),
    isActive: z.boolean().default(true)
});

const portalConversationInclude = {
    client: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isPortalEnabled: true,
            lastLogin: true,
        },
    },
    patient: {
        select: {
            id: true,
            name: true,
            species: true,
            breed: true,
        },
    },
    messages: {
        orderBy: { sentAt: 'desc' as const },
        take: 1,
        include: { attachments: true },
    },
};

const attachmentTypeFromMime = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.startsWith('video/')) return 'Video';
    if (mimeType.startsWith('audio/')) return 'VoiceNote';
    return null;
};

const buildAttachmentCreateData = (files: Express.Multer.File[] = []) => files.map((file) => {
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

const buildConversationListItem = (conversation: any) => {
    const unreadForClinic = (conversation.messages || []).filter(
        (message: any) => message.direction === 'INBOUND' && !message.isRead
    ).length;

    return {
        ...conversation,
        unreadForClinic,
        latestMessage: conversation.messages?.[0] || null,
    };
};

async function getClinicFAQ(clinicId: string) {
    const faqs = await prisma.fAQ.findMany({
        where: { clinicId, isActive: true }
    });
    return faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
}

// Get all conversations for a clinic
router.get('/conversations', authenticate, async (req: AuthRequest, res) => {
    try {
        const platform = typeof req.query.platform === 'string' ? req.query.platform.toUpperCase() : undefined;
        const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;

        const conversations = await prisma.aIConversation.findMany({
            where: {
                clinicId: req.user?.clinicId,
                ...(platform ? { platform } : {}),
                ...(status ? { status } : {}),
            },
            include: portalConversationInclude,
            orderBy: { updatedAt: 'desc' }
        });

        res.json(conversations.map(buildConversationListItem));
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

router.get('/conversations/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const conversationId = String(req.params.id);
        const clinicId = req.user?.clinicId as string;

        const conversation = await prisma.aIConversation.findFirst({
            where: {
                id: conversationId,
                clinicId,
            },
            include: {
                client: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        isPortalEnabled: true,
                    },
                },
                patient: {
                    select: {
                        id: true,
                        name: true,
                        species: true,
                        breed: true,
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

        if (conversation.platform === 'PORTAL') {
            await prisma.aIMessage.updateMany({
                where: {
                    conversationId: conversation.id,
                    direction: 'INBOUND',
                    isRead: false,
                },
                data: { isRead: true },
            });
        }

        res.json(conversation);
    } catch (error) {
        console.error('Get conversation detail error:', error);
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});

router.post('/conversations', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const data = conversationCreateSchema.parse(req.body);

        const client = await prisma.client.findFirst({
            where: {
                id: data.clientId,
                clinicId,
            },
        });

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        if (data.patientId) {
            const patient = await prisma.patient.findFirst({
                where: {
                    id: data.patientId,
                    ownerId: client.id,
                },
                select: { id: true },
            });
            if (!patient) {
                return res.status(400).json({ error: 'Selected patient does not belong to the client.' });
            }
        }

        const conversation = await prisma.aIConversation.create({
            data: {
                clinicId,
                clientId: data.clientId,
                patientId: data.patientId || null,
                platform: 'PORTAL',
                status: 'ACTIVE',
                priority: 'NORMAL',
                subject: data.subject,
                category: data.category,
                messages: {
                    create: {
                        direction: 'OUTBOUND',
                        senderType: 'STAFF',
                        content: data.content,
                        isRead: false,
                    },
                },
            },
            include: {
                client: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                patient: {
                    select: {
                        id: true,
                        name: true,
                        species: true,
                    },
                },
                messages: {
                    orderBy: { sentAt: 'asc' },
                },
            },
        });

        res.status(201).json(conversation);
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(400).json({ error: 'Failed to create conversation' });
    }
});

router.post('/conversations/:id/status', authenticate, async (req: AuthRequest, res) => {
    try {
        const { status } = statusSchema.parse(req.body);
        const conversationId = String(req.params.id);
        const clinicId = req.user?.clinicId as string;

        const conversation = await prisma.aIConversation.findFirst({
            where: {
                id: conversationId,
                clinicId,
            },
            select: {
                id: true,
                platform: true,
            },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const updated = await prisma.aIConversation.update({
            where: { id: conversation.id },
            data: {
                status,
                updatedAt: new Date(),
            },
            include: portalConversationInclude,
        });

        res.json(buildConversationListItem(updated));
    } catch (error) {
        console.error('Update conversation status error:', error);
        res.status(400).json({ error: 'Failed to update conversation status' });
    }
});

router.post('/conversations/:id/read', authenticate, async (req: AuthRequest, res) => {
    try {
        const conversationId = String(req.params.id);
        const clinicId = req.user?.clinicId as string;

        const conversation = await prisma.aIConversation.findFirst({
            where: {
                id: conversationId,
                clinicId,
            },
            select: { id: true },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const result = await prisma.aIMessage.updateMany({
            where: {
                conversationId: conversation.id,
                direction: 'INBOUND',
                isRead: false,
            },
            data: { isRead: true },
        });

        res.json({ updated: result.count });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

router.get('/faqs', authenticate, async (req: AuthRequest, res) => {
    try {
        const faqs = await prisma.fAQ.findMany({
            where: { clinicId: req.user?.clinicId },
            orderBy: [
                { category: 'asc' },
                { question: 'asc' }
            ]
        });

        res.json(faqs);
    } catch (error) {
        console.error('Get FAQs error:', error);
        res.status(500).json({ error: 'Failed to fetch FAQs' });
    }
});

router.post('/faqs', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const data = faqSchema.parse(req.body);

        const faq = await prisma.fAQ.create({
            data: {
                clinicId: clinicId as string,
                ...data
            }
        });

        res.status(201).json(faq);
    } catch (error) {
        console.error('Create FAQ error:', error);
        res.status(400).json({ error: 'Failed to create FAQ' });
    }
});

router.put('/faqs/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const id = String(req.params.id);
        const data = faqSchema.parse(req.body);

        const existingFaq = await prisma.fAQ.findFirst({
            where: { id, clinicId }
        });

        if (!existingFaq) {
            return res.status(404).json({ error: 'FAQ not found' });
        }

        const faq = await prisma.fAQ.update({
            where: { id },
            data
        });

        res.json(faq);
    } catch (error) {
        console.error('Update FAQ error:', error);
        res.status(400).json({ error: 'Failed to update FAQ' });
    }
});

router.delete('/faqs/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const id = String(req.params.id);

        const existingFaq = await prisma.fAQ.findFirst({
            where: { id, clinicId }
        });

        if (!existingFaq) {
            return res.status(404).json({ error: 'FAQ not found' });
        }

        await prisma.fAQ.delete({
            where: { id }
        });

        res.status(204).send();
    } catch (error) {
        console.error('Delete FAQ error:', error);
        res.status(400).json({ error: 'Failed to delete FAQ' });
    }
});

// Process inbound message (Mock Webhook / Simulated)
router.post('/webhook/:platform', async (req, res) => {
    const { platform } = req.params;

    const from = req.body.from || req.body.From || req.body.sender;
    const content = req.body.content || req.body.Body || req.body.text;
    const clinicId = req.body.clinicId || req.headers['x-clinic-id'];

    if (!from || !content || !clinicId) {
        return res.status(400).json({ error: 'Incomplete message payload' });
    }

    try {
        let conversation = await prisma.aIConversation.findFirst({
            where: {
                clinicId: clinicId as string,
                guestPhone: from as string,
                status: 'ACTIVE'
            }
        });

        if (!conversation) {
            conversation = await prisma.aIConversation.create({
                data: {
                    clinicId: clinicId as string,
                    guestPhone: from as string,
                    platform: platform.toUpperCase(),
                    status: 'ACTIVE'
                }
            });
        }

        await prisma.aIMessage.create({
            data: {
                conversationId: conversation.id,
                direction: 'INBOUND',
                senderType: 'USER',
                content
            }
        });

        const faqContent = await getClinicFAQ(clinicId as string);
        const prompt = `
      You are an AI assistant for a veterinary clinic.
      Use the following FAQ to answer the client's question accurately and professionally.
      If you cannot find the answer in the FAQ or if the request is complex (e.g. emergency, medical advice),
      politely inform them that a staff member will take over and escalate the conversation.

      Clinic FAQ:
      ${faqContent}

      Client Message: ${content}

      AI Response:
    `;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const isEscalationNeeded =
            responseText.toLowerCase().includes('staff member') ||
            responseText.toLowerCase().includes('escalate');

        await prisma.aIMessage.create({
            data: {
                conversationId: conversation.id,
                direction: 'OUTBOUND',
                senderType: 'AI',
                content: responseText
            }
        });

        if (isEscalationNeeded) {
            await prisma.aIConversation.update({
                where: { id: conversation.id },
                data: {
                    status: 'ESCALATED',
                    priority: 'HIGH'
                }
            });
        }

        res.json({ success: true, response: responseText });
    } catch (error) {
        console.error('AI Client Webhook error:', error);
        res.status(500).json({ error: 'Internal processing error' });
    }
});

// Manual reply from staff
router.post('/send', authenticate, upload.array('attachments', 4), async (req: AuthRequest, res) => {
    try {
        const files = (req.files as Express.Multer.File[]) || [];
        const attachments = buildAttachmentCreateData(files);
        const { conversationId, content } = messageSchema.parse(req.body);
        if (!content.trim() && attachments.length === 0) {
            return res.status(400).json({ error: 'Message text or attachment is required' });
        }

        const conversation = await prisma.aIConversation.findFirst({
            where: {
                id: conversationId,
                clinicId: req.user?.clinicId,
            },
            select: {
                id: true,
                status: true,
                platform: true,
            },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const message = await prisma.aIMessage.create({
            data: {
                conversationId,
                direction: 'OUTBOUND',
                senderType: 'STAFF',
                content: content.trim(),
                isRead: false,
                attachments: attachments.length ? { create: attachments } : undefined,
            },
            include: { attachments: true },
        });

        await prisma.aIConversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        });

        res.json(message);
    } catch (error) {
        console.error('Send message error:', error);
        res.status((error as any)?.statusCode || 400).json({ error: (error as any)?.message || 'Failed to send message' });
    }
});

export default router;
