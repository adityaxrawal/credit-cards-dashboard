import pool from '../../lib/db';
import { addMonths, format, differenceInDays } from 'date-fns';

export interface LoanInput {
    loanName: string;
    loanType: string;
    lenderName?: string;
    loanAccountNumber?: string;
    principalAmount: number;
    interestRate: number;
    interestType?: 'fixed' | 'floating';
    emiAmount?: number;
    tenureMonths?: number;
    emiDayOfMonth?: number;
    startDate: string;
    isAutoDebit?: boolean;
    autoDebitAccountId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
}

export interface Loan {
    id: string;
    userId: string;
    loanName: string;
    loanType: string;
    lenderName?: string;
    loanAccountNumber?: string;
    principalAmount: number;
    currentOutstanding: number;
    interestRate: number;
    interestType: string;
    emiAmount?: number;
    tenureMonths?: number;
    emiDayOfMonth?: number;
    startDate: string;
    endDate?: string;
    totalPaid: number;
    totalInterestPaid: number;
    totalPrincipalPaid: number;
    remainingEmis?: number;
    nextEmiDate?: string;
    lastPaymentDate?: string;
    status: string;
    isAutoDebit: boolean;
    autoDebitAccountId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface LoanPaymentInput {
    paymentDate: string;
    paymentAmount: number;
    principalComponent?: number;
    interestComponent?: number;
    feesComponent?: number;
    paymentType?: 'emi' | 'prepayment' | 'partial' | 'final' | 'penalty';
    paymentMode?: string;
    referenceNumber?: string;
    notes?: string;
}

export interface LoanPayment {
    id: string;
    loanId: string;
    paymentDate: string;
    paymentAmount: number;
    principalComponent: number;
    interestComponent: number;
    feesComponent: number;
    outstandingAfter: number;
    paymentType: string;
    paymentMode?: string;
    referenceNumber?: string;
    status: string;
    isOnTime: boolean;
    daysLate: number;
    notes?: string;
    createdAt: Date;
}

export interface AmortizationEntry {
    emiNumber: number;
    dueDate: string;
    openingBalance: number;
    emiAmount: number;
    principalComponent: number;
    interestComponent: number;
    closingBalance: number;
    isPaid: boolean;
    paymentDate?: string;
}

export interface PrepaymentImpact {
    currentOutstanding: number;
    prepaymentAmount: number;
    newOutstanding: number;
    interestSaved: number;
    tenureReduction?: number;
    newTenureMonths?: number;
    newEmiAmount?: number;
    remainingEmis?: number;
}

export interface LoansSummary {
    totalLoans: number;
    activeLoans: number;
    totalOutstanding: number;
    totalMonthlyEmi: number;
    byType: Record<string, { count: number; outstanding: number; monthlyEmi: number }>;
    upcomingEmis: Array<{
        loanId: string;
        loanName: string;
        emiAmount: number;
        dueDate: string;
    }>;
}

export class LoansService {
    /**
     * Get all loans for a user
     */
    async getAll(
        userId: string,
        filters: { status?: string; type?: string } = {}
    ): Promise<Loan[]> {
        let query = `SELECT * FROM loans WHERE user_id = $1`;
        const params: unknown[] = [userId];
        let paramIndex = 2;

        if (filters.status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(filters.status);
        }

        if (filters.type) {
            query += ` AND loan_type = $${paramIndex++}`;
            params.push(filters.type);
        }

        query += ` ORDER BY next_emi_date ASC NULLS LAST, created_at DESC`;

        const result = await pool.query(query, params);
        return result.rows.map(this.mapToLoan);
    }

    /**
     * Get loan by ID
     */
    async getById(userId: string, loanId: string): Promise<Loan | null> {
        const query = `SELECT * FROM loans WHERE id = $1 AND user_id = $2`;
        const result = await pool.query(query, [loanId, userId]);

        if (result.rows.length === 0) return null;
        return this.mapToLoan(result.rows[0]);
    }

