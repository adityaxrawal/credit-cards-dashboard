import * as rewardsQueries from '@shared/database/queries/rewards.queries';

/**
 * Get all rewards for a user
 */
export async function getAllRewards(userId: string) {
  return await rewardsQueries.getAllRewards(userId);
}

/**
 * Get rewards summary for a user
 */
export async function getRewardsSummary(userId: string) {
  const summary = await rewardsQueries.getRewardsSummary(userId);
  const allRewards = await rewardsQueries.getAllRewards(userId);

  return {
    summary,
    byCard: allRewards,
  };
}

/**
 * Get rewards for a specific card
 */
export async function getCardRewards(userId: string, cardId: string) {
  const rewards = await rewardsQueries.getCardRewards(userId, cardId);
  const transactions = await rewardsQueries.getRewardTransactions(userId, cardId);

  return {
    rewards,
    transactions,
  };
}

/**
 * Get reward transactions for a card
 */
export async function getRewardTransactions(userId: string, cardId: string) {
  return await rewardsQueries.getRewardTransactions(userId, cardId);
}

/**
 * Update reward points for a card
 */
export async function upsertRewardPoints(data: {
  cardId: string;
  pointsEarned: number;
  pointsRedeemed: number;
  pointsBalance: number;
  pointsExpiringSoon?: number;
  nextExpiryDate?: Date;
}) {
  return await rewardsQueries.upsertRewardPoints(data);
}

/**
 * Create a reward transaction
 */
export async function createRewardTransaction(data: {
  cardId: string;
  transactionId?: string;
  pointsChange: number;
  description?: string;
  expiryDate?: Date;
}) {
  return await rewardsQueries.createRewardTransaction(data);
}
