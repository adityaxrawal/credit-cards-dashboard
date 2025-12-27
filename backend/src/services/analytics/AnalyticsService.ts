import * as analyticsQueries from '../../db/queries/analytics.queries';
import * as transactionsQueries from '../../db/queries/transactions.queries';
import dayjs from 'dayjs';

export class AnalyticsService {
  /**
   * Get overview analytics
   */
  static async getOverview(userId: string) {
    const cacheKey = 'overview:current_month';

    // Try to get from cache
    const cached = await analyticsQueries.getCachedAnalytics(userId, cacheKey);
    if (cached) {
      return cached;
    }

    const now = dayjs();
    const currentMonth = now.month() + 1;
    const currentYear = now.year();

    const prevMonth = now.subtract(1, 'month').month() + 1;
    const prevYear = now.subtract(1, 'month').year();

    // Current month stats
    const currentStats = await AnalyticsService.getMonthStats(userId, currentMonth, currentYear);

    // Previous month stats
    const prevStats = await AnalyticsService.getMonthStats(userId, prevMonth, prevYear);

    const overview = {
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        ...currentStats,
      },
      previousMonth: {
        month: prevMonth,
        year: prevYear,
        ...prevStats,
      },
      delta: {
        totalSpent: currentStats.totalSpent - prevStats.totalSpent,
        transactionCount: currentStats.transactionCount - prevStats.transactionCount,
      },
      lastUpdated: new Date()
    };

    // Cache for 1 hour
    const expiresAt = dayjs().add(1, 'hour').toDate();
    await analyticsQueries.setCachedAnalytics(userId, cacheKey, overview, undefined, undefined, expiresAt);

    return overview;
  }

  /**
   * Get month stats helper
   */
  private static async getMonthStats(userId: string, month: number, year: number) {
    const from = dayjs().year(year).month(month - 1).startOf('month').toDate();
    const to = dayjs().year(year).month(month - 1).endOf('month').toDate();

    const aggregations = await transactionsQueries.getSpendingAggregations(userId, {
      from,
      to,
    });

    return {
      totalSpent: aggregations.totalSpent,
      transactionCount: aggregations.totalTransactions,
      byCategory: aggregations.byCategory,
    };
  }

  /**
   * Get category breakdown
   */
  static async getCategoryBreakdown(userId: string, month?: number, year?: number) {
    const targetMonth = month || dayjs().month() + 1;
    const targetYear = year || dayjs().year();

    const cacheKey = `categories:${targetYear}-${targetMonth}`;

    // Try cache
    const cached = await analyticsQueries.getCachedAnalytics(userId, cacheKey);
    if (cached) {
      return cached;
    }

    const from = dayjs().year(targetYear).month(targetMonth - 1).startOf('month').toDate();
    const to = dayjs().year(targetYear).month(targetMonth - 1).endOf('month').toDate();

    const aggregations = await transactionsQueries.getSpendingAggregations(userId, {
      from,
      to,
    });

    const result = {
      month: targetMonth,
      year: targetYear,
      totalSpent: aggregations.totalSpent,
      categories: aggregations.byCategory,
    };

    // Cache for 1 hour
    const expiresAt = dayjs().add(1, 'hour').toDate();
    await analyticsQueries.setCachedAnalytics(userId, cacheKey, result, from, to, expiresAt);

    return result;
  }

  /**
   * Get spending trends (Monthly)
   */
  static async getTrends(userId: string, rangeMonths: number = 6) {
    const trends: Array<{
      month: number;
      year: number;
      totalSpent: number;
      transactionCount: number;
    }> = [];

    for (let i = 0; i < rangeMonths; i++) {
      const date = dayjs().subtract(i, 'month');
      const month = date.month() + 1;
      const year = date.year();

      const stats = await AnalyticsService.getMonthStats(userId, month, year);

      trends.push({
        month,
        year,
        totalSpent: stats.totalSpent,
        transactionCount: stats.transactionCount,
      });
    }

    return trends.reverse(); // Chronological order
  }

  /**
   * Get top merchants (Optimized)
   */
  static async getTopMerchants(userId: string, limit: number = 10) {
    const cacheKey = `top_merchants_${limit}`;

    // Try cache
    const cached = await analyticsQueries.getCachedAnalytics(userId, cacheKey);
    if (cached) return cached;

    // Use optimized DB query
    const merchants = await analyticsQueries.getMerchantStats(userId, limit);

    const result = {
      merchants
    };

    // Cache for 6 hours
    const expiresAt = dayjs().add(6, 'hour').toDate();
    await analyticsQueries.setCachedAnalytics(userId, cacheKey, result, undefined, undefined, expiresAt);

    return result;
  }

  /**
   * Get Monthly Category Spend (Yearly View)
   */
  static async getMonthlyCategorySpend(userId: string, year: number) {
    const cacheKey = `monthly_category_spend_${year}`;
    const cached = await analyticsQueries.getCachedAnalytics(userId, cacheKey);
    if (cached) return cached;

    const data = await analyticsQueries.getMonthlyCategorySpend(userId, year);

    // Cache logic
    const isCurrentYear = dayjs().year() === year;
    const expiresAt = dayjs().add(isCurrentYear ? 1 : 24, 'hour').toDate();

    await analyticsQueries.setCachedAnalytics(userId, cacheKey, data, undefined, undefined, expiresAt);
    return data;
  }

  /**
   * Get Daily Spend Trends
   */
  static async getDailyTrends(userId: string, days: number = 30) {
    const endDate = dayjs().toDate();
    const startDate = dayjs().subtract(days, 'day').toDate();

    // Short cache for daily trends
    const cacheKey = `daily_trends_${days}d`;
    const cached = await analyticsQueries.getCachedAnalytics(userId, cacheKey);
    if (cached) return cached;

    const data = await analyticsQueries.getDailyTrends(userId, startDate, endDate);

    const expiresAt = dayjs().add(30, 'minute').toDate();
    await analyticsQueries.setCachedAnalytics(userId, cacheKey, data, undefined, undefined, expiresAt);

    return data;
  }

  /**
   * Invalidate analytics cache for a user
   */
  static async invalidateCache(userId: string, pattern?: string) {
    await analyticsQueries.invalidateCachedAnalytics(userId, pattern);
  }
}
