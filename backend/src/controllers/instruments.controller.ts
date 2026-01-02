import { AuthRequest } from '../types/auth.types';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/infrastructure/logger';

// 1. Define Dependencies Interface (Facade for multiple services)
export interface IInstrumentsService {
    getUserInstruments(userId: string): Promise<any>;
    getUserHierarchy(userId: string): Promise<any>;
    getAllBanks(): Promise<any>;
    getUserAccounts(userId: string): Promise<any>;
    createAccount(userId: string, data: any): Promise<any>;
    registerInstrument(userId: string, instrumentData: any): Promise<void>;
    getAccountInstruments(accountId: string): Promise<any>;
    registerCreditCard(userId: string, data: any): Promise<any>;
    registerDebitCard(userId: string, bankAccountId: string, data: any): Promise<any>;
    registerUPIHandle(userId: string, bankAccountId: string, data: any): Promise<any>;
    searchInstrument(userId: string, identifier: string): Promise<any>;
    getInstrument(userId: string, id: string, type?: string): Promise<any>;
    getIncompleteInstruments(userId: string): Promise<any>;
}

// 2. Define Controller Interface
export interface IInstrumentsController {
    getInstruments(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getHierarchy(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getBanks(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getAccounts(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getAccountInstruments(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    registerCreditCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    registerDebitCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    registerUPIHandle(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    searchInstrument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getInstrument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateInstrument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteInstrument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getIncompleteInstruments(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}

// 3. Factory Function
export function createInstrumentsController(service: IInstrumentsService): IInstrumentsController {
    return {
        async getInstruments(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const instruments = await service.getUserInstruments(userId);
                res.json(instruments);
            } catch (error) {
                logger.error('Failed to get instruments', error);
                next(error);
            }
        },

        async getHierarchy(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const hierarchy = await service.getUserHierarchy(userId);
                res.json(hierarchy);
            } catch (error) {
                logger.error('Failed to get hierarchy', error);
                next(error);
            }
        },

        async getBanks(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const banks = await service.getAllBanks();
                res.json(banks);
            } catch (error) {
                logger.error('Failed to get banks', error);
                next(error);
            }
        },

        async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const accounts = await service.getUserAccounts(userId);
                res.json(accounts);
            } catch (error) {
                logger.error('Failed to get accounts', error);
                next(error);
            }
        },

        async createAccount(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const account = await service.createAccount(userId, req.body);

                // Register in registry via service facade
                await service.registerInstrument(userId, {
                    instrumentType: 'bank_account',
                    instrumentId: account.id,
                    identifierMask: account.accountNumberMasked || '',
                    bankId: account.bankId || ''
                });

                res.status(201).json(account);
            } catch (error) {
                logger.error('Failed to create account', error);
                next(error);
            }
        },

        async getAccountInstruments(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const { accountId } = req.params;
                const instruments = await service.getAccountInstruments(accountId);
                res.json(instruments);
            } catch (error) {
                logger.error('Failed to get account instruments', error);
                next(error);
            }
        },

        async registerCreditCard(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const card = await service.registerCreditCard(userId, req.body);

                await service.registerInstrument(userId, {
                    instrumentType: 'credit_card',
                    instrumentId: card.id,
                    identifierMask: card.cardNumberMasked || '',
                    last4Digits: card.cardNumberLast4,
                    bankId: card.bankId || '',
                    bankAccountId: card.bankAccountId
                });

                res.status(201).json(card);
            } catch (error) {
                logger.error('Failed to register credit card', error);
                next(error);
            }
        },

        async registerDebitCard(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { bankAccountId, ...data } = req.body;
                const card = await service.registerDebitCard(userId, bankAccountId, data);

                await service.registerInstrument(userId, {
                    instrumentType: 'debit_card',
                    instrumentId: card.id,
                    identifierMask: card.cardNumberMasked || '',
                    last4Digits: card.cardNumberLast4,
                    bankId: card.bankId || '',
                    bankAccountId: card.bankAccountId
                });

                res.status(201).json(card);
            } catch (error) {
                logger.error('Failed to register debit card', error);
                next(error);
            }
        },

        async registerUPIHandle(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { bankAccountId, ...data } = req.body;
                const handle = await service.registerUPIHandle(userId, bankAccountId, data);

                await service.registerInstrument(userId, {
                    instrumentType: 'upi_handle',
                    instrumentId: handle.id,
                    identifierMask: handle.upiHandle || '',
                    bankId: handle.bankId || '',
                    bankAccountId: handle.bankAccountId
                });

                res.status(201).json(handle);
            } catch (error) {
                logger.error('Failed to register UPI handle', error);
                next(error);
            }
        },

        async searchInstrument(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { identifier } = req.query;
                const instrument = await service.searchInstrument(userId, identifier as string);
                if (!instrument) {
                    res.status(404).json({ error: 'Instrument not found' });
                    return;
                }
                res.json(instrument);
            } catch (error) {
                logger.error('Failed to search instrument', error);
                next(error);
            }
        },

        async getInstrument(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const { id } = req.params;
                const regEntry = await service.getInstrument(userId, id, req.query.type as string);
                if (!regEntry) {
                    res.status(404).json({ error: 'Instrument not found' });
                    return;
                }
                res.json(regEntry);
            } catch (error) {
                logger.error('Failed to get instrument', error);
                next(error);
            }
        },

        async updateInstrument(req: AuthRequest, res: Response, next: NextFunction) {
            res.status(501).json({ error: 'Not implemented' });
        },

        async deleteInstrument(req: AuthRequest, res: Response, next: NextFunction) {
            res.status(501).json({ error: 'Not implemented' });
        },

        async getIncompleteInstruments(req: AuthRequest, res: Response, next: NextFunction) {
            try {
                const userId = req.user.id;
                const incomplete = await service.getIncompleteInstruments(userId);
                res.json(incomplete);
            } catch (error) {
                logger.error('Failed to get incomplete instruments', error);
                next(error);
            }
        }
    };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { BankService } from '../services/cards/instruments/BankService';
