/**
 * Debug Ollama Response
 */

async function testOllamaDirectly() {
    const OLLAMA_BASE_URL = 'http://localhost:11434';
    const OLLAMA_MODEL = 'deepseek-r1:8b';

    const sampleEmail = `Transaction Alert: Rs.500 spent at SWIGGY on SBI Card XX1234 on 10-Dec-24 19:30`;
    const promptText = `Classify this credit card email. Respond with ONLY JSON:
{"isTransaction": true/false, "merchant": "name or null", "amount": number or null}

Email: ${sampleEmail}`;

    console.log('Testing Ollama with num_ctx=2048...\n');

    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: promptText,
                stream: false,
                keep_alive: -1,
                options: {
                    temperature: 0,
                    num_predict: 300,
                    num_ctx: 2048,
                    top_p: 1.0
                }
            })
        });

        const data = await response.json();
        const rawResponse = data.response || '';

        console.log('RAW RESPONSE:');
        console.log('─'.repeat(80));
        console.log(rawResponse);
        console.log('─'.repeat(80));
        console.log(`\nLength: ${rawResponse.length} chars\n`);

        if (rawResponse.length > 0) {
            console.log('✅ Model is responding!');
        } else {
            console.log('❌ Still empty response');
        }

    } catch (error: any) {
        console.error('ERROR:', error.message);
    }
}

testOllamaDirectly().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
