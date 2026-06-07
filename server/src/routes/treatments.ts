import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();
const normalizeMedicationName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

// Get all treatments
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const whereClause = req.user?.isSuperAdmin
            ? {}
            : { patient: { owner: { clinicId: req.user?.clinicId as string } } };

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const treatments = await prisma.treatment.findMany({
            where: whereClause,
            include: {
                patient: {
                    select: {
                        id: true,
                        name: true,
                        owner: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                },
                vet: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                treatmentNotes: {
                    include: { vet: { select: { id: true, name: true } } },
                    orderBy: { date: 'asc' }
                }
            },
            take: limit,
            skip: skip,
            orderBy: { date: 'desc' }
        });
        res.json(treatments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch treatments' });
    }
});

// Get single treatment
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const whereClause = req.user?.isSuperAdmin
            ? { id: req.params.id as string }
            : { id: req.params.id as string, patient: { owner: { clinicId: req.user?.clinicId as string } } };

        const treatment = await prisma.treatment.findUnique({
            where: { id: req.params.id as string },
            include: {
                patient: {
                    include: {
                        owner: true
                    }
                },
                vet: true,
                medications: true,
                procedures: {
                    include: {
                        procedure: true
                    }
                },
                treatmentNotes: {
                    include: { vet: { select: { id: true, name: true } } },
                    orderBy: { date: 'asc' }
                }
            }
        });

        if (treatment && !req.user?.isSuperAdmin) {
            const patient = await prisma.patient.findFirst({
                where: { id: treatment.patientId, owner: { clinicId: req.user?.clinicId as string } }
            });
            if (!patient) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        if (!treatment) {
            return res.status(404).json({ error: 'Treatment not found' });
        }

        res.json(treatment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch treatment' });
    }
});

// Create treatment (atomic: treatment + hospitalization + prescriptions + appointment)
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { medications, procedures, hospitalization, nextAppointment, ...data } = req.body;
        const { clinicId, id: vetId } = req.user!;

        // Verify patient belongs to user's clinic (security check)
        if (!req.user?.isSuperAdmin) {
            const patient = await prisma.patient.findFirst({
                where: { id: data.patientId, owner: { clinicId: clinicId as string } }
            });
            if (!patient) {
                return res.status(403).json({ error: 'Patient not found in your clinic' });
            }
        }

        // If hospitalization is requested, validate kennel availability BEFORE transaction
        if (hospitalization && hospitalization.kennelId) {
            const kennel = await prisma.kennel.findUnique({ where: { id: hospitalization.kennelId } });
            if (!kennel || kennel.status !== 'Available') {
                return res.status(400).json({ error: 'Selected kennel/cage is not available' });
            }
        }

        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Create Treatment with medications and procedures
            const treatment = await tx.treatment.create({
                data: {
                    ...data,
                    medications: {
                        create: medications || []
                    },
                    procedures: {
                        create: procedures || []
                    }
                },
                include: {
                    patient: { include: { owner: true } },
                    vet: true,
                    medications: true,
                    procedures: { include: { procedure: true } },
                    treatmentNotes: {
                        include: { vet: { select: { id: true, name: true } } },
                        orderBy: { date: 'asc' }
                    }
                }
            });

            let hospRecord: any = null;

            // 2. Create Hospitalization + copy meds as prescriptions
            if (hospitalization && hospitalization.kennelId) {
                hospRecord = await tx.hospitalization.create({
                    data: {
                        clinicId: clinicId!,
                        patientId: data.patientId,
                        vetId: vetId!,
                        kennelId: hospitalization.kennelId,
                        reason: hospitalization.reason || data.diagnosis || 'Treatment Admission',
                        estimatedCost: Number(hospitalization.estimatedCost || 0)
                    },
                    include: { patient: true, kennel: true }
                });

                // Mark kennel as occupied
                await tx.kennel.update({
                    where: { id: hospitalization.kennelId },
                    data: { status: 'Occupied' }
                });

                // Copy treatment medications into hospitalization prescriptions
                const validMeds = (medications || []).filter((m: any) => m.drug && m.drug.trim());
                if (validMeds.length > 0) {
                    const medicationNames: string[] = Array.from(
                        new Set(validMeds.map((med: any) => String(med.drug).trim()).filter(Boolean))
                    );
                    const inventoryMatches = medicationNames.length > 0
                        ? await tx.inventoryItem.findMany({
                            where: {
                                clinicId: clinicId!,
                                OR: medicationNames.map((name: string) => ({
                                    name: { equals: name, mode: 'insensitive' }
                                }))
                            },
                            select: { id: true, name: true }
                        })
                        : [];
                    const inventoryByDrugName = new Map(
                        inventoryMatches.map((item: any) => [normalizeMedicationName(item.name), item.id])
                    );

                    await tx.hospitalizationPrescription.createMany({
                        data: validMeds.map((med: any) => ({
                            hospitalizationId: hospRecord.id,
                            vetId: vetId!,
                            inventoryItemId: inventoryByDrugName.get(normalizeMedicationName(med.drug)),
                            drugName: med.drug,
                            dose: med.dose || '',
                            route: med.route || 'PO (Oral)',
                            frequency: med.freq || med.frequency || 'SID (Once Daily)',
                            status: 'Active'
                        }))
                    });
                }
            }

            // 3. Create follow-up appointment if provided
            let appointmentRecord = null;
            if (nextAppointment && nextAppointment.date && nextAppointment.time && nextAppointment.procedureId) {
                appointmentRecord = await tx.appointment.create({
                    data: {
                        clinicId: clinicId!,
                        clientId: treatment.patient.ownerId || null,
                        patientId: data.patientId,
                        procedureId: nextAppointment.procedureId,
                        date: nextAppointment.date,
                        time: nextAppointment.time,
                        notes: nextAppointment.notes || `Follow-up for: ${data.diagnosis || 'Treatment'}`,
                        status: 'Pending'
                    }
                });
            }

            return { treatment, hospitalization: hospRecord, appointment: appointmentRecord };
        });

        // Log Audit
        if (req.user?.id) {
            let auditMsg = `Created treatment for ${result.treatment.patient.name}. Diagnosis: ${result.treatment.diagnosis || 'N/A'}`;
            if (result.hospitalization) auditMsg += `. Admitted to ${result.hospitalization.kennel?.name || 'ward'}`;
            if (result.appointment) auditMsg += `. Follow-up scheduled`;
            await logAudit(req.user.id, 'TREATMENTS', 'CREATE', auditMsg, req.user.clinicId || undefined, req.user.name);
        }

        res.status(201).json(result.treatment);
    } catch (error: any) {
        console.error('Treatment creation error:', error);
        res.status(500).json({ error: error.message || 'Failed to create treatment' });
    }
});

