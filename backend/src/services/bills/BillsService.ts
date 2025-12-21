import * as billsQueries from '../../db/queries/bills.queries';
import { invalidateBillsCache } from '../../utils/cache/cacheInvalidation';
import { Bill, CreateBillData, UpdateBillData } from '../../types/bills.types';

export interface BillService {
    getAllBills(userId: string, limit?: number, offset?: number): Promise<Bill[]>;
    getBillById(userId: string, billId: string): Promise<Bill | null>;
    getCardBills(userId: string, cardId: string, limit?: number, offset?: number): Promise<Bill[]>;
    getUpcomingBills(userId: string, limit?: number, offset?: number): Promise<Bill[]>;
    createBill(data: CreateBillData): Promise<Bill>;
    updateBill(userId: string, billId: string, data: UpdateBillData): Promise<Bill>;
    deleteBill(userId: string, billId: string): Promise<boolean>;
}

class BillsServiceImpl implements BillService {
    async getAllBills(userId: string, limit: number = 50, offset: number = 0) {
        return billsQueries.getAllBills(userId, limit, offset);
    }

    async getBillById(userId: string, billId: string) {
        return billsQueries.getBillById(userId, billId);
    }

    async getCardBills(userId: string, cardId: string, limit: number = 50, offset: number = 0) {
        return billsQueries.getCardBills(userId, cardId, limit, offset);
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
