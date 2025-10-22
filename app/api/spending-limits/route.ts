import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET spending limits
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');
    const category = searchParams.get('category');
    const period = searchParams.get('period');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let query = supabase
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
        credit_cards!inner(
          id,
          card_name,
          bank_name,
          card_type,
          last_4_digits
        )
      `)
      .eq('user_id', user.id);

    // Apply filters
    if (cardId) {
      query = query.eq('card_id', cardId);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (period) {
      query = query.eq('period', period);
    }
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: spendingLimits, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching spending limits:', error);
      return NextResponse.json({ error: 'Failed to fetch spending limits' }, { status: 500 });
    }

    // Format response
    const formattedLimits = spendingLimits.map(limit => {
      const card = Array.isArray(limit.credit_cards) ? limit.credit_cards[0] : limit.credit_cards;
      const utilizationPercentage = limit.limit_amount > 0 ? (limit.current_spent / limit.limit_amount * 100) : 0;
      const isOverLimit = limit.current_spent > limit.limit_amount;
      const isNearLimit = utilizationPercentage >= (limit.alert_threshold || 80);

      return {
        id: limit.id,
        cardId: limit.card_id,
        category: limit.category,
        limitAmount: limit.limit_amount,
        period: limit.period,
        currentSpent: limit.current_spent,
        remainingAmount: Math.max(0, limit.limit_amount - limit.current_spent),
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
        alertThreshold: limit.alert_threshold,
        alertEnabled: limit.alert_enabled,
        isActive: limit.is_active,
        isOverLimit,
        isNearLimit,
        lastResetDate: limit.last_reset_date,
        createdAt: limit.created_at,
        updatedAt: limit.updated_at,
        card: card ? {
          id: card.id,
          name: card.card_name,
          bankName: card.bank_name,
          cardType: card.card_type,
          last4: card.last_4_digits
        } : null
      };
    });

    // Calculate summary statistics
    const summary = {
      totalLimits: formattedLimits.length,
      activeLimits: formattedLimits.filter(l => l.isActive).length,
      overLimitCount: formattedLimits.filter(l => l.isOverLimit).length,
      nearLimitCount: formattedLimits.filter(l => l.isNearLimit && !l.isOverLimit).length,
      totalLimitAmount: formattedLimits.reduce((sum, l) => sum + l.limitAmount, 0),
      totalSpent: formattedLimits.reduce((sum, l) => sum + l.currentSpent, 0),
      averageUtilization: formattedLimits.length > 0 
        ? formattedLimits.reduce((sum, l) => sum + l.utilizationPercentage, 0) / formattedLimits.length 
        : 0
    };

    return NextResponse.json({
      spendingLimits: formattedLimits,
      summary
    });

  } catch (error) {
    console.error('Unexpected error in spending limits API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CREATE spending limit
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cardId, category, limitAmount, period, alertThreshold, alertEnabled } = body;

    // Validate required fields
    if (!limitAmount || !period) {
      return NextResponse.json({ 
        error: 'limitAmount and period are required' 
      }, { status: 400 });
    }

    // Validate limit amount
    const numericLimitAmount = parseFloat(limitAmount);
    if (isNaN(numericLimitAmount) || numericLimitAmount <= 0) {
      return NextResponse.json({ 
        error: 'limitAmount must be a positive number' 
      }, { status: 400 });
    }

    // Validate period
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return NextResponse.json({ 
        error: 'period must be one of: daily, weekly, monthly, yearly' 
      }, { status: 400 });
    }

    // Validate card if provided
    if (cardId) {
      const { data: card, error: cardError } = await supabase
        .from('credit_cards')
        .select('id')
        .eq('id', cardId)
        .eq('user_id', user.id)
        .single();

      if (cardError || !card) {
        return NextResponse.json({ error: 'Invalid card ID or card not found' }, { status: 400 });
      }
    }

    // Validate alert threshold
    let validatedAlertThreshold = 80.0;
    if (alertThreshold !== undefined) {
      const numericThreshold = parseFloat(alertThreshold);
      if (isNaN(numericThreshold) || numericThreshold < 0 || numericThreshold > 100) {
        return NextResponse.json({ 
          error: 'alertThreshold must be between 0 and 100' 
        }, { status: 400 });
      }
      validatedAlertThreshold = numericThreshold;
    }

    // Check for existing limit with same criteria
    const { data: existingLimit, error: checkError } = await supabase
      .from('spending_limits')
      .select('id')
      .eq('user_id', user.id)
      .eq('period', period)
      .eq('is_active', true)
      .eq('card_id', cardId || null)
      .eq('category', category || null)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing limits:', checkError);
      return NextResponse.json({ error: 'Failed to check existing limits' }, { status: 500 });
    }

    if (existingLimit) {
      return NextResponse.json({ 
        error: 'A spending limit with the same criteria already exists' 
      }, { status: 409 });
    }

    // Create the spending limit
    const { data: newLimit, error: insertError } = await supabase
      .from('spending_limits')
      .insert({
        user_id: user.id,
        card_id: cardId || null,
        category: category || null,
        limit_amount: numericLimitAmount,
        period,
        current_spent: 0,
        alert_threshold: validatedAlertThreshold,
        alert_enabled: alertEnabled !== false,
        is_active: true,
        last_reset_date: new Date().toISOString()
      })
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
        updated_at
      `)
      .single();

    if (insertError) {
      console.error('Error creating spending limit:', insertError);
      return NextResponse.json({ error: 'Failed to create spending limit' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      spendingLimit: {
        id: newLimit.id,
        cardId: newLimit.card_id,
        category: newLimit.category,
        limitAmount: newLimit.limit_amount,
        period: newLimit.period,
        currentSpent: newLimit.current_spent,
        remainingAmount: newLimit.limit_amount,
        utilizationPercentage: 0,
        alertThreshold: newLimit.alert_threshold,
        alertEnabled: newLimit.alert_enabled,
        isActive: newLimit.is_active,
        isOverLimit: false,
        isNearLimit: false,
        lastResetDate: newLimit.last_reset_date,
        createdAt: newLimit.created_at,
        updatedAt: newLimit.updated_at
      },
      message: 'Spending limit created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in create spending limit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}