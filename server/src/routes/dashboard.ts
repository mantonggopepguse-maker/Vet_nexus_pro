import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

const dashboardCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 60000; // 60 seconds

// Dashboard Statistics Endpoint
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const isAdmin = req.user?.isSuperAdmin;
        const cacheKey = `${clinicId}_${isAdmin}`;

        // Check cache
        const cached = dashboardCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return res.json(cached.data);
        }

        const whereClinic = isAdmin ? {} : { clinicId };
        const whereOwnerClinic = isAdmin ? {} : { owner: { clinicId } };

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); // Start of calendar month

        // Use Promise.all for parallel execution
        const [
            clientsCount,
            patientsCount,
            topSellingItems,
            upcomingAppointments,
            rawLowStock,
            rawTotalValue,
            salesStats,
            overheadStats,
            debtStats,
            hospitalizationStats,
            ongoingTreatments,
            triageQueue,
            waitingList
        ] = await Promise.all([
            // Clients counts
            Promise.all([
                prisma.client.count({ where: { ...whereClinic, createdAt: { gte: startOfDay } } }),
                prisma.client.count({ where: { ...whereClinic, createdAt: { gte: startOfWeek } } }),
                prisma.client.count({ where: { ...whereClinic, createdAt: { gte: startOfMonth } } }),
            ]),
            // Patients counts
            Promise.all([
                prisma.patient.count({ where: { ...whereOwnerClinic, createdAt: { gte: startOfDay } } }),
                prisma.patient.count({ where: { ...whereOwnerClinic, createdAt: { gte: startOfWeek } } }),
                prisma.patient.count({ where: { ...whereOwnerClinic, createdAt: { gte: startOfMonth } } }),
            ]),
            // Top Selling
            prisma.inventoryItem.findMany({
                where: whereClinic,
                orderBy: { sales: 'desc' },
                take: 5
            }),
            // Top 3 Upcoming Appointments
            prisma.appointment.findMany({
                where: {
                    ...whereClinic,
                    date: { gte: now.toISOString().split('T')[0] },
                    status: { notIn: ['Completed', 'Cancelled'] }
                },
                include: {
                    client: true,
                    procedure: true
                },
                orderBy: [
                    { date: 'asc' },
                    { time: 'asc' }
                ],
                take: 3
            }),
            // Raw Low Stock
            isAdmin ?
                prisma.$queryRaw`SELECT id, name, "quantity", "minThreshold" FROM inventory_items WHERE "quantity" <= "minThreshold" LIMIT 5` :
                prisma.$queryRaw`SELECT id, name, "quantity", "minThreshold" FROM inventory_items WHERE "quantity" <= "minThreshold" AND "clinicId" = ${clinicId} LIMIT 5`,
            // Raw Total Value
            isAdmin ?
                prisma.$queryRaw`SELECT COALESCE(SUM("quantity" * "retailPrice"), 0) as total_value FROM inventory_items` :
                prisma.$queryRaw`SELECT COALESCE(SUM("quantity" * "retailPrice"), 0) as total_value FROM inventory_items WHERE "clinicId" = ${clinicId}`,
            // Sales with Items (for Revenue & COGS)
            Promise.all([
                prisma.sale.findMany({ where: { ...whereClinic, status: 'Completed', createdAt: { gte: startOfDay } }, include: { items: true } }),
                prisma.sale.findMany({ where: { ...whereClinic, status: 'Completed', createdAt: { gte: startOfWeek } }, include: { items: true } }),
                prisma.sale.findMany({ where: { ...whereClinic, status: 'Completed', createdAt: { gte: startOfMonth } }, include: { items: true } })
            ]),
            // Overhead (Operational Expenses)
            Promise.all([
                prisma.expense.aggregate({ where: { ...whereClinic, status: 'Completed', date: { gte: startOfDay } }, _sum: { amount: true } }),
                prisma.expense.aggregate({ where: { ...whereClinic, status: 'Completed', date: { gte: startOfWeek } }, _sum: { amount: true } }),
                prisma.expense.aggregate({ where: { ...whereClinic, status: 'Completed', date: { gte: startOfMonth } }, _sum: { amount: true } })
            ]),
            // Outstanding Debt
            prisma.sale.aggregate({
                where: {
                    ...whereClinic,
                    status: { not: 'Voided' },
                    balanceDue: { gt: 0 }
                },
                _sum: { balanceDue: true }
            }),
            // Hospitalization stats
            Promise.all([
                prisma.hospitalization.count({ where: { ...whereClinic, status: 'Admitted' } }),
                prisma.kennel.count({ where: whereClinic }),
                prisma.kennel.count({ where: { ...whereClinic, status: 'Occupied' } })
            ]),
            // Ongoing Treatments
            prisma.treatment.findMany({
                where: {
                    ...(isAdmin ? {} : { patient: { owner: { clinicId } } }),
                    status: 'Ongoing'
                },
                include: { patient: { select: { id: true, name: true } }, vet: { select: { name: true } } },
                orderBy: { date: 'desc' },
                take: 5
            }),
            // 13. Triage Queue
            prisma.patient.findMany({
                where: { owner: { clinicId }, triageStatus: { not: 'NONE' } },
                include: { owner: true },
                orderBy: { triageStartTime: 'asc' },
                take: 5
            }),
            // 14. Waiting List
            prisma.appointment.findMany({
                where: {
                    ...whereClinic,
                    date: { equals: now.toISOString().split('T')[0] },
                    status: 'Pending'
                },
                include: { client: true, patient: true },
                orderBy: { time: 'asc' }
            })
        ]);

        // Extract uniquely sold items and procedures to fetch only their costs
        const soldItemIds = new Set<string>();
        const soldProcedureIds = new Set<string>();
        const soldFreestyleNames = new Set<string>();

        const allSales = [...salesStats[0], ...salesStats[1], ...salesStats[2]];
        allSales.forEach(sale => {
            sale.items?.forEach((item: any) => {
                if (item.itemId) {
                    soldItemIds.add(item.itemId);
                } else if (item.procedureId) {
                    soldProcedureIds.add(item.procedureId);
                } else if (item.name) {
                    soldFreestyleNames.add(item.name.toLowerCase());
                }
            });
        });

        const [inventoryCosts, procedureCosts] = await Promise.all([
            prisma.inventoryItem.findMany({
                where: {
                    ...whereClinic,
                    id: { in: Array.from(soldItemIds) }
                },
                select: { id: true, costPrice: true }
            }),
            prisma.procedure.findMany({
                where: {
                    ...whereClinic,
                    OR: [
                        { id: { in: Array.from(soldProcedureIds) } },
                        { name: { in: Array.from(soldFreestyleNames), mode: 'insensitive' } }
                    ]
                },
                select: { id: true, name: true, costClinic: true }
            })
        ]);

        const inventoryCostMap = new Map(inventoryCosts.map(i => [i.id, i.costPrice]));
        const procedureCostMap = new Map(procedureCosts.map(p => [p.id, p.costClinic]));
        const procedureNameCostMap = new Map(procedureCosts.map(p => [(p.name || '').toLowerCase(), p.costClinic]));

        const calcStats = (sales: any[]) => {
            let revenue = 0;
            let cogs = 0;
            let tax = 0;
            let discount = 0;
            let subtotal = 0;
            let serviceRevenue = 0;
            let retailRevenue = 0;

            sales.forEach(sale => {
                revenue += Number(sale.total) || 0;
                tax += Number(sale.tax) || 0;
                discount += Number(sale.discount) || 0;
                subtotal += Number(sale.subtotal) || 0;

                sale.items.forEach((item: any) => {
                    let cost = 0;
                    if (item.itemId) {
                        cost = inventoryCostMap.get(item.itemId) || 0;
                        retailRevenue += (Number(item.pricePerUnit) || 0) * (Number(item.quantity) || 0);
                    } else if (item.procedureId) {
                        cost = procedureCostMap.get(item.procedureId) || 0;
                        serviceRevenue += (Number(item.pricePerUnit) || 0) * (Number(item.quantity) || 0);
                    } else {
                        const itemNameLower = (item.name || '').toLowerCase();
                        cost = procedureNameCostMap.get(itemNameLower) || 0;
                        serviceRevenue += (Number(item.pricePerUnit) || 0) * (Number(item.quantity) || 0);
                    }
                    cogs += cost * (Number(item.quantity) || 0);
                });
            });

            return { revenue, cogs, tax, discount, subtotal, serviceRevenue, retailRevenue };
        };

        const todayStats = calcStats(salesStats[0]);
        const weekStats = calcStats(salesStats[1]);
        const monthStats = calcStats(salesStats[2]);

        const getExpense = (index: number) => (overheadStats as any)[index]._sum.amount || 0;

        // Calculate weekly revenue for graph (last 7 days) in a single optimized pass
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        const weeklySales = await prisma.sale.findMany({
            where: {
                ...whereClinic,
                status: 'Completed',
                createdAt: { gte: sevenDaysAgo }
            },
            select: { total: true, createdAt: true }
        });

        const weeklyRevenue = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });

            const dayTotal = weeklySales
                .filter(s => new Date(s.createdAt).toDateString() === date.toDateString())
                .reduce((sum, s) => sum + s.total, 0);

            weeklyRevenue.push({
                name: dayStr,
                revenue: dayTotal
            });
        }

        const isClinicAdmin = req.user?.roles?.includes('Admin') || isAdmin;

        const result = {
            clients: {
                today: clientsCount[0],
                week: clientsCount[1],
                month: clientsCount[2]
            },
            patients: {
                today: patientsCount[0],
                week: patientsCount[1],
                month: patientsCount[2]
            },
            revenue: isClinicAdmin ? {
                today: todayStats.revenue,
                week: weekStats.revenue,
                month: monthStats.revenue
            } : undefined,
            subtotal: isClinicAdmin ? {
                today: todayStats.subtotal,
                week: weekStats.subtotal,
                month: monthStats.subtotal
            } : undefined,
            cogs: isClinicAdmin ? {
                today: todayStats.cogs,
                week: weekStats.cogs,
                month: monthStats.cogs
            } : undefined,
            overhead: isClinicAdmin ? {
                today: getExpense(0),
                week: getExpense(1),
                month: getExpense(2)
            } : undefined,
            tax: isClinicAdmin ? {
                today: todayStats.tax,
                week: weekStats.tax,
                month: monthStats.tax
            } : undefined,
            discount: isClinicAdmin ? {
                today: todayStats.discount,
                week: weekStats.discount,
                month: monthStats.discount
            } : undefined,
            revenueByType: isClinicAdmin ? {
                today: { services: todayStats.serviceRevenue, retail: todayStats.retailRevenue },
                week: { services: weekStats.serviceRevenue, retail: weekStats.retailRevenue },
                month: { services: monthStats.serviceRevenue, retail: monthStats.retailRevenue }
            } : undefined,
            outstandingDebt: isClinicAdmin ? ((debtStats as any)._sum.balanceDue || 0) : undefined,
            lowStock: rawLowStock,
            topSelling: topSellingItems,
            totalAssetValue: isClinicAdmin ? Number((rawTotalValue as any[])?.[0]?.total_value || 0) : undefined,
            upcomingAppointments,
            ongoingTreatments,
            hospitalization: {
                active: hospitalizationStats[0],
                totalKennels: hospitalizationStats[1],
                occupiedKennels: hospitalizationStats[2],
                occupancyRate: hospitalizationStats[1] > 0 ? Math.round((hospitalizationStats[2] / hospitalizationStats[1]) * 100) : 0
            },
            triageQueue,
            waitingList,
            weeklyRevenue
        };

        // Update cache
        dashboardCache.set(cacheKey, { data: result, timestamp: Date.now() });

        res.json(result);

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});


import { Prisma } from '@prisma/client';

export default router;
