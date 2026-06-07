import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
// Native replacements for date-fns to avoid dependency issues
const subDays = (date: Date, days: number) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const router = Router();

// GET /api/ai-operations/inventory-analysis
// Analyzes stock levels vs. usage patterns to predict shortages.
router.get('/inventory-analysis', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;

        // 1. Fetch current inventory items with low stock or all items
        const items = await prisma.inventoryItem.findMany({
            where: { clinicId },
            select: {
                id: true,
                name: true,
                sku: true,
                quantity: true,
                minThreshold: true,
                retailPrice: true,
            }
        });

        // 2. Fetch treatment medication usage for the last 30 days
        const thirtyDaysAgo = subDays(new Date(), 30);
        const usageData = await prisma.treatmentMedication.findMany({
            where: {
                treatment: {
                    patient: {
                        owner: {
                            clinicId
                        }
                    },
                    date: {
                        gte: thirtyDaysAgo.toISOString()
                    }
                }
            },
            select: {
                itemId: true,
                drug: true
            }
        });

        // 3. Calculate Average Daily Usage (ADU)
        const usageCounts: Record<string, number> = {};
        usageData.forEach(usage => {
            // Priority 1: itemId (exact match)
            // Priority 2: drug name (fallback)
            const key = usage.itemId || usage.drug.toLowerCase();
            usageCounts[key] = (usageCounts[key] || 0) + 1;
        });

        const analysis = items.map(item => {
            const usage = (usageCounts[item.id] || usageCounts[item.name.toLowerCase()] || 0);
            const adu = usage / 30;
            const daysRemaining = adu > 0 ? Math.floor(item.quantity / adu) : 999;

            return {
                id: item.id,
                name: item.name,
                sku: item.sku,
                currentStock: item.quantity,
                minThreshold: item.minThreshold,
                adu: adu.toFixed(2),
                predictedShortage: daysRemaining <= 7 ? 'CRITICAL' : (daysRemaining <= 14 ? 'WARNING' : 'STABLE'),
                daysRemaining,
                isBelowThreshold: item.quantity <= item.minThreshold
            };
        });

        res.json(analysis.filter(a => a.daysRemaining < 30 || a.isBelowThreshold));
    } catch (error) {
        console.error('Inventory analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze inventory' });
    }
});

// GET /api/ai-operations/schedule-audit
// Reviews upcoming appointments for conflicts, overbooking, or inefficient gaps.
router.get('/schedule-audit', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const next7Days = addDays(new Date(), 7);

        const appointments = await prisma.appointment.findMany({
            where: {
                clinicId,
                date: {
                    gte: startOfDay(new Date()).toISOString(),
                    lte: endOfDay(next7Days).toISOString()
                },
                status: { notIn: ['Cancelled'] }
            },
            include: {
                staff: { select: { id: true, name: true } },
                procedure: { select: { id: true, name: true } }
            },
            orderBy: [
                { date: 'asc' },
                { time: 'asc' }
            ]
        });

        const issues: any[] = [];
        const staffSchedule: Record<string, any[]> = {};

        // Helper to convert time string (HH:MM or H:MM) to minutes since midnight
        const timeToMinutes = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        // Group by date and staff
        appointments.forEach(app => {
            const key = `${app.date}_${app.staffId || 'unassigned'}`;
            if (!staffSchedule[key]) staffSchedule[key] = [];
            staffSchedule[key].push(app);
        });

        Object.entries(staffSchedule).forEach(([key, apps]) => {
            for (let i = 0; i < apps.length - 1; i++) {
                const current = apps[i];
                const next = apps[i + 1];

                const currentStart = timeToMinutes(current.time);
                // Standard duration: 30 mins (Should be dynamic if possible, but 30 is safer than 0)
                const currentEnd = currentStart + 30;
                const nextStart = timeToMinutes(next.time);

                // If next appointment starts before current ends
                if (nextStart < currentEnd) {
                    issues.push({
                        type: 'CONFLICT',
                        severity: nextStart === currentStart ? 'HIGH' : 'MEDIUM',
                        message: nextStart === currentStart
                            ? `Double booking detected for ${current.staff?.name || 'Staff'}: ${current.procedure?.name} and ${next.procedure?.name} at ${current.time}`
                            : `Tight overlap detected for ${current.staff?.name || 'Staff'}: ${current.procedure?.name} ends at ${Math.floor(currentEnd / 60)}:${(currentEnd % 60).toString().padStart(2, '0')}, but ${next.procedure?.name} starts at ${next.time}`,
                        items: [current.id, next.id],
                        date: current.date
                    });
                }
            }
        });

        res.json({
            auditDate: new Date().toISOString(),
            appointmentCount: appointments.length,
            issues
        });
    } catch (error) {
        console.error('Schedule audit error:', error);
        res.status(500).json({ error: 'Failed to audit schedule' });
    }
});

export default router;
