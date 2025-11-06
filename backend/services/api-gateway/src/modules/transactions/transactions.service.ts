import { supabase } from "shared/database/supabase";

/**
 * Transaction interface matching database schema
 */
interface Transaction {
  id: string;
  user_id: string;
  card_id: string;
  transaction_date: Date;
  merchant_name?: string;
  merchant_category?: string;
  amount: number;
  transaction_type: "debit" | "credit" | "refund";
  description?: string;
  billing_cycle_month?: number;
  billing_cycle_year?: number;
  email_message_id?: string;
  is_manually_added: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

interface TransactionFilters {
  cardId?: string;
  startDate?: string;
  endDate?: string;
  type?: "debit" | "credit" | "refund";
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * TransactionService handles all transaction-related business logic
 */
export class TransactionService {
  /**
   * Get all transactions for a user with filtering and pagination
   */
  async getUserTransactions(
    userId: string,
    filters: TransactionFilters = {},
    pagination: PaginationOptions = {}
  ) {
    try {
      const {
        cardId,
        startDate,
        endDate,
        type,
        category,
        minAmount,
        maxAmount,
        searchQuery,
      } = filters;

      const {
        page = 1,
        limit = 50,
        sortBy = "transaction_date",
        sortOrder = "desc",
      } = pagination;

      const offset = (page - 1) * limit;

      // Build query
      let query = supabase
        .from("transactions")
        .select(
          `
          *,
          credit_cards (
            card_name,
            bank_name,
            last_four_digits
          )
        `,
          { count: "exact" }
        )
        .eq("user_id", userId);

      // Apply filters
      if (cardId) {
        query = query.eq("card_id", cardId);
      }

      if (startDate) {
        query = query.gte("transaction_date", startDate);
      }

      if (endDate) {
        query = query.lte("transaction_date", endDate);
      }

      if (type) {
        query = query.eq("transaction_type", type);
      }

      if (category) {
        query = query.eq("merchant_category", category);
      }

      if (minAmount !== undefined) {
        query = query.gte("amount", minAmount);
      }

      if (maxAmount !== undefined) {
        query = query.lte("amount", maxAmount);
      }

      if (searchQuery) {
        query = query.or(
          `merchant_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
        );
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === "asc" })
        .range(offset, offset + limit - 1);

      const { data: transactions, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch transactions: ${error.message}`);
      }

      return {
        transactions: transactions || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw error;
    }
  }

  /**
   * Get a single transaction by ID
   */
  async getTransactionById(transactionId: string, userId: string) {
    try {
      const { data: transaction, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          credit_cards (
            card_name,
            bank_name,
            last_four_digits,
            card_type
          )
        `
        )
        .eq("id", transactionId)
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Transaction not found");
        }
        throw new Error(`Failed to fetch transaction: ${error.message}`);
      }

      return transaction;
    } catch (error) {
      console.error("Error fetching transaction:", error);
      throw error;
    }
  }

  /**
   * Create a new transaction
   */
  async createTransaction(
    userId: string,
    transactionData: {
      card_id: string;
      transaction_date: string;
      merchant_name?: string;
      merchant_category?: string;
      amount: number;
      transaction_type: "debit" | "credit" | "refund";
      description?: string;
      metadata?: Record<string, any>;
    }
  ) {
    try {
      // Validate transaction data
      this.validateTransactionData(transactionData);

      // Verify card belongs to user
      const { data: card, error: cardError } = await supabase
        .from("credit_cards")
        .select("id, bill_date")
        .eq("id", transactionData.card_id)
        .eq("user_id", userId)
        .single();

      if (cardError || !card) {
        throw new Error("Card not found or does not belong to user");
      }

      // Calculate billing cycle
      const transactionDate = new Date(transactionData.transaction_date);
      const billDate = card.bill_date;
      const { month, year } = this.calculateBillingCycle(
        transactionDate,
        billDate
      );

      // Create transaction
      const { data: transaction, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          ...transactionData,
          billing_cycle_month: month,
          billing_cycle_year: year,
          is_manually_added: true,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create transaction: ${error.message}`);
      }

      // Update card outstanding amount
      if (transactionData.transaction_type === "debit") {
        await this.updateCardOutstanding(transactionData.card_id);
      }

      return transaction;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  /**
   * Update an existing transaction
   */
  async updateTransaction(
    transactionId: string,
    userId: string,
    updateData: Partial<{
      transaction_date: string;
      merchant_name: string;
      merchant_category: string;
      amount: number;
      transaction_type: "debit" | "credit" | "refund";
      description: string;
      metadata: Record<string, any>;
    }>
  ) {
    try {
      // Verify transaction belongs to user
      const existing = await this.getTransactionById(transactionId, userId);

      // Validate update data
      if (updateData.amount !== undefined && updateData.amount <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      // Recalculate billing cycle if date changed
      if (updateData.transaction_date) {
        const { data: card } = await supabase
          .from("credit_cards")
          .select("bill_date")
          .eq("id", existing.card_id)
          .single();

        if (card) {
          const transactionDate = new Date(updateData.transaction_date);
          const { month, year } = this.calculateBillingCycle(
            transactionDate,
            card.bill_date
          );
          Object.assign(updateData, {
            billing_cycle_month: month,
            billing_cycle_year: year,
          });
        }
      }

      // Update transaction
      const { data: transaction, error } = await supabase
        .from("transactions")
        .update(updateData)
        .eq("id", transactionId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update transaction: ${error.message}`);
      }

      // Update card outstanding if amount or type changed
      if (
        updateData.amount !== undefined ||
        updateData.transaction_type !== undefined
      ) {
        await this.updateCardOutstanding(existing.card_id);
      }

      return transaction;
    } catch (error) {
      console.error("Error updating transaction:", error);
      throw error;
    }
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(transactionId: string, userId: string) {
    try {
      // Verify transaction belongs to user and get card_id
      const transaction = await this.getTransactionById(transactionId, userId);

      // Delete transaction
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to delete transaction: ${error.message}`);
      }

      // Update card outstanding
      await this.updateCardOutstanding(transaction.card_id);

      return { success: true, message: "Transaction deleted successfully" };
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStatistics(
    userId: string,
    filters: {
      cardId?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ) {
    try {
      const { cardId, startDate, endDate } = filters;

      // Build query
      let query = supabase
        .from("transactions")
        .select("amount, transaction_type, merchant_category")
        .eq("user_id", userId);

      if (cardId) {
        query = query.eq("card_id", cardId);
      }

      if (startDate) {
        query = query.gte("transaction_date", startDate);
      }

      if (endDate) {
        query = query.lte("transaction_date", endDate);
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch statistics: ${error.message}`);
      }

      // Calculate statistics
      const totalTransactions = transactions?.length || 0;
      const totalDebit =
        transactions
          ?.filter((t: any) => t.transaction_type === "debit")
          .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;

      const totalCredit =
        transactions
          ?.filter((t: any) => t.transaction_type === "credit")
          .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;

      const totalRefund =
        transactions
          ?.filter((t: any) => t.transaction_type === "refund")
          .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;

      // Calculate category breakdown
      const categoryBreakdown: Record<string, number> = {};
      transactions?.forEach((t: any) => {
        if (t.merchant_category && t.transaction_type === "debit") {
          categoryBreakdown[t.merchant_category] =
            (categoryBreakdown[t.merchant_category] || 0) + t.amount;
        }
      });

      // Sort categories by amount
      const topCategories = Object.entries(categoryBreakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([category, amount]) => ({ category, amount }));

      return {
        totalTransactions,
        totalDebit,
        totalCredit,
        totalRefund,
        netSpend: totalDebit - totalCredit - totalRefund,
        averageTransaction:
          totalTransactions > 0 ? totalDebit / totalTransactions : 0,
        topCategories,
        categoryBreakdown,
      };
    } catch (error) {
      console.error("Error calculating statistics:", error);
      throw error;
    }
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(userId: string, limit: number = 10) {
    try {
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          credit_cards (
            card_name,
            bank_name,
            last_four_digits
          )
        `
        )
        .eq("user_id", userId)
        .order("transaction_date", { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(
          `Failed to fetch recent transactions: ${error.message}`
        );
      }

      return transactions || [];
    } catch (error) {
      console.error("Error fetching recent transactions:", error);
      throw error;
    }
  }

  /**
   * Validate transaction data
   */
  private validateTransactionData(data: any) {
    if (!data.card_id) {
      throw new Error("Card ID is required");
    }

    if (!data.transaction_date) {
      throw new Error("Transaction date is required");
    }

    if (data.amount === undefined || data.amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (
      !data.transaction_type ||
      !["debit", "credit", "refund"].includes(data.transaction_type)
    ) {
      throw new Error("Invalid transaction type");
    }

    // Validate date format
    const date = new Date(data.transaction_date);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid transaction date format");
    }

    return true;
  }

  /**
   * Calculate billing cycle month and year
   */
  private calculateBillingCycle(
    transactionDate: Date,
    billDate: number
  ): { month: number; year: number } {
    const txDay = transactionDate.getDate();
    let month = transactionDate.getMonth() + 1; // 1-12
    let year = transactionDate.getFullYear();

    // If transaction is before bill date, it belongs to previous billing cycle
    if (txDay < billDate) {
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }

    return { month, year };
  }

  /**
   * Update card's current outstanding amount
   */
  private async updateCardOutstanding(cardId: string) {
    try {
      // Calculate total outstanding
      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("card_id", cardId);

      const outstanding =
        transactions?.reduce((total: number, t: any) => {
          if (t.transaction_type === "debit") {
            return total + t.amount;
          } else if (
            t.transaction_type === "credit" ||
            t.transaction_type === "refund"
          ) {
            return total - t.amount;
          }
          return total;
        }, 0) || 0;

      // Update card
      await supabase
        .from("credit_cards")
        .update({ current_outstanding: Math.max(0, outstanding) })
        .eq("id", cardId);
    } catch (error) {
      console.error("Error updating card outstanding:", error);
      // Don't throw - this is a secondary operation
    }
  }
}

export default TransactionService;


// Export singleton instance
export const transactionService = new TransactionService();
