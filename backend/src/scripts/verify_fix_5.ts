
import { CircuitBreaker, CircuitState } from '../utils/circuitBreaker';

async function verifyFix5() {
    console.log('--- Starting Fix 5 Verification (Circuit Breaker) ---');

    const breaker = new CircuitBreaker('TestBreaker', {
        failureThreshold: 3,
        resetTimeout: 2000 // Short timeout for testing
    });

    // 1. Test CLOSED state (Success)
    try {
        await breaker.execute(async () => 'Success');
        console.log('✅ Success call works in CLOSED state');
    } catch (e) {
        console.error('❌ Failed success call:', e);
    }

    // 2. Trip the breaker
    console.log('Simulating failures to trip breaker...');
    for (let i = 1; i <= 3; i++) {
        try {
            await breaker.execute(async () => { throw new Error('Simulated Fail'); });
        } catch (e) {
            console.log(`   Failure ${i} recorded`);
        }
    }

    if (breaker.getState() === CircuitState.OPEN) {
        console.log('✅ Breaker tripped to OPEN state');
    } else {
        console.error('❌ Breaker did not trip. State:', breaker.getState());
    }

    // 3. Verify FAIL FAST
    try {
        await breaker.execute(async () => 'Should not run');
        console.error('❌ FAIL FAST failed: Request went through in OPEN state');
    } catch (e: any) {
        if (e.message.includes('Failing fast')) {
            console.log('✅ FAIL FAST working (Circuit Open Error)');
        } else {
            console.error('❌ Unexpected error during FAIL FAST:', e);
        }
    }

    // 4. Test HALF_OPEN and Recovery
    console.log('Waiting for reset timeout (2.5s)...');
    await new Promise(r => setTimeout(r, 2500));

    try {
        const res = await breaker.execute(async () => 'Recovered');
        console.log('✅ Request successful after timeout (HALF_OPEN -> CLOSED)');
    } catch (e) {
        console.error('❌ Recovery failed:', e);
    }

    if (breaker.getState() === CircuitState.CLOSED) {
        console.log('✅ Breaker reset to CLOSED state');
    } else {
        console.error('❌ Breaker did not reset. State:', breaker.getState());
    }
}

verifyFix5();
