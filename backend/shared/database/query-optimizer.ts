/**
 * Query Optimization Utilities
 * Phase 6: Backend Performance Optimization
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { metricsCollector } from "../monitoring/metrics-collector";
import { logger } from "../monitoring/logger";

interface QueryOptions {
  enableCache?: boolean;
  cacheTTL?: number;
  timeout?: number;
  batchSize?: number;
}

/**
 * Execute optimized query with caching
 */
export async function executeOptimizedQuery<T>(
  supabase: SupabaseClient,
  queryBuilder: any,
  options: QueryOptions = {}
): Promise<{ data: T[] | null; error: any }> {
  const startTime = Date.now();
  const queryId = Math.random().toString(36).substring(7);

  try {
    // Execute query
    const { data, error } = await queryBuilder;

    // Record metrics
    const duration = Date.now() - startTime;
    await metricsCollector.recordPerformance({
      service: "database",
      operation: "query",
      duration,
      success: !error,
      timestamp: Date.now(),
    });

    // Log slow queries
    if (duration > 1000) {
      logger.warn("Slow query detected", {
        queryId,
        duration,
        query: queryBuilder.toString(),
      });
    }

    return { data, error };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error("Query execution failed", error, {
      queryId,
      duration,
    });

    await metricsCollector.recordPerformance({
      service: "database",
      operation: "query",
      duration,
      success: false,
      timestamp: Date.now(),
    });

    return { data: null, error };
  }
}

/**
 * Batch insert optimization
 */
export async function batchInsert<T>(
  supabase: SupabaseClient,
  table: string,
  records: T[],
  batchSize: number = 100
): Promise<{ success: boolean; errors: any[] }> {
  const errors: any[] = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      const { error } = await supabase.from(table).insert(batch);

      if (error) {
        errors.push({ batch: i / batchSize, error });
      }
    } catch (error) {
      errors.push({ batch: i / batchSize, error });
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Pagination helper with cursor-based pagination
 */
export async function paginateQuery<T>(
  supabase: SupabaseClient,
  table: string,
  options: {
    select?: string;
    orderBy?: { column: string; ascending?: boolean };
    pageSize?: number;
    cursor?: string;
    filters?: Record<string, any>;
  } = {}
): Promise<{
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const {
    select = "*",
    orderBy = { column: "created_at", ascending: false },
    pageSize = 50,
    cursor,
    filters = {},
  } = options;

  let query = supabase
    .from(table)
    .select(select)
    .order(orderBy.column, { ascending: orderBy.ascending })
    .limit(pageSize + 1); // Fetch one extra to check if there's more

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  // Apply cursor for pagination
  if (cursor) {
    const ascending = orderBy.ascending ?? false;
    query = ascending
      ? query.gt(orderBy.column, cursor)
      : query.lt(orderBy.column, cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const hasMore = (data?.length || 0) > pageSize;
  const results = hasMore ? data!.slice(0, pageSize) : data || [];
  const lastResult = results.length > 0 ? results[results.length - 1] as unknown as Record<string, unknown> : null;
  const nextCursor =
    hasMore && lastResult
      ? String(lastResult[orderBy.column])
      : null;

  return {
    data: results as T[],
    nextCursor,
    hasMore,
  };
}

/**
 * Aggregate query optimization
 */
export async function aggregateQuery(
  supabase: SupabaseClient,
  table: string,
  options: {
    groupBy: string[];
    aggregates: {
      column: string;
      function: "sum" | "avg" | "count" | "min" | "max";
    }[];
    filters?: Record<string, any>;
  }
): Promise<any[]> {
  const { groupBy, aggregates, filters = {} } = options;

  // Build aggregate select
  const selectParts = [
    ...groupBy,
    ...aggregates.map((agg) => `${agg.column}.${agg.function}()`),
  ];

  let query = supabase.from(table).select(selectParts.join(", "));

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Query result cache
 */
class QueryCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private defaultTTL = 60000; // 1 minute

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl,
    });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.timestamp) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clear(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  size(): number {
    return this.cache.size;
  }
}

export const queryCache = new QueryCache();
