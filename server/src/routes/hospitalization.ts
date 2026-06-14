import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();

// --- KENNELS ---

router.get('/kennels', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId } = req.user!;
        const kennels = await prisma.kennel.findMany({
            where: { clinicId },
            include: {
                hospitalizations: {
                    where: { status: 'Admitted' },
                    include: {
                        patient: true,
                        vet: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(kennels);
    } catch (error) {
        console.error('Error fetching kennels:', error);
        res.status(500).json({ error: 'Failed to fetch kennels' });
    }
});

router.post('/kennels', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId } = req.user!;
        const { name, type, size, chargePerNight, category } = req.body;
        const kennel = await prisma.kennel.create({
            data: {
                clinicId: clinicId!,
                name,
                type: type || 'General Ward',
                size: size || null,
                chargePerNight: chargePerNight || 0,
                category: category || 'General'
            }
        });
        res.status(201).json(kennel);
    } catch (error) {
        console.error('Error creating kennel:', error);
        res.status(500).json({ error: 'Failed to create kennel' });
    }
});

// --- HOSPITALIZATIONS ---

router.post('/admit', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId, id: vetId } = req.user!;
        const { patientId, kennelId, reason, estimatedCost } = req.body;
        
        // Ensure kennel is available
        const kennel = await prisma.kennel.findUnique({ where: { id: kennelId } });
        if (!kennel || kennel.status !== 'Available') {
            return res.status(400).json({ error: 'Kennel is not available' });
        }

        const hospitalization = await prisma.$transaction(async (tx: any) => {
            const hosp = await tx.hospitalization.create({
                data: { clinicId, patientId, vetId, kennelId, reason, estimatedCost: Number(estimatedCost || 0) },
                include: { patient: true, kennel: true }
            });
            await tx.kennel.update({
                where: { id: kennelId },
                data: { status: 'Occupied' }
            });
            return hosp;
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'HOSPITALIZATION', 'ADMIT', 
                `Admitted patient ${patientId} to kennel ${kennelId}`, clinicId!, req.user.name);
        }

        res.status(201).json(hospitalization);
    } catch (error) {
        console.error('Error admitting patient:', error);
        res.status(500).json({ error: 'Failed to admit patient' });
    }
});

router.get('/rounds', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId } = req.user!;
        const hospitalizations = await prisma.hospitalization.findMany({
            where: { clinicId, status: 'Admitted' },
            include: {
                patient: true,
                kennel: true,
                vet: { select: { id: true, name: true } },
                doctorInCharge: { select: { id: true, name: true } }
            },
            orderBy: { admissionDate: 'desc' }
        });
        res.json(hospitalizations);
    } catch (error) {
        console.error('Error fetching rounds summary:', error);
        res.status(500).json({ error: 'Failed to fetch rounds summary' });
    }
});

router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { criticalAlert, nursingInstructions, treatmentPlan, doctorInChargeId } = req.body;
        
        const updated = await prisma.hospitalization.update({
            where: { id, clinicId: req.user!.clinicId! },
            data: { 
                criticalAlert, 
                nursingInstructions, 
                treatmentPlan, 
                doctorInChargeId 
            },
            include: {
                patient: true,
                kennel: true,
                doctorInCharge: { select: { id: true, name: true } }
            }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'HOSPITALIZATION', 'UPDATE', 
                `Updated clinical parameters for hospitalization ${id}`, req.user.clinicId!, req.user.name);
        }

        res.json(updated);
    } catch (error) {
        console.error('Error updating hospitalization:', error);
        res.status(500).json({ error: 'Failed to update hospitalization' });
    }
});

