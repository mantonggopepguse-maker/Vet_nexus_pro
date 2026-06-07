import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();

// Get all shifts for the clinic
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { start, end } = req.query;
        const clinicId = req.user?.clinicId as string;

        if (!clinicId) return res.status(403).json({ error: 'Clinic context missing' });

        const where: any = { clinicId };
        if (start && end) {
            where.startTime = { gte: new Date(start as string) };
            where.endTime = { lte: new Date(end as string) };
        }

        const shifts = await prisma.shift.findMany({
            where,
            include: {
                staff: {
                    select: { id: true, name: true, roles: true, avatarUrl: true }
                }
            },
            orderBy: { startTime: 'asc' }
        });

        res.json(shifts);
    } catch (error) {
        console.error('Error fetching shifts:', error);
        res.status(500).json({ error: 'Failed to fetch shifts' });
    }
});

// Create a new shift
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { staffId, startTime, endTime, type, notes } = req.body;
        const clinicId = req.user?.clinicId as string;

        if (!clinicId) return res.status(403).json({ error: 'Clinic context missing' });

        const shift = await prisma.shift.create({
            data: {
                clinicId,
                staffId,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                type: type || 'Day',
                notes
            },
            include: {
                staff: { select: { id: true, name: true } }
            }
        });

        await logAudit(
            req.user?.id as string,
            'SHIFTS',
            'CREATE_SHIFT',
            `Created ${type} shift for ${shift.staff.name}`,
            clinicId
        );

        res.status(201).json(shift);
    } catch (error) {
        console.error('Error creating shift:', error);
        res.status(500).json({ error: 'Failed to create shift' });
    }
});

// Update a shift
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { staffId, startTime, endTime, type, notes } = req.body;
        const clinicId = req.user?.clinicId as string;

        const existingShift = await prisma.shift.findFirst({
            where: { id, clinicId }
        });

        if (!existingShift) return res.status(404).json({ error: 'Shift not found' });

        const updatedShift = await prisma.shift.update({
            where: { id },
            data: {
                staffId,
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
                type,
                notes
            },
            include: {
                staff: { select: { id: true, name: true } }
            }
        });

        if (req.user?.id) {
            await logAudit(
                req.user.id,
                'SHIFTS',
                'UPDATE_SHIFT',
                `Updated shift for staff ${updatedShift.staff.name}`,
                clinicId,
                req.user.name
            );
        }

        res.json(updatedShift);
    } catch (error) {
        console.error('Error updating shift:', error);
        res.status(500).json({ error: 'Failed to update shift' });
    }
});

// Delete a shift
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;

        const shift = await prisma.shift.findFirst({
            where: { id, clinicId }
        });

        if (!shift) return res.status(404).json({ error: 'Shift not found' });

        await prisma.shift.delete({ where: { id } });

        if (req.user?.id) {
            await logAudit(
                req.user.id,
                'SHIFTS',
                'DELETE_SHIFT',
                `Deleted shift ${id}`,
                clinicId,
                req.user.name
            );
        }

        res.json({ message: 'Shift deleted successfully' });
    } catch (error) {
        console.error('Error deleting shift:', error);
        res.status(500).json({ error: 'Failed to delete shift' });
    }
});

export default router;
