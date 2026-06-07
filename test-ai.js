// Test AI endpoints
const API_URL = 'https://vetnexus.vetnexuspro.com/api';

// Test 1: Diagnosis Suggestion
async function testDiagnosis() {
    try {
        const response = await fetch(`${API_URL}/ai/suggest-diagnosis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
            },
            body: JSON.stringify({
                complaint: 'Vomiting and lethargy',
                assessment: 'Dehydrated, elevated temperature'
            })
        });

        const data = await response.json();
        console.log('Diagnosis Response:', data);
    } catch (error) {
        console.error('Diagnosis Error:', error);
    }
}

// Test 2: Product Scan (with dummy base64)
async function testProductScan() {
    try {
        const response = await fetch(`${API_URL}/ai/scan-product`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
            },
            body: JSON.stringify({
                imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...' // Dummy base64
            })
        });

        const data = await response.json();
        console.log('Scan Response:', data);
    } catch (error) {
        console.error('Scan Error:', error);
    }
}

testDiagnosis();
testProductScan();
