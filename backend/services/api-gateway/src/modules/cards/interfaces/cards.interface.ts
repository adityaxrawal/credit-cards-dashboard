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

// Use type alias instead of empty interface
export type ICardsResponse = ICards;
