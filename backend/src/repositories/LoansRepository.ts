/**
 * Loans Repository
 * Data access layer for loans and loan payments
 */

import { query } from '../lib/db';

export interface LoanRow {
    id: string;
    user_id: string;
    loan_name: string;
    loan_type: string;
    lender_name: string | null;
    loan_account_number: string | null;
    principal_amount: number;
    current_outstanding: number;
    interest_rate: number;
    interest_type: string;
    emi_amount: number | null;
    tenure_months: number | null;
    emi_day_of_month: number | null;
    start_date: string;
    end_date: string | null;
    total_paid: number;
    total_interest_paid: number;
    total_principal_paid: number;
    remaining_emis: number | null;
    next_emi_date: string | null;
    last_payment_date: string | null;
    status: string;
    is_auto_debit: boolean;
    auto_debit_account_id: string | null;
    notes: string | null;
    metadata: any;
    created_at: Date;
    updated_at: Date;
}

export interface LoanPaymentRow {
    id: string;
    loan_id: string;
    user_id: string;
    payment_date: string;
    payment_amount: number;
    principal_component: number;
    interest_component: number;
    fees_component: number;
    outstanding_after: number;
    payment_type: string;
    payment_mode: string | null;
    reference_number: string | null;
    status: string;
    is_on_time: boolean;
    days_late: number;
    notes: string | null;
    created_at: Date;
}

