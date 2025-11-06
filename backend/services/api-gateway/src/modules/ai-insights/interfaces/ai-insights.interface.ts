/**
 * AiInsights Module Interfaces
 */

export interface IAiInsights {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

export interface IAiInsightsResponse extends IAiInsights {
  // Response specific fields
}
