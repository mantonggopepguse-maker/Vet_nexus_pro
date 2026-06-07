import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { NotificationService } from '../services/notificationService.js';

const router = express.Router();

// Rate limiting to prevent abuse
// Allows up to 5 requests per minute from a single IP
const reminderLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: { error: 'Too many requests for reminder processing.' }
});

// Define the Cloud Scheduler trigger point
// Can be called via GET /api/trigger-reminders
router.get('/', reminderLimiter, async (req, res) => {
    try {
        console.log('External trigger received for reminder processing.');
        // Don't await directly if it shouldn't block the response, but
        // for small queues awaiting is safer for Cloud Run lifecycle.
        await NotificationService.processReminders();

        res.json({ success: true, message: 'Reminders processed successfully.' });
    } catch (error) {
        console.error('Error triggered by external reminder invocation:', error);
        res.status(500).json({ error: 'Failed to process reminders.' });
    }
});

export default router;
