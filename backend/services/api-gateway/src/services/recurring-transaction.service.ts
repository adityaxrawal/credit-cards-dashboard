import { createClient } from "@supabase/supabase-js";
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  startOfDay,
  isBefore,
  isAfter,
} from "date-fns";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Recurring transaction schedule
 */
export interface RecurringTransaction {
  id: string;
  user_id: string;
  card_id: string;
  merchant_name: string;
  amount: number;
  frequency:
    | "daily"
    | "weekly"
    | "biweekly"
    | "monthly"
    | "quarterly"
    | "annually";
  category?: string;
  description?: string;
  start_date: string;
  end_date?: string; // Null for indefinite
  next_execution: string;
  last_execution?: string;
  status: "active" | "paused" | "completed" | "cancelled";
  execution_count: number;
  max_executions?: number; // Null for indefinite
  timezone: string;
  notification_enabled: boolean;
  auto_execute: boolean; // If false, requires manual confirmation
  metadata?: {
    original_subscription_id?: string;
    created_from?: "manual" | "subscription" | "pattern";
    execution_time?: string; // Preferred time of day
    skip_weekends?: boolean;
    skip_holidays?: boolean;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Execution log for recurring transactions
 */
export interface RecurringTransactionExecution {
  id: string;
  recurring_transaction_id: string;
  transaction_id?: string;
  execution_date: string;
  scheduled_date: string;
  status: "pending" | "completed" | "failed" | "skipped";
  error_message?: string;
  amount_executed: number;
  created_at: string;
}

/**
 * Recurring Transaction Service - Manages automated recurring payments and subscriptions
 */
export class RecurringTransactionService {
  /**
   * Create a new recurring transaction
   */
  static async createRecurringTransaction(
    data: Omit<
      RecurringTransaction,
      | "id"
      | "created_at"
      | "updated_at"
      | "execution_count"
      | "last_execution"
      | "next_execution"
      | "status"
    >
  ): Promise<RecurringTransaction> {
    try {
      // Validate data
      this.validateRecurringTransaction(data);

      // Calculate next execution date
      const nextExecution = this.calculateNextExecution(
        new Date(data.start_date),
        data.frequency,
        data.metadata
      );

      const { data: recurring, error } = await supabase
        .from("recurring_transactions")
        .insert({
          ...data,
          next_execution: nextExecution.toISOString(),
          execution_count: 0,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`Created recurring transaction: ${recurring.id}`);
      return recurring;
    } catch (error) {
      console.error("Error creating recurring transaction:", error);
      throw error;
    }
  }

  /**
   * Update a recurring transaction
   */
  static async updateRecurringTransaction(
    id: string,
    userId: string,
    updates: Partial<RecurringTransaction>
  ): Promise<RecurringTransaction> {
    try {
      // If frequency or start_date changed, recalculate next execution
      if (updates.frequency || updates.start_date) {
        const { data: existing } = await supabase
          .from("recurring_transactions")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        if (existing) {
          const baseDate = updates.start_date
            ? new Date(updates.start_date)
            : new Date(existing.next_execution);
          const frequency = updates.frequency || existing.frequency;
          updates.next_execution = this.calculateNextExecution(
            baseDate,
            frequency,
            updates.metadata || existing.metadata
          ).toISOString();
        }
      }

      const { data: recurring, error } = await supabase
        .from("recurring_transactions")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      console.log(`Updated recurring transaction: ${id}`);
      return recurring;
    } catch (error) {
      console.error("Error updating recurring transaction:", error);
      throw error;
    }
  }

  /**
   * Pause a recurring transaction
   */
  static async pauseRecurringTransaction(
    id: string,
    userId: string
  ): Promise<void> {
    await this.updateRecurringTransaction(id, userId, { status: "paused" });
  }

  /**
   * Resume a recurring transaction
   */
  static async resumeRecurringTransaction(
    id: string,
    userId: string
  ): Promise<void> {
    await this.updateRecurringTransaction(id, userId, { status: "active" });
  }

  /**
   * Cancel a recurring transaction
   */
  static async cancelRecurringTransaction(
    id: string,
    userId: string
  ): Promise<void> {
    await this.updateRecurringTransaction(id, userId, { status: "cancelled" });
  }

  /**
   * Get user's recurring transactions
   */
  static async getUserRecurringTransactions(
    userId: string,
    status?: RecurringTransaction["status"]
  ): Promise<RecurringTransaction[]> {
    try {
      let query = supabase
        .from("recurring_transactions")
        .select("*, cards(card_name, bank_name)")
        .eq("user_id", userId);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query.order("next_execution", {
        ascending: true,
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching recurring transactions:", error);
      throw error;
    }
  }

  /**
   * Get a single recurring transaction
   */
  static async getRecurringTransaction(
    id: string,
    userId: string
  ): Promise<RecurringTransaction | null> {
    try {
      const { data, error } = await supabase
        .from("recurring_transactions")
        .select("*, cards(card_name, bank_name)")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching recurring transaction:", error);
      return null;
    }
  }

  /**
   * Get execution history for a recurring transaction
   */
  static async getExecutionHistory(
    recurringId: string,
    userId: string
  ): Promise<RecurringTransactionExecution[]> {
    try {
      // Verify ownership
      const recurring = await this.getRecurringTransaction(recurringId, userId);
      if (!recurring) throw new Error("Recurring transaction not found");

      const { data, error } = await supabase
        .from("recurring_transaction_executions")
        .select("*, transactions(*)")
        .eq("recurring_transaction_id", recurringId)
        .order("execution_date", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching execution history:", error);
      throw error;
    }
  }

  /**
   * Process due recurring transactions (called by background job)
   */
  static async processDueRecurringTransactions(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const now = new Date();
    const results = { processed: 0, succeeded: 0, failed: 0 };

    try {
      // Get all active recurring transactions that are due
      const { data: dueTransactions, error } = await supabase
        .from("recurring_transactions")
        .select("*")
        .eq("status", "active")
        .lte("next_execution", now.toISOString());

      if (error) throw error;
      if (!dueTransactions?.length) {
        console.log("No due recurring transactions found");
        return results;
      }

      console.log(`Found ${dueTransactions.length} due recurring transactions`);

      for (const recurring of dueTransactions) {
        results.processed++;

        try {
          // Check if already executed today (prevent duplicates)
          const isDuplicate = await this.checkForDuplicateExecution(
            recurring.id,
            now
          );
          if (isDuplicate) {
            console.log(
              `Skipping duplicate execution for recurring transaction: ${recurring.id}`
            );
            continue;
          }

          // Check if max executions reached
          if (
            recurring.max_executions &&
            recurring.execution_count >= recurring.max_executions
          ) {
            await this.updateRecurringTransaction(
              recurring.id,
              recurring.user_id,
              {
                status: "completed",
              }
            );
            console.log(
              `Recurring transaction completed (max executions reached): ${recurring.id}`
            );
            continue;
          }

          // Check if end date reached
          if (
            recurring.end_date &&
            isAfter(now, new Date(recurring.end_date))
          ) {
            await this.updateRecurringTransaction(
              recurring.id,
              recurring.user_id,
              {
                status: "completed",
              }
            );
            console.log(
              `Recurring transaction completed (end date reached): ${recurring.id}`
            );
            continue;
          }

          // Execute the transaction
          if (recurring.auto_execute) {
            await this.executeRecurringTransaction(recurring);
            results.succeeded++;
          } else {
            // Create pending execution record for manual confirmation
            await this.createPendingExecution(recurring);
            results.succeeded++;
          }
        } catch (error) {
          console.error(
            `Error processing recurring transaction ${recurring.id}:`,
            error
          );
          results.failed++;

          // Log failed execution
          await this.logFailedExecution(recurring.id, error);
        }
      }

      console.log(
        `Processed recurring transactions: ${JSON.stringify(results)}`
      );
      return results;
    } catch (error) {
      console.error("Error processing recurring transactions:", error);
      throw error;
    }
  }

  /**
   * Execute a recurring transaction (create actual transaction)
   */
  private static async executeRecurringTransaction(
    recurring: RecurringTransaction
  ): Promise<void> {
    try {
      const now = new Date();

      // Create the transaction
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: recurring.user_id,
          card_id: recurring.card_id,
          transaction_date: now.toISOString(),
          merchant_name: recurring.merchant_name,
          merchant_category: recurring.category,
          amount: recurring.amount,
          transaction_type: "debit",
          description:
            recurring.description || `Recurring: ${recurring.merchant_name}`,
          is_manually_added: false,
          metadata: {
            recurring_transaction_id: recurring.id,
            auto_generated: true,
            execution_count: recurring.execution_count + 1,
          },
        })
        .select()
        .single();

      if (txError) throw txError;

      // Log successful execution
      await supabase.from("recurring_transaction_executions").insert({
        recurring_transaction_id: recurring.id,
        transaction_id: transaction.id,
        execution_date: now.toISOString(),
        scheduled_date: recurring.next_execution,
        status: "completed",
        amount_executed: recurring.amount,
      });

      // Calculate next execution date
      const nextExecution = this.calculateNextExecution(
        now,
        recurring.frequency,
        recurring.metadata
      );

      // Update recurring transaction
      await supabase
        .from("recurring_transactions")
        .update({
          last_execution: now.toISOString(),
          next_execution: nextExecution.toISOString(),
          execution_count: recurring.execution_count + 1,
        })
        .eq("id", recurring.id);

      // Send notification if enabled
      if (recurring.notification_enabled) {
        await this.sendExecutionNotification(recurring, transaction);
      }

      console.log(
        `Successfully executed recurring transaction: ${recurring.id}`
      );
    } catch (error) {
      console.error(
        `Error executing recurring transaction ${recurring.id}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create pending execution for manual confirmation
   */
  private static async createPendingExecution(
    recurring: RecurringTransaction
  ): Promise<void> {
    const now = new Date();

    await supabase.from("recurring_transaction_executions").insert({
      recurring_transaction_id: recurring.id,
      execution_date: now.toISOString(),
      scheduled_date: recurring.next_execution,
      status: "pending",
      amount_executed: recurring.amount,
    });

    // Calculate next execution date
    const nextExecution = this.calculateNextExecution(
      now,
      recurring.frequency,
      recurring.metadata
    );

    // Update recurring transaction
    await supabase
      .from("recurring_transactions")
      .update({
        next_execution: nextExecution.toISOString(),
      })
      .eq("id", recurring.id);

    // Send notification for manual confirmation
    await this.sendConfirmationNotification(recurring);
  }

  /**
   * Manually confirm and execute a pending recurring transaction
   */
  static async confirmPendingExecution(
    executionId: string,
    userId: string
  ): Promise<void> {
    try {
      // Get the execution record
      const { data: execution, error: execError } = await supabase
        .from("recurring_transaction_executions")
        .select("*, recurring_transactions(*)")
        .eq("id", executionId)
        .single();

      if (execError) throw execError;
      if (!execution) throw new Error("Execution not found");

      // Verify ownership
      if (execution.recurring_transactions.user_id !== userId) {
        throw new Error("Unauthorized");
      }

      if (execution.status !== "pending") {
        throw new Error("Execution is not pending");
      }

      // Create the transaction
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: execution.recurring_transactions.user_id,
          card_id: execution.recurring_transactions.card_id,
          transaction_date: new Date().toISOString(),
          merchant_name: execution.recurring_transactions.merchant_name,
          merchant_category: execution.recurring_transactions.category,
          amount: execution.amount_executed,
          transaction_type: "debit",
          description:
            execution.recurring_transactions.description ||
            `Recurring: ${execution.recurring_transactions.merchant_name}`,
          is_manually_added: true,
          metadata: {
            recurring_transaction_id: execution.recurring_transaction_id,
            auto_generated: false,
            manually_confirmed: true,
          },
        })
        .select()
        .single();

      if (txError) throw txError;

      // Update execution record
      await supabase
        .from("recurring_transaction_executions")
        .update({
          transaction_id: transaction.id,
          status: "completed",
          execution_date: new Date().toISOString(),
        })
        .eq("id", executionId);

      // Update recurring transaction
      await supabase
        .from("recurring_transactions")
        .update({
          last_execution: new Date().toISOString(),
          execution_count: execution.recurring_transactions.execution_count + 1,
        })
        .eq("id", execution.recurring_transaction_id);

      console.log(`Confirmed pending execution: ${executionId}`);
    } catch (error) {
      console.error("Error confirming pending execution:", error);
      throw error;
    }
  }

  /**
   * Skip a pending execution
   */
  static async skipPendingExecution(
    executionId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    try {
      const { data: execution, error } = await supabase
        .from("recurring_transaction_executions")
        .select("*, recurring_transactions(*)")
        .eq("id", executionId)
        .single();

      if (error) throw error;

      // Verify ownership
      if (execution.recurring_transactions.user_id !== userId) {
        throw new Error("Unauthorized");
      }

      await supabase
        .from("recurring_transaction_executions")
        .update({
          status: "skipped",
          error_message: reason || "Manually skipped by user",
        })
        .eq("id", executionId);

      console.log(`Skipped execution: ${executionId}`);
    } catch (error) {
      console.error("Error skipping execution:", error);
      throw error;
    }
  }

  /**
   * Calculate next execution date based on frequency
   */
  private static calculateNextExecution(
    baseDate: Date,
    frequency: RecurringTransaction["frequency"],
    metadata?: RecurringTransaction["metadata"]
  ): Date {
    let nextDate: Date;

    switch (frequency) {
      case "daily":
        nextDate = addDays(baseDate, 1);
        break;
      case "weekly":
        nextDate = addWeeks(baseDate, 1);
        break;
      case "biweekly":
        nextDate = addWeeks(baseDate, 2);
        break;
      case "monthly":
        nextDate = addMonths(baseDate, 1);
        break;
      case "quarterly":
        nextDate = addMonths(baseDate, 3);
        break;
      case "annually":
        nextDate = addYears(baseDate, 1);
        break;
      default:
        nextDate = addMonths(baseDate, 1);
    }

    // Skip weekends if configured
    if (metadata?.skip_weekends) {
      nextDate = this.skipWeekends(nextDate);
    }

    return startOfDay(nextDate);
  }

  /**
   * Skip weekends helper
   */
  private static skipWeekends(date: Date): Date {
    const day = date.getDay();
    if (day === 0) {
      // Sunday -> Monday
      return addDays(date, 1);
    } else if (day === 6) {
      // Saturday -> Monday
      return addDays(date, 2);
    }
    return date;
  }

  /**
   * Check for duplicate execution on the same day
   */
  private static async checkForDuplicateExecution(
    recurringId: string,
    date: Date
  ): Promise<boolean> {
    const startOfToday = startOfDay(date);
    const { data, error } = await supabase
      .from("recurring_transaction_executions")
      .select("id")
      .eq("recurring_transaction_id", recurringId)
      .gte("execution_date", startOfToday.toISOString())
      .eq("status", "completed")
      .limit(1);

    return !error && data && data.length > 0;
  }

  /**
   * Log failed execution
   */
  private static async logFailedExecution(
    recurringId: string,
    error: any
  ): Promise<void> {
    await supabase.from("recurring_transaction_executions").insert({
      recurring_transaction_id: recurringId,
      execution_date: new Date().toISOString(),
      scheduled_date: new Date().toISOString(),
      status: "failed",
      error_message: error?.message || String(error),
      amount_executed: 0,
    });
  }

  /**
   * Send execution notification
   */
  private static async sendExecutionNotification(
    recurring: RecurringTransaction,
    transaction: any
  ): Promise<void> {
    await supabase.from("alerts").insert({
      user_id: recurring.user_id,
      alert_type: "recurring_transaction_executed",
      priority: "low",
      title: "Recurring Transaction Executed",
      message: `${recurring.merchant_name} - ₹${recurring.amount} has been automatically added to your transactions.`,
      metadata: {
        recurring_transaction_id: recurring.id,
        transaction_id: transaction.id,
      },
    });
  }

  /**
   * Send confirmation notification
   */
  private static async sendConfirmationNotification(
    recurring: RecurringTransaction
  ): Promise<void> {
    await supabase.from("alerts").insert({
      user_id: recurring.user_id,
      alert_type: "recurring_transaction_pending",
      priority: "medium",
      title: "Confirm Recurring Transaction",
      message: `Please confirm recurring transaction: ${recurring.merchant_name} - ₹${recurring.amount}`,
      metadata: {
        recurring_transaction_id: recurring.id,
      },
    });
  }

  /**
   * Validate recurring transaction data
   */
  private static validateRecurringTransaction(data: any): void {
    if (!data.user_id || !data.card_id) {
      throw new Error("User ID and Card ID are required");
    }
    if (!data.merchant_name || data.merchant_name.trim().length === 0) {
      throw new Error("Merchant name is required");
    }
    if (!data.amount || data.amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }
    if (!data.frequency) {
      throw new Error("Frequency is required");
    }
    if (!data.start_date) {
      throw new Error("Start date is required");
    }
    if (
      data.end_date &&
      isBefore(new Date(data.end_date), new Date(data.start_date))
    ) {
      throw new Error("End date must be after start date");
    }
  }

  /**
   * Get upcoming recurring transactions (next 30 days)
   */
  static async getUpcomingRecurringTransactions(
    userId: string,
    days: number = 30
  ): Promise<RecurringTransaction[]> {
    const futureDate = addDays(new Date(), days);

    const { data, error } = await supabase
      .from("recurring_transactions")
      .select("*, cards(card_name, bank_name)")
      .eq("user_id", userId)
      .eq("status", "active")
      .lte("next_execution", futureDate.toISOString())
      .order("next_execution", { ascending: true });

    if (error) {
      console.error("Error fetching upcoming recurring transactions:", error);
      return [];
    }

    return data || [];
  }
}