router.put('/:id/discharge', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Get hospitalization with flowsheet entries AND prescriptions
            const hosp = await tx.hospitalization.findUnique({
                where: { id, clinicId: req.user!.clinicId! },
                include: {
                    patient: true,
                    clinic: true,
                    flowsheetEntries: true,
                    prescriptions: {
                        where: { status: 'Active' },
                        include: { inventoryItem: true }
                    }
                }
            });

            if (!hosp) throw new Error('Hospitalization not found or access denied');

            // 2. Aggregate billed items from flowsheet entries
            const itemsToBill: Record<string, { itemId: string, name: string, quantity: number, price: number }> = {};
            const flowsheetBilledItemIds = new Set<string>();
            
            hosp.flowsheetEntries.forEach((entry: any) => {
                if (entry.billedItems && Array.isArray(entry.billedItems)) {
                    entry.billedItems.forEach((item: any) => {
                        const key = item.itemId;
                        flowsheetBilledItemIds.add(key);
                        if (!itemsToBill[key]) {
                            itemsToBill[key] = { ...item };
                        } else {
                            itemsToBill[key].quantity += item.quantity;
                        }
                    });
                }
            });

            // 3. Also capture prescription drugs NOT already billed via flowsheet
            //    These are drugs prescribed but never administered/deducted on the flowsheet
            hosp.prescriptions.forEach((rx: any) => {
                if (rx.inventoryItemId && !flowsheetBilledItemIds.has(rx.inventoryItemId) && rx.inventoryItem) {
                    const key = `rx_${rx.id}`;
                    itemsToBill[key] = {
                        itemId: rx.inventoryItemId,
                        name: `${rx.drugName} (Rx - not administered)`,
                        quantity: 0, // Don't bill un-administered prescriptions by default
                        price: Number(rx.inventoryItem.retailPrice || 0)
                    };
                }
            });

            const billableItemsData = Object.values(itemsToBill).filter(i => i.quantity > 0);

            // 4. Create Sale (Invoice)
            const count = await tx.sale.count({ where: { clinicId: hosp.clinicId } });
            const acronym = hosp.clinic.acronym || 'VET';
            const invoiceNumber = `HOSP-${(count + 1).toString().padStart(4, '0')}/${acronym}`;

            let subtotal = Number(hosp.estimatedCost || 0);
            const saleItems: any[] = [
                {
                    name: `Base Hospitalization Fee (${hosp.reason || 'Medical Care'})`,
                    quantity: 1,
                    pricePerUnit: Number(hosp.estimatedCost || 0)
                }
            ];

            // Add medical items from flowsheet
            billableItemsData.forEach(item => {
                const totalItemPrice = item.price * item.quantity;
                subtotal += totalItemPrice;
                saleItems.push({
                    itemId: item.itemId,
                    name: item.name,
                    quantity: item.quantity,
                    pricePerUnit: item.price
                });
            });

            const sale = await tx.sale.create({
                data: {
                    clinicId: hosp.clinicId,
                    clientId: hosp.patient.ownerId,
                    invoiceNumber,
                    type: 'INVOICE',
                    status: 'Pending',
                    subtotal: subtotal,
                    total: subtotal,
                    balanceDue: subtotal,
                    amountPaid: 0,
                    issuerName: 'System (Auto-Hosp)',
                    items: {
                        create: saleItems.map(si => ({
                            itemId: si.itemId || null,
                            name: si.name,
                            quantity: si.quantity,
                            pricePerUnit: si.pricePerUnit
                        }))
                    }
                }
            });

            // 5. Finalize Discharge
            const updatedHosp = await tx.hospitalization.update({
                where: { id },
                data: { 
                    status: 'Discharged', 
                    dischargeDate: new Date(),
                    saleId: sale.id 
                }
            });

            await tx.kennel.update({
                where: { id: hosp.kennelId },
                data: { status: 'Available' }
            });

            if (req.user?.id) {
                await logAudit(req.user.id, 'HOSPITALIZATION', 'DISCHARGE', 
                    `Discharged patient ${hosp.patientId} from hospitalization ${id}`, hosp.clinicId, req.user.name);
            }

            return { hospitalization: updatedHosp, saleId: sale.id };
        });

        res.json(result);
    } catch (error: any) {
        console.error('Error discharging patient:', error);
        res.status(500).json({ error: error.message || 'Failed to discharge patient' });
    }
});

// --- FLOWSHEET ---

