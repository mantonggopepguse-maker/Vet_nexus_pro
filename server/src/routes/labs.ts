import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

const parseNullableNumber = (value: unknown) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
};

// Get all pending lab results for the clinic
router.get('/clinic/pending', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;

        const labs = await prisma.labResult.findMany({
            where: {
                clinicId,
                status: 'Requested'
            },
            include: {
                patient: {
                    select: {
                        name: true,
                        species: true,
                        breed: true,
                        owner: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            },
            orderBy: { testDate: 'desc' }
        });

        res.json(labs);
    } catch (error) {
        console.error('Failed to fetch pending lab results:', error);
        res.status(500).json({ error: 'Failed to fetch pending lab results' });
    }
});

// Get all lab results for the clinic with optional status filter
router.get('/clinic/all', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { status } = req.query;

        const labs = await prisma.labResult.findMany({
            where: {
                clinicId,
                ...(status ? { status: status as string } : {})
            },
            include: {
                patient: {
                    select: {
                        name: true,
                        species: true,
                        breed: true,
                        owner: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            },
            orderBy: { testDate: 'desc' },
            take: 200
        });

        res.json(labs);
    } catch (error) {
        console.error('Failed to fetch clinic lab results:', error);
        res.status(500).json({ error: 'Failed to fetch clinic lab results' });
    }
});

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
                numericalValue: parseNullableNumber(numericalValue) ?? null,
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

        const existing = await prisma.labResult.findFirst({
            where: { id: id as string, clinicId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Lab result not found' });
        }

        const lab = await prisma.labResult.update({
            where: { id: id as string },
            data: {
                testName,
                testDate: testDate ? new Date(testDate) : undefined,
                numericalValue: parseNullableNumber(numericalValue),
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

        const existing = await prisma.labResult.findFirst({
            where: { id: id as string, clinicId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Lab result not found' });
        }

        await prisma.labResult.delete({
            where: { id: id as string }
        });

        res.json({ message: 'Lab result deleted successfully' });
    } catch (error) {
        console.error('Failed to delete lab result:', error);
        res.status(500).json({ error: 'Failed to delete lab result' });
    }
});

// Batch update lab results
router.put('/batch', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { updates } = req.body;

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'Updates array is required' });
        }

        const results = await prisma.$transaction(async (tx) => {
            const updated = [];

            for (const update of updates) {
                const { id, result, findings, numericalValue, unit, referenceRange, status, testDate } = update;

                const existing = await tx.labResult.findFirst({
                    where: { id: id as string, clinicId }
                });

                if (!existing) {
                    throw new Error(`Lab result not found: ${id}`);
                }

                const lab = await tx.labResult.update({
                    where: { id: id as string },
                    data: {
                        result,
                        findings,
                        numericalValue: parseNullableNumber(numericalValue),
                        unit: unit !== undefined ? (unit || null) : undefined,
                        referenceRange: referenceRange !== undefined ? (referenceRange || null) : undefined,
                        status,
                        testDate: testDate ? new Date(testDate) : undefined
                    }
                });

                updated.push(lab);
            }

            return updated;
        });

        res.json(results);
    } catch (error) {
        console.error('Failed to batch update lab results:', error);
        const message = error instanceof Error ? error.message : 'Failed to batch update lab results';
        res.status(500).json({ error: message });
    }
});

export default router;