    /**
     * Create a new loan
     */
    async create(userId: string, input: LoanInput): Promise<Loan> {
        // Calculate EMI if not provided
        const emiAmount = input.emiAmount || this.calculateEMI(
            input.principalAmount,
            input.interestRate,
            input.tenureMonths || 12
        );

        // Calculate tenure if EMI is provided but tenure is not
        const tenureMonths = input.tenureMonths || this.calculateTenure(
            input.principalAmount,
            input.interestRate,
            input.emiAmount || emiAmount
        );

        // Calculate end date
        const startDate = new Date(input.startDate);
        const endDate = addMonths(startDate, tenureMonths);

        // Calculate next EMI date
        const today = new Date();
        let nextEmiDate = new Date(startDate);
        if (input.emiDayOfMonth) {
            nextEmiDate.setDate(input.emiDayOfMonth);
        }
        while (nextEmiDate <= today) {
            nextEmiDate = addMonths(nextEmiDate, 1);
        }

        const query = `
      INSERT INTO loans (
        user_id, loan_name, loan_type, lender_name, loan_account_number,
        principal_amount, current_outstanding, interest_rate, interest_type,
        emi_amount, tenure_months, emi_day_of_month, start_date, end_date,
        remaining_emis, next_emi_date, is_auto_debit, auto_debit_account_id,
        notes, metadata, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'active'
      )
      RETURNING *
    `;
        const result = await pool.query(query, [
            userId,
            input.loanName,
            input.loanType,
            input.lenderName || null,
            input.loanAccountNumber || null,
            input.principalAmount,
            input.principalAmount, // current_outstanding starts at principal
            input.interestRate,
            input.interestType || 'fixed',
            emiAmount,
            tenureMonths,
            input.emiDayOfMonth || startDate.getDate(),
            input.startDate,
            format(endDate, 'yyyy-MM-dd'),
            tenureMonths,
            format(nextEmiDate, 'yyyy-MM-dd'),
            input.isAutoDebit || false,
            input.autoDebitAccountId || null,
            input.notes || null,
            JSON.stringify(input.metadata || {}),
        ]);

        return this.mapToLoan(result.rows[0]);
    }

    /**
     * Update a loan
     */
    async update(
        userId: string,
        loanId: string,
        input: Partial<LoanInput>
    ): Promise<Loan | null> {
        const existing = await this.getById(userId, loanId);
        if (!existing) return null;

        const query = `
      UPDATE loans SET
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
      RETURNING *
    `;
        const result = await pool.query(query, [
            loanId,
            userId,
            input.loanName,
            input.lenderName,
            input.loanAccountNumber,
            input.interestRate,
            input.emiAmount,
            input.emiDayOfMonth,
            input.isAutoDebit,
            input.autoDebitAccountId,
            input.notes,
            input.metadata ? JSON.stringify(input.metadata) : null,
        ]);

        return this.mapToLoan(result.rows[0]);
    }

    /**
     * Close a loan
     */
    async close(userId: string, loanId: string): Promise<void> {
        const query = `
      UPDATE loans 
      SET status = 'closed', updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `;
        await pool.query(query, [loanId, userId]);
    }

