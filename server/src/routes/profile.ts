import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Get current user profile
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user?.id },
            include: {
                clinic: {
                    include: {
                        subscription: {
                            include: {
                                plan: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username,
            roles: user.roles,
            avatarUrl: user.avatarUrl,
            clinicId: user.clinicId,
            isSuperAdmin: user.isSuperAdmin,
            clinic: user.clinic
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update avatar
router.post('/avatar', authenticate, async (req: AuthRequest, res) => {
    try {
        const { avatarUrl } = z.object({ avatarUrl: z.string() }).parse(req.body);

        const user = await prisma.user.update({
            where: { id: req.user?.id },
            data: { avatarUrl },
            select: {
                id: true,
                avatarUrl: true
            }
        });

        res.json(user);
    } catch (error) {
        console.error('Avatar update error:', error);
        res.status(500).json({ error: 'Failed to update avatar' });
    }
});

// Get avatar image (if stored as base64 or internal ref)
router.get('/:id/avatar', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { avatarUrl: true }
        });

        if (!user || !user.avatarUrl) return res.status(404).json({ error: 'Avatar not found' });

        if (user.avatarUrl.startsWith('data:image')) {
            const matches = user.avatarUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const type = matches[1];
                const data = Buffer.from(matches[2], 'base64');
                res.set('Content-Type', type);
                res.set('Cache-Control', 'public, max-age=86400');
                return res.send(data);
            }
        }

        res.redirect(user.avatarUrl);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch avatar' });
    }
});

// Update narcotics PIN
router.post('/pin', authenticate, async (req: AuthRequest, res) => {
    try {
        const { pin } = z.object({ pin: z.string().length(4) }).parse(req.body);

        await prisma.user.update({
            where: { id: req.user?.id },
            data: { controlledPin: pin }
        });

        res.json({ message: 'PIN updated successfully' });
    } catch (error) {
        console.error('PIN update error:', error);
        res.status(500).json({ error: 'Failed to update PIN' });
    }
});

// Delete account (user profile or entire clinic)
router.delete('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id;
        const clinicId = req.user?.clinicId;
        const deleteClinic = req.body?.deleteClinic === true;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (deleteClinic) {
            // Check if user is Admin or Super Admin
            const isAdmin = req.user?.roles?.includes('Admin') || req.user?.isSuperAdmin;
            if (!isAdmin) {
                return res.status(403).json({ error: 'Only admins can delete the entire clinic account' });
            }

            if (!clinicId) {
                return res.status(400).json({ error: 'No clinic associated with this account' });
            }

            // Permanently delete the clinic and all cascade entities via Prisma
            await prisma.clinic.delete({
                where: { id: clinicId }
            });

            return res.json({ message: 'Clinic and all associated data permanently deleted' });
        } else {
            // Standard user profile deletion.
            // If they are an Admin, verify there is at least one other Admin remaining
            if (req.user?.roles?.includes('Admin') && clinicId) {
                const adminsCount = await prisma.user.count({
                    where: {
                        clinicId,
                        roles: {
                            has: 'Admin'
                        }
                    }
                });
                if (adminsCount <= 1) {
                    return res.status(400).json({ 
                        error: 'You are the only Admin in this clinic. You must promote another user to Admin or purge the clinic instead.' 
                    });
                }
            }

            await prisma.user.delete({
                where: { id: userId }
            });

            return res.json({ message: 'Personal profile deleted successfully' });
        }
    } catch (error: any) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete account' });
    }
});

export default router;
