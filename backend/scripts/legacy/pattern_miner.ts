import fs from 'fs';
process.env.JWT_SECRET = 'test';
process.env.JWT_REFRESH_SECRET = 'test';
process.env.OPENAI_API_KEY = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
import path from 'path';
import readline from 'readline';
import { EnhancedRuleClassifier } from '../services/transactions/classification/EnhancedRuleClassifier';
import { CleanEmail } from '@shared/types/transaction.types';

const DUMP_FILE_PATH = path.join(process.cwd(), 'emails_dump.json');
const MAX_PROCESS = 10000; // Increase to look at more emails

interface Cluster {
    count: number;
    examples: { subject: string; bodySnippet: string, id: string }[];
}

async function main() {
    console.log(`Starting Pattern Mining on first ${MAX_PROCESS} emails...`);

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
    let unclassifiedCount = 0;

    // Clustering maps
    const senderClusters = new Map<string, Cluster>();
    const subjectClusters = new Map<string, Cluster>();

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
                const cleanEmail: CleanEmail = {
                    id: currentId || 'test',
                    subject: currentSubject,
                    cleanedBody: currentBody.substring(0, 1000),
                    from: currentFrom,
                    internalDate: Date.now(),
                    hasAttachments: false
                };

                const result = EnhancedRuleClassifier.classify(cleanEmail);

                count++;

                // We are looking for UNCLASSIFIED emails
                if (!result || result.type === 'unclassified') {
                    unclassifiedCount++;

                    // 1. Cluster by Sender
                    const senderKey = cleanEmail.from.toLowerCase();
                    if (!senderClusters.has(senderKey)) {
                        senderClusters.set(senderKey, { count: 0, examples: [] });
                    }
                    const sCluster = senderClusters.get(senderKey)!;
                    sCluster.count++;
                    if (sCluster.examples.length < 5) {
                        sCluster.examples.push({
                            subject: cleanEmail.subject,
                            bodySnippet: cleanEmail.cleanedBody.substring(0, 100).replace(/\n/g, ' '),
                            id: cleanEmail.id
                        });
                    }

                    // 2. Cluster by Subject (simplify by removing numbers and specific IDs)
                    // "Transaction Alert: INR 500.00 debited" -> "Transaction Alert: INR debited"
                    const simplifiedSubject = cleanEmail.subject
                        .replace(/[0-9,.]+/g, '#NUM#')
                        .replace(/x{2,}[0-9]+/g, '#CARD#')
                        .trim();

                    if (!subjectClusters.has(simplifiedSubject)) {
                        subjectClusters.set(simplifiedSubject, { count: 0, examples: [] });
                    }
                    const subCluster = subjectClusters.get(simplifiedSubject)!;
                    subCluster.count++;
                    if (subCluster.examples.length < 5) {
                        subCluster.examples.push({
                            subject: cleanEmail.subject,
                            bodySnippet: cleanEmail.cleanedBody.substring(0, 100).replace(/\n/g, ' '),
                            id: cleanEmail.id
                        });
                    }
                }

                if (count >= MAX_PROCESS) break;
            }
        }
    }

    console.log(`\nAnalysis Complete.`);
    console.log(`Processed: ${count}`);
    console.log(`Unclassified: ${unclassifiedCount} (${(unclassifiedCount / count * 100).toFixed(1)}%)`);
    console.log(`\n==========================================`);
    console.log(`TOP UNCLASSIFIED SENDERS`);
    console.log(`==========================================`);

    // Sort senders by count
    const sortedSenders = [...senderClusters.entries()].sort((a, b) => b[1].count - a[1].count);

    sortedSenders.slice(0, 15).forEach(([sender, cluster]) => {
        console.log(`\n[${cluster.count}] Sender: ${sender}`);
        cluster.examples.forEach(ex => {
            console.log(`   - ${ex.subject}  (ID: ${ex.id})`);
            // console.log(`     Body: ${ex.bodySnippet}`);
        });
    });

    console.log(`\n==========================================`);
    console.log(`TOP UNCLASSIFIED SUBJECT PATTERNS`);
    console.log(`==========================================`);

    // Sort subjects by count
    const sortedSubjects = [...subjectClusters.entries()].sort((a, b) => b[1].count - a[1].count);

    sortedSubjects.slice(0, 15).forEach(([subject, cluster]) => {
        console.log(`\n[${cluster.count}] Pattern: ${subject}`);
        console.log(`   Example: ${cluster.examples[0].subject}`);
    });
}

main().catch(console.error);
