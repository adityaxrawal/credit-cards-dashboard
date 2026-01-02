/**
 * Compare Detectors: Identify discrepancy between rule_based_evaluation.ts (1371) and application (973)
 * 
 * This script simulates the full pipeline logic to identify which transactions are:
 * 1. Classified by EnhancedRuleClassifier but REJECTED by BroadFinancialDetector
 * 2. Classified but with low confidence (< 0.85)
 * 3. Excluded by exclusion patterns
 * 4. Rejected due to confidence < 0.75
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { EnhancedRuleClassifier } from '../services/transactions/classification/EnhancedRuleClassifier';
import { BroadFinancialDetector } from '../services/transactions/detection/BroadFinancialDetector';
import { CleanEmail } from '@shared/types/transaction.types';

const DUMP_FILE_PATH = path.join(__dirname, 'emails_dump.json');

interface DiscrepancyResult {
    totalEmails: number;
    ruleBasedTransactions: number;      // What rule_based_evaluation.ts counts
    applicationTransactions: number;    // What the pipeline would count

    // Breakdown of filtered emails
    filteredByBroadDetector: number;    // Classified but failed BroadFinancialDetector
    filteredByExclusion: number;        // Classified but excluded
    filteredByLowConfidence: number;    // Classified but confidence < 0.85
    filteredByVeryLowConfidence: number; // Confidence < 0.75 (marked for review)

    // Sample emails for each filter
    samplesBroadFilter: Array<{ id: string; subject: string; score: number; reasons: string[] }>;
    samplesExclusion: Array<{ id: string; subject: string; pattern: string }>;
    samplesLowConfidence: Array<{ id: string; subject: string; type: string; confidence: number }>;
}

async function main() {
    console.log('='.repeat(70));
    console.log('Transaction Discrepancy Analysis');
    console.log('Comparing: rule_based_evaluation.ts vs Application Pipeline');
    console.log('='.repeat(70));

    if (!fs.existsSync(DUMP_FILE_PATH)) {
        console.error(`Error: File not found at ${DUMP_FILE_PATH}`);
        process.exit(1);
    }

    const result: DiscrepancyResult = {
        totalEmails: 0,
        ruleBasedTransactions: 0,
        applicationTransactions: 0,
        filteredByBroadDetector: 0,
        filteredByExclusion: 0,
        filteredByLowConfidence: 0,
        filteredByVeryLowConfidence: 0,
        samplesBroadFilter: [],
        samplesExclusion: [],
        samplesLowConfidence: []
    };

    const fileStream = fs.createReadStream(DUMP_FILE_PATH, { encoding: 'utf8' });
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let braceDepth = 0;
    let objectBuffer = '';
    let inString = false;
    let escaped = false;
    let firstLine = true;

    console.log('\nProcessing emails...');

    for await (const line of rl) {
        const trimmed = line.trim();

        if (firstLine && trimmed === '[') {
            firstLine = false;
            continue;
        }
        firstLine = false;
        if (trimmed === ']') continue;

        objectBuffer += line + '\n';

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    braceDepth++;
                } else if (char === '}') {
                    braceDepth--;

                    if (braceDepth === 0) {
                        let jsonStr = objectBuffer.trim();
                        if (jsonStr.endsWith(',')) {
                            jsonStr = jsonStr.slice(0, -1);
                        }

                        try {
                            const emailRaw = JSON.parse(jsonStr);
                            analyzeEmail(emailRaw, result);
                        } catch (e) {
                            // Parse error
                        }

                        objectBuffer = '';
                    }
                }
            }
        }

        if (result.totalEmails > 0 && result.totalEmails % 1000 === 0) {
            process.stdout.write(`\rProcessed: ${result.totalEmails} | RuleCount: ${result.ruleBasedTransactions} | AppCount: ${result.applicationTransactions}`);
        }
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(70));

    console.log('\n📊 Summary:');
    console.log(`   Total Emails Processed: ${result.totalEmails}`);
    console.log(`   Rule-Based Transactions (rule_based_evaluation.ts): ${result.ruleBasedTransactions}`);
    console.log(`   Application Transactions (Pipeline): ${result.applicationTransactions}`);
    console.log(`   Discrepancy: ${result.ruleBasedTransactions - result.applicationTransactions}`);

    console.log('\n🔍 Filter Breakdown:');
    console.log(`   Filtered by BroadFinancialDetector (score < 50): ${result.filteredByBroadDetector}`);
    console.log(`   Filtered by Exclusion Patterns: ${result.filteredByExclusion}`);
    console.log(`   Filtered by Low Confidence (< 0.85): ${result.filteredByLowConfidence}`);
    console.log(`   Filtered by Very Low Confidence (< 0.75): ${result.filteredByVeryLowConfidence}`);

    // Show samples
    if (result.samplesBroadFilter.length > 0) {
        console.log('\n📋 Sample Emails Filtered by BroadFinancialDetector:');
        for (const sample of result.samplesBroadFilter.slice(0, 10)) {
            console.log(`   [ID: ${sample.id.slice(0, 16)}...] Score: ${sample.score}`);
            console.log(`      Subject: ${sample.subject.slice(0, 60)}...`);
            console.log(`      Reasons: ${sample.reasons.join(', ')}`);
        }
    }

    if (result.samplesExclusion.length > 0) {
        console.log('\n📋 Sample Emails Filtered by Exclusion:');
        for (const sample of result.samplesExclusion.slice(0, 10)) {
            console.log(`   [ID: ${sample.id.slice(0, 16)}...] Pattern: ${sample.pattern}`);
            console.log(`      Subject: ${sample.subject.slice(0, 60)}...`);
        }
    }

    if (result.samplesLowConfidence.length > 0) {
        console.log('\n📋 Sample Emails Filtered by Low Confidence:');
        for (const sample of result.samplesLowConfidence.slice(0, 10)) {
            console.log(`   [ID: ${sample.id.slice(0, 16)}...] Type: ${sample.type}, Confidence: ${sample.confidence.toFixed(3)}`);
            console.log(`      Subject: ${sample.subject.slice(0, 60)}...`);
        }
    }

    // Save detailed results
    const outputPath = path.join(__dirname, 'discrepancy_analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ Detailed results saved to: ${outputPath}`);
}

function analyzeEmail(rawEmail: any, result: DiscrepancyResult) {
    result.totalEmails++;

    if (!rawEmail || !rawEmail.id || !rawEmail.bodyText) {
        return;
    }

    // Construct CleanEmail (same as rule_based_evaluation.ts)
    const cleanEmail: CleanEmail = {
        id: rawEmail.id,
        subject: rawEmail.subject || '',
        cleanedBody: rawEmail.bodyText || '',
        from: rawEmail.from || '',
        internalDate: rawEmail.internalDate ? parseInt(rawEmail.internalDate) : Date.now(),
        hasAttachments: false
    };

    // Step 1: Classify with EnhancedRuleClassifier (what rule_based_evaluation.ts does)
    const classification = EnhancedRuleClassifier.classify(cleanEmail);

    // Check if it's a transaction by rule_based_evaluation.ts logic
    const isRuleBasedTransaction = classification &&
        classification.type !== 'non_financial' &&
        classification.type !== 'unclassified';

    if (isRuleBasedTransaction) {
        result.ruleBasedTransactions++;
    }

    // Now simulate pipeline logic
    if (!isRuleBasedTransaction) {
        return; // Not a transaction even by rule-based, skip
    }

    // Pipeline Filter 1: BroadFinancialDetector
    const fullText = cleanEmail.subject + ' ' + cleanEmail.cleanedBody;
    const broadResult = BroadFinancialDetector.detect(fullText, cleanEmail.from);

    if (!broadResult.isFinancial) {
        result.filteredByBroadDetector++;
        if (result.samplesBroadFilter.length < 50) {
            result.samplesBroadFilter.push({
                id: cleanEmail.id,
                subject: cleanEmail.subject,
                score: broadResult.score,
                reasons: broadResult.reasons
            });
        }
        return;
    }

    // Pipeline Filter 2: Exclusion Check
    const exclusionCheck = EnhancedRuleClassifier.checkExclusions(cleanEmail);
    if (exclusionCheck.isExcluded) {
        result.filteredByExclusion++;
        if (result.samplesExclusion.length < 50) {
            result.samplesExclusion.push({
                id: cleanEmail.id,
                subject: cleanEmail.subject,
                pattern: exclusionCheck.matchedPattern || 'unknown'
            });
        }
        return;
    }

    // Pipeline Filter 3: Confidence >= 0.85 for acceptance
    if (classification.confidence < 0.85) {
        result.filteredByLowConfidence++;
        if (result.samplesLowConfidence.length < 50) {
            result.samplesLowConfidence.push({
                id: cleanEmail.id,
                subject: cleanEmail.subject,
                type: classification.type,
                confidence: classification.confidence
            });
        }

        // Pipeline Filter 4: If confidence < 0.75, marked for review/rejected
        if (classification.confidence < 0.75) {
            result.filteredByVeryLowConfidence++;
        }
        return;
    }

    // If passes all filters, it's a valid application transaction
    result.applicationTransactions++;
}

main().catch(console.error);
