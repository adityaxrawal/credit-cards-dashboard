/**
 * Alerts Module Interfaces
 */

export interface IAlerts {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

export interface IAlertsResponse extends IAlerts {
  // Response specific fields
}
