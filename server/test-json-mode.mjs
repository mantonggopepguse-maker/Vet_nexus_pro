import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyDZ9CCOAfxiHdx1rCW4mdhbp298vbg-PFQ";

async function testJsonMode() {
    try {
        console.log("Testing JSON mode with gemini-flash-latest...");
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent("Return a JSON object with a 'status' field set to 'ok'");
        const response = await result.response;
        const text = response.text();

        console.log("✅ JSON mode is supported!");
        console.log("Response:", text);
        try {
            const parsed = JSON.parse(text);
            console.log("Parsed JSON:", parsed);
        } catch (e) {
            console.error("❌ Failed to parse JSON:", text);
        }
    } catch (error) {
        console.error("❌ JSON mode test failed:");
        console.error(error.message);
        if (error.status === 404) {
            console.log("404 means this model or feature combination isn't found.");
        }
    }
}

testJsonMode();
