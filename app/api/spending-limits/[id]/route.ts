import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET single spending limit
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

    const { id: limitId } = await params;

    const { data: spendingLimit, error } = await supabase
      .from('spending_limits')
      .select(`
        id,
        card_id,
        category,
        limit_amount,
        period,
        current_spent,
        alert_threshold,
        alert_enabled,
        is_active,
        last_reset_date,
        created_at,
        updated_at,
        credit_cards(
          id,
          card_name,
          bank_name,
          card_type,
          last_4_digits
        )
      `)
      .eq('id', limitId)
      .eq('user_id', user.id)
      .single();

    if (error || !spendingLimit) {
      return NextResponse.json({ error: 'Spending limit not found' }, { status: 404 });
    }

    // Format response
    const card = Array.isArray(spendingLimit.credit_cards) ? spendingLimit.credit_cards[0] : spendingLimit.credit_cards;
    const utilizationPercentage = spendingLimit.limit_amount > 0 
      ? (spendingLimit.current_spent / spendingLimit.limit_amount * 100) 
      : 0;
    const isOverLimit = spendingLimit.current_spent > spendingLimit.limit_amount;
    const isNearLimit = utilizationPercentage >= (spendingLimit.alert_threshold || 80);

    const formattedLimit = {
      id: spendingLimit.id,
      cardId: spendingLimit.card_id,
      category: spendingLimit.category,
      limitAmount: spendingLimit.limit_amount,
      period: spendingLimit.period,
      currentSpent: spendingLimit.current_spent,
      remainingAmount: Math.max(0, spendingLimit.limit_amount - spendingLimit.current_spent),
      utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
      alertThreshold: spendingLimit.alert_threshold,
      alertEnabled: spendingLimit.alert_enabled,
      isActive: spendingLimit.is_active,
      isOverLimit,
      isNearLimit,
      lastResetDate: spendingLimit.last_reset_date,
      createdAt: spendingLimit.created_at,
      updatedAt: spendingLimit.updated_at,
      card: card ? {
        id: card.id,
        name: card.card_name,
        bankName: card.bank_name,
        cardType: card.card_type,
        last4: card.last_4_digits
      } : null
    };

    return NextResponse.json({ spendingLimit: formattedLimit });

  } catch (error) {
    console.error('Unexpected error in get spending limit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// UPDATE spending limit
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

    const { id: limitId } = await params;
    const body = await request.json();

    // Check if spending limit exists and belongs to user
    const { data: existingLimit, error: fetchError } = await supabase
      .from('spending_limits')
      .select('id, card_id, category, period')
      .eq('id', limitId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingLimit) {
      return NextResponse.json({ error: 'Spending limit not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, string | number | boolean | null> = {};
    
    if (body.limitAmount !== undefined) {
      const numericLimitAmount = parseFloat(body.limitAmount);
      if (isNaN(numericLimitAmount) || numericLimitAmount <= 0) {
        return NextResponse.json({ 
          error: 'limitAmount must be a positive number' 
        }, { status: 400 });
      }
      updateData.limit_amount = numericLimitAmount;
    }

    if (body.period !== undefined) {
      if (!['daily', 'weekly', 'monthly', 'yearly'].includes(body.period)) {
        return NextResponse.json({ 
          error: 'period must be one of: daily, weekly, monthly, yearly' 
        }, { status: 400 });
      }
      updateData.period = body.period;
    }

    if (body.alertThreshold !== undefined) {
      const numericThreshold = parseFloat(body.alertThreshold);
      if (isNaN(numericThreshold) || numericThreshold < 0 || numericThreshold > 100) {
        return NextResponse.json({ 
          error: 'alertThreshold must be between 0 and 100' 
        }, { status: 400 });
      }
      updateData.alert_threshold = numericThreshold;
    }

    if (body.alertEnabled !== undefined) {
      updateData.alert_enabled = Boolean(body.alertEnabled);
    }

    if (body.isActive !== undefined) {
      updateData.is_active = Boolean(body.isActive);
    }

    if (body.currentSpent !== undefined) {
      const numericCurrentSpent = parseFloat(body.currentSpent);
      if (isNaN(numericCurrentSpent) || numericCurrentSpent < 0) {
        return NextResponse.json({ 
          error: 'currentSpent must be a non-negative number' 
        }, { status: 400 });
      }
      updateData.current_spent = numericCurrentSpent;
    }

    // Validate card ID if provided
    if (body.cardId !== undefined) {
      if (body.cardId === null) {
        updateData.card_id = null;
      } else {
        const { data: card, error: cardError } = await supabase
          .from('credit_cards')
          .select('id')
          .eq('id', body.cardId)
          .eq('user_id', user.id)
          .single();

        if (cardError || !card) {
          return NextResponse.json({ error: 'Invalid card ID or card not found' }, { status: 400 });
        }
        updateData.card_id = body.cardId;
      }
    }

    if (body.category !== undefined) {
      updateData.category = body.category ? body.category.trim() : null;
    }

    // Check for conflicts if key fields are being changed
    if (updateData.card_id !== undefined || updateData.category !== undefined || updateData.period !== undefined) {
      const checkCardId = updateData.card_id !== undefined ? updateData.card_id : existingLimit.card_id;
      const checkCategory = updateData.category !== undefined ? updateData.category : existingLimit.category;
      const checkPeriod = updateData.period !== undefined ? updateData.period : existingLimit.period;

      const { data: conflictingLimit, error: conflictError } = await supabase
        .from('spending_limits')
        .select('id')
        .eq('user_id', user.id)
        .eq('period', checkPeriod)
        .eq('is_active', true)
        .eq('card_id', checkCardId || null)
        .eq('category', checkCategory || null)
        .neq('id', limitId)
        .single();

      if (conflictError && conflictError.code !== 'PGRST116') {
        console.error('Error checking for conflicts:', conflictError);
        return NextResponse.json({ error: 'Failed to check for conflicts' }, { status: 500 });
      }

      if (conflictingLimit) {
        return NextResponse.json({ 
          error: 'A spending limit with the same criteria already exists' 
        }, { status: 409 });
      }
    }

    // Perform the update
    const { data: updatedLimit, error: updateError } = await supabase
      .from('spending_limits')
      .update(updateData)
      .eq('id', limitId)
      .eq('user_id', user.id)
      .select(`
        id,
        card_id,
        category,
        limit_amount,
        period,
        current_spent,
        alert_threshold,
        alert_enabled,
        is_active,
        last_reset_date,
        created_at,
        updated_at,
        credit_cards(
          id,
          card_name,
          bank_name,
          card_type,
          last_4_digits
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating spending limit:', updateError);
      return NextResponse.json({ error: 'Failed to update spending limit' }, { status: 500 });
    }

    // Format response
    const card = Array.isArray(updatedLimit.credit_cards) ? updatedLimit.credit_cards[0] : updatedLimit.credit_cards;
    const utilizationPercentage = updatedLimit.limit_amount > 0 
      ? (updatedLimit.current_spent / updatedLimit.limit_amount * 100) 
      : 0;
    const isOverLimit = updatedLimit.current_spent > updatedLimit.limit_amount;
    const isNearLimit = utilizationPercentage >= (updatedLimit.alert_threshold || 80);

    const formattedLimit = {
      id: updatedLimit.id,
      cardId: updatedLimit.card_id,
      category: updatedLimit.category,
      limitAmount: updatedLimit.limit_amount,
      period: updatedLimit.period,
      currentSpent: updatedLimit.current_spent,
      remainingAmount: Math.max(0, updatedLimit.limit_amount - updatedLimit.current_spent),
      utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
      alertThreshold: updatedLimit.alert_threshold,
      alertEnabled: updatedLimit.alert_enabled,
      isActive: updatedLimit.is_active,
      isOverLimit,
      isNearLimit,
      lastResetDate: updatedLimit.last_reset_date,
      createdAt: updatedLimit.created_at,
      updatedAt: updatedLimit.updated_at,
      card: card ? {
        id: card.id,
        name: card.card_name,
        bankName: card.bank_name,
        cardType: card.card_type,
        last4: card.last_4_digits
      } : null
    };

    return NextResponse.json({
      success: true,
      spendingLimit: formattedLimit,
      message: 'Spending limit updated successfully'
    });

  } catch (error) {
    console.error('Unexpected error in update spending limit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE spending limit
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

    const { id: limitId } = await params;

    // Check if spending limit exists and belongs to user
    const { data: existingLimit, error: fetchError } = await supabase
      .from('spending_limits')
      .select('id, category, limit_amount, period')
      .eq('id', limitId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingLimit) {
      return NextResponse.json({ error: 'Spending limit not found' }, { status: 404 });
    }

    // Delete the spending limit
    const { error: deleteError } = await supabase
      .from('spending_limits')
      .delete()
      .eq('id', limitId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting spending limit:', deleteError);
      return NextResponse.json({ error: 'Failed to delete spending limit' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Spending limit deleted successfully'
    });

  } catch (error) {
    console.error('Unexpected error in delete spending limit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}