import { supabase } from "../../../../shared/database/supabase";

/**
 * Alert types supported by the system
 */
export type AlertType =
  | "budget_threshold"
  | "budget_exceeded"
  | "bill_reminder"
  | "due_reminder"
  | "unusual_activity"
  | "system"
  | "insight";

/**
 * Alert priority levels
 */
export type AlertPriority = "low" | "medium" | "high";

/**
 * Notification channels
 */
export type NotificationChannel = "email" | "in_app" | "sms" | "push";

/**
 * Alert interface
 */
export interface Alert {
  id: string;
  user_id: string;
  alert_type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  metadata?: any;
  is_read: boolean;
  read_at?: string;
  sent_via_email: boolean;
  email_sent_at?: string;
  sent_via_sms: boolean;
  sms_sent_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Notification preferences interface
 */
export interface NotificationPreferences {
  enabled: boolean;
  channels: NotificationChannel[];
  frequency: "immediate" | "daily_digest" | "weekly_digest";
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  alertTypes: {
    [K in AlertType]: {
      enabled: boolean;
      channels: NotificationChannel[];
    };
  };
}

/**
 * Alert action interface
 */
export interface AlertAction {
  label: string;
  type: "link" | "button" | "dismiss";
  url?: string;
  action?: string;
}

/**
 * Alert Service - Handles all alert and notification operations
 */
export class AlertService {
  /**
   * Create a new alert
   */
  static async createAlert(alertData: {
    userId: string;
    type: AlertType;
    priority: AlertPriority;
    title: string;
    message: string;
    metadata?: any;
  }): Promise<Alert> {
    const { data, error } = await supabase
      .from("alerts")
      .insert({
        user_id: alertData.userId,
        alert_type: alertData.type,
        priority: alertData.priority,
        title: alertData.title,
        message: alertData.message,
        metadata: alertData.metadata || {},
        is_read: false,
        sent_via_email: false,
        sent_via_sms: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification based on user preferences
    await this.sendNotification(data);

    return data;
  }

  /**
   * Get alerts for a user with filtering
   */
  static async getAlerts(
    userId: string,
    options: {
      unreadOnly?: boolean;
      types?: AlertType[];
      priority?: AlertPriority;
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ alerts: Alert[]; total: number; summary: any }> {
    let query = supabase
      .from("alerts")
      .select("*", { count: "exact" })
      .eq("user_id", userId);

    // Apply filters
    if (options.unreadOnly) {
      query = query.eq("is_read", false);
    }

    if (options.types && options.types.length > 0) {
      query = query.in("alert_type", options.types);
    }

    if (options.priority) {
      query = query.eq("priority", options.priority);
    }

    if (options.startDate) {
      query = query.gte("created_at", options.startDate);
    }

    if (options.endDate) {
      query = query.lte("created_at", options.endDate);
    }

    // Pagination
    query = query.order("created_at", { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1
      );
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Get summary statistics
    const summary = await this.getAlertsSummary(userId);

    return {
      alerts: data || [],
      total: count || 0,
      summary,
    };
  }

  /**
   * Mark alert as read
   */
  static async markAsRead(alertId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("alerts")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .eq("user_id", userId);

    if (error) throw error;
  }

  /**
   * Mark multiple alerts as read
   */
  static async markMultipleAsRead(
    alertIds: string[],
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("alerts")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", alertIds)
      .eq("user_id", userId);

    if (error) throw error;
  }

  /**
   * Delete alert
   */
  static async deleteAlert(alertId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("alerts")
      .delete()
      .eq("id", alertId)
      .eq("user_id", userId);

    if (error) throw error;
  }

  /**
   * Get notification preferences for a user
   */
  static async getNotificationPreferences(
    userId: string
  ): Promise<NotificationPreferences> {
    // In a real application, this would be stored in a user_preferences table
    // For now, return default preferences
    return {
      enabled: true,
      channels: ["email", "in_app"],
      frequency: "immediate",
      quietHours: {
        enabled: false,
        start: "22:00",
        end: "08:00",
      },
      alertTypes: {
        budget_threshold: { enabled: true, channels: ["email", "in_app"] },
        budget_exceeded: {
          enabled: true,
          channels: ["email", "in_app", "sms"],
        },
        bill_reminder: { enabled: true, channels: ["email", "in_app"] },
        due_reminder: { enabled: true, channels: ["email", "in_app", "sms"] },
        unusual_activity: { enabled: true, channels: ["email", "in_app"] },
        system: { enabled: true, channels: ["in_app"] },
        insight: { enabled: true, channels: ["in_app"] },
      },
    };
  }

  /**
   * Update notification preferences
   */
  static async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    // In a real application, this would save to user_preferences table
    // For now, return the merged preferences
    const currentPreferences = await this.getNotificationPreferences(userId);

    return {
      ...currentPreferences,
      ...preferences,
      alertTypes: {
        ...currentPreferences.alertTypes,
        ...preferences.alertTypes,
      },
    };
  }

  /**
   * Test notification delivery
   */
  static async testNotification(
    userId: string,
    channel: NotificationChannel,
    testMessage: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      switch (channel) {
        case "email":
          await this.sendEmailNotification(userId, {
            subject: "Test Notification",
            message: testMessage,
            type: "system",
            priority: "low",
          });
          return { success: true, message: "Email sent successfully" };

        case "sms":
          await this.sendSMSNotification(userId, testMessage);
          return { success: true, message: "SMS sent successfully" };

        case "push":
          await this.sendPushNotification(userId, {
            title: "Test Notification",
            body: testMessage,
          });
          return {
            success: true,
            message: "Push notification sent successfully",
          };

        case "in_app":
          await this.createAlert({
            userId,
            type: "system",
            priority: "low",
            title: "Test Notification",
            message: testMessage,
          });
          return {
            success: true,
            message: "In-app alert created successfully",
          };

        default:
          return { success: false, message: "Unsupported channel" };
      }
    } catch (error) {
      console.error(`Test notification failed for ${channel}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Notification failed",
      };
    }
  }

  /**
   * Generate budget alerts based on current spending
   */
  static async generateBudgetAlerts(userId: string): Promise<void> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Get budget tracking record
    const { data: budgetRecord, error } = await supabase
      .from("budget_tracking")
      .select("*")
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year)
      .single();

    if (error || !budgetRecord) return;

    const percentage =
      (budgetRecord.total_spent / budgetRecord.budget_limit) * 100;
    const preferences = await this.getNotificationPreferences(userId);

    // Check for threshold alerts (70%, 90%)
    const thresholds = [
      {
        threshold: 70,
        type: "budget_threshold" as AlertType,
        priority: "medium" as AlertPriority,
      },
      {
        threshold: 90,
        type: "budget_threshold" as AlertType,
        priority: "high" as AlertPriority,
      },
    ];

    for (const { threshold, type, priority } of thresholds) {
      if (percentage >= threshold && percentage < 100) {
        // Check if alert already sent for this threshold
        const { data: existingAlert } = await supabase
          .from("alerts")
          .select("id")
          .eq("user_id", userId)
          .eq("alert_type", type)
          .gte("created_at", new Date(year, month - 1, 1).toISOString())
          .lte("created_at", new Date(year, month, 0, 23, 59, 59).toISOString())
          .eq("metadata->threshold", threshold)
          .single();

        if (!existingAlert) {
          await this.createAlert({
            userId,
            type,
            priority,
            title: `Budget Alert: ${threshold}% Reached`,
            message: `You have spent ₹${budgetRecord.total_spent.toLocaleString()} of your ₹${budgetRecord.budget_limit.toLocaleString()} monthly budget (${Math.round(percentage)}%)`,
            metadata: {
              threshold,
              spent: budgetRecord.total_spent,
              budget: budgetRecord.budget_limit,
              percentage: Math.round(percentage * 100) / 100,
            },
          });
        }
      }
    }

    // Check for budget exceeded alert
    if (percentage >= 100 && !budgetRecord.alert_sent) {
      await this.createAlert({
        userId,
        type: "budget_exceeded",
        priority: "high",
        title: "Budget Exceeded",
        message: `You have exceeded your monthly budget of ₹${budgetRecord.budget_limit.toLocaleString()}. Current spending: ₹${budgetRecord.total_spent.toLocaleString()}`,
        metadata: {
          spent: budgetRecord.total_spent,
          budget: budgetRecord.budget_limit,
          overage: budgetRecord.total_spent - budgetRecord.budget_limit,
        },
      });

      // Mark alert as sent
      await supabase
        .from("budget_tracking")
        .update({
          alert_sent: true,
          alert_sent_at: new Date().toISOString(),
        })
        .eq("id", budgetRecord.id);
    }
  }

  /**
   * Generate bill reminder alerts
   */
  static async generateBillReminders(): Promise<void> {
    const reminders = [
      { days: 7, priority: "medium" as AlertPriority },
      { days: 3, priority: "high" as AlertPriority },
      { days: 1, priority: "high" as AlertPriority },
    ];

    for (const reminder of reminders) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + reminder.days);
      const dayOfMonth = targetDate.getDate();

      // Find credit cards with bill dates matching the target
      const { data: cards, error } = await supabase
        .from("credit_cards")
        .select("id, user_id, card_name, bill_date, current_outstanding")
        .eq("bill_date", dayOfMonth)
        .eq("is_active", true);

      if (error || !cards) continue;

      for (const card of cards) {
        // Check if reminder already sent
        const { data: existingAlert } = await supabase
          .from("alerts")
          .select("id")
          .eq("user_id", card.user_id)
          .eq("alert_type", "bill_reminder")
          .gte(
            "created_at",
            new Date().toISOString().split("T")[0] + "T00:00:00"
          )
          .eq("metadata->cardId", card.id)
          .eq("metadata->days", reminder.days)
          .single();

        if (!existingAlert) {
          await this.createAlert({
            userId: card.user_id,
            type: "bill_reminder",
            priority: reminder.priority,
            title: `Bill Due in ${reminder.days} Day${reminder.days > 1 ? "s" : ""}`,
            message: `Your ${card.card_name} bill (₹${card.current_outstanding?.toLocaleString() || 0}) is due on ${dayOfMonth}${this.getOrdinalSuffix(dayOfMonth)} of this month`,
            metadata: {
              cardId: card.id,
              cardName: card.card_name,
              days: reminder.days,
              dueDate: dayOfMonth,
              outstanding: card.current_outstanding || 0,
            },
          });
        }
      }
    }
  }

  /**
   * Detect unusual spending patterns
   */
  static async detectUnusualActivity(userId: string): Promise<void> {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get recent transactions
    const { data: recentTransactions, error } = await supabase
      .from("transactions")
      .select("amount, transaction_date, merchant_name, merchant_category")
      .eq("user_id", userId)
      .eq("transaction_type", "debit")
      .gte("transaction_date", last30Days.toISOString())
      .order("transaction_date", { ascending: false });

    if (error || !recentTransactions || recentTransactions.length < 10) return;

    // Calculate statistics
    const amounts = recentTransactions.map((t: any) => Number(t.amount));
    const avgAmount =
      amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce(
        (acc: number, amount: number) => acc + Math.pow(amount - avgAmount, 2),
        0
      ) / amounts.length
    );

    // Detect outliers (transactions > 2 standard deviations from mean)
    const threshold = avgAmount + 2 * stdDev;
    const unusualTransactions = recentTransactions.filter(
      (t: any) =>
        Number(t.amount) > threshold && Number(t.amount) > avgAmount * 2
    );

    // Create alerts for unusual transactions from the last 24 hours
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentUnusual = unusualTransactions.filter(
      (t: any) => new Date(t.transaction_date) > last24Hours
    );

    for (const transaction of recentUnusual) {
      // Check if alert already exists
      const { data: existingAlert } = await supabase
        .from("alerts")
        .select("id")
        .eq("user_id", userId)
        .eq("alert_type", "unusual_activity")
        .eq("metadata->amount", Number(transaction.amount))
        .gte("created_at", last24Hours.toISOString())
        .single();

      if (!existingAlert) {
        const percentageAboveAvg =
          ((Number(transaction.amount) - avgAmount) / avgAmount) * 100;

        await this.createAlert({
          userId,
          type: "unusual_activity",
          priority: "medium",
          title: "Unusual Spending Detected",
          message: `Large transaction of ₹${Number(transaction.amount).toLocaleString()} at ${transaction.merchant_name} - ${Math.round(percentageAboveAvg)}% above your average spending`,
          metadata: {
            amount: Number(transaction.amount),
            merchant: transaction.merchant_name,
            category: transaction.merchant_category,
            avgAmount: Math.round(avgAmount),
            percentageAboveAvg: Math.round(percentageAboveAvg),
            transactionDate: transaction.transaction_date,
          },
        });
      }
    }
  }

  // Private helper methods

  private static async getAlertsSummary(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from("alerts")
      .select("alert_type, priority, is_read")
      .eq("user_id", userId);

    if (error) return {};

    const summary = {
      total: data.length,
      unread: data.filter((a: any) => !a.is_read).length,
      byType: {} as any,
      byPriority: { high: 0, medium: 0, low: 0 },
    };

    data.forEach((alert: any) => {
      // Count by type
      if (!summary.byType[alert.alert_type]) {
        summary.byType[alert.alert_type] = 0;
      }
      summary.byType[alert.alert_type]++;

      // Count by priority
      summary.byPriority[alert.priority as AlertPriority]++;
    });

    return summary;
  }

  private static async sendNotification(alert: Alert): Promise<void> {
    const preferences = await this.getNotificationPreferences(alert.user_id);

    if (!preferences.enabled) return;

    const alertTypePrefs = preferences.alertTypes[alert.alert_type];
    if (!alertTypePrefs?.enabled) return;

    // Check quiet hours
    if (
      preferences.quietHours.enabled &&
      this.isInQuietHours(preferences.quietHours)
    ) {
      // Schedule for later or skip based on frequency setting
      return;
    }

    // Send through configured channels
    const channels = alertTypePrefs.channels || preferences.channels;

    if (channels.includes("email")) {
      await this.sendEmailNotification(alert.user_id, {
        subject: alert.title,
        message: alert.message,
        type: alert.alert_type,
        priority: alert.priority,
      });

      // Update alert record
      await supabase
        .from("alerts")
        .update({
          sent_via_email: true,
          email_sent_at: new Date().toISOString(),
        })
        .eq("id", alert.id);
    }

    if (channels.includes("sms")) {
      await this.sendSMSNotification(alert.user_id, alert.message);

      // Update alert record
      await supabase
        .from("alerts")
        .update({
          sent_via_sms: true,
          sms_sent_at: new Date().toISOString(),
        })
        .eq("id", alert.id);
    }

    if (channels.includes("push")) {
      await this.sendPushNotification(alert.user_id, {
        title: alert.title,
        body: alert.message,
      });
    }
  }

  private static async sendEmailNotification(
    userId: string,
    emailData: {
      subject: string;
      message: string;
      type: AlertType;
      priority: AlertPriority;
    }
  ): Promise<void> {
    // Get user email
    const { data: user, error } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();

    if (error || !user?.email) {
      console.error("Failed to get user email:", error);
      return;
    }

    // In a real application, you would use an email service like SendGrid, Mailgun, etc.
    console.log(`Sending email to ${user.email}: ${emailData.subject}`);

    // Placeholder for actual email sending logic
    // await emailService.send({
    //   to: user.email,
    //   subject: emailData.subject,
    //   html: generateEmailTemplate(emailData),
    // });
  }

  private static async sendSMSNotification(
    userId: string,
    message: string
  ): Promise<void> {
    // Get user phone number
    const { data: user, error } = await supabase
      .from("users")
      .select("phone")
      .eq("id", userId)
      .single();

    if (error || !user?.phone) {
      console.error("Failed to get user phone:", error);
      return;
    }

    // In a real application, you would use Twilio, AWS SNS, etc.
    console.log(`Sending SMS to ${user.phone}: ${message}`);

    // Placeholder for actual SMS sending logic
    // await smsService.send({
    //   to: user.phone,
    //   body: message,
    // });
  }

  private static async sendPushNotification(
    userId: string,
    notification: { title: string; body: string }
  ): Promise<void> {
    // In a real application, you would use Firebase Cloud Messaging, Apple Push Notifications, etc.
    console.log(
      `Sending push notification to user ${userId}: ${notification.title}`
    );

    // Placeholder for actual push notification logic
    // await pushService.send({
    //   userId,
    //   title: notification.title,
    //   body: notification.body,
    // });
  }

  private static isInQuietHours(quietHours: {
    start: string;
    end: string;
  }): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = quietHours.start.split(":").map(Number);
    const [endHour, endMin] = quietHours.end.split(":").map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private static getOrdinalSuffix(day: number): string {
    const suffixes = ["th", "st", "nd", "rd"];
    const value = day % 100;
    return (
      day + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0])
    );
  }
}
