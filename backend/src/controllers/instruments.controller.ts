import { AuthRequest } from '../types/auth.types';
import { Request, Response } from 'express';
import { BankService } from '../services/cards/instruments/BankService';
import { BankAccountService } from '../services/cards/instruments/BankAccountService';
import { CreditCardService } from '../services/cards/instruments/CreditCardService';
import { DebitCardService } from '../services/cards/instruments/DebitCardService';
import { UPIHandleService } from '../services/cards/instruments/UPIHandleService';
import { InstrumentHierarchyService } from '../services/cards/instruments/InstrumentHierarchyService';
import { InstrumentRegistry } from '../services/cards/instruments/InstrumentRegistry';
import logger from '../utils/infrastructure/logger';

export class InstrumentsController {

    // GET /api/instruments
    // Returns all instruments for user in hierarchical format
    async getInstruments(req: Request, res: Response) {
        try {
            const userId = req.user.id;
            const instruments = await InstrumentRegistry.getUserInstruments(userId);
            res.json(instruments);
        } catch (error) {
            logger.error('Failed to get instruments', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // GET /api/instruments/hierarchy
    // Returns full Bank → Account → Card hierarchy
    async getHierarchy(req: Request, res: Response) {
        try {
            const userId = req.user.id;
            const hierarchy = await InstrumentHierarchyService.getUserHierarchy(userId);
            res.json(hierarchy);
        } catch (error) {
            logger.error('Failed to get hierarchy', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // GET /api/banks
    // List all banks
    async getBanks(req: Request, res: Response) {
        try {
            const banks = await BankService.getAllBanks();
            res.json(banks);
        } catch (error) {
            logger.error('Failed to get banks', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // GET /api/accounts
    // List user's bank accounts
    async getAccounts(req: Request, res: Response) {
        try {
            const userId = req.user.id;
            const accounts = await BankAccountService.getUserAccounts(userId);
            res.json(accounts);
        } catch (error) {
            logger.error('Failed to get accounts', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST /api/accounts
    // Create new bank account
    async createAccount(req: Request, res: Response) {
        try {
            const userId = req.user.id;
            const account = await BankAccountService.createAccount(userId, req.body);

            // Register in registry
            await InstrumentRegistry.registerInstrument(userId, {
                instrumentType: 'bank_account',
                instrumentId: account.id,
                identifierMask: account.accountNumberMasked || '',
                bankId: account.bankId || '' // bankId is also optional in BankAccount via Instrument? No, Instrument has bankId optional. BankAccount should probably have it.
            });

            res.status(201).json(account);
        } catch (error) {
            logger.error('Failed to create account', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // GET /api/accounts/:accountId/instruments
    // Get all cards/UPI under this account
    async getAccountInstruments(req: Request, res: Response) {
        try {
            const { accountId } = req.params;
            const instruments = await InstrumentHierarchyService.getAccountInstruments(accountId);
            res.json(instruments);
        } catch (error) {
            logger.error('Failed to get account instruments', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST /api/credit-cards
    // Register credit card
    async registerCreditCard(req: Request, res: Response) {
        try {
            const userId = req.user.id;
            const card = await CreditCardService.registerCreditCard(userId, req.body);

            // Register in registry
            await InstrumentRegistry.registerInstrument(userId, {
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
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST /api/debit-cards
    // Register debit card
    async registerDebitCard(req: Request, res: Response) {
        try {
            const userId = req.user.id;
            const { bankAccountId, ...data } = req.body;
            const card = await DebitCardService.registerDebitCard(userId, bankAccountId, data);

            // Register in registry
            await InstrumentRegistry.registerInstrument(userId, {
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
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST /api/upi-handles
    // Register UPI handle
    async registerUPIHandle(req: Request, res: Response) {
        try {
            const userId = req.user.id;
            const { bankAccountId, ...data } = req.body;
            const handle = await UPIHandleService.registerUPIHandle(userId, bankAccountId, data);

            // Register in registry
            await InstrumentRegistry.registerInstrument(userId, {
                instrumentType: 'upi_handle',
                instrumentId: handle.id,
                identifierMask: handle.upiHandle || '',
                bankId: handle.bankId || '',
                bankAccountId: handle.bankAccountId
            });

            res.status(201).json(handle);
        } catch (error) {
            logger.error('Failed to register UPI handle', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // GET /api/instruments/search?identifier=XXXX5678
    // Search instrument by mask/handle
    async searchInstrument(req: Request, res: Response) {
        try {
            const userId = req.user.id;
            const { identifier } = req.query;
            const instrument = await InstrumentRegistry.searchInstrument(userId, identifier as string);
            if (!instrument) return res.status(404).json({ error: 'Instrument not found' });
            res.json(instrument);
        } catch (error) {
            logger.error('Failed to search instrument', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // GET /api/instruments/:id
    // Get specific instrument
    async getInstrument(req: Request, res: Response) {
        // This needs logic to fetch the actual instrument based on type from registry
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const regEntry = await InstrumentRegistry.getInstrument(userId, id, req.query.type as string);
            if (!regEntry) return res.status(404).json({ error: 'Instrument not found' });

            // Fetch full details (implied but not strictly asked for in controller snippet)
            res.json(regEntry);
        } catch (error) {
            logger.error('Failed to get instrument', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // PUT /api/instruments/:id
    // Update instrument
    async updateInstrument(req: Request, res: Response) {
        res.status(501).json({ error: 'Not implemented' });
    }

    // DELETE /api/instruments/:id
    // Delete instrument
    async deleteInstrument(req: Request, res: Response) {
        res.status(501).json({ error: 'Not implemented' });
    }
}
