/**
 * Reports Module Interfaces
 */

export interface IReports {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

export interface IReportsResponse extends IReports {
  // Response specific fields
}
