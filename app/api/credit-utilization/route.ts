import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET credit utilization data
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
    const months = parseInt(searchParams.get('months') || '12');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate months parameter
    if (isNaN(months) || months < 1 || months > 24) {
      return NextResponse.json({ 
        error: 'months parameter must be between 1 and 24' 
      }, { status: 400 });
    }

    let query = supabase
      .from('credit_utilization')
      .select(`
        id,
        card_id,
        month_year,
        total_spent,
        credit_limit,
        utilization_percentage,
        average_daily_balance,
        peak_utilization,
        days_over_30_percent,
        days_over_50_percent,
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

    if (startDate && endDate) {
      query = query.gte('month_year', startDate).lte('month_year', endDate);
    } else {
      // Default to last N months
      const endOfCurrentMonth = new Date();
      endOfCurrentMonth.setDate(1); // First day of current month
      const startOfPeriod = new Date(endOfCurrentMonth);
      startOfPeriod.setMonth(startOfPeriod.getMonth() - months + 1);
      
      query = query.gte('month_year', startOfPeriod.toISOString().split('T')[0])
                   .lte('month_year', endOfCurrentMonth.toISOString().split('T')[0]);
    }

    const { data: utilizationData, error } = await query.order('month_year', { ascending: false });

    if (error) {
      console.error('Error fetching credit utilization:', error);
      return NextResponse.json({ error: 'Failed to fetch credit utilization data' }, { status: 500 });
    }

    // Format response
    const formattedData = utilizationData.map(record => {
      const card = Array.isArray(record.credit_cards) ? record.credit_cards[0] : record.credit_cards;
      return {
        id: record.id,
        cardId: record.card_id,
        monthYear: record.month_year,
        totalSpent: record.total_spent,
        creditLimit: record.credit_limit,
        utilizationPercentage: record.utilization_percentage,
        averageDailyBalance: record.average_daily_balance,
        peakUtilization: record.peak_utilization,
        daysOver30Percent: record.days_over_30_percent,
        daysOver50Percent: record.days_over_50_percent,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        card: {
          id: card.id,
          name: card.card_name,
          bankName: card.bank_name,
          cardType: card.card_type,
          last4: card.last_4_digits
        }
      };
    });

    // Calculate summary statistics
    const summary = {
      totalRecords: formattedData.length,
      averageUtilization: formattedData.length > 0 
        ? formattedData.reduce((sum, record) => sum + record.utilizationPercentage, 0) / formattedData.length 
        : 0,
      highestUtilization: formattedData.length > 0 
        ? Math.max(...formattedData.map(record => record.utilizationPercentage)) 
        : 0,
      lowestUtilization: formattedData.length > 0 
        ? Math.min(...formattedData.map(record => record.utilizationPercentage)) 
        : 0,
      monthsOver30Percent: formattedData.filter(record => record.utilizationPercentage > 30).length,
      monthsOver50Percent: formattedData.filter(record => record.utilizationPercentage > 50).length,
      totalSpentAcrossPeriod: formattedData.reduce((sum, record) => sum + record.totalSpent, 0),
      averageCreditLimit: formattedData.length > 0 
        ? formattedData.reduce((sum, record) => sum + record.creditLimit, 0) / formattedData.length 
        : 0
    };

    // Group by card for multi-card analysis
    interface CardAnalysis {
      card: {
        id: string;
        name: string;
        bankName: string;
        cardType: string;
        last4: string;
      };
      records: typeof formattedData;
      averageUtilization: number;
      highestUtilization: number;
      totalSpent: number;
    }

    const byCard = formattedData.reduce((acc, record) => {
      const cardKey = record.cardId;
      if (!acc[cardKey]) {
        acc[cardKey] = {
          card: record.card,
          records: [],
          averageUtilization: 0,
          highestUtilization: 0,
          totalSpent: 0
        };
      }
      acc[cardKey].records.push(record);
      return acc;
    }, {} as Record<string, CardAnalysis>);

    // Calculate per-card statistics
    Object.keys(byCard).forEach(cardKey => {
      const cardData = byCard[cardKey];
      cardData.averageUtilization = cardData.records.reduce((sum: number, record) => sum + record.utilizationPercentage, 0) / cardData.records.length;
      cardData.highestUtilization = Math.max(...cardData.records.map((record) => record.utilizationPercentage));
      cardData.totalSpent = cardData.records.reduce((sum: number, record) => sum + record.totalSpent, 0);
    });

    return NextResponse.json({
      utilizationData: formattedData,
      summary,
      byCard: Object.values(byCard)
    });

  } catch (error) {
    console.error('Unexpected error in credit utilization API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// CREATE or UPDATE credit utilization record
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      cardId, 
      monthYear, 
      totalSpent, 
      creditLimit, 
      averageDailyBalance, 
      peakUtilization,
      daysOver30Percent,
      daysOver50Percent 
    } = body;

    // Validate required fields
    if (!cardId || !monthYear || totalSpent === undefined || !creditLimit) {
      return NextResponse.json({ 
        error: 'cardId, monthYear, totalSpent, and creditLimit are required' 
      }, { status: 400 });
    }

    // Validate card exists and belongs to user
    const { data: card, error: cardError } = await supabase
      .from('credit_cards')
      .select('id, card_name')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Invalid card ID or card not found' }, { status: 400 });
    }

    // Validate numeric fields
    const numericTotalSpent = parseFloat(totalSpent);
    const numericCreditLimit = parseFloat(creditLimit);
    const numericAverageDailyBalance = averageDailyBalance ? parseFloat(averageDailyBalance) : 0;
    const numericPeakUtilization = peakUtilization ? parseFloat(peakUtilization) : 0;

    if (isNaN(numericTotalSpent) || numericTotalSpent < 0) {
      return NextResponse.json({ error: 'totalSpent must be a non-negative number' }, { status: 400 });
    }

    if (isNaN(numericCreditLimit) || numericCreditLimit <= 0) {
      return NextResponse.json({ error: 'creditLimit must be a positive number' }, { status: 400 });
    }

    // Validate date format (should be first day of month)
    const monthYearDate = new Date(monthYear);
    if (isNaN(monthYearDate.getTime())) {
      return NextResponse.json({ error: 'Invalid monthYear format' }, { status: 400 });
    }

    // Ensure it's the first day of the month
    const normalizedDate = new Date(monthYearDate.getFullYear(), monthYearDate.getMonth(), 1);

    // Prepare upsert data
    const utilizationData = {
      user_id: user.id,
      card_id: cardId,
      month_year: normalizedDate.toISOString().split('T')[0],
      total_spent: numericTotalSpent,
      credit_limit: numericCreditLimit,
      average_daily_balance: numericAverageDailyBalance,
      peak_utilization: numericPeakUtilization,
      days_over_30_percent: daysOver30Percent || 0,
      days_over_50_percent: daysOver50Percent || 0
    };

    // Upsert the record (insert or update if exists)
    const { data: utilizationRecord, error: upsertError } = await supabase
      .from('credit_utilization')
      .upsert(utilizationData, { 
        onConflict: 'user_id,card_id,month_year',
        ignoreDuplicates: false 
      })
      .select(`
        id,
        card_id,
        month_year,
        total_spent,
        credit_limit,
        utilization_percentage,
        average_daily_balance,
        peak_utilization,
        days_over_30_percent,
        days_over_50_percent,
        created_at,
        updated_at
      `)
      .single();

    if (upsertError) {
      console.error('Error upserting credit utilization:', upsertError);
      return NextResponse.json({ error: 'Failed to save credit utilization data' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      utilizationRecord: {
        id: utilizationRecord.id,
        cardId: utilizationRecord.card_id,
        monthYear: utilizationRecord.month_year,
        totalSpent: utilizationRecord.total_spent,
        creditLimit: utilizationRecord.credit_limit,
        utilizationPercentage: utilizationRecord.utilization_percentage,
        averageDailyBalance: utilizationRecord.average_daily_balance,
        peakUtilization: utilizationRecord.peak_utilization,
        daysOver30Percent: utilizationRecord.days_over_30_percent,
        daysOver50Percent: utilizationRecord.days_over_50_percent,
        createdAt: utilizationRecord.created_at,
        updatedAt: utilizationRecord.updated_at,
        card: {
          id: card.id,
          name: card.card_name
        }
      },
      message: 'Credit utilization data saved successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in create credit utilization API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}