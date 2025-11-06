import { supabase } from "shared/database/supabase";

/**
 * DashboardService handles dashboard statistics and analytics
 */
export class DashboardService {
  /**
   * Get overview statistics for the dashboard
   */
  async getDashboardOverview(userId: string) {
    try {
      // Get total cards count
      const { count: totalCards } = await supabase
        .from("credit_cards")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_active", true);

      // Get current month transactions
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      const { data: monthTransactions } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("user_id", userId)
        .gte("transaction_date", firstDayOfMonth.toISOString())
        .lte("transaction_date", lastDayOfMonth.toISOString());

      // Calculate monthly spending
      const monthlyDebit =
        monthTransactions
          ?.filter((t: any) => t.transaction_type === "debit")
          .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;

      const monthlyCredit =
        monthTransactions
          ?.filter(
            (t: any) =>
              t.transaction_type === "credit" || t.transaction_type === "refund"
          )
          .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;

      const monthlySpending = monthlyDebit - monthlyCredit;

      // Get transaction count
      const { count: transactionCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("transaction_date", firstDayOfMonth.toISOString())
        .lte("transaction_date", lastDayOfMonth.toISOString());

      // Get total outstanding across all cards
      const { data: cards } = await supabase
        .from("credit_cards")
        .select("current_outstanding, credit_limit")
        .eq("user_id", userId)
        .eq("is_active", true);

      const totalOutstanding =
        cards?.reduce(
          (sum: number, card: any) => sum + (card.current_outstanding || 0),
          0
        ) || 0;

      const totalCreditLimit =
        cards?.reduce(
          (sum: number, card: any) => sum + (card.credit_limit || 0),
          0
        ) || 0;

      const creditUtilization =
        totalCreditLimit > 0 ? (totalOutstanding / totalCreditLimit) * 100 : 0;

      // Get user's monthly budget
      const { data: user } = await supabase
        .from("users")
        .select("monthly_budget")
        .eq("id", userId)
        .single();

      const monthlyBudget = user?.monthly_budget || 30000;
      const budgetUtilization =
        monthlyBudget > 0 ? (monthlySpending / monthlyBudget) * 100 : 0;

      return {
        totalCards: totalCards || 0,
        monthlySpending,
        transactionCount: transactionCount || 0,
        totalOutstanding,
        creditUtilization: Math.round(creditUtilization * 10) / 10,
        monthlyBudget,
        budgetUtilization: Math.round(budgetUtilization * 10) / 10,
        budgetRemaining: Math.max(0, monthlyBudget - monthlySpending),
      };
    } catch (error) {
      console.error("Error fetching dashboard overview:", error);
      throw error;
    }
  }

  /**
   * Get spending by category
   */
  async getSpendingByCategory(
    userId: string,
    startDate?: string,
    endDate?: string
  ) {
    try {
      let query = supabase
        .from("transactions")
        .select("amount, merchant_category, transaction_type")
        .eq("user_id", userId)
        .eq("transaction_type", "debit");

      if (startDate) {
        query = query.gte("transaction_date", startDate);
      }

      if (endDate) {
        query = query.lte("transaction_date", endDate);
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch category spending: ${error.message}`);
      }

      // Group by category
      const categoryTotals: Record<string, number> = {};
      let uncategorizedTotal = 0;

      transactions?.forEach((t: any) => {
        const amount = t.amount || 0;
        if (t.merchant_category) {
          categoryTotals[t.merchant_category] =
            (categoryTotals[t.merchant_category] || 0) + amount;
        } else {
          uncategorizedTotal += amount;
        }
      });

      // Convert to array and sort
      const categories = Object.entries(categoryTotals)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      if (uncategorizedTotal > 0) {
        categories.push({
          category: "Uncategorized",
          amount: uncategorizedTotal,
        });
      }

      const totalSpending = categories.reduce((sum, c) => sum + c.amount, 0);

      return {
        categories,
        totalSpending,
      };
    } catch (error) {
      console.error("Error fetching category spending:", error);
      throw error;
    }
  }

  /**
   * Get spending trend over time
   */
  async getSpendingTrend(
    userId: string,
    period: "week" | "month" | "year" = "month",
    limit: number = 12
  ) {
    try {
      const now = new Date();
      let startDate: Date;

      // Calculate start date based on period
      switch (period) {
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - limit * 7);
          break;
        case "month":
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - limit);
          break;
        case "year":
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - limit);
          break;
      }

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("amount, transaction_type, transaction_date")
        .eq("user_id", userId)
        .gte("transaction_date", startDate.toISOString())
        .order("transaction_date", { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch spending trend: ${error.message}`);
      }

      // Group transactions by period
      const trendData: Record<string, { debit: number; credit: number }> = {};

      transactions?.forEach((t: any) => {
        const date = new Date(t.transaction_date);
        let periodKey: string;

        switch (period) {
          case "week":
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            periodKey = weekStart.toISOString().split("T")[0];
            break;
          case "month":
            periodKey = `${date.getFullYear()}-${String(
              date.getMonth() + 1
            ).padStart(2, "0")}`;
            break;
          case "year":
            periodKey = `${date.getFullYear()}`;
            break;
        }

        if (!trendData[periodKey]) {
          trendData[periodKey] = { debit: 0, credit: 0 };
        }

        if (t.transaction_type === "debit") {
          trendData[periodKey].debit += t.amount;
        } else if (
          t.transaction_type === "credit" ||
          t.transaction_type === "refund"
        ) {
          trendData[periodKey].credit += t.amount;
        }
      });

      // Convert to array and format
      const trend = Object.entries(trendData)
        .map(([period, data]) => ({
          period,
          debit: data.debit,
          credit: data.credit,
          net: data.debit - data.credit,
        }))
        .sort((a, b) => a.period.localeCompare(b.period))
        .slice(-limit);

      return trend;
    } catch (error) {
      console.error("Error fetching spending trend:", error);
      throw error;
    }
  }

