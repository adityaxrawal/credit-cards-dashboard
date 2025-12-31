import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { LoansService } from '../services/loans/loans.service';

const loansService = new LoansService();

/**
 * Get all loans for user
 */
export async function getAllLoans(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { status, type } = req.query;
        const loans = await loansService.getAll(userId, {
            status: status as string,
            type: type as string,
        });
        res.json({ data: loans });
    } catch (error) {
        next(error);
    }
}

/**
 * Get loan by ID with full details
 */
export async function getLoanById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const loan = await loansService.getById(userId, id);
        if (!loan) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Loan not found' } });
        }
        res.json({ data: loan });
    } catch (error) {
        next(error);
    }
}

/**
 * Create new loan
 */
export async function createLoan(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const loan = await loansService.create(userId, req.body);
        res.status(201).json({ data: loan });
    } catch (error) {
        next(error);
    }
}

/**
 * Update loan
 */
export async function updateLoan(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const loan = await loansService.update(userId, id, req.body);
        if (!loan) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Loan not found' } });
        }
        res.json({ data: loan });
    } catch (error) {
        next(error);
    }
}

/**
 * Close/delete loan
 */
export async function deleteLoan(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await loansService.close(userId, id);
        res.json({ message: 'Loan closed successfully' });
    } catch (error) {
        next(error);
    }
}

/**
 * Get amortization schedule for a loan
 */
export async function getAmortization(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const schedule = await loansService.getAmortizationSchedule(userId, id);
        res.json({ data: schedule });
    } catch (error) {
        next(error);
    }
}

/**
 * Record a loan payment
 */
export async function recordPayment(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const payment = await loansService.recordPayment(userId, id, req.body);
        res.status(201).json({ data: payment });
    } catch (error) {
        next(error);
    }
}

/**
 * Get payment history for a loan
 */
export async function getPaymentHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const payments = await loansService.getPaymentHistory(userId, id);
        res.json({ data: payments });
    } catch (error) {
        next(error);
    }
}

/**
 * Calculate prepayment impact
 */
export async function calculatePrepayment(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { amount, reduceEmi, reduceTenure } = req.body;
        const impact = await loansService.calculatePrepaymentImpact(userId, id, {
            amount,
            reduceEmi,
            reduceTenure,
        });
        res.json({ data: impact });
    } catch (error) {
        next(error);
    }
}

/**
 * Get loans summary
 */
export async function getLoansSummary(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user.id;
        const summary = await loansService.getSummary(userId);
        res.json({ data: summary });
    } catch (error) {
        next(error);
    }
}
