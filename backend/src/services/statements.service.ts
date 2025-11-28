import * as statementsQueries from '../db/queries/statements.queries';

/**
 * Get all statements for a user
 */
export async function getAllStatements(userId: string) {
  return await statementsQueries.getAllStatements(userId);
}

/**
 * Get statement details for a specific card and billing period
 */
export async function getStatementDetails(
  userId: string,
  cardId: string,
  month: number,
  year: number
) {
  return await statementsQueries.getStatementDetails(userId, cardId, month, year);
}

/**
 * Get all statements for a specific card
 */
export async function getCardStatements(userId: string, cardId: string) {
  return await statementsQueries.getCardStatements(userId, cardId);
}
