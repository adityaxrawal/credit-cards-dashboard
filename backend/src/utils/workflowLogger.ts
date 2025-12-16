
import logger from './logger';

export type WorkflowStage =
    | 'FETCH'
    | 'SANITIZE'
    | 'FILTER'
    | 'RULE_PROCESSING'
    | 'GPT_PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'ITEM_FAILED';

export interface WorkflowLogContext {
    jobId?: string;
    batchId?: string;
    count?: number;
    durationMs?: number;
    error?: any;
    [key: string]: any;
}

export class WorkflowLogger {
    static log(stage: WorkflowStage, message: string, context: WorkflowLogContext = {}) {
        const { jobId, ...rest } = context;
        const prefix = `[Job:${jobId || 'N/A'}][${stage}]`;

        logger.info(`${prefix} ${message}`, rest);
    }

    static error(stage: WorkflowStage, message: string, error: any, context: WorkflowLogContext = {}) {
        const { jobId, ...rest } = context;
        const prefix = `[Job:${jobId || 'N/A'}][${stage}]`;

        logger.error(`${prefix} ${message}`, { ...rest, error: error instanceof Error ? error.message : error });
    }

    static debug(stage: WorkflowStage, message: string, context: WorkflowLogContext = {}) {
        const { jobId, ...rest } = context;
        const prefix = `[Job:${jobId || 'N/A'}][${stage}]`;
        logger.debug(`${prefix} ${message}`, rest);
    }
}
