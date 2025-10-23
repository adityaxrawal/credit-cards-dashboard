import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET single transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await params;

    const { data: transaction, error } = await supabase
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
        gmail_message_id,
        created_at,
        card_id,
        credit_cards!inner(
          id,
          card_name,
          bank_name,
          card_type,
          last_4_digits
        )
      `)
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single();

    if (error || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Format response
    const card = Array.isArray(transaction.credit_cards) ? transaction.credit_cards[0] : transaction.credit_cards;
    const formattedTransaction = {
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
      gmailMessageId: transaction.gmail_message_id,
      createdAt: transaction.created_at,
      card: {
        id: card?.id,
        name: card?.card_name,
        bankName: card?.bank_name,
        cardType: card?.card_type,
        last4: card?.last_4_digits
      }
    };

    return NextResponse.json({ transaction: formattedTransaction });

  } catch (error) {
    console.error('Unexpected error in get transaction API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// UPDATE transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await params;
    const body = await request.json();

    // Check if transaction exists and belongs to user
    const { data: existingTransaction, error: fetchError } = await supabase
      .from('current_transactions')
      .select('id, gmail_message_id, card_id')
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, string | number | boolean | string[] | null> = {};
    
    if (body.merchant !== undefined) updateData.merchant = body.merchant.trim();
    if (body.category !== undefined) updateData.category = body.category.trim();
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) {
        return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 });
      }
      updateData.tags = body.tags.filter((tag: string) => tag && tag.trim()).map((tag: string) => tag.trim());
    }
    if (body.notes !== undefined) updateData.notes = body.notes.trim();
    if (body.isRecurring !== undefined) updateData.is_recurring = Boolean(body.isRecurring);

    // Validate amount if provided
    if (body.amount !== undefined) {
      const numericAmount = parseFloat(body.amount);
      if (isNaN(numericAmount)) {
        return NextResponse.json({ error: 'Invalid amount format' }, { status: 400 });
      }
      // Preserve the sign based on transaction type
      if (body.transactionType === 'debit') {
        updateData.amount = -Math.abs(numericAmount);
      } else if (body.transactionType === 'credit') {
        updateData.amount = Math.abs(numericAmount);
      } else {
        updateData.amount = numericAmount;
      }
    }

    // Validate date if provided
    if (body.date !== undefined) {
      const transactionDate = new Date(body.date);
      if (isNaN(transactionDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }
      updateData.date = transactionDate.toISOString();
    }

    // Validate transaction type if provided
    if (body.transactionType !== undefined) {
      if (!['debit', 'credit'].includes(body.transactionType)) {
        return NextResponse.json({ error: 'Transaction type must be either "debit" or "credit"' }, { status: 400 });
      }
      updateData.transaction_type = body.transactionType;
    }

    // Validate card ID if provided
    if (body.cardId !== undefined) {
      const { data: card, error: cardError } = await supabase
        .from('credit_cards')
        .select('id, last_4_digits')
        .eq('id', body.cardId)
        .eq('user_id', user.id)
        .single();

      if (cardError || !card) {
        return NextResponse.json({ error: 'Invalid card ID or card not found' }, { status: 400 });
      }
      updateData.card_id = body.cardId;
      updateData.card_last_4 = card.last_4_digits;
    }

    // Perform the update
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('current_transactions')
      .update(updateData)
      .eq('id', transactionId)
      .eq('user_id', user.id)
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
        gmail_message_id,
        created_at,
        card_id,
        credit_cards!inner(
          id,
          card_name,
          bank_name,
          card_type,
          last_4_digits
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating transaction:', updateError);
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    // Format response
    const card = Array.isArray(updatedTransaction.credit_cards) ? updatedTransaction.credit_cards[0] : updatedTransaction.credit_cards;
    const formattedTransaction = {
      id: updatedTransaction.id,
      amount: updatedTransaction.amount,
      merchant: updatedTransaction.merchant,
      category: updatedTransaction.category,
      date: updatedTransaction.date,
      description: updatedTransaction.description,
      transactionType: updatedTransaction.transaction_type,
      cardLast4: updatedTransaction.card_last_4,
      isProcessed: updatedTransaction.is_processed,
      tags: updatedTransaction.tags || [],
      notes: updatedTransaction.notes || '',
      isRecurring: updatedTransaction.is_recurring || false,
      gmailMessageId: updatedTransaction.gmail_message_id,
      createdAt: updatedTransaction.created_at,
      card: {
        id: card?.id,
        name: card?.card_name,
        bankName: card?.bank_name,
        cardType: card?.card_type,
        last4: card?.last_4_digits
      }
    };

    return NextResponse.json({
      success: true,
      transaction: formattedTransaction,
      message: 'Transaction updated successfully'
    });

  } catch (error) {
    console.error('Unexpected error in update transaction API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await params;

    // Check if transaction exists and belongs to user
    const { data: existingTransaction, error: fetchError } = await supabase
      .from('current_transactions')
      .select('id, gmail_message_id, merchant, amount')
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Check if this is an email-imported transaction
    const isEmailTransaction = existingTransaction.gmail_message_id !== null;

    // Delete the transaction
    const { error: deleteError } = await supabase
      .from('current_transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting transaction:', deleteError);
      return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Transaction deleted successfully',
      warning: isEmailTransaction ? 'This transaction was imported from email. It may be re-imported if the email is processed again.' : null
    });

  } catch (error) {
    console.error('Unexpected error in delete transaction API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}