import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Global search across clients, patients, and inventory
router.get('/', authenticate, async (req: any, res) => {
    try {
        const { q } = req.query;
        const clinicId = req.user.clinicId;

        if (!q || typeof q !== 'string') {
            return res.json({ clients: [], patients: [], inventory: [] });
        }

        const searchTerm = q.toLowerCase();

        // Search in parallel for performance
        const [clients, patients, inventory] = await Promise.all([
            // Search Clients
            prisma.client.findMany({
                where: {
                    clinicId,
                    OR: [
                        { firstName: { contains: searchTerm, mode: 'insensitive' } },
                        { lastName: { contains: searchTerm, mode: 'insensitive' } },
                        { phone: { contains: searchTerm, mode: 'insensitive' } },
                        { email: { contains: searchTerm, mode: 'insensitive' } },
                    ],
                },
                take: 5,
                select: { id: true, firstName: true, lastName: true, phone: true },
            }),

            // Search Patients (Patient)
            prisma.patient.findMany({
                where: {
                    owner: { clinicId },
                    OR: [
                        { name: { contains: searchTerm, mode: 'insensitive' } },
                        { species: { contains: searchTerm, mode: 'insensitive' } },
                        { breed: { contains: searchTerm, mode: 'insensitive' } },
                    ],
                },
                take: 5,
                select: { id: true, name: true, species: true, breed: true, ownerId: true },
            }),

            // Search Inventory
            prisma.inventoryItem.findMany({
                where: {
                    clinicId,
                    OR: [
                        { name: { contains: searchTerm, mode: 'insensitive' } },
                        { sku: { contains: searchTerm, mode: 'insensitive' } },
                        { description: { contains: searchTerm, mode: 'insensitive' } },
                    ],
                },
                take: 5,
                select: { id: true, name: true, sku: true, quantity: true, retailPrice: true, imageUrl: true },
            }),
        ]);

        const mappedInventory = inventory.map((item: any) => ({
            ...item,
            imageUrl: item.imageUrl ? `/inventory/${item.id}/image` : null
        }));

        res.json({
            clients,
            patients,
            inventory: mappedInventory,
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;
