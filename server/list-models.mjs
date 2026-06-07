import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyDZ9CCOAfxiHdx1rCW4mdhbp298vbg-PFQ";

async function listModels() {
    try {
        console.log("Attempting to list models...");
        // The simple SDK doesn't have a direct 'listModels' easily accessible like the REST API
        // but we can try a direct fetch to the REST API using the key
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            console.log("✅ Successfully connected to Gemini API!");
            console.log("Available Models:", JSON.stringify(data.models?.map(m => m.name), null, 2));
        } else {
            console.error("❌ Failed to list models:");
            console.error(`Status: ${response.status}`);
            console.error("Data:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

listModels();
