import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all audit logs
router.get('/', authenticate, async (req, res) => {
    try {
        const clinicId = (req as any).user?.clinicId;

        const logs = await prisma.auditLog.findMany({
            where: clinicId ? { clinicId } : {},
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { timestamp: 'desc' },
            take: 100 // Limit to last 100 logs
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

export default router;
