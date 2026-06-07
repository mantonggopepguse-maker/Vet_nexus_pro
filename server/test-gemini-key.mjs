import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyDZ9CCOAfxiHdx1rCW4mdhbp298vbg-PFQ";

async function testGemini(modelName) {
    console.log(`\n--- Testing model: ${modelName} ---`);
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent("Say 'AI is active'");
        const response = await result.response;
        const text = response.text();

        console.log(`✅ ${modelName} is working!`);
        console.log("Response:", text);
        return true;
    } catch (error) {
        console.error(`❌ ${modelName} failed:`);
        console.error(`Status: ${error.status}`);
        console.error(`StatusText: ${error.statusText}`);
        if (error.errorDetails) {
            console.error("Details:", JSON.stringify(error.errorDetails, null, 2));
        } else {
            console.error("No error details available.");
        }
        return false;
    }
}

async function runTests() {
    await testGemini("gemini-2.0-flash");
    await testGemini("gemini-flash-latest");
}

runTests();
