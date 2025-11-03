/**
 * Analytics Service - Usage and Performance Analytics
 * Phase 6: Post-Launch & Optimization
 */

import { createClient } from "@supabase/supabase-js";
import { metricsCollector } from "../../../shared/monitoring/metrics-collector";
import { logger } from "../../../shared/monitoring/logger";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  avgSessionDuration: number;
  uniqueUsers: number;
}

export interface APIMetrics {
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  errorRate: number;
  requestsByEndpoint: Record<string, number>;
}

export interface PerformanceMetrics {
  avgLoadTime: number;
  p95LoadTime: number;
  p99LoadTime: number;
  slowestEndpoints: Array<{ endpoint: string; avgTime: number }>;
}

export interface UsageAnalytics {
  period: string;
  sessions: SessionMetrics;
  api: APIMetrics;
  performance: PerformanceMetrics;
  timestamp: number;
}

export class AnalyticsService {
  /**
   * Track user session start
   */
  async trackSessionStart(
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await supabase.from("user_sessions").insert({
        user_id: userId,
        session_start: new Date().toISOString(),
        metadata: metadata || {},
      });

      await metricsCollector.incrementCounter("sessions_started", {
        userId,
      });

      logger.info("Session started", { userId });
    } catch (error: any) {
      logger.error("Failed to track session start", error, { userId });
    }
  }

  /**
   * Track user session end
   */
  async trackSessionEnd(userId: string, sessionId: string): Promise<void> {
    try {
      const { data: session } = await supabase
        .from("user_sessions")
        .select("session_start")
        .eq("id", sessionId)
        .single();

      if (session) {
        const duration = Date.now() - new Date(session.session_start).getTime();

        await supabase
          .from("user_sessions")
          .update({
            session_end: new Date().toISOString(),
            duration_ms: duration,
          })
          .eq("id", sessionId);

        await metricsCollector.recordMetric("session_duration", duration, {
          userId,
        });
      }

      logger.info("Session ended", { userId, sessionId });
    } catch (error: any) {
      logger.error("Failed to track session end", error, { userId, sessionId });
    }
  }

  /**
   * Track page view
   */
  async trackPageView(
    userId: string,
    page: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await supabase.from("page_views").insert({
        user_id: userId,
        page,
        timestamp: new Date().toISOString(),
        metadata: metadata || {},
      });

      await metricsCollector.incrementCounter("page_views", {
        userId,
        page,
      });
    } catch (error: any) {
      logger.error("Failed to track page view", error, { userId, page });
    }
  }

  /**
   * Track user action/event
   */
  async trackEvent(
    userId: string,
    eventName: string,
    eventData?: Record<string, any>
  ): Promise<void> {
    try {
      await supabase.from("user_events").insert({
        user_id: userId,
        event_name: eventName,
        event_data: eventData || {},
        timestamp: new Date().toISOString(),
      });

      await metricsCollector.incrementCounter("user_events", {
        userId,
        eventName,
      });

      logger.debug("Event tracked", { userId, eventName, eventData });
    } catch (error: any) {
      logger.error("Failed to track event", error, { userId, eventName });
    }
  }

  /**
   * Get session metrics for a period
   */
  async getSessionMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<SessionMetrics> {
    try {
      const { data: sessions } = await supabase
        .from("user_sessions")
        .select("*")
        .gte("session_start", startDate.toISOString())
        .lte("session_start", endDate.toISOString());

      if (!sessions || sessions.length === 0) {
        return {
          totalSessions: 0,
          activeSessions: 0,
          avgSessionDuration: 0,
          uniqueUsers: 0,
        };
      }

      const now = Date.now();
      const activeSessions = sessions.filter((s) => {
        return (
          !s.session_end ||
          now - new Date(s.session_end).getTime() < 30 * 60 * 1000
        );
      }).length;

      const completedSessions = sessions.filter((s) => s.duration_ms);
      const avgDuration =
        completedSessions.length > 0
          ? completedSessions.reduce((sum, s) => sum + s.duration_ms, 0) /
            completedSessions.length
          : 0;

      const uniqueUsers = new Set(sessions.map((s) => s.user_id)).size;

      return {
        totalSessions: sessions.length,
        activeSessions,
        avgSessionDuration: avgDuration,
        uniqueUsers,
      };
    } catch (error: any) {
      logger.error("Failed to get session metrics", error);
      throw error;
    }
  }

  /**
   * Get API metrics from Redis
   */
  async getAPIMetrics(): Promise<APIMetrics> {
    try {
      const summary = await metricsCollector.getMetricsSummary();

      // This would aggregate from Redis metrics
      return {
        totalRequests: 0, // TODO: Implement counter
        successRate: 0,
        avgResponseTime: summary?.api_usage?.avg || 0,
        errorRate: 0,
        requestsByEndpoint: {},
      };
    } catch (error: any) {
      logger.error("Failed to get API metrics", error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const summary = await metricsCollector.getMetricsSummary();

      return {
        avgLoadTime: summary?.performance?.avg || 0,
        p95LoadTime: summary?.performance?.p95 || 0,
        p99LoadTime: summary?.performance?.p99 || 0,
        slowestEndpoints: [],
      };
    } catch (error: any) {
      logger.error("Failed to get performance metrics", error);
      throw error;
    }
  }

  /**
   * Get comprehensive usage analytics
   */
  async getUsageAnalytics(
    period: "day" | "week" | "month" = "day"
  ): Promise<UsageAnalytics> {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "day":
        startDate.setDate(startDate.getDate() - 1);
        break;
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const [sessions, api, performance] = await Promise.all([
      this.getSessionMetrics(startDate, endDate),
      this.getAPIMetrics(),
      this.getPerformanceMetrics(),
    ]);

    return {
      period,
      sessions,
      api,
      performance,
      timestamp: Date.now(),
    };
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(
    userId: string,
    days: number = 30
  ): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [sessions, pageViews, events] = await Promise.all([
        supabase
          .from("user_sessions")
          .select("*")
          .eq("user_id", userId)
          .gte("session_start", startDate.toISOString()),
        supabase
          .from("page_views")
          .select("page")
          .eq("user_id", userId)
          .gte("timestamp", startDate.toISOString()),
        supabase
          .from("user_events")
          .select("event_name")
          .eq("user_id", userId)
          .gte("timestamp", startDate.toISOString()),
      ]);

      return {
        totalSessions: sessions.data?.length || 0,
        totalPageViews: pageViews.data?.length || 0,
        totalEvents: events.data?.length || 0,
        avgSessionDuration:
          sessions.data && sessions.data.length > 0
            ? sessions.data.reduce((sum, s) => sum + (s.duration_ms || 0), 0) /
              sessions.data.length
            : 0,
        topPages: this.getTopItems(pageViews.data?.map((p) => p.page) || []),
        topEvents: this.getTopItems(
          events.data?.map((e) => e.event_name) || []
        ),
      };
    } catch (error: any) {
      logger.error("Failed to get user engagement metrics", error, { userId });
      throw error;
    }
  }

  /**
   * Helper: Get top items by frequency
   */
  private getTopItems(items: string[]): Array<{ name: string; count: number }> {
    const counts = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

export const analyticsService = new AnalyticsService();
