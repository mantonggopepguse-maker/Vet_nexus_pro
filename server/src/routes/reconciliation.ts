import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Validation schema
const reconciliationSchema = z.object({
    itemId: z.string(),
    physicalCount: z.number().int().min(0),
    reason: z.string().optional(),
    notes: z.string().optional()
});

// POST /api/reconciliation - Create new reconciliation
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const validation = reconciliationSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
        }

        const { itemId, physicalCount, reason, notes } = validation.data;
        const userId = req.user?.id as string;
        const clinicId = req.user?.clinicId as string;

        // Fetch current item
        const item = await prisma.inventoryItem.findFirst({
            where: { id: itemId, clinicId }
        });

        if (!item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        const systemCount = item.quantity;
        const adjustment = physicalCount - systemCount;

        // Create reconciliation record
        const reconciliation = await prisma.inventoryReconciliation.create({
            data: {
                itemId,
                performedBy: userId,
                systemCount,
                physicalCount,
                adjustment,
                reason: reason || null,
                notes: notes || null
            }
        });

        // Update inventory quantity
        await prisma.inventoryItem.update({
            where: { id: itemId },
            data: { quantity: physicalCount }
        });

        // Log in audit trail
        // Log in audit trail
        await prisma.auditLog.create({
            data: {
                clinicId,
                userId,
                userName: req.user?.name || 'Unknown',
                module: 'Inventory',
                action: 'Reconciliation',
                details: `Reconciled ${item.name}: System=${systemCount}, Physical=${physicalCount}, Adjustment=${adjustment}${reason ? `, Reason: ${reason}` : ''}`
            }
        });

        res.json(reconciliation);
    } catch (error: any) {
        console.error('Reconciliation error:', error);
        res.status(500).json({ error: 'Failed to process reconciliation', details: error.message });
    }
});

// GET /api/reconciliation - List all reconciliations with optional filtering
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const rawItemId = req.query.itemId;
        const itemId = typeof rawItemId === 'string' ? rawItemId : undefined;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (itemId) {
            where.itemId = itemId;
            // Verify item belongs to clinic
            const item = await prisma.inventoryItem.findFirst({
                where: { id: itemId, clinicId }
            });
            if (!item) {
                return res.status(404).json({ error: 'Item not found' });
            }
        } else {
            // Filter by clinic through item relation
            where.item = { clinicId };
        }

        const reconciliations = await prisma.inventoryReconciliation.findMany({
            where,
            include: {
                item: {
                    select: { name: true, sku: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip
        });

        res.json(reconciliations);
    } catch (error: any) {
        console.error('Fetch reconciliations error:', error);
        res.status(500).json({ error: 'Failed to fetch reconciliations', details: error.message });
    }
});

// GET /api/reconciliation/item/:id - Get reconciliation history for specific item
router.get('/item/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const itemId = String(req.params.id);
        const clinicId = req.user?.clinicId as string;

        // Verify item belongs to clinic
        const item = await prisma.inventoryItem.findFirst({
            where: { id: itemId, clinicId }
        });

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const reconciliations = await prisma.inventoryReconciliation.findMany({
            where: { itemId: itemId as string },
            orderBy: { createdAt: 'desc' }
        });

        res.json(reconciliations);
    } catch (error: any) {
        console.error('Fetch item reconciliations error:', error);
        res.status(500).json({ error: 'Failed to fetch item reconciliations', details: error.message });
    }
});

export default router;
