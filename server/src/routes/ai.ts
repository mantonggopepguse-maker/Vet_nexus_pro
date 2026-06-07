import { Router } from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';

const router = Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Startup verification - log once when module loads
if (process.env.GEMINI_API_KEY) {
    console.log('✅ AI Service: GEMINI_API_KEY configured');
} else {
    console.warn('⚠️  AI Service: GEMINI_API_KEY not found - AI features will not work');
}

router.post('/scan-product', authenticate, async (req, res) => {
    try {
        // Extract API key inside handler to ensure env vars are loaded
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            console.error('❌ AI Scan Error: GEMINI_API_KEY is not configured in .env file');
            return res.status(500).json({
                error: 'Server AI configuration missing',
                detail: 'GEMINI_API_KEY not found in server environment variables.'
            });
        }

        const { imageBase64 } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: 'No image provided' });
        }

        console.log('🔍 AI Product Scan initiated');

        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // Robust MIME and Data extraction
        let mimeType = 'image/jpeg';
        let cleanBase64 = imageBase64;

        if (imageBase64.includes(';base64,')) {
            const parts = imageBase64.split(';base64,');
            mimeType = parts[0].split(':')[1] || 'image/jpeg';
            cleanBase64 = parts[1];
        }

        const prompt = `Extract product details for veterinary inventory.
            Return ONLY a JSON object with these fields:
            name, sku (barcode), batchNumber (serial/batch number), nafdacNumber, description, expiryDate (YYYY-MM-DD), category, packaging, manufacturer, composition.
            
            Guidelines:
            - DO NOT return any price or financial information.
            - "composition": List active ingredients if visible.
            - "description": Write a professional, concise veterinary product description based on the name, manufacturer, and composition discovered on the label. Include usage or storage warnings if visible.
            
            Valid category values: Medicine, Vaccine, Supplement, Supplies, Consumables, Food, Equipment, Toys, Other.
            Valid packaging types: Bottle, Box, Blister Pack, Vial, Tube, Sachet, Tabs, Plate, Bag, Other.
            Use exactly one of the valid category values and exactly one of the valid packaging types. If unsure, use Other.
            
            Scan the product label in this image accurately.`;

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType,
                    data: cleanBase64
                }
            },
            {
                text: prompt
            }
        ]);

        const response = await result.response;
        const text = response.text();

        console.log('✅ AI Scan Response received, length:', text.length);

        // Robust JSON parsing helper
        const extractJSON = (text: string) => {
            try {
                // 1. Try direct parse
                return JSON.parse(text);
            } catch (e) {
                // 2. Remove markdown code blocks
                let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/```/g, '').trim();
                try {
                    return JSON.parse(clean);
                } catch (e2) {
                    // 3. Find first { and last }
                    const start = clean.indexOf('{');
                    const end = clean.lastIndexOf('}');
                    if (start !== -1 && end !== -1) {
                        return JSON.parse(clean.substring(start, end + 1));
                    }
                    throw new Error('No JSON found in response');
                }
            }
        };

        let parsedData;
        try {
            parsedData = extractJSON(text);
        } catch (parseError) {
            console.error('❌ AI JSON Parse Failed. Raw text:', text);
            return res.status(500).json({ error: 'Failed to parse AI response', raw: text });
        }

        console.log('✅ AI Scan successful:', parsedData.name || 'Unknown product');
        res.json(parsedData);

    } catch (error: any) {
        console.error('❌ AI Scan Error:', {
            message: error.message,
            status: error.status || error.statusCode,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

        // Provide more specific error messages
        let errorMessage = 'Failed to scan product';
        if (error.message?.includes('fetch failed')) {
            errorMessage = 'Network error connecting to AI service';
        } else if (error.message?.includes('404')) {
            errorMessage = 'AI model not available';
        } else if (error.message?.includes('API key')) {
            errorMessage = 'AI service authentication failed';
        }

        res.status(500).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/suggest-diagnosis', authenticate, async (req, res) => {
    try {
        // Extract API key inside handler to ensure env vars are loaded
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            console.error('❌ AI Diagnosis Error: GEMINI_API_KEY is not configured');
            return res.status(500).json({ error: 'Server AI config missing' });
        }

        const { complaint, assessment } = req.body;

        console.log('🩺 AI Diagnosis Suggestion initiated');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
          Analyze veterinary case:
          Complaint: ${complaint}
          Assessment: ${assessment}
          
          Suggest 3 diagnoses with confidence %.
          Return JSON array: [{ "diagnosis": string, "confidence": number }]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ AI Diagnosis Response received, length:', text.length);

        // Robust JSON parsing helper
        const extractJSON = (text: string) => {
            try {
                return JSON.parse(text);
            } catch (e) {
                let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/```/g, '').trim();
                try {
                    return JSON.parse(clean);
                } catch (e2) {
                    const start = clean.indexOf('[');
                    const end = clean.lastIndexOf(']');
                    if (start !== -1 && end !== -1) {
                        return JSON.parse(clean.substring(start, end + 1));
                    }
                    throw new Error('No JSON array found in response');
                }
            }
        };

        let suggestions;
        try {
            suggestions = extractJSON(text);
        } catch (parseError) {
            console.error('❌ AI Diagnosis Parse Failed. Raw text:', text);
            // Return empty array fallback instead of erroring out completely for diagnosis
            suggestions = [];
        }

        console.log('✅ AI Diagnosis successful, suggestions:', suggestions.length);
        res.json(suggestions);

    } catch (error: any) {
        console.error('❌ AI Diagnosis Error:', {
            message: error.message,
            status: error.status || error.statusCode,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

        // Provide more specific error messages
        let errorMessage = 'Failed to generate suggestions';
        if (error.message?.includes('fetch failed')) {
            errorMessage = 'Network error connecting to AI service';
        } else if (error.message?.includes('404')) {
            errorMessage = 'AI model not available';
        } else if (error.message?.includes('API key')) {
            errorMessage = 'AI service authentication failed';
        }

        res.status(500).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/transcribe', authenticate, upload.single('audio'), async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            console.error('❌ AI Transcription Error: GEMINI_API_KEY is not configured');
            return res.status(500).json({ error: 'Server AI config missing' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log(`🎙️ AI Transcription initiated. File size: ${req.file.size} bytes. MIME: ${req.file.mimetype}`);

        const genAI = new GoogleGenerativeAI(apiKey);
        // Note: Gemini 1.5 Flash supports audio inputs natively!
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash", 
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `You are an expert veterinary transcriptionist. Analyze the following audio recording of a veterinarian dictating clinical notes. 
        Format the findings into a strict veterinary SOAP note structure.
        Return ONLY a JSON object with these exact keys: "subjective", "objective", "assessment", "plan". 
        Write professionally and clinically based on the recording. If a section is not mentioned, output an empty string for that key.`;

        // Pass the audio buffer directly as inlineData
        const base64Audio = req.file.buffer.toString("base64");
        
        // Wait for generation
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: req.file.mimetype,
                    data: base64Audio
                }
            },
            { text: prompt }
        ]);

        const response = await result.response;
        const text = response.text();

        console.log('✅ AI Transcription Response received, length:', text.length);

        // Robust JSON parsing logic
        const extractJSON = (text: string) => {
            try { return JSON.parse(text); } catch (e) {
                let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/```/g, '').trim();
                try { return JSON.parse(clean); } catch (e2) {
                    const start = clean.indexOf('{');
                    const end = clean.lastIndexOf('}');
                    if (start !== -1 && end !== -1) {
                        return JSON.parse(clean.substring(start, end + 1));
                    }
                    throw new Error('No JSON found in response');
                }
            }
        };

        const parsedData = extractJSON(text);
        
        // (Optional) We could save this to ai_transcripts and ai_soap_notes in the DB here,
        // but for now, we return it to the frontend to populate the form fields directly.

        res.json(parsedData);

    } catch (error: any) {
        console.error('❌ AI Transcription Error:', {
            message: error.message,
            status: error.status || error.statusCode
        });
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
});

export default router;
