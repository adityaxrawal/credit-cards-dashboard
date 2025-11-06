// TODO: Fix AlertService import
// import { enhancedAlertService } from "../alerts/alerts.service";
import { supabase } from "shared/database/supabase";
import { EnhancedAlertService } from "../alerts/alerts.service";

/**
 * Bill information interface
 */
export interface BillInfo {
  id: string;
  userId: string;
  cardId: string;
  cardName: string;
  billDate: Date;
  dueDate: Date;
  minimumAmount: number;
  totalAmount: number;
  statementPeriodStart: Date;
  statementPeriodEnd: Date;
  status: "pending" | "paid" | "overdue";
  paymentDate?: Date;
  paidAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bill reminder settings
 */
export interface BillReminderSettings {
  userId: string;
  enableReminders: boolean;
  reminderDays: number[]; // Days before due date to send reminders
  enableAutoPayReminders: boolean;
  preferredTime: string; // HH:MM format
  channels: ("email" | "sms" | "push" | "in_app")[];
}

/**
 * Payment tracking
 */
export interface PaymentRecord {
  id: string;
  userId: string;
  cardId: string;
  billId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: "auto_pay" | "manual" | "bank_transfer" | "other";
  status: "success" | "failed" | "pending";
  transactionId?: string;
  notes?: string;
}

/**
 * Bill Reminder Service - Handles credit card bill date calculation and reminders
 */
export class BillReminderService {
  /**
   * Calculate next bill date based on card billing cycle
   */
  static calculateNextBillDate(
    cardId: string,
    billingCycleDay: number,
    lastBillDate?: Date
  ): Date {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // If no last bill date provided, calculate from billing cycle day
    if (!lastBillDate) {
      const nextBillDate = new Date(currentYear, currentMonth, billingCycleDay);

      // If billing day has passed this month, move to next month
      if (nextBillDate <= today) {
        nextBillDate.setMonth(currentMonth + 1);
      }

      return nextBillDate;
    }

    // Calculate next bill date from last bill date
    const nextBillDate = new Date(lastBillDate);
    nextBillDate.setMonth(nextBillDate.getMonth() + 1);

    // Handle month-end edge cases (e.g., Jan 31 -> Feb 28)
    if (nextBillDate.getDate() !== billingCycleDay) {
      nextBillDate.setDate(0); // Go to last day of previous month
      nextBillDate.setDate(Math.min(billingCycleDay, nextBillDate.getDate()));
    }

    return nextBillDate;
  }

  /**
   * Calculate due date from bill date (typically 20-25 days after bill date)
   */
  static calculateDueDate(billDate: Date, paymentDueDays: number = 20): Date {
    const dueDate = new Date(billDate);
    dueDate.setDate(dueDate.getDate() + paymentDueDays);
    return dueDate;
  }

  /**
   * Get statement period for a bill date
   */
  static calculateStatementPeriod(billDate: Date): {
    start: Date;
    end: Date;
  } {
    // Statement period is typically from previous bill date to current bill date - 1
    const end = new Date(billDate);
    end.setDate(end.getDate() - 1);

    const start = new Date(billDate);
    start.setMonth(start.getMonth() - 1);

    return { start, end };
  }

