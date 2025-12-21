/**
 * Bill entity from database
 */
export interface Bill {
    id: string;
    user_id: string;
    card_id: string;
    bill_month: number;
    bill_year: number;
    bill_amount: number;
    bill_date: Date;
    due_date: Date;
    payment_status: 'pending' | 'paid' | 'overdue';
    paid_on?: Date;
    notes?: string;
    created_at: Date;
    updated_at: Date;
}

/**
 * Data required to create a new bill
 */
export interface CreateBillData {
    userId: string;
    cardId: string;
    billMonth: number;
    billYear: number;
    billAmount: number;
    billDate: Date;
    dueDate: Date;
    paymentStatus?: string;
    notes?: string;
}

/**
 * Data for updating an existing bill
 */
export interface UpdateBillData {
    billAmount?: number;
    billDate?: Date;
    dueDate?: Date;
    paymentStatus?: string;
    paidOn?: Date;
    notes?: string;
}