  /**
   * Get upcoming bill dates
   */
  async getUpcomingBills(userId: string, daysAhead: number = 30) {
    try {
      const { data: cards, error } = await supabase
        .from("credit_cards")
        .select("id, card_name, bank_name, due_date, current_outstanding")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("due_date", { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch upcoming bills: ${error.message}`);
      }

      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const upcomingBills = cards
        ?.map((card: any) => {
          let dueDate = new Date(currentYear, currentMonth, card.due_date);

          // If due date has passed this month, use next month
          if (card.due_date < currentDay) {
            dueDate = new Date(currentYear, currentMonth + 1, card.due_date);
          }

          const daysUntilDue = Math.ceil(
            (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            cardId: card.id,
            cardName: card.card_name,
            bankName: card.bank_name,
            dueDate: dueDate.toISOString().split("T")[0],
            daysUntilDue,
            amountDue: card.current_outstanding || 0,
          };
        })
        .filter((bill: any) => bill.daysUntilDue <= daysAhead)
        .sort((a: any, b: any) => a.daysUntilDue - b.daysUntilDue);

      return upcomingBills || [];
    } catch (error) {
      console.error("Error fetching upcoming bills:", error);
      throw error;
    }
  }

  /**
   * Get card utilization breakdown
   */
  async getCardUtilization(userId: string) {
    try {
      const { data: cards, error } = await supabase
        .from("credit_cards")
        .select("id, card_name, bank_name, credit_limit, current_outstanding")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("current_outstanding", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch card utilization: ${error.message}`);
      }

      const utilization = cards?.map((card: any) => {
        const utilized = card.current_outstanding || 0;
        const limit = card.credit_limit || 0;
        const percentage = limit > 0 ? (utilized / limit) * 100 : 0;

        return {
          cardId: card.id,
          cardName: card.card_name,
          bankName: card.bank_name,
          utilized,
          limit,
          available: Math.max(0, limit - utilized),
          utilizationPercentage: Math.round(percentage * 10) / 10,
        };
      });

      return utilization || [];
    } catch (error) {
      console.error("Error fetching card utilization:", error);
      throw error;
    }
  }

  /**
   * Get monthly comparison (current vs previous month)
   */
  async getMonthlyComparison(userId: string) {
    try {
      const now = new Date();

      // Current month
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      // Previous month
      const previousMonthStart = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const previousMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59
      );

      // Get current month data
      const { data: currentTransactions } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("user_id", userId)
        .gte("transaction_date", currentMonthStart.toISOString())
        .lte("transaction_date", currentMonthEnd.toISOString());

      const currentSpending =
        currentTransactions
          ?.filter((t: any) => t.transaction_type === "debit")
          .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;

      // Get previous month data
      const { data: previousTransactions } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("user_id", userId)
        .gte("transaction_date", previousMonthStart.toISOString())
        .lte("transaction_date", previousMonthEnd.toISOString());

      const previousSpending =
        previousTransactions
          ?.filter((t: any) => t.transaction_type === "debit")
          .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;

      const difference = currentSpending - previousSpending;
      const percentageChange =
        previousSpending > 0 ? (difference / previousSpending) * 100 : 0;

      return {
        currentMonth: {
          spending: currentSpending,
          transactions: currentTransactions?.length || 0,
        },
        previousMonth: {
          spending: previousSpending,
          transactions: previousTransactions?.length || 0,
        },
        difference,
        percentageChange: Math.round(percentageChange * 10) / 10,
        trend: difference > 0 ? "up" : difference < 0 ? "down" : "stable",
      };
    } catch (error) {
      console.error("Error fetching monthly comparison:", error);
      throw error;
    }
  }
}

export default DashboardService;
