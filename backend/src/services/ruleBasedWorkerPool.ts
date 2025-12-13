import Piscina from 'piscina';
import path from 'path';
import { ExtractionInput } from './extraction.service';

interface WorkerResult {
    status: string;
    result?: any;
    error?: string;
    workerId: number;
    queueId?: number;
}

export class RuleBasedWorkerPool {
    private pool: Piscina;
    private workerCount: number;

    constructor(workerCount: number = 4) {
        this.workerCount = workerCount;
        const isTs = __filename.endsWith('.ts');
        const filename = isTs
            ? path.resolve(__dirname, 'workers/ruleBased.worker.ts')
            : path.resolve(__dirname, 'workers/ruleBased.worker.js');

        const options: any = {
            filename,
            maxThreads: workerCount,
            minThreads: workerCount,
            idleTimeout: 30000
        };

        if (isTs) {
            options.workerData = { path: filename };
            options.execArgv = ['-r', 'ts-node/register'];
        }

        this.pool = new Piscina(options);
    }

    async processEmail(userId: string, email: ExtractionInput, workerId: number): Promise<WorkerResult> {
        try {
            const result = await this.pool.run({ userId, email, workerId });

            // Route failure to queue based on workerId
            // Logic: Worker 1 -> Q1, Worker 2 -> Q2, Worker 3 -> Q3, Worker 4 -> Q1
            let queueId: number | undefined;

            if (result.status !== 'success' && result.status !== 'ignored' && result.status !== 'duplicate' && result.status !== 'already_processed') {
                if (workerId === 1) queueId = 1;
                else if (workerId === 2) queueId = 2;
                else if (workerId === 3) queueId = 3;
                else if (workerId === 4) queueId = 1; // Round robin back to 1
            }

            return {
                ...result,
                queueId
            };
        } catch (error: any) {
            console.error('Worker Pool Error:', error);
            return {
                status: 'error',
                error: error.message,
                workerId,
                queueId: workerId === 4 ? 1 : workerId // Fail safe routing
            };
        }
    }

    async destroy() {
        await this.pool.destroy();
    }

    getStats() {
        return {
            queueSize: this.pool.queueSize,
            utilization: this.pool.utilization,
            completed: this.pool.completed
        };
    }
}

export const ruleBasedWorkerPool = new RuleBasedWorkerPool();
