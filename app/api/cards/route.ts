import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiWrapper, authError, handleApiError, success } from '@/lib/utils/api-error';

/**
 * Represents a credit card statement
 * @interface Statement
 */
interface Statement {
  /** Unique identifier for the statement */
  id: string;
  /** ISO date string of the statement date */
  statement_date: string;
  /** ISO date string of the payment due date */
  due_date: string;
  /** Minimum payment amount required */
  minimum_payment: number;
  /** Current balance on the statement */
  current_balance: number;
  /** Available credit amount */
  available_credit: number;
  /** ISO date string of when the statement was created */
  created_at: string;
}

/**
 * Represents a credit card with optional statement data
 * @interface Card
 */
interface Card {
  /** Unique identifier for the card */
  id: string;
  /** ID of the user who owns the card */
  user_id: string;
  /** Name of the bank that issued the card */
  bank_name: string;
  /** Name/type of the credit card */
  card_name: string;
  /** Last four digits of the card number */
  last_four_digits: string;
  /** Type of card (e.g., 'credit', 'debit') */
  card_type: string;
  /** Maximum credit limit */
  credit_limit: number;
  /** Current outstanding balance */
  current_balance: number;
  /** Available credit remaining */
  available_credit: number;
  /** ISO date string of when the card was created */
  created_at: string;
  /** ISO date string of when the card was last updated */
  updated_at: string;
  /** Optional array of all statements */
  statements?: Statement[];
  /** Optional latest statement */
  latest_statement?: Statement | null;
}

/**
 * GET /api/cards
 * Retrieves all credit cards for the authenticated user with their latest statements
 * @param {NextRequest} request - The incoming request object
 * @returns {Promise<NextResponse>} JSON response with cards data
 * @throws {Error} When user is not authenticated or database operations fail
 * @example
 * ```typescript
 * // Response format:
 * {
 *   "cards": [
 *     {
 *       "id": "card123",
 *       "bank_name": "Chase",
 *       "card_name": "Sapphire Preferred",
 *       "last_four_digits": "1234",
 *       "credit_limit": 10000,
 *       "current_balance": 2500,
 *       "latest_statement": { ... }
 *     }
 *   ],
 *   "grouped_by_bank": {
 *     "Chase": [{ ... }],
 *     "Amex": [{ ... }]
 *   }
 * }
 * ```
 */
export async function GET(request: NextRequest) {
  return apiWrapper(async () => {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Unauthorized access');
    }

    // Fetch all cards for the authenticated user with latest statement
    const { data: cards, error: cardsError } = await supabase
      .from('credit_cards')
      .select(`
        *,
        statements:credit_card_statements(
          id,
          statement_date,
          due_date,
          minimum_payment,
          current_balance,
          available_credit,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (cardsError) {
      throw cardsError;
    }

    // Process cards to include only the latest statement
    const processedCards = (cards as Card[])?.map(card => {
      const latestStatement = card.statements?.sort((a: Statement, b: Statement) => 
        new Date(b.statement_date).getTime() - new Date(a.statement_date).getTime()
      )[0];

      return {
        ...card,
        latest_statement: latestStatement || null,
        statements: undefined // Remove the full statements array
      };
    }) || [];

    // Group cards by bank_name
    const groupedByBank = processedCards.reduce((acc: Record<string, Card[]>, card) => {
      const bankName = card.bank_name || 'Unknown Bank';
      if (!acc[bankName]) {
        acc[bankName] = [];
      }
      acc[bankName].push(card);
      return acc;
    }, {});

    return {
      cards: processedCards,
      grouped_by_bank: groupedByBank
    };
  });
}