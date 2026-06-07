import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all lab results for a patient
router.get('/patient/:patientId', authenticate, async (req: AuthRequest, res) => {
    try {
        const { patientId } = req.params;
        const clinicId = req.user?.clinicId as string;

        const labs = await prisma.labResult.findMany({
            where: {
                patientId: patientId as string,
                clinicId: clinicId as string
            },
            orderBy: { testDate: 'desc' }
        });

        res.json(labs);
    } catch (error) {
        console.error('Failed to fetch lab results:', error);
        res.status(500).json({ error: 'Failed to fetch lab results' });
    }
});

// Create a new lab result
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { patientId, testName, testDate, result, findings, mediaUrl, status, numericalValue, unit, referenceRange } = req.body;

        const lab = await prisma.labResult.create({
            data: {
                clinicId,
                patientId,
                testName,
                testDate: testDate ? new Date(testDate) : new Date(),
                numericalValue: numericalValue ? parseFloat(numericalValue) : null,
                unit: unit || null,
                referenceRange: referenceRange || null,
                result,
                findings,
                mediaUrl,
                status: status || 'Final'
            }
        });

        res.status(201).json(lab);
    } catch (error) {
        console.error('Failed to create lab result:', error);
        res.status(500).json({ error: 'Failed to create lab result' });
    }
});

// Update a lab result
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user?.clinicId as string;
        const { testName, testDate, result, findings, mediaUrl, status, numericalValue, unit, referenceRange } = req.body;

        const lab = await prisma.labResult.update({
            where: { id: id as string, clinicId: clinicId as string },
            data: {
                testName,
                testDate: testDate ? new Date(testDate) : undefined,
                numericalValue: numericalValue !== undefined ? (numericalValue ? parseFloat(numericalValue) : null) : undefined,
                unit: unit !== undefined ? (unit || null) : undefined,
                referenceRange: referenceRange !== undefined ? (referenceRange || null) : undefined,
                result,
                findings,
                mediaUrl,
                status
            }
        });

        res.json(lab);
    } catch (error) {
        console.error('Failed to update lab result:', error);
        res.status(500).json({ error: 'Failed to update lab result' });
    }
});

// Delete a lab result
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user?.clinicId as string;

        await prisma.labResult.delete({
            where: { id: id as string, clinicId: clinicId as string }
        });

        res.json({ message: 'Lab result deleted successfully' });
    } catch (error) {
        console.error('Failed to delete lab result:', error);
        res.status(500).json({ error: 'Failed to delete lab result' });
    }
});

export default router;
