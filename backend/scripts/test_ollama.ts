
// Uses native fetch (Node 18+)

async function testOllama() {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'deepseek-r1:7b';

    console.log(`Testing Ollama at ${baseUrl} with model ${model}`);

    // 1. Check Tags (List models)
    try {
        console.log('Checking /api/tags...');
        const tagsRes = await fetch(`${baseUrl}/api/tags`);
        if (!tagsRes.ok) throw new Error(`Tags failed: ${tagsRes.status}`);
        const tags = await tagsRes.json();
        const models = (tags as any).models.map((m: any) => m.name);
        console.log('Available models:', models);

        if (!models.includes(model) && !models.includes(`${model}:latest`)) {
            console.warn(`WARNING: Model '${model}' not found in list. Available: ${models.join(', ')}`);
        }
    } catch (e) {
        console.error('Tags check failed:', e);
    }

    // 2. Generate
    console.log('Testing /api/generate...');
    try {
        const res = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: 'Say hello',
                stream: false
            })
        });

        if (!res.ok) {
            console.error(`Generate failed: Status ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error('Response body:', text);
        } else {
            const data = await res.json();
            console.log('Generate success:', (data as any).response);
        }
    } catch (e) {
        console.error('Generate failed:', e);
    }
}

testOllama();
