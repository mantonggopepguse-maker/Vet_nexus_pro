import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();

// Get all surgeries for a clinic
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const surgeries = await prisma.surgery.findMany({
            where: { clinicId },
            include: {
                patient: true,
                surgeon: { select: { name: true } },
                anesthetist: { select: { name: true } },
                monitoringEntries: {
                    orderBy: { timestamp: 'desc' },
                    take: 1
                }
            },
            orderBy: { date: 'desc' }
        });
        res.json(surgeries);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch surgeries' });
    }
});

// Create new surgery
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { patientId, surgeonId, anesthetistId, procedureId, preMeds, asaScore } = req.body;
        const surgery = await prisma.surgery.create({
            data: {
                clinicId,
                patientId,
                surgeonId,
                anesthetistId,
                procedureId,
                preMeds,
                asaScore: parseInt(asaScore) || null,
                status: 'InProgress',
                startTime: new Date()
            },
            include: {
                patient: true,
                surgeon: { select: { name: true } }
            }
        });
        if (req.user?.id) {
            await logAudit(req.user.id, 'SURGERY', 'CREATE', 
                `Created new surgery for patient ${patientId}`, clinicId, req.user.name);
        }

        res.json(surgery);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create surgery' });
    }
});

// Add anesthesia interval entry
router.post('/:id/interval', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;

        // Verify surgery belongs to this clinic
        const surgery = await prisma.surgery.findFirst({
            where: { id, clinicId }
        });

        if (!surgery) {
            return res.status(404).json({ error: 'Surgery not found' });
        }

        const { heartRate, spo2, respiration, bpSystolic, bpDiastolic, temp, etco2, fluids, notes } = req.body;
        const entry = await prisma.anesthesiaEntry.create({
            data: {
                surgeryId: id,
                heartRate: parseInt(heartRate) || null,
                spo2: parseInt(spo2) || null,
                respiration: parseInt(respiration) || null,
                bpSystolic: parseInt(bpSystolic) || null,
                bpDiastolic: parseInt(bpDiastolic) || null,
                temp: parseFloat(temp) || null,
                etco2: parseInt(etco2) || null,
                fluids,
                notes
            }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'SURGERY', 'LOG_INTERVAL', 
                `Logged anesthesia interval for surgery ${id}`, clinicId, req.user.name);
        }

        res.json(entry);
    } catch (error) {
        res.status(500).json({ error: 'Failed to log anesthesia interval' });
    }
});

// Complete surgery
router.post('/:id/complete', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;

        // Verify surgery belongs to this clinic
        const surgery = await prisma.surgery.findFirst({
            where: { id, clinicId }
        });

        if (!surgery) {
            return res.status(404).json({ error: 'Surgery not found' });
        }

        const updatedSurgery = await prisma.surgery.update({
            where: { id },
            data: {
                status: 'Completed',
                endTime: new Date()
            }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'SURGERY', 'COMPLETE', 
                `Completed surgery ${id}`, clinicId, req.user.name);
        }

        res.json(updatedSurgery);
    } catch (error) {
        res.status(500).json({ error: 'Failed to complete surgery' });
    }
});

export default router;
