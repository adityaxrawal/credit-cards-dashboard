import { StatementParserFactory } from './StatementParserFactory';
import { StatementReconciler } from './StatementReconciler';
import { ExtractedStatement, ReconciliationStats } from '../../types/statement.types';
import { AppError } from '../../utils/AppError';

export class StatementService {
    /**
     * Process an uploaded statement file
     * 1. Detect/Select Parser
     * 2. Parse File
     * 3. Reconcile with existing transactions
     */
    static async processStatement(
        userId: string,
        fileBuffer: Buffer,
        fileName: string,
        bankName: string,
        password?: string
    ): Promise<{ statement: ExtractedStatement; stats: ReconciliationStats }> {

        // 1. Process Statement (Unlock, Identify, Parse) using Factory
        const statement = await StatementParserFactory.process(fileBuffer, password ? [password] : []);

        if (!statement) {
            throw new AppError(`Failed to parse statement. Password might be incorrect or format not supported.`, 400);
        }

        // 3. Reconcile
        const stats = await StatementReconciler.reconcile(statement, userId);

        return {
            statement,
            stats
        };
    }
}
