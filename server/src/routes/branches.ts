import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/branches - Get all branches for the current clinic
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId } = req.user!;
        
        // Find branches where parentClinicId is the user's clinicId
        // Also include the clinic itself maybe? No, just branches.
        const branches = await prisma.clinic.findMany({
            where: { parentClinicId: clinicId },
            include: {
                subscription: { include: { plan: true } },
                _count: {
                    select: { users: true, clients: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        
        res.json(branches);
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

// POST /api/branches - Create a new branch
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId: parentId } = req.user!;
        const { name, acronym, address, phone, currencySymbol } = req.body;

        // Check if the current subscription includes multi-branch support
        const parentClinic = await prisma.clinic.findUnique({
            where: { id: parentId },
            include: { subscription: { include: { plan: true } } }
        });

        if (!parentClinic) {
            return res.status(404).json({ error: 'Parent clinic not found' });
        }

        const hasMultiBranch = Boolean(
            (parentClinic?.subscription?.plan?.features as Record<string, boolean> | undefined)?.multiBranch
        );

        if (!hasMultiBranch) {
            return res.status(403).json({ error: 'Branch creation is not included in the clinic subscription plan' });
        }

        // Create the new clinic branch
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 7);
        
        const branch = await prisma.clinic.create({
            data: {
                name,
                slug,
                acronym,
                address,
                phone,
                currencySymbol: currencySymbol || parentClinic.currencySymbol,
                parentClinicId: parentId,
                status: 'Active'
            }
        });

        // Initialize free subscription for the branch or follow parent?
        // Usually branches share the parent's subscription or have their own.
        // For simplicity, let's just create the clinic.

        res.status(201).json(branch);
    } catch (error) {
        console.error('Error creating branch:', error);
        res.status(500).json({ error: 'Failed to create branch' });
    }
});

// PUT /api/branches/:id
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId: parentId } = req.user!;
        const { id } = req.params;

        const branch = await prisma.clinic.findFirst({
            where: { id: id as string, parentClinicId: parentId }
        });
        
        if (!branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        const updated = await prisma.clinic.update({
            where: { id: id as string },
            data: { 
                name: req.body.name, 
                acronym: req.body.acronym,
                address: req.body.address, 
                phone: req.body.phone 
            }
        });
        res.json(updated);
    } catch (error) {
        console.error('Error updating branch:', error);
        res.status(500).json({ error: 'Failed to update branch' });
    }
});

// DELETE /api/branches/:id (soft-delete by setting status)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { clinicId: parentId } = req.user!;
        const { id } = req.params;

        const branch = await prisma.clinic.findFirst({
            where: { id: id as string, parentClinicId: parentId }
        });
        
        if (!branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        await prisma.clinic.update({
            where: { id: id as string },
            data: { status: 'Inactive' }
        });
        res.json({ message: 'Branch deactivated' });
    } catch (error) {
        console.error('Error deleting branch:', error);
        res.status(500).json({ error: 'Failed to delete branch' });
    }
});

export default router;
