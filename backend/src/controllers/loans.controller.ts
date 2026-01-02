import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';

export interface ILoansService {
    getAll(userId: string, filters: any): Promise<any>;
    getById(userId: string, loanId: string): Promise<any>;
    create(userId: string, data: any): Promise<any>;
    update(userId: string, loanId: string, data: any): Promise<any>;
    close(userId: string, loanId: string): Promise<void>;
    getAmortizationSchedule(userId: string, loanId: string): Promise<any>;
    recordPayment(userId: string, loanId: string, data: any): Promise<any>;
    getPaymentHistory(userId: string, loanId: string): Promise<any>;
    calculatePrepaymentImpact(userId: string, loanId: string, options: any): Promise<any>;
    getSummary(userId: string): Promise<any>;
}

export interface ILoansController {
    getAllLoans(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getLoanById(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createLoan(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateLoan(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteLoan(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getAmortization(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    recordPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getPaymentHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    calculatePrepayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getLoansSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

export function createLoansController(loansService: ILoansService): ILoansController {
    return {
        async getAllLoans(req: AuthRequest, res: Response, next: NextFunction) {
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
        },

        async getLoanById(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                const loan = await loansService.getById(userId, id);
                if (!loan) {
                    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Loan not found' } });
                    return;
                }
                res.json({ data: loan });
            } catch (error) {
                next(error);
            }
        },

        async createLoan(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const loan = await loansService.create(userId, req.body);
                res.status(201).json({ data: loan });
            } catch (error) {
                next(error);
            }
        },

        async updateLoan(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                const loan = await loansService.update(userId, id, req.body);
                if (!loan) {
                    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Loan not found' } });
                    return;
                }
                res.json({ data: loan });
            } catch (error) {
                next(error);
            }
        },

        async deleteLoan(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                await loansService.close(userId, id);
                res.json({ message: 'Loan closed successfully' });
            } catch (error) {
                next(error);
            }
        },

        async getAmortization(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                const schedule = await loansService.getAmortizationSchedule(userId, id);
                res.json({ data: schedule });
            } catch (error) {
                next(error);
            }
        },

        async recordPayment(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                const payment = await loansService.recordPayment(userId, id, req.body);
                res.status(201).json({ data: payment });
            } catch (error) {
                next(error);
            }
        },

        async getPaymentHistory(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                const payments = await loansService.getPaymentHistory(userId, id);
                res.json({ data: payments });
            } catch (error) {
                next(error);
            }
        },

        async calculatePrepayment(req: AuthRequest, res: Response, next: NextFunction) {
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
        },

        async getLoansSummary(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const summary = await loansService.getSummary(userId);
                res.json({ data: summary });
            } catch (error) {
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { LoansService } from '../services/loans/loans.service';
const defaultController = createLoansController(new LoansService());

export const getAllLoans = defaultController.getAllLoans;
export const getLoanById = defaultController.getLoanById;
export const createLoan = defaultController.createLoan;
export const updateLoan = defaultController.updateLoan;
export const deleteLoan = defaultController.deleteLoan;
export const getAmortization = defaultController.getAmortization;
export const recordPayment = defaultController.recordPayment;
export const getPaymentHistory = defaultController.getPaymentHistory;
export const calculatePrepayment = defaultController.calculatePrepayment;
export const getLoansSummary = defaultController.getLoansSummary;

