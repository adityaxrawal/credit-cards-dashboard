import * as billsQueries from '@shared/database/queries/bills.queries';
import { invalidateBillsCache } from '@shared/utils/cache/cacheInvalidation';
import { Bill, CreateBillData, UpdateBillData } from '@shared/types/bills.types';

export interface BillService {
    getAllBills(userId: string, limit?: number, cursor?: string): Promise<{ data: Bill[], nextCursor: string | null }>;
    getBillById(userId: string, billId: string): Promise<Bill | null>;
    getCardBills(userId: string, cardId: string, limit?: number, cursor?: string): Promise<{ data: Bill[], nextCursor: string | null }>;
    getUpcomingBills(userId: string, limit?: number, offset?: number): Promise<Bill[]>;
    createBill(data: CreateBillData): Promise<Bill>;
    updateBill(userId: string, billId: string, data: UpdateBillData): Promise<Bill>;
    deleteBill(userId: string, billId: string): Promise<boolean>;
}

class BillsServiceImpl implements BillService {
    async getAllBills(userId: string, limit: number = 50, cursor?: string) {
        const decodedCursor = this.decodeCursor(cursor);
        const bills = await billsQueries.getAllBills(userId, limit, decodedCursor);

        return this.paginateResult(bills, limit);
    }

    async getBillById(userId: string, billId: string) {
        return billsQueries.getBillById(userId, billId);
    }

    async getCardBills(userId: string, cardId: string, limit: number = 50, cursor?: string) {
        const decodedCursor = this.decodeCursor(cursor);
        const bills = await billsQueries.getCardBills(userId, cardId, limit, decodedCursor);

        return this.paginateResult(bills, limit);
    }

    private decodeCursor(cursor?: string): { dueDate: Date, id: string } | undefined {
        if (!cursor) return undefined;
        try {
            const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
            const [dateStr, id] = decoded.split('|');
            return {
                dueDate: new Date(dateStr),
                id
            };
        } catch (e) {
            return undefined;
        }
    }

    private paginateResult(items: Bill[], limit: number) {
        const hasNext = items.length > limit;
        const data = hasNext ? items.slice(0, limit) : items;

        let nextCursor: string | null = null;
        if (hasNext) {
            const lastItem = data[data.length - 1];
            // Encode: dueDateISO|id
            const cursorStr = `${new Date(lastItem.due_date).toISOString()}|${lastItem.id}`;
            nextCursor = Buffer.from(cursorStr).toString('base64');
        }

        return { data, nextCursor };
    }

    async getUpcomingBills(userId: string, limit: number = 20, offset: number = 0) {
        return billsQueries.getUpcomingBills(userId, limit, offset);
    }

    async createBill(data: CreateBillData): Promise<Bill> {
        const result = await billsQueries.createBill(data);
        await invalidateBillsCache(data.userId);
        return result;
    }

    async updateBill(userId: string, billId: string, data: UpdateBillData): Promise<Bill> {
        const result = await billsQueries.updateBill(userId, billId, data);
        await invalidateBillsCache(userId);
        return result;
    }

    async deleteBill(userId: string, billId: string) {
        const result = await billsQueries.deleteBill(userId, billId);
        await invalidateBillsCache(userId);
        return result;
    }
}

export const billsService = new BillsServiceImpl();
