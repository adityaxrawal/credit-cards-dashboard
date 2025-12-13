
import { encrypt, decrypt } from '../utils/encryption';
import logger from '../utils/logger';

async function verifyFix6() {
    console.log('--- Starting Fix 6 Verification (Token Encryption) ---');

    const TEST_TOKEN = '1//0gS...TEST_TOKEN...';

    // 1. Verify utility logic
    console.log('1. Testing Encryption Utility...');
    const encrypted = encrypt(TEST_TOKEN);
    console.log('   Encrypted:', encrypted);

    if (encrypted === TEST_TOKEN) {
        console.error('❌ Encryption failed: Output matches input');
        process.exit(1);
    }

    const parts = encrypted.split(':');
    if (parts.length !== 3) {
        console.error('❌ Encryption format invalid (expected iv:tag:content)');
        process.exit(1);
    }

    const decrypted = decrypt(encrypted);
    console.log('   Decrypted:', decrypted);

    if (decrypted !== TEST_TOKEN) {
        console.error('❌ Decryption mismatch');
        process.exit(1);
    }
    console.log('✅ Utility works');

    // 2. Verify Graceful Fallback (Plain text read)
    console.log('2. Testing Graceful Fallback...');
    const plainText = 'some-legacy-refresh-token';
    const fallbackDecrypted = decrypt(plainText);
    if (fallbackDecrypted === plainText) {
        console.log('✅ Graceful fallback works (returned original plain text)');
    } else {
        console.error('❌ Graceful fallback failed');
    }

    // 3. Verify Malformed Input
    console.log('3. Testing Malformed Input...');
    // formatted like encrypted but with bad key/tag
    const badEncrypted = parts[0] + ':' + parts[1] + ':' + 'badcontent';
    const badDecrypted = decrypt(badEncrypted);
    // It should catch error and return original text (graceful failure)
    if (badDecrypted === badEncrypted) {
        console.log('✅ Malformed input handled gracefully (returned original)');
    } else {
        console.log('ℹ️ Decrypt might have thrown or returned garbage, result:', badDecrypted);
    }

    console.log('--- Verification Complete ---');
}

verifyFix6();
