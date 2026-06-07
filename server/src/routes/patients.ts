import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { checkResourceLimit } from '../middleware/subscriptionMiddleware.js';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger.js';
import { sanitizeInput } from '../utils/sanitize.js';

const router = Router();

const patientSchema = z.object({
    name: z.string().min(1),
    species: z.string().min(1),
    breed: z.string().optional().nullable(),
    gender: z.enum(['Male', 'Female']),
    age: z.number().min(0),
    ageYearsEntry: z.number().int().min(0).optional().nullable(),
    ageMonthsEntry: z.number().int().min(0).max(11).optional().nullable(),
    dateOfBirth: z.string().datetime().optional().nullable(),
    weight: z.number().min(0),
    color: z.string().optional().nullable(),
    microchipId: z.string().optional().nullable(),
    ownerId: z.string()
});

// Get all patients (paginated)
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const patients = await prisma.patient.findMany({
            where: req.user?.isSuperAdmin ? {} : { owner: { clinicId: req.user?.clinicId as string } },
            select: {
                id: true,
                name: true,
                species: true,
                breed: true,
                gender: true,
                age: true,
                dateOfBirth: true,
                weight: true,
                ownerId: true,
                owner: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            },
            take: limit,
            skip: skip,
            orderBy: { createdAt: 'desc' }
        });
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
});

// Get single patient
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const patient = await prisma.patient.findUnique({
            where: { id: req.params.id as string },
            include: {
                owner: true,
                media: {
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
                appointments: {
                    include: {
                        procedure: true,
                        staff: true
                    },
                    orderBy: {
                        date: 'desc'
                    }
                },
                treatments: {
                    include: {
                        vet: true,
                        medications: true,
                        procedures: {
                            include: {
                                procedure: true
                            }
                        }
                    },
                    orderBy: {
                        date: 'desc'
                    }
                },
                hospitalizations: {
                    include: {
                        vet: true,
                        kennel: true
                    },
                    orderBy: {
                        admissionDate: 'desc'
                    }
                },
                labResults: {
                    orderBy: {
                        testDate: 'desc'
                    }
                }
            }
        });

        if (patient && !req.user?.isSuperAdmin && (patient.owner ? patient.owner.clinicId !== req.user?.clinicId : true)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.json(patient);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch patient' });
    }
});

// Create patient
router.post('/', authenticate, checkResourceLimit('patients'), async (req: AuthRequest, res) => {
    try {
        const data = patientSchema.parse(req.body);

        // Verify owner belongs to same clinic
        if (!req.user?.isSuperAdmin) {
            if (!req.user?.clinicId) {
                return res.status(400).json({ error: 'User is not associated with a clinic' });
            }

            const owner = await prisma.client.findFirst({
                where: { id: data.ownerId, clinicId: req.user.clinicId }
            });
            if (!owner) {
                return res.status(403).json({ error: 'Owner not found in your clinic' });
            }
        }

        const patient = await prisma.patient.create({
            data: {
                name: sanitizeInput(data.name),
                species: sanitizeInput(data.species),
                breed: data.breed ? sanitizeInput(data.breed) : null,
                gender: data.gender,
                age: data.age,
                ageYearsEntry: data.ageYearsEntry,
                ageMonthsEntry: data.ageMonthsEntry,
                dateOfBirth: data.dateOfBirth,
                weight: data.weight,
                color: data.color ? sanitizeInput(data.color) : null,
                microchipId: data.microchipId ? sanitizeInput(data.microchipId) : null,
                ownerId: data.ownerId
            },
            include: {
                owner: true
            }
        });

        // Log Audit
        if (req.user?.id) {
            const ownerName = patient.owner ? `${patient.owner.firstName} ${patient.owner.lastName}` : 'Unknown Owner';
            await logAudit(req.user.id, 'PATIENTS', 'CREATE', `Created patient: ${patient.name} (${patient.species}) for owner ${ownerName}`, req.user.clinicId || undefined, req.user.name);
        }

        res.status(201).json(patient);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            console.error('Patient validation error:', JSON.stringify(error.errors, null, 2));
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Create patient error:', error);
        res.status(500).json({ error: 'Failed to create patient' });
    }
});

// Update patient
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const data = patientSchema.parse(req.body);

        // Verify existence and permission
        const existingPatient = await prisma.patient.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, owner: { clinicId: req.user?.clinicId as string } }
        });

        if (!existingPatient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const patient = await prisma.patient.update({
            where: { id: req.params.id as string },
            data,
            include: {
                owner: true
            }
        });

        // Log Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'PATIENTS', 'UPDATE', `Updated patient: ${patient.name}`, req.user.clinicId || undefined, req.user.name);
        }

        res.json(patient);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to update patient' });
    }
});

// Delete patient - Admin Only
router.delete('/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        // Verify existence and permission
        const existingPatient = await prisma.patient.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, owner: { clinicId: req.user?.clinicId as string } }
        });

        if (!existingPatient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        await prisma.patient.delete({
            where: { id: req.params.id as string }
        });

        // Log Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'PATIENTS', 'DELETE', `Deleted patient: ${existingPatient.name}`, req.user.clinicId || undefined, req.user.name);
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete patient' });
    }
});

export default router;
