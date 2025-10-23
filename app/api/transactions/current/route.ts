import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiWrapper, validationError } from '@/lib/utils/api-error';

interface Card {
  id: string;
  user_id: string;
  bank_name: string;
  card_name: string;
  last_four_digits: string;
}

interface Transaction {
  id: string;
  card_id: string;
  amount: number;
  description: string;
  category: string;
  category_manual?: string;
  date: string;
  type: 'debit' | 'credit' | 'reversal';
  merchant_name?: string;
  created_at: string;
  updated_at: string;
}

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