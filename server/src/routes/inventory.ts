import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();

const inventorySchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    quantity: z.number().int().min(0).optional().nullable(),
    minThreshold: z.number().int().min(0).optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    packaging: z.string().optional().nullable(),
    costPrice: z.number().min(0),
    wholesalePrice: z.number().min(0),
    retailPrice: z.number().min(0),
    imageUrl: z.string().optional().nullable(),
    showInClientPortal: z.boolean().optional().default(true),
    batchNumber: z.string().optional().nullable(),
    nafdacNumber: z.string().optional().nullable(),
    manufacturer: z.string().optional().nullable(),
    isControlled: z.boolean().optional().default(false),
    labelInstructions: z.string().optional().nullable()
});

const stockBatchSchema = z.object({
    itemId: z.string(),
    date: z.string(),
    quantity: z.number().int().min(1),
    note: z.string().optional().nullable()
});

// Get inventory stats (counts)
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const isAdmin = req.user?.isSuperAdmin;
        const where = isAdmin ? {} : { clinicId };

        const [totalCount] = await Promise.all([
            prisma.inventoryItem.count({ where })
        ]);

        // Fix for the fields.lte comparison (Prisma might need raw query for column vs column)
        // A cleaner way for clinic specific low stock:
        let lowStock;
        if (isAdmin) {
            lowStock = await prisma.$queryRaw`SELECT count(*)::int as count FROM inventory_items WHERE quantity <= "minThreshold"`;
        } else {
            lowStock = await prisma.$queryRaw`SELECT count(*)::int as count FROM inventory_items WHERE quantity <= "minThreshold" AND "clinicId" = ${clinicId}`;
        }

        res.json({
            total: totalCount,
            lowStock: (lowStock as any)[0].count
        });
    } catch (error) {
        console.error('Inventory stats error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory stats' });
    }
});

// Get inventory items (paginated)
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const search = req.query.search as string | undefined;

        const where: any = req.user?.isSuperAdmin ? {} : { clinicId: req.user?.clinicId as string };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { manufacturer: { contains: search, mode: 'insensitive' } }
            ];
        }

        const items = await prisma.inventoryItem.findMany({
            where,
            select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                quantity: true,
                minThreshold: true,
                retailPrice: true,
                manufacturer: true,
                imageUrl: true,
                isControlled: true,
                createdAt: true
            },
            take: limit,
            skip: skip,
            orderBy: { createdAt: 'desc' }
        });

        // Optimization: return a URL instead of base64
        const lightItems = items.map((item: any) => ({
            ...item,
            imageUrl: item.imageUrl ? `/inventory/${item.id}/image` : null
        }));

        res.json(lightItems);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

// Get image for inventory item
router.get('/:id/image', async (req, res) => {
    try {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: req.params.id as string },
            select: { imageUrl: true }
        });

        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (!item.imageUrl) return res.status(404).json({ error: 'No image found' });

        // Handle base64 image
        if (item.imageUrl.startsWith('data:image')) {
            const matches = item.imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const type = matches[1];
                const data = Buffer.from(matches[2], 'base64');
                res.set('Content-Type', type);
                res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
                return res.send(data);
            }
        }

        // Fallback or external URL
        res.redirect(item.imageUrl);
    } catch (error) {
        console.error('Image fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

// Get single item
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: req.params.id as string },
            include: {
                batches: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        // Security check for non-superadmins
        if (item && !req.user?.isSuperAdmin && item.clinicId !== req.user?.clinicId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json(item);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch item' });
    }
});

