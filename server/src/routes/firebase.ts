import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { FieldValue, getFirebaseFirestore, getFirebaseMessaging } from '../services/firebaseAdmin.js';

const router = Router();

const tokenSchema = z.object({
    token: z.string().min(20),
    platform: z.string().optional(),
});

const tokenDocId = (token: string) => Buffer.from(token).toString('base64url');

router.post('/fcm-token', authenticate, async (req: AuthRequest, res) => {
    try {
        const { token, platform } = tokenSchema.parse(req.body);
        const db = getFirebaseFirestore();

        await db.collection('fcmTokens').doc(tokenDocId(token)).set({
            token,
            platform: platform || 'web',
            userId: req.user?.id,
            userEmail: req.user?.email,
            clinicId: req.user?.clinicId || null,
            isSuperAdmin: !!req.user?.isSuperAdmin,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        res.json({ message: 'Notification device saved' });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid notification token', details: error.errors });
        }
        console.error('Failed to save FCM token:', error);
        res.status(500).json({ error: 'Could not save notification device' });
    }
});

router.post('/notifications/test', authenticate, async (req: AuthRequest, res) => {
    try {
        const db = getFirebaseFirestore();
        const tokenSnapshot = await db.collection('fcmTokens')
            .where('userId', '==', req.user?.id)
            .limit(10)
            .get();

        const tokens = tokenSnapshot.docs
            .map(doc => doc.data().token)
            .filter((token): token is string => typeof token === 'string' && token.length > 20);

        if (!tokens.length) {
            return res.status(404).json({ error: 'No notification device found for this user' });
        }

        const response = await getFirebaseMessaging().sendEachForMulticast({
            tokens,
            notification: {
                title: 'Vet Nexus notifications are ready',
                body: 'This device can now receive clinic alerts.',
            },
            webpush: {
                notification: {
                    icon: '/pwa-192x192.png',
                    badge: '/pwa-192x192.png',
                },
            },
        });

        if (response.failureCount > 0) {
            const tokensToRemove: Promise<any>[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error) {
                    const code = resp.error.code;
                    if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
                        const token = tokens[idx];
                        tokensToRemove.push(db.collection('fcmTokens').doc(tokenDocId(token)).delete());
                    }
                }
            });
            if (tokensToRemove.length > 0) {
                await Promise.all(tokensToRemove);
            }
        }

        res.json({
            message: 'Test notification sent',
            successCount: response.successCount,
            failureCount: response.failureCount,
        });
    } catch (error) {
        console.error('Failed to send test notification:', error);
        res.status(500).json({ error: 'Could not send test notification' });
    }
});

export default router;