    /**
     * Get amortization schedule
     */
    async getAmortizationSchedule(userId: string, loanId: string): Promise<AmortizationEntry[]> {
        const loan = await this.getById(userId, loanId);
        if (!loan) throw new Error('Loan not found');

        // Get existing payments
        const paymentsQuery = `
      SELECT * FROM loan_payments 
      WHERE loan_id = $1 AND status = 'completed'
      ORDER BY payment_date
    `;
        const paymentsResult = await pool.query(paymentsQuery, [loanId]);
        const payments = paymentsResult.rows;

        const schedule: AmortizationEntry[] = [];
        const monthlyRate = loan.interestRate / 100 / 12;
        let balance = loan.principalAmount;
        const emiAmount = loan.emiAmount || 0;
        const startDate = new Date(loan.startDate);
        let paymentIndex = 0;

        for (let i = 1; i <= (loan.tenureMonths || 12); i++) {
            const dueDate = addMonths(startDate, i);
            const interestComponent = balance * monthlyRate;
            const principalComponent = emiAmount - interestComponent;
            const closingBalance = Math.max(0, balance - principalComponent);

            // Check if this EMI is paid
            const payment = payments[paymentIndex];
            const isPaid = payment && new Date(payment.payment_date) <= dueDate;

            schedule.push({
                emiNumber: i,
                dueDate: format(dueDate, 'yyyy-MM-dd'),
                openingBalance: Math.round(balance * 100) / 100,
                emiAmount: Math.round(emiAmount * 100) / 100,
                principalComponent: Math.round(principalComponent * 100) / 100,
                interestComponent: Math.round(interestComponent * 100) / 100,
                closingBalance: Math.round(closingBalance * 100) / 100,
                isPaid,
                paymentDate: isPaid ? format(new Date(payment.payment_date), 'yyyy-MM-dd') : undefined,
            });

            if (isPaid) paymentIndex++;
            balance = closingBalance;
            if (balance <= 0) break;
        }

        return schedule;
    }

    /**
     * Record a loan payment
     */
    async recordPayment(
        userId: string,
        loanId: string,
        input: LoanPaymentInput
    ): Promise<LoanPayment> {
        const loan = await this.getById(userId, loanId);
        if (!loan) throw new Error('Loan not found');

        // Calculate components if not provided
        const monthlyRate = loan.interestRate / 100 / 12;
        const interestComponent = input.interestComponent ??
            Math.round(loan.currentOutstanding * monthlyRate * 100) / 100;
        const principalComponent = input.principalComponent ??
            Math.round((input.paymentAmount - interestComponent - (input.feesComponent || 0)) * 100) / 100;

        const outstandingAfter = Math.max(0, loan.currentOutstanding - principalComponent);

        // Check if payment is late
        let daysLate = 0;
        if (loan.nextEmiDate) {
            const dueDate = new Date(loan.nextEmiDate);
            const paymentDate = new Date(input.paymentDate);
            daysLate = Math.max(0, differenceInDays(paymentDate, dueDate));
        }

        // Insert payment
        const insertQuery = `
      INSERT INTO loan_payments (
        loan_id, user_id, payment_date, payment_amount,
        principal_component, interest_component, fees_component,
        outstanding_after, payment_type, payment_mode, reference_number,
        status, is_on_time, days_late, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'completed', $12, $13, $14
      )
      RETURNING *
    `;
        const paymentResult = await pool.query(insertQuery, [
            loanId,
            userId,
            input.paymentDate,
            input.paymentAmount,
            principalComponent,
            interestComponent,
            input.feesComponent || 0,
            outstandingAfter,
            input.paymentType || 'emi',
            input.paymentMode || null,
            input.referenceNumber || null,
            daysLate === 0,
            daysLate,
            input.notes || null,
        ]);

        // Update loan
        const nextEmiDate = loan.nextEmiDate
            ? format(addMonths(new Date(loan.nextEmiDate), 1), 'yyyy-MM-dd')
            : null;
        const remainingEmis = Math.max(0, (loan.remainingEmis || 0) - 1);

        const updateQuery = `
      UPDATE loans SET
        current_outstanding = $3,
        total_paid = total_paid + $4,
        total_principal_paid = total_principal_paid + $5,
        total_interest_paid = total_interest_paid + $6,
        remaining_emis = $7,
        next_emi_date = $8,
        last_payment_date = $9,
        status = CASE WHEN $3 <= 0 THEN 'closed' ELSE status END,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `;
        await pool.query(updateQuery, [
            loanId,
            userId,
            outstandingAfter,
            input.paymentAmount,
            principalComponent,
            interestComponent,
            outstandingAfter <= 0 ? 0 : remainingEmis,
            outstandingAfter <= 0 ? null : nextEmiDate,
            input.paymentDate,
        ]);

        return this.mapToPayment(paymentResult.rows[0]);
    }

