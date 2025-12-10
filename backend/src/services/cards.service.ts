import * as cardsQueries from '../db/queries/cards.queries';
import { getCurrentBillingPeriod, getBillingPeriodForMonth } from '../utils/billingCycle';

/**
 * Get all cards for a user with utilization
 */
export async function getAllCards(userId: string) {
  const cards = await cardsQueries.getUserCards(userId);

  // Batch fetch utilization to avoid N+1 queries
  const cardIds = cards.map(c => c.id);
  const utilizationMap = await cardsQueries.getBatchCardUtilization(cardIds);

  const cardsWithUtilization = cards.map((card) => {
    const utilization = utilizationMap.get(card.id) || 0;
    const utilizationPercent = card.credit_limit
      ? (utilization / card.credit_limit) * 100
      : 0;

    const currentPeriod = getCurrentBillingPeriod(card.bill_date, card.due_date);

    return {
      ...card,
      currentBalance: utilization,
      utilization: utilizationPercent,
      nextBillDate: currentPeriod.billDate,
      nextDueDate: currentPeriod.dueDate,
    };
  });

  return cardsWithUtilization;
}

/**
 * Get a single card with details
 */
export async function getCardDetails(userId: string, cardId: string) {
  const card = await cardsQueries.getCardById(userId, cardId);

  if (!card) {
    return null;
  }

  const utilization = await cardsQueries.getCardUtilization(card.id);
  const utilizationPercent = card.credit_limit
    ? (utilization / card.credit_limit) * 100
    : 0;

  const currentPeriod = getCurrentBillingPeriod(card.bill_date, card.due_date);

  return {
    ...card,
    currentBalance: utilization,
    utilization: utilizationPercent,
    nextBillDate: currentPeriod.billDate,
    nextDueDate: currentPeriod.dueDate,
    currentBillingPeriod: currentPeriod,
  };
}

/**
 * Create a new card
 */
export async function createCard(data: {
  userId: string;
  cardName: string;
  bankName: string;
  lastFour: string;
  billDate: number;
  dueDate: number;
  creditLimit: number;
  activationDate?: Date;
  notes?: string;
}) {
  return await cardsQueries.createCard(data);
}

/**
 * Update a card
 */
export async function updateCard(
  userId: string,
  cardId: string,
  data: Partial<{
    cardName: string;
    bankName: string;
    billDate: number;
    dueDate: number;
    creditLimit: number;
    notes: string;
  }>
) {
  return await cardsQueries.updateCard(userId, cardId, data);
}

/**
 * Delete a card
 */
export async function deleteCard(userId: string, cardId: string) {
  return await cardsQueries.deleteCard(userId, cardId);
}

/**
 * Get card statement for a specific billing cycle
 */
export async function getCardStatement(
  userId: string,
  cardId: string,
  month: number,
  year: number
) {
  const card = await cardsQueries.getCardById(userId, cardId);

  if (!card) {
    return null;
  }

  const billingPeriod = getBillingPeriodForMonth(card.bill_date, card.due_date, month, year);

  // Get transactions for this billing period
  const transactionsQueries = await import('../db/queries/transactions.queries');
  const { data: transactions } = await transactionsQueries.listTransactions(userId, {
    cardId,
    from: billingPeriod.start,
    to: billingPeriod.end,
  });

  const totalDebits = transactions
    .filter(t => t.transaction_type === 'debit')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const totalCredits = transactions
    .filter(t => t.transaction_type === 'credit')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  return {
    card,
    billingPeriod,
    transactions,
    summary: {
      totalDebits,
      totalCredits,
      netAmount: totalDebits - totalCredits,
      transactionCount: transactions.length,
    },
  };
}
