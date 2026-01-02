import fs from 'fs';
import path from 'path';
import { UnclassifiedRecord, CleanEmail } from '@shared/types/transaction.types';
import logger from '@shared/utils/infrastructure/logger';

// For now, simpler than a DB migration, we use a JSON file store
// This allows the user to easily inspect it or even edit it manually
const DATA_FILE = path.join(process.cwd(), 'unclassified_emails.json');

export class UnclassifiedRepository {
    private static cache: UnclassifiedRecord[] = [];
    private static loaded = false;

    private static load(): void {
        if (this.loaded) return;
        try {
            if (fs.existsSync(DATA_FILE)) {
                const data = fs.readFileSync(DATA_FILE, 'utf8');
                this.cache = JSON.parse(data, (key, value) => {
                    if (key.endsWith('At')) return new Date(value);
                    return value;
                });
            }
        } catch (error) {
            logger.error('Failed to load unclassified records', error);
            this.cache = [];
        }
        this.loaded = true;
    }

    private static save(): void {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.cache, null, 2));
        } catch (error) {
            logger.error('Failed to save unclassified records', error);
        }
    }

    static async add(cleanEmail: CleanEmail, potentialCategory?: string): Promise<void> {
        this.load();

        // Dedup
        if (this.cache.some(r => r.emailId === cleanEmail.id)) {
            return;
        }

        const record: UnclassifiedRecord = {
            id: crypto.randomUUID(),
            emailId: cleanEmail.id,
            from: cleanEmail.from,
            subject: cleanEmail.subject,
            bodySnippet: cleanEmail.cleanedBody.substring(0, 200).replace(/\n/g, ' '),
            receivedAt: new Date(cleanEmail.internalDate),
            analyzedAt: new Date(),
            potentialCategory
        };

        this.cache.unshift(record); // Newest first

        // Limit size
        if (this.cache.length > 1000) {
            this.cache = this.cache.slice(0, 1000);
        }

        this.save();
    }

    static async getAll(): Promise<UnclassifiedRecord[]> {
        this.load();
        return this.cache;
    }

    static async getById(id: string): Promise<UnclassifiedRecord | undefined> {
        this.load();
        return this.cache.find(r => r.id === id);
    }

    static async remove(id: string): Promise<void> {
        this.load();
        this.cache = this.cache.filter(r => r.id !== id);
        this.save();
    }
}
