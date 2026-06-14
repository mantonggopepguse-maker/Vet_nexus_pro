import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

// 🩺 Analyze Case for Differential Diagnoses
router.post('/analyze-case', authenticate, async (req: AuthRequest, res) => {
    try {
        const { patientId, complaint, clinicalSigns, vitals } = req.body;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'AI Service configuration missing' });
        }

        // Fetch patient history for context
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                treatments: {
                    take: 5,
                    orderBy: { date: 'desc' },
                    include: {
                        medications: true,
                        procedures: { include: { procedure: true } }
                    }
                }
            }
        });

        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
            Analyze this veterinary case for a ${patient.species} (${patient.breed || 'Unknown breed'}), ${patient.gender}, ${patient.age} years old.
            
            Current Complaint: ${complaint}
            Clinical Signs: ${clinicalSigns}
            Vitals: ${JSON.stringify(vitals)}
            
            Recent History:
            ${patient.treatments.map(t => `- ${t.date.toDateString()}: ${t.diagnosis}. Notes: ${t.notes}`).join('\n')}
            
            Provide:
            1. Differential Diagnoses: List 3-5 possibilities with reasoning and estimated probability (0-1).
            2. Red Flags: Identify any life-threatening signs or urgent concerns.
            3. Recommended Tests: Suggest next steps (labs, imaging).
            
            Return ONLY a JSON object:
            {
                "differentials": [{ "diagnosis": string, "reasoning": string, "probability": number }],
                "redFlags": [string],
                "recommendedTests": [string]
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        // Strip markdown json block if present
        text = text.replace(/^```json/mi, '').replace(/```$/m, '').trim();
        
        let analysis;
        try {
            analysis = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse AI response:', text);
            throw e;
        }

        res.json(analysis);
    } catch (error) {
        console.error('Diagnostic analysis error:', error);
        res.status(500).json({ error: 'Failed to perform diagnostic analysis' });
    }
});

// 🔬 Parse Lab Result (AI Stub)
router.post('/parse-lab-result', authenticate, async (req: AuthRequest, res) => {
    try {
        const { rawText, patientId } = req.body;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) return res.status(500).json({ error: 'AI Service configuration missing' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
            Extract clinical lab values from the following raw text:
            "${rawText}"
            
            Identify:
            - Test Name (e.g., BUN, Creatinine, RBC)
            - Result Value
            - Reference Range
            - Units
            - Status (Normal, High, Low)
            
            Return ONLY a JSON object:
            {
                "labs": [{ "test": string, "value": string, "range": string, "unit": string, "status": string }]
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const labs = JSON.parse(response.text());

        res.json(labs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to parse lab result' });
    }
});

// 📈 Health Trends (Vitals)
router.post('/suggest-lab-plan', authenticate, async (req: AuthRequest, res) => {
    try {
        const { patientId, complaint, clinicalSigns, vitals, problems } = req.body;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) return res.status(500).json({ error: 'AI Service configuration missing' });

        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                labResults: { take: 10, orderBy: { testDate: 'desc' } },
                treatments: { take: 5, orderBy: { date: 'desc' } }
            }
        });

        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
            You are assisting a veterinarian choosing diagnostic lab tests and samples.
            Patient: ${patient.species}, ${patient.breed || 'unknown breed'}, ${patient.gender}, ${patient.age} years, ${patient.weight} kg.
            Complaint: ${complaint || 'Not provided'}
            Clinical assessment: ${clinicalSigns || 'Not provided'}
            Vitals: ${JSON.stringify(vitals || {})}
            Problems: ${(problems || []).join(', ') || 'Not provided'}
            Recent labs: ${patient.labResults.map(l => `${l.testName}: ${l.numericalValue ?? l.result ?? ''} ${l.unit ?? ''} (${l.status})`).join('; ') || 'None'}
            Recent diagnoses: ${patient.treatments.map(t => t.diagnosis).filter(Boolean).join('; ') || 'None'}

            Suggest practical veterinary lab tests and samples to collect. Include urgency and a short reason.
            Return ONLY JSON:
            {
              "tests": [{ "testName": string, "sampleType": string, "priority": "Routine" | "Urgent" | "Critical", "reason": string }],
              "sampleNotes": [string]
            }
        `;

        const result = await model.generateContent(prompt);
        const text = (await result.response).text().replace(/^```json/mi, '').replace(/```$/m, '').trim();
        res.json(JSON.parse(text));
    } catch (error) {
        console.error('Lab plan suggestion error:', error);
        res.status(500).json({ error: 'Failed to suggest lab plan' });
    }
});

router.post('/interpret-lab-result', authenticate, async (req: AuthRequest, res) => {
    try {
        const { patientId, lab } = req.body;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) return res.status(500).json({ error: 'AI Service configuration missing' });

        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: { labResults: { take: 8, orderBy: { testDate: 'desc' } } }
        });

        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
            Interpret this veterinary lab result for clinician review.
            Patient: ${patient.species}, ${patient.breed || 'unknown breed'}, ${patient.gender}, ${patient.age} years, ${patient.weight} kg.
            Lab result: ${JSON.stringify(lab)}
            Recent labs: ${patient.labResults.map(l => `${l.testName}: ${l.numericalValue ?? l.result ?? ''} ${l.unit ?? ''}; ref ${l.referenceRange ?? 'n/a'}; ${l.findings ?? ''}`).join('\n')}

            Return concise JSON:
            {
              "summary": string,
              "flags": [string],
              "clinicalConsiderations": [string],
              "recommendedFollowUp": [string]
            }
        `;

        const result = await model.generateContent(prompt);
        const text = (await result.response).text().replace(/^```json/mi, '').replace(/```$/m, '').trim();
        res.json(JSON.parse(text));
    } catch (error) {
        console.error('Lab interpretation error:', error);
        res.status(500).json({ error: 'Failed to interpret lab result' });
    }
});

router.get('/health-trends/:patientId', authenticate, async (req: AuthRequest, res) => {
    try {
        const { patientId } = req.params;

        // 1. Fetch real vitals
        const vitals = await prisma.vitalSign.findMany({
            where: { patientId: patientId as string },
            orderBy: { timestamp: 'asc' }
        });

        // 2. Format trends for frontend
        const trends = vitals.map(v => ({
            date: v.timestamp,
            type: v.type, // Weight, Temp, etc.
            value: v.value,
            unit: v.unit
        }));

        res.json(trends);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch health trends' });
    }
});

export default router;
