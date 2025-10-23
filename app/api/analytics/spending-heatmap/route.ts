import { NextRequest, NextResponse } from 'next/server';
import { getSampleTransactions } from '@/lib/sampleData';
import { subDays, subMonths, format, getDay, getHours, startOfDay, eachDayOfInterval } from 'date-fns';

interface HeatmapData {
  date: string;
  day: number; // 0-6 (Sunday-Saturday)
  hour?: number; // 0-23 for hourly view
  amount: number;
  transactions: number;
  intensity: number; // 0-1 for color intensity
  categories: Record<string, number>;
}

interface LocationData {
  location: string;
  amount: number;
  transactions: number;
  percentage: number;
  coordinates?: { lat: number; lng: number };
}

interface SpendingHeatmapResponse {
  heatmapData: HeatmapData[];
  locationData: LocationData[];
  insights: {
    peakSpendingDay: string;
    peakSpendingHour?: string;
    quietestDay: string;
    quietestHour?: string;
    weekdayVsWeekend: {
      weekday: { amount: number; average: number };
      weekend: { amount: number; average: number };
    };
    hourlyPattern: string; // 'morning', 'afternoon', 'evening', 'night'
    topLocation: string;
  };
  summary: {
    totalAmount: number;
    totalTransactions: number;
    averagePerDay: number;
    averagePerHour?: number;
    mostActiveTimeframe: string;
  };
}

// Mock location data
const mockLocations = [
  'New York, NY',
  'Los Angeles, CA',
  'Chicago, IL',
  'Houston, TX',
  'Phoenix, AZ',
  'Philadelphia, PA',
  'San Antonio, TX',
  'San Diego, CA',
  'Dallas, TX',
  'San Jose, CA'
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const viewType = searchParams.get('viewType') || 'daily'; // 'daily', 'hourly', 'location'
    const category = searchParams.get('category');
    const cardId = searchParams.get('cardId');

    // Get date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = subDays(now, 7);
        break;
      case '30d':
        startDate = subDays(now, 30);
        break;
      case '90d':
        startDate = subDays(now, 90);
        break;
      default:
        startDate = subDays(now, 30);
    }

    // Mock spending heatmap data matching expected structure
    const mockData = {
      heatmapData: [
        {
          date: '2024-01-15',
          day: 1, // Monday
          hour: 9,
          amount: 45.50,
          transactions: 2,
          intensity: 0.6,
          categories: { 'Groceries': 25.50, 'Coffee': 20.00 }
        },
        {
          date: '2024-01-15',
          day: 1, // Monday
          hour: 12,
          amount: 28.75,
          transactions: 1,
          intensity: 0.4,
          categories: { 'Dining': 28.75 }
        },
        {
          date: '2024-01-16',
          day: 2, // Tuesday
          hour: 18,
          amount: 85.20,
          transactions: 3,
          intensity: 0.9,
          categories: { 'Groceries': 45.20, 'Transportation': 40.00 }
        },
        {
          date: '2024-01-17',
          day: 3, // Wednesday
          hour: 14,
          amount: 120.00,
          transactions: 1,
          intensity: 1.0,
          categories: { 'Shopping': 120.00 }
        }
      ],
      locationData: [
        {
          location: 'Downtown',
          amount: 1250.75,
          transactions: 45,
          percentage: 65.2,
          coordinates: { lat: 40.7128, lng: -74.0060 }
        },
        {
          location: 'Suburb',
          amount: 890.50,
          transactions: 32,
          percentage: 34.8,
          coordinates: { lat: 40.7589, lng: -73.9851 }
        }
      ],
      insights: {
        peakSpendingTime: '6:00 PM',
        peakSpendingDay: 'Saturday',
        averageTransactionAmount: 42.50,
        totalHeatmapTransactions: 156,
        weekdayVsWeekendSpending: {
          weekday: 2450.75,
          weekend: 1890.25,
          weekdayPercentage: 56.5,
          weekendPercentage: 43.5
        },
        spendingDistribution: {
          morning: 25.5,
          afternoon: 35.2,
          evening: 39.3
        }
      },
      summary: {
        totalAmount: 4341.00,
        totalTransactions: 156,
        averagePerTransaction: 27.83,
        peakHour: 18,
        peakDay: 'Saturday'
      }
    };

    const response: SpendingHeatmapResponse = {
      heatmapData: mockData.heatmapData.map(item => ({
        date: item.date,
        day: item.day,
        hour: item.hour,
        amount: item.amount,
        transactions: item.transactions,
        intensity: item.intensity,
        categories: Object.fromEntries(
          Object.entries(item.categories).filter(([, v]) => v !== undefined)
        )
      })),
      locationData: mockData.locationData,
      insights: {
        peakSpendingDay: mockData.insights.peakSpendingDay,
        peakSpendingHour: mockData.insights.peakSpendingTime,
        quietestDay: 'Monday',
        quietestHour: '9:00',
        weekdayVsWeekend: {
          weekday: {
            amount: mockData.insights.weekdayVsWeekendSpending.weekday,
            average: mockData.insights.weekdayVsWeekendSpending.weekday / 5
          },
          weekend: {
            amount: mockData.insights.weekdayVsWeekendSpending.weekend,
            average: mockData.insights.weekdayVsWeekendSpending.weekend / 2
          }
        },
        hourlyPattern: 'evening',
        topLocation: mockData.locationData[0]?.location || 'N/A'
      },
      summary: {
        totalAmount: mockData.summary.totalAmount,
        totalTransactions: mockData.summary.totalTransactions,
        averagePerDay: mockData.summary.totalAmount / 30,
        averagePerHour: viewType === 'hourly' ? mockData.summary.totalAmount / (30 * 24) : undefined,
        mostActiveTimeframe: `${mockData.insights.peakSpendingDay} at ${mockData.insights.peakSpendingTime}`
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching spending heatmap:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spending heatmap' },
      { status: 500 }
    );
  }
}