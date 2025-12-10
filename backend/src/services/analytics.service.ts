import * as transactionsQueries from '../db/queries/transactions.queries';
import dayjs from 'dayjs';
import { CacheManager } from '../lib/redis';

/**
 * Get overview analytics
 */
export async function getOverview(userId: string) {
  const cacheKey = `analytics:overview:${userId}:${dayjs().format('YYYY-MM')}`;

  // Try to get from cache
  const cached = await CacheManager.get(cacheKey);
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

  // Cache for 1 hour (3600 seconds)
  await CacheManager.set(cacheKey, overview, 3600);

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

  const cacheKey = `analytics:categories:${userId}:${targetYear}-${targetMonth}`;

  // Try cache
  const cached = await CacheManager.get(cacheKey);
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
  await CacheManager.set(cacheKey, result, 3600);

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

    // We're not caching trends as a whole because it's a moving window, 
    // but the underlying month stats could be cached if we refactored getMonthStats to be public/cached.
    // For now, leaving as is per scope.
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
  console.log(`[Analytics] Invalidate request for ${userId} (TTL will handle cleanup)`);
  // If we really wanted to, we could use Redis pattern matching but it's expensive.
}
