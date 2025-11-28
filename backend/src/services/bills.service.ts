import * as billsQueries from '../db/queries/bills.queries';

/**
 * Get all bills for a user
 */
export async function getAllBills(userId: string) {
  return await billsQueries.getAllBills(userId);
}

/**
 * Get a single bill by ID
 */
export async function getBillById(userId: string, billId: string) {
  return await billsQueries.getBillById(userId, billId);
}

/**
 * Get bills for a specific card
 */
export async function getCardBills(userId: string, cardId: string) {
  return await billsQueries.getCardBills(userId, cardId);
}

/**
 * Get upcoming bills
 */
export async function getUpcomingBills(userId: string) {
  return await billsQueries.getUpcomingBills(userId);
}

/**
 * Create a new bill
 */
export async function createBill(data: {
  cardId: string;
  billMonth: number;
  billYear: number;
  billAmount: number;
  billDate: Date;
  dueDate: Date;
  paymentStatus?: string;
  notes?: string;
}) {
  return await billsQueries.createBill(data);
}

/**
 * Update a bill (usually payment information)
 */
export async function updateBill(
  userId: string,
  billId: string,
  data: Partial<{
    paymentAmount: number;
    paymentDate: Date;
    paymentStatus: string;
    paymentMethod: string;
    transactionReference: string;
    lateFee: number;
    notes: string;
  }>
) {
  return await billsQueries.updateBill(userId, billId, data);
}

/**
 * Delete a bill
 */
export async function deleteBill(userId: string, billId: string) {
  return await billsQueries.deleteBill(userId, billId);
}
