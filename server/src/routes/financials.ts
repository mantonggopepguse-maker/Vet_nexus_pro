import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from 'date-fns';

const router = Router();

// GET /api/financials/report - Clinic Financial Overview
router.get('/report', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const now = new Date();
        const startOfThisMonth = startOfMonth(now);
        const endOfThisMonth = endOfMonth(now);
        const startOfLastMonth = startOfMonth(subMonths(now, 1));
        const endOfLastMonth = endOfMonth(subMonths(now, 1));

        // 1. Total Revenue (This Month vs Last Month)
        const [revenueThisMonth, revenueLastMonth] = await Promise.all([
            prisma.sale.aggregate({
                where: { 
                    clinicId, 
                    status: { not: 'Deleted' },
                    createdAt: { gte: startOfThisMonth, lte: endOfThisMonth }
                },
                _sum: { amountPaid: true }
            }),
            prisma.sale.aggregate({
                where: { 
                    clinicId, 
                    status: { not: 'Deleted' },
                    createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
                },
                _sum: { amountPaid: true }
            })
        ]);

        // 2. Expenses (This Month)
        const expensesThisMonth = await prisma.expense.aggregate({
            where: {
                clinicId,
                date: { gte: startOfThisMonth, lte: endOfThisMonth }
            },
            _sum: { amount: true }
        });

        // 3. Revenue by Item Category
        const topCategories = await prisma.cartItem.groupBy({
            by: ['itemId'],
            where: {
                sale: { clinicId, status: { not: 'Deleted' }, createdAt: { gte: startOfThisMonth } },
                itemId: { not: null }
            },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 10
        });

        // Fetch item names for categories
        const itemDetails = await prisma.inventoryItem.findMany({
            where: { id: { in: topCategories.map(c => c.itemId as string) } },
            select: { id: true, name: true, category: true }
        });

        const categorySummary = topCategories.map(cat => {
            const item = itemDetails.find(i => i.id === cat.itemId);
            return {
                name: item?.name || 'Unknown',
                category: item?.category || 'General',
                quantity: cat._sum.quantity || 0
            };
        });

        // 4. Aging Receivables (Outstanding Balances)
        const outstanding = await prisma.sale.aggregate({
            where: {
                clinicId,
                status: 'Pending',
                balanceDue: { gt: 0 }
            },
            _sum: { balanceDue: true },
            _count: true
        });

        res.json({
            summary: {
                revenueThisMonth: revenueThisMonth._sum.amountPaid || 0,
                revenueLastMonth: revenueLastMonth._sum.amountPaid || 0,
                expensesThisMonth: expensesThisMonth._sum.amount || 0,
                netProfit: (revenueThisMonth._sum.amountPaid || 0) - (expensesThisMonth._sum.amount || 0),
                growth: revenueLastMonth._sum.amountPaid 
                    ? (((revenueThisMonth._sum.amountPaid || 0) - revenueLastMonth._sum.amountPaid) / revenueLastMonth._sum.amountPaid) * 100 
                    : 0
            },
            receivables: {
                totalOutstanding: outstanding._sum.balanceDue || 0,
                invoiceCount: outstanding._count || 0
            },
            topCategories: categorySummary
        });

    } catch (error) {
        console.error('Financial report error:', error);
        res.status(500).json({ error: 'Failed to generate financial report' });
    }
});

export default router;
