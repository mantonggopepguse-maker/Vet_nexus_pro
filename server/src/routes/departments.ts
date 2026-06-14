import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all active departments for the clinic
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const departments = await prisma.department.findMany({
            where: { clinicId, isActive: true },
            orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        });
        res.json(departments);
    } catch (error) {
        console.error('Failed to fetch departments:', error);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
});

// Ensure default department exists (idempotent)
router.post('/ensure-default', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        let defaultDept = await prisma.department.findFirst({
            where: { clinicId, isDefault: true },
        });
        if (!defaultDept) {
            defaultDept = await prisma.department.create({
                data: { clinicId, name: 'General Clinic', isDefault: true, sortOrder: 0 },
            });
        }
        res.json(defaultDept);
    } catch (error) {
        console.error('Failed to ensure default department:', error);
        res.status(500).json({ error: 'Failed to ensure default department' });
    }
});

// Create a department
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { name, description, sortOrder } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Department name is required' });
        const dept = await prisma.department.create({
            data: { clinicId, name: name.trim(), description: description || null, sortOrder: sortOrder ?? 0 },
        });
        res.status(201).json(dept);
    } catch (error: any) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'Department name already exists' });
        console.error('Failed to create department:', error);
        res.status(500).json({ error: 'Failed to create department' });
    }
});

// Update a department
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;
        const { name, description, sortOrder, isActive } = req.body;
        const existing = await prisma.department.findFirst({ where: { id, clinicId } });
        if (!existing) return res.status(404).json({ error: 'Department not found' });
        const dept = await prisma.department.update({
            where: { id },
            data: {
                name: name !== undefined ? name.trim() : undefined,
                description: description !== undefined ? description : undefined,
                sortOrder: sortOrder !== undefined ? sortOrder : undefined,
                isActive: isActive !== undefined ? isActive : undefined,
            },
        });
        res.json(dept);
    } catch (error: any) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'Department name already exists' });
        console.error('Failed to update department:', error);
        res.status(500).json({ error: 'Failed to update department' });
    }
});

// Delete (soft-delete) a department
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;
        const existing = await prisma.department.findFirst({ where: { id, clinicId } });
        if (!existing) return res.status(404).json({ error: 'Department not found' });
        if (existing.isDefault) return res.status(400).json({ error: 'Cannot delete the default department' });
        await prisma.department.update({ where: { id }, data: { isActive: false } });
        res.json({ message: 'Department deactivated' });
    } catch (error) {
        console.error('Failed to delete department:', error);
        res.status(500).json({ error: 'Failed to delete department' });
    }
});

export default router;
