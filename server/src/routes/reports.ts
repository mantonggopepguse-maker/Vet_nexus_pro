import { Router } from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/reports/profit-loss
router.get('/profit-loss', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { startDate, endDate, inventoryCategory, procedureCategory } = req.query as any;

        // Default to current calendar month
        const now = new Date();
        const start = startDate ? new Date(startDate as string) : new Date(now.getFullYear(), now.getMonth(), 1);
        const end = endDate ? new Date(endDate as string) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        console.log(`Generating Profit/Loss for clinic ${clinicId} from ${start.toISOString()} to ${end.toISOString()}`);

        // Build where clauses for category filtering
        const inventoryWhere: any = { clinicId };
        if (inventoryCategory) {
            inventoryWhere.category = inventoryCategory;
        }

        const procedureWhere: any = { clinicId };
        if (procedureCategory) {
            procedureWhere.category = procedureCategory;
        }

        // 1. Fetch relevant data in parallel
        const [sales, inventoryItems, procedures, expenses] = await Promise.all([
            prisma.sale.findMany({
                where: {
                    clinicId,
                    status: 'Completed',
                    createdAt: { gte: start, lte: end }
                },
                include: {
                    items: true
                }
            }),
            prisma.inventoryItem.findMany({ where: inventoryWhere }),
            prisma.procedure.findMany({ where: procedureWhere }),
            prisma.expense.findMany({
                where: {
                    clinicId,
                    status: 'Completed',
                    date: { gte: start, lte: end }
                }
            })
        ]);

        let totalRevenue = 0;
        let totalCostOfSales = 0;
        let productProfit = 0;
        let procedureProfit = 0;
        let totalDiscount = 0;
        let totalTax = 0;
        let totalOperationalExpenses = 0;
        const itemBreakdownMap = new Map<string, { name: string, quantity: number, revenue: number, cost: number, profit: number, type: string }>();

        sales.forEach((sale: any) => {
            totalRevenue += Number(sale.total) || 0;
            totalDiscount += Number(sale.discount) || 0;
            totalTax += Number(sale.tax) || 0;

            let saleProductInterest = 0;
            let saleProcedureInterest = 0;

            sale.items.forEach((item: any) => {
                let costPrice = 0;
                let isProduct = false;

                if (item.itemId) {
                    const inv = (inventoryItems as any[]).find((i: any) => i.id === item.itemId);
                    if (inv) {
                        costPrice = Number(inv.costPrice) || 0;
                        isProduct = true;
                    }
                } else if (item.procedureId) {
                    const proc = (procedures as any[]).find((p: any) => p.id === item.procedureId);
                    if (proc) costPrice = Number(proc.costClinic) || 0;
                } else {
                    // Case-insensitive name match for freestyle items
                    const proc = (procedures as any[]).find((p: any) => (p.name || '').toLowerCase() === (item.name || '').toLowerCase());
                    if (proc) costPrice = Number(proc.costClinic) || 0;
                }

                const itemRevenue = (Number(item.pricePerUnit) || 0) * (Number(item.quantity) || 0);
                const itemCost = costPrice * (Number(item.quantity) || 0);
                const itemInterest = itemRevenue - itemCost; // Mark-up interest

                totalCostOfSales += itemCost;

                if (isProduct) {
                    saleProductInterest += itemInterest;
                } else {
                    saleProcedureInterest += itemInterest;
                }

                const key = `${isProduct ? 'INV' : 'PROC'}_${item.itemId || item.name}`;
                const existing = itemBreakdownMap.get(key);
                if (existing) {
                    existing.quantity += Number(item.quantity) || 0;
                    existing.revenue += itemRevenue;
                    existing.cost += itemCost;
                    existing.profit += itemInterest;
                } else {
                    itemBreakdownMap.set(key, {
                        name: item.name || 'Unknown Item',
                        quantity: Number(item.quantity) || 0,
                        revenue: itemRevenue,
                        cost: itemCost,
                        profit: itemInterest,
                        type: isProduct ? 'Product' : 'Procedure'
                    });
                }
            });

            // Apportion sale-level discount to Product/Procedure profit based on contribution
            const saleTotalInterest = saleProductInterest + saleProcedureInterest;
            const discount = Number(sale.discount) || 0;
            if (saleTotalInterest > 0 && discount > 0) {
                const productRatio = saleProductInterest / saleTotalInterest;
                const procedureRatio = saleProcedureInterest / saleTotalInterest;
                productProfit += (saleProductInterest - (discount * productRatio));
                procedureProfit += (saleProcedureInterest - (discount * procedureRatio));
            } else {
                productProfit += saleProductInterest;
                procedureProfit += saleProcedureInterest;
            }
        });

        // Calculate total operational expenses
        expenses.forEach((exp: any) => {
            totalOperationalExpenses += Number(exp.amount) || 0;
        });

        // Use stored sale.subtotal (DB source of truth) for gross sales — avoids re-derivation bugs
        const totalSubtotal = sales.reduce((sum: number, sale: any) => sum + (Number(sale.subtotal) || 0), 0);
        const grossProfit = totalSubtotal - totalCostOfSales - totalDiscount;
        const netProfit = grossProfit - totalOperationalExpenses;

        const breakdown = Array.from(itemBreakdownMap.values())
            .sort((a, b) => b.profit - a.profit);

        // Get unique categories for frontend dropdowns
        const inventoryCategories = await prisma.inventoryItem.findMany({
            where: { clinicId },
            select: { category: true },
            distinct: ['category']
        });

        const procedureCategories = await prisma.procedure.findMany({
            where: { clinicId },
            select: { category: true },
            distinct: ['category']
        });

        res.json({
            summary: {
                totalRevenue, // Total incl tax
                totalSubtotal, // Gross Sales (excl tax, before discount)
                totalDiscount,
                totalTax,
                totalCostOfSales, // COGS
                totalOperationalExpenses,
                grossProfit,
                netProfit,
                productProfit,
                procedureProfit
            },
            breakdown,
            categories: {
                inventory: inventoryCategories.map((c: any) => c.category).filter(Boolean),
                procedures: procedureCategories.map((c: any) => c.category).filter(Boolean)
            }
        });

    } catch (error: any) {
        console.error('Profit/Loss report error:', error);
        res.status(500).json({ error: 'Failed to generate report', details: error.message });
    }
});

