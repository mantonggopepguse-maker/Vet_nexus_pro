import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/portal/consent
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { patientId, clientId, type, content } = req.body;
        const clinicId = req.user?.clinicId;

        if (!clinicId) return res.status(403).json({ error: 'Clinic context required' });

        const form = await prisma.consentForm.create({
            data: {
                clinicId,
                patientId,
                clientId,
                type,
                content,
                status: 'Pending'
            }
        });

        res.json(form);
    } catch (error) {
        console.error('Consent Creation Error:', error);
        res.status(500).json({ error: 'Failed to create consent form' });
    }
});

export default router;
