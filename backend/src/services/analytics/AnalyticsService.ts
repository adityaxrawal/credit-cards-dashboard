import * as analyticsQueries from '../../db/queries/analytics.queries';
import * as transactionsQueries from '../../db/queries/transactions.queries';
import dayjs from 'dayjs';

/**
 * Get overview analytics
 */
export async function getOverview(userId: string) {
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
  const currentStats = await getMonthStats(userId, currentMonth, currentYear);
  
  // Previous month stats
  const prevStats = await getMonthStats(userId, prevMonth, prevYear);
  
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
  };
  
  // Cache for 1 hour
  const expiresAt = dayjs().add(1, 'hour').toDate();
  await analyticsQueries.setCachedAnalytics(userId, cacheKey, overview, undefined, undefined, expiresAt);
  
  return overview;
}

/**
 * Get month stats helper
 */
async function getMonthStats(userId: string, month: number, year: number) {
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
export async function getCategoryBreakdown(userId: string, month?: number, year?: number) {
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
 * Get spending trends
 */
export async function getTrends(userId: string, rangeMonths: number = 6) {
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
    
    const stats = await getMonthStats(userId, month, year);
    
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
 * Get top merchants
 */
export async function getTopMerchants(userId: string, month?: number, year?: number, limit: number = 10) {
  const targetMonth = month || dayjs().month() + 1;
  const targetYear = year || dayjs().year();
  
  const from = dayjs().year(targetYear).month(targetMonth - 1).startOf('month').toDate();
  const to = dayjs().year(targetYear).month(targetMonth - 1).endOf('month').toDate();
  
  const { data: transactions } = await transactionsQueries.listTransactions(userId, {
    from,
    to,
    transactionType: 'debit',
    limit: 1000, // Get enough to aggregate
  });
  
  // Group by merchant
  const merchantMap = new Map<string, { total: number; count: number }>();
  
  for (const tx of transactions) {
    const merchant = tx.merchant || 'Unknown';
    const existing = merchantMap.get(merchant) || { total: 0, count: 0 };
    existing.total += parseFloat(tx.amount.toString());
    existing.count += 1;
    merchantMap.set(merchant, existing);
  }
  
  // Convert to array and sort
  const merchants = Array.from(merchantMap.entries())
    .map(([merchant, data]) => ({
      merchant,
      totalSpent: data.total,
      transactionCount: data.count,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
  
  return {
    month: targetMonth,
    year: targetYear,
    merchants,
  };
}

/**
 * Invalidate analytics cache for a user
 */
export async function invalidateCache(userId: string, pattern?: string) {
  await analyticsQueries.invalidateCachedAnalytics(userId, pattern);
}
