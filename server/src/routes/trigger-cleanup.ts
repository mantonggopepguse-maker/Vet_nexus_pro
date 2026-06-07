import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db.js';

const router = express.Router();

// Rate limiting to prevent abuse
// Allows up to 5 requests per minute from a single IP
const cleanupLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: { error: 'Too many requests for cleanup processing.' }
});

// Define the Cloud Scheduler trigger point
// Can be called via GET /api/trigger-cleanup
router.get('/', cleanupLimiter, async (req, res) => {
    try {
        console.log('External trigger received for pending registrations cleanup.');
        
        // Calculate the threshold time: 24 hours ago
        const thresholdDate = new Date();
        thresholdDate.setHours(thresholdDate.getHours() - 24);

        // Delete all pending registrations older than 24 hours
        // We also clean up entries that are 'completed' or 'failed' to keep the table clean
        const result = await prisma.pendingRegistration.deleteMany({
            where: {
                createdAt: {
                    lt: thresholdDate
                }
            }
        });

        console.log(`Cleanup complete: Removed ${result.count} stale pending registrations.`);

        res.json({ 
            success: true, 
            message: 'Stale registrations cleaned up successfully.',
            deletedCount: result.count
        });
    } catch (error) {
        console.error('Error triggered by external cleanup invocation:', error);
        res.status(500).json({ error: 'Failed to process cleanup.' });
    }
});

export default router;