    /**
     * Get payment history
     */
    async getPaymentHistory(userId: string, loanId: string): Promise<LoanPayment[]> {
        const query = `
      SELECT * FROM loan_payments
      WHERE loan_id = $1 AND user_id = $2
      ORDER BY payment_date DESC
    `;
        const result = await pool.query(query, [loanId, userId]);
        return result.rows.map(this.mapToPayment);
    }

    /**
     * Calculate prepayment impact
     */
    async calculatePrepaymentImpact(
        userId: string,
        loanId: string,
        options: { amount: number; reduceEmi?: boolean; reduceTenure?: boolean }
    ): Promise<PrepaymentImpact> {
        const loan = await this.getById(userId, loanId);
        if (!loan) throw new Error('Loan not found');

        const newOutstanding = Math.max(0, loan.currentOutstanding - options.amount);
        const monthlyRate = loan.interestRate / 100 / 12;

        // Calculate interest saved
        const remainingMonths = loan.remainingEmis || 0;
        const currentTotalInterest = this.calculateTotalInterest(
            loan.currentOutstanding,
            loan.interestRate,
            remainingMonths
        );

        let newTenureMonths: number | undefined;
        let newEmiAmount: number | undefined;
        let interestSaved: number;

        if (options.reduceTenure && loan.emiAmount) {
            // Keep EMI same, reduce tenure
            newEmiAmount = loan.emiAmount;
            newTenureMonths = this.calculateTenure(newOutstanding, loan.interestRate, loan.emiAmount);
            const newTotalInterest = this.calculateTotalInterest(
                newOutstanding,
                loan.interestRate,
                newTenureMonths
            );
            interestSaved = currentTotalInterest - newTotalInterest;
        } else {
            // Keep tenure same, reduce EMI
            newTenureMonths = remainingMonths;
            newEmiAmount = this.calculateEMI(newOutstanding, loan.interestRate, remainingMonths);
            const newTotalInterest = this.calculateTotalInterest(
                newOutstanding,
                loan.interestRate,
                remainingMonths
            );
            interestSaved = currentTotalInterest - newTotalInterest;
        }

        const tenureReduction = options.reduceTenure
            ? remainingMonths - (newTenureMonths || 0)
            : undefined;

        return {
            currentOutstanding: loan.currentOutstanding,
            prepaymentAmount: options.amount,
            newOutstanding,
            interestSaved: Math.round(interestSaved * 100) / 100,
            tenureReduction,
            newTenureMonths,
            newEmiAmount: newEmiAmount ? Math.round(newEmiAmount * 100) / 100 : undefined,
            remainingEmis: newTenureMonths,
        };
    }

    /**
     * Get loans summary
     */
    async getSummary(userId: string): Promise<LoansSummary> {
        const query = `
      SELECT 
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
      GROUP BY loan_type, status
    `;
        const result = await pool.query(query, [userId]);

        const byType: Record<string, { count: number; outstanding: number; monthlyEmi: number }> = {};
        let totalLoans = 0;
        let activeLoans = 0;
        let totalOutstanding = 0;
        let totalMonthlyEmi = 0;
        const upcomingEmis: LoansSummary['upcomingEmis'] = [];

        for (const row of result.rows) {
            const count = parseInt(row.count);
            const outstanding = parseFloat(row.outstanding) || 0;
            const monthlyEmi = parseFloat(row.monthly_emi) || 0;

            if (!byType[row.loan_type]) {
                byType[row.loan_type] = { count: 0, outstanding: 0, monthlyEmi: 0 };
            }
            byType[row.loan_type].count += count;
            byType[row.loan_type].outstanding += outstanding;
            byType[row.loan_type].monthlyEmi += monthlyEmi;

            totalLoans += count;
            if (row.status === 'active') {
                activeLoans += count;
                totalOutstanding += outstanding;
                totalMonthlyEmi += monthlyEmi;
            }

            if (row.upcoming) {
                upcomingEmis.push(...row.upcoming);
            }
        }

        // Sort upcoming EMIs by date
        upcomingEmis.sort((a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        );

        return {
            totalLoans,
            activeLoans,
            totalOutstanding,
            totalMonthlyEmi,
            byType,
            upcomingEmis: upcomingEmis.slice(0, 5),
        };
    }

    /**
     * Calculate EMI using standard formula
     */
    private calculateEMI(principal: number, annualRate: number, months: number): number {
        const monthlyRate = annualRate / 100 / 12;
        if (monthlyRate === 0) return principal / months;

        const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) /
            (Math.pow(1 + monthlyRate, months) - 1);
        return Math.round(emi * 100) / 100;
    }