// Create inventory item
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.user?.clinicId && !req.user?.isSuperAdmin) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        const data = inventorySchema.parse(req.body);

        // Prioritize the authenticated user's clinicId unless they are a superadmin
        const clinicId = req.user?.isSuperAdmin && req.body.clinicId ? req.body.clinicId : req.user?.clinicId;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic ID is missing' });
        }

        // Generate defaults for optional fields that Prisma requires
        const finalData = {
            ...data,
            clinicId: clinicId,
            sku: data.sku || `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            quantity: data.quantity ?? 0,
            minThreshold: data.minThreshold ?? 0,
            category: data.category || 'Other',
            packaging: data.packaging || 'Other',
            wholesalePrice: data.wholesalePrice ?? 0,
        };

        const item = await prisma.inventoryItem.create({
            data: {
                clinicId: finalData.clinicId,
                name: finalData.name,
                description: finalData.description,
                sku: finalData.sku,
                quantity: finalData.quantity,
                minThreshold: finalData.minThreshold,
                expiryDate: finalData.expiryDate,
                category: finalData.category,
                packaging: finalData.packaging,
                costPrice: finalData.costPrice,
                wholesalePrice: finalData.wholesalePrice,
                retailPrice: finalData.retailPrice,
                imageUrl: finalData.imageUrl,
                showInClientPortal: finalData.showInClientPortal,
                batchNumber: finalData.batchNumber,
                nafdacNumber: finalData.nafdacNumber,
                manufacturer: finalData.manufacturer,
                isControlled: finalData.isControlled,
                labelInstructions: finalData.labelInstructions,
                batches: {
                    create: {
                        date: new Date().toISOString().split('T')[0],
                        quantity: finalData.quantity
                    }
                }
            },
            include: {
                batches: true
            }
        });

        // Log Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'INVENTORY', 'CREATE', `Created item: ${item.name} (SKU: ${item.sku}) with quantity ${item.quantity}`, req.user.clinicId || undefined, req.user.name);
        }

        res.status(201).json(item);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            console.error('Inventory validation error:', JSON.stringify(error.errors, null, 2));
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'SKU already exists in this clinic' });
        }
        console.error('Create inventory error:', error);
        res.status(500).json({ error: 'Failed to create item' });
    }
});

// Update inventory item
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const data = inventorySchema.parse(req.body);

        // Filter out undefined values to avoid issues with Prisma
        const updateData: any = {};
        Object.keys(data).forEach(key => {
            if (data[key as keyof typeof data] !== undefined) {
                updateData[key] = data[key as keyof typeof data];
            }
        });

        const item = await prisma.inventoryItem.update({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string },
            data: updateData,
            include: {
                batches: true
            }
        });

        // Log Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'INVENTORY', 'UPDATE', `Updated item: ${item.name}`, req.user.clinicId || undefined, req.user.name);
        }

        res.json(item);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// Add stock batch
router.post('/batch', authenticate, async (req: AuthRequest, res) => {
    try {
        const data = stockBatchSchema.parse(req.body);

        // Verify item belongs to same clinic
        if (!req.user?.isSuperAdmin) {
            const item = await prisma.inventoryItem.findFirst({
                where: { id: data.itemId, clinicId: req.user?.clinicId as string }
            });
            if (!item) {
                return res.status(403).json({ error: 'Item not found in your clinic' });
            }
        }

        const batch = await prisma.stockBatch.create({
            data: {
                itemId: data.itemId,
                date: data.date,
                quantity: data.quantity,
                note: data.note
            }
        });

        // Update item quantity
        await prisma.inventoryItem.update({
            where: { id: data.itemId },
            data: {
                quantity: {
                    increment: data.quantity
                }
            }
        });

        // Log Audit
        if (req.user?.id) {
            const item = await prisma.inventoryItem.findUnique({ where: { id: data.itemId } });
            await logAudit(req.user.id, 'INVENTORY', 'RESTOCK', `Added ${data.quantity} units to ${item?.name || 'Unknown item'}`, req.user.clinicId || undefined, req.user.name);
        }

        res.status(201).json(batch);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to add stock batch' });
    }
});

// Delete inventory item - Admin Only
router.delete('/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const existingItem = await prisma.inventoryItem.findFirst({
            where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
        });

        await prisma.inventoryItem.delete({
            where: { id: req.params.id as string }
        });

        // Log Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'INVENTORY', 'DELETE', `Deleted item: ${existingItem?.name || 'Unknown item'}`, req.user.clinicId || undefined, req.user.name);
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

export default router;
