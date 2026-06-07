import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();

const auditLogSchema = z.object({
    reason: z.string().min(1)
});

const invoiceNumberSchema = z.string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, 'Invoice number can only contain letters, numbers, slash, underscore, or hyphen');

const normalizeInvoiceNumber = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return invoiceNumberSchema.parse(trimmed);
};

const isUniqueConstraintError = (error: any) => error?.code === 'P2002';

const resolveInvoiceNumber = async (tx: any, clinicId: string, requestedInvoiceNumber: string | null) => {
    if (requestedInvoiceNumber) {
        const existing = await tx.sale.findFirst({
            where: { clinicId, invoiceNumber: requestedInvoiceNumber },
            select: { id: true }
        });
        if (existing) {
            const error: any = new Error(`Invoice number "${requestedInvoiceNumber}" is already in use.`);
            error.statusCode = 409;
            throw error;
        }
        return requestedInvoiceNumber;
    }

    const clinic = await tx.clinic.findUnique({ where: { id: clinicId }, select: { acronym: true } });
    const acronym = clinic?.acronym || 'VET';
    const count = await tx.sale.count({ where: { clinicId } });

    for (let offset = 1; offset <= 1000; offset++) {
        const candidate = `${(count + offset).toString().padStart(5, '0')}/${acronym}`;
        const existing = await tx.sale.findFirst({
            where: { clinicId, invoiceNumber: candidate },
            select: { id: true }
        });
        if (!existing) return candidate;
    }

    throw new Error('Could not generate a unique invoice number.');
};

// Get all sales (paginated)
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const clientId = req.query.clientId as string | undefined;

        const where: any = req.user?.isSuperAdmin ? {} : { clinicId: req.user?.clinicId as string };
        if (clientId) {
            where.clientId = clientId;
        }

        const sales = await prisma.sale.findMany({
            where,
            take: limit,
            skip: skip,
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    include: {
                        item: true
                    }
                },
                payments: true
            }
        });
        res.json(sales);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// Get single sale
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const sale = await prisma.sale.findUnique({
            where: { id: req.params.id as string },
            include: {
                items: {
                    include: {
                        item: true
                    }
                },
                payments: true
            }
        });

        if (sale && !req.user?.isSuperAdmin && sale.clinicId !== req.user?.clinicId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        res.json(sale);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sale' });
    }
});

