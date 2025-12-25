import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
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
    const [overview, setOverview] = useState<DashboardOverview | null>(null);
    const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [upcomingBills, setUpcomingBills] = useState<UpcomingBill[]>([]);
    const [spendingTrend, setSpendingTrend] = useState<SpendingTrendItem[]>([]);
    const [totalBalance, setTotalBalance] = useState(0);
    const [totalCards, setTotalCards] = useState(0);
    const [totalRewards, setTotalRewards] = useState(0);
    const [loading, setLoading] = useState(true);

    const calculateUpcomingBills = useCallback((cards: Card[]): UpcomingBill[] => {
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

        return bills.sort((a, b) => a.days_until_due - b.days_until_due);
    }, []);

    const loadDashboardData = useCallback(async (refresh = false) => {
        try {
            if (!refresh) {
                setLoading(true);
            }

            const [
                overviewData,
                transactionsData,
                cardsData,
                budgetData,
                trendData,
                rewardData
            ] = await Promise.all([
                analyticsApi.getOverview().catch((err) => { console.error('Overview error:', err); return null; }),
                transactionApi.getTransactions({ limit: 5 }).catch((err) => { console.error('Transactions error:', err); return { data: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 0 } }; }),
                cardApi.getCards().catch((err) => { console.error('Cards error:', err); return []; }),
                budgetApi.getCurrentBudget().catch(() => null),
                analyticsApi.getTrends("6m").catch((err) => { console.error('Trends error:', err); return []; }),
                rewardsApi.getSummary().catch((err) => { console.error('Rewards error:', err); return null; }),
            ]);

            if (overviewData) setOverview(overviewData);
            if (transactionsData?.data) setRecentTransactions(transactionsData.data);
            if (budgetData) setBudgetStatus(budgetData);
            if (trendData) setSpendingTrend(trendData);

            if (cardsData) {
                setTotalCards(cardsData.length);
                const balance = cardsData.reduce((sum, card) => sum + (card.current_balance || 0), 0);
                setTotalBalance(balance);
                setUpcomingBills(calculateUpcomingBills(cardsData));
            }

            if (rewardData?.summary) {
                setTotalRewards(rewardData.summary.total_points_balance);
            }

        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            if (!refresh) {
                setLoading(false);
            }
        }
    }, [calculateUpcomingBills]);

    return {
        overview,
        budgetStatus,
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
