"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Star,
  TrendingUp,
  Award,
  Gift,
  Trophy,
  CreditCard,
  Calendar,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { rewardsApi, type RewardPoints, type RewardTransaction } from "@/lib/api/rewards";

export default function RewardsPage() {
  // Fetch rewards summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["rewards-summary"],
    queryFn: () => rewardsApi.getSummary(),
  });

  // Fetch all rewards
  const { data: allRewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ["rewards"],
    queryFn: () => rewardsApi.getAll(),
  });

  const isLoading = summaryLoading || rewardsLoading;

  if (isLoading) {
    return (
      <AppLayout title="Rewards" showRightSidebar={false}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-green"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Rewards & Points" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="text-secondary-text">
            Track and manage your credit card reward points
          </p>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary-text">Total Points</p>
                  <p className="text-2xl font-bold text-blue-500 mt-1">
                    {summary.summary.total_points_balance.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Star className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>

            <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary-text">Points Earned</p>
                  <p className="text-2xl font-bold text-primary-green mt-1">
                    {summary.summary.total_points_earned.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-primary-green/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-primary-green" />
                </div>
              </div>
            </div>

            <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary-text">Redeemed</p>
                  <p className="text-2xl font-bold text-purple-500 mt-1">
                    {summary.summary.total_points_redeemed.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Gift className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </div>

            <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary-text">Expiring Soon</p>
                  <p className="text-2xl font-bold text-warning mt-1">
                    {summary.summary.total_points_expiring_soon.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-warning/10 rounded-lg">
                  <Calendar className="w-6 h-6 text-warning" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rewards by Card */}
        <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-muted-text/10">
            <h3 className="text-lg font-semibold text-primary-text">
              Rewards by Card
            </h3>
          </div>

          {allRewards.length === 0 ? (
            <div className="text-center py-12 bg-card-bg">
              <Trophy className="w-12 h-12 text-secondary-text mx-auto mb-4" />
              <p className="text-secondary-text">No rewards data available</p>
            </div>
          ) : (
            <div className="divide-y divide-muted-text/10">
              {allRewards.map((reward) => (
                <RewardCard key={reward.id} reward={reward} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

interface RewardCardProps {
  reward: RewardPoints;
}

function RewardCard({ reward }: RewardCardProps) {
  // Fetch transactions for this card
  const { data: transactions = [] } = useQuery({
    queryKey: ["reward-transactions", reward.card_id],
    queryFn: () => rewardsApi.getCardTransactions(reward.card_id),
    enabled: !!reward.card_id,
  });

  const [showTransactions, setShowTransactions] = React.useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-primary-green/10 rounded-lg">
              <CreditCard className="w-5 h-5 text-primary-green" />
            </div>
            <div>
              <h4 className="font-semibold text-primary-text">
                {reward.card_name || "Unknown Card"}
              </h4>
              <p className="text-sm text-secondary-text">
                {reward.bank_name || "Unknown Bank"}
                {reward.card_number_last4 && ` •••• ${reward.card_number_last4}`}
              </p>
            </div>
          </div>

          {/* Points Breakdown */}
          <div className="grid grid-cols-3 gap-4 ml-12">
            <div>
              <p className="text-xs text-secondary-text">Available</p>
              <p className="text-lg font-semibold text-primary-text">
                {reward.points_balance.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-secondary-text">Earned</p>
              <p className="text-lg font-semibold text-success">
                +{reward.points_earned.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-secondary-text">Redeemed</p>
              <p className="text-lg font-semibold text-error">
                -{reward.points_redeemed.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Expiring Points */}
          {reward.points_expiring_soon > 0 && (
            <div className="mt-3 ml-12 flex items-center text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 text-warning rounded-lg">
                <Calendar className="w-4 h-4" />
                <span>
                  {reward.points_expiring_soon.toLocaleString()} points expiring
                  {reward.next_expiry_date && (
                    <span className="ml-1">
                      on {formatDate(reward.next_expiry_date, "short")}
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Show Transactions Toggle */}
          {transactions.length > 0 && (
            <button
              className="mt-3 ml-12 text-sm text-primary-green hover:underline"
              onClick={() => setShowTransactions(!showTransactions)}
            >
              {showTransactions ? "Hide" : "Show"} recent transactions ({transactions.length})
            </button>
          )}

          {/* Recent Transactions */}
          {showTransactions && transactions.length > 0 && (
            <div className="mt-4 ml-12 space-y-2">
              {transactions.slice(0, 5).map((txn) => (
                <TransactionRow key={txn.id} transaction={txn} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end space-y-2">
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-500">
              {reward.points_balance.toLocaleString()}
            </p>
            <p className="text-xs text-secondary-text">points</p>
          </div>
          <Badge
            label={formatDate(reward.last_updated, "short")}
            variant="default"
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

interface TransactionRowProps {
  transaction: RewardTransaction;
}

function TransactionRow({ transaction }: TransactionRowProps) {
  const isPositive = transaction.points_change > 0;

  return (
    <div className="flex items-center justify-between p-2 bg-hover-bg rounded-lg text-sm">
      <div className="flex-1">
        <p className="text-primary-text font-medium">
          {transaction.description || "Reward transaction"}
        </p>
        {transaction.merchant && (
          <p className="text-xs text-secondary-text">{transaction.merchant}</p>
        )}
        {transaction.transaction_date && (
          <p className="text-xs text-secondary-text">
            {formatDate(transaction.transaction_date, "short")}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {transaction.transaction_amount && (
          <span className="text-xs text-secondary-text">
            {formatCurrency(transaction.transaction_amount)}
          </span>
        )}
        <span
          className={cn(
            "font-semibold flex items-center gap-1",
            isPositive ? "text-success" : "text-error"
          )}
        >
          {isPositive ? "+" : ""}
          {transaction.points_change.toLocaleString()}
          <Star className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
