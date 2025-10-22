import { NextRequest, NextResponse } from 'next/server';
import { getSampleTransactions } from '@/lib/sampleData';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '1month'; // 1month, 3months, 6months, 1year
    const cardId = searchParams.get('cardId'); // Optional filter by card

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '3':
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6':
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case '1year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default: // 1month
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }

    // Mock category breakdown data matching expected structure
    const mockData = {
      categories: [
        {
          category: 'Groceries',
          amount: 1245.50,
          percentage: 32.5,
          transactionCount: 28,
          averageTransaction: 44.48,
          topMerchants: ['Whole Foods', 'Trader Joe\'s', 'Safeway'],
          monthlyBreakdown: [
            { month: 'Jan', amount: 420.00 },
            { month: 'Feb', amount: 385.50 },
            { month: 'Mar', amount: 440.00 }
          ]
        },
        {
          category: 'Dining',
          amount: 892.30,
          percentage: 23.3,
          transactionCount: 35,
          averageTransaction: 25.49,
          topMerchants: ['Starbucks', 'McDonald\'s', 'Chipotle'],
          monthlyBreakdown: [
            { month: 'Jan', amount: 320.00 },
            { month: 'Feb', amount: 285.30 },
            { month: 'Mar', amount: 287.00 }
          ]
        },
        {
          category: 'Transportation',
          amount: 567.80,
          percentage: 14.8,
          transactionCount: 18,
          averageTransaction: 31.54,
          topMerchants: ['Shell', 'Uber', 'Metro'],
          monthlyBreakdown: [
            { month: 'Jan', amount: 180.00 },
            { month: 'Feb', amount: 195.80 },
            { month: 'Mar', amount: 192.00 }
          ]
        },
        {
          category: 'Entertainment',
          amount: 423.90,
          percentage: 11.1,
          transactionCount: 15,
          averageTransaction: 28.26,
          topMerchants: ['Netflix', 'AMC Theaters', 'Spotify'],
          monthlyBreakdown: [
            { month: 'Jan', amount: 145.00 },
            { month: 'Feb', amount: 138.90 },
            { month: 'Mar', amount: 140.00 }
          ]
        },
        {
          category: 'Shopping',
          amount: 698.50,
          percentage: 18.3,
          transactionCount: 22,
          averageTransaction: 31.75,
          topMerchants: ['Amazon', 'Target', 'Best Buy'],
          monthlyBreakdown: [
            { month: 'Jan', amount: 250.00 },
            { month: 'Feb', amount: 220.50 },
            { month: 'Mar', amount: 228.00 }
          ]
        }
      ],
      totalAmount: 3828.00,
      insights: {
        topCategory: 'Groceries',
        mostFrequentCategory: 'Dining',
        highestAverageCategory: 'Groceries',
        fastestGrowingCategory: 'Transportation',
        fastestDecliningCategory: 'Entertainment',
        diversityScore: 0.78,
        emergingCategories: ['Health & Fitness'],
        decliningCategories: ['Entertainment']
      }
    };

    const response = mockData;

    return NextResponse.json(response);

  } catch (error) {
    console.error('Unexpected error in category breakdown API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}