// Create sale
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.user?.clinicId && !req.user?.isSuperAdmin) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        const { items, type, clientId, issuerId, issuerName, clientName, amountPaid, balanceDue, invoiceNumber: rawInvoiceNumber, payments: payloadPayments, ...data } = req.body;
        const requestedInvoiceNumber = normalizeInvoiceNumber(rawInvoiceNumber);

        // Log the sanitized data to confirm fix
        console.log('Processing sale:', {
            type,
            clientId,
            itemCount: items?.length,
            clientName,
            amountPaid,
            balanceDue
        });

        // Validate items array
        if (!items || !Array.isArray(items) || items.length === 0) {
            console.error('Invalid items array:', { items, bodyKeys: Object.keys(req.body) });
            return res.status(400).json({ error: 'Items array is required and must not be empty' });
        }

        // Validate each item
        for (const item of items) {
            const itemId = item.itemId || item.id;
            const itemName = item.name || item.description;
            if (!itemId && !itemName) {
                console.error('Item missing ID and Name:', item);
                return res.status(400).json({ error: 'Each item must have an itemId/id or a name/description' });
            }
        }

        // Lock down clinicId: ONLY superadmins can specify a different clinicId in the body
        const targetClinicId = req.user?.isSuperAdmin && req.body.clinicId
            ? req.body.clinicId
            : req.user?.clinicId as string;

        // Sanitize clientId: convert "" to null
        let sanitizedClientId = clientId && clientId.trim() !== "" ? clientId : null;

        // Verify Client Exists (to prevent FK error)
        if (sanitizedClientId) {
            const clientExists = await prisma.client.findUnique({ where: { id: sanitizedClientId } });
            if (!clientExists) {
                console.warn(`Client ${sanitizedClientId} not found. converting to guest sale.`);
                sanitizedClientId = null;
            }
        }

        // --- Prevent Duplicate Sales (Idempotency Check) ---
        // Check for an identical sale from the same clinic in the last 60 seconds
        const recentDuplicate = await prisma.sale.findFirst({
            where: {
                clinicId: targetClinicId,
                total: parseFloat(req.body.total),
                clientId: sanitizedClientId,
                createdAt: {
                    gte: new Date(Date.now() - 60 * 1000) // 60 seconds window
                }
            },
            include: {
                items: true
            }
        });

        if (recentDuplicate) {
            // Compare items to be sure
            const isExactlySame = recentDuplicate.items.length === items.length &&
                recentDuplicate.items.every((ri: any) =>
                    items.find((i: any) =>
                        (i.itemId || i.id) === ri.itemId &&
                        (parseInt(i.quantity) || 1) === ri.quantity
                    )
                );

            if (isExactlySame) {
                console.warn('Duplicate sale detected, rejecting request');
                return res.status(409).json({
                    error: 'A duplicate sale was detected. If you intended to make a new sale, please wait a minute or change the items.'
                });
            }
        }
        // ----------------------------------------------------

        let result: any = null;
        const maxAttempts = requestedInvoiceNumber ? 1 : 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                result = await prisma.$transaction(async (tx: any) => {
                    const invoiceNumber = await resolveInvoiceNumber(tx, targetClinicId, requestedInvoiceNumber);

                // 0. Inventory Validation & Total Calculation
                let serverCalculatedTotal = 0;

                for (const item of items) {
                    const itemId = item.itemId || item.id;
                    const requestedQty = parseInt(item.quantity) || 1;

                    // Freestyle items (no itemId) - trust the payload price but validate logic
                    if (!itemId) {
                        const unitPrice = parseFloat(item.pricePerUnit || item.price || item.unitPrice || 0);
                        serverCalculatedTotal += unitPrice * requestedQty;
                        continue;
                    }

                    const inventoryItem = await tx.inventoryItem.findUnique({ where: { id: itemId } });

                    if (!inventoryItem) {
                        throw new Error(`Item "${item.name || itemId}" not found in inventory.`);
                    }

                    if (inventoryItem.quantity < requestedQty) {
                        throw new Error(`Insufficient stock for "${inventoryItem.name}". Available: ${inventoryItem.quantity}, Requested: ${requestedQty}`);
                    }

                    // For inventory items, we should arguably use the DB price, but the POS might allow overrides. 
                    // For now, let's minimally ensure the payload total matches the sum of line items.
                    const unitPrice = parseFloat(item.pricePerUnit || item.price || item.unitPrice || inventoryItem.retailPrice || 0);
                    serverCalculatedTotal += unitPrice * requestedQty;
                }

                // Lookup Procedures for missing IDs based on name matching (BACKWARD COMPATIBILITY + NEW LOGIC)
                // If the frontend sends procedureId, we use it. If not, we try to find it.
                // We do this inside the transaction or before. Better inside to keep consistent.
                const procedureMap = new Map<string, string>(); // name -> id
                const procedures = await tx.procedure.findMany({ where: { clinicId: targetClinicId } });

                // Wait, map is better
                const procedureNameMap = new Map<string, string>();
                procedures.forEach((p: any) => procedureNameMap.set(p.name.toLowerCase(), p.id));

                // Prepare items with procedureId 
                const preparedItems = items.map((item: any) => {
                    const name = item.name || item.description || '';
                    const lowerName = name.toLowerCase();
                    let foundProcedureId = null;

                    if (item.procedureId) foundProcedureId = item.procedureId;
                    else if (!item.itemId && procedureNameMap.has(lowerName)) {
                        foundProcedureId = procedureNameMap.get(lowerName);
                    }

                    return {
                        ...item,
                        procedureId: foundProcedureId
                    };
                });

                // Validate Total (allowing small float diff)
                const payloadTotal = parseFloat(req.body.total);
                const discount = parseFloat(req.body.discount) || 0;
                const tax = parseFloat(req.body.tax) || 0;
                const expectedTotal = (serverCalculatedTotal - discount) + tax;

                if (Math.abs(payloadTotal - expectedTotal) > 0.5) { // Loosened to 0.5 for rounding/override safety
                    console.error('CRITICAL: Total mismatch blocked sale creation:', {
                        serverCalculatedTotal,
                        tax,
                        discount,
                        expectedTotal,
                        payloadTotal,
                        diff: Math.abs(payloadTotal - expectedTotal)
                    });
                    throw new Error(`Payment verification failed. Please refresh and try again. (Validation mismatch: ${payloadTotal} vs ${expectedTotal})`);
                } else if (Math.abs(payloadTotal - expectedTotal) > 0) {
                    console.warn(`Minor total mismatch allowed: Payload ${payloadTotal}, Server ${expectedTotal}`);
                }
                
                // Set sale status dynamically
                const parsedBalanceDue = parseFloat(balanceDue) || 0;
                let saleStatus = 'Completed';
                if (type === 'INVOICE' && parsedBalanceDue > 0.05) {
                    saleStatus = 'Pending';
                }

                // Prepare payments array
                let paymentsCreateData: any = undefined;
                if (payloadPayments && Array.isArray(payloadPayments) && payloadPayments.length > 0) {
                    paymentsCreateData = {
                        create: payloadPayments.map((p: any) => ({
                            amount: parseFloat(p.amount),
                            method: p.method || 'Cash',
                            recordedBy: issuerName || 'System'
                        }))
                    };
                } else if (parseFloat(amountPaid) > 0) {
                    paymentsCreateData = {
                        create: {
                            amount: parseFloat(amountPaid),
                            method: req.body.paymentMethod || 'Cash',
                            recordedBy: issuerName || 'System',
                        }
                    };
                }

                // 1. Create the Sale
                const sale = await tx.sale.create({
                    data: {
                        ...data,
                        invoiceNumber,
                        type,
                        status: saleStatus,
                        clinicId: targetClinicId,
                        clientId: sanitizedClientId,
                        clientName: clientName || null,
                        amountPaid: parseFloat(amountPaid) || 0,
                        balanceDue: parsedBalanceDue,
                        issuerName: issuerName || null,
                        paymentMethod: payloadPayments && payloadPayments.length > 0 ? 'SPLIT' : (req.body.paymentMethod || 'Cash'), // Keep for legacy compat
                        items: {
                            create: preparedItems.map((item: any) => ({
                                itemId: item.itemId || item.id || null,
                                procedureId: item.procedureId || null,
                                name: item.name || item.description || null,
                                quantity: parseInt(item.quantity) || 1,
                                pricePerUnit: parseFloat(item.pricePerUnit || item.price || item.unitPrice || 0)
                            }))
                        },
                        payments: paymentsCreateData
                    },
                    include: { items: { include: { item: true } }, payments: true }
                });

                // 2. Update Inventory (Only for items with itemId)
                for (const item of items) {
                    const inventoryId = item.itemId || item.id;
                    if (!inventoryId) continue; // Skip for freestyle

                    await tx.inventoryItem.update({
                        where: { id: inventoryId },
                        data: {
                            quantity: { decrement: parseInt(item.quantity) || 1 },
                            sales: { increment: parseInt(item.quantity) || 1 }
                        }
                    });
                }

                return sale;
                }, {
                    maxWait: 10000,
                    timeout: 30000
                });
                break;
            } catch (txError: any) {
                if (!requestedInvoiceNumber && isUniqueConstraintError(txError) && attempt < maxAttempts) {
                    console.warn(`Invoice number collision on attempt ${attempt}; retrying sale creation.`);
                    continue;
                }
                console.error('Transaction failed:', txError);
                throw txError;
            }
        }

        if (!result) {
            throw new Error('Failed to create sale after retrying invoice number generation.');
        }

        // Log Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'SALES', 'CREATE', `Created ${result.type} #${result.invoiceNumber} for total ${result.total}`);
        }

        res.status(201).json(result);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid invoice number', details: error.errors });
        }
        if (error.statusCode === 409) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Sale creation error details:', {
            message: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(500).json({ error: 'Failed to create sale', details: error.message });
    }
});