router.post('/:id/flowsheet', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { id: staffId } = req.user!;
        const { temperature, heartRate, respiratoryRate, notes, medicationsGiven, deductInventoryItems } = req.body;

        const entry = await prisma.$transaction(async (tx: any) => {
            const billedItems = [];

            // 1. Fetch prices, validate stock, and deduct inventory
            if (deductInventoryItems && Array.isArray(deductInventoryItems)) {
                for (const item of deductInventoryItems) {
                    if (item.id) {
                        const invItem = await tx.inventoryItem.findUnique({ where: { id: item.id } });
                        if (!invItem) continue;

                        const deductQty = Number(item.quantity || 1);

                        // Stock validation — prevent negative inventory
                        if (invItem.quantity < deductQty) {
                            throw new Error(`Insufficient stock for ${invItem.name}. Available: ${invItem.quantity}, Requested: ${deductQty}`);
                        }

                        billedItems.push({
                            itemId: invItem.id,
                            name: invItem.name,
                            quantity: deductQty,
                            price: Number(invItem.retailPrice || 0)
                        });

                        // Deduct actual quantity
                        await tx.inventoryItem.update({
                            where: { id: item.id },
                            data: { quantity: { decrement: deductQty } }
                        });
                    }
                }
            }

            const newEntry = await tx.flowsheetEntry.create({
                data: {
                    hospitalizationId: id,
                    staffId,
                    temperature,
                    heartRate,
                    respiratoryRate,
                    notes,
                    medicationsGiven, // JSON array of display strings
                    billedItems: billedItems.length > 0 ? billedItems : undefined
                },
                include: {
                    staff: { select: { id: true, name: true } }
                }
            });

            return newEntry;
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'HOSPITALIZATION', 'FLOWSHEET_ENTRY', 
                `Added flowsheet entry for hospitalization ${id}`, req.user.clinicId!, req.user.name);
        }

        res.status(201).json(entry);
    } catch (error: any) {
        console.error('Error creating flowsheet entry:', error);
        res.status(500).json({ error: error.message || 'Failed to add flowsheet entry' });
    }
});

router.get('/:id/flowsheet', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const entries = await prisma.flowsheetEntry.findMany({
            where: { hospitalizationId: id as string },
            include: { staff: { select: { id: true, name: true } } },
            orderBy: { time: 'desc' }
        });
        res.json(entries);
    } catch (error) {
        console.error('Error fetching flowsheet:', error);
        res.status(500).json({ error: 'Failed to fetch flowsheet' });
    }
});

// --- DAILY NOTES (SOAP) ---

router.post('/:id/notes', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { id: vetId } = req.user!;
        const { subjective, objective, assessment, plan, date } = req.body;

        const note = await prisma.hospitalizationNote.create({
            data: {
                hospitalizationId: id as string,
                vetId: vetId as string,
                date: date ? new Date(date) : new Date(),
                subjective,
                objective,
                assessment,
                plan
            },
            include: { vet: { select: { id: true, name: true } } }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'HOSPITALIZATION', 'SOAP_NOTE', 
                `Added clinical SOAP note for hospitalization ${id}`, req.user.clinicId!, req.user.name);
        }

        res.status(201).json(note);
    } catch (error) {
        console.error('Error adding daily note:', error);
        res.status(500).json({ error: 'Failed to add daily note' });
    }
});

router.get('/:id/notes', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const notes = await prisma.hospitalizationNote.findMany({
            where: { hospitalizationId: id as string },
            include: { vet: { select: { id: true, name: true } } },
            orderBy: { date: 'desc' }
        });
        res.json(notes);
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// --- PRESCRIPTIONS ---

router.post('/:id/prescriptions', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { id: vetId } = req.user!;
        const { drugName, dose, route, frequency, inventoryItemId } = req.body;

        const prescription = await prisma.hospitalizationPrescription.create({
            data: {
                hospitalizationId: id as string,
                vetId: vetId as string,
                drugName,
                dose,
                route,
                frequency,
                inventoryItemId
            },
            include: { vet: { select: { id: true, name: true } } }
        });
        res.status(201).json(prescription);
    } catch (error) {
        console.error('Error adding prescription:', error);
        res.status(500).json({ error: 'Failed to add prescription' });
    }
});

router.get('/:id/prescriptions', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const prescriptions = await prisma.hospitalizationPrescription.findMany({
            where: { hospitalizationId: id as string },
            include: { vet: { select: { id: true, name: true } } },
            orderBy: { datePrescribed: 'desc' }
        });
        res.json(prescriptions);
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        res.status(500).json({ error: 'Failed to fetch prescriptions' });
    }
});

router.put('/:id/prescriptions/:prescriptionId', authenticate, async (req: AuthRequest, res) => {
    try {
        const { prescriptionId } = req.params;
        const { status } = req.body;

        const prescription = await prisma.hospitalizationPrescription.update({
            where: { id: prescriptionId as string },
            data: { status }
        });
        res.json(prescription);
    } catch (error) {
        console.error('Error updating prescription:', error);
        res.status(500).json({ error: 'Failed to update prescription' });
    }
});

export default router;
