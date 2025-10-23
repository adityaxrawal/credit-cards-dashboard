import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiWrapper, authError, handleApiError, success } from '@/lib/utils/api-error';

interface Statement {
  id: string;
  statement_date: string;
  due_date: string;
  minimum_payment: number;
  current_balance: number;
  available_credit: number;
  created_at: string;
}

interface Card {
  id: string;
  user_id: string;
  bank_name: string;
  card_name: string;
  last_four_digits: string;
  card_type: string;
  credit_limit: number;
  current_balance: number;
  available_credit: number;
  created_at: string;
  updated_at: string;
  statements?: Statement[];
  latest_statement?: Statement | null;
}

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