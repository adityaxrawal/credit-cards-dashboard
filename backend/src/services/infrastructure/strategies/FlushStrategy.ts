/**
 * FlushStrategy Interface
 * 
 * Defines the contract for table-specific flush implementations.
 * Part of Strategy Pattern refactoring of DbWriteQueueManager (Issue #9).
 */

import { DbWriteJob, DbWriteTable } from '../DbWriteQueueManager';

/**
 * Interface for flush strategies
 * Each strategy encapsulates the logic for flushing a specific table type
 */
export interface FlushStrategy {
    /** The table this strategy handles */
    readonly table: DbWriteTable;

    /**
     * Flush the queued jobs to the database
     * @param jobs - Array of jobs to flush
     */
    flush(jobs: DbWriteJob[]): Promise<void>;
}
