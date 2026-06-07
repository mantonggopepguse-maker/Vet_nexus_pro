import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all narcotic logs
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const logs = await prisma.narcoticLog.findMany({
            where: { clinicId },
            include: {
                user: { select: { name: true } },
                patient: { select: { name: true } },
                item: { select: { name: true } }
            },
            orderBy: { timestamp: 'desc' }
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch narcotic logs' });
    }
});

// Create a narcotic log (requires PIN verification)
router.post('/log', authenticate, async (req: AuthRequest, res) => {
    const { itemId, patientId, amountDrawn, wasteAmount, pin, note } = req.body;
    const userId = req.user?.id as string;
    const clinicId = req.user?.clinicId as string;

    try {
        // Verify PIN
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user || user.controlledPin !== pin) {
            return res.status(403).json({ error: 'Invalid narcotics access PIN' });
        }

        // Create log entry within a transaction to ensure both log and inventory update succeed
        const result = await prisma.$transaction(async (tx: any) => {
            // Fetch current balance first
            const item = await tx.inventoryItem.findUnique({
                where: { id: itemId },
                select: { name: true, quantity: true }
            });

            if (!item) throw new Error('Inventory item not found');

            const totalDeduction = parseFloat(amountDrawn) + parseFloat(wasteAmount || '0');
            const newBalance = item.quantity - totalDeduction;

            const log = await tx.narcoticLog.create({
                data: {
                    clinicId,
                    itemId,
                    patientId: patientId || undefined,
                    userId,
                    amountDrawn: parseFloat(amountDrawn),
                    wasteAmount: parseFloat(wasteAmount || '0'),
                    balanceAfter: newBalance,
                    timestamp: new Date(),
                    reason: note || '',
                    authPinUsed: 'VERIFIED'
                }
            });

            // Deduct from inventory
            await tx.inventoryItem.update({
                where: { id: itemId },
                data: { quantity: newBalance }
            });

            // Audit Trail
            await tx.auditLog.create({
                data: {
                    userId,
                    userName: user.name,
                    clinicId,
                    module: 'NARCOTICS',
                    action: 'LOG_USAGE',
                    details: `Logged ${amountDrawn} units usage of ${item.name}. Balance: ${newBalance}`,
                    timestamp: new Date()
                }
            });

            return log;
        });

        res.json(result);
    } catch (error) {
        console.error('Narcotic logging failed:', error);
        res.status(500).json({ error: 'Failed to log narcotic usage' });
    }
});

export default router;
