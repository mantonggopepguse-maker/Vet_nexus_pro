import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();

// Whitelist of fields the settings form can update — rejects everything else
const settingsSchema = z.object({
    name: z.string().min(1).optional(),
    acronym: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    taxEnabled: z.boolean().optional(),
    taxRate: z.number().min(0).max(100).optional(),
    bankName: z.string().optional(),
    accountName: z.string().optional(),
    accountNumber: z.string().optional(),
    currencySymbol: z.string().optional(),
    country: z.string().optional(),
    language: z.string().optional(),
    practiceType: z.string().optional(),
    useShiftTimetable: z.boolean().optional(),
}).strict(); // .strict() rejects any unlisted fields

// Get clinic settings
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            return res.status(403).json({ error: 'User is not associated with a clinic' });
        }

        let clinic = await prisma.clinic.findUnique({
            where: { id: clinicId },
            include: { subscription: { include: { plan: true } } }
        });

        if (!clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        res.json(clinic);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update clinic settings — Admin only, validated input
router.put('/', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            return res.status(403).json({ error: 'User is not associated with a clinic' });
        }

        const data = settingsSchema.parse(req.body);

        const clinic = await prisma.clinic.update({
            where: { id: clinicId },
            data
        });

        // Audit trail
        if (req.user?.id) {
            await logAudit(
                req.user.id, 'SETTINGS', 'UPDATE',
                `Updated clinic settings: ${Object.keys(data).join(', ')}`,
                clinicId, req.user.name
            );
        }

        res.json(clinic);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

export default router;
