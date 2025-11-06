/**
 * Subscriptions Module Interfaces
 */

export interface ISubscriptions {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

export interface ISubscriptionsResponse extends ISubscriptions {
  // Response specific fields
}
