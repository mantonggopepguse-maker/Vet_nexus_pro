import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * Quick Admit (John Doe Protocol)
 * Admits an unknown patient immediately
 */
router.post('/quick-admit', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId } = req.user!;
        const { triageStatus = 'CRITICAL' } = req.body;

        // 1. Find or create the generic Emergency Intake client for this clinic
        let emergencyClient = await prisma.client.findFirst({
            where: {
                clinicId,
                lastName: 'Intake',
                firstName: 'Emergency'
            }
        });

        if (!emergencyClient) {
            emergencyClient = await prisma.client.create({
                data: {
                    clinicId: clinicId!,
                    firstName: 'Emergency',
                    lastName: 'Intake',
                    phone: '0000',
                    address: 'ER'
                }
            });
        }

        // 2. Generate John Doe Patient name with timestamp
        const timestamp = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const patientName = `John Doe [ER ${timestamp}]`;

        // 3. Create the patient (Patient has no clinicId; uses ownerId to link to clinic via Client)
        const patient = await prisma.patient.create({
            data: {
                ownerId: emergencyClient.id,
                name: patientName,
                species: 'Unknown',
                breed: 'Unknown',
                gender: 'Unknown',
                age: 0,
                weight: 0,
                triageStatus,
                triageStartTime: new Date()
            },
            include: {
                owner: true
            }
        });

        // 4. Create an automatic audit log entry
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                userName: req.user!.name || 'Unknown',
                clinicId,
                module: 'TRIAGE',
                action: 'QUICK_ADMIT',
                details: `Emergency Quick Admit initiated for ${patientName}`
            }
        });

        res.status(201).json(patient);
    } catch (error) {
        console.error('Error in Quick Admit:', error);
        res.status(500).json({ error: 'Failed to initiate quick admit' });
    }
});

/**
 * Get active triage patients
 */
router.get('/active', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId } = req.user!;
        
        const activeTriage = await prisma.patient.findMany({
            where: {
                owner: { clinicId },
                triageStatus: { not: 'NONE' }
            },
            include: {
                owner: true,
                hospitalizations: {
                    where: { status: 'Admitted' },
                    take: 1
                }
            },
            orderBy: {
                triageStartTime: 'asc'
            }
        });

        res.json(activeTriage);
    } catch (error) {
        console.error('Error fetching triage:', error);
        res.status(500).json({ error: 'Failed to fetch triage queue' });
    }
});

/**
 * Update triage status
 */
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { status } = req.body;
        const { clinicId } = req.user!;

        // Verify patient belongs to this clinic
        const patient = await prisma.patient.findFirst({
            where: { 
                id, 
                owner: { clinicId } 
            }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const updated = await prisma.patient.update({
            where: { id },
            data: {
                triageStatus: status,
                triageStartTime: status === 'NONE' ? null : new Date()
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating triage status:', error);
        res.status(500).json({ error: 'Failed to update triage status' });
    }
});

export default router;
