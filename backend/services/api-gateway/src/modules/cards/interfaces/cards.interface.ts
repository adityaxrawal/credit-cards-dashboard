/**
 * Cards Module Interfaces
 */

export interface ICards {
  id: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  // Add specific fields based on module
}

export interface ICardsResponse extends ICards {
  // Response specific fields
}