// Void Sale
router.put('/:id/void', authenticate, async (req: AuthRequest, res) => {
    try {
        const { reason } = auditLogSchema.parse(req.body);
        const sale = await prisma.sale.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string },
            include: { items: true }
        });

        if (!sale) return res.status(404).json({ error: 'Sale not found' });
        if (sale.status === 'Voided') return res.status(400).json({ error: 'Sale already voided' });

        await prisma.$transaction(async (tx: any) => { // Type as any to avoid complex nested types issues
            // Restore Inventory
            for (const item of sale.items) {
                if (!item.itemId) continue; // Skip freestyle
                await tx.inventoryItem.update({
                    where: { id: item.itemId },
                    data: {
                        quantity: { increment: item.quantity },
                        sales: { decrement: item.quantity }
                    }
                });
            }

            // Update Sale Status
            await tx.sale.update({
                where: { id: sale.id },
                data: { status: 'Voided' }
            });

            // Create Audit Log
            await tx.auditLog.create({
                data: {
                    clinicId: sale.clinicId,
                    userId: req.user?.id as string,
                    userName: req.user?.name as string,
                    module: 'Sales',
                    action: 'Void Transaction',
                    details: `Voided ${sale.type} #${sale.invoiceNumber}. Reason: ${reason}`
                }
            });
        });

        res.json({ message: 'Transaction voided successfully' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Reason is required', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to void transaction' });
    }
});

