import { query } from '../lib/db';

export class LoanRepository {
    /**
     * Find active loans for a user
     */
    static async findActiveByUserId(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT id, loan_name, lender_name, emi_amount, emi_day, 
                  current_outstanding, remaining_emis, next_emi_date
           FROM loans 
           WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Find active loans with passed EMI date
     */
    static async findWithPassedEmiDate(date: string): Promise<any[]> {
        const result = await query(
            `SELECT id, emi_day, next_emi_date 
       FROM loans 
       WHERE status = 'active' 
       AND deleted_at IS NULL
       AND next_emi_date < $1`,
            [date]
        );
        return result.rows;
    }

    /**
     * Update next EMI date
     */
    static async updateNextEmiDate(loanId: string, nextEmiDate: string): Promise<void> {
        await query(
            'UPDATE loans SET next_emi_date = $1 WHERE id = $2',
            [nextEmiDate, loanId]
        );
    }
}