import { BankAccountService } from '../services/cards/instruments/BankAccountService';
import { CreditCardService } from '../services/cards/instruments/CreditCardService';
import { DebitCardService } from '../services/cards/instruments/DebitCardService';
import { UPIHandleService } from '../services/cards/instruments/UPIHandleService';
import { InstrumentHierarchyService } from '../services/cards/instruments/InstrumentHierarchyService';
import { InstrumentRegistry } from '../services/cards/instruments/InstrumentRegistry';
import { PostProcessingService } from '../services/processing/PostProcessingService';

// Adapter to wrap static methods into the interface
const instrumentsServiceAdapter: IInstrumentsService = {
    getUserInstruments: (userId) => InstrumentRegistry.getUserInstruments(userId),
    getUserHierarchy: (userId) => InstrumentHierarchyService.getUserHierarchy(userId),
    getAllBanks: () => BankService.getAllBanks(),
    getUserAccounts: (userId) => BankAccountService.getUserAccounts(userId),
    createAccount: (userId, data) => BankAccountService.createAccount(userId, data),
    registerInstrument: async (userId, data) => { await InstrumentRegistry.registerInstrument(userId, data); },
    getAccountInstruments: (accountId) => InstrumentHierarchyService.getAccountInstruments(accountId),
    registerCreditCard: (userId, data) => CreditCardService.registerCreditCard(userId, data),
    registerDebitCard: (userId, accountId, data) => DebitCardService.registerDebitCard(userId, accountId, data),
    registerUPIHandle: (userId, accountId, data) => UPIHandleService.registerUPIHandle(userId, accountId, data),
    searchInstrument: (userId, id) => InstrumentRegistry.searchInstrument(userId, id),
    getInstrument: (userId, id, type) => InstrumentRegistry.getInstrument(userId, id, type || ''), // Handle undefined type
    getIncompleteInstruments: (userId) => PostProcessingService.getIncompleteInstruments(userId)
};

// Create an instance of the class-based controller for previous compatibility if needed, 
// OR just export the bound functions which is usually what routes expect.
// The previous file exported a class `InstrumentsController`.
// We should probably export an instance of a class that matches the old shape if routes import 'new InstrumentsController()'.
// BUT checking routes usually shows they import method references or instantiate.
// The file exported `export class InstrumentsController`. 
// To maintain 100% compat, I should export the class but marked deprecated, OR export the functions.
// Let's check how it's used. Usually generic controllers export functions. 
// This file exported a CLASS. "export class InstrumentsController".
// So I must export a class that routes can instantiate or use.

export class InstrumentsController {
    private controller: IInstrumentsController;

    constructor() {
        this.controller = createInstrumentsController(instrumentsServiceAdapter);
    }

    getInstruments = (req: Request, res: Response, next: NextFunction) => this.controller.getInstruments(req as AuthRequest, res, next);
    getHierarchy = (req: Request, res: Response, next: NextFunction) => this.controller.getHierarchy(req as AuthRequest, res, next);
    getBanks = (req: Request, res: Response, next: NextFunction) => this.controller.getBanks(req as AuthRequest, res, next);
    getAccounts = (req: Request, res: Response, next: NextFunction) => this.controller.getAccounts(req as AuthRequest, res, next);
    createAccount = (req: Request, res: Response, next: NextFunction) => this.controller.createAccount(req as AuthRequest, res, next);
    getAccountInstruments = (req: Request, res: Response, next: NextFunction) => this.controller.getAccountInstruments(req as AuthRequest, res, next);
    registerCreditCard = (req: Request, res: Response, next: NextFunction) => this.controller.registerCreditCard(req as AuthRequest, res, next);
    registerDebitCard = (req: Request, res: Response, next: NextFunction) => this.controller.registerDebitCard(req as AuthRequest, res, next);
    registerUPIHandle = (req: Request, res: Response, next: NextFunction) => this.controller.registerUPIHandle(req as AuthRequest, res, next);
    searchInstrument = (req: Request, res: Response, next: NextFunction) => this.controller.searchInstrument(req as AuthRequest, res, next);
    getInstrument = (req: Request, res: Response, next: NextFunction) => this.controller.getInstrument(req as AuthRequest, res, next);
    updateInstrument = (req: Request, res: Response, next: NextFunction) => this.controller.updateInstrument(req as AuthRequest, res, next);
    deleteInstrument = (req: Request, res: Response, next: NextFunction) => this.controller.deleteInstrument(req as AuthRequest, res, next);
    getIncompleteInstruments = (req: Request, res: Response, next: NextFunction) => this.controller.getIncompleteInstruments(req as AuthRequest, res, next);
}

