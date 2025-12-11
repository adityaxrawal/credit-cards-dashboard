import OpenAI from 'openai';
import { env } from '../config/env';

const run = async () => {
    console.log('Testing OpenAI Connection...');

    if (!env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY is missing');
        return;
    }

    const openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
    });

    try {
        console.log('Sending request to OpenAI (list models)...');
        const list = await openai.models.list();
        const gpt4 = list.data.find(m => m.id.includes('gpt-4'));

        console.log(`✅ OpenAI Connected! Found ${list.data.length} models.`);
        if (gpt4) console.log(`   Found model: ${gpt4.id}`);

        console.log('\nTesting Chat Completion...');
        const completion = await openai.chat.completions.create({
            model: env.GPT_MODEL || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Say "Hello World"' }],
            max_tokens: 10
        });

        console.log(`✅ Chat Response: ${completion.choices[0].message.content}`);

    } catch (err: any) {
        console.error('❌ OpenAI request failed:', err.message);
    }
};

run();
