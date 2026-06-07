import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all vaccinations for a patient
router.get('/patient/:patientId', authenticate, async (req: any, res) => {
    try {
        const { patientId } = req.params;
        const clinicId = req.user.clinicId;

        // Verify patient belongs to this clinic through owner
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                owner: { clinicId }
            }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const vaccinations = await prisma.vaccination.findMany({
            where: { patientId },
            orderBy: { dateGiven: 'desc' }
        });

        res.json(vaccinations);
    } catch (error) {
        console.error('Failed to get vaccinations:', error);
        res.status(500).json({ error: 'Failed to get vaccinations' });
    }
});

// Add a new vaccination
router.post('/', authenticate, async (req: any, res) => {
    try {
        const { patientId, name, dateGiven, nextDueDate, batchNumber, manufacturer, notes } = req.body;
        const clinicId = req.user.clinicId;

        // Verify patient
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                owner: { clinicId }
            }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const vaccination = await prisma.vaccination.create({
            data: {
                patientId,
                name,
                dateGiven: new Date(dateGiven),
                nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
                batchNumber,
                manufacturer,
                notes,
                administeredBy: req.user.name
            }
        });

        // If nextDueDate is set, we could automatically create a reminder here
        if (nextDueDate) {
            await prisma.reminder.create({
                data: {
                    clinicId,
                    clientId: patient.ownerId as string,
                    patientId,
                    type: 'Vaccination',
                    message: `Reminder: ${patient.name} is due for a ${name} vaccination on ${new Date(nextDueDate).toLocaleDateString()}.`,
                    scheduledFor: new Date(new Date(nextDueDate).getTime() - 24 * 60 * 60 * 1000), // 1 day before
                    status: 'Pending',
                    referenceId: vaccination.id
                }
            });
        }

        res.status(201).json(vaccination);
    } catch (error) {
        console.error('Failed to create vaccination:', error);
        res.status(500).json({ error: 'Failed to create vaccination' });
    }
});

// Update a vaccination
router.put('/:id', authenticate, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { name, dateGiven, nextDueDate, batchNumber, manufacturer, notes } = req.body;
        const clinicId = req.user.clinicId;

        const existing = await prisma.vaccination.findFirst({
            where: {
                id,
                patient: { owner: { clinicId } }
            },
            include: { patient: true }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Vaccination not found' });
        }

        const updated = await prisma.vaccination.update({
            where: { id },
            data: {
                name,
                dateGiven: dateGiven ? new Date(dateGiven) : undefined,
                nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined,
                batchNumber,
                manufacturer,
                notes
            }
        });

        // Update existing reminder if exists
        if (nextDueDate) {
            const reminder = await prisma.reminder.findFirst({
                where: { referenceId: id, status: 'Pending' }
            });

            if (reminder) {
                await prisma.reminder.update({
                    where: { id: reminder.id },
                    data: {
                        scheduledFor: new Date(new Date(nextDueDate).getTime() - 24 * 60 * 60 * 1000),
                        message: `Reminder: ${existing.patient?.name || 'Patient'} is due for a ${name} vaccination on ${new Date(nextDueDate).toLocaleDateString()}.`
                    }
                });
            }
        }

        res.json(updated);
    } catch (error) {
        console.error('Failed to update vaccination:', error);
        res.status(500).json({ error: 'Failed to update vaccination' });
    }
});

// Delete a vaccination
router.delete('/:id', authenticate, async (req: any, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;

        const existing = await prisma.vaccination.findFirst({
            where: {
                id,
                patient: { owner: { clinicId } }
            }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Vaccination not found' });
        }

        await prisma.vaccination.delete({ where: { id } });

        // Also delete pending reminders
        await prisma.reminder.deleteMany({
            where: { referenceId: id, status: 'Pending' }
        });

        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('Failed to delete vaccination:', error);
        res.status(500).json({ error: 'Failed to delete vaccination' });
    }
});

export default router;
