import { Router } from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import { prisma } from '../db.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// Configure multer for audio uploads
const upload = multer({
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for audio
    storage: multer.diskStorage({
        destination: 'uploads/temp/',
        filename: (req, file, cb) => {
            cb(null, `audio-${Date.now()}${path.extname(file.originalname)}`);
        }
    })
});

// Ensure temp directory exists
if (!fs.existsSync('uploads/temp')) {
    fs.mkdirSync('uploads/temp', { recursive: true });
}

// 1. Transcribe Audio
router.post('/transcribe', authenticate, upload.single('audio'), async (req, res) => {
    let filePath = '';

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const { patientId } = req.body;
        filePath = req.file.path;

        // Initialize Gemini
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('AI configuration missing');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Read file as base64
        const fileData = fs.readFileSync(filePath);
        const base64Data = fileData.toString('base64');
        const mimeType = req.file.mimetype;

        console.log(`🎙️ Transcribing audio for patient ${patientId || 'unknown'}, size: ${req.file.size}`);

        const prompt = "Transcribe this veterinary consultation audio exactly. Identify speakers if possible (Vet, Client).";

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            },
            { text: prompt }
        ]);

        const transcriptText = result.response.text();

        // Save to database
        const transcript = await prisma.aITranscript.create({
            data: {
                clinicId: (req as any).user.clinicId,
                patientId: patientId || undefined,
                transcript: transcriptText,
                audioSize: req.file.size,
                language: 'en',
                metadata: {
                    originalName: req.file.originalname,
                    mimeType: req.file.mimetype
                }
            }
        });

        // Clean up file
        fs.unlinkSync(filePath);

        res.json(transcript);

    } catch (error: any) {
        console.error('❌ Transcription Error:', error);
        // Clean up file if error occurs
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);

        res.status(500).json({
            error: 'Transcription failed',
            details: error.message
        });
    }
});

// 2. Generate SOAP Note from Transcript
router.post('/generate-soap', authenticate, async (req, res) => {
    try {
        const { transcriptId, patientId, additionalContext } = req.body;

        if (!transcriptId || !patientId) {
            return res.status(400).json({ error: 'Transcript ID and Patient ID required' });
        }

        // Fetch transcript
        const transcriptRecord = await prisma.aITranscript.findUnique({
            where: { id: transcriptId }
        });

        if (!transcriptRecord) {
            return res.status(404).json({ error: 'Transcript not found' });
        }

        // Fetch patient details for context
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: { owner: true }
        });

        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey!);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            Act as an expert veterinary scribe. Convert the following consultation transcript into a professional SOAP note.
            
            Patient: ${patient?.name} (${patient?.species}, ${patient?.breed}, ${patient?.age}yo)
            Owner: ${patient?.owner ? `${patient.owner.firstName} ${patient.owner.lastName}` : 'Unknown Owner'}
            Additional Context: ${additionalContext || 'None'}
            
            Transcript:
            ${transcriptRecord.transcript}
            
            Return ONLY a valid JSON object with the following structure:
            {
                "subjective": "History, presenting complaints...",
                "objective": "Physical exam findings, vitals...",
                "assessment": "Differential diagnoses, definitive diagnosis...",
                "plan": "Treatments, medications, follow-up...",
                "visitSummary": "Client-friendly summary of the visit...",
                "dischargeNotes": "Instructions for the owner..."
            }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON safely
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Failed to parse AI response');

        const soapData = JSON.parse(jsonMatch[0]);

        // Create Draft SOAP Note
        const soapNote = await prisma.aISoapNote.create({
            data: {
                transcriptId,
                patientId,
                subjective: soapData.subjective,
                objective: soapData.objective,
                assessment: soapData.assessment,
                plan: soapData.plan,
                visitSummary: soapData.visitSummary,
                dischargeNotes: soapData.dischargeNotes,
                status: 'DRAFT'
            }
        });

        // Log Activity
        const authUser = (req as any).user;
        await prisma.aIActivity.create({
            data: {
                clinicId: authUser.clinicId,
                userId: authUser.id,
                agentType: 'SCRIBE',
                action: 'GENERATE_SOAP',
                status: 'SUCCESS',
                metadata: { soapNoteId: soapNote.id }
            }
        });

        res.json(soapNote);

    } catch (error: any) {
        console.error('❌ SOAP Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate SOAP note', details: error.message });
    }
});

// 3. Approve SOAP Note
router.post('/approve-soap/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { subjective, objective, assessment, plan, visitSummary, dischargeNotes } = req.body;

        const updatedNote = await prisma.aISoapNote.update({
            where: { id: id as string },
            data: {
                subjective,
                objective,
                assessment,
                plan,
                visitSummary,
                dischargeNotes,
                status: 'APPROVED',
                approvedBy: (req as any).user.id,
                approvedAt: new Date()
            }
        });

        // Create official Treatment record from approved SOAP
        await prisma.treatment.create({
            data: {
                patientId: updatedNote.patientId,
                vetId: (req as any).user.id,
                date: new Date(),
                chiefComplaint: updatedNote.subjective.substring(0, 255), // Truncate for summary
                diagnosis: updatedNote.assessment.substring(0, 255),
                notes: `
[SUBJECTIVE]
${updatedNote.subjective}

[OBJECTIVE]
${updatedNote.objective}

[ASSESSMENT]
${updatedNote.assessment}

[PLAN]
${updatedNote.plan}
                `,
                status: 'Completed'
            }
        });

        // Log Activity
        await prisma.aIActivity.create({
            data: {
                clinicId: (req as any).user.clinicId,
                userId: (req as any).user.id,
                agentType: 'SCRIBE',
                action: 'APPROVE_SOAP',
                status: 'SUCCESS',
                metadata: { soapNoteId: id }
            }
        });

        res.json({ success: true, note: updatedNote });

    } catch (error: any) {
        console.error('❌ SOAP Approval Error:', error);
        res.status(500).json({ error: 'Failed to approve note', details: error.message });
    }
});

// 4. Get History
router.get('/history', authenticate, async (req, res) => {
    try {
        const history = await prisma.aISoapNote.findMany({
            where: {
                patient: {
                    owner: {
                        clinicId: (req as any).user.clinicId
                    }
                }
            },
            include: {
                patient: true,
                approver: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

export default router;
