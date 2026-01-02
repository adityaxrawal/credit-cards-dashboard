/**
 * Service Interfaces
 * 
 * Type-safe interfaces for dependency injection.
 * Controllers depend on these interfaces, not concrete implementations.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

// ============================================
// GMAIL SERVICE INTERFACE
// ============================================

export interface IGmailService {
    getConnectionStatus(userId: string): Promise<any>;

    connectGmail(userId: string, refreshToken: string): Promise<any>;

    disconnectGmail(userId: string): Promise<any>;

    triggerHistoricalScan(
        userId: string,
        fromDate?: Date,
        toDate?: Date
    ): Promise<any>;

    getHistoricalScanStatus(userId: string, jobId: string): Promise<any>;

    getLatestJob(userId: string): Promise<any>;

    getLastSuccessfulSync(userId: string): Promise<Date | null>;

    manualMap(
        userId: string,
        messageId: string,
        cardInfo: { last4: string; bankName: string }
    ): Promise<any>;

    getTerminatorReport(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<any>;

    getPipelineStats(userId: string): Promise<any>;

    reprocessSingleEmail(userId: string, messageId: string): Promise<any>;

    processManualStatement(
        userId: string,
        data: {
            cardId: string;
            statementMonth: number;
            statementYear: number;
            pdfBase64: string;
            password?: string;
        }
    ): Promise<any>;

    triggerIncrementalSync(userId: string): Promise<any>;

    getIngestionLogs(
        userId: string,
        options: {
            page: number;
            limit: number;
            status?: string;
            search?: string;
        }
    ): Promise<any>;
}

// ============================================
// TRANSACTION SERVICE INTERFACE
// ============================================

export interface ITransactionService {
    getTransactions(
        userId: string,
        filters: {
            page?: number;
            limit?: number;
            instrument_id?: string;
            category?: string;
            start_date?: string;
            end_date?: string;
            type?: string;
            search?: string;
        }
    ): Promise<any>;

    getTransactionById(userId: string, transactionId: string): Promise<any>;

    createTransaction(userId: string, data: any): Promise<any>;

    updateTransaction(userId: string, transactionId: string, data: any): Promise<any>;

    deleteTransaction(userId: string, transactionId: string): Promise<any>;

    getTransactionsByType(userId: string, type: string): Promise<any>;

    getTransactionsByInstrument(userId: string, instrumentId: string): Promise<any>;

    getPendingReviewQueue(userId: string): Promise<any>;

    manuallyClassify(
        userId: string,
        transactionId: string,
        classification: any
    ): Promise<any>;

    bulkUpdate(userId: string, transactionIds: string[], updates: any): Promise<any>;

    bulkDelete(userId: string, transactionIds: string[]): Promise<any>;

    mergeTransactions(
        userId: string,
        primaryId: string,
        secondaryIds: string[]
    ): Promise<any>;
}

// ============================================
// AUTH SERVICE INTERFACE
// ============================================

export interface IAuthService {
    verifyGoogleToken(token: string): Promise<{
        email: string;
        name: string;
        picture?: string;
        googleId: string;
    }>;
}

// ============================================
// SESSION SERVICE INTERFACE
// ============================================

export interface ISessionService {
    createSession(
        userId: string,
        deviceInfo: any,
        ipAddress: string
    ): Promise<{ sessionId: string; token: string }>;

    validateSession(sessionId: string): Promise<boolean>;

    revokeSession(userId: string, sessionId: string): Promise<void>;

    revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void>;

    getActiveSessions(userId: string): Promise<any[]>;
}

// ============================================
// USER REPOSITORY INTERFACE
// ============================================

export interface IUserRepository {
    findById(id: string): Promise<any>;
    findByEmail(email: string): Promise<any>;
    findByGoogleId(googleId: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    updateRefreshToken?(id: string, token: string): Promise<any>;
}
