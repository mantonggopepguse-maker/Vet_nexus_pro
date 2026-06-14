import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Helper: get start/end of today
const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

// Get today's queue
router.get('/today', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { status, departmentId } = req.query;
        const { start, end } = getTodayRange();

        const where: any = {
            clinicId,
            queueDate: { gte: start, lte: end },
        };
        if (status) where.status = status as string;
        if (departmentId) where.departmentId = departmentId as string;

        const entries = await prisma.queueEntry.findMany({
            where,
            include: {
                patient: { select: { id: true, name: true, species: true, breed: true, gender: true, age: true, weight: true } },
                client: { select: { id: true, firstName: true, lastName: true, phone: true } },
                department: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } },
            },
            orderBy: [
                { priority: 'asc' },  // We'll handle priority sorting in code below
                { queueNumber: 'asc' },
            ],
        });

        // Custom sort: Emergency first, then Urgent, then Normal
        const priorityOrder: Record<string, number> = { Emergency: 0, Urgent: 1, Normal: 2 };
        entries.sort((a, b) => {
            // Waiting entries sorted by priority then queue number
            // InProgress and Completed go after Waiting
            const statusOrder: Record<string, number> = { Waiting: 0, InProgress: 1, Completed: 2, Cancelled: 3, NoShow: 4 };
            const sa = statusOrder[a.status] ?? 5;
            const sb = statusOrder[b.status] ?? 5;
            if (sa !== sb) return sa - sb;
            const pa = priorityOrder[a.priority] ?? 2;
            const pb = priorityOrder[b.priority] ?? 2;
            if (pa !== pb) return pa - pb;
            return a.queueNumber - b.queueNumber;
        });

        res.json(entries);
    } catch (error) {
        console.error('Failed to fetch queue:', error);
        res.status(500).json({ error: 'Failed to fetch queue' });
    }
});

// Get today's stats
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { start, end } = getTodayRange();

        const entries = await prisma.queueEntry.findMany({
            where: { clinicId, queueDate: { gte: start, lte: end } },
            select: { status: true, createdAt: true, calledAt: true, completedAt: true },
        });

        const total = entries.length;
        const waiting = entries.filter(e => e.status === 'Waiting').length;
        const inProgress = entries.filter(e => e.status === 'InProgress').length;
        const completed = entries.filter(e => e.status === 'Completed').length;
        const cancelled = entries.filter(e => e.status === 'Cancelled' || e.status === 'NoShow').length;

        // Average wait time (for completed entries that have calledAt)
        const waitTimes = entries
            .filter(e => e.calledAt && e.createdAt)
            .map(e => (new Date(e.calledAt!).getTime() - new Date(e.createdAt).getTime()) / 60000);
        const avgWaitMinutes = waitTimes.length > 0 ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0;

        res.json({ total, waiting, inProgress, completed, cancelled, avgWaitMinutes });
    } catch (error) {
        console.error('Failed to fetch queue stats:', error);
        res.status(500).json({ error: 'Failed to fetch queue stats' });
    }
});

// Add to queue
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { patientId, clientId, departmentId, reason, priority } = req.body;

        if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });

        // Ensure department exists — use default if not provided
        let deptId = departmentId;
        if (!deptId) {
            let defaultDept = await prisma.department.findFirst({ where: { clinicId, isDefault: true } });
            if (!defaultDept) {
                defaultDept = await prisma.department.create({
                    data: { clinicId, name: 'General Clinic', isDefault: true, sortOrder: 0 },
                });
            }
            deptId = defaultDept.id;
        }

        // Get next queue number for today
        const { start, end } = getTodayRange();
        const lastEntry = await prisma.queueEntry.findFirst({
            where: { clinicId, queueDate: { gte: start, lte: end } },
            orderBy: { queueNumber: 'desc' },
        });
        const queueNumber = (lastEntry?.queueNumber ?? 0) + 1;

        const entry = await prisma.queueEntry.create({
            data: {
                clinicId,
                patientId,
                clientId: clientId || null,
                departmentId: deptId,
                queueNumber,
                priority: priority || 'Normal',
                reason: reason || null,
                queueDate: new Date(),
            },
            include: {
                patient: { select: { name: true, species: true, breed: true } },
                department: { select: { name: true } },
            },
        });

        res.status(201).json(entry);
    } catch (error) {
        console.error('Failed to add to queue:', error);
        res.status(500).json({ error: 'Failed to add to queue' });
    }
});

// Call patient (doctor picks up)
router.patch('/:id/call', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;
        const userId = req.user?.id as string;

        const existing = await prisma.queueEntry.findFirst({ where: { id, clinicId } });
        if (!existing) return res.status(404).json({ error: 'Queue entry not found' });
        if (existing.status !== 'Waiting') return res.status(400).json({ error: 'Patient is not in waiting status' });

        const entry = await prisma.queueEntry.update({
            where: { id },
            data: { status: 'InProgress', calledAt: new Date(), assignedToId: userId },
            include: {
                patient: { select: { id: true, name: true, species: true, breed: true } },
                department: { select: { name: true } },
                assignedTo: { select: { name: true } },
            },
        });

        res.json(entry);
    } catch (error) {
        console.error('Failed to call patient:', error);
        res.status(500).json({ error: 'Failed to call patient' });
    }
});

// Complete consultation
router.patch('/:id/complete', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;

        const existing = await prisma.queueEntry.findFirst({ where: { id, clinicId } });
        if (!existing) return res.status(404).json({ error: 'Queue entry not found' });

        const entry = await prisma.queueEntry.update({
            where: { id },
            data: { status: 'Completed', completedAt: new Date() },
        });

        res.json(entry);
    } catch (error) {
        console.error('Failed to complete queue entry:', error);
        res.status(500).json({ error: 'Failed to complete queue entry' });
    }
});

// Cancel / No-show
router.patch('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;
        const { type } = req.body; // 'Cancelled' or 'NoShow'

        const existing = await prisma.queueEntry.findFirst({ where: { id, clinicId } });
        if (!existing) return res.status(404).json({ error: 'Queue entry not found' });

        const entry = await prisma.queueEntry.update({
            where: { id },
            data: { status: type === 'NoShow' ? 'NoShow' : 'Cancelled', completedAt: new Date() },
        });

        res.json(entry);
    } catch (error) {
        console.error('Failed to cancel queue entry:', error);
        res.status(500).json({ error: 'Failed to cancel queue entry' });
    }
});

// Transfer to different department
router.patch('/:id/transfer', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;
        const { departmentId } = req.body;

        if (!departmentId) return res.status(400).json({ error: 'Department ID is required' });

        const existing = await prisma.queueEntry.findFirst({ where: { id, clinicId } });
        if (!existing) return res.status(404).json({ error: 'Queue entry not found' });

        const dept = await prisma.department.findFirst({ where: { id: departmentId, clinicId, isActive: true } });
        if (!dept) return res.status(404).json({ error: 'Department not found' });

        const entry = await prisma.queueEntry.update({
            where: { id },
            data: { departmentId, status: 'Waiting', assignedToId: null, calledAt: null },
            include: {
                department: { select: { name: true } },
            },
        });

        res.json(entry);
    } catch (error) {
        console.error('Failed to transfer queue entry:', error);
        res.status(500).json({ error: 'Failed to transfer queue entry' });
    }
});

export default router;
