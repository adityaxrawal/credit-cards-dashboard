
import fs from 'fs';
import path from 'path';
import { EnhancedRuleClassifier } from '../src/services/transactions/classification/EnhancedRuleClassifier';
import { CleanEmail } from '../src/types/transaction.types';

const DUMP_PATH = path.join(__dirname, '../../emails_dump.json');

// Mock logger to silence output
const mockLogger = {
    info: () => { },
    debug: () => { },
    warn: () => { },
    error: console.error,
};

// We need to bypass the actual require of the logger if we want to silence it effectively 
// for modules that import it. 
// Since we are not using jest here but ts-node, we can't easily mock imports for other modules 
// unless we use a library like 'proxyquire' or 'module-alias'.
// However, checking the logs structure, it seems we can just silence console.log/debug? 
// No, winston might write to stdout.

// Simplest hack: Override process.stdout.write temporarily? 
// But we want OUR output.

// Let's try to set environment variable for logger level if supported.
process.env.LOG_LEVEL = 'error';


async function main() {
    console.log(`Reading emails from ${DUMP_PATH}...`);

    // Read JSON in chunks or stream if huge, but synchronous read might work for 400MB if memory allows. 
    // Given the previous context, we'll try reading it all.
    const rawData = fs.readFileSync(DUMP_PATH, 'utf-8');
    const emails: any[] = JSON.parse(rawData);

    console.log(`Total Emails: ${emails.length}`);

    let totalWrapper = 0;
    let classifiedTransaction = 0;
    let classifiedNonFinancial = 0;
    let unclassified = 0;

    const unclassifiedExamples: Array<{ id: string, subject: string, from: string }> = [];

    for (const email of emails) {
        // Convert to CleanEmail structure expected by Classifier
        // basic mapping, might need adjustment based on actual dump structure vs CleanEmail interface
        const cleanEmail: CleanEmail = {
            id: email.id,
            subject: email.subject || '',
            cleanedBody: email.bodyText || email.snippet || '', // Classifier uses cleanedBody
            from: email.from || '',
            internalDate: new Date(email.date).getTime(), // email.date is ISO string
            hasAttachments: false, // assumption for now
            attachments: [],
            raw: {},
            date: new Date(email.date),
        };

        const result = EnhancedRuleClassifier.classify(cleanEmail);

        totalWrapper++;
        if (result) {
            if (result.type === 'non_financial') {
                classifiedNonFinancial++;
            } else {
                classifiedTransaction++;
            }
        } else {
            unclassified++;
            unclassifiedExamples.push({
                id: cleanEmail.id,
                subject: cleanEmail.subject,
                from: cleanEmail.from
            });
        }
    }

    console.log('\n--- Classification Results ---');
    console.log(`Total Processed: ${totalWrapper}`);
    console.log(`Classified as Transaction: ${classifiedTransaction}`);
    console.log(`Classified as Non-Financial: ${classifiedNonFinancial}`);
    console.log(`Unclassified: ${unclassified}`);

    const coverage = ((classifiedTransaction + classifiedNonFinancial) / totalWrapper) * 100;
    console.log(`\nRule Validation Coverage: ${coverage.toFixed(2)}%`);

    if (unclassified > 0) {
        console.log('\n--- Unclassified Emails (Potential Misses) ---');
        // Limit output
        unclassifiedExamples.slice(0, 50).forEach(e => {
            console.log(`[${e.id}] ${e.from} : ${e.subject}`);
        });
        if (unclassifiedExamples.length > 50) {
            console.log(`... and ${unclassifiedExamples.length - 50} more.`);
        }
    } else {
        console.log('\nSUCCESS: 100% Coverage (No unclassified emails found).');
    }
}

main().catch(console.error);
