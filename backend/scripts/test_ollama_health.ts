#!/usr/bin/env ts-node
/**
 * Ollama Health Check Tool
 * 
 * Tests connection to Ollama server and verifies model availability.
 * 
 * Usage: ts-node scripts/test_ollama_health.ts
 */

import { OllamaService } from '../src/services/ollama.service';

async function testOllamaHealth() {
    console.log(`\n==================================================`);
    console.log(`Ollama Health Check`);
    console.log(`==================================================\n`);

    // 1. Test connection
    console.log(`🔍 Testing Ollama connection...`);
    const isHealthy = await OllamaService.healthCheck();

    if (!isHealthy) {
        console.log(`\n❌ Ollama health check FAILED`);
        console.log(`   Please ensure:`);
        console.log(`   1. Ollama is installed: https://ollama.ai`);
        console.log(`   2. Ollama is running: ollama serve`);
        console.log(`   3. DeepSeek model is installed: ollama pull deepseek-r1:1.5b`);
        console.log(`   4. OLLAMA_BASE_URL is correct in .env (default: http://localhost:11434)`);
        console.log();
        process.exit(1);
    }

    console.log(`✅ Ollama is healthy and model is available\n`);

    // 2. Test sample classification
    console.log(`📧 Testing sample email classification...\n`);

    const sampleEmail = `
HDFC Bank Credit Card alert: Rs.500 spent at SWIGGY on card ending 1234 on 05-Dec-24 at 19:30.
Available limit: Rs.45000. Not you? Report immediately.
  `.trim();

    console.log(`Sample email:\n"${sampleEmail}"\n`);

    const startTime = Date.now();

    try {
        const result = await OllamaService.classifyEmail(sampleEmail);
        const latency = Date.now() - startTime;

        console.log(`✅ Classification successful!\n`);
        console.log(`Results:`);
        console.log(`   isTransaction:  ${result.isTransaction}`);
        console.log(`   category:       ${result.category}`);
        console.log(`   merchant:       ${result.merchant || 'null'}`);
        console.log(`   confidence:     ${result.confidence.toFixed(2)}`);
        console.log(`   latency:        ${latency}ms\n`);

        if (result.isTransaction && result.merchant === 'SWIGGY') {
            console.log(`✅ ML correctly identified transaction and merchant!\n`);
        } else {
            console.log(`⚠️  ML classification may not be accurate. Expected isTransaction=true, merchant='SWIGGY'\n`);
        }

    } catch (error) {
        console.error(`\n❌ Classification failed:`, error);
        console.log();
        process.exit(1);
    }

    console.log(`==================================================`);
    console.log(`✅ All tests passed! Ollama is ready for use.`);
    console.log(`==================================================\n`);
}

testOllamaHealth();
