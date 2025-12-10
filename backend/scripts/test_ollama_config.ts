#!/usr/bin/env ts-node
/**
 * Ollama Configuration Test Script
 * 
 * Validates all DeepSeek-R1 fixes are working correctly:
 * 1. Ollama connectivity and model availability
 * 2. Sample email classification with <think> reasoning
 * 3. Response format validation (reasoning + JSON)
 * 4. Accuracy and latency checks
 * 
 * Usage: npx ts-node scripts/test_ollama_config.ts
 */

import { OllamaService } from '../src/services/ollama.service';

// ANSI color codes for better output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function header(message: string) {
    console.log('\n' + '='.repeat(70));
    log(`  ${message}`, colors.cyan);
    console.log('='.repeat(70) + '\n');
}

function success(message: string) {
    log(`✅ ${message}`, colors.green);
}

function error(message: string) {
    log(`❌ ${message}`, colors.red);
}

function warning(message: string) {
    log(`⚠️  ${message}`, colors.yellow);
}

function info(message: string) {
    log(`ℹ️  ${message}`, colors.blue);
}

async function testOllamaConfig() {
    header('DeepSeek-R1 Ollama Configuration Test');

    let allTestsPassed = true;

    // TEST 1: Connection and Health Check
    header('Test 1: Ollama Connection & Model Availability');

    try {
        const isHealthy = await OllamaService.healthCheck();

        if (!isHealthy) {
            error('Ollama health check FAILED');
            console.log('\nPlease ensure:');
            console.log('  1. Ollama is installed: https://ollama.ai');
            console.log('  2. Ollama is running: ollama serve');
            console.log('  3. DeepSeek model is pulled: ollama pull deepseek-r1:7b');
            console.log('  4. OLLAMA_BASE_URL in .env is correct (default: http://localhost:11434)\n');
            process.exit(1);
        }

        success('Ollama is healthy and responding');

        // Check model from environment
        const model = process.env.OLLAMA_MODEL || 'deepseek-r1:7b';
        info(`Using model: ${model}`);

    } catch (e) {
        error(`Connection test failed: ${(e as Error).message}`);
        allTestsPassed = false;
    }

    // TEST 2: Sample Transaction Classification
    header('Test 2: Transaction Email Classification');

    const sampleEmail = `HDFC Bank Credit Card alert: Rs.500 spent at SWIGGY on card ending 1234 on 10-Dec-2025 at 19:30.
Available limit: Rs.45000. Not you? Report immediately.`;

    console.log('Sample email:');
    log(`"${sampleEmail}"`, colors.yellow);
    console.log();

    const startTime = Date.now();

    try {
        const result = await OllamaService.classifyEmail(sampleEmail, {
            messageId: 'test_001',
            subject: 'HDFC Bank Alert'
        });

        const latency = Date.now() - startTime;

        success(`Classification completed in ${latency}ms`);

        // Validate result structure
        console.log('\nClassification Result:');
        console.log(`  isTransaction:  ${result.isTransaction}`);
        console.log(`  category:       ${result.category}`);
        console.log(`  merchant:       ${result.merchant || 'null'}`);
        console.log(`  amount:         ${result.amount !== null ? result.amount : 'null'}`);
        console.log(`  currency:       ${result.currency || 'null'}`);
        console.log(`  cardLast4:      ${result.cardLast4 || 'null'}`);
        console.log(`  confidence:     ${result.confidence.toFixed(2)}`);
        console.log(`  latency:        ${latency}ms`);

        // Check for errors
        if (result.error) {
            error(`Result contains error: ${result.error}`);
            if (result.rawResponse) {
                warning(`Raw response: ${result.rawResponse.substring(0, 200)}...`);
            }
            allTestsPassed = false;
        }

        // TEST 3: Accuracy Validation
        header('Test 3: Accuracy Validation');

        const accuracyTests = [];

        if (result.isTransaction === true) {
            success('Correctly identified as transaction');
            accuracyTests.push(true);
        } else {
            error('Expected isTransaction=true, got false');
            accuracyTests.push(false);
            allTestsPassed = false;
        }

        if (result.merchant === 'SWIGGY') {
            success('Correctly extracted merchant: SWIGGY');
            accuracyTests.push(true);
        } else {
            error(`Expected merchant='SWIGGY', got '${result.merchant}'`);
            accuracyTests.push(false);
            allTestsPassed = false;
        }

        if (result.amount === 500) {
            success('Correctly extracted amount: 500');
            accuracyTests.push(true);
        } else {
            error(`Expected amount=500, got ${result.amount}`);
            accuracyTests.push(false);
            allTestsPassed = false;
        }

        if (result.cardLast4 === '1234') {
            success('Correctly extracted card last 4 digits: 1234');
            accuracyTests.push(true);
        } else {
            warning(`Expected cardLast4='1234', got '${result.cardLast4}'`);
            accuracyTests.push(false);
        }

        if (result.confidence >= 0.8) {
            success(`High confidence: ${result.confidence.toFixed(2)}`);
            accuracyTests.push(true);
        } else {
            warning(`Low confidence: ${result.confidence.toFixed(2)} (threshold: 0.8)`);
        }

        // TEST 4: Performance Check
        header('Test 4: Performance Check');

        if (latency < 5000) {
            success(`Latency within acceptable range: ${latency}ms (< 5000ms)`);
        } else {
            warning(`High latency: ${latency}ms (expected < 5000ms)`);
        }

        const expectedLatency = 1500; // Expected range for 7b model
        if (latency < expectedLatency * 3) {
            info(`Latency is reasonable for DeepSeek-R1 reasoning model`);
        } else {
            warning(`Latency higher than expected. Model may be loading or system is slow.`);
        }

    } catch (e) {
        error(`Classification failed: ${(e as Error).message}`);
        allTestsPassed = false;
    }

    // TEST 5: Direct Ollama API Test
    header('Test 5: Direct Ollama API Verification');

    try {
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const model = process.env.OLLAMA_MODEL || 'deepseek-r1:7b';

        info('Testing direct API call with new configuration...');

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: 'Classify this email. First think, then output JSON.\n\n<think>Rs.500 at SWIGGY is a transaction.</think>\n\n{"isTransaction":true,"category":"transaction_success","merchant":"SWIGGY","amount":500,"currency":"INR","transactionDate":null,"cardLast4":null,"confidence":0.9}',
                stream: false,
                options: {
                    num_predict: 1500,
                    temperature: 0,
                    stop: ['}\n']
                }
            })
        });

        if (!response.ok) {
            error(`API call failed with status ${response.status}`);
            allTestsPassed = false;
        } else {
            const data = await response.json();
            const rawResponse = (data as any).response || '';

            if (rawResponse.length === 0) {
                error('CRITICAL: Empty response from Ollama API');
                allTestsPassed = false;
            } else {
                success(`Received non-empty response (${rawResponse.length} chars)`);

                // Check for <think> tags
                if (rawResponse.includes('<think>')) {
                    success('Response contains <think> reasoning tags');
                } else {
                    info('Response does not contain <think> tags (may vary by model)');
                }

                // Check for JSON
                if (rawResponse.includes('{') && rawResponse.includes('}')) {
                    success('Response contains JSON structure');
                } else {
                    warning('Response may not contain valid JSON');
                }

                // Check eval_count
                const evalCount = (data as any).eval_count || 0;
                info(`Tokens generated (eval_count): ${evalCount}`);

                if (evalCount > 500) {
                    success('Token count indicates full reasoning + JSON generation');
                } else if (evalCount > 0) {
                    warning(`Low token count (${evalCount}). May indicate truncation.`);
                } else {
                    error('eval_count is 0 or missing');
                }
            }
        }
    } catch (e) {
        error(`Direct API test failed: ${(e as Error).message}`);
        allTestsPassed = false;
    }

    // Final Summary
    header('Test Summary');

    if (allTestsPassed) {
        success('🎉 ALL TESTS PASSED!');
        console.log('\nDeepSeek-R1 Ollama configuration is working correctly.');
        console.log('The system is ready for production use.\n');
        process.exit(0);
    } else {
        error('⚠️  SOME TESTS FAILED');
        console.log('\nPlease review the errors above and:');
        console.log('  1. Verify Ollama is running: ollama list');
        console.log('  2. Check model is installed: ollama pull deepseek-r1:7b');
        console.log('  3. Review .env configuration (OLLAMA_MODEL, OLLAMA_BASE_URL)');
        console.log('  4. Check backend logs for detailed error messages\n');
        process.exit(1);
    }
}

// Run tests
testOllamaConfig().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
