import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();

// PUBLIC: Submit a referral
router.post('/submit/:clinicId', async (req, res) => {
    const { clinicId } = req.params;
    const {
        submittingVetName,
        submittingClinic,
        submittingEmail,
        submittingPhone,
        patientName,
        patientSpecies,
        patientBreed,
        patientAge,
        clientName,
        history,
        reasonForReferral,
        urgency
    } = req.body;

    try {
        const referral = await prisma.referral.create({
            data: {
                clinicId,
                submittingVetName,
                submittingClinic,
                submittingEmail,
                submittingPhone,
                patientName,
                patientSpecies,
                patientBreed,
                patientAge,
                clientName,
                history,
                reasonForReferral,
                urgency: urgency || 'Routine',
                status: 'Pending'
            }
        });

        // Audit Log for the clinic
        await prisma.auditLog.create({
            data: {
                clinicId,
                userId: 'SYSTEM', // External submission
                userName: `Ext: ${submittingVetName}`,
                module: 'REFERRAL',
                action: 'SUBMIT',
                details: `Incoming referral for ${patientName} from ${submittingClinic}`,
                timestamp: new Date()
            }
        });

        res.json({ success: true, referralId: referral.id });
    } catch (error) {
        console.error('Referral submission failed:', error);
        res.status(500).json({ error: 'Failed to submit referral' });
    }
});

// PRIVATE: Get all referrals for clinic
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ error: 'Clinic context required' });

        const referrals = await prisma.referral.findMany({
            where: { clinicId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(referrals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch referrals' });
    }
});

// Update referral status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;

        // Verify referral belongs to this clinic
        const referral = await prisma.referral.findFirst({
            where: { id, clinicId }
        });

        if (!referral) {
            return res.status(404).json({ error: 'Referral not found' });
        }

        const updated = await prisma.referral.update({
            where: { id },
            data: { status: req.body.status }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'REFERRAL', 'UPDATE_STATUS', 
                `Updated referral ${id} status to ${req.body.status}`, clinicId, req.user.name);
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update referral status' });
    }
});

export default router;
