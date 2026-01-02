/**
 * useDashboardData - Composite Dashboard Hook
 * 
 * Composes individual hooks for backward compatibility.
 * New code should prefer importing specific hooks from useDashboardHooks.ts
 * 
 * Refactored as part of Issue #11: useDashboardData God-Hook decomposition
 */

import { useCallback, useMemo } from "react";
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
    useAccountsSummary,
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
    const accounts = useAccountsSummary();

    // Combined Loading State
    const loading =
        overview.isLoading ||
        transactions.isLoading ||
        cardsData.isLoading ||
        budget.isLoading ||
        trends.isLoading ||
        rewards.isLoading ||
        bills.isLoading ||
        recurring.isLoading ||
        accounts.isLoading;

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
            ["accounts-summary"],
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

    // Synthesize "summary" object for backward compatibility with OverviewPage
    const summary = useMemo(() => {
        if (!overview.data || !accounts.data) return null;

        const currentMonth = overview.data.currentMonth || { totalSpent: 0, totalEarned: 0 };

        return {
            ...overview.data,
            netWorth: accounts.data.netWorth,
            accountTotals: {
                cash: accounts.data.totalBalance, // Assuming totalBalance is assets (cash + investments)
                bankAccounts: accounts.data.byType?.['bank']?.totalBalance || 0,
                creditCardOutstanding: accounts.data.totalLiabilities,
            },
            monthlySnapshot: {
                expenses: currentMonth.totalSpent,
                savings: 0 - currentMonth.totalSpent, // Approximate (Income not available in overview)
            }
        };
    }, [overview.data, accounts.data]);

    // Return same shape as before for backward compatibility
    return {
        summary, // This uses the synthesized object
        overview: overview.data, // Keep original property just in case
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
        isLoading: loading, // Add alias if component uses isLoading
        loadDashboardData,
        user
    };
}