    /**
     * Calculate tenure given principal, rate, and EMI
     */
    private calculateTenure(principal: number, annualRate: number, emi: number): number {
        const monthlyRate = annualRate / 100 / 12;
        if (monthlyRate === 0) return Math.ceil(principal / emi);

        const months = Math.log(emi / (emi - principal * monthlyRate)) / Math.log(1 + monthlyRate);
        return Math.ceil(months);
    }

    /**
     * Calculate total interest over remaining tenure
     */
    private calculateTotalInterest(principal: number, annualRate: number, months: number): number {
        const emi = this.calculateEMI(principal, annualRate, months);
        return (emi * months) - principal;
    }

    private mapToLoan(row: Record<string, unknown>): Loan {
        return {
            id: row.id as string,
            userId: row.user_id as string,
            loanName: row.loan_name as string,
            loanType: row.loan_type as string,
            lenderName: row.lender_name as string | undefined,
            loanAccountNumber: row.loan_account_number as string | undefined,
            principalAmount: parseFloat(row.principal_amount as string) || 0,
            currentOutstanding: parseFloat(row.current_outstanding as string) || 0,
            interestRate: parseFloat(row.interest_rate as string) || 0,
            interestType: row.interest_type as string || 'fixed',
            emiAmount: row.emi_amount ? parseFloat(row.emi_amount as string) : undefined,
            tenureMonths: row.tenure_months as number | undefined,
            emiDayOfMonth: row.emi_day_of_month as number | undefined,
            startDate: row.start_date as string,
            endDate: row.end_date as string | undefined,
            totalPaid: parseFloat(row.total_paid as string) || 0,
            totalInterestPaid: parseFloat(row.total_interest_paid as string) || 0,
            totalPrincipalPaid: parseFloat(row.total_principal_paid as string) || 0,
            remainingEmis: row.remaining_emis as number | undefined,
            nextEmiDate: row.next_emi_date as string | undefined,
            lastPaymentDate: row.last_payment_date as string | undefined,
            status: row.status as string,
            isAutoDebit: row.is_auto_debit as boolean || false,
            autoDebitAccountId: row.auto_debit_account_id as string | undefined,
            notes: row.notes as string | undefined,
            metadata: row.metadata as Record<string, unknown> | undefined,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date,
        };
    }

    private mapToPayment(row: Record<string, unknown>): LoanPayment {
        return {
            id: row.id as string,
            loanId: row.loan_id as string,
            paymentDate: row.payment_date as string,
            paymentAmount: parseFloat(row.payment_amount as string) || 0,
            principalComponent: parseFloat(row.principal_component as string) || 0,
            interestComponent: parseFloat(row.interest_component as string) || 0,
            feesComponent: parseFloat(row.fees_component as string) || 0,
            outstandingAfter: parseFloat(row.outstanding_after as string) || 0,
            paymentType: row.payment_type as string,
            paymentMode: row.payment_mode as string | undefined,
            referenceNumber: row.reference_number as string | undefined,
            status: row.status as string,
            isOnTime: row.is_on_time as boolean,
            daysLate: row.days_late as number || 0,
            notes: row.notes as string | undefined,
            createdAt: row.created_at as Date,
        };
    }
}
