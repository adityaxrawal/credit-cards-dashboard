import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Statement {
  id: string;
  statement_date: string;
  due_date: string;
  minimum_payment: number;
  current_balance: number;
  available_credit: number;
  created_at: string;
}

interface Transaction {
  id: string;
  card_id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  type: 'debit' | 'credit' | 'reversal';
  created_at: string;
}

interface Perk {
  id: string;
  card_id: string;
  perk_type: string;
  description: string;
  value: string;
  is_active: boolean;
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
  transactions?: Transaction[];
  perks?: Perk[];
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await context.params;
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch single card with all related data
    const { data: card, error: cardError } = await supabase
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
        ),
        transactions:current_transactions(
          id,
          card_id,
          amount,
          description,
          category,
          date,
          type,
          created_at
        ),
        perks:card_perks(
          id,
          card_id,
          perk_type,
          description,
          value,
          is_active,
          created_at
        )
      `)
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (cardError) {
      if (cardError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Card not found' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching card:', cardError);
      return NextResponse.json(
        { error: 'Failed to fetch card' },
        { status: 500 }
      );
    }

    // Sort statements by date (newest first)
    if (card.statements) {
      card.statements = card.statements.sort((a: Statement, b: Statement) => 
        new Date(b.statement_date).getTime() - new Date(a.statement_date).getTime()
      );
    }

    // Sort transactions by date (newest first)
    if (card.transactions) {
      card.transactions = card.transactions.sort((a: Transaction, b: Transaction) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    // Filter active perks
    if (card.perks) {
      card.perks = card.perks.filter((perk: Perk) => perk.is_active);
    }

    return NextResponse.json(card);

  } catch (error) {
    console.error('Unexpected error in card API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}