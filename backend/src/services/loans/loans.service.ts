import { LoansRepository, LoanRow, LoanPaymentRow } from '../../repositories/LoansRepository';
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
        const rows = await LoansRepository.findAll(userId, filters);
        return rows.map(this.mapToLoan);
    }

    /**
     * Get loan by ID
     */
    async getById(userId: string, loanId: string): Promise<Loan | null> {
        const row = await LoansRepository.findById(userId, loanId);
        if (!row) return null;
        return this.mapToLoan(row);
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

        const row = await LoansRepository.create({
            userId,
            loanName: input.loanName,
            loanType: input.loanType,
            lenderName: input.lenderName,
            loanAccountNumber: input.loanAccountNumber,
            principalAmount: input.principalAmount,
            currentOutstanding: input.principalAmount,
            interestRate: input.interestRate,
            interestType: input.interestType || 'fixed',
            emiAmount,
            tenureMonths,
            emiDayOfMonth: input.emiDayOfMonth || startDate.getDate(),
            startDate: input.startDate,
            endDate: format(endDate, 'yyyy-MM-dd'),
            remainingEmis: tenureMonths,
            nextEmiDate: format(nextEmiDate, 'yyyy-MM-dd'),
            isAutoDebit: input.isAutoDebit || false,
            autoDebitAccountId: input.autoDebitAccountId,
            notes: input.notes,
            metadata: input.metadata || {},
        });

        return this.mapToLoan(row);
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

        const row = await LoansRepository.update(loanId, userId, {
            loanName: input.loanName,
            lenderName: input.lenderName,
            loanAccountNumber: input.loanAccountNumber,
            interestRate: input.interestRate,
            emiAmount: input.emiAmount,
            emiDayOfMonth: input.emiDayOfMonth,
            isAutoDebit: input.isAutoDebit,
            autoDebitAccountId: input.autoDebitAccountId,
            notes: input.notes,
            metadata: input.metadata,
        });

        return row ? this.mapToLoan(row) : null;
    }

    /**
     * Close a loan
     */
    async close(userId: string, loanId: string): Promise<void> {
        await LoansRepository.close(loanId, userId);
    }

    /**
     * Get amortization schedule
     */
    async getAmortizationSchedule(userId: string, loanId: string): Promise<AmortizationEntry[]> {
        const loan = await this.getById(userId, loanId);
        if (!loan) throw new Error('Loan not found');

        // Get existing payments
        const payments = await LoansRepository.getPayments(loanId, 'completed');

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
        const paymentRow = await LoansRepository.createPayment({
            loanId,
            userId,
            paymentDate: input.paymentDate,
            paymentAmount: input.paymentAmount,
            principalComponent,
            interestComponent,
            feesComponent: input.feesComponent || 0,
            outstandingAfter,
            paymentType: input.paymentType || 'emi',
            paymentMode: input.paymentMode,
            referenceNumber: input.referenceNumber,
            isOnTime: daysLate === 0,
            daysLate,
            notes: input.notes,
        });

        // Update loan
        const nextEmiDate = loan.nextEmiDate
            ? format(addMonths(new Date(loan.nextEmiDate), 1), 'yyyy-MM-dd')
            : null;
        const remainingEmis = Math.max(0, (loan.remainingEmis || 0) - 1);

        await LoansRepository.updateAfterPayment(loanId, userId, {
            currentOutstanding: outstandingAfter,
            paymentAmount: input.paymentAmount,
            principalComponent,
            interestComponent,
            remainingEmis: outstandingAfter <= 0 ? 0 : remainingEmis,
            nextEmiDate: outstandingAfter <= 0 ? null : nextEmiDate,
            paymentDate: input.paymentDate,
        });

        return this.mapToPayment(paymentRow);
    }

    /**
     * Get payment history
     */
    async getPaymentHistory(userId: string, loanId: string): Promise<LoanPayment[]> {
        const rows = await LoansRepository.getPaymentHistory(loanId, userId);
        return rows.map(this.mapToPayment);
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
        const rows = await LoansRepository.getSummary(userId);

        const byType: Record<string, { count: number; outstanding: number; monthlyEmi: number }> = {};
        let totalLoans = 0;
        let activeLoans = 0;
        let totalOutstanding = 0;
        let totalMonthlyEmi = 0;
        const upcomingEmis: LoansSummary['upcomingEmis'] = [];

        for (const row of rows) {
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

    private mapToLoan(row: LoanRow): Loan {
        return {
            id: row.id,
            userId: row.user_id,
            loanName: row.loan_name,
            loanType: row.loan_type,
            lenderName: row.lender_name ?? undefined,
            loanAccountNumber: row.loan_account_number ?? undefined,
            principalAmount: parseFloat(String(row.principal_amount)) || 0,
            currentOutstanding: parseFloat(String(row.current_outstanding)) || 0,
            interestRate: parseFloat(String(row.interest_rate)) || 0,
            interestType: row.interest_type || 'fixed',
            emiAmount: row.emi_amount ? parseFloat(String(row.emi_amount)) : undefined,
            tenureMonths: row.tenure_months ?? undefined,
            emiDayOfMonth: row.emi_day_of_month ?? undefined,
            startDate: row.start_date,
            endDate: row.end_date ?? undefined,
            totalPaid: parseFloat(String(row.total_paid)) || 0,
            totalInterestPaid: parseFloat(String(row.total_interest_paid)) || 0,
            totalPrincipalPaid: parseFloat(String(row.total_principal_paid)) || 0,
            remainingEmis: row.remaining_emis ?? undefined,
            nextEmiDate: row.next_emi_date ?? undefined,
            lastPaymentDate: row.last_payment_date ?? undefined,
            status: row.status,
            isAutoDebit: row.is_auto_debit || false,
            autoDebitAccountId: row.auto_debit_account_id ?? undefined,
            notes: row.notes ?? undefined,
            metadata: row.metadata ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    private mapToPayment(row: LoanPaymentRow): LoanPayment {
        return {
            id: row.id,
            loanId: row.loan_id,
            paymentDate: row.payment_date,
            paymentAmount: parseFloat(String(row.payment_amount)) || 0,
            principalComponent: parseFloat(String(row.principal_component)) || 0,
            interestComponent: parseFloat(String(row.interest_component)) || 0,
            feesComponent: parseFloat(String(row.fees_component)) || 0,
            outstandingAfter: parseFloat(String(row.outstanding_after)) || 0,
            paymentType: row.payment_type,
            paymentMode: row.payment_mode ?? undefined,
            referenceNumber: row.reference_number ?? undefined,
            status: row.status,
            isOnTime: row.is_on_time,
            daysLate: row.days_late || 0,
            notes: row.notes ?? undefined,
            createdAt: row.created_at,
        };
    }
}
