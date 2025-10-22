import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'current';

    // Mock budget comparison data matching expected structure
    const mockData = {
      budgets: [
        {
          category: 'Groceries',
          budgetAmount: 600.00,
          actualAmount: 450.00,
          percentage: 75.0,
          status: 'under',
          remainingAmount: 150.00,
          daysRemaining: 12,
          projectedAmount: 520.00,
          trend: 'improving'
        },
        {
          category: 'Dining',
          budgetAmount: 300.00,
          actualAmount: 320.00,
          percentage: 106.7,
          status: 'over',
          remainingAmount: -20.00,
          daysRemaining: 12,
          projectedAmount: 350.00,
          trend: 'worsening'
        },
        {
          category: 'Transportation',
          budgetAmount: 250.00,
          actualAmount: 180.00,
          percentage: 72.0,
          status: 'under',
          remainingAmount: 70.00,
          daysRemaining: 12,
          projectedAmount: 210.00,
          trend: 'stable'
        },
        {
          category: 'Entertainment',
          budgetAmount: 150.00,
          actualAmount: 95.00,
          percentage: 63.3,
          status: 'under',
          remainingAmount: 55.00,
          daysRemaining: 12,
          projectedAmount: 110.00,
          trend: 'improving'
        },
        {
          category: 'Shopping',
          budgetAmount: 800.00,
          actualAmount: 720.00,
          percentage: 90.0,
          status: 'near',
          remainingAmount: 80.00,
          daysRemaining: 12,
          projectedAmount: 850.00,
          trend: 'worsening'
        }
      ],
      totalBudget: 2100.00,
      totalSpent: 1765.00,
      overallPercentage: 84.0,
      overallStatus: 'near',
      insights: {
        categoriesOverBudget: 1,
        categoriesNearLimit: 1,
        projectedOverspend: 240.00,
        bestPerformingCategory: 'Entertainment',
        worstPerformingCategory: 'Dining'
      }
    };

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('Error in budget comparison API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}