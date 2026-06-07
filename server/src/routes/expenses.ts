import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();

const expenseSchema = z.object({
    name: z.string().min(1),
    amount: z.number().min(0),
    purpose: z.string().min(1),
    date: z.string().optional(),
    status: z.string().optional().default('Completed'),
    clinicId: z.string().optional() // For SuperAdmin
});

// Get all expenses (paginated)
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const expenses = await prisma.expense.findMany({
            where: req.user?.isSuperAdmin ? {} : { clinicId: req.user?.clinicId as string },
            take: limit,
            skip: skip,
            orderBy: { date: 'desc' }
        });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

// Create expense
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const data = expenseSchema.parse(req.body);
        let clinicId = req.user?.clinicId;

        if (req.user?.isSuperAdmin) {
            clinicId = data.clinicId || clinicId;
        }

        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic ID is required' });
        }

        const expense = await prisma.expense.create({
            data: {
                clinicId: clinicId,
                name: data.name,
                amount: data.amount,
                purpose: data.purpose,
                date: data.date ? new Date(data.date) : new Date(),
                status: data.status,
            }
        });

        // Log Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'EXPENSES', 'CREATE', `Created expense: ${expense.name} for ${expense.amount}`, req.user.clinicId || undefined, req.user.name);
        }

        res.status(201).json(expense);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Create expense error:', error);
        res.status(500).json({ error: 'Failed to create expense' });
    }
});

// Update expense
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const data = expenseSchema.parse(req.body);
        const existing = await prisma.expense.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });
        if (!existing) return res.status(404).json({ error: 'Expense not found' });

        const expense = await prisma.expense.update({
            where: { id: req.params.id as string },
            data: { 
                name: data.name, 
                amount: data.amount, 
                purpose: data.purpose,
                date: data.date ? new Date(data.date) : undefined, 
                status: data.status 
            }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'EXPENSES', 'UPDATE',
                `Updated expense: ${expense.name}`, req.user.clinicId || undefined, req.user.name);
        }
        res.json(expense);
    } catch (error: any) {
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: error.errors });
        res.status(500).json({ error: 'Failed to update expense' });
    }
});

// Delete expense - Admin Only
router.delete('/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const existing = await prisma.expense.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        await prisma.expense.delete({
            where: { id: req.params.id as string }
        });

        // Log Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'EXPENSES', 'DELETE', `Deleted expense: ${existing.name}`, req.user.clinicId || undefined, req.user.name);
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

export default router;
