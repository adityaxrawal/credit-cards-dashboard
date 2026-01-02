import * as cardsQueries from '@shared/database/queries/cards.queries';
import logger from '@shared/utils/infrastructure/logger';
import { getCurrentBillingPeriod, getBillingPeriodForMonth } from '@shared/utils/helpers/billingCycle';
import { invalidateCardCache } from '@shared/utils/cache/cacheInvalidation';

/**
 * Get all cards for a user with utilization
 */
/**
 * Get all cards for a user with utilization
 */
export async function getAllCards(userId: string) {
  const cards = await cardsQueries.getUserCards(userId);

  return cards.map((card) => {
    const utilization = card.outstanding_balance;
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
  const card = await cardsQueries.createCard(data);
  if (card) {
    await invalidateCardCache(data.userId);
  }
  return card;
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
  const card = await cardsQueries.updateCard(userId, cardId, data);
  if (card) {
    await invalidateCardCache(userId, cardId);
  }
  return card;
}

/**
 * Delete a card
 */
export async function deleteCard(userId: string, cardId: string) {
  const result = await cardsQueries.deleteCard(userId, cardId);
  if (result) {
    await invalidateCardCache(userId, cardId);
  }
  return result;
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
  const { TransactionRepository } = await import('@modules/transactions/repositories/TransactionRepository');
  const { data: transactions } = await TransactionRepository.list(userId, {
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

/**
 * Normalize bank name to standard format
 */
export function normalizeBankName(name: string): string {
  const lowerName = name.toLowerCase().trim();

  if (lowerName.includes('sbi')) return 'SBI Card';
  if (lowerName.includes('axis')) return 'Axis Bank';
  if (lowerName.includes('hdfc')) return 'HDFC Bank';
  if (lowerName.includes('idfc')) return 'IDFC FIRST Bank';
  if (lowerName.includes('yes')) return 'YES BANK';
  if (lowerName.includes('federal')) return 'Federal Bank';

  // Return a cleaned version of the original if no specific rule matches
  return name.replace(/\./g, '').replace(/ltd/i, '').trim();
}

/**
 * Find or create a card based on last 4 digits
 * Handles normalization and updates partial bank names
 */
export async function findOrCreateCard(data: {
  userId: string;
  bankName: string;
  lastFour: string;
  billDate?: number;
  dueDate?: number;
  creditLimit?: number;
  cardName?: string;
}) {
  // 1. Normalize the incoming bank name
  const normalizedBankName = normalizeBankName(data.bankName);

  // 2. Look up strictly by user_id AND card_number_last4 (ignoring bank name)
  const existingCard = await cardsQueries.findCardByLastFour(data.userId, data.lastFour);

  if (existingCard) {
    // 3. Normalization: Update Bank Name if new name is more complete/different
    // e.g. change "HDFC" to "HDFC Bank"
    // Only update if the existing name is NOT the normalized one and the new one IS
    if (existingCard.bank_name !== normalizedBankName && normalizedBankName.length > existingCard.bank_name.length) {
      logger.info(`[CardsService] Normalizing bank name from "${existingCard.bank_name}" to "${normalizedBankName}"`);
      await cardsQueries.updateCard(data.userId, existingCard.id, {
        bankName: normalizedBankName
      });
      existingCard.bank_name = normalizedBankName;
      await invalidateCardCache(data.userId, existingCard.id);
    }

    return existingCard;
  }

  // 4. Create new card if not found
  logger.info(`[CardsService] Creating new card: ${normalizedBankName} - ${data.lastFour}`);
  const newCard = await cardsQueries.createCard({
    userId: data.userId,
    cardName: data.cardName || `${normalizedBankName} ${data.lastFour}`,
    bankName: normalizedBankName,
    lastFour: data.lastFour,
    billDate: data.billDate || 1, // Default to 1st
    dueDate: data.dueDate || 20, // Default to 20th
    creditLimit: data.creditLimit || 0,
    activationDate: new Date(),
  });

  if (newCard) {
    await invalidateCardCache(data.userId);
  }
  return newCard;
}
