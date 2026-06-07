import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// Get AI Activity Logs
router.get('/', authenticate, async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        const { agentType, status, startDate, endDate } = req.query;

        const where: any = {
            clinicId: (req as any).user.clinicId
        };

        if (agentType) where.agentType = agentType;
        if (status) where.status = status;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        const [total, logs] = await Promise.all([
            prisma.aIActivity.count({ where }),
            prisma.aIActivity.findMany({
                where,
                include: {
                    user: {
                        select: { name: true, email: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            })
        ]);

        res.json({
            data: logs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Failed to fetch AI logs:', error);
        res.status(500).json({ error: 'Failed to fetch AI activity logs' });
    }
});

// Get AI Usage Stats
router.get('/stats', authenticate, async (req, res) => {
    try {
        const clinicId = (req as any).user.clinicId;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [monthlyTotal, byAgent] = await Promise.all([
            prisma.aIActivity.count({
                where: {
                    clinicId,
                    createdAt: { gte: startOfMonth }
                }
            }),
            prisma.aIActivity.groupBy({
                by: ['agentType'],
                where: {
                    clinicId,
                    createdAt: { gte: startOfMonth }
                },
                _count: {
                    id: true
                }
            })
        ]);

        res.json({
            month: now.toLocaleString('default', { month: 'long' }),
            totalActions: monthlyTotal,
            breakdown: byAgent.map(item => ({
                agent: item.agentType,
                count: item._count.id
            }))
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch AI stats' });
    }
});

export default router;
