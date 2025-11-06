/**
 * Analytics Module Interfaces
 */

export interface IAnalytics {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

export interface IAnalyticsResponse extends IAnalytics {
  // Response specific fields
}
