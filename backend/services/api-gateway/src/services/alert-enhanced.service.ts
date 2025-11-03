import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Enhanced Alert Service with event-driven architecture and multi-channel support
 */

export interface AlertTemplate {
  id: string;
  alert_type: string;
  priority: string;
  title_template: string;
  message_template: string;
  action_label?: string;
  action_url_template?: string;
  default_channels: string[];
}

export interface AlertRule {
  id: string;
  user_id: string;
  rule_name: string;
  rule_type: string;
  condition: any;
  alert_priority: string;
  alert_channels: string[];
  is_active: boolean;
}

export interface AlertDeliveryLog {
  id: string;
  alert_id: string;
  user_id: string;
  channel: string;
  delivery_status: string;
  sent_at?: string;
  error_message?: string;
}

export class EnhancedAlertService {
  /**
   * Create alert from template with variable substitution
   */
  static async createAlertFromTemplate(
    userId: string,
    alertType: string,
    priority: string,
    variables: Record<string, any>
  ): Promise<any> {
    // Get template
    const { data: template, error: templateError } = await supabase
      .from("alert_templates")
      .select("*")
      .eq("alert_type", alertType)
      .eq("priority", priority)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      throw new Error(`Alert template not found: ${alertType} (${priority})`);
    }

    // Substitute variables in title and message
    const title = this.substituteVariables(template.title_template, variables);
    const message = this.substituteVariables(
      template.message_template,
      variables
    );
    const actionUrl = template.action_url_template
      ? this.substituteVariables(template.action_url_template, variables)
      : null;

    // Create alert
    const { data: alert, error: alertError } = await supabase
      .from("alerts")
      .insert({
        user_id: userId,
        alert_type: alertType,
        priority: priority,
        title: title,
        message: message,
        action_url: actionUrl,
        action_label: template.action_label,
        metadata: variables,
      })
      .select()
      .single();

    if (alertError) throw alertError;

