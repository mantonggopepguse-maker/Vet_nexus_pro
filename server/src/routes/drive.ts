import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { driveService } from '../services/driveService.js';
import { prisma } from '../db.js';
import multer from 'multer';

const router = Router();
const upload = multer(); // Memory storage

// Initiate OAuth Flow
router.get('/auth', authenticate, (req: AuthRequest, res) => {
    if (!req.user?.isSuperAdmin) {
        // Only admins can connect drive? Or any vet? Usually admin.
        // Let's allow if user has permission.
    }
    const url = driveService.getAuthUrl();
    res.json({ url });
});

// Callback
router.post('/callback', authenticate, async (req: AuthRequest, res) => {
    try {
        const { code } = req.body;
        if (!req.user?.clinicId) return res.status(400).json({ error: 'No clinic ID' });

        await driveService.handleCallback(code, req.user.clinicId);
        res.json({ success: true });
    } catch (error) {
        console.error('Drive auth error:', error);
        res.status(500).json({ error: 'Failed to authenticate with Drive' });
    }
});

// Upload File
router.post('/upload', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file || !req.user?.clinicId) return res.status(400).json({ error: 'Missing file or clinic' });

        // Optional linking
        const { patientId, clientId } = req.body;

        const result = await driveService.uploadFile(
            req.user.clinicId,
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        // Construct a usable URL. 
        // Drive webViewLink is for viewing in Drive UI.
        // We might want a direct link suitable for <img> tags.
        // Google Drive 'webContentLink' often forces download. 
        // A common workaround is `https://drive.google.com/uc?id=${result.id}`
        const webUrl = `https://drive.google.com/uc?export=view&id=${result.id}`;

        // Create Media record
        const media = await prisma.media.create({
            data: {
                type: req.file.mimetype.startsWith('image/') ? 'Image' : 'Document',
                url: webUrl,
                name: req.file.originalname,
                size: req.file.size,
                patientId: patientId || null,
                clientId: clientId || null,
            }
        });

        res.json({ ...result, webUrl, media });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Delete File
router.delete('/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        if (!req.user?.clinicId) return res.status(400).json({ error: 'Missing clinic context' });

        // Find the media record
        const media = await prisma.media.findUnique({
            where: { id: id as string }
        });

        if (!media) {
            return res.status(404).json({ error: 'Media record not found' });
        }

        // Extract fileId from URL if it's a Drive URL
        // Format: https://drive.google.com/uc?export=view&id=FILE_ID
        const urlParams = new URLSearchParams(media.url.split('?')[1]);
        const fileId = urlParams.get('id');

        if (fileId) {
            try {
                await driveService.deleteFile(req.user.clinicId, fileId);
            } catch (driveError) {
                console.error('Failed to delete from Drive, but proceeding with database deletion:', driveError);
            }
        }

        // Delete from database
        await prisma.media.delete({
            where: { id: id as string }
        });

        res.status(204).send();
    } catch (error) {
        console.error('Delete media error:', error);
        res.status(500).json({ error: 'Failed to delete media' });
    }
});

export default router;
