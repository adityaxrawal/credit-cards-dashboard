/**
 * Dashboard Data Hooks
 * 
 * Decomposed from the monolithic useDashboardData hook (Issue #11).
 * Each hook focuses on a single data domain for better:
 * - Testability (mock 1 API instead of 8)
 * - Reusability (use useOverview anywhere, not just dashboard)
 * - Performance (load only what you need)
 */

import { useMemo } from "react";
import { useUser } from "@/lib/auth/user-context";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/keys";
import { analyticsApi } from "@/lib/api/analytics";
import { transactionApi } from "@/lib/api/transactions";
import { cardApi } from "@/lib/api/cards";
import { budgetApi } from "@/lib/api/budget";
import { rewardsApi } from "@/lib/api/rewards";
import { billsApi, type Bill } from "@/lib/api/bills";
import { recurringApi } from "@/lib/api/recurring";

// ============================================
// INDIVIDUAL HOOKS
// ============================================

/**
 * Hook for dashboard overview analytics
 */
export function useOverview() {
    const { user } = useUser();

    const query = useQuery({
        queryKey: queryKeys.analytics.overview,
        queryFn: () => analyticsApi.getOverview(),
        enabled: !!user,
    });

    return {
        data: query.data || null,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for recent transactions
 */
export function useRecentTransactions(limit: number = 5) {
    const { user } = useUser();

    const query = useQuery({
        queryKey: queryKeys.transactions.list({ limit }),
        queryFn: () => transactionApi.getTransactions({ limit }),
        enabled: !!user,
    });

    return {
        data: query.data?.data || [],
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for dashboard cards data
 */
export function useDashboardCards() {
    const { user } = useUser();

    const query = useQuery({
        queryKey: queryKeys.cards.all,
        queryFn: () => cardApi.getCards(),
        enabled: !!user,
    });

    const derived = useMemo(() => {
        const cards = query.data || [];
        if (!cards.length) return { totalBalance: 0, totalCards: 0 };

        // Calculate available credit across all cards
        const availableCredit = cards.reduce((sum, card) => {
            const limit = card.credit_limit || 0;
            const used = card.current_balance || 0;
            return sum + (limit - used);
        }, 0);

        return {
            totalBalance: availableCredit,
            totalCards: cards.length,
        };
    }, [query.data]);

    return {
        cards: query.data || [],
        ...derived,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for current budget status
 */
export function useCurrentBudget() {
    const { user } = useUser();

    const query = useQuery({
        queryKey: queryKeys.budget.current,
        queryFn: () => budgetApi.getCurrentBudget(),
        enabled: !!user,
    });

    return {
        data: query.data || null,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for spending trends
 */
export function useSpendingTrends(period: string = "6m") {
    const { user } = useUser();

    const query = useQuery({
        queryKey: queryKeys.analytics.trends(period),
        queryFn: () => analyticsApi.getTrends(period),
        enabled: !!user,
    });

    return {
        data: query.data || [],
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for rewards summary
 */
export function useRewardsSummary() {
    const { user } = useUser();

    const query = useQuery({
        queryKey: queryKeys.rewards.summary,
        queryFn: () => rewardsApi.getSummary(),
        enabled: !!user,
    });

    return {
        data: query.data,
        totalPoints: query.data?.summary?.total_points_balance || 0,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for upcoming bills
 */
export interface UpcomingBill {
    card_id: string;
    card_name: string;
    bank_name: string;
    due_date: string;
    outstanding: number;
    days_until_due: number;
}

export function useUpcomingBills(cards: any[] = []) {
    const { user } = useUser();

    const query = useQuery({
        queryKey: queryKeys.bills?.upcoming ?? ["bills", "upcoming"],
        queryFn: () => billsApi.getUpcoming(),
        enabled: !!user,
    });

    const derived = useMemo(() => {
        const billsData = query.data || [];
        const today = new Date();
        const bills: UpcomingBill[] = [];

        // First, use actual bills from bills API if available
        if (billsData.length > 0) {
            billsData.forEach((bill: Bill) => {
                const dueDate = new Date(bill.due_date);
                const diffTime = dueDate.getTime() - today.getTime();
                const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                bills.push({
                    card_id: bill.card_id,
                    card_name: bill.card_name,
                    bank_name: bill.bank_name,
                    due_date: bill.due_date,
                    outstanding: bill.bill_amount - (bill.payment_amount || 0),
                    days_until_due: daysUntil
                });
            });
        } else if (cards.length > 0) {
            // Fallback: derive from cards if no bills data
            cards.forEach(card => {
                if (!card.nextDueDate || !card.current_balance) return;

                const dueDate = new Date(card.nextDueDate);
                const diffTime = dueDate.getTime() - today.getTime();
                const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (daysUntil >= 0 && daysUntil <= 30 && card.current_balance > 0) {
                    bills.push({
                        card_id: card.id,
                        card_name: card.card_name,
                        bank_name: card.bank_name,
                        due_date: card.nextDueDate,
                        outstanding: card.current_balance,
                        days_until_due: daysUntil
                    });
                }
            });
        }

        bills.sort((a, b) => a.days_until_due - b.days_until_due);
        const totalAmount = bills.reduce((sum, bill) => sum + bill.outstanding, 0);

        return { bills, totalAmount };
    }, [query.data, cards]);

    return {
        bills: derived.bills,
        totalAmount: derived.totalAmount,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for recurring stats
 */
export function useRecurringStats() {
    const { user } = useUser();

    const query = useQuery({
        queryKey: queryKeys.recurring.stats,
        queryFn: () => recurringApi.getStats(),
        enabled: !!user,
    });

    return {
        data: query.data || { totalMonthly: 0, activeCount: 0 },
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}
