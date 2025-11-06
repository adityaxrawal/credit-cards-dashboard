/**
 * Rewards Module Interfaces
 */

export interface IRewards {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

export interface IRewardsResponse extends IRewards {
  // Response specific fields
}
