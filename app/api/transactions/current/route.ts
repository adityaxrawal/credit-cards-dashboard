import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiWrapper, validationError } from '@/lib/utils/api-error';

/**
 * Represents a credit card with basic information
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
}

/**
 * Represents a transaction with card information
 * @interface Transaction
 */
interface Transaction {
  /** Unique identifier for the transaction */
  id: string;
  /** ID of the associated credit card */
  card_id: string;
  /** Transaction amount (positive for debits, negative for credits) */
  amount: number;
  /** Description of the transaction */
  description: string;
  /** Auto-categorized transaction category */
  category: string;
  /** Manually assigned category (overrides auto-category) */
  category_manual?: string;
  /** ISO date string of the transaction */
  date: string;
  /** Type of transaction */
  type: 'debit' | 'credit' | 'reversal';
  /** Name of the merchant (if available) */
  merchant_name?: string;
  /** ISO date string of when the transaction was created */
  created_at: string;
  /** ISO date string of when the transaction was last updated */
  updated_at: string;
}

/**
 * GET /api/transactions/current
 * Retrieves current transactions for the authenticated user with pagination and filtering
 * @param {NextRequest} request - The incoming request object
 * @returns {Promise<NextResponse>} JSON response with transactions data and pagination info
 * @throws {Error} When user is not authenticated, validation fails, or database operations fail
 * @example
 * ```typescript
 * // Query parameters:
 * // - cardId: Filter by specific card ID
 * // - category: Filter by transaction category
 * // - page: Page number (default: 1)
 * // - limit: Items per page (default: 50, max: 100)
 * 
 * // Response format:
 * {
 *   "transactions": [
 *     {
 *       "id": "tx123",
 *       "amount": 25.99,
 *       "description": "Coffee Shop",
 *       "category": "dining",
 *       "date": "2024-01-15",
 *       "card": {
 *         "bank_name": "Chase",
 *         "card_name": "Sapphire Preferred"
 *       }
 *     }
 *   ],
 *   "total": 150,
 *   "page": 1,
 *   "limit": 50,
 *   "totalPages": 3
 * }
 * ```
 */
export async function GET(request: NextRequest) {
  return apiWrapper(async () => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Unauthorized access');
    }

    // Parse query parameters
    const cardId = searchParams.get('cardId');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      throw new Error('Invalid pagination parameters');
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build the query with joins to verify card ownership
    let query = supabase
      .from('current_transactions')
      .select(`
        *,
        credit_cards!inner(
          id,
          user_id,
          bank_name,
          card_name,
          last_four_digits
        )
      `, { count: 'exact' })
      .eq('credit_cards.user_id', user.id);

    // Apply filters
    if (cardId) {
      query = query.eq('card_id', cardId);
    }

    if (category) {
      query = query.eq('category', category);
    }

    // Apply pagination and ordering
    query = query
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: transactions, error: transactionsError, count } = await query;

    if (transactionsError) {
      throw transactionsError;
    }

    // Process transactions to flatten the card information
    const processedTransactions = transactions?.map((transaction: Transaction & { credit_cards: Card }) => ({
      ...transaction,
      card: transaction.credit_cards,
      credit_cards: undefined
    })) || [];

    return {
      transactions: processedTransactions,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  });
}