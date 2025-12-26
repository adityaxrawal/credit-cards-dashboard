import { useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/keys";
import {
    analyticsApi,
    type DashboardOverview,
    type SpendingTrendItem,
} from "@/lib/api/analytics";
import { transactionApi, type Transaction } from "@/lib/api/transactions";
import { cardApi, type Card } from "@/lib/api/cards";
import { budgetApi, type BudgetStatus } from "@/lib/api/budget";
import { rewardsApi } from "@/lib/api/rewards";

export interface UpcomingBill {
    card_id: string;
    card_name: string;
    bank_name: string;
    due_date: string; // ISO date
    outstanding: number;
    days_until_due: number;
}

export function useDashboardData() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // 1. Overview Data
    const { data: overview, isLoading: overviewLoading } = useQuery({
        queryKey: queryKeys.analytics.overview,
        queryFn: () => analyticsApi.getOverview(),
        enabled: !!user,
    });

    // 2. Recent Transactions
    const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
        queryKey: queryKeys.transactions.list({ limit: 5 }),
        queryFn: () => transactionApi.getTransactions({ limit: 5 }),
        enabled: !!user,
    });
    const recentTransactions = transactionsData?.data || [];

    // 3. Cards Data
    const { data: cards = [], isLoading: cardsLoading } = useQuery({
        queryKey: queryKeys.cards.all,
        queryFn: () => cardApi.getCards(),
        enabled: !!user,
    });

    // 4. Budget Status
    const { data: budgetStatus, isLoading: budgetLoading } = useQuery({
        queryKey: queryKeys.budget.current,
        queryFn: () => budgetApi.getCurrentBudget(),
        enabled: !!user,
    });

    // 5. Spending Trends
    const { data: spendingTrend = [], isLoading: trendLoading } = useQuery({
        queryKey: queryKeys.analytics.trends("6m"),
        queryFn: () => analyticsApi.getTrends("6m"),
        enabled: !!user,
    });

    // 6. Rewards Summary
    const { data: rewardData, isLoading: rewardsLoading } = useQuery({
        queryKey: queryKeys.rewards.summary,
        queryFn: () => rewardsApi.getSummary(),
        enabled: !!user,
    });
    const totalRewards = rewardData?.summary?.total_points_balance || 0;

    // Derived State
    const { totalBalance, totalCards, upcomingBills } = useMemo(() => {
        if (!cards.length) return { totalBalance: 0, totalCards: 0, upcomingBills: [] };

        const balance = cards.reduce((sum, card) => sum + (card.current_balance || 0), 0);

        const today = new Date();
        const bills: UpcomingBill[] = [];

        cards.forEach(card => {
            if (!card.nextDueDate || !card.current_balance) return;

            const dueDate = new Date(card.nextDueDate);
            const diffTime = dueDate.getTime() - today.getTime();
            const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Only show bills due in next 30 days
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

        bills.sort((a, b) => a.days_until_due - b.days_until_due);

        return {
            totalBalance: balance,
            totalCards: cards.length,
            upcomingBills: bills
        };
    }, [cards]);

    // Combined Loading State
    const loading = overviewLoading || transactionsLoading || cardsLoading || budgetLoading || trendLoading || rewardsLoading;

    // Manual Refresh Function (Invalidate all queries)
    const loadDashboardData = useCallback(async (force = false) => {
        if (force) {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.analytics.overview }),
                queryClient.invalidateQueries({ queryKey: queryKeys.transactions.list({ limit: 5 }) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.cards.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.budget.current }),
                queryClient.invalidateQueries({ queryKey: queryKeys.analytics.trends("6m") }),
                queryClient.invalidateQueries({ queryKey: queryKeys.rewards.summary }),
            ]);
        } else {
            await Promise.all([
                queryClient.refetchQueries({ queryKey: queryKeys.analytics.overview }),
                queryClient.refetchQueries({ queryKey: queryKeys.transactions.list({ limit: 5 }) }),
                queryClient.refetchQueries({ queryKey: queryKeys.cards.all }),
                queryClient.refetchQueries({ queryKey: queryKeys.budget.current }),
                queryClient.refetchQueries({ queryKey: queryKeys.analytics.trends("6m") }),
                queryClient.refetchQueries({ queryKey: queryKeys.rewards.summary }),
            ]);
        }
    }, [queryClient]);

    return {
        overview: overview || null,
        budgetStatus: budgetStatus || null,
        recentTransactions,
        upcomingBills,
        spendingTrend,
        totalBalance,
        totalCards,
        totalRewards,
        loading,
        loadDashboardData,
        user
    };
}
