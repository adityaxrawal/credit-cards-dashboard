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

// Use type alias instead of empty interface
export type IRewardsResponse = IRewards;
