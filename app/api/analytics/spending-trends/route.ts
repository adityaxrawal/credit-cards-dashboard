import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '1month';

    // Mock spending trends data matching expected structure
    const mockData = {
      period,
      monthlySpending: [
        { month: '2024-01', amount: 2654.30, transactionCount: 42 },
        { month: '2024-02', amount: 2847.50, transactionCount: 45 },
        { month: '2024-03', amount: 3120.80, transactionCount: 48 },
        { month: '2024-04', amount: 2890.20, transactionCount: 44 },
        { month: '2024-05', amount: 3250.60, transactionCount: 52 },
        { month: '2024-06', amount: 2975.40, transactionCount: 46 }
      ],
      categoryTrends: [
        {
          category: 'Groceries',
          currentMonth: 450.00,
          previousMonth: 420.00,
          percentageChange: 7.1,
          trend: 'up'
        },
        {
          category: 'Dining',
          currentMonth: 320.00,
          previousMonth: 380.00,
          percentageChange: -15.8,
          trend: 'down'
        },
        {
          category: 'Transportation',
          currentMonth: 180.00,
          previousMonth: 165.00,
          percentageChange: 9.1,
          trend: 'up'
        },
        {
          category: 'Entertainment',
          currentMonth: 95.00,
          previousMonth: 125.00,
          percentageChange: -24.0,
          trend: 'down'
        },
        {
          category: 'Shopping',
          currentMonth: 650.00,
          previousMonth: 580.00,
          percentageChange: 12.1,
          trend: 'up'
        },
        {
          category: 'Healthcare',
          currentMonth: 220.00,
          previousMonth: 200.00,
          percentageChange: 10.0,
          trend: 'up'
        }
      ],
      spendingVelocity: {
        dailyAverage: 95.25,
        weeklyGrowth: 5.2,
        monthlyGrowth: 7.3
      },
      insights: {
        highestSpendingMonth: '2024-05',
        lowestSpendingMonth: '2024-01',
        averageMonthlySpending: 2956.47,
        totalSpending: 17738.80
      }
    };

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('Error in spending trends API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}