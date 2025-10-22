import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate required fields
    const {
      cardId,
      amount,
      merchant,
      category,
      date,
      description,
      transactionType = 'debit',
      tags = [],
      notes = '',
      isRecurring = false
    } = body;

    if (!cardId || !amount || !merchant || !category || !date) {
      return NextResponse.json({ 
        error: 'Missing required fields: cardId, amount, merchant, category, date' 
      }, { status: 400 });
    }

    // Validate card belongs to user
    const { data: card, error: cardError } = await supabase
      .from('credit_cards')
      .select('id, last_4_digits, card_name, bank_name')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Invalid card ID or card not found' }, { status: 400 });
    }

    // Validate amount
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) {
      return NextResponse.json({ error: 'Invalid amount format' }, { status: 400 });
    }

    // Validate date
    const transactionDate = new Date(date);
    if (isNaN(transactionDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Validate transaction type
    if (!['debit', 'credit'].includes(transactionType)) {
      return NextResponse.json({ error: 'Transaction type must be either "debit" or "credit"' }, { status: 400 });
    }

    // Validate tags array
    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 });
    }

    // Check for potential duplicates (same card, amount, merchant, and date within 1 hour)
    const hourBefore = new Date(transactionDate.getTime() - 60 * 60 * 1000);
    const hourAfter = new Date(transactionDate.getTime() + 60 * 60 * 1000);

    const { data: duplicates } = await supabase
      .from('current_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('card_id', cardId)
      .eq('amount', transactionType === 'debit' ? -Math.abs(numericAmount) : Math.abs(numericAmount))
      .eq('merchant', merchant)
      .gte('date', hourBefore.toISOString())
      .lte('date', hourAfter.toISOString())
      .limit(1);

    if (duplicates && duplicates.length > 0) {
      return NextResponse.json({ 
        error: 'A similar transaction already exists within the same time period',
        duplicateId: duplicates[0].id
      }, { status: 409 });
    }

    // Create the transaction
    const transactionAmount = transactionType === 'debit' ? -Math.abs(numericAmount) : Math.abs(numericAmount);
    
    const { data: transaction, error: insertError } = await supabase
      .from('current_transactions')
      .insert({
        user_id: user.id,
        card_id: cardId,
        amount: transactionAmount,
        merchant: merchant.trim(),
        category: category.trim(),
        date: transactionDate.toISOString(),
        description: description?.trim() || `${merchant} - ${Math.abs(numericAmount)}`,
        transaction_type: transactionType,
        card_last_4: card.last_4_digits,
        is_processed: true,
        tags: tags.filter(tag => tag && tag.trim()).map(tag => tag.trim()),
        notes: notes?.trim() || '',
        is_recurring: Boolean(isRecurring),
        gmail_message_id: null, // Manual transactions don't have email IDs
        created_at: new Date().toISOString()
      })
      .select(`
        id,
        amount,
        merchant,
        category,
        date,
        description,
        transaction_type,
        card_last_4,
        tags,
        notes,
        is_recurring,
        created_at
      `)
      .single();

    if (insertError) {
      console.error('Error creating transaction:', insertError);
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }

    // Format response
    const formattedTransaction = {
      id: transaction.id,
      amount: transaction.amount,
      merchant: transaction.merchant,
      category: transaction.category,
      date: transaction.date,
      description: transaction.description,
      transactionType: transaction.transaction_type,
      cardLast4: transaction.card_last_4,
      tags: transaction.tags || [],
      notes: transaction.notes || '',
      isRecurring: transaction.is_recurring || false,
      createdAt: transaction.created_at,
      card: {
        id: card.id,
        name: card.card_name,
        bankName: card.bank_name,
        last4: card.last_4_digits
      }
    };

    // If this is a recurring transaction, we might want to set up future reminders
    // This could be implemented later as part of the notification system

    return NextResponse.json({
      success: true,
      transaction: formattedTransaction,
      message: 'Transaction created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in create transaction API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}