    return alert;
  }

  /**
   * Get notification preferences for user
   */
  static async getNotificationPreferences(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code === "PGRST116") {
      // Create default preferences
      const { data: newPrefs, error: createError } = await supabase
        .from("user_notification_preferences")
        .insert({
          user_id: userId,
          enabled: true,
          channels: ["in_app", "email"],
          frequency: "immediate",
          quiet_hours_enabled: false,
          alert_types: {},
        })
        .select()
        .single();

      if (createError) throw createError;
      return newPrefs;
    }

    if (error) throw error;
    return data;
  }

  /**
   * Update notification preferences
   */
  static async updateNotificationPreferences(
    userId: string,
    preferences: any
  ): Promise<any> {
    const { data, error } = await supabase
      .from("user_notification_preferences")
      .update({
        ...preferences,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create custom alert rule
   */
  static async createAlertRule(
    userId: string,
    ruleName: string,
    ruleType: string,
    condition: any,
    alertPriority: string = "medium",
    alertChannels: string[] = ["in_app", "email"]
  ): Promise<AlertRule> {
    const { data, error } = await supabase
      .from("alert_rules")
      .insert({
        user_id: userId,
        rule_name: ruleName,
        rule_type: ruleType,
        condition: condition,
        alert_priority: alertPriority,
        alert_channels: alertChannels,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get all alert rules for user
   */
  static async getAlertRules(
    userId: string,
    activeOnly: boolean = true
  ): Promise<AlertRule[]> {
    let query = supabase
      .from("alert_rules")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Update alert rule
   */
  static async updateAlertRule(
    ruleId: string,
    userId: string,
    updates: Partial<AlertRule>
  ): Promise<AlertRule> {
    const { data, error } = await supabase
      .from("alert_rules")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ruleId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete alert rule
   */
  static async deleteAlertRule(ruleId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("alert_rules")
      .delete()
      .eq("id", ruleId)
      .eq("user_id", userId);

    if (error) throw error;
  }

  /**
   * Get alert delivery status
   */
  static async getAlertDeliveryStatus(
    alertId: string
  ): Promise<AlertDeliveryLog[]> {
    const { data, error } = await supabase
      .from("alert_delivery_log")
      .select("*")
      .eq("alert_id", alertId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get delivery statistics for user
   */
  static async getDeliveryStatistics(userId: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    byChannel: Record<string, any>;
  }> {
    const { data, error } = await supabase
      .from("alert_delivery_log")
      .select("*")
      .eq("user_id", userId)
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      );

    if (error) throw error;

    const logs = data || [];
    const byChannel: Record<string, any> = {};

    logs.forEach((log) => {
      if (!byChannel[log.channel]) {
        byChannel[log.channel] = { total: 0, sent: 0, failed: 0, pending: 0 };
      }
      byChannel[log.channel].total++;
      byChannel[log.channel][log.delivery_status]++;
    });

    return {
      total: logs.length,
      sent: logs.filter((l) => l.delivery_status === "sent").length,
      failed: logs.filter((l) => l.delivery_status === "failed").length,
      pending: logs.filter((l) => l.delivery_status === "pending").length,
      byChannel,
    };
  }

  /**
   * Record alert interaction
   */
  static async recordInteraction(
    alertId: string,
    userId: string,
    interactionType: string,
    details?: any
  ): Promise<void> {
    const { error } = await supabase.from("alert_interactions").insert({
      alert_id: alertId,
      user_id: userId,
      interaction_type: interactionType,
      interaction_details: details || {},
    });

    if (error) console.error("Error recording interaction:", error);

    // Update alert if dismissed
    if (interactionType === "dismissed") {
      await supabase
        .from("alerts")
        .update({
          dismissed: true,
          dismissed_at: new Date().toISOString(),
        })
        .eq("id", alertId);
    }
  }

  /**
   * Get alert analytics
   */
  static async getAlertAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalAlerts: number;
    readRate: number;
    dismissRate: number;
    clickThroughRate: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    trends: any[];
  }> {
    // Get alerts in date range
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    if (alertsError) throw alertsError;

    const allAlerts = alerts || [];

    // Get interactions
    const alertIds = allAlerts.map((a) => a.id);
    const { data: interactions, error: interactionsError } = await supabase
      .from("alert_interactions")
      .select("*")
      .in("alert_id", alertIds);

    if (interactionsError) throw interactionsError;

    const allInteractions = interactions || [];

    // Calculate metrics
    const totalAlerts = allAlerts.length;
    const readCount = allAlerts.filter((a) => a.is_read).length;
    const dismissedCount = allAlerts.filter((a) => a.dismissed).length;
    const clickedCount = allInteractions.filter(
      (i) => i.interaction_type === "clicked"
    ).length;

    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    allAlerts.forEach((alert) => {
      byType[alert.alert_type] = (byType[alert.alert_type] || 0) + 1;
      byPriority[alert.priority] = (byPriority[alert.priority] || 0) + 1;
    });

    // Calculate daily trends
    const trends = this.calculateDailyTrends(allAlerts, startDate, endDate);

    return {
      totalAlerts,
      readRate: totalAlerts > 0 ? (readCount / totalAlerts) * 100 : 0,
      dismissRate: totalAlerts > 0 ? (dismissedCount / totalAlerts) * 100 : 0,
      clickThroughRate:
        totalAlerts > 0 ? (clickedCount / totalAlerts) * 100 : 0,
      byType,
      byPriority,
      trends,
    };
  }

  /**
   * Generate daily or weekly digest
   */
  static async generateDigest(
    userId: string,
    digestType: "daily" | "weekly"
  ): Promise<any> {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (digestType === "daily") {
      periodStart = new Date(now);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(now);
      periodEnd.setHours(23, 59, 59, 999);
    } else {
      // weekly
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 7);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(now);
      periodEnd.setHours(23, 59, 59, 999);
    }

    // Get unread alerts in period
    const { data: alerts, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_read", false)
      .gte("created_at", periodStart.toISOString())
      .lte("created_at", periodEnd.toISOString())
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const digestAlerts = alerts || [];

    if (digestAlerts.length === 0) {
      return null; // No digest to send
    }

    // Create digest record
    const { data: digest, error: digestError } = await supabase
      .from("alert_digests")
      .insert({
        user_id: userId,
        digest_type: digestType,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        alert_count: digestAlerts.length,
        alert_ids: digestAlerts.map((a) => a.id),
        delivery_status: "pending",
      })
      .select()
      .single();

    if (digestError) throw digestError;

    // Group alerts by type and priority
    const groupedAlerts = {
      high: [] as any[],
      medium: [] as any[],
      low: [] as any[],
    };

    digestAlerts.forEach((alert) => {
      const priority = alert.priority as keyof typeof groupedAlerts;
      groupedAlerts[priority].push(alert);
    });

    return {
      digest,
      alerts: groupedAlerts,
      summary: {
        total: digestAlerts.length,
        high: groupedAlerts.high.length,
        medium: groupedAlerts.medium.length,
        low: groupedAlerts.low.length,
      },
    };
  }

  /**
   * Mark digest as sent
   */
  static async markDigestAsSent(digestId: string): Promise<void> {
    const { error } = await supabase
      .from("alert_digests")
      .update({
        sent_at: new Date().toISOString(),
        delivery_status: "sent",
      })
      .eq("id", digestId);

    if (error) console.error("Error marking digest as sent:", error);
  }

  /**
   * Batch send notifications (for scheduled jobs)
   */
  static async batchSendNotifications(): Promise<{
    sent: number;
    failed: number;
  }> {
    // Get pending delivery logs
    const { data: pending, error } = await supabase
      .from("alert_delivery_log")
      .select(
        `
        *,
        alerts!inner(*)
      `
      )
      .eq("delivery_status", "pending")
      .limit(100);

    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const log of pending || []) {
      try {
        // Send notification based on channel
        await this.sendNotificationViaChannel(
          log.channel,
          log.user_id,
          log.alerts
        );

        // Update delivery log
        await supabase
          .from("alert_delivery_log")
          .update({
            delivery_status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", log.id);

        sent++;
      } catch (error) {
        // Update delivery log with error
        await supabase
          .from("alert_delivery_log")
          .update({
            delivery_status: "failed",
            failed_at: new Date().toISOString(),
            error_message:
              error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", log.id);

        failed++;
      }
    }

    return { sent, failed };
  }

  // Private helper methods

  private static substituteVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, "g"), String(value));
    });
    return result;
  }

  private static calculateDailyTrends(
    alerts: any[],
    startDate: Date,
    endDate: Date
  ): any[] {
    const trends = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const dayAlerts = alerts.filter((a) => {
        const alertDate = new Date(a.created_at);
        return alertDate >= dayStart && alertDate <= dayEnd;
      });

      trends.push({
        date: current.toISOString().split("T")[0],
        count: dayAlerts.length,
        high: dayAlerts.filter((a) => a.priority === "high").length,
        medium: dayAlerts.filter((a) => a.priority === "medium").length,
        low: dayAlerts.filter((a) => a.priority === "low").length,
      });

      current.setDate(current.getDate() + 1);
    }

    return trends;
  }

  private static async sendNotificationViaChannel(
    channel: string,
    userId: string,
    alert: any
  ): Promise<void> {
    // Placeholder implementations - would integrate with actual services
    switch (channel) {
      case "email":
        console.log(`Sending email notification to user ${userId}:`, alert);
        // await sendEmail(userId, alert);
        break;
      case "sms":
        console.log(`Sending SMS notification to user ${userId}:`, alert);
        // await sendSMS(userId, alert);
        break;
      case "push":
        console.log(`Sending push notification to user ${userId}:`, alert);
        // await sendPushNotification(userId, alert);
        break;
      case "in_app":
        // Already created in database
        break;
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }
}
