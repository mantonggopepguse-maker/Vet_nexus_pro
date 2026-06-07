import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all reminders for a clinic
router.get('/', authenticate, async (req: any, res) => {
    try {
        const clinicId = req.user.clinicId;
        const { status, type } = req.query;

        const reminders = await prisma.reminder.findMany({
            where: {
                clinicId,
                status: status ? String(status) : undefined,
                type: type ? String(type) : undefined
            },
            include: {
                client: { select: { firstName: true, lastName: true, phone: true } },
                patient: { select: { name: true } }
            },
            orderBy: { scheduledFor: 'asc' }
        });

        res.json(reminders);
    } catch (error) {
        console.error('Failed to get reminders:', error);
        res.status(500).json({ error: 'Failed to get reminders' });
    }
});

// Create a manual reminder
router.post('/', authenticate, async (req: any, res) => {
    try {
        const clinicId = req.user.clinicId;
        const { clientId, patientId, type, message, scheduledFor } = req.body;

        if (!clientId || !message || !scheduledFor) {
            return res.status(400).json({ error: 'clientId, message, and scheduledFor are required' });
        }

        const reminder = await prisma.reminder.create({
            data: { 
                clinicId, 
                clientId, 
                patientId: patientId || null,
                type: type || 'Manual', 
                message, 
                scheduledFor: new Date(scheduledFor), 
                status: 'Pending' 
            },
            include: { 
                client: { select: { firstName: true, lastName: true, phone: true } },
                patient: { select: { name: true } } 
            }
        });
        res.status(201).json(reminder);
    } catch (error) {
        console.error('Failed to create reminder:', error);
        res.status(500).json({ error: 'Failed to create reminder' });
    }
});

// Cancel a reminder
router.post('/:id/cancel', authenticate, async (req: any, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;

        const reminder = await prisma.reminder.findFirst({
            where: { id, clinicId }
        });

        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        const updated = await prisma.reminder.update({
            where: { id },
            data: { status: 'Cancelled' }
        });

        res.json(updated);
    } catch (error) {
        console.error('Failed to cancel reminder:', error);
        res.status(500).json({ error: 'Failed to cancel reminder' });
    }
});

export default router;
