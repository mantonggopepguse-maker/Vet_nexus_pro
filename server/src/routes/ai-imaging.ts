import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { driveService } from '../services/driveService.js';

const router = Router();


// POST /api/ai-imaging/analyze
// Analyze a single clinical image or radiograph
router.post('/analyze', authenticate, async (req: AuthRequest, res) => {
    try {
        const { mediaId } = req.body;
        if (!mediaId) return res.status(400).json({ error: 'Media ID is required' });

        const media = await prisma.media.findUnique({
            where: { id: mediaId }
        });

        if (!media || !media.url) {
            return res.status(404).json({ error: 'Media record not found' });
        }

        if (media.type !== 'Image') {
            return res.status(400).json({ error: 'Media is not an image' });
        }

        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(401).json({ error: 'Clinic context missing' });

        // Extract fileId from Drive URL
        const urlParams = new URLSearchParams(media.url.split('?')[1]);
        const fileId = urlParams.get('id');

        if (!fileId) {
            return res.status(400).json({ error: 'Invalid media URL' });
        }

        // Fetch file buffer from Drive
        const fileBuffer = await driveService.downloadFile(clinicId, fileId);

        // Call Gemini Vision
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
            You are an expert veterinary radiologist and clinical pathologist.
            Analyze this clinical image for a patient.
            
            Provide a structured analysis in JSON format:
            {
                "findings": "detailed description of visual findings",
                "impressions": ["list of clinical impressions/diagnoses"],
                "urgency": "LOW/MEDIUM/HIGH",
                "recommendations": ["list of follow-up actions or imaging"],
                "measurements": "any visible measurements or estimates if applicable"
            }
            
            Be precise, professional, and focus on veterinary medicine. 
            If it is a radiograph, look for fractures, organomegaly, or abnormal opacities.
            If it is a clinical photo, describe skin lesions, wounds, or visible abnormalities.
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: fileBuffer.toString('base64'),
                    mimeType: 'image/jpeg' // We should ideally get this from media record or buffer
                }
            }
        ]);

        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(text);

        // Log activity
        await prisma.aIActivity.create({
            data: {
                clinicId: clinicId as string,
                userId: req.user!.id,
                agentType: 'DIAGNOSTIC',
                action: 'ANALYZE_IMAGE',
                inputData: { mediaId, fileName: media.name },
                outputData: analysis,
                status: 'COMPLETED'
            }
        });

        res.json(analysis);
    } catch (error) {
        console.error('Imaging analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze image' });
    }
});

// POST /api/ai-imaging/compare
// Compare two longitudinal images
router.post('/compare', authenticate, async (req: AuthRequest, res) => {
    try {
        const { mediaIdA, mediaIdB } = req.body;
        if (!mediaIdA || !mediaIdB) return res.status(400).json({ error: 'Two Media IDs are required' });

        const mediaA = await prisma.media.findUnique({ where: { id: mediaIdA } });
        const mediaB = await prisma.media.findUnique({ where: { id: mediaIdB } });

        if (!mediaA || !mediaB) return res.status(404).json({ error: 'One or both media records not found' });

        const fileIdA = new URLSearchParams(mediaA.url.split('?')[1]).get('id');
        const fileIdB = new URLSearchParams(mediaB.url.split('?')[1]).get('id');

        if (!fileIdA || !fileIdB) return res.status(400).json({ error: 'Invalid media URLs' });

        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(401).json({ error: 'Clinic context missing' });

        const [bufferA, bufferB] = await Promise.all([
            driveService.downloadFile(clinicId, fileIdA),
            driveService.downloadFile(clinicId, fileIdB)
        ]);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
            You are an expert veterinary radiologist. 
            Compare these two longitudinal images of the same patient.
            Image A (Older) vs Image B (Newer).
            
            Analyze the progression of any pathology or healing.
            Provide a structured analysis in JSON format:
            {
                "progression": "IMPROVING/STABLE/WORSENING",
                "summary": "detailed summary of changes",
                "quantitativeChange": "description of measurable changes (e.g. 20% smaller)",
                "nextSteps": ["recommendations"]
            }
        `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: bufferA.toString('base64'), mimeType: 'image/jpeg' } },
            { inlineData: { data: bufferB.toString('base64'), mimeType: 'image/jpeg' } }
        ]);

        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(text));
    } catch (error) {
        console.error('Imaging comparison error:', error);
        res.status(500).json({ error: 'Failed to compare images' });
    }
});

export default router;
