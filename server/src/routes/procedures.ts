import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const procedureSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    species: z.string().optional().nullable(),
    costClinic: z.number().min(0).default(0),
    costClient: z.number().min(0).default(0),
    instructions: z.string().optional().nullable(),
    status: z.enum(['Active', 'Inactive']).default('Active'),
    medications: z.array(z.object({
        drug: z.string(),
        dose: z.string(),
        route: z.string(),
        freq: z.string(),
        duration: z.string()
    })).default([])
});

// Get all procedures
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const procedures = await prisma.procedure.findMany({
            where: req.user?.isSuperAdmin ? {} : { clinicId: req.user?.clinicId as string },
            include: {
                medications: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(procedures);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch procedures' });
    }
});

// Get single procedure
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const procedure = await prisma.procedure.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string },
            include: {
                medications: true
            }
        });

        if (!procedure) {
            return res.status(404).json({ error: 'Procedure not found' });
        }

        res.json(procedure);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch procedure' });
    }
});

// Create procedure
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.user?.clinicId && !req.user?.isSuperAdmin) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        const parsed = procedureSchema.parse(req.body);
        const { medications, ...data } = parsed;

        // Prioritize the authenticated user's clinicId unless they are a superadmin
        const clinicId = req.user?.isSuperAdmin && req.body.clinicId ? req.body.clinicId : req.user?.clinicId;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic ID is missing' });
        }

        console.log('Creating procedure for clinic:', clinicId);

        const procedure = await prisma.procedure.create({
            data: {
                ...(data as any),
                clinic: { connect: { id: clinicId } },
                medications: {
                    create: medications.map(med => ({
                        drug: med.drug,
                        dose: med.dose,
                        route: med.route,
                        freq: med.freq,
                        duration: med.duration
                    }))
                }
            },
            include: {
                medications: true
            }
        });

        res.status(201).json(procedure);
    } catch (error: any) {
        console.error('Error creating procedure:', error);
        if (error instanceof z.ZodError) {
            console.error('Validation error:', JSON.stringify(error.errors, null, 2));
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({
            error: 'Failed to create procedure',
            details: error.message,
            code: error.code
        });
    }
});

// Update procedure
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const parsed = procedureSchema.parse(req.body);
        const { medications, ...data } = parsed;

        // Verify existence and permission
        const existingProcedure = await prisma.procedure.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });

        if (!existingProcedure) {
            return res.status(404).json({ error: 'Procedure not found' });
        }

        // Delete existing medications and create new ones
        await prisma.procedureMedication.deleteMany({
            where: { procedureId: req.params.id as string }
        });

        const procedure = await prisma.procedure.update({
            where: { id: req.params.id as string },
            data: {
                ...(data as any),
                medications: {
                    create: medications.map(med => ({
                        drug: med.drug,
                        dose: med.dose,
                        route: med.route,
                        freq: med.freq,
                        duration: med.duration
                    }))
                }
            },
            include: {
                medications: true
            }
        });

        res.json(procedure);
    } catch (error: any) {
        console.error('Error updating procedure:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({
            error: 'Failed to update procedure',
            details: error.message,
            code: error.code
        });
    }
});

// Delete procedure
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        // Verify existence and permission
        const existingProcedure = await prisma.procedure.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });

        if (!existingProcedure) {
            return res.status(404).json({ error: 'Procedure not found' });
        }

        await prisma.procedure.delete({
            where: { id: req.params.id as string }
        });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete procedure' });
    }
});

export default router;
