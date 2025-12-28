import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { EnhancedRuleClassifier } from '../services/transactions/classification/EnhancedRuleClassifier';
import { CleanEmail } from '../types/transaction.types';

const DUMP_FILE_PATH = path.join(process.cwd(), 'emails_dump.json');
const MAX_TEST = 2000;

async function main() {
    console.log(`Starting Rule Verification on first ${MAX_TEST} emails...`);

    // Initialize Classifier
    const classifier = new EnhancedRuleClassifier();

    const fileStream = fs.createReadStream(DUMP_FILE_PATH, { encoding: 'utf8' });
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let currentFrom = '';
    let currentSubject = '';
    let currentBody = '';
    let currentId = '';
    let count = 0;

    let classifiedCount = 0;
    let highConfidenceCount = 0;
    let bankSpecificCount = 0;

    for await (const line of rl) {
        const trimmed = line.trim();

        if (trimmed.startsWith('"id":')) {
            currentFrom = '';
            currentSubject = '';
            currentBody = '';
            currentId = '';
        }

        if (trimmed.startsWith('"id":')) {
            const match = trimmed.match(/"id":\s*"(.*)"/);
            if (match) currentId = match[1];
        }

        if (trimmed.startsWith('"from":')) {
            const match = trimmed.match(/"from":\s*"(.*)"/);
            if (match) currentFrom = match[1];
        }

        if (trimmed.startsWith('"subject":')) {
            const match = trimmed.match(/"subject":\s*"(.*)"/);
            if (match) currentSubject = match[1];
        }

        if (trimmed.startsWith('"bodyText":')) {
            const match = trimmed.match(/"bodyText":\s*"(.*)"/);
            if (match) currentBody = match[1];
        }

        if (trimmed === '},' || trimmed === '}') {
            if (currentSubject) {
                // Construct CleanEmail
                const cleanEmail: CleanEmail = {
                    id: currentId || 'test',
                    subject: currentSubject,
                    cleanedBody: currentBody.substring(0, 1000), // Limit body
                    from: currentFrom,
                    internalDate: Date.now(), // Timestamp
                    hasAttachments: false
                };

                const result = EnhancedRuleClassifier.classify(cleanEmail);

                // Verify Extraction for High Confidence
                if (result && result.confidence >= 0.85 && result.type !== 'non_financial' && result.type !== 'unclassified') {
                    try {
                        // Mock InstrumentAutoService for extraction
                        // We need to dynamic verify, but we can't easily mock static methods in this script structure 
                        // without a mocking library or dependency injection.
                        // However, let's try to run extraction and catch errors.
                        // Note: Extractors call InstrumentAutoService which might hit DB.
                        // We should mock it if possible or handle the error.

                        // For this script, we'll skip DB dependent extractors or just log if they fail.
                        // Actually, BankAccountCreditExtractor calls InstrumentAutoService.findOrCreateAccount
                        // which checks DB. This script might fail if DB not connected.
                        // Better to verify Classification accuracy primarily.

                        // Checking "Salary" classification change specifically
                        if (result.type === 'salary' || result.metadata?.pattern === 'CREDIT_ALERT') {
                            // count salary potential
                        }

                    } catch (e) {
                        // ignore
                    }
                }

                count++;
                if (result && result.type !== 'unclassified') {
                    classifiedCount++;
                    if (result.confidence >= 0.85) {
                        highConfidenceCount++;
                    }
                    if (result.metadata?.pattern && ['HDFC_UPI_DEBIT', 'SBI_CC_SPEND', 'JUPITER_UPI_SPEND', 'JUPITER_CC_SPEND'].includes(result.metadata.pattern)) {
                        bankSpecificCount++;
                    }
                } else {
                    // Log ALL unclassified for deep mining
                    console.log(`[UNCLASSIFIED] [${cleanEmail.id}] ${cleanEmail.subject.substring(0, 80)}`);
                }

                if (count >= MAX_TEST) break;
            }
        }
    }

    console.log(`\nVerification Results (${count} emails processed):`);
    console.log(`Classified: ${classifiedCount} (${(classifiedCount / count * 100).toFixed(1)}%)`);
    console.log(`High Confidence (>=0.85): ${highConfidenceCount} (${(highConfidenceCount / count * 100).toFixed(1)}%)`);
    console.log(`New Bank Specific Matches: ${bankSpecificCount}`);
}

main().catch(console.error);
