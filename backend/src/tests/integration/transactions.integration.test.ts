
import { jest } from '@jest/globals';
jest.unmock('../../lib/db');

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createManualTransaction, updateTransaction, deleteTransaction, getTransaction } from '../../services/transactions/TransactionService';
import pool from '../../lib/db';
import { InstrumentType } from '../../types/transaction.types';

describe('Transaction Integration Tests', () => {
    let userId: string;
    let instrumentId: string;
    let createdTransactionIds: string[] = [];

    beforeAll(async () => {
        // Get a test user and instrument
        const userRes = await pool.query('SELECT id FROM users LIMIT 1');
        if (userRes.rows.length === 0) throw new Error('No users found');
        userId = userRes.rows[0].id;

        const instRes = await pool.query('SELECT id FROM instruments WHERE user_id = $1 LIMIT 1', [userId]);
        if (instRes.rows.length === 0) throw new Error('No instruments found');
        instrumentId = instRes.rows[0].id;
    });

    afterAll(async () => {
        // Cleanup
        for (const id of createdTransactionIds) {
            await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
        }
        await pool.end();
    });

    it('should create a manual transaction', async () => {
        const tx = await createManualTransaction({
            userId,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            transactionDate: new Date(),
            merchant: 'Test Merchant',
            category: 'Test Category',
            amount: 100.50,
            transactionType: 'debit',
            direction: 'debit',
            description: 'Test Description'
        });

        expect(tx).toBeDefined();
        expect(tx!.id).toBeDefined();
        expect(tx!.merchant).toBe('Test Merchant');
        expect(tx!.amount).toBe("100.50"); // Numeric types often come back as strings/numbers depending on driver

        createdTransactionIds.push(tx!.id);
    });

    it('should update a transaction', async () => {
        const tx = await createManualTransaction({
            userId,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            transactionDate: new Date(),
            merchant: 'Update Me',
            category: 'Old Cat',
            amount: 50,
            transactionType: 'debit',
            direction: 'debit'
        });
        createdTransactionIds.push(tx!.id);

        const updated = await updateTransaction(userId, tx!.id, {
            merchant: 'Updated Merchant',
            amount: 75.00
        });

        expect(updated).toBeDefined();
        expect(updated!.merchant).toBe('Updated Merchant');
        expect(updated!.amount).toBe("75.00");
    });

    it('should create split transactions (parent and child)', async () => {
        const parent = await createManualTransaction({
            userId,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            transactionDate: new Date(),
            merchant: 'Split Parent',
            category: 'Mixed',
            amount: 200,
            transactionType: 'debit',
            direction: 'debit',
            description: 'Parent'
        });
        createdTransactionIds.push(parent!.id);

        const child1 = await createManualTransaction({
            userId,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            transactionDate: new Date(),
            merchant: 'Split Parent', // Often child inherits merchant
            category: 'Food',
            amount: 50,
            transactionType: 'debit',
            direction: 'debit',
            parentTransactionId: parent!.id
        });
        createdTransactionIds.push(child1!.id);

        const child2 = await createManualTransaction({
            userId,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            transactionDate: new Date(),
            merchant: 'Split Parent',
            category: 'Transport',
            amount: 150,
            transactionType: 'debit',
            direction: 'debit',
            parentTransactionId: parent!.id
        });
        createdTransactionIds.push(child2!.id);

        const fetchedParent = await getTransaction(userId, parent!.id);
        const fetchedChild1 = await getTransaction(userId, child1!.id);

        expect(fetchedParent).toBeDefined();
        // Check linkage
        expect(fetchedChild1!.parent_transaction_id).toBe(parent!.id);
    });

    it('should delete a transaction', async () => {
        const tx = await createManualTransaction({
            userId,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            transactionDate: new Date(),
            merchant: 'Delete Me',
            category: 'Trash',
            amount: 10,
            transactionType: 'debit',
            direction: 'debit'
        });
        createdTransactionIds.push(tx!.id);

        const success = await deleteTransaction(userId, tx!.id);
        expect(success).toBe(true);

        const fetched = await getTransaction(userId, tx!.id);
        expect(fetched).toBeNull();
    });
});