  /**
   * Generate bills for all active cards
   */
  static async generateBillsForAllCards(): Promise<{
    generated: number;
    updated: number;
    errors: string[];
  }> {
    try {
      const { data: activeCards } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("is_active", true);

      if (!activeCards) {
        return { generated: 0, updated: 0, errors: ["No active cards found"] };
      }

      let generated = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const card of activeCards) {
        try {
          const result = await this.generateBillForCard(card.id);
          if (result.generated) generated++;
          if (result.updated) updated++;
        } catch (error) {
          errors.push(
            `Card ${card.id}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      return { generated, updated, errors };
    } catch (error) {
      throw new Error(
        `Failed to generate bills: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Generate bill for a specific card
   */
  static async generateBillForCard(cardId: string): Promise<{
    generated: boolean;
    updated: boolean;
    bill?: BillInfo;
  }> {
    try {
      // Get card information
      const { data: card } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("id", cardId)
        .single();

      if (!card) {
        throw new Error("Card not found");
      }

      const billingCycleDay = card.billing_cycle_day || 1;
      const paymentDueDays = card.payment_due_days || 20;

      // Check for existing unpaid bill
      const { data: existingBill } = await supabase
        .from("bills")
        .select("*")
        .eq("card_id", cardId)
        .eq("status", "pending")
        .order("bill_date", { ascending: false })
        .limit(1)
        .single();

      const today = new Date();
      const nextBillDate = this.calculateNextBillDate(
        cardId,
        billingCycleDay,
        existingBill?.bill_date ? new Date(existingBill.bill_date) : undefined
      );

      // Only generate bill if it's time (within 3 days of bill date)
      const daysUntilBill = Math.ceil(
        (nextBillDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilBill > 3) {
        return { generated: false, updated: false };
      }

      // Calculate statement period
      const statementPeriod = this.calculateStatementPeriod(nextBillDate);

      // Calculate total spending in statement period
      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount")
        .eq("card_id", cardId)
        .eq("transaction_type", "debit")
        .gte("transaction_date", statementPeriod.start.toISOString())
        .lte("transaction_date", statementPeriod.end.toISOString());

      const totalAmount = (transactions || []).reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );

      // Minimum payment is typically 5% of total or minimum ₹200
      const minimumAmount = Math.max(totalAmount * 0.05, 200);
      const dueDate = this.calculateDueDate(nextBillDate, paymentDueDays);

      // Create new bill
      const newBill: Partial<BillInfo> = {
        userId: card.user_id,
        cardId: card.id,
        billDate: nextBillDate,
        dueDate,
        minimumAmount: Math.round(minimumAmount),
        totalAmount: Math.round(totalAmount),
        statementPeriodStart: statementPeriod.start,
        statementPeriodEnd: statementPeriod.end,
        status: "pending",
      };

      const { data: createdBill, error } = await supabase
        .from("bills")
        .insert(newBill)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create bill: ${error.message}`);
      }

      // Generate automatic reminders
      await this.scheduleReminders(createdBill.id);

      return {
        generated: true,
        updated: false,
        bill: createdBill as BillInfo,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get bills for a user
   */
  static async getBillsDetailed(
    userId: string,
    options: {
      status?: "pending" | "paid" | "overdue" | "all";
      cardId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    bills: BillInfo[];
    total: number;
  }> {
    try {
      let query = supabase
        .from("bills")
        .select("*, credit_cards(card_name)")
        .eq("user_id", userId);

      if (options.status && options.status !== "all") {
        query = query.eq("status", options.status);
      }

      if (options.cardId) {
        query = query.eq("card_id", options.cardId);
      }

      query = query
        .order("bill_date", { ascending: false })
        .range(
          options.offset || 0,
          (options.offset || 0) + (options.limit || 50) - 1
        );

      const { data: bills, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch bills: ${error.message}`);
      }

      const formattedBills = (bills || []).map((bill: any) => ({
        ...bill,
        cardName: bill.credit_cards?.card_name || "Unknown Card",
        billDate: new Date(bill.bill_date),
        dueDate: new Date(bill.due_date),
        statementPeriodStart: new Date(bill.statement_period_start),
        statementPeriodEnd: new Date(bill.statement_period_end),
        createdAt: new Date(bill.created_at),
        updatedAt: new Date(bill.updated_at),
      }));

      return {
        bills: formattedBills,
        total: count || formattedBills.length,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark bill as paid
   */
  static async markBillAsPaid(
    billId: string,
    userId: string,
    paymentDetails: {
      amount: number;
      paymentMethod: PaymentRecord["paymentMethod"];
      paymentDate?: Date;
      transactionId?: string;
      notes?: string;
    }
  ): Promise<{
    bill: BillInfo;
    payment: PaymentRecord;
  }> {
    try {
      // Get bill details
      const { data: bill } = await supabase
        .from("bills")
        .select("*")
        .eq("id", billId)
        .eq("user_id", userId)
        .single();

      if (!bill) {
        throw new Error("Bill not found");
      }

      const paymentDate = paymentDetails.paymentDate || new Date();

      // Create payment record
      const paymentRecord: Partial<PaymentRecord> = {
        userId,
        cardId: bill.card_id,
        billId: bill.id,
        amount: paymentDetails.amount,
        paymentDate,
        paymentMethod: paymentDetails.paymentMethod,
        status: "success",
        transactionId: paymentDetails.transactionId,
        notes: paymentDetails.notes,
      };

      const { data: createdPayment } = await supabase
        .from("payments")
        .insert(paymentRecord)
        .select()
        .single();

      // Update bill status
      const { data: updatedBill } = await supabase
        .from("bills")
        .update({
          status: "paid",
          payment_date: paymentDate.toISOString(),
          paid_amount: paymentDetails.amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", billId)
        .select()
        .single();

      // Generate payment confirmation alert
      await EnhancedAlertService.createAlert({
        userId,
        type: "bill_reminder",
        title: "Payment Confirmation",
        message: `Payment of ₹${paymentDetails.amount.toLocaleString()} for bill ${billId} has been recorded.`,
        priority: "medium",
        metadata: {
          billId,
          amount: paymentDetails.amount,
          paymentMethod: paymentDetails.paymentMethod,
        },
      });

      return {
        bill: updatedBill as BillInfo,
        payment: createdPayment as PaymentRecord,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check for overdue bills and update status
   */
  static async checkOverdueBills(): Promise<{
    updated: number;
    notified: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find pending bills past due date
      const { data: overdueBills } = await supabase
        .from("bills")
        .select("*")
        .eq("status", "pending")
        .lt("due_date", today.toISOString());

      if (!overdueBills || overdueBills.length === 0) {
        return { updated: 0, notified: 0 };
      }

      let updated = 0;
      let notified = 0;

      for (const bill of overdueBills) {
        // Update bill status to overdue
        await supabase
          .from("bills")
          .update({
            status: "overdue",
            updated_at: new Date().toISOString(),
          })
          .eq("id", bill.id);

        updated++;

        // Send overdue notification
        try {
          await EnhancedAlertService.createAlert({
            userId: bill.user_id,
            type: "bill_reminder",
            title: "Overdue Bill Alert",
            message: `Your credit card bill of ₹${bill.total_amount.toLocaleString()} is overdue. Please make payment immediately to avoid late fees.`,
            priority: "high",
            metadata: {
              billId: bill.id,
              cardId: bill.card_id,
              dueDate: bill.due_date,
              amount: bill.total_amount,
            },
          });
          notified++;
        } catch (error) {
          console.error(
            `Failed to send overdue notification for bill ${bill.id}:`,
            error
          );
        }
      }

      return { updated, notified };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get bill reminder settings for a user
   */
  static async getReminderSettings(
    userId: string
  ): Promise<BillReminderSettings> {
    try {
      const { data: settings } = await supabase
        .from("bill_reminder_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!settings) {
        // Return default settings
        return {
          userId,
          enableReminders: true,
          reminderDays: [7, 3, 1], // 7, 3, 1 days before due date
          enableAutoPayReminders: false,
          preferredTime: "09:00",
          channels: ["email", "in_app"],
        };
      }

      return {
        userId: settings.user_id,
        enableReminders: settings.enable_reminders,
        reminderDays: settings.reminder_days || [7, 3, 1],
        enableAutoPayReminders: settings.enable_autopay_reminders,
        preferredTime: settings.preferred_time || "09:00",
        channels: settings.channels || ["email", "in_app"],
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update bill reminder settings
   */
  static async updateReminderSettings(
    userId: string,
    settings: Partial<BillReminderSettings>
  ): Promise<BillReminderSettings> {
    try {
      const updatedSettings = {
        user_id: userId,
        enable_reminders: settings.enableReminders,
        reminder_days: settings.reminderDays,
        enable_autopay_reminders: settings.enableAutoPayReminders,
        preferred_time: settings.preferredTime,
        channels: settings.channels,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("bill_reminder_settings")
        .upsert(updatedSettings, { onConflict: "user_id" })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update settings: ${error.message}`);
      }

      return {
        userId: data.user_id,
        enableReminders: data.enable_reminders,
        reminderDays: data.reminder_days,
        enableAutoPayReminders: data.enable_autopay_reminders,
        preferredTime: data.preferred_time,
        channels: data.channels,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Schedule reminders for a bill
   */
  static async scheduleReminders(billId: string): Promise<void> {
    try {
      const { data: bill } = await supabase
        .from("bills")
        .select("*, credit_cards(card_name)")
        .eq("id", billId)
        .single();

      if (!bill) {
        throw new Error("Bill not found");
      }

      const settings = await this.getReminderSettings(bill.user_id);

      if (!settings.enableReminders) {
        return;
      }

      const dueDate = new Date(bill.due_date);
      const cardName = bill.credit_cards?.card_name || "Your credit card";

      // Schedule reminders for each configured day
      for (const daysBefore of settings.reminderDays) {
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - daysBefore);

        // Only schedule future reminders
        if (reminderDate > new Date()) {
          await EnhancedAlertService.createAlert({
            userId: bill.user_id,
            type: "bill_reminder",
            title: `Bill Due in ${daysBefore} Day${daysBefore > 1 ? "s" : ""}`,
            message: `Your ${cardName} bill of ₹${bill.total_amount.toLocaleString()} is due on ${dueDate.toLocaleDateString(
              "en-IN"
            )}. Minimum payment: ₹${bill.minimum_amount.toLocaleString()}.`,
            priority: daysBefore <= 1 ? "high" : "medium",
            metadata: {
              billId: bill.id,
              cardId: bill.card_id,
              dueDate: bill.due_date,
              totalAmount: bill.total_amount,
              minimumAmount: bill.minimum_amount,
              daysBefore,
              scheduledFor: reminderDate.toISOString(),
              channels: settings.channels,
            },
          });
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get upcoming bills (next 30 days)
   */
  static async getUpcomingBills(userId: string): Promise<BillInfo[]> {
    try {
      const today = new Date();
      const next30Days = new Date();
      next30Days.setDate(today.getDate() + 30);

      const { data: bills } = await supabase
        .from("bills")
        .select("*, credit_cards(card_name)")
        .eq("user_id", userId)
        .eq("status", "pending")
        .gte("due_date", today.toISOString())
        .lte("due_date", next30Days.toISOString())
        .order("due_date");

      return (bills || []).map((bill: any) => ({
        ...bill,
        cardName: bill.credit_cards?.card_name || "Unknown Card",
        billDate: new Date(bill.bill_date),
        dueDate: new Date(bill.due_date),
        statementPeriodStart: new Date(bill.statement_period_start),
        statementPeriodEnd: new Date(bill.statement_period_end),
        createdAt: new Date(bill.created_at),
        updatedAt: new Date(bill.updated_at),
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment history for a user
   */
  static async getPaymentHistory(
    userId: string,
    options: {
      cardId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    payments: PaymentRecord[];
    total: number;
  }> {
    try {
      let query = supabase
        .from("payments")
        .select("*, bills(total_amount), credit_cards(card_name)", {
          count: "exact",
        })
        .eq("user_id", userId);

      if (options.cardId) {
        query = query.eq("card_id", options.cardId);
      }

      query = query
        .order("payment_date", { ascending: false })
        .range(
          options.offset || 0,
          (options.offset || 0) + (options.limit || 50) - 1
        );

      const { data: payments, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch payment history: ${error.message}`);
      }

      const formattedPayments = (payments || []).map((payment: any) => ({
        ...payment,
        paymentDate: new Date(payment.payment_date),
      }));

      return {
        payments: formattedPayments,
        total: count || 0,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a bill reminder
   */
  static async createBillReminder(
    userId: string,
    reminderData: {
      cardId?: string;
      title: string;
      description?: string;
      amount?: number;
      dueDate: Date;
      reminderDate: Date;
      isRecurring?: boolean;
      recurrencePattern?: "monthly" | "biweekly" | "quarterly" | "annually";
      recurrenceDay?: number;
    }
  ) {
    const { data, error } = await supabase
      .from("bill_reminders")
      .insert({
        user_id: userId,
        card_id: reminderData.cardId,
        title: reminderData.title,
        description: reminderData.description,
        amount: reminderData.amount,
        due_date: reminderData.dueDate.toISOString(),
        reminder_date: reminderData.reminderDate.toISOString(),
        is_recurring: reminderData.isRecurring || false,
        recurrence_pattern: reminderData.recurrencePattern,
        recurrence_day: reminderData.recurrenceDay,
        status: "pending",
      })
      .select()
      .single();

    if (error)
      throw new Error(`Failed to create bill reminder: ${error.message}`);
    return data;
  }

  /**
   * Get bill reminders for a user
   */
  static async getBillReminders(
    userId: string,
    filters?: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      isRecurring?: boolean;
    }
  ) {
    let query = supabase
      .from("bill_reminders")
      .select("*, credit_cards(card_name)")
      .eq("user_id", userId);

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.startDate) {
      query = query.gte("due_date", filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte("due_date", filters.endDate.toISOString());
    }
    if (filters?.isRecurring !== undefined) {
      query = query.eq("is_recurring", filters.isRecurring);
    }

    const { data, error } = await query.order("due_date", { ascending: true });

    if (error)
      throw new Error(`Failed to fetch bill reminders: ${error.message}`);
    return data || [];
  }

  /**
   * Send bill reminders for upcoming due dates
   */
  static async sendUpcomingReminders() {
    // Get reminders that need to be sent today
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: reminders, error } = await supabase
      .from("bill_reminders")
      .select("*, users(email)")
      .eq("status", "pending")
      .gte("reminder_date", today.toISOString())
      .lt("reminder_date", tomorrow.toISOString())
      .is("last_sent_at", null);

    if (error) {
      console.error("Error fetching reminders:", error);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const reminder of reminders || []) {
      try {
        // Create alert
        await EnhancedAlertService.createAlert({
          userId: reminder.user_id,
          type: "bill_reminder",
          priority: "high",
          title: `Bill Reminder: ${reminder.title}`,
          message: `Your bill of ${
            reminder.amount ? `$${reminder.amount}` : "unknown amount"
          } is due on ${new Date(reminder.due_date).toLocaleDateString()}`,
          metadata: {
            billId: reminder.id,
            amount: reminder.amount,
            dueDate: reminder.due_date,
          },
        });

        // Update last_sent_at
        await supabase
          .from("bill_reminders")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", reminder.id);

        sent++;
      } catch (err) {
        console.error(`Failed to send reminder ${reminder.id}:`, err);
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * CRUD Wrapper Methods for API Controller
   */
  static async createBill(data: any): Promise<any> {
    return await this.createBillReminder(data.userId, data);
  }

  static async getBillById(id: string): Promise<any> {
    const { data } = await supabase
      .from('bill_reminders')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }

  static async getBills(userId: string): Promise<any> {
    return await this.getBillReminders(userId);
  }

  static async updateBill(id: string, data: any): Promise<any> {
    const { data: updated } = await supabase.from("bill_reminders").update(data).eq("id", id).select().single();
    return updated;
  }

  static async deleteBill(id: string): Promise<void> {
    await supabase.from("bill_reminders").delete().eq("id", id);
  }

}


// Export singleton instance
export const billReminderService = new BillReminderService();