// Delete Sale (Hard Delete with Log) - Admin Only
router.delete('/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        // We expect reason in body for DELETE? Standard REST usually doesn't involve body in DELETE, but axios supports it.
        // Alternatively we can use query param or a custom header, or just allow it without reason?
        // User asked for "delete(with reasons d save in log)".
        // I'll grab reason from body (some clients strip body on DELETE) or query param as fallback.
        const reason = (req.body.reason || req.query.reason) as string;

        if (!reason) {
            return res.status(400).json({ error: 'Reason is required for deletion' });
        }

        const sale = await prisma.sale.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string },
            include: { items: true }
        });

        if (!sale) return res.status(404).json({ error: 'Sale not found' });

        await prisma.$transaction(async (tx: any) => {
            // Restore Inventory if the sale wasn't already voided or deleted
            if (sale.status !== 'Voided' && sale.status !== 'Deleted') {
                for (const item of sale.items) {
                    if (!item.itemId) continue; // Skip freestyle
                    await tx.inventoryItem.update({
                        where: { id: item.itemId },
                        data: {
                            quantity: { increment: item.quantity },
                            sales: { decrement: item.quantity }
                        }
                    });
                }
            }

            await tx.auditLog.create({
                data: {
                    clinicId: sale.clinicId,
                    userId: req.user?.id as string,
                    userName: req.user?.name as string,
                    module: 'Sales',
                    action: 'Delete Transaction',
                    details: `Deleted ${sale.type} #${sale.invoiceNumber}. Reason: ${reason}`
                }
            });

            // Soft delete by updating status
            await tx.sale.update({
                where: { id: sale.id },
                data: { status: 'Deleted' }
            });
        });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

// Pay Invoice (Convert to Receipt)
router.post('/:id/pay', authenticate, async (req: AuthRequest, res) => {
    try {
        const sale = await prisma.sale.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });

        if (!sale) return res.status(404).json({ error: 'Sale not found' });
        if (sale.type !== 'INVOICE') return res.status(400).json({ error: 'Transaction is not an invoice' });
        const paymentAmount = parseFloat(req.body.amount);
        const method = req.body.paymentMethod || 'Cash';

        // Validations
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return res.status(400).json({ error: 'Invalid payment amount' });
        }

        if (paymentAmount > sale.balanceDue + 0.05) {
            return res.status(400).json({ error: 'Payment amount cannot exceed balance due' });
        }

        const newAmountPaid = (sale.amountPaid || 0) + paymentAmount;
        let newBalanceDue = sale.total - newAmountPaid;

        // Float precision fix
        newBalanceDue = Math.round(newBalanceDue * 100) / 100;

        let newStatus = sale.status;
        if (newBalanceDue <= 0.05) { // Tolerance for float errors
            newBalanceDue = 0;
            newStatus = 'Completed';
        }

        const updated = await prisma.sale.update({
            where: { id: sale.id },
            data: {
                status: newStatus,
                amountPaid: newAmountPaid,
                balanceDue: newBalanceDue,
                payments: {
                    create: {
                        amount: paymentAmount,
                        method: method,
                        reference: req.body.reference || null,
                        recordedBy: req.user?.name || 'System'
                    }
                }
            },
            include: { items: { include: { item: true } }, payments: true }
        });

        await prisma.auditLog.create({
            data: {
                clinicId: sale.clinicId,
                userId: req.user?.id as string,
                userName: req.user?.name as string,
                module: 'Sales',
                action: 'Payment',
                details: `Received payment of ${paymentAmount} for invoice #${sale.invoiceNumber}. New Balance: ${newBalanceDue}`
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({ error: 'Failed to process payment' });
    }
});

export default router;
