import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Search parameters
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const cardId = searchParams.get('cardId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const transactionType = searchParams.get('type'); // 'debit' or 'credit'
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build base query
    let queryBuilder = supabase
      .from('current_transactions')
      .select(`
        id,
        amount,
        merchant,
        category,
        date,
        description,
        transaction_type,
        card_last_4,
        is_processed,
        tags,
        notes,
        is_recurring,
        created_at,
        card_id,
        credit_cards!inner(
          id,
          card_name,
          bank_name,
          card_type,
          last_4_digits
        )
      `, { count: 'exact' })
      .eq('user_id', user.id);

    // Apply text search filter
    if (query.trim()) {
      // Search in merchant, description, and notes
      queryBuilder = queryBuilder.or(`
        merchant.ilike.%${query}%,
        description.ilike.%${query}%,
        notes.ilike.%${query}%
      `);
    }

    // Apply category filter
    if (category && category !== 'all') {
      queryBuilder = queryBuilder.eq('category', category);
    }

    // Apply card filter
    if (cardId) {
      queryBuilder = queryBuilder.eq('card_id', cardId);
    }

    // Apply date range filters
    if (startDate) {
      queryBuilder = queryBuilder.gte('date', startDate);
    }
    if (endDate) {
      queryBuilder = queryBuilder.lte('date', endDate);
    }

    // Apply amount range filters
    if (minAmount) {
      const minAmountNum = parseFloat(minAmount);
      queryBuilder = queryBuilder.gte('amount', -Math.abs(minAmountNum)); // For debits (negative amounts)
    }
    if (maxAmount) {
      const maxAmountNum = parseFloat(maxAmount);
      queryBuilder = queryBuilder.lte('amount', Math.abs(maxAmountNum)); // For credits (positive amounts)
    }

    // Apply transaction type filter
    if (transactionType) {
      queryBuilder = queryBuilder.eq('transaction_type', transactionType);
    }

    // Apply status filter (assuming we have a status field)
    if (status) {
      queryBuilder = queryBuilder.eq('is_processed', status === 'processed');
    }

    // Apply sorting
    const validSortFields = ['date', 'amount', 'merchant', 'category', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'date';
    const order = sortOrder === 'asc' ? { ascending: true } : { ascending: false };
    
    queryBuilder = queryBuilder.order(sortField, order);

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data: transactions, error, count } = await queryBuilder;

    if (error) {
      console.error('Error searching transactions:', error);
      return NextResponse.json({ error: 'Failed to search transactions' }, { status: 500 });
    }

    // Format the response data
    const formattedTransactions = transactions?.map(transaction => {
      const card = Array.isArray(transaction.credit_cards) ? transaction.credit_cards[0] : transaction.credit_cards;
      return {
        id: transaction.id,
        amount: transaction.amount,
        merchant: transaction.merchant,
        category: transaction.category,
        date: transaction.date,
        description: transaction.description,
        transactionType: transaction.transaction_type,
        cardLast4: transaction.card_last_4,
        isProcessed: transaction.is_processed,
        tags: transaction.tags || [],
        notes: transaction.notes || '',
        isRecurring: transaction.is_recurring || false,
        createdAt: transaction.created_at,
        card: {
          id: card?.id,
          name: card?.card_name,
          bankName: card?.bank_name,
          cardType: card?.card_type,
          last4: card?.last_4_digits
        }
      };
    }) || [];

    // Calculate summary statistics for the search results
    const totalAmount = formattedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const averageAmount = formattedTransactions.length > 0 ? totalAmount / formattedTransactions.length : 0;
    
    const categoryBreakdown = formattedTransactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const cardBreakdown = formattedTransactions.reduce((acc, t) => {
      const cardKey = `${t.card.bankName} ${t.card.last4}`;
      acc[cardKey] = (acc[cardKey] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

    // Pagination info
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const response = {
      transactions: formattedTransactions,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: count || 0,
        limit,
        hasNextPage,
        hasPreviousPage
      },
      summary: {
        totalAmount: Math.round(totalAmount),
        averageAmount: Math.round(averageAmount),
        transactionCount: formattedTransactions.length,
        categoryBreakdown: Object.entries(categoryBreakdown).map(([category, amount]) => ({
          category,
          amount: Math.round(amount)
        })).sort((a, b) => b.amount - a.amount),
        cardBreakdown: Object.entries(cardBreakdown).map(([card, amount]) => ({
          card,
          amount: Math.round(amount)
        })).sort((a, b) => b.amount - a.amount)
      },
      filters: {
        query,
        category,
        cardId,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        transactionType,
        status,
        sortBy: sortField,
        sortOrder
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Unexpected error in transaction search API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}