// POST /api/reports/referral-synthesis
router.post('/referral-synthesis', authenticate, async (req: AuthRequest, res) => {
    try {
        const { patientId } = req.body;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'AI API Key not configured' });
        }

        // Fetch ALL clinical context for this patient
        const patient = await prisma.patient.findUnique({
            where: { id: patientId as string },
            include: {
                owner: true,
                treatments: {
                    include: {
                        medications: true,
                        procedures: { include: { procedure: true } },
                        vet: true
                    },
                    orderBy: { date: 'desc' },
                    take: 10 // Last 10 visits for context
                },
                labResults: {
                    orderBy: { testDate: 'desc' },
                    take: 10
                },
                hospitalizations: {
                    include: { vet: true },
                    orderBy: { admissionDate: 'desc' },
                    take: 5
                }
            }
        });

        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const historyContext = `
            Patient: ${patient.name} (${patient.species}, ${patient.breed}, ${patient.gender}, ${patient.weight}kg)
            Owner: ${patient.owner?.firstName ?? 'N/A'} ${patient.owner?.lastName ?? ''}
            
            CLINICAL HISTORY:
            ${patient.treatments.map((t: any) => `- ${new Date(t.date).toLocaleDateString()}: Diagnosis: ${t.diagnosis}. Notes: ${t.notes}. Meds: ${t.medications.map((m: any) => m.drug).join(', ')}`).join('\n')}
            
            LAB RESULTS:
            ${patient.labResults.map((l: any) => `- ${new Date(l.testDate).toLocaleDateString()}: ${l.testName}. Results: ${l.numericalValue || ''} ${l.unit || ''}. Findings: ${l.findings}`).join('\n')}
            
            HOSPITALIZATIONS:
            ${patient.hospitalizations.map((h: any) => `- Adm: ${new Date(h.admissionDate).toLocaleDateString()}. Reason: ${h.reason}. Status: ${h.status}`).join('\n')}
        `;

        const prompt = `
            You are a Specialist Veterinary Consultant. 
            Synthesize the following patient history into a professional, concise Referral Letter for another specialist.
            
            Format the output in Markdown with these sections:
            1. **PATIENT SUMMARY** (Age, Breed, Signalment)
            2. **CHIEF COMPLAINTS & CHRONOLOGY** (Timeline of major events)
            3. **DIAGNOSTIC SUMMARY** (Key lab abnormalities or imaging findings)
            4. **CURRENT STABILIZATION** (Meds and treatments currently being given)
            5. **REASON FOR REFERRAL** (What we need from the specialist)
            
            Patient Data:
            ${historyContext}
            
            Write professionally and use medical terminology. Be concise but thorough.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ synthesis: text });

    } catch (error: any) {
        console.error('Referral Synthesis Error:', error);
        res.status(500).json({ error: 'Failed to synthesize referral', details: error.message });
    }
});

// POST /api/reports/home-care-instructions
router.post('/home-care-instructions', authenticate, async (req: AuthRequest, res) => {
    try {
        const { treatmentId } = req.body;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'AI API Key not configured' });
        }

        const treatment = await prisma.treatment.findUnique({
            where: { id: treatmentId },
            include: {
                patient: true,
                medications: true,
                procedures: { include: { procedure: true } },
                vet: true
            }
        });

        if (!treatment) return res.status(404).json({ error: 'Treatment record not found' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            You are a compassionate Veterinary Support Assistant.
            Create a "Pet Parent Home Care Guide" for the following treatment:
            
            Patient: ${treatment.patient.name} (${treatment.patient.species})
            Diagnosis: ${treatment.diagnosis}
            Clinical Notes: ${treatment.notes}
            Medications: ${treatment.medications.map(m => `${m.drug}: ${m.dose} ${m.route} ${m.freq} for ${m.duration}`).join(', ')}
            Procedures: ${treatment.procedures.map(p => p.procedure.name).join(', ')}
            
            Format the output in Markdown with these sections:
            1. **WHAT HAPPENED TODAY** (Simple explanation of the diagnosis and treatments)
            2. **AT-HOME MEDICATIONS** (Clear table/list with clear instructions)
            3. **MONITORING & RED FLAGS** (What the owner should look out for, e.g., vomiting, lethargy)
            4. **DIET & ACTIVITY** (Rest, feeding instructions)
            5. **FOLLOW-UP** (When to come back)
            
            Tone: Modern, empathetic, clear, and encouraging. Avoid overly complex medical jargon where possible.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ instructions: text });

    } catch (error: any) {
        console.error('Home Care Synthesis Error:', error);
        res.status(500).json({ error: 'Failed to generate care instructions', details: error.message });
    }
});

export default router;
