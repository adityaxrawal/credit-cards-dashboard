/**
 * useDashboardData - Composite Dashboard Hook
 * 
 * Composes individual hooks for backward compatibility.
 * New code should prefer importing specific hooks from useDashboardHooks.ts
 * 
 * Refactored as part of Issue #11: useDashboardData God-Hook decomposition
 */

import { useCallback } from "react";
import { useUser } from "@/lib/auth/user-context";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/keys";

// Import decomposed hooks
import {
    useOverview,
    useRecentTransactions,
    useDashboardCards,
    useCurrentBudget,
    useSpendingTrends,
    useRewardsSummary,
    useUpcomingBills,
    useRecurringStats,
    type UpcomingBill,
} from "./useDashboardHooks";

// Re-export type for backward compatibility
export type { UpcomingBill };

/**
 * Composite dashboard hook - maintains backward compatibility
 * Internally uses decomposed hooks for better separation of concerns
 */
export function useDashboardData() {
    const { user } = useUser();
    const queryClient = useQueryClient();

    // Compose individual hooks
    const overview = useOverview();
    const transactions = useRecentTransactions(5);
    const cardsData = useDashboardCards();
    const budget = useCurrentBudget();
    const trends = useSpendingTrends("6m");
    const rewards = useRewardsSummary();
    const bills = useUpcomingBills(cardsData.cards);
    const recurring = useRecurringStats();

    // Combined Loading State
    const loading =
        overview.isLoading ||
        transactions.isLoading ||
        cardsData.isLoading ||
        budget.isLoading ||
        trends.isLoading ||
        rewards.isLoading ||
        bills.isLoading ||
        recurring.isLoading;

    // Manual Refresh Function (Invalidate all queries)
    const loadDashboardData = useCallback(async (force = false) => {
        const queries = [
            queryKeys.analytics.overview,
            queryKeys.transactions.list({ limit: 5 }),
            queryKeys.cards.all,
            queryKeys.budget.current,
            queryKeys.analytics.trends("6m"),
            queryKeys.rewards.summary,
            queryKeys.bills?.upcoming ?? ["bills", "upcoming"],
            queryKeys.recurring.stats,
        ];

        if (force) {
            await Promise.all(
                queries.map(key => queryClient.invalidateQueries({ queryKey: key }))
            );
        } else {
            await Promise.all(
                queries.map(key => queryClient.refetchQueries({ queryKey: key }))
            );
        }
    }, [queryClient]);

    // Return same shape as before for backward compatibility
    return {
        overview: overview.data,
        budgetStatus: budget.data,
        recentTransactions: transactions.data,
        upcomingBills: bills.bills,
        totalUpcomingBillAmount: bills.totalAmount,
        spendingTrend: trends.data,
        totalBalance: cardsData.totalBalance,
        totalCards: cardsData.totalCards,
        totalRewards: rewards.totalPoints,
        recurringStats: recurring.data,
        loading,
        loadDashboardData,
        user
    };
}