// Update treatment
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { medications, procedures, hospitalization: _hospitalization, nextAppointment: _nextAppointment, ...data } = req.body;

        // Verify ownership before update (security check)
        const whereClause = req.user?.isSuperAdmin
            ? { id: req.params.id as string }
            : { id: req.params.id as string, patient: { owner: { clinicId: req.user?.clinicId as string } } };

        const existing = await prisma.treatment.findFirst({ where: whereClause });
        if (!existing) {
            return res.status(404).json({ error: 'Treatment not found' });
        }

        // Delete existing medications and procedures
        await prisma.treatmentMedication.deleteMany({
            where: { treatmentId: req.params.id as string }
        });
        await prisma.treatmentProcedure.deleteMany({
            where: { treatmentId: req.params.id as string }
        });

        const treatment = await prisma.treatment.update({
            where: { id: req.params.id as string },
            data: {
                ...data,
                medications: {
                    create: medications || []
                },
                procedures: {
                    create: procedures || []
                }
            },
            include: {
                patient: {
                    include: {
                        owner: true
                    }
                },
                vet: true,
                medications: true,
                procedures: {
                    include: {
                        procedure: true
                    }
                },
                treatmentNotes: {
                    include: { vet: { select: { id: true, name: true } } },
                    orderBy: { date: 'asc' }
                }
            }
        });

        // Log Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'TREATMENTS', 'UPDATE', `Updated treatment for ${treatment.patient.name}`, req.user.clinicId || undefined, req.user.name);
        }

        res.json(treatment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update treatment' });
    }
});

// Delete treatment - Admin Only
router.delete('/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        // Verify ownership before delete (security check)
        const whereClause = req.user?.isSuperAdmin
            ? { id: req.params.id as string }
            : { id: req.params.id as string, patient: { owner: { clinicId: req.user?.clinicId as string } } };

        const existingTreatment = await prisma.treatment.findFirst({
            where: whereClause,
            include: { patient: true }
        });

        if (!existingTreatment) {
            return res.status(404).json({ error: 'Treatment not found' });
        }

        await prisma.treatment.delete({
            where: { id: req.params.id as string }
        });

        // Log Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'TREATMENTS', 'DELETE', `Deleted treatment for ${existingTreatment?.patient.name || 'Unknown Patient'}`, req.user.clinicId || undefined, req.user.name);
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete treatment' });
    }
});

// Add Treatment Note
router.post('/:id/notes', authenticate, async (req: AuthRequest, res) => {
    try {
        const { note } = req.body;
        if (!note) return res.status(400).json({ error: 'Note is required' });

        const whereClause = req.user?.isSuperAdmin
            ? { id: req.params.id as string }
            : { id: req.params.id as string, patient: { owner: { clinicId: req.user?.clinicId as string } } };

        const treatment = await prisma.treatment.findFirst({ where: whereClause });
        if (!treatment) return res.status(404).json({ error: 'Treatment not found' });

        const treatmentNote = await prisma.treatmentNote.create({
            data: {
                treatmentId: treatment.id,
                vetId: req.user?.id as string,
                note
            },
            include: { vet: { select: { id: true, name: true } } }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'TREATMENTS', 'ADD_NOTE', 
                `Added note to treatment ${treatment.id}`, req.user.clinicId!, req.user.name);
        }

        res.status(201).json(treatmentNote);
    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({ error: 'Failed to add treatment note' });
    }
});

export default router;
