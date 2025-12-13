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

import { EventEmitter } from 'events';

export class RuleBasedWorkerPool extends EventEmitter {
    private pool: Piscina;
    private workerCount: number;

    constructor(workerCount: number = 4) {
        super();
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

    // Track active tasks
    private activeTasks = 0;
    private MAX_RETRIES = 3;

    async processEmail(userId: string, email: ExtractionInput, workerId: number, retryCount = 0): Promise<WorkerResult> {
        this.activeTasks++;
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

            this.decrementActiveTasks();
            return {
                ...result,
                queueId
            };
        } catch (error: any) {
            console.error(`Worker Pool Error (Attempt ${retryCount + 1}/${this.MAX_RETRIES}):`, error);

            // Retry logic
            if (retryCount < this.MAX_RETRIES) {
                // Exponential backoff
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));

                // Retry recursively (don't decrement activeTasks yet as we are continuing)
                // Actually we should decrement because we are exiting THIS function call scope?
                // No, we await the recursive call.
                this.activeTasks--; // Decrement for current call stack to avoid double counting? 
                // Wait, if I recurse, I enter processEmail again, which increments.
                // So I MUST decrement here before recursing?
                // Yes.

                return this.processEmail(userId, email, workerId, retryCount + 1);
            }

            this.decrementActiveTasks();

            // Fallback to GPT queue after retries exhausted
            return {
                status: 'error',
                error: error.message,
                workerId,
                queueId: workerId === 4 ? 1 : workerId // Fail safe routing
            };
        }
    }

    private decrementActiveTasks() {
        this.activeTasks--;
        if (this.activeTasks <= 0) {
            this.activeTasks = 0;
            this.emit('pool_drained', {
                timestamp: new Date(),
                stats: this.getStats()
            });
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
