/**
 * Bills Module Interfaces
 */

export interface IBills {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

export interface IBillsResponse extends IBills {
  // Response specific fields
}
