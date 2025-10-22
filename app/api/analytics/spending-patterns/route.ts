import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '6months';

    // Mock spending patterns data
    const mockData = {
      period,
      totalTransactions: 156,
      totalSpending: 2847.50,
      patterns: {
        timeOfDay: [
          { hour: '06:00', transactions: 8, amount: 45.20, category: 'Coffee & Breakfast' },
          { hour: '12:00', transactions: 25, amount: 320.50, category: 'Lunch' },
          { hour: '18:00', transactions: 35, amount: 580.75, category: 'Dinner' },
          { hour: '20:00', transactions: 18, amount: 245.30, category: 'Entertainment' }
        ],
        dayOfWeek: [
          { day: 'Monday', transactions: 18, amount: 285.40, avgPerTransaction: 15.86 },
          { day: 'Tuesday', transactions: 22, amount: 340.20, avgPerTransaction: 15.46 },
          { day: 'Wednesday', transactions: 20, amount: 310.50, avgPerTransaction: 15.53 },
          { day: 'Thursday', transactions: 25, amount: 420.80, avgPerTransaction: 16.83 },
          { day: 'Friday', transactions: 28, amount: 485.60, avgPerTransaction: 17.34 },
          { day: 'Saturday', transactions: 32, amount: 650.75, avgPerTransaction: 20.34 },
          { day: 'Sunday', transactions: 11, amount: 354.25, avgPerTransaction: 32.20 }
        ],
        monthlyTrends: [
          { month: 'October', spending: 2654.30, transactions: 142, avgDaily: 85.62 },
          { month: 'November', spending: 2847.50, transactions: 156, avgDaily: 94.92 },
          { month: 'December', spending: 3120.80, transactions: 168, avgDaily: 100.67 }
        ],
        merchantFrequency: [
          { merchant: 'Starbucks', visits: 24, totalSpent: 156.80, avgPerVisit: 6.53 },
          { merchant: 'Amazon', visits: 18, totalSpent: 485.60, avgPerVisit: 26.98 },
          { merchant: 'Target', visits: 12, totalSpent: 320.45, avgPerVisit: 26.70 },
          { merchant: 'Shell Gas Station', visits: 8, totalSpent: 240.30, avgPerVisit: 30.04 }
        ],
        categoryPatterns: [
          {
            category: 'Groceries',
            peakDays: ['Saturday', 'Sunday'],
            peakHours: ['10:00', '14:00', '18:00'],
            avgTransactionSize: 45.20,
            frequency: 'Weekly'
          },
          {
            category: 'Dining',
            peakDays: ['Friday', 'Saturday'],
            peakHours: ['12:00', '19:00'],
            avgTransactionSize: 28.50,
            frequency: 'Daily'
          },
          {
            category: 'Gas',
            peakDays: ['Monday', 'Friday'],
            peakHours: ['08:00', '17:00'],
            avgTransactionSize: 52.30,
            frequency: 'Bi-weekly'
          }
        ]
      },
      insights: {
        mostActiveDay: 'Saturday',
        mostActiveHour: '18:00',
        highestSpendingCategory: 'Groceries',
        mostFrequentMerchant: 'Starbucks',
        spendingConsistency: 'Moderate',
        weekendVsWeekday: {
          weekend: { transactions: 43, amount: 1005.00, percentage: 35.3 },
          weekday: { transactions: 113, amount: 1842.50, percentage: 64.7 }
        }
      }
    };

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('Error in spending patterns API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}