export class LoansRepository {
    /**
     * Get all loans for user
     */
    static async findAll(userId: string, filters: { status?: string; type?: string } = {}): Promise<LoanRow[]> {
        let sql = `SELECT * FROM loans WHERE user_id = $1`;
        const params: any[] = [userId];
        let idx = 2;

        if (filters.status) {
            sql += ` AND status = $${idx++}`;
            params.push(filters.status);
        }
        if (filters.type) {
            sql += ` AND loan_type = $${idx++}`;
            params.push(filters.type);
        }

        sql += ` ORDER BY next_emi_date ASC NULLS LAST, created_at DESC`;
        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Get loan by ID
     */
    static async findById(userId: string, loanId: string): Promise<LoanRow | null> {
        const result = await query(
            `SELECT * FROM loans WHERE id = $1 AND user_id = $2`,
            [loanId, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Create a new loan
     */
    static async create(data: {
        userId: string;
        loanName: string;
        loanType: string;
        lenderName?: string;
        loanAccountNumber?: string;
        principalAmount: number;
        currentOutstanding: number;
        interestRate: number;
        interestType: string;
        emiAmount: number;
        tenureMonths: number;
        emiDayOfMonth: number;
        startDate: string;
        endDate: string;
        remainingEmis: number;
        nextEmiDate: string;
        isAutoDebit: boolean;
        autoDebitAccountId?: string;
        notes?: string;
        metadata?: any;
    }): Promise<LoanRow> {
        const result = await query(
            `INSERT INTO loans (
                user_id, loan_name, loan_type, lender_name, loan_account_number,
                principal_amount, current_outstanding, interest_rate, interest_type,
                emi_amount, tenure_months, emi_day_of_month, start_date, end_date,
                remaining_emis, next_emi_date, is_auto_debit, auto_debit_account_id,
                notes, metadata, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'active'
            )
            RETURNING *`,
            [
                data.userId,
                data.loanName,
                data.loanType,
                data.lenderName || null,
                data.loanAccountNumber || null,
                data.principalAmount,
                data.currentOutstanding,
                data.interestRate,
                data.interestType,
                data.emiAmount,
                data.tenureMonths,
                data.emiDayOfMonth,
                data.startDate,
                data.endDate,
                data.remainingEmis,
                data.nextEmiDate,
                data.isAutoDebit,
                data.autoDebitAccountId || null,
                data.notes || null,
                data.metadata ? JSON.stringify(data.metadata) : '{}',
            ]
        );
        return result.rows[0];
    }

    /**
     * Update a loan
     */
    static async update(loanId: string, userId: string, data: {
        loanName?: string;
        lenderName?: string;
        loanAccountNumber?: string;
        interestRate?: number;
        emiAmount?: number;
        emiDayOfMonth?: number;
        isAutoDebit?: boolean;
        autoDebitAccountId?: string;
        notes?: string;
        metadata?: any;
    }): Promise<LoanRow | null> {
        const result = await query(
            `UPDATE loans SET
                loan_name = COALESCE($3, loan_name),
                lender_name = COALESCE($4, lender_name),
                loan_account_number = COALESCE($5, loan_account_number),
                interest_rate = COALESCE($6, interest_rate),
                emi_amount = COALESCE($7, emi_amount),
                emi_day_of_month = COALESCE($8, emi_day_of_month),
                is_auto_debit = COALESCE($9, is_auto_debit),
                auto_debit_account_id = COALESCE($10, auto_debit_account_id),
                notes = COALESCE($11, notes),
                metadata = COALESCE($12::jsonb, metadata),
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING *`,
            [
                loanId,
                userId,
                data.loanName,
                data.lenderName,
                data.loanAccountNumber,
                data.interestRate,
                data.emiAmount,
                data.emiDayOfMonth,
                data.isAutoDebit,
                data.autoDebitAccountId,
                data.notes,
                data.metadata ? JSON.stringify(data.metadata) : null,
            ]
        );
        return result.rows[0] || null;
    }

    /**
     * Close a loan
     */
    static async close(loanId: string, userId: string): Promise<void> {
        await query(
            `UPDATE loans SET status = 'closed', updated_at = NOW() WHERE id = $1 AND user_id = $2`,
            [loanId, userId]
        );
    }

    /**
     * Get loan payments
     */
    static async getPayments(loanId: string, status?: string): Promise<LoanPaymentRow[]> {
        let sql = `SELECT * FROM loan_payments WHERE loan_id = $1`;
        const params: any[] = [loanId];

        if (status) {
            sql += ` AND status = $2`;
            params.push(status);
        }

        sql += ` ORDER BY payment_date`;
        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Create a loan payment
     */
    static async createPayment(data: {
        loanId: string;
        userId: string;
        paymentDate: string;
        paymentAmount: number;
        principalComponent: number;
        interestComponent: number;
        feesComponent: number;
        outstandingAfter: number;
        paymentType: string;
        paymentMode?: string;
        referenceNumber?: string;
        isOnTime: boolean;
        daysLate: number;
        notes?: string;
    }): Promise<LoanPaymentRow> {
        const result = await query(
            `INSERT INTO loan_payments (
                loan_id, user_id, payment_date, payment_amount,
                principal_component, interest_component, fees_component,
                outstanding_after, payment_type, payment_mode, reference_number,
                status, is_on_time, days_late, notes
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'completed', $12, $13, $14
            )
            RETURNING *`,
            [
                data.loanId,
                data.userId,
                data.paymentDate,
                data.paymentAmount,
                data.principalComponent,
                data.interestComponent,
                data.feesComponent,
                data.outstandingAfter,
                data.paymentType,
                data.paymentMode || null,
                data.referenceNumber || null,
                data.isOnTime,
                data.daysLate,
                data.notes || null,
            ]
        );
        return result.rows[0];
    }

    /**
     * Update loan after payment
     */
    static async updateAfterPayment(
        loanId: string,
        userId: string,
        data: {
            currentOutstanding: number;
            paymentAmount: number;
            principalComponent: number;
            interestComponent: number;
            remainingEmis: number | null;
            nextEmiDate: string | null;
            paymentDate: string;
        }
    ): Promise<void> {
        await query(
            `UPDATE loans SET
                current_outstanding = $3,
                total_paid = total_paid + $4,
                total_principal_paid = total_principal_paid + $5,
                total_interest_paid = total_interest_paid + $6,
                remaining_emis = $7,
                next_emi_date = $8,
                last_payment_date = $9,
                status = CASE WHEN $3 <= 0 THEN 'closed' ELSE status END,
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2`,
            [
                loanId,
                userId,
                data.currentOutstanding,
                data.paymentAmount,
                data.principalComponent,
                data.interestComponent,
                data.currentOutstanding <= 0 ? 0 : data.remainingEmis,
                data.currentOutstanding <= 0 ? null : data.nextEmiDate,
                data.paymentDate,
            ]
        );
    }

    /**
     * Get payment history for a loan
     */
    static async getPaymentHistory(loanId: string, userId: string): Promise<LoanPaymentRow[]> {
        const result = await query(
            `SELECT * FROM loan_payments WHERE loan_id = $1 AND user_id = $2 ORDER BY payment_date DESC`,
            [loanId, userId]
        );
        return result.rows;
    }

    /**
     * Get loans summary
     */
    static async getSummary(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT 
                loan_type,
                status,
                COUNT(*) as count,
                SUM(current_outstanding) as outstanding,
                SUM(emi_amount) as monthly_emi,
                json_agg(json_build_object(
                    'loanId', id,
                    'loanName', loan_name,
                    'emiAmount', emi_amount,
                    'dueDate', next_emi_date
                )) FILTER (WHERE next_emi_date IS NOT NULL AND status = 'active') as upcoming
            FROM loans
            WHERE user_id = $1
            GROUP BY loan_type, status`,
            [userId]
        );
        return result.rows;
    }
}
