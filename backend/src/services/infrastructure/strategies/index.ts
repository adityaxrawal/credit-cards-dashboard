/**
 * Flush Strategies - Barrel Export
 * 
 * Exports all flush strategies and the default strategy array.
 * Part of Strategy Pattern refactoring for DbWriteQueueManager (Issue #9).
 */

export { FlushStrategy } from './FlushStrategy';
export { ScannedEmailsFlushStrategy } from './ScannedEmailsFlushStrategy';
export { ProcessingLogsFlushStrategy } from './ProcessingLogsFlushStrategy';
export { TransactionsFlushStrategy } from './TransactionsFlushStrategy';
export { TerminationsFlushStrategy } from './TerminationsFlushStrategy';
export { JobStatsFlushStrategy } from './JobStatsFlushStrategy';
export { ScannedEmailUpdatesFlushStrategy } from './ScannedEmailUpdatesFlushStrategy';

import { FlushStrategy } from './FlushStrategy';
import { ScannedEmailsFlushStrategy } from './ScannedEmailsFlushStrategy';
import { ProcessingLogsFlushStrategy } from './ProcessingLogsFlushStrategy';
import { TransactionsFlushStrategy } from './TransactionsFlushStrategy';
import { TerminationsFlushStrategy } from './TerminationsFlushStrategy';
import { JobStatsFlushStrategy } from './JobStatsFlushStrategy';
import { ScannedEmailUpdatesFlushStrategy } from './ScannedEmailUpdatesFlushStrategy';

/**
 * Default strategies for DbWriteQueueManager
 * These are instantiated and registered automatically in the singleton
 */
export const defaultStrategies: FlushStrategy[] = [
    new ScannedEmailsFlushStrategy(),
    new ProcessingLogsFlushStrategy(),
    new TransactionsFlushStrategy(),
    new TerminationsFlushStrategy(),
    new JobStatsFlushStrategy(),
    new ScannedEmailUpdatesFlushStrategy(